from datetime import timezone

from aiogram import F, Router
from aiogram.filters import Command, CommandStart
from aiogram.types import Message
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.keyboards.menus import main_menu
from app.services.vpn_service import HAPP_INSTRUCTION, VPNService

router = Router()
settings = get_settings()


@router.message(CommandStart())
async def cmd_start(message: Message, session: AsyncSession) -> None:
    referral = None
    if message.text and len(message.text.split()) > 1:
        referral = message.text.split(maxsplit=1)[1].strip()

    svc = VPNService(session)
    user = await svc.get_or_create_user(
        telegram_id=message.from_user.id,
        username=message.from_user.username,
        first_name=message.from_user.first_name,
        referral_code=referral,
    )
    if user.is_blocked:
        await message.answer("⛔ Ваш аккаунт заблокирован. Обратитесь в поддержку.")
        return

    is_admin = message.from_user.id in settings.admin_id_list
    await message.answer(
        f"👋 Добро пожаловать, {message.from_user.first_name or 'друг'}!\n\n"
        "🔐 <b>VPN-сервис</b> на базе VLESS Reality + Happ.\n\n"
        "Выберите действие в меню ниже.",
        reply_markup=main_menu(is_admin),
    )


@router.message(Command("menu"))
@router.message(F.text == "◀️ В меню")
async def cmd_menu(message: Message) -> None:
    is_admin = message.from_user.id in settings.admin_id_list
    await message.answer("Главное меню:", reply_markup=main_menu(is_admin))


@router.message(F.text == "📡 Моя подписка")
async def my_subscription(message: Message, session: AsyncSession) -> None:
    svc = VPNService(session)
    user = await svc.get_or_create_user(
        message.from_user.id, message.from_user.username, message.from_user.first_name
    )
    sub = await svc.get_active_subscription(user)
    if not sub:
        await message.answer(
            "У вас нет активной подписки.\n"
            "Оформите пробный период или купите тариф."
        )
        return
    device = sub.device
    url = device.server.sub_uri.rstrip("/") + "/" + device.sub_id
    ends = sub.ends_at.astimezone(timezone.utc).strftime("%d.%m.%Y %H:%M UTC")
    trial = " (пробный)" if sub.is_trial else ""
    await message.answer(
        f"✅ <b>Активная подписка{trial}</b>\n"
        f"📅 Действует до: <b>{ends}</b>\n"
        f"📱 Устройство: {device.label}\n"
        f"🖥 Сервер: {device.server.name}\n\n"
        + HAPP_INSTRUCTION.format(sub_url=url)
    )


@router.message(F.text == "🎁 Пробный период")
async def trial_period(message: Message, session: AsyncSession) -> None:
    svc = VPNService(session)
    user = await svc.get_or_create_user(
        message.from_user.id, message.from_user.username, message.from_user.first_name
    )
    try:
        url, ends_at = await svc.activate_trial(user)
    except ValueError as e:
        await message.answer(f"❌ {e}")
        return
    ends = ends_at.strftime("%d.%m.%Y %H:%M UTC")
    await message.answer(
        f"🎉 Пробный период <b>{settings.trial_days} дн.</b> активирован!\n"
        f"📅 До: <b>{ends}</b>\n\n"
        + HAPP_INSTRUCTION.format(sub_url=url)
    )
