# AI Platform

Автономная платформа локальных AI-агентов для бизнеса. Все LLM-запросы выполняются **локально через Ollama** — без OpenAI, Claude или Gemini API.

## Возможности

- **FastAPI Backend** — REST API, Swagger, JWT-авторизация, роли пользователей
- **Admin Panel** — современный Web UI (Next.js, Tailwind, shadcn/ui, тёмная тема)
- **AI Chat** — чат с локальной моделью Ollama, история в PostgreSQL
- **6 автономных агентов** — каждый как отдельный Docker-сервис
- **Plugin System** — подключение новых агентов как плагинов
- **Docker Compose** — запуск одной командой
- **Автобэкап PostgreSQL** — ежедневно в 03:00
- **Автозапуск** — systemd после перезагрузки VPS

## Архитектура

```
┌─────────────────────────────────────────────────────────────┐
│                         Nginx (:80)                         │
├──────────────────────┬──────────────────────────────────────┤
│   Frontend (:3000)   │         Backend API (:8000)            │
│   Next.js Admin UI   │   FastAPI + JWT + Swagger              │
├──────────────────────┴──────────────────────────────────────┤
│  PostgreSQL │ Redis │ Celery Worker │ Celery Beat │ Ollama   │
├─────────────┬──────────┬────────────┬──────────┬─────────────┤
│ Direct Agent│SEO Agent │ Analytics  │ CRM Agent│Parser Agent │
│   (:8001)   │ (:8002)  │  (:8003)   │ (:8004)  │  (:8005)    │
├─────────────┴──────────┴────────────┴──────────┴─────────────┤
│                    Telegram Agent (:8006)                      │
└─────────────────────────────────────────────────────────────┘
```

## Структура проекта

```
/opt/ai-platform/
├── backend/              # FastAPI сервер
│   ├── app/
│   │   ├── api/          # REST endpoints
│   │   ├── core/         # Security, logging
│   │   ├── models/       # SQLAlchemy models
│   │   ├── services/     # Ollama, plugin loader
│   │   └── main.py
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/             # Next.js Admin Panel
│   ├── src/app/          # Pages (Dashboard, Chat, CRM...)
│   ├── src/components/   # UI components
│   └── Dockerfile
├── agents/               # AI Agents (отдельные сервисы)
│   ├── shared/           # Общие утилиты
│   ├── direct/           # Yandex Direct Agent
│   ├── seo/              # SEO Agent
│   ├── analytics/        # Analytics Agent
│   ├── crm/              # CRM Agent
│   ├── parser/           # Parser 2GIS Agent
│   └── telegram/         # Telegram Bot Agent
├── database/             # SQL init scripts
├── docker/               # Nginx, backup configs
├── config/               # Конфигурация и плагины
│   └── plugins/          # Plugin agents
├── scripts/              # Install, backup, healthcheck
├── logs/                 # Логи (ротация)
├── storage/              # Файловое хранилище
├── backups/              # PostgreSQL бэкапы
├── docker-compose.yml
├── .env.example
└── README.md
```

## Быстрый старт (VPS)

### Требования

- Ubuntu Server 22.04+
- 8+ GB RAM (для qwen3:8b)
- 50+ GB диск
- Docker & Docker Compose

### Установка

```bash
# Клонировать репозиторий
git clone <repo-url> /opt/ai-platform
cd /opt/ai-platform

# Автоматическая установка
sudo bash scripts/install.sh
```

Скрипт установки:
1. Устанавливает Docker и Docker Compose
2. Устанавливает Ollama как systemd-сервис
3. Скачивает модель `qwen3:8b`
4. Генерирует `.env` с секретами
5. Создаёт systemd-сервис `ai-platform`
6. Запускает все контейнеры

### Ручной запуск

```bash
cp .env.example .env
# Отредактируйте .env

docker compose up -d
```

### Доступ

| Сервис | URL |
|--------|-----|
| Web UI | http://your-vps-ip |
| API Docs | http://your-vps-ip/docs |
| Логин | `admin` / `admin123` |

## AI Агенты

