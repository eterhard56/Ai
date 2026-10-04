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
      (l, i) =>
        `${i + 1}. ${l.product.name} — ${l.qty} ${l.product.unit} × ${formatPrice(l.product.price)} = ${formatPrice(l.qty * l.product.price)}`,
    )
    .join('\n')

  const total = lines.reduce((s, l) => s + l.qty * l.product.price, 0)

  return [
    `🛒 ЗАКАЗ с сайта ${shop.name}`,
    `Админу: ${shop.contact}`,
    '',
    '——— СПИСОК ——–',
    items || '1. (корзина пуста)',
    '————————',
    `Итого ориентировочно: ${formatPrice(total)}`,
    '',
    `👤 ${meta.name || '—'}`,
    `📞 ${meta.phone || '—'}`,
    `📍 ${meta.address || '—'}`,
    `🕒 ${meta.when || '—'}`,
    meta.comment ? `💬 ${meta.comment}` : '',
    '',
    'Оплата: без предоплаты, при получении.',
  ]
    .filter((line) => line !== '')
    .join('\n')
}

/** Открывает Max с готовым текстом заказа для отправки админу */
export function openOrderInMax(text: string) {
  const share = `https://max.ru/:share?text=${encodeURIComponent(text)}`
  window.open(share, '_blank', 'noopener,noreferrer')
}

export function telUrl(phone: string) {
  return `tel:${phone}`
}
