from celery import Celery
from celery.schedules import crontab

from app.config import get_settings

settings = get_settings()

celery_app = Celery(
    "ai_platform",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["app.tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Europe/Moscow",
    enable_utc=True,
    beat_schedule={
        "daily-analytics-report": {
            "task": "app.tasks.generate_daily_analytics",
            "schedule": crontab(hour=8, minute=0),
        },
        "daily-telegram-report": {
            "task": "app.tasks.send_daily_telegram_report",
            "schedule": crontab(hour=9, minute=0),
        },
        "crm-reminders": {
            "task": "app.tasks.check_crm_reminders",
            "schedule": crontab(minute="*/30"),
        },
        "postgres-backup": {
            "task": "app.tasks.backup_database",
            "schedule": crontab(hour=3, minute=0),
        },
    },
)
