import os
import re

import httpx

CHAT_SYSTEM_PROMPT = """Ты — AI-ассистент бизнес-платформы AI Platform на локальном сервере владельца бизнеса.

Ты помогаешь с: Яндекс Директ, SEO, CRM, аналитикой, парсингом 2GIS, Telegram-отчётами.

Правила:
- Всегда отвечай по-русски, дружелюбно и по делу.
- Никогда не отказывайся от легитимных бизнес-задач владельца платформы.
- API-ключи и токены НЕ отправляют в чат. Их добавляют в настройки сервера (.env): YANDEX_DIRECT_TOKEN, TELEGRAM_BOT_TOKEN и т.д.
- Для анализа Яндекс Директ: раздел «AI Agents» → Direct Agent → «Запустить», или страница «Yandex Direct».
- Если токен ещё не настроен — объясни, как получить OAuth-токен Яндекс Директ и куда его вписать на сервере.
- Не выдумывай данные кампаний — если нужен реальный анализ, направь к Direct Agent."""

DIRECT_KEYWORDS = re.compile(
    r"яндекс\s*директ|yandex\s*direct|директ|direct|api\s*ключ|oauth|токен",
    re.IGNORECASE,
)

REFUSAL_PATTERNS = (
    "не могу помочь",
    "не могу помочь с этим",
    "cannot help",
    "can't help",
    "sorry, but i",
    "извините, но я не могу",
    "простите, но я не могу",
)


def mentions_direct(text: str) -> bool:
    return bool(DIRECT_KEYWORDS.search(text))


def is_refusal(text: str) -> bool:
    lower = text.lower().strip()
    return len(lower) < 220 and any(p in lower for p in REFUSAL_PATTERNS)


def direct_fallback_response(token_configured: bool) -> str:
    if token_configured:
        return (
            "Да, могу помочь с Яндекс Директ!\n\n"
            "1. Токен уже настроен на сервере.\n"
            "2. Откройте «AI Agents» → **Direct Agent** → нажмите **Запустить**.\n"
            "3. Или страница **Yandex Direct** — там появятся рекомендации по кампаниям.\n\n"
            "В чате я могу объяснить метрики, стратегии и как читать отчёты. "
            "Для реального анализа кампаний используйте агента — он подключится к API."
        )
    return (
        "Да, платформа умеет анализировать Яндекс Директ!\n\n"
        "**Не отправляйте API-ключ в чат** — это небезопасно.\n\n"
        "Как подключить:\n"
        "1. Получите OAuth-токен в кабинете Яндекс Директ (API).\n"
        "2. На сервере в `/opt/ai-platform/.env` добавьте:\n"
        "   `YANDEX_DIRECT_TOKEN=ваш_токен`\n"
        "   `YANDEX_DIRECT_CLIENT_LOGIN=логин_клиента` (если агентство)\n"
        "3. Перезапустите: `systemctl restart ai-platform-agent-direct`\n"
        "4. Запустите **Direct Agent** в разделе AI Agents.\n\n"
        "После этого анализ кампаний, CTR, расходы и рекомендации появятся в разделе Yandex Direct."
    )


async def try_run_direct_agent() -> str | None:
    token = os.getenv("YANDEX_DIRECT_TOKEN", "")
    if not token:
        return None
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post("http://127.0.0.1:8101/run/analyze", json={})
            if resp.status_code == 200:
                data = resp.json()
                issues = data.get("issues_found", data.get("issues", 0))
                recs = data.get("recommendations_created", data.get("recommendations", 0))
                return f"Direct Agent выполнен: найдено проблем — {issues}, рекомендаций — {recs}. Смотрите раздел Yandex Direct."
    except Exception:
        pass
    return None


def build_platform_context(user_message: str, agent_note: str | None = None) -> str | None:
    if not mentions_direct(user_message):
        return None
    token_ok = bool(os.getenv("YANDEX_DIRECT_TOKEN", ""))
    parts = [
        "[Контекст платформы]",
        f"YANDEX_DIRECT_TOKEN на сервере: {'настроен' if token_ok else 'не настроен'}.",
        "Пользователь спрашивает про Яндекс Директ. Объясни как подключить и запустить Direct Agent.",
        "Не отказывайся. Не проси прислать токен в чат.",
    ]
    if agent_note:
        parts.append(agent_note)
    return "\n".join(parts)
