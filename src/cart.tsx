import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Product } from './data/products'

export type CartLine = {
  product: Product
  qty: number
}

type CartContextValue = {
  lines: CartLine[]
  count: number
  total: number
  add: (product: Product, qty?: number) => void
  setQty: (id: string, qty: number) => void
  remove: (id: string) => void
  clear: () => void
  open: boolean
  setOpen: (v: boolean) => void
  lastAdded: Product | null
  clearLastAdded: () => void
}

const CartContext = createContext<CartContextValue | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([])
  const [open, setOpen] = useState(false)
  const [lastAdded, setLastAdded] = useState<Product | null>(null)

  const value = useMemo<CartContextValue>(() => {
    const add = (product: Product, qty = 1) => {
      setLines((prev) => {
        const existing = prev.find((l) => l.product.id === product.id)
        if (existing) {
          return prev.map((l) =>
            l.product.id === product.id
              ? { ...l, qty: Math.min(20, l.qty + qty) }
              : l,
          )
        }
        return [...prev, { product, qty }]
      })
      setLastAdded(product)
    }

    const setQty = (id: string, qty: number) => {
      setLines((prev) =>
        prev
          .map((l) =>
            l.product.id === id
              ? { ...l, qty: Math.max(0, Math.min(20, qty)) }
              : l,
          )
          .filter((l) => l.qty > 0),
      )
    }

    const remove = (id: string) => {
      setLines((prev) => prev.filter((l) => l.product.id !== id))
    }

    const clear = () => setLines([])
    const clearLastAdded = () => setLastAdded(null)

    const count = lines.reduce((s, l) => s + l.qty, 0)
    const total = lines.reduce((s, l) => s + l.qty * l.product.price, 0)

    return {
      lines,
      count,
      total,
      add,
      setQty,
      remove,
      clear,
      open,
      setOpen,
      lastAdded,
      clearLastAdded,
    }
  }, [lines, open, lastAdded])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
