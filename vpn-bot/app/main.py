import asyncio
import logging

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.fsm.storage.redis import RedisStorage
from redis.asyncio import Redis

from app.config import get_settings
from app.handlers.admin.panel import router as admin_router
from app.handlers.user.devices import router as devices_router
from app.handlers.user.payment import router as payment_router
from app.handlers.user.start import router as start_router
from app.middlewares.auth import BlockedUserMiddleware
from app.middlewares.db import DbSessionMiddleware
from app.services.scheduler import setup_scheduler
from app.services.seed import seed_tariffs, sync_servers_from_env

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def main() -> None:
    settings = get_settings()
    logging.getLogger().setLevel(settings.log_level)

    await sync_servers_from_env(settings)
    await seed_tariffs()
    logger.info("Seeded servers and tariffs")

    redis = Redis.from_url(settings.redis_url)
    storage = RedisStorage(redis=redis)

    bot = Bot(
        token=settings.bot_token,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML),
    )
    dp = Dispatcher(storage=storage)
    dp.update.middleware(DbSessionMiddleware())
    dp.update.middleware(BlockedUserMiddleware())

    dp.include_router(start_router)
    dp.include_router(payment_router)
    dp.include_router(devices_router)
    dp.include_router(admin_router)

    scheduler = setup_scheduler()
    scheduler.start()

    logger.info("VPN Bot started")
    try:
        await dp.start_polling(bot)
    finally:
        scheduler.shutdown(wait=False)
        await redis.aclose()
        await bot.session.close()


if __name__ == "__main__":
    asyncio.run(main())
