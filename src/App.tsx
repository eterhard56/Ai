import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  ArrowUpRight,
  Minus,
  Phone,
  Plus,
  ShoppingBag,
  Truck,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { CartProvider, useCart } from './cart'
import {
  categories,
  products,
  shop,
  type CategoryId,
  type Product,
} from './data/products'
import { buildOrderMessage, formatPrice, maxShareUrl, telUrl } from './lib/order'

const badgeLabel = {
  hit: 'Хит',
  sale: 'Акция',
  new: 'Новинка',
} as const

function AppShell() {
  const reduce = useReducedMotion()
  const { count, setOpen } = useCart()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-40 transition-all duration-500 ${
          scrolled
            ? 'bg-forest-deep/90 backdrop-blur-md shadow-[0_10px_40px_-20px_rgba(12,31,24,0.7)]'
            : 'bg-transparent'
        }`}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <a href="#top" className="flex items-center gap-3 text-paper">
            <img
              src="/images/logo-mark.jpg"
              alt=""
              className="h-11 w-11 rounded-full object-cover ring-1 ring-gold/50"
            />
            <div className="leading-tight">
              <div className="font-display text-lg tracking-tight text-paper sm:text-xl">
                {shop.name}
              </div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-gold-soft/80">
                {shop.city}
              </div>
            </div>
          </a>

          <nav className="hidden items-center gap-7 text-sm text-paper/85 md:flex">
            <a href="#catalog" className="hover:text-gold-soft transition">
              Каталог
            </a>
            <a href="#order" className="hover:text-gold-soft transition">
              Заказ
            </a>
            <a href="#delivery" className="hover:text-gold-soft transition">
              Доставка
            </a>
            <a href="#contacts" className="hover:text-gold-soft transition">
              Контакты
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <a
              href={telUrl(shop.phone)}
              className="hidden items-center gap-2 rounded-full border border-gold/30 px-3 py-2 text-sm text-paper transition hover:border-gold hover:bg-gold/10 sm:inline-flex"
            >
              <Phone className="h-4 w-4 text-gold" />
              {shop.phoneDisplay}
            </a>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="relative inline-flex items-center gap-2 rounded-full bg-gold px-3.5 py-2 text-sm font-semibold text-forest-deep transition hover:bg-gold-soft"
            >
              <ShoppingBag className="h-4 w-4" />
              <span className="hidden sm:inline">Корзина</span>
              {count > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-forest px-1 text-[11px] text-paper">
                  {count}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <main id="top" className="pb-24 md:pb-0">
        <Hero reduce={!!reduce} />
        <TrustStrip />
        <Catalog />
        <CustomOrder />
        <Delivery />
        <OrderForm />
        <Contacts />
      </main>

      <Footer />
      <CartDrawer />
      <MobileDock />
    </>
  )
}

function Hero({ reduce }: { reduce: boolean }) {
  return (
    <section className="relative min-h-[100svh] overflow-hidden bg-forest-deep text-paper">
      <div className="absolute inset-0">
        <img
          src="/images/case-1.jpg"
          alt="Витрина фермерских продуктов РАЗ!Колбас"
          className="h-full w-full object-cover object-center scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-forest-deep via-forest-deep/85 to-forest-deep/35" />
        <div className="absolute inset-0 bg-gradient-to-t from-forest-deep via-transparent to-forest-deep/50" />
        <div className="absolute inset-0 grain opacity-[0.12] mix-blend-soft-light" />
      </div>

      <div className="relative mx-auto flex min-h-[100svh] max-w-6xl flex-col justify-end px-4 pb-24 pt-28 sm:px-6 sm:pb-28">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-2xl"
        >
          <div className="mb-5 inline-flex items-center gap-3">
            <img
              src="/images/logo-mark.jpg"
              alt="РАЗ!Колбас"
              className="h-16 w-16 rounded-full object-cover ring-2 ring-gold/60 shadow-xl sm:h-20 sm:w-20"
            />
            <p className="text-sm uppercase tracking-[0.22em] text-gold-soft">
              {shop.tagline}
            </p>
          </div>

          <h1 className="font-display text-[clamp(2.6rem,8vw,5.4rem)] leading-[0.95] tracking-tight text-balance">
            {shop.name}
          </h1>
          <p className="mt-5 max-w-lg text-base text-paper/80 sm:text-lg">
            Колбасы, деликатесы и полуфабрикаты в Оренбурге. Выбираете на сайте —
            заказ уходит в Max или по телефону. Без предоплаты.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#catalog"
              className="inline-flex items-center gap-2 rounded-full bg-gold px-6 py-3.5 text-sm font-semibold text-forest-deep transition hover:bg-gold-soft"
            >
              Смотреть каталог
              <ArrowUpRight className="h-4 w-4" />
            </a>
            <a
              href="#order"
              className="inline-flex items-center gap-2 rounded-full border border-paper/25 px-6 py-3.5 text-sm font-medium text-paper transition hover:border-gold hover:text-gold-soft"
            >
              Оформить заказ
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

function TrustStrip() {
  const items = [
    { title: 'Без предоплаты', text: 'Платите при получении' },
    { title: 'Доставка', text: 'По Оренбургу' },
    { title: 'Под заказ', text: 'Пельмени, нарезка, заливное' },
    { title: 'Свой чат', text: 'Заказ в Max за минуту' },
  ]
  return (
    <section className="border-y border-forest/10 bg-paper/70">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px bg-forest/10 md:grid-cols-4">
        {items.map((item) => (
          <div key={item.title} className="bg-paper px-5 py-6 sm:px-6">
            <div className="text-xs uppercase tracking-[0.16em] text-bark">
              {item.title}
            </div>
            <div className="mt-2 font-display text-xl text-forest">{item.text}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

function Catalog() {
  const [active, setActive] = useState<CategoryId | 'all'>('all')
  const { add } = useCart()

  const filtered = useMemo(
    () =>
      active === 'all'
        ? products
        : products.filter((p) => p.category === active),
    [active],
  )

  return (
    <section id="catalog" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
      <div className="mb-10 max-w-2xl">
        <p className="text-xs uppercase tracking-[0.2em] text-bark">Каталог</p>
        <h2 className="mt-3 font-display text-4xl text-forest sm:text-5xl">
          Выбирайте как на витрине
        </h2>
        <p className="mt-4 text-smoke/75">
          Цены как в магазине. Добавьте в корзину — отправим готовый текст заказа
          в Max.
        </p>
      </div>

      <div className="mb-8 flex gap-2 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <FilterChip
          active={active === 'all'}
          onClick={() => setActive('all')}
          label="Все"
        />
        {categories.map((c) => (
          <FilterChip
            key={c.id}
            active={active === c.id}
            onClick={() => setActive(c.id)}
            label={c.title}
          />
        ))}
      </div>

      <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((product, i) => (
          <ProductRow
            key={product.id}
            product={product}
            index={i}
            onAdd={() => add(product)}
          />
        ))}
      </div>
    </section>
  )
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-4 py-2 text-sm transition ${
        active
          ? 'bg-forest text-paper'
          : 'bg-white/60 text-forest ring-1 ring-forest/10 hover:bg-white'
      }`}
    >
      {label}
    </button>
  )
}

