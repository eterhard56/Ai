from typing import Any, Awaitable, Callable

from aiogram import BaseMiddleware
from aiogram.types import Message, TelegramObject
from sqlalchemy import select

from app.config import get_settings
from app.db.models import User
from app.db.session import async_session

settings = get_settings()


class BlockedUserMiddleware(BaseMiddleware):
    async def __call__(
        self,
        handler: Callable[[TelegramObject, dict[str, Any]], Awaitable[Any]],
        event: TelegramObject,
        data: dict[str, Any],
    ) -> Any:
        user = getattr(event, "from_user", None)
        if user and user.id not in settings.admin_id_list:
            async with async_session() as session:
                result = await session.execute(
                    select(User).where(User.telegram_id == user.id)
                )
                db_user = result.scalar_one_or_none()
                if db_user and db_user.is_blocked:
                    if isinstance(event, Message):
                        await event.answer("⛔ Аккаунт заблокирован.")
                    return None
        return await handler(event, data)
