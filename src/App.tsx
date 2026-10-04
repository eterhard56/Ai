import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft,
  Minus,
  Pencil,
  Phone,
  Plus,
  ShoppingBag,
  Trash2,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { CartProvider, useCart } from './cart'
import { emptyProduct, useCatalog } from './catalog'
import {
  categories,
  imageOptions,
  shop,
  type CategoryId,
  type Product,
  type Unit,
} from './data/products'
import {
  buildOrderMessage,
  formatPrice,
  openOrderInMax,
  telUrl,
} from './lib/order'

const badgeLabel = {
  hit: 'Хит',
  sale: '−%',
  new: 'New',
} as const

type View = 'shop' | 'admin'

function useHashView(): [View, (v: View) => void] {
  const [view, setView] = useState<View>(() =>
    typeof window !== 'undefined' && window.location.hash === '#admin'
      ? 'admin'
      : 'shop',
  )

  useEffect(() => {
    const onHash = () =>
      setView(window.location.hash === '#admin' ? 'admin' : 'shop')
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const go = (v: View) => {
    window.location.hash = v === 'admin' ? 'admin' : ''
    setView(v)
  }

  return [view, go]
}

export default function App() {
  return (
    <CartProvider>
      <Root />
    </CartProvider>
  )
}

function Root() {
  const [view, setView] = useHashView()
  const catalog = useCatalog()

  if (view === 'admin') {
    return <AdminPage catalog={catalog} onBack={() => setView('shop')} />
  }

  return <ShopPage catalog={catalog} onAdmin={() => setView('admin')} />
}

function ShopPage({
  catalog,
  onAdmin,
}: {
  catalog: ReturnType<typeof useCatalog>
  onAdmin: () => void
}) {
  const { count, setOpen } = useCart()
  const [active, setActive] = useState<CategoryId | 'all'>('all')
  const [selected, setSelected] = useState<Product | null>(null)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const filtered = useMemo(() => {
    const list = catalog.visible
    return active === 'all' ? list : list.filter((p) => p.category === active)
  }, [active, catalog.visible])

  return (
    <div className="min-h-svh pb-24 md:pb-0">
      <header
        className={`sticky top-0 z-40 border-b transition ${
          scrolled
            ? 'border-forest/10 bg-white/95 shadow-sm backdrop-blur'
            : 'border-transparent bg-white'
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-3 py-2.5 sm:px-5">
          <a href="#top" className="flex min-w-0 items-center gap-2.5">
            <img
              src="/images/logo-mark.jpg"
              alt=""
              className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-forest/15"
            />
            <div className="min-w-0 leading-tight">
              <div className="truncate font-semibold text-forest">{shop.name}</div>
              <div className="text-[11px] text-smoke/55">
                Витрина · {shop.city}
              </div>
            </div>
          </a>

          <div className="flex items-center gap-2">
            <a
              href={telUrl(shop.phone)}
              className="hidden items-center gap-1.5 rounded-full bg-mist px-3 py-2 text-sm text-forest sm:inline-flex"
            >
              <Phone className="h-4 w-4" />
              {shop.phoneDisplay}
            </a>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="relative inline-flex items-center gap-2 rounded-full bg-forest px-3.5 py-2 text-sm font-semibold text-white"
            >
              <ShoppingBag className="h-4 w-4" />
              <span className="hidden sm:inline">Корзина</span>
              {count > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1 text-[11px] font-bold text-forest-deep">
                  {count}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <section id="top" className="border-b border-forest/8 bg-forest text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-3 py-6 sm:flex-row sm:items-end sm:justify-between sm:px-5 sm:py-8">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-gold-soft">
              {shop.tagline}
            </p>
            <h1 className="mt-1 font-display text-3xl sm:text-4xl">
              Каталог как на витрине
            </h1>
            <p className="mt-2 max-w-xl text-sm text-white/70">
              Выберите товары → оформите заказ → список уйдёт админу в Max.
              Без предоплаты, доставка по Оренбургу.
            </p>
          </div>
          <a
            href="#order"
            className="inline-flex items-center justify-center rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-forest-deep"
          >
            Оформить заказ
          </a>
        </div>
      </section>

      <section id="catalog" className="mx-auto max-w-7xl px-2 py-4 sm:px-5 sm:py-6">
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Chip active={active === 'all'} onClick={() => setActive('all')}>
            Все
          </Chip>
          {categories.map((c) => (
            <Chip
              key={c.id}
              active={active === c.id}
              onClick={() => setActive(c.id)}
            >
              {c.title}
            </Chip>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map((product) => (
            <ProductTile
              key={product.id}
              product={product}
              onOpen={() => setSelected(product)}
            />
          ))}
        </div>

        {filtered.length === 0 && (
          <p className="py-16 text-center text-smoke/50">
            В этой категории пока пусто
          </p>
        )}
      </section>

      <OrderBlock />
      <footer className="border-t border-forest/10 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-8 text-sm text-smoke/60 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <span className="font-semibold text-forest">{shop.name}</span>
            {' · '}
            {shop.city} · {shop.contact}
          </div>
          <button
            type="button"
            onClick={onAdmin}
            className="text-left text-smoke/40 underline-offset-2 hover:text-forest hover:underline"
          >
            Управление каталогом
          </button>
        </div>
      </footer>

      <CartDrawer />
      <ProductModal
        product={selected}
        onClose={() => setSelected(null)}
      />
      <MobileDock />
    </div>
  )
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm transition ${
        active
          ? 'bg-forest text-white'
          : 'bg-white text-forest ring-1 ring-forest/10 hover:ring-forest/25'
      }`}
    >
      {children}
    </button>
  )
}

/** Карточка в стиле маркетплейса: фото → цена → название → описание → в корзину */
function ProductTile({
  product,
  onOpen,
}: {
  product: Product
  onOpen: () => void
}) {
  const { add } = useCart()

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl bg-tile shadow-[0_1px_2px_rgba(0,0,0,0.06)] ring-1 ring-black/[0.04] transition hover:shadow-[0_8px_24px_rgba(22,53,40,0.12)]">
      <button type="button" onClick={onOpen} className="relative block text-left">
        <div className="relative aspect-square overflow-hidden bg-mist">
          <img
            src={product.image}
            alt={product.name}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
            loading="lazy"
          />
          {product.badge && (
            <span
              className={`absolute left-2 top-2 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white ${
                product.badge === 'sale'
                  ? 'bg-red-500'
                  : product.badge === 'new'
                    ? 'bg-sky-600'
                    : 'bg-forest'
              }`}
            >
              {badgeLabel[product.badge]}
            </span>
          )}
        </div>
        <div className="px-2.5 pt-2.5 sm:px-3">
          <div className="flex items-baseline gap-1.5">
            <span className="text-base font-bold text-forest sm:text-lg">
              {formatPrice(product.price)}
            </span>
            <span className="text-[11px] text-smoke/45">/ {product.unit}</span>
          </div>
          <h3 className="mt-1 line-clamp-2 min-h-[2.5rem] text-sm font-medium leading-snug text-smoke">
            {product.name}
          </h3>
          <p className="mt-1 line-clamp-2 min-h-[2.25rem] text-xs leading-snug text-smoke/50">
            {product.description}
          </p>
          {product.note && (
            <p className="mt-1 text-[11px] text-bark/80">{product.note}</p>
          )}
        </div>
      </button>
      <div className="mt-auto p-2.5 pt-2 sm:p-3">
        <button
          type="button"
          onClick={() => add(product)}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#0f9d58] px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0b8a4b] active:scale-[0.98]"
        >
          В корзину
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </article>
  )
}

function ProductModal({
  product,
  onClose,
}: {
  product: Product | null
  onClose: () => void
}) {
  const { add } = useCart()
  if (!product) return null

  return (
    <AnimatePresence>
      <motion.button
        type="button"
        aria-label="Закрыть"
        className="fixed inset-0 z-50 bg-black/45"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        role="dialog"
        className="fixed inset-x-3 bottom-3 z-50 mx-auto max-h-[85svh] max-w-lg overflow-y-auto rounded-3xl bg-white p-4 shadow-2xl sm:inset-y-auto sm:top-1/2 sm:bottom-auto sm:-translate-y-1/2 sm:p-5"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
      >
        <div className="flex justify-end">
          <button type="button" onClick={onClose} className="rounded-full p-1.5 hover:bg-mist">
            <X className="h-5 w-5" />
          </button>
        </div>
        <img
          src={product.image}
          alt={product.name}
          className="aspect-[4/3] w-full rounded-2xl object-cover"
        />
        <div className="mt-4 text-2xl font-bold text-forest">
          {formatPrice(product.price)}
          <span className="ml-2 text-sm font-normal text-smoke/45">
            / {product.unit}
          </span>
        </div>
        <h2 className="mt-2 text-xl font-semibold text-smoke">{product.name}</h2>
        <p className="mt-3 text-sm leading-relaxed text-smoke/70">
          {product.description}
        </p>
        {product.note && (
          <p className="mt-2 text-sm text-bark">{product.note}</p>
        )}
        <button
          type="button"
          onClick={() => {
            add(product)
            onClose()
          }}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#0f9d58] py-3.5 text-sm font-semibold text-white"
        >
          В корзину
          <Plus className="h-4 w-4" />
        </button>
      </motion.div>
    </AnimatePresence>
  )
}

function OrderBlock() {
  const { lines, total, clear } = useCart()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [when, setWhen] = useState('Сегодня / вечером')
  const [comment, setComment] = useState('')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (lines.length === 0) {
      alert('Добавьте товары из каталога')
      return
    }
    const message = buildOrderMessage(lines, {
      name,
      phone,
      address,
      comment,
      when,
    })
    openOrderInMax(message)
  }

  return (
    <section id="order" className="border-t border-forest/10 bg-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-3 py-10 sm:px-5 lg:grid-cols-2">
        <div>
          <h2 className="font-display text-3xl text-forest">Заказ админу в Max</h2>
          <p className="mt-2 text-sm text-smoke/65">
            Соберите корзину в каталоге. Мы сформируем список товаров и откроем
            Max — отправьте сообщение {shop.contact}у.
          </p>
          <div className="mt-5 rounded-2xl bg-mist/80 p-4">
            <div className="text-xs uppercase tracking-wider text-smoke/45">
              В корзине
            </div>
            <div className="mt-1 text-2xl font-bold text-forest">
              {lines.length ? formatPrice(total) : 'Пусто'}
            </div>
            {lines.length > 0 && (
              <ol className="mt-3 space-y-1.5 text-sm text-smoke/75">
                {lines.map((l, i) => (
                  <li key={l.product.id}>
                    {i + 1}. {l.product.name} — {l.qty} {l.product.unit}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        <form className="space-y-3" onSubmit={submit}>
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
            <span className="mb-1.5 block text-sm text-smoke/60">Когда нужно</span>
            <select
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              className="w-full rounded-xl border border-forest/10 bg-white px-3 py-2.5 outline-none focus:border-forest/30"
            >
              <option>Сегодня / вечером</option>
              <option>Завтра</option>
              <option>К выходным</option>
              <option>Напишу в комментарии</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm text-smoke/60">Комментарий</span>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder="Нарезка, под заказ..."
              className="w-full resize-none rounded-xl border border-forest/10 bg-white px-3 py-2.5 outline-none focus:border-forest/30"
            />
          </label>
          <div className="flex flex-col gap-2 pt-1 sm:flex-row">
            <button
              type="submit"
              className="flex-1 rounded-xl bg-forest py-3.5 text-sm font-semibold text-white hover:bg-moss"
            >
              Отправить список в Max
            </button>
            <a
              href={telUrl(shop.phone)}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-forest/15 py-3.5 text-sm font-semibold text-forest"
            >
              <Phone className="h-4 w-4" />
              Позвонить
            </a>
          </div>
          {lines.length > 0 && (
            <button
              type="button"
              onClick={clear}
              className="text-sm text-smoke/40 underline-offset-2 hover:underline"
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
      <span className="mb-1.5 block text-sm text-smoke/60">{label}</span>
      <input
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-forest/10 bg-white px-3 py-2.5 outline-none focus:border-forest/30"
      />
    </label>
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
            aria-label="Закрыть"
            className="fixed inset-0 z-50 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 340, damping: 36 }}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="text-lg font-semibold text-forest">Корзина</h2>
              <button type="button" onClick={() => setOpen(false)} className="p-2">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
              {lines.length === 0 && (
                <p className="text-smoke/50">Пока пусто — выберите товары в каталоге.</p>
              )}
              {lines.map((line) => (
                <div key={line.product.id} className="flex gap-3 border-b border-black/5 pb-3">
                  <img
                    src={line.product.image}
                    alt=""
                    className="h-16 w-16 rounded-xl object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{line.product.name}</div>
                    <div className="text-xs text-smoke/50">
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
                      <span className="w-5 text-center text-sm">{line.qty}</span>
                      <button
                        type="button"
                        className="rounded-full bg-mist p-1"
                        onClick={() => setQty(line.product.id, line.qty + 1)}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="ml-auto text-xs text-smoke/40"
                        onClick={() => remove(line.product.id)}
                      >
                        Убрать
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t px-4 py-4">
              <div className="mb-3 flex justify-between">
                <span className="text-sm text-smoke/50">Ориентир</span>
                <span className="text-xl font-bold text-forest">
                  {formatPrice(total)}
                </span>
              </div>
              <a
                href="#order"
                onClick={() => setOpen(false)}
                className="flex w-full items-center justify-center rounded-xl bg-forest py-3.5 text-sm font-semibold text-white"
              >
                К оформлению
              </a>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

function MobileDock() {
  const { count, setOpen } = useCart()
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-white/95 p-2.5 backdrop-blur md:hidden pb-[max(0.6rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto flex max-w-lg gap-2">
        <a
          href={telUrl(shop.phone)}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-forest/12 py-3 text-sm font-semibold text-forest"
        >
          <Phone className="h-4 w-4" />
          Звонок
        </a>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#0f9d58] py-3 text-sm font-semibold text-white"
        >
          <ShoppingBag className="h-4 w-4" />
          Корзина{count > 0 ? ` · ${count}` : ''}
        </button>
      </div>
    </div>
  )
}

function AdminPage({
  catalog,
  onBack,
}: {
  catalog: ReturnType<typeof useCatalog>
  onBack: () => void
}) {
  const [authed, setAuthed] = useState(
    () => sessionStorage.getItem('razkolbas.admin') === '1',
  )
  const [password, setPassword] = useState('')
  const [editing, setEditing] = useState<Product | null>(null)

  if (!authed) {
    return (
      <div className="mx-auto flex min-h-svh max-w-md flex-col justify-center px-4">
        <button
          type="button"
          onClick={onBack}
          className="mb-6 inline-flex items-center gap-2 text-sm text-smoke/60"
        >
          <ArrowLeft className="h-4 w-4" /> На сайт
        </button>
        <h1 className="font-display text-3xl text-forest">Каталог</h1>
        <p className="mt-2 text-sm text-smoke/60">
          Вход для добавления и редактирования товаров
        </p>
        <form
          className="mt-6 space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (password === shop.adminPassword) {
              sessionStorage.setItem('razkolbas.admin', '1')
              setAuthed(true)
            } else {
              alert('Неверный пароль')
            }
          }}
        >
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Пароль"
            className="w-full rounded-xl border border-forest/15 px-3 py-3"
          />
          <button
            type="submit"
            className="w-full rounded-xl bg-forest py-3 font-semibold text-white"
          >
            Войти
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="mx-auto min-h-svh max-w-3xl px-3 py-6 sm:px-5">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="mb-2 inline-flex items-center gap-2 text-sm text-smoke/60"
          >
            <ArrowLeft className="h-4 w-4" /> На витрину
          </button>
          <h1 className="font-display text-3xl text-forest">Товары</h1>
          <p className="text-sm text-smoke/55">
            {catalog.products.length} позиций · сохраняется в этом браузере
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setEditing(emptyProduct())}
            className="rounded-xl bg-[#0f9d58] px-4 py-2.5 text-sm font-semibold text-white"
          >
            + Добавить
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm('Сбросить каталог к базовому?')) catalog.reset()
            }}
            className="rounded-xl border border-forest/15 px-3 py-2.5 text-sm"
          >
            Сброс
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {catalog.products.map((p) => (
          <div
            key={p.id}
            className="flex items-center gap-3 rounded-2xl bg-white p-2.5 ring-1 ring-black/5"
          >
            <img src={p.image} alt="" className="h-14 w-14 rounded-xl object-cover" />
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">
                {p.name}
                {!p.available && (
                  <span className="ml-2 text-xs text-red-500">скрыт</span>
                )}
              </div>
              <div className="text-sm text-smoke/55">
                {formatPrice(p.price)} / {p.unit}
              </div>
            </div>
            <button
              type="button"
              className="rounded-full p-2 hover:bg-mist"
              onClick={() => setEditing(p)}
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="rounded-full p-2 text-red-500 hover:bg-red-50"
              onClick={() => {
                if (confirm(`Удалить «${p.name}»?`)) catalog.remove(p.id)
              }}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {editing && (
        <ProductEditor
          product={editing}
          onClose={() => setEditing(null)}
          onSave={(p) => {
            catalog.upsert(p)
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}

function ProductEditor({
  product,
  onClose,
  onSave,
}: {
  product: Product
  onClose: () => void
  onSave: (p: Product) => void
}) {
  const [draft, setDraft] = useState(product)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center">
      <form
        className="max-h-[90svh] w-full max-w-lg space-y-3 overflow-y-auto rounded-3xl bg-white p-4 shadow-2xl sm:p-5"
        onSubmit={(e) => {
          e.preventDefault()
          if (!draft.name.trim() || !draft.price) {
            alert('Укажите название и цену')
            return
          }
          onSave({
            ...draft,
            name: draft.name.trim(),
            description: draft.description.trim(),
          })
        }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {product.name ? 'Редактировать' : 'Новый товар'}
          </h2>
          <button type="button" onClick={onClose} className="p-1">
            <X className="h-5 w-5" />
          </button>
        </div>

        <label className="block text-sm">
          Название
          <input
            required
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            className="mt-1 w-full rounded-xl border px-3 py-2.5"
          />
        </label>

        <label className="block text-sm">
          Описание
          <textarea
            required
            rows={3}
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            className="mt-1 w-full resize-none rounded-xl border px-3 py-2.5"
            placeholder="Коротко: вкус, для чего, упаковка..."
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            Цена, ₽
            <input
              required
              type="number"
              min={1}
              value={draft.price || ''}
              onChange={(e) =>
                setDraft({ ...draft, price: Number(e.target.value) })
              }
              className="mt-1 w-full rounded-xl border px-3 py-2.5"
            />
          </label>
          <label className="block text-sm">
            Ед.
            <select
              value={draft.unit}
              onChange={(e) =>
                setDraft({ ...draft, unit: e.target.value as Unit })
              }
              className="mt-1 w-full rounded-xl border px-3 py-2.5"
            >
              <option value="кг">кг</option>
              <option value="шт">шт</option>
            </select>
          </label>
        </div>

        <label className="block text-sm">
          Категория
          <select
            value={draft.category}
            onChange={(e) =>
              setDraft({ ...draft, category: e.target.value as CategoryId })
            }
            className="mt-1 w-full rounded-xl border px-3 py-2.5"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          Фото витрины
          <select
            value={draft.image}
            onChange={(e) => setDraft({ ...draft, image: e.target.value })}
            className="mt-1 w-full rounded-xl border px-3 py-2.5"
          >
            {imageOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          Бейдж
          <select
            value={draft.badge || ''}
            onChange={(e) =>
              setDraft({
                ...draft,
                badge: (e.target.value || undefined) as Product['badge'],
              })
            }
            className="mt-1 w-full rounded-xl border px-3 py-2.5"
          >
            <option value="">Нет</option>
            <option value="hit">Хит</option>
            <option value="sale">Акция</option>
            <option value="new">New</option>
          </select>
        </label>

        <label className="block text-sm">
          Примечание (вес упаковки и т.п.)
          <input
            value={draft.note || ''}
            onChange={(e) => setDraft({ ...draft, note: e.target.value })}
            className="mt-1 w-full rounded-xl border px-3 py-2.5"
          />
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={draft.available}
            onChange={(e) =>
              setDraft({ ...draft, available: e.target.checked })
            }
          />
          Показывать на витрине
        </label>

        <button
          type="submit"
          className="w-full rounded-xl bg-forest py-3.5 font-semibold text-white"
        >
          Сохранить
        </button>
      </form>
    </div>
  )
}
