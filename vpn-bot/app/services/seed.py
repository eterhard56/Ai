import logging

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert

from app.config import Settings, get_settings
from app.db.models import Tariff, XrayServer
from app.db.session import async_session

logger = logging.getLogger(__name__)

DEFAULT_TARIFFS = [
    {"name": "1 месяц", "description": "Базовый тариф", "price_rub": 199, "duration_days": 30, "max_devices": 2, "sort_order": 1},
    {"name": "3 месяца", "description": "Выгодный тариф", "price_rub": 499, "duration_days": 90, "max_devices": 3, "sort_order": 2},
    {"name": "12 месяцев", "description": "Максимальная выгода", "price_rub": 1499, "duration_days": 365, "max_devices": 5, "sort_order": 3},
]


async def sync_servers_from_env(settings: Settings | None = None) -> int:
    settings = settings or get_settings()
    count = 0
    async with async_session() as session:
        for idx, srv in enumerate(settings.load_servers(), start=1):
            stmt = (
                insert(XrayServer)
                .values(
                    name=srv.name,
                    panel_url=srv.panel_url,
                    username=srv.username,
                    password=srv.password,
                    inbound_id=srv.inbound_id,
                    sub_domain=srv.sub_domain,
                    sub_uri=srv.sub_uri,
                    is_active=True,
                    priority=idx * 10,
                )
                .on_conflict_do_update(
                    index_elements=["name"],
                    set_={
                        "panel_url": srv.panel_url,
                        "username": srv.username,
                        "password": srv.password,
                        "inbound_id": srv.inbound_id,
                        "sub_domain": srv.sub_domain,
                        "sub_uri": srv.sub_uri,
                        "is_active": True,
                    },
                )
            )
            await session.execute(stmt)
            count += 1
        await session.commit()
    return count


async def seed_tariffs() -> int:
    async with async_session() as session:
        result = await session.execute(select(Tariff.id).limit(1))
        if result.scalar_one_or_none():
            return 0
        for t in DEFAULT_TARIFFS:
            session.add(Tariff(**t))
        await session.commit()
        return len(DEFAULT_TARIFFS)
