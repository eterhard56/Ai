from aiogram import F, Router
from aiogram.types import CallbackQuery, Message
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from sqlalchemy.orm import selectinload

from app.db.models import Payment, User
from app.keyboards.menus import confirm_payment_keyboard, tariffs_keyboard
from app.services.payment_service import PaymentService
from app.services.vpn_service import HAPP_INSTRUCTION, VPNService

router = Router()


@router.message(F.text == "🛒 Купить VPN")
async def buy_vpn(message: Message, session: AsyncSession) -> None:
    svc = VPNService(session)
    user = await svc.get_or_create_user(
        message.from_user.id, message.from_user.username, message.from_user.first_name
    )
    tariffs = await svc.get_active_tariffs()
    if not tariffs:
        await message.answer("Тарифы временно недоступны.")
        return
    await message.answer(
        "💰 <b>Выберите тариф:</b>",
        reply_markup=tariffs_keyboard(tariffs),
    )


@router.callback_query(F.data.startswith("tariff:"))
async def select_tariff(callback: CallbackQuery, session: AsyncSession) -> None:
    tariff_id = int(callback.data.split(":")[1])
    svc = VPNService(session)
    pay_svc = PaymentService(session)
    user = await svc.get_or_create_user(
        callback.from_user.id, callback.from_user.username, callback.from_user.first_name
    )
    tariffs = await svc.get_active_tariffs()
    tariff = next((t for t in tariffs if t.id == tariff_id), None)
    if not tariff:
        await callback.answer("Тариф не найден", show_alert=True)
        return
    payment = await pay_svc.create_payment(user, tariff)
    await callback.message.edit_text(
        f"📦 <b>{tariff.name}</b>\n"
        f"⏱ {tariff.duration_days} дн. | 📱 до {tariff.max_devices} устр.\n\n"
        + pay_svc.payment_instructions(payment),
        reply_markup=confirm_payment_keyboard(payment.id),
    )
    await callback.answer()


@router.callback_query(F.data.startswith("pay_confirm:"))
async def confirm_payment(callback: CallbackQuery, session: AsyncSession) -> None:
    payment_id = int(callback.data.split(":")[1])
    result = await session.execute(
        select(Payment)
        .options(selectinload(Payment.user), selectinload(Payment.tariff))
        .where(Payment.id == payment_id)
    )
    payment = result.scalar_one_or_none()
    if not payment or payment.user.telegram_id != callback.from_user.id:
        await callback.answer("Платёж не найден", show_alert=True)
        return

    pay_svc = PaymentService(session)
    vpn_svc = VPNService(session)
    try:
        await pay_svc.confirm_demo_payment(payment)
        sub_url, ends_at = await vpn_svc.process_payment(payment)
    except Exception as e:
        await callback.answer(str(e), show_alert=True)
        return

    ends = ends_at.strftime("%d.%m.%Y %H:%M UTC")
    await callback.message.edit_text(
        f"✅ <b>Оплата подтверждена!</b>\n"
        f"📅 Подписка до: <b>{ends}</b>\n\n"
        + HAPP_INSTRUCTION.format(sub_url=sub_url)
    )
    await callback.answer("Подписка активирована!")


@router.callback_query(F.data == "cancel")
async def cancel_action(callback: CallbackQuery) -> None:
    await callback.message.edit_text("Отменено.")
    await callback.answer()
