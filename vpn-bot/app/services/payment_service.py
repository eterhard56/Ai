import logging
import secrets
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db.models import Payment, PaymentStatus, Tariff, User

logger = logging.getLogger(__name__)
settings = get_settings()


class PaymentService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_payment(self, user: User, tariff: Tariff) -> Payment:
        payment = Payment(
            user_id=user.id,
            tariff_id=tariff.id,
            amount_rub=float(tariff.price_rub),
            status=PaymentStatus.PENDING,
            provider=settings.payment_provider,
            external_id=f"demo-{secrets.token_hex(8)}",
        )
        self.session.add(payment)
        await self.session.flush()
        return payment

    async def confirm_demo_payment(self, payment: Payment) -> Payment:
        """Demo provider: instant confirmation for testing."""
        if payment.status != PaymentStatus.PENDING:
            raise ValueError("Платёж уже обработан")
        payment.status = PaymentStatus.PAID
        payment.paid_at = datetime.now(timezone.utc)
        return payment

    def payment_instructions(self, payment: Payment) -> str:
        if settings.payment_provider == "demo":
            return (
                f"🧪 <b>Демо-оплата #{payment.id}</b>\n"
                f"Сумма: <b>{payment.amount_rub:.0f} ₽</b>\n\n"
                "Нажмите «Подтвердить оплату» для активации подписки.\n"
                "В продакшене подключите YooKassa в .env"
            )
        return "Оплата через платёжную систему. Свяжитесь с поддержкой."
