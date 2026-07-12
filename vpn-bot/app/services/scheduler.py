import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.db.session import async_session
from app.services.vpn_service import VPNService

logger = logging.getLogger(__name__)


async def expire_subscriptions_job() -> None:
    async with async_session() as session:
        svc = VPNService(session)
        count = await svc.expire_due_subscriptions()
        await session.commit()
        if count:
            logger.info("Expired %s subscriptions", count)


def setup_scheduler() -> AsyncIOScheduler:
    scheduler = AsyncIOScheduler(timezone="UTC")
    scheduler.add_job(expire_subscriptions_job, "interval", hours=1, id="expire_subs")
    return scheduler