### Direct Agent (:8001)
- Подключение к API Яндекс Директ
- Получение кампаний, групп, ключевых слов, объявлений
- Анализ CTR, CPC, CPA, расходов
- Поиск дорогих объявлений, слива бюджета, плохого CTR
- Генерация рекомендаций через Ollama
- **Все изменения только после подтверждения пользователя**

### SEO Agent (:8002)
- Проверка SSL, robots.txt, sitemap.xml
- Анализ title, description, H1, alt, schema.org
- Проверка скорости и HTTP-статусов
- AI-рекомендации по улучшению

### Analytics Agent (:8003)
- Ежедневные отчёты (08:00 MSK)
- Метрики: расход, CTR, лиды, CPA
- Выявление проблем и прогноз

### CRM Agent (:8004)
- Клиенты, заметки, статусы, задачи
- Напоминания через Telegram
- История взаимодействий

### Parser Agent (:8005)
- Интеграция с parser-2gis
- Анализ компаний: нет сайта, HTTPS, WhatsApp, Telegram
- Lead Score и сохранение в PostgreSQL

### Telegram Agent (:8006)
- Команды: `/report`, `/direct`, `/parser`, `/seo`, `/status`, `/leads`, `/help`
- Ежедневный отчёт в 09:00 MSK

## Настройка

### Переменные окружения (.env)

```env
# Ollama
OLLAMA_HOST=http://ollama:11434
OLLAMA_MODEL=qwen3:8b

# Yandex Direct
YANDEX_DIRECT_TOKEN=your_token
YANDEX_DIRECT_CLIENT_LOGIN=your_login

# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_ADMIN_CHAT_ID=your_chat_id

# Parser 2GIS
PARSER_2GIS_URL=http://your-parser:8080
PARSER_2GIS_API_KEY=your_key
```

### Подключение parser-2gis

Укажите URL вашего существующего parser-2gis в `.env`:

```env
PARSER_2GIS_URL=http://host.docker.internal:8080
```

Parser Agent ожидает endpoint `POST /api/parse` с телом:
```json
{"query": "стоматология", "city": "moscow", "limit": 50}
```

### Подключение плагинов

1. Создайте файл в `config/plugins/my_agent.py`:

```python
class Agent:
    name = "My Agent"
    slug = "my-agent"
    version = "1.0.0"

    async def run(self, config=None):
        return {"status": "ok"}

    async def health_check(self):
        return True
```

2. Зарегистрируйте через API:

```bash
curl -X POST http://localhost:8000/api/v1/agents/plugins \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "My Agent", "slug": "my-agent", "plugin_path": "my_agent.py"}'
```

## Управление

```bash
# Статус
docker compose ps
systemctl status ai-platform

# Логи
docker compose logs -f backend
docker compose logs -f agent-direct

# Перезапуск
docker compose restart

# Обновление
git pull
docker compose up -d --build

# Health check
bash scripts/healthcheck.sh

# Ручной бэкап
bash scripts/backup.sh
```

## Резервное копирование

- Автоматический бэкап PostgreSQL ежедневно в 03:00
- Файлы: `backups/ai_platform_YYYYMMDD_HHMMSS.sql.gz`
- Хранение: 30 дней (настраивается через `BACKUP_RETENTION_DAYS`)

## Автозапуск

После установки создаётся systemd-сервис:

```bash
systemctl enable ai-platform   # автозапуск
systemctl start ai-platform    # запуск
systemctl stop ai-platform     # остановка
```

Ollama также работает как systemd-сервис на хосте.

## Безопасность

- Смените пароль admin после первого входа
- Сгенерируйте уникальные `SECRET_KEY` и `JWT_SECRET_KEY`
- Настройте HTTPS через Nginx + Let's Encrypt
- Ограничьте доступ через UFW (порты 22, 80, 443)

## Технологии

| Компонент | Технология |
|-----------|-----------|
| Backend | Python 3.12, FastAPI, SQLAlchemy |
| Frontend | Next.js 14, Tailwind CSS, shadcn/ui |
| Database | PostgreSQL 16 |
| Cache/Queue | Redis 7, Celery |
| LLM | Ollama + qwen3:8b |
| Proxy | Nginx |
| Containers | Docker, Docker Compose |

## Лицензия

MIT
