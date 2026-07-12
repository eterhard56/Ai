from aiogram import F, Router
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import Message
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.db.models import Device, Payment, PaymentStatus, Subscription, SubscriptionStatus, Tariff, User, XrayServer
from app.keyboards.menus import admin_menu, admin_user_keyboard, main_menu
from app.services.vpn_service import VPNService

router = Router()
settings = get_settings()


def is_admin(telegram_id: int) -> bool:
    return telegram_id in settings.admin_id_list


class AdminStates(StatesGroup):
    search_user = State()
    broadcast = State()
    add_server = State()


@router.message(F.text == "🛠 Админ-панель")
@router.message(Command("admin"))
async def admin_panel(message: Message) -> None:
    if not is_admin(message.from_user.id):
        await message.answer("Нет доступа.")
        return
    await message.answer("🛠 <b>Админ-панель</b>", reply_markup=admin_menu())


@router.message(F.text == "👤 Пользователи")
async def admin_users(message: Message, session: AsyncSession) -> None:
    if not is_admin(message.from_user.id):
        return
    result = await session.execute(
        select(User).order_by(User.created_at.desc()).limit(20)
    )
    users = list(result.scalars().all())
    lines = [f"👤 <b>Последние {len(users)} пользователей</b>\n"]
    for u in users:
        status = "🚫" if u.is_blocked else "✅"
        lines.append(
            f"{status} <code>{u.telegram_id}</code> @{u.username or '—'} "
            f"[{u.referral_code}]"
        )
    await message.answer("\n".join(lines))


@router.message(F.text == "🔍 Поиск")
async def admin_search_prompt(message: Message, state: FSMContext) -> None:
    if not is_admin(message.from_user.id):
        return
    await state.set_state(AdminStates.search_user)
    await message.answer("Введите Telegram ID или @username:")


@router.message(AdminStates.search_user)
async def admin_search(message: Message, session: AsyncSession, state: FSMContext) -> None:
    if not is_admin(message.from_user.id):
        return
    await state.clear()
    q = (message.text or "").strip().lstrip("@")
    stmt = select(User).options(selectinload(User.devices))
    if q.isdigit():
        stmt = stmt.where(User.telegram_id == int(q))
    else:
        stmt = stmt.where(User.username.ilike(f"%{q}%"))
    result = await session.execute(stmt.limit(5))
    users = list(result.scalars().all())
    if not users:
        await message.answer("Не найдено.")
        return
    for u in users:
        sub_result = await session.execute(
            select(Subscription)
            .where(Subscription.user_id == u.id, Subscription.status == SubscriptionStatus.ACTIVE)
            .order_by(Subscription.ends_at.desc())
            .limit(1)
        )
        sub = sub_result.scalar_one_or_none()
        ends = sub.ends_at.strftime("%d.%m.%Y") if sub else "нет"
        await message.answer(
            f"👤 ID: <code>{u.telegram_id}</code>\n"
            f"@{u.username or '—'} | Пробный: {'да' if u.trial_used else 'нет'}\n"
            f"Подписка до: {ends} | Устройств: {len(u.devices)}",
            reply_markup=admin_user_keyboard(u.id),
        )


@router.callback_query(F.data.startswith("adm_extend:"))
async def admin_extend(callback, session: AsyncSession) -> None:
    if not is_admin(callback.from_user.id):
        return
    _, user_id, days = callback.data.split(":")
    user_id, days = int(user_id), int(days)
    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        await callback.answer("Не найден", show_alert=True)
        return
    svc = VPNService(session)
    sub = await svc.get_active_subscription(user)
    if not sub:
        _, sub, _ = await svc.provision_device(user, days=days, label="Admin")
        ends = sub.ends_at
        await callback.message.answer(f"✅ Создана подписка до {ends.strftime('%d.%m.%Y')}")
    else:
        ends = await svc.extend_subscription(sub, days)
        await callback.message.answer(f"✅ Продлено до {ends.strftime('%d.%m.%Y')}")
    await callback.answer()


@router.callback_query(F.data.startswith("adm_block:"))
async def admin_block(callback, session: AsyncSession) -> None:
    if not is_admin(callback.from_user.id):
        return
    user_id = int(callback.data.split(":")[1])
    user = (await session.execute(select(User).where(User.id == user_id))).scalar_one()
    user.is_blocked = True
    await callback.answer("Заблокирован")


