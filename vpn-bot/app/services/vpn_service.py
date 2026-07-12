import logging
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.db.models import (
    Device,
    Payment,
    PaymentStatus,
    ReferralBonus,
    Subscription,
    SubscriptionStatus,
    Tariff,
    User,
    XrayServer,
)
from app.services.x3ui_client import X3UIClient

logger = logging.getLogger(__name__)
settings = get_settings()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _to_ms(dt: datetime) -> int:
    return int(dt.timestamp() * 1000)


def build_subscription_url(server: XrayServer, sub_id: str) -> str:
    base = server.sub_uri.rstrip("/")
    return f"{base}/{sub_id}"


HAPP_INSTRUCTION = """
📱 <b>Инструкция для Happ (iOS)</b>

1. Установите <b>Happ</b> из App Store
2. Скопируйте ссылку подписки ниже
3. В Happ: <b>+</b> → <b>Добавить подписку</b> → вставьте URL
4. Включите профиль маршрутизации <b>VPN-Global</b> (если появится)
5. Подключитесь к серверу

🔗 <b>Подписка:</b>
<code>{sub_url}</code>

⚠️ Не передавайте ссылку третьим лицам — она персональная.
"""


class VPNService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_or_create_user(
        self,
        telegram_id: int,
        username: str | None,
        first_name: str | None,
        referral_code: str | None = None,
    ) -> User:
        result = await self.session.execute(
            select(User).where(User.telegram_id == telegram_id)
        )
        user = result.scalar_one_or_none()
        if user:
            if username:
                user.username = username
            if first_name:
                user.first_name = first_name
            return user

        referrer_id = None
        if referral_code:
            ref_result = await self.session.execute(
                select(User).where(User.referral_code == referral_code)
            )
            referrer = ref_result.scalar_one_or_none()
            if referrer and referrer.telegram_id != telegram_id:
                referrer_id = referrer.id

        user = User(
            telegram_id=telegram_id,
            username=username,
            first_name=first_name,
            referred_by_id=referrer_id,
        )
        self.session.add(user)
        await self.session.flush()

        if referrer_id:
            bonus = ReferralBonus(
                referrer_id=referrer_id,
                referred_id=user.id,
                bonus_days=settings.referral_bonus_days,
            )
            self.session.add(bonus)
        return user

    async def pick_server(self) -> XrayServer:
        result = await self.session.execute(
            select(XrayServer)
            .where(XrayServer.is_active.is_(True))
            .order_by(XrayServer.priority.asc())
        )
        servers = list(result.scalars().all())
        if not servers:
            raise RuntimeError("Нет активных Xray-серверов. Добавьте сервер в админке.")
        counts = await self.session.execute(
            select(Device.server_id, func.count(Device.id))
            .where(Device.is_active.is_(True))
            .group_by(Device.server_id)
        )
        load = {row[0]: row[1] for row in counts.all()}
        return min(servers, key=lambda s: load.get(s.id, 0))

    async def _x3ui(self, server: XrayServer) -> X3UIClient:
        client = X3UIClient(server.panel_url, server.username, server.password)
        await client.login()
        return client

    async def provision_device(
        self,
        user: User,
        days: int,
        label: str = "Устройство",
        is_trial: bool = False,
        tariff: Tariff | None = None,
        server: XrayServer | None = None,
    ) -> tuple[Device, Subscription, str]:
        server = server or await self.pick_server()
        ends_at = _utcnow() + timedelta(days=days)
        sub_id = f"tg{user.telegram_id}-{secrets.token_hex(4)}"
        email = f"tg_{user.telegram_id}_{secrets.token_hex(3)}"
        client_uuid = str(uuid.uuid4())

        x3 = await self._x3ui(server)
        try:
            await x3.add_client(
                inbound_id=server.inbound_id,
                client_uuid=client_uuid,
                email=email,
                sub_id=sub_id,
                tg_id=user.telegram_id,
                expiry_time_ms=_to_ms(ends_at),
                total_gb=tariff.traffic_gb if tariff and tariff.traffic_gb else 0,
            )
        finally:
            await x3.close()

        device = Device(
            user_id=user.id,
            server_id=server.id,
            label=label,
            x3ui_email=email,
            x3ui_uuid=client_uuid,
            sub_id=sub_id,
        )
        self.session.add(device)
        await self.session.flush()

        subscription = Subscription(
            user_id=user.id,
            device_id=device.id,
            tariff_id=tariff.id if tariff else None,
            is_trial=is_trial,
            starts_at=_utcnow(),
            ends_at=ends_at,
            status=SubscriptionStatus.ACTIVE,
        )
        self.session.add(subscription)
        sub_url = build_subscription_url(server, sub_id)
        return device, subscription, sub_url

    async def activate_trial(self, user: User) -> tuple[str, datetime]:
        if user.trial_used:
            raise ValueError("Пробный период уже использован")
        active = await self.get_active_subscription(user)
        if active:
            raise ValueError("У вас уже есть активная подписка")
        _, sub, url = await self.provision_device(
            user, days=settings.trial_days, label="Пробный", is_trial=True
        )
        user.trial_used = True
        return url, sub.ends_at

    async def get_active_subscription(self, user: User) -> Subscription | None:
        result = await self.session.execute(
            select(Subscription)
            .options(selectinload(Subscription.device).selectinload(Device.server))
            .where(
                Subscription.user_id == user.id,
                Subscription.status == SubscriptionStatus.ACTIVE,
                Subscription.ends_at > _utcnow(),
            )
            .order_by(Subscription.ends_at.desc())
        )
        return result.scalars().first()

    async def get_user_devices(self, user: User) -> list[Device]:
        result = await self.session.execute(
            select(Device)
            .options(selectinload(Device.server), selectinload(Device.subscription))
            .where(Device.user_id == user.id, Device.is_active.is_(True))
            .order_by(Device.created_at.desc())
        )
        return list(result.scalars().all())

    async def extend_subscription(
        self, subscription: Subscription, extra_days: int
    ) -> datetime:
        device = subscription.device
        server = device.server
        new_end = max(subscription.ends_at, _utcnow()) + timedelta(days=extra_days)
        subscription.ends_at = new_end
        subscription.status = SubscriptionStatus.ACTIVE

        x3 = await self._x3ui(server)
        try:
            await x3.update_client_expiry(
                server.inbound_id, device.x3ui_email, _to_ms(new_end), enable=True
            )
        finally:
            await x3.close()
        return new_end

    async def deactivate_device(self, device: Device) -> None:
        server = device.server
        x3 = await self._x3ui(server)
        try:
            await x3.delete_client(server.inbound_id, device.x3ui_uuid)
        finally:
            await x3.close()
        device.is_active = False
        if device.subscription:
            device.subscription.status = SubscriptionStatus.CANCELLED

    async def process_payment(self, payment: Payment) -> tuple[str, datetime]:
        payment.status = PaymentStatus.PAID
        payment.paid_at = _utcnow()
        user = payment.user
        tariff = payment.tariff
        devices = await self.get_user_devices(user)
        active_sub = await self.get_active_subscription(user)

        if active_sub and len(devices) < tariff.max_devices:
            new_end = await self.extend_subscription(active_sub, tariff.duration_days)
            sub_url = build_subscription_url(active_sub.device.server, active_sub.device.sub_id)
            return sub_url, new_end

        if active_sub:
            new_end = await self.extend_subscription(active_sub, tariff.duration_days)
            return build_subscription_url(active_sub.device.server, active_sub.device.sub_id), new_end

        _, sub, url = await self.provision_device(
            user,
            days=tariff.duration_days,
            label=f"Устройство {len(devices) + 1}",
            tariff=tariff,
        )
        return url, sub.ends_at

    async def expire_due_subscriptions(self) -> int:
        result = await self.session.execute(
            select(Subscription)
            .options(selectinload(Subscription.device).selectinload(Device.server))
            .where(
                Subscription.status == SubscriptionStatus.ACTIVE,
                Subscription.ends_at <= _utcnow(),
            )
        )
        subs = list(result.scalars().all())
        count = 0
        for sub in subs:
            try:
                device = sub.device
                x3 = await self._x3ui(device.server)
                try:
                    await x3.update_client_expiry(
                        device.server.inbound_id,
                        device.x3ui_email,
                        _to_ms(sub.ends_at),
                        enable=False,
                    )
                finally:
                    await x3.close()
                sub.status = SubscriptionStatus.EXPIRED
                count += 1
            except Exception:
                logger.exception("Failed to expire subscription %s", sub.id)
        return count

    async def get_active_tariffs(self) -> list[Tariff]:
        result = await self.session.execute(
            select(Tariff)
            .where(Tariff.is_active.is_(True))
            .order_by(Tariff.sort_order.asc(), Tariff.price_rub.asc())
        )
        return list(result.scalars().all())
