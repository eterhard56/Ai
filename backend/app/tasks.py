import httpx
from celery import shared_task

from app.config import get_settings
from app.core.logging import setup_logging

logger = setup_logging("celery-tasks")
settings = get_settings()


@shared_task(name="app.tasks.generate_daily_analytics")
def generate_daily_analytics():
    try:
        response = httpx.post("http://agent-analytics:8003/run/daily", timeout=300)
        logger.info(f"Daily analytics triggered: {response.status_code}")
        return {"status": "ok", "code": response.status_code}
    except Exception as e:
        logger.error(f"Daily analytics failed: {e}")
        return {"status": "error", "message": str(e)}


@shared_task(name="app.tasks.send_daily_telegram_report")
def send_daily_telegram_report():
    try:
        response = httpx.post("http://agent-telegram:8006/send/daily-report", timeout=60)
        logger.info(f"Daily telegram report: {response.status_code}")
        return {"status": "ok", "code": response.status_code}
    except Exception as e:
        logger.error(f"Daily telegram report failed: {e}")
        return {"status": "error", "message": str(e)}


@shared_task(name="app.tasks.check_crm_reminders")
def check_crm_reminders():
    try:
        response = httpx.post("http://agent-crm:8004/run/reminders", timeout=60)
        return {"status": "ok", "code": response.status_code}
    except Exception as e:
        logger.error(f"CRM reminders failed: {e}")
        return {"status": "error", "message": str(e)}


@shared_task(name="app.tasks.backup_database")
def backup_database():
    try:
        response = httpx.post("http://backup:8080/run", timeout=300)
        logger.info(f"Database backup: {response.status_code}")
        return {"status": "ok", "code": response.status_code}
    except Exception as e:
        logger.error(f"Database backup failed: {e}")
        return {"status": "error", "message": str(e)}
