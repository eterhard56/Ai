from aiogram import F, Router
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import CallbackQuery, Message
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.db.models import SupportTicket, User
from app.keyboards.menus import device_keyboard
from app.services.vpn_service import HAPP_INSTRUCTION, VPNService

router = Router()
settings = get_settings()


class SupportStates(StatesGroup):
    waiting_message = State()


@router.message(F.text == "📱 Мои устройства")
async def my_devices(message: Message, session: AsyncSession) -> None:
    svc = VPNService(session)
    user = await svc.get_or_create_user(
        message.from_user.id, message.from_user.username, message.from_user.first_name
    )
    devices = await svc.get_user_devices(user)
    if not devices:
        await message.answer("У вас нет активных устройств.")
        return
    for d in devices:
        sub = d.subscription
        ends = sub.ends_at.strftime("%d.%m.%Y") if sub else "—"
        await message.answer(
            f"📱 <b>{d.label}</b>\n"
            f"🖥 {d.server.name}\n"
            f"📅 до {ends}",
            reply_markup=device_keyboard(d.id),
        )


@router.callback_query(F.data.startswith("device_sub:"))
async def device_subscription(callback: CallbackQuery, session: AsyncSession) -> None:
    device_id = int(callback.data.split(":")[1])
    result = await session.execute(
        select(User).where(User.telegram_id == callback.from_user.id)
    )
    user = result.scalar_one_or_none()
    if not user:
        await callback.answer("Пользователь не найден", show_alert=True)
        return
    svc = VPNService(session)
    devices = await svc.get_user_devices(user)
    device = next((d for d in devices if d.id == device_id), None)
    if not device:
        await callback.answer("Устройство не найдено", show_alert=True)
        return
    url = device.server.sub_uri.rstrip("/") + "/" + device.sub_id
    await callback.message.answer(HAPP_INSTRUCTION.format(sub_url=url))
    await callback.answer()


@router.callback_query(F.data.startswith("device_del:"))
async def device_delete(callback: CallbackQuery, session: AsyncSession) -> None:
    device_id = int(callback.data.split(":")[1])
    result = await session.execute(
        select(User).where(User.telegram_id == callback.from_user.id)
    )
    user = result.scalar_one_or_none()
    if not user:
        return
    svc = VPNService(session)
    devices = await svc.get_user_devices(user)
    device = next((d for d in devices if d.id == device_id), None)
    if not device:
        await callback.answer("Не найдено", show_alert=True)
        return
    await svc.deactivate_device(device)
    await callback.message.edit_text(f"🗑 Устройство «{device.label}» удалено.")
    await callback.answer()


@router.message(F.text == "👥 Рефералы")
async def referrals(message: Message, session: AsyncSession) -> None:
    svc = VPNService(session)
    user = await svc.get_or_create_user(
        message.from_user.id, message.from_user.username, message.from_user.first_name
    )
    bot_user = await message.bot.get_me()
    link = f"https://t.me/{bot_user.username}?start={user.referral_code}"
    await message.answer(
        f"👥 <b>Реферальная программа</b>\n\n"
        f"Пригласите друга — получите <b>+{settings.referral_bonus_days} дней</b> VPN.\n\n"
        f"🔗 Ваша ссылка:\n<code>{link}</code>\n\n"
        f"Код: <code>{user.referral_code}</code>"
    )


@router.message(F.text == "💬 Поддержка")
async def support_start(message: Message, state: FSMContext) -> None:
    await state.set_state(SupportStates.waiting_message)
    await message.answer(
        "💬 Напишите ваш вопрос одним сообщением — мы передадим его в поддержку."
    )


@router.message(SupportStates.waiting_message)
async def support_message(message: Message, session: AsyncSession, state: FSMContext) -> None:
    await state.clear()
    svc = VPNService(session)
    user = await svc.get_or_create_user(
        message.from_user.id, message.from_user.username, message.from_user.first_name
    )
    ticket = SupportTicket(user_id=user.id, message=message.text or "")
    session.add(ticket)
    await message.answer(
        f"✅ Обращение #{ticket.id} принято. Мы ответим в ближайшее время."
    )
    for admin_id in settings.admin_id_list:
        try:
            await message.bot.send_message(
                admin_id,
                f"📩 Тикет #{ticket.id} от @{user.username or user.telegram_id}:\n{message.text}",
            )
        except Exception:
            pass
