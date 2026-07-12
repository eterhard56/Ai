from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup, KeyboardButton, ReplyKeyboardMarkup


def main_menu(is_admin: bool = False) -> ReplyKeyboardMarkup:
    rows = [
        [KeyboardButton(text="📡 Моя подписка"), KeyboardButton(text="🛒 Купить VPN")],
        [KeyboardButton(text="📱 Мои устройства"), KeyboardButton(text="🎁 Пробный период")],
        [KeyboardButton(text="👥 Рефералы"), KeyboardButton(text="💬 Поддержка")],
    ]
    if is_admin:
        rows.append([KeyboardButton(text="🛠 Админ-панель")])
    return ReplyKeyboardMarkup(keyboard=rows, resize_keyboard=True)


def admin_menu() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text="👤 Пользователи"), KeyboardButton(text="🔍 Поиск")],
            [KeyboardButton(text="📊 Статистика"), KeyboardButton(text="💰 Тарифы")],
            [KeyboardButton(text="🖥 Серверы"), KeyboardButton(text="📢 Рассылка")],
            [KeyboardButton(text="◀️ В меню")],
        ],
        resize_keyboard=True,
    )


def tariffs_keyboard(tariffs: list) -> InlineKeyboardMarkup:
    buttons = [
        [InlineKeyboardButton(
            text=f"{t.name} — {float(t.price_rub):.0f} ₽",
            callback_data=f"tariff:{t.id}",
        )]
        for t in tariffs
    ]
    buttons.append([InlineKeyboardButton(text="❌ Отмена", callback_data="cancel")])
    return InlineKeyboardMarkup(inline_keyboard=buttons)


def confirm_payment_keyboard(payment_id: int) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="✅ Подтвердить оплату", callback_data=f"pay_confirm:{payment_id}")],
            [InlineKeyboardButton(text="❌ Отмена", callback_data="cancel")],
        ]
    )


def device_keyboard(device_id: int) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="🔗 Ссылка подписки", callback_data=f"device_sub:{device_id}")],
            [InlineKeyboardButton(text="🗑 Удалить", callback_data=f"device_del:{device_id}")],
        ]
    )


def admin_user_keyboard(user_id: int) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="➕ 30 дней", callback_data=f"adm_extend:{user_id}:30"),
                InlineKeyboardButton(text="➕ 90 дней", callback_data=f"adm_extend:{user_id}:90"),
            ],
            [
                InlineKeyboardButton(text="🚫 Блок", callback_data=f"adm_block:{user_id}"),
                InlineKeyboardButton(text="✅ Разблок", callback_data=f"adm_unblock:{user_id}"),
            ],
            [InlineKeyboardButton(text="🗑 Удалить VPN", callback_data=f"adm_delvpn:{user_id}")],
        ]
    )
