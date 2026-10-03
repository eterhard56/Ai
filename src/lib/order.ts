import type { CartLine } from '../cart'
import { shop } from '../data/products'

export function formatPrice(n: number) {
  return new Intl.NumberFormat('ru-RU').format(n) + ' ₽'
}

export function buildOrderMessage(
  lines: CartLine[],
  meta: {
    name: string
    phone: string
    address: string
    comment: string
    when: string
  },
) {
  const items = lines
    .map(
      (l) =>
        `• ${l.product.name} — ${l.qty} ${l.product.unit} × ${l.product.price} ₽`,
    )
    .join('\n')

  const total = lines.reduce((s, l) => s + l.qty * l.product.price, 0)

  return [
    `Заказ с сайта ${shop.name}`,
    '',
    items || '• (корзина пуста — уточните состав)',
    '',
    `Итого ориентировочно: ${formatPrice(total)}`,
    '',
    `Имя: ${meta.name || '—'}`,
    `Телефон: ${meta.phone || '—'}`,
    `Адрес / район: ${meta.address || '—'}`,
    `Когда нужно: ${meta.when || '—'}`,
    meta.comment ? `Комментарий: ${meta.comment}` : '',
    '',
    'Оплата: без предоплаты, при получении.',
  ]
    .filter(Boolean)
    .join('\n')
}

export function maxShareUrl(text: string) {
  return `https://max.ru/:share?text=${encodeURIComponent(text)}`
}

export function telUrl(phone: string) {
  return `tel:${phone}`
}