@router.callback_query(F.data.startswith("adm_unblock:"))
async def admin_unblock(callback, session: AsyncSession) -> None:
    if not is_admin(callback.from_user.id):
        return
    user_id = int(callback.data.split(":")[1])
    user = (await session.execute(select(User).where(User.id == user_id))).scalar_one()
    user.is_blocked = False
    await callback.answer("Разблокирован")


@router.callback_query(F.data.startswith("adm_delvpn:"))
async def admin_del_vpn(callback, session: AsyncSession) -> None:
    if not is_admin(callback.from_user.id):
        return
    user_id = int(callback.data.split(":")[1])
    result = await session.execute(
        select(Device)
        .options(selectinload(Device.server))
        .where(Device.user_id == user_id, Device.is_active.is_(True))
    )
    devices = list(result.scalars().all())
    svc = VPNService(session)
    for d in devices:
        await svc.deactivate_device(d)
    await callback.message.answer(f"🗑 Удалено устройств: {len(devices)}")
    await callback.answer()


@router.message(F.text == "📊 Статистика")
async def admin_stats(message: Message, session: AsyncSession) -> None:
    if not is_admin(message.from_user.id):
        return
    users = (await session.execute(select(func.count(User.id)))).scalar() or 0
    active_subs = (
        await session.execute(
            select(func.count(Subscription.id)).where(
                Subscription.status == SubscriptionStatus.ACTIVE
            )
        )
    ).scalar() or 0
    paid = (
        await session.execute(
            select(func.sum(Payment.amount_rub)).where(Payment.status == PaymentStatus.PAID)
        )
    ).scalar() or 0
    devices = (
        await session.execute(
            select(func.count(Device.id)).where(Device.is_active.is_(True))
        )
    ).scalar() or 0
    await message.answer(
        f"📊 <b>Статистика</b>\n\n"
        f"👤 Пользователей: {users}\n"
        f"✅ Активных подписок: {active_subs}\n"
        f"📱 Устройств: {devices}\n"
        f"💰 Выручка: {float(paid):.0f} ₽"
    )


@router.message(F.text == "💰 Тарифы")
async def admin_tariffs(message: Message, session: AsyncSession) -> None:
    if not is_admin(message.from_user.id):
        return
    tariffs = (await session.execute(select(Tariff).order_by(Tariff.sort_order))).scalars().all()
    lines = ["💰 <b>Тарифы</b>\n"]
    for t in tariffs:
        status = "✅" if t.is_active else "❌"
        lines.append(
            f"{status} #{t.id} {t.name}: {float(t.price_rub):.0f}₽ / {t.duration_days}д / "
            f"{t.max_devices} устр."
        )
    await message.answer("\n".join(lines))


@router.message(F.text == "🖥 Серверы")
async def admin_servers(message: Message, session: AsyncSession) -> None:
    if not is_admin(message.from_user.id):
        return
    servers = (await session.execute(select(XrayServer).order_by(XrayServer.priority))).scalars().all()
    lines = ["🖥 <b>Xray-серверы</b>\n"]
    for s in servers:
        status = "✅" if s.is_active else "❌"
        dev_count = (
            await session.execute(
                select(func.count(Device.id)).where(Device.server_id == s.id, Device.is_active.is_(True))
            )
        ).scalar() or 0
        lines.append(
            f"{status} <b>{s.name}</b> (#{s.id})\n"
            f"   Panel: {s.panel_url}\n"
            f"   Inbound: {s.inbound_id} | Sub: {s.sub_uri}\n"
            f"   Клиентов: {dev_count}"
        )
    await message.answer("\n".join(lines))


@router.message(F.text == "📢 Рассылка")
async def admin_broadcast_prompt(message: Message, state: FSMContext) -> None:
    if not is_admin(message.from_user.id):
        return
    await state.set_state(AdminStates.broadcast)
    await message.answer("Введите текст рассылки (HTML):")


@router.message(AdminStates.broadcast)
async def admin_broadcast(message: Message, session: AsyncSession, state: FSMContext) -> None:
    if not is_admin(message.from_user.id):
        return
    await state.clear()
    users = (await session.execute(select(User).where(User.is_blocked.is_(False)))).scalars().all()
    sent, failed = 0, 0
    for u in users:
        try:
            await message.bot.send_message(u.telegram_id, message.text or "")
            sent += 1
        except Exception:
            failed += 1
    await message.answer(f"📢 Рассылка: отправлено {sent}, ошибок {failed}")