function ProductRow({
  product,
  index,
  onAdd,
}: {
  product: Product
  index: number
  onAdd: () => void
}) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ delay: Math.min(index * 0.04, 0.24), duration: 0.45 }}
      className="group"
    >
      <div className="relative overflow-hidden rounded-[1.4rem]">
        <img
          src={product.image}
          alt={product.name}
          className="aspect-[4/3] w-full object-cover transition duration-700 group-hover:scale-[1.04]"
          loading="lazy"
        />
        {product.badge && (
          <span className="absolute left-3 top-3 rounded-full bg-forest/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-gold-soft">
            {badgeLabel[product.badge]}
          </span>
        )}
      </div>
      <div className="mt-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-xl leading-snug text-forest">
            {product.name}
          </h3>
          <p className="mt-1 text-sm text-smoke/60">
            {product.note ? `${product.note} · ` : ''}
            за {product.unit}
          </p>
        </div>
        <div className="text-right">
          <div className="text-lg font-semibold text-bark">
            {formatPrice(product.price)}
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-forest px-4 py-3 text-sm font-semibold text-paper transition hover:bg-moss"
      >
        В корзину
        <Plus className="h-4 w-4" />
      </button>
    </motion.article>
  )
}

function CustomOrder() {
  return (
    <section className="relative overflow-hidden bg-forest-deep text-paper">
      <div className="absolute inset-0">
        <img
          src="/images/case-4.jpg"
          alt=""
          className="h-full w-full object-cover opacity-35"
        />
        <div className="absolute inset-0 bg-forest-deep/80" />
      </div>
      <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-gold-soft">
            Под заказ
          </p>
          <h2 className="mt-3 font-display text-4xl sm:text-5xl">
            Пельмени ручной лепки, нарезка и заливное — скажите, что нужно
          </h2>
          <p className="mt-5 max-w-xl text-paper/75">
            Не всё лежит на витрине каждый день. Напишите в Max или оставьте
            заявку на сайте — соберём заказ к нужному времени.
          </p>
        </div>
        <ul className="space-y-4 text-paper/90">
          {[
            'Нарезка к столу',
            'Пельмени и полуфабрикаты',
            'Заливное и холодец',
            'Подбор набора на праздник',
          ].map((item) => (
            <li
              key={item}
              className="flex items-center gap-3 border-b border-paper/10 pb-4"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-gold" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function Delivery() {
  return (
    <section id="delivery" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
      <div className="grid gap-10 lg:grid-cols-2 lg:items-end">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-bark">Доставка</p>
          <h2 className="mt-3 font-display text-4xl text-forest sm:text-5xl">
            По Оренбургу — без предоплаты
          </h2>
          <p className="mt-4 max-w-xl text-smoke/75">
            Оформляете заказ на сайте или в Max. Андрей подтверждает время и
            привозит. Оплата при получении.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            {
              icon: Truck,
              title: 'Город',
              text: 'Доставка по Оренбургу. Район укажите в заказе.',
            },
            {
              icon: Phone,
              title: 'Связь',
              text: 'Max и телефон — ответим и уточним детали.',
            },
          ].map(({ icon: Icon, title, text }) => (
            <div
              key={title}
              className="rounded-[1.4rem] bg-white/70 p-6 ring-1 ring-forest/8"
            >
              <Icon className="h-5 w-5 text-gold" />
              <h3 className="mt-4 font-display text-2xl text-forest">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-smoke/70">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function OrderForm() {
  const { lines, total, clear } = useCart()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [when, setWhen] = useState('Сегодня / вечером')
  const [comment, setComment] = useState('')

  const message = buildOrderMessage(lines, { name, phone, address, comment, when })

  const submitMax = () => {
    window.open(maxShareUrl(message), '_blank', 'noopener,noreferrer')
  }

  return (
    <section id="order" className="bg-forest text-paper">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-[0.95fr_1.05fr]">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-gold-soft">
            Оформление
          </p>
          <h2 className="mt-3 font-display text-4xl sm:text-5xl">
            Корзина → заказ в Max
          </h2>
          <p className="mt-4 text-paper/75">
            Соберите товары выше, заполните контакты — откроется Max с готовым
            текстом заказа. Или просто позвоните.
          </p>
          <div className="mt-8 rounded-[1.4rem] bg-forest-deep/50 p-5 ring-1 ring-gold/20">
            <div className="text-sm text-paper/60">В корзине</div>
            <div className="mt-2 font-display text-3xl">
              {lines.length ? formatPrice(total) : 'Пока пусто'}
            </div>
            <p className="mt-2 text-sm text-paper/55">
              Итого ориентировочно. Точный вес уточним при сборке.
            </p>
          </div>
        </div>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            submitMax()
          }}
        >
          <Field label="Имя" value={name} onChange={setName} required />
          <Field
            label="Телефон"
            value={phone}
            onChange={setPhone}
            type="tel"
            placeholder="+7..."
            required
          />
          <Field
            label="Адрес / район"
            value={address}
            onChange={setAddress}
            placeholder="Улица, дом или район"
            required
          />
          <label className="block">
            <span className="mb-2 block text-sm text-paper/70">Когда нужно</span>
            <select
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              className="w-full rounded-2xl border border-paper/15 bg-forest-deep/40 px-4 py-3 text-paper outline-none focus:border-gold"
            >
              <option>Сегодня / вечером</option>
              <option>Завтра</option>
              <option>К выходным</option>
              <option>Напишу в комментарии</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-sm text-paper/70">Комментарий</span>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder="Нарезка, под заказ, пожелания..."
              className="w-full resize-none rounded-2xl border border-paper/15 bg-forest-deep/40 px-4 py-3 text-paper outline-none placeholder:text-paper/35 focus:border-gold"
            />
          </label>

          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <button
              type="submit"
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-gold px-5 py-3.5 text-sm font-semibold text-forest-deep transition hover:bg-gold-soft"
            >
              Отправить в Max
              <ArrowUpRight className="h-4 w-4" />
            </button>
            <a
              href={telUrl(shop.phone)}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-paper/20 px-5 py-3.5 text-sm font-semibold text-paper transition hover:border-gold"
            >
              <Phone className="h-4 w-4" />
              Позвонить
            </a>
          </div>
          {lines.length > 0 && (
            <button
              type="button"
              onClick={clear}
              className="text-sm text-paper/45 underline-offset-2 hover:text-paper/80 hover:underline"
            >
              Очистить корзину
            </button>
          )}
        </form>
      </div>
    </section>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  required,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  required?: boolean
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-paper/70">{label}</span>
      <input
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-paper/15 bg-forest-deep/40 px-4 py-3 text-paper outline-none placeholder:text-paper/35 focus:border-gold"
      />
    </label>
  )
}

function Contacts() {
  return (
    <section id="contacts" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
      <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:items-center">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-bark">Контакты</p>
          <h2 className="mt-3 font-display text-4xl text-forest sm:text-5xl">
            Андрей · {shop.shortName}
          </h2>
          <p className="mt-4 text-smoke/75">
            Фермерские продукты. Чат в Max и телефон — всегда на связи.
          </p>
          <div className="mt-8 space-y-3">
            <a
              href={telUrl(shop.phone)}
              className="flex items-center gap-3 font-display text-2xl text-forest hover:text-bark"
            >
              <Phone className="h-5 w-5 text-gold" />
              {shop.phoneDisplay}
            </a>
            <p className="text-sm text-smoke/60">
              Max: откройте заказ на сайте — текст уйдёт готовым сообщением.
              Прямую ссылку на чат можно подставить в настройках сайта.
            </p>
          </div>
        </div>
        <div className="overflow-hidden rounded-[1.8rem]">
          <img
            src="/images/case-2.jpg"
            alt="Ассортимент сыров и молочной продукции"
            className="aspect-[16/11] w-full object-cover"
          />
        </div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="border-t border-forest/10 bg-forest-deep text-paper/70">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 sm:flex-row sm:items-end sm:justify-between sm:px-6">
        <div>
          <div className="font-display text-2xl text-paper">{shop.name}</div>
          <div className="mt-1 text-sm">{shop.tagline} · {shop.city}</div>
        </div>
        <div className="text-sm">
          Сайт для заказов · без предоплаты · доставка по городу
        </div>
      </div>
    </footer>
  )
}

function CartDrawer() {
  const { open, setOpen, lines, total, setQty, remove } = useCart()

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label="Закрыть корзину"
            className="fixed inset-0 z-50 bg-forest-deep/50 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-paper shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-forest/10 px-5 py-4">
              <h2 className="font-display text-2xl text-forest">Корзина</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full p-2 text-forest hover:bg-mist"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              {lines.length === 0 && (
                <p className="text-smoke/60">Пока пусто — загляните в каталог.</p>
              )}
              {lines.map((line) => (
                <div
                  key={line.product.id}
                  className="flex gap-3 border-b border-forest/8 pb-4"
                >
                  <img
                    src={line.product.image}
                    alt=""
                    className="h-16 w-16 rounded-xl object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-forest">
                      {line.product.name}
                    </div>
                    <div className="text-sm text-smoke/60">
                      {formatPrice(line.product.price)} / {line.product.unit}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        className="rounded-full bg-mist p-1"
                        onClick={() => setQty(line.product.id, line.qty - 1)}
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="w-6 text-center text-sm">{line.qty}</span>
                      <button
                        type="button"
                        className="rounded-full bg-mist p-1"
                        onClick={() => setQty(line.product.id, line.qty + 1)}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="ml-auto text-xs text-smoke/45 hover:text-bark"
                        onClick={() => remove(line.product.id)}
                      >
                        Убрать
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-forest/10 px-5 py-4">
              <div className="mb-3 flex items-end justify-between">
                <span className="text-sm text-smoke/60">Ориентир</span>
                <span className="font-display text-2xl text-forest">
                  {formatPrice(total)}
                </span>
              </div>
              <a
                href="#order"
                onClick={() => setOpen(false)}
                className="flex w-full items-center justify-center rounded-full bg-forest px-4 py-3.5 text-sm font-semibold text-paper hover:bg-moss"
              >
                Оформить заказ
              </a>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

function MobileDock() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-forest/10 bg-paper/95 p-3 backdrop-blur md:hidden pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto flex max-w-lg gap-2">
        <a
          href={telUrl(shop.phone)}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-forest/15 px-3 py-3 text-sm font-semibold text-forest"
        >
          <Phone className="h-4 w-4" />
          Позвонить
        </a>
        <a
          href="#order"
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-gold px-3 py-3 text-sm font-semibold text-forest-deep"
        >
          Заказать
        </a>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <CartProvider>
      <AppShell />
    </CartProvider>
  )
}
