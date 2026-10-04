import { useCallback, useEffect, useState } from 'react'
import {
  defaultProducts,
  type CategoryId,
  type Product,
  type Stock,
  type Unit,
} from './data/products'

const STORAGE_KEY = 'razkolbas.catalog.v2'

function normalize(p: Partial<Product> & Pick<Product, 'id' | 'name'>): Product {
  const stock = (p.stock as Stock) || (p.available === false ? 'out' : 'in_stock')
  return {
    id: p.id,
    name: p.name,
    category: (p.category as CategoryId) || 'sausages',
    price: Number(p.price) || 0,
    oldPrice: p.oldPrice,
    unit: (p.unit as Unit) || 'кг',
    description: p.description || '',
    note: p.note,
    badge: p.badge,
    image: p.image || '/images/case-1.jpg',
    available: p.available !== false && stock !== 'out',
    stock,
    rating: p.rating,
    reviews: p.reviews,
  }
}

function withDefaults(list: Product[]): Product[] {
  return list.map((p) => normalize({ ...p, stock: p.stock || 'in_stock' }))
}

function loadCatalog(): Product[] {
  try {
    const raw =
      localStorage.getItem(STORAGE_KEY) ||
      localStorage.getItem('razkolbas.catalog.v1')
    if (!raw) return withDefaults(defaultProducts)
    const parsed = JSON.parse(raw) as Product[]
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return withDefaults(defaultProducts)
    }
    return parsed.map((p) => normalize(p))
  } catch {
    return withDefaults(defaultProducts)
  }
}

function saveCatalog(products: Product[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(products))
}

export function useCatalog() {
  const [products, setProducts] = useState<Product[]>(() =>
    typeof window === 'undefined'
      ? withDefaults(defaultProducts)
      : loadCatalog(),
  )

  useEffect(() => {
    setProducts(loadCatalog())
  }, [])

  const persist = useCallback((next: Product[]) => {
    const normalized = next.map((p) =>
      normalize({
        ...p,
        available: p.stock !== 'out' && p.available !== false,
      }),
    )
    setProducts(normalized)
    saveCatalog(normalized)
  }, [])

  const upsert = useCallback(
    (product: Product) => {
      const next = normalize(product)
      persist(
        products.some((p) => p.id === next.id)
          ? products.map((p) => (p.id === next.id ? next : p))
          : [next, ...products],
      )
    },
    [persist, products],
  )

  const patch = useCallback(
    (id: string, patchData: Partial<Product>) => {
      persist(
        products.map((p) =>
          p.id === id
            ? normalize({
                ...p,
                ...patchData,
                available:
                  patchData.stock === 'out'
                    ? false
                    : patchData.available ?? p.available,
              })
            : p,
        ),
      )
    },
    [persist, products],
  )

  const remove = useCallback(
    (id: string) => {
      persist(products.filter((p) => p.id !== id))
    },
    [persist, products],
  )

  const reset = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem('razkolbas.catalog.v1')
    setProducts(withDefaults(defaultProducts))
  }, [])

  const visible = products.filter((p) => p.available && p.stock !== 'out')

  return { products, visible, upsert, patch, remove, reset, persist }
}

export function emptyProduct(): Product {
  return {
    id: `p-${Date.now()}`,
    name: '',
    category: 'sausages',
    price: 0,
    unit: 'кг',
    description: '',
    image: '/images/case-1.jpg',
    available: true,
    stock: 'in_stock',
    rating: 5,
    reviews: 0,
  }
}
