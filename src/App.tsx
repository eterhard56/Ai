import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft,
  Check,
  Minus,
  Pencil,
  Phone,
  Plus,
  Search,
  ShoppingBag,
  Star,
  Trash2,
  X,
} from 'lucide-react'
import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from 'react'
import { CartProvider, useCart } from './cart'
import { emptyProduct, useCatalog } from './catalog'
import {
  categories,
  imageOptions,
  shop,
  stockLabel,
  type CategoryId,
  type Product,
  type Stock,
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
  const [pitchOpen, setPitchOpen] = useState(() => {
    try {
      return sessionStorage.getItem('razkolbas.pitch') !== '0'
    } catch {
      return true
    }
  })

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

  const dismissPitch = () => {
    setPitchOpen(false)
    try {
      sessionStorage.setItem('razkolbas.pitch', '0')
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="min-h-svh pb-24 md:pb-0">
      {pitchOpen && (
        <div className="border-b border-gold/30 bg-forest text-white">
          <div className="mx-auto flex max-w-7xl items-start gap-3 px-3 py-2.5 sm:items-center sm:px-5">
            <div className="min-w-0 flex-1 text-[12px] leading-snug sm:text-sm">
              <span className="font-semibold text-gold-soft">Показ Андрею · 1 мин:</span>{' '}
              каталог → 2 товара в корзину → Max → админка «цена / Нет»
              <span className="hidden sm:inline">
                {' '}
                · пароль <code className="text-gold-soft">razkolbas</code>
              </span>
            </div>
            <button
              type="button"
              onClick={onAdmin}
              className="shrink-0 rounded-lg bg-gold px-2.5 py-1.5 text-[11px] font-bold text-forest-deep sm:text-xs"
            >
              Админка
            </button>
            <button
              type="button"
              aria-label="Скрыть подсказку"
              onClick={dismissPitch}
              className="shrink-0 rounded-lg p-1 text-white/60 hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <header
        className={`sticky top-0 z-40 border-b transition ${
          scrolled
            ? 'border-forest/10 bg-white/95 shadow-sm backdrop-blur'
            : 'border-transparent bg-white/90 backdrop-blur-sm'
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
              <div className="truncate text-base font-bold tracking-tight text-forest sm:text-lg">
                {shop.name}
              </div>
              <div className="text-[11px] text-smoke/55">
                {shop.tagline} · {shop.city}
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
              className="relative inline-flex items-center gap-2 rounded-full bg-forest px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-moss"
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

      <section
        id="top"
        className="hero-wash relative overflow-hidden text-white"
        style={
          {
            '--hero-image': "url('/images/case-4.jpg')",
          } as CSSProperties
        }
      >
        <div className="mx-auto flex min-h-[42svh] max-w-7xl flex-col justify-end px-4 py-10 sm:min-h-[48svh] sm:px-5 sm:py-14 md:min-h-[52svh]">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="text-sm font-medium tracking-[0.18em] text-gold-soft uppercase"
          >
            {shop.city} · без предоплаты
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.05 }}
            className="mt-2 max-w-xl font-display text-4xl leading-[1.05] font-semibold sm:text-5xl md:text-6xl"
          >
            {shop.name}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.12 }}
            className="mt-3 max-w-md text-sm text-white/80 sm:text-base"
          >
            Фермерские колбасы и деликатесы. Заказ с витрины — список уходит{' '}
            {shop.contact}у в Max.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.2 }}
            className="mt-6 flex flex-wrap gap-2.5"
          >
            <a
              href="#catalog"
              className="rounded-xl bg-gold px-5 py-3 text-sm font-bold text-forest-deep shadow-lg shadow-black/20 transition hover:brightness-105"
            >
              Смотреть каталог
            </a>
            <a
              href="#order"
              className="rounded-xl border border-white/30 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/18"
            >
              Оформить заказ
            </a>
          </motion.div>
        </div>
      </section>

      <section className="border-b border-black/5 bg-white/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-3 py-3 sm:px-5">
          <div>
            <h2 className="text-lg font-bold text-smoke sm:text-xl">
              Каталог
            </h2>
            <p className="text-xs text-smoke/50 sm:text-sm">
              {productWord(filtered.length)} · таблички как на маркетплейсе
            </p>
          </div>
          <a
            href="#order"
            className="shrink-0 rounded-lg bg-wb px-3 py-2 text-xs font-semibold text-white sm:text-sm"
          >
            Оформить
          </a>
        </div>
      </section>

      <section
        id="catalog"
        className="mx-auto max-w-7xl px-2 py-3 sm:px-4 sm:py-4"
      >
        <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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

        <div className="grid grid-cols-2 gap-x-2 gap-y-4 sm:grid-cols-3 sm:gap-x-3 sm:gap-y-5 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {filtered.map((product, i) => (
            <ProductTile
              key={product.id}
              product={product}
              index={i}
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

      <HowItWorks />
      <OrderBlock />

      <section className="border-t border-forest/10 bg-forest text-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-5">
          <p className="text-xs font-semibold tracking-[0.16em] text-gold-soft uppercase">
            Для владельца
          </p>
          <h2 className="mt-2 font-display text-3xl sm:text-4xl">
            Вместо 1С — админка с телефона
          </h2>
          <p className="mt-3 max-w-xl text-sm text-white/70">
            Приехала партия — за 2 минуты обновили цены и остатки. Клиенты сразу
            видят актуальное. Цены меняются часто? Именно для этого.
          </p>
          <ol className="mt-5 grid gap-2 text-sm text-white/80 sm:grid-cols-2">
            <li className="rounded-xl bg-white/8 px-3 py-2.5">
              1. Откройте каталог — таблички как WB/Ozon
            </li>
            <li className="rounded-xl bg-white/8 px-3 py-2.5">
              2. 2 товара в корзину → «Отправить список в Max»
            </li>
            <li className="rounded-xl bg-white/8 px-3 py-2.5">
              3. Админка · пароль{' '}
              <code className="text-gold-soft">razkolbas</code> — цена или «Нет»
            </li>
            <li className="rounded-xl bg-white/8 px-3 py-2.5">
              4. Вернитесь на витрину — изменения сразу видны
            </li>
          </ol>
          <button
            type="button"
            onClick={onAdmin}
            className="mt-6 rounded-xl bg-gold px-5 py-3.5 text-sm font-bold text-forest-deep transition hover:brightness-105"
          >
            Открыть «Пришла партия»
          </button>
        </div>
      </section>

      <footer className="border-t border-forest/10 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-8 text-sm text-smoke/60 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <span className="font-semibold text-forest">{shop.name}</span>
            {' · '}
            {shop.city} · {shop.contact} · {shop.phoneDisplay}
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
      <ProductModal product={selected} onClose={() => setSelected(null)} />
      <AddToast />
      <MobileDock />
    </div>
  )
}

function HowItWorks() {
  const steps = [
    {
      n: '01',
      t: 'Выберите товары',
      d: 'Как в привычном маркетплейсе — цена, оценка, описание.',
    },
    {
      n: '02',
      t: 'Соберите корзину',
      d: 'Количество правите в корзине. Ориентир по сумме сразу.',
    },
    {
      n: '03',
      t: 'Список в Max',
      d: `Нумерованный заказ уходит ${shop.contact}у. Без предоплаты.`,
    },
  ]
  return (
    <section className="border-t border-forest/8 bg-white/70">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-5">
        <h2 className="font-display text-3xl text-forest">Как заказать</h2>
        <p className="mt-2 max-w-lg text-sm text-smoke/60">
          Три шага — от витрины до сообщения админу в Max.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {steps.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ delay: i * 0.08, duration: 0.4 }}
              className="border-t-2 border-gold pt-4"
            >
              <div className="text-xs font-bold tracking-widest text-gold">
                {s.n}
              </div>
              <h3 className="mt-2 text-lg font-semibold text-smoke">{s.t}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-smoke/60">
                {s.d}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

function productWord(n: number) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return `${n} товар`
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${n} товара`
  }
  return `${n} товаров`
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-3 py-1.5 text-sm transition ${
        active
          ? 'bg-forest text-white'
          : 'bg-white text-smoke ring-1 ring-black/8 hover:ring-black/20'
      }`}
    >
      {children}
    </button>
  )
}

function ProductTile({
  product,
  index,
  onOpen,
}: {
  product: Product
  index: number
  onOpen: () => void
}) {
  const { add } = useCart()
  const discount =
    product.oldPrice && product.oldPrice > product.price
      ? Math.round((1 - product.price / product.oldPrice) * 100)
      : product.badge === 'sale'
        ? 15
        : 0
  const low = product.stock === 'low'

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.02, 0.24), duration: 0.35 }}
      className="group flex flex-col"
    >
      <div className="relative">
        <button
          type="button"
          onClick={onOpen}
          className="relative block w-full overflow-hidden rounded-2xl bg-[#f6f6f9] text-left"
        >
          <div className="aspect-[3/4] sm:aspect-square">
            <img
              src={product.image}
              alt={product.name}
              className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
              loading="lazy"
            />
          </div>
          {(product.badge || discount > 0) && (
            <span
              className={`absolute top-1.5 left-1.5 rounded px-1.5 py-0.5 text-[10px] font-bold text-white ${
                discount > 0 || product.badge === 'sale'
                  ? 'bg-sale'
                  : product.badge === 'new'
                    ? 'bg-[#0a91d2]'
                    : 'bg-[#481173]'
              }`}
            >
              {discount > 0 ? `−${discount}%` : badgeLabel[product.badge!]}
            </span>
          )}
        </button>

        <button
          type="button"
          aria-label="В корзину"
          onClick={() => add(product)}
          className="absolute right-2 bottom-2 flex h-9 w-9 items-center justify-center rounded-full bg-white text-wb shadow-[0_2px_10px_rgba(0,0,0,0.18)] transition hover:scale-105 active:scale-95"
        >
          <ShoppingBag className="h-4 w-4" strokeWidth={2.4} />
        </button>
      </div>

      <button type="button" onClick={onOpen} className="mt-2 px-0.5 text-left">
        <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
          <span
            className={`text-[15px] leading-none font-bold sm:text-base ${
              discount > 0 ? 'text-sale' : 'text-smoke'
            }`}
          >
            {formatPrice(product.price)}
          </span>
          {product.oldPrice && product.oldPrice > product.price && (
            <span className="text-xs text-smoke/40 line-through">
              {formatPrice(product.oldPrice)}
            </span>
          )}
          <span className="text-[11px] text-smoke/40">/{product.unit}</span>
        </div>

        {(product.rating || product.reviews) && (
          <div className="mt-1 flex items-center gap-1 text-[11px] text-smoke/55">
            <Star className="h-3 w-3 fill-[#ffb800] text-[#ffb800]" />
            <span className="font-medium text-smoke/70">
              {product.rating?.toFixed(1) ?? '5.0'}
            </span>
            <span>· {product.reviews ?? 0} оценок</span>
          </div>
        )}

        <h3 className="mt-1 line-clamp-2 text-[13px] leading-snug font-normal text-smoke">
          {product.name}
        </h3>
        <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-smoke/45">
          {product.description}
        </p>
        <p
          className={`mt-1 text-[11px] font-medium ${
            low ? 'text-[#c48a00]' : 'text-[#0a9b4a]'
          }`}
        >
          {low ? 'Осталось мало' : 'Доставка по городу'}
        </p>
      </button>
    </motion.article>
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

  const discount =
    product.oldPrice && product.oldPrice > product.price
      ? Math.round((1 - product.price / product.oldPrice) * 100)
      : 0

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
        aria-modal="true"
        className="fixed inset-x-3 bottom-3 z-50 mx-auto max-h-[85svh] max-w-lg overflow-y-auto rounded-3xl bg-white p-4 shadow-2xl sm:inset-y-auto sm:top-1/2 sm:bottom-auto sm:-translate-y-1/2 sm:p-5"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
      >
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 hover:bg-mist"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="relative overflow-hidden rounded-2xl">
          <img
            src={product.image}
            alt={product.name}
            className="aspect-[4/3] w-full object-cover"
          />
          {discount > 0 && (
            <span className="absolute top-2 left-2 rounded bg-sale px-2 py-0.5 text-xs font-bold text-white">
              −{discount}%
            </span>
          )}
        </div>
        <div className="mt-4 flex flex-wrap items-baseline gap-2">
          <span
            className={`text-2xl font-bold ${discount > 0 ? 'text-sale' : 'text-forest'}`}
          >
            {formatPrice(product.price)}
          </span>
          {product.oldPrice && product.oldPrice > product.price && (
            <span className="text-sm text-smoke/40 line-through">
              {formatPrice(product.oldPrice)}
            </span>
          )}
          <span className="text-sm font-normal text-smoke/45">
            / {product.unit}
          </span>
        </div>
        {(product.rating || product.reviews) && (
          <div className="mt-2 flex items-center gap-1 text-sm text-smoke/60">
            <Star className="h-4 w-4 fill-[#ffb800] text-[#ffb800]" />
            <span className="font-medium">
              {product.rating?.toFixed(1) ?? '5.0'}
            </span>
            <span>· {product.reviews ?? 0} оценок</span>
          </div>
        )}
        <h2 className="mt-2 text-xl font-semibold text-smoke">{product.name}</h2>
        <p className="mt-3 text-sm leading-relaxed text-smoke/70">
          {product.description}
        </p>
        {product.note && (
          <p className="mt-2 text-sm text-bark">{product.note}</p>
        )}
        <p
          className={`mt-2 text-sm font-medium ${
            product.stock === 'low' ? 'text-[#c48a00]' : 'text-[#0a9b4a]'
          }`}
        >
          {product.stock === 'low' ? 'Осталось мало' : 'В наличии · доставка'}
        </p>
        <button
          type="button"
          onClick={() => {
            add(product)
            onClose()
          }}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#0f9d58] py-3.5 text-sm font-semibold text-white transition hover:brightness-105"
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
  const [showPreview, setShowPreview] = useState(false)

  const message = useMemo(
    () =>
      buildOrderMessage(lines, { name, phone, address, comment, when }),
    [lines, name, phone, address, comment, when],
  )

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (lines.length === 0) {
      alert('Добавьте товары из каталога')
      return
    }
    openOrderInMax(message)
  }

  return (
    <section id="order" className="border-t border-forest/10 bg-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-3 py-10 sm:px-5 lg:grid-cols-2">
        <div>
          <h2 className="font-display text-3xl text-forest">
            Заказ админу в Max
          </h2>
          <p className="mt-2 text-sm text-smoke/65">
            Соберите корзину. Мы сформируем нумерованный список и откроем Max —
            отправьте сообщение {shop.contact}у.
          </p>
          <div className="mt-5 rounded-2xl bg-mist/80 p-4">
            <div className="text-xs tracking-wider text-smoke/45 uppercase">
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
          {lines.length > 0 && (
            <button
              type="button"
              onClick={() => setShowPreview((v) => !v)}
              className="mt-3 text-sm font-medium text-forest underline-offset-2 hover:underline"
            >
              {showPreview ? 'Скрыть текст для Max' : 'Как будет выглядеть в Max'}
            </button>
          )}
          {showPreview && lines.length > 0 && (
            <pre className="mt-2 max-h-56 overflow-auto rounded-xl bg-forest-deep p-3 text-[11px] leading-relaxed whitespace-pre-wrap text-white/85">
              {message}
            </pre>
          )}
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
              className="flex-1 rounded-xl bg-forest py-3.5 text-sm font-semibold text-white transition hover:bg-moss"
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
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-2"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
              {lines.length === 0 && (
                <p className="text-smoke/50">
                  Пока пусто — выберите товары в каталоге.
                </p>
              )}
              {lines.map((line) => (
                <div
                  key={line.product.id}
                  className="flex gap-3 border-b border-black/5 pb-3"
                >
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

function AddToast() {
  const { lastAdded, clearLastAdded, setOpen, count } = useCart()

  useEffect(() => {
    if (!lastAdded) return
    const t = window.setTimeout(clearLastAdded, 2600)
    return () => window.clearTimeout(t)
  }, [lastAdded, clearLastAdded])

  return (
    <AnimatePresence>
      {lastAdded && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12 }}
          className="fixed bottom-20 left-1/2 z-[60] w-[min(92vw,380px)] -translate-x-1/2 md:bottom-6"
        >
          <div className="flex items-center gap-3 rounded-2xl bg-forest-deep px-3 py-3 text-white shadow-2xl ring-1 ring-white/10">
            <img
              src={lastAdded.image}
              alt=""
              className="h-11 w-11 rounded-xl object-cover"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1 text-xs text-gold-soft">
                <Check className="h-3.5 w-3.5" /> В корзине · {count}
              </div>
              <div className="truncate text-sm font-medium">{lastAdded.name}</div>
            </div>
            <button
              type="button"
              onClick={() => {
                clearLastAdded()
                setOpen(true)
              }}
              className="shrink-0 rounded-xl bg-gold px-3 py-2 text-xs font-bold text-forest-deep"
            >
              Открыть
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function MobileDock() {
  const { count, setOpen } = useCart()
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-white/95 p-2.5 pb-[max(0.6rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden">
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
  const [q, setQ] = useState('')
  const [stockFilter, setStockFilter] = useState<'all' | Stock>('all')
  const [flash, setFlash] = useState('')

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    return catalog.products.filter((p) => {
      const okQ = !query || p.name.toLowerCase().includes(query)
      const stock = p.stock || 'in_stock'
      const okS = stockFilter === 'all' || stock === stockFilter
      return okQ && okS
    })
  }, [catalog.products, q, stockFilter])

  const stats = useMemo(() => {
    const inStock = catalog.products.filter((p) => p.stock !== 'out').length
    const low = catalog.products.filter((p) => p.stock === 'low').length
    const out = catalog.products.filter((p) => p.stock === 'out').length
    return { inStock, low, out, total: catalog.products.length }
  }, [catalog.products])

  const notify = (text: string) => {
    setFlash(text)
    window.setTimeout(() => setFlash(''), 1800)
  }

  if (!authed) {
    return (
      <div className="mx-auto flex min-h-svh max-w-md flex-col justify-center px-4">
        <button
          type="button"
          onClick={onBack}
          className="mb-6 inline-flex items-center gap-2 text-sm text-smoke/60"
        >
          <ArrowLeft className="h-4 w-4" /> На витрину
        </button>
        <div className="rounded-3xl bg-white p-6 shadow-lg ring-1 ring-black/5">
          <img
            src="/images/logo-mark.jpg"
            alt=""
            className="h-14 w-14 rounded-full object-cover ring-1 ring-forest/15"
          />
          <h1 className="mt-4 text-2xl font-bold text-forest">
            Админка витрины
          </h1>
          <p className="mt-2 text-sm text-smoke/60">
            Пришла партия — меняете цены и остатки с телефона. Без 1С.
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
              placeholder="Пароль (razkolbas)"
              className="w-full rounded-xl border border-forest/15 px-3 py-3"
              autoFocus
            />
            <button
              type="submit"
              className="w-full rounded-xl bg-forest py-3.5 font-semibold text-white"
            >
              Войти
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto min-h-svh max-w-2xl bg-[#f3f4f6] px-3 pt-4 pb-28 sm:px-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="mb-2 inline-flex items-center gap-2 text-sm text-smoke/60"
          >
            <ArrowLeft className="h-4 w-4" /> На витрину
          </button>
          <h1 className="text-2xl font-bold text-forest">Пришла партия</h1>
          <p className="mt-1 text-sm text-smoke/55">
            {stats.total} позиций · {stats.inStock} в наличии · {stats.low} мало
            · {stats.out} нет
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing(emptyProduct())}
          className="rounded-xl bg-[#0f9d58] px-3.5 py-2.5 text-sm font-semibold text-white shadow"
        >
          + Товар
        </button>
      </div>

      <div className="mb-3 rounded-2xl bg-[#163528] p-3 text-sm text-white/90">
        <strong className="text-gold-soft">Демо:</strong> поменяйте цену или
        нажмите «Мало / Нет» — на витрине обновится сразу.
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => {
            catalog.persist(
              catalog.products.map((p) =>
                p.stock === 'out'
                  ? { ...p, stock: 'in_stock', available: true }
                  : p,
              ),
            )
            notify('Всё «Нет» → снова «Есть»')
          }}
          className="rounded-xl bg-white px-3 py-2.5 text-left text-xs font-semibold text-forest shadow-sm ring-1 ring-black/5"
        >
          Партия приехала
          <span className="mt-0.5 block font-normal text-smoke/45">
            Нет → Есть
          </span>
        </button>
        <button
          type="button"
          onClick={() => {
            if (confirm('Сбросить каталог к демо-набору?')) {
              catalog.reset()
              notify('Каталог сброшен')
            }
          }}
          className="rounded-xl bg-white px-3 py-2.5 text-left text-xs font-semibold text-smoke/70 shadow-sm ring-1 ring-black/5"
        >
          Сброс демо
          <span className="mt-0.5 block font-normal text-smoke/45">
            Исходные цены
          </span>
        </button>
      </div>

      <div className="relative mb-2">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-smoke/35" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Поиск товара..."
          className="w-full rounded-xl border-0 bg-white py-3 pr-3 pl-9 text-sm shadow-sm ring-1 ring-black/5"
        />
      </div>

      <div className="mb-3 flex gap-1.5 overflow-x-auto pb-0.5">
        {(
          [
            ['all', 'Все'],
            ['in_stock', 'Есть'],
            ['low', 'Мало'],
            ['out', 'Нет'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setStockFilter(id)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${
              stockFilter === id
                ? 'bg-forest text-white'
                : 'bg-white text-smoke/60 ring-1 ring-black/5'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-2.5">
        {filtered.map((p) => (
          <AdminProductRow
            key={p.id}
            product={p}
            onPatch={(data) => {
              catalog.patch(p.id, data)
              if (data.price != null) notify(`Цена: ${formatPrice(data.price)}`)
              if (data.stock) notify(`Остаток: ${stockLabel[data.stock]}`)
            }}
            onEdit={() => setEditing(p)}
            onDelete={() => {
              if (confirm(`Удалить «${p.name}»?`)) catalog.remove(p.id)
            }}
          />
        ))}
        {filtered.length === 0 && (
          <p className="py-10 text-center text-sm text-smoke/45">
            Ничего не найдено
          </p>
        )}
      </div>

      <AnimatePresence>
        {flash && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-forest-deep px-4 py-2.5 text-sm font-medium text-white shadow-xl"
          >
            {flash}
          </motion.div>
        )}
      </AnimatePresence>

      {editing && (
        <ProductEditor
          product={editing}
          onClose={() => setEditing(null)}
          onSave={(p) => {
            catalog.upsert(p)
            setEditing(null)
            notify('Сохранено на витрине')
          }}
        />
      )}
    </div>
  )
}

function AdminProductRow({
  product,
  onPatch,
  onEdit,
  onDelete,
}: {
  product: Product
  onPatch: (data: Partial<Product>) => void
  onEdit: () => void
  onDelete: () => void
}) {
  const [price, setPrice] = useState(String(product.price))
  const stock = product.stock || 'in_stock'

  useEffect(() => {
    setPrice(String(product.price))
  }, [product.price])

  const commitPrice = () => {
    const n = Number(price)
    if (!n || n === product.price) {
      setPrice(String(product.price))
      return
    }
    onPatch({ price: n })
  }

  return (
    <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5">
      <div className="flex gap-3">
        <img
          src={product.image}
          alt=""
          className="h-16 w-16 shrink-0 rounded-xl object-cover"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate font-semibold text-smoke">
                {product.name}
              </div>
              <div className="text-xs text-smoke/45">
                {stockLabel[stock]} · /{product.unit}
              </div>
            </div>
            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                onClick={onEdit}
                className="rounded-lg bg-mist p-2"
                aria-label="Редактировать"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="rounded-lg bg-red-50 p-2 text-red-500"
                aria-label="Удалить"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mt-2 flex items-center gap-2">
            <label className="flex items-center gap-1 rounded-xl bg-mist px-2 py-1.5 text-sm">
              <span className="text-smoke/45">₽</span>
              <input
                type="number"
                inputMode="numeric"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                onBlur={commitPrice}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur()
                }}
                className="w-20 bg-transparent font-bold text-forest outline-none"
              />
            </label>
            <span className="text-xs text-smoke/40">/{product.unit}</span>
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-1.5">
        {(
          [
            ['in_stock', 'Есть', 'bg-emerald-50 text-emerald-700'],
            ['low', 'Мало', 'bg-amber-50 text-amber-700'],
            ['out', 'Нет', 'bg-red-50 text-red-600'],
          ] as const
        ).map(([value, label, cls]) => (
          <button
            key={value}
            type="button"
            onClick={() =>
              onPatch({
                stock: value as Stock,
                available: value !== 'out',
              })
            }
            className={`rounded-xl py-2.5 text-xs font-semibold transition active:scale-[0.98] ${
              stock === value
                ? cls + ' ring-2 ring-current/20 ring-offset-1'
                : 'bg-mist text-smoke/50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
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
          const stock = draft.stock || 'in_stock'
          onSave({
            ...draft,
            name: draft.name.trim(),
            description: draft.description.trim() || draft.name.trim(),
            stock,
            available: stock !== 'out',
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
            rows={3}
            value={draft.description}
            onChange={(e) =>
              setDraft({ ...draft, description: e.target.value })
            }
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
            Было, ₽ (скидка)
            <input
              type="number"
              min={0}
              value={draft.oldPrice || ''}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  oldPrice: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              className="mt-1 w-full rounded-xl border px-3 py-2.5"
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
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
          <label className="block text-sm">
            Остаток
            <select
              value={draft.stock || 'in_stock'}
              onChange={(e) =>
                setDraft({ ...draft, stock: e.target.value as Stock })
              }
              className="mt-1 w-full rounded-xl border px-3 py-2.5"
            >
              <option value="in_stock">Есть</option>
              <option value="low">Мало</option>
              <option value="out">Нет</option>
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
          Примечание
          <input
            value={draft.note || ''}
            onChange={(e) => setDraft({ ...draft, note: e.target.value })}
            className="mt-1 w-full rounded-xl border px-3 py-2.5"
            placeholder="500 г, вакуум..."
          />
        </label>

        <button
          type="submit"
          className="w-full rounded-xl bg-forest py-3.5 font-semibold text-white"
        >
          Сохранить на витрине
        </button>
      </form>
    </div>
  )
}
