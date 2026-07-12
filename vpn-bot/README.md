# VPN Telegram Bot

Коммерческий Telegram-бот для VPN-сервиса на базе **VLESS Reality + 3X-UI + Happ**.

## Стек

- Python 3.12, aiogram 3
- PostgreSQL, Redis
- SQLAlchemy 2 (async), Alembic
- APScheduler
- Docker Compose

## Функции

### Пользователь
- Регистрация по `/start` (с реферальным кодом `?start=CODE`)
- Бесплатный пробный период
- Покупка / продление подписки (демо-оплата, готово к YooKassa)
- Получение Happ Subscription URL + инструкция
- Просмотр срока действия
- Мои устройства (ссылка / удаление)
- Реферальная система
- Поддержка (тикеты админам)

### Администратор (`ADMIN_IDS` в `.env`)
- Список и поиск пользователей
- Продление / блокировка / удаление VPN
- Статистика, тарифы, серверы
- Рассылка

### После оплаты автоматически
1. Создаётся клиент в 3X-UI (`addClient`)
2. Генерируется `https://domain/sub/{sub_id}`
3. Пользователь получает ссылку и инструкцию Happ

## Быстрый старт (локально)

```bash
cd vpn-bot
cp .env.example .env
# Заполните BOT_TOKEN, ADMIN_IDS, POSTGRES_PASSWORD, SERVER_1_*

docker compose --profile migrate run --rm migrator
docker compose up -d --build
docker compose logs -f bot
```

## Установка на VPS (`/opt/vpn-bot`)

Проект **изолирован** — не изменяет `xray-service`, `client-finder`, `ai-platform`.

```bash
# На сервере (из клонированного репозитория)
cd /path/to/Ai/vpn-bot
chmod +x scripts/install-vps.sh
sudo INSTALL_DIR=/opt/vpn-bot ./scripts/install-vps.sh
```

Или вручную:

```bash
sudo mkdir -p /opt/vpn-bot
sudo rsync -a vpn-bot/ /opt/vpn-bot/
cd /opt/vpn-bot
cp .env.example .env
nano .env   # BOT_TOKEN, ADMIN_IDS, SERVER_1_*
docker compose --profile migrate run --rm migrator
docker compose up -d --build
```

### Подключение к 3X-UI на том же VPS

3X-UI работает в `network_mode: host` на порту `2053`. Из Docker-контейнера бота:

```env
SERVER_1_PANEL_URL=http://host.docker.internal:2053
SERVER_1_USERNAME=admin
SERVER_1_PASSWORD=your_panel_password
SERVER_1_INBOUND_ID=1
SERVER_1_SUB_DOMAIN=skolesnikov.site
SERVER_1_SUB_URI=https://skolesnikov.site/sub/
```

### Несколько серверов

Добавьте блоки `SERVER_2_*`, `SERVER_3_*` в `.env`. Бот выбирает сервер с наименьшей нагрузкой (число активных устройств).

## Переменные окружения

| Переменная | Описание |
|------------|----------|
| `BOT_TOKEN` | Токен Telegram-бота |
| `ADMIN_IDS` | Telegram ID админов через запятую |
| `POSTGRES_PASSWORD` | Пароль БД |
| `REDIS_URL` | Redis для FSM |
| `TRIAL_DAYS` | Дней пробного периода (по умолчанию 3) |
| `REFERRAL_BONUS_DAYS` | Бонус рефереру (по умолчанию 7) |
| `PAYMENT_PROVIDER` | `demo` или `yookassa` |
| `SERVER_N_*` | Параметры N-го Xray-сервера |

## Эксплуатация

```bash
cd /opt/vpn-bot

# Логи
docker compose logs -f bot

# Перезапуск
docker compose restart bot

# Миграции после обновления
docker compose --profile migrate run --rm migrator

# Остановка
docker compose down

# Бэкап БД
docker compose exec postgres pg_dump -U vpn_bot vpn_bot > backup.sql
```

## Структура проекта

```
vpn-bot/
├── app/
│   ├── main.py              # Точка входа
│   ├── config.py            # Настройки из .env
│   ├── db/models.py         # SQLAlchemy модели
│   ├── services/
│   │   ├── x3ui_client.py   # API 3X-UI
│   │   ├── vpn_service.py   # Бизнес-логика VPN
│   │   ├── payment_service.py
│   │   ├── scheduler.py     # APScheduler
│   │   └── seed.py          # Сиды тарифов/серверов
│   ├── handlers/
│   │   ├── user/            # Пользовательские команды
│   │   └── admin/           # Админ-панель
│   └── keyboards/
├── alembic/                 # Миграции
├── docker-compose.yml
└── scripts/install-vps.sh
```

## Платежи

Сейчас включён режим **`PAYMENT_PROVIDER=demo`**: кнопка «Подтвердить оплату» активирует подписку без реального платежа.

Для продакшена подключите YooKassa в `payment_service.py` и укажите ключи в `.env`.

## Безопасность

- Храните `.env` только на сервере (`chmod 600`)
- Не коммитьте токены и пароли панели
- Ограничьте `ADMIN_IDS` доверенными Telegram ID
- Регулярно делайте бэкап PostgreSQL

## Лицензия

Проприетарный проект для внутреннего использования.
