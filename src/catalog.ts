import { useCallback, useEffect, useState } from 'react'
import {
  defaultProducts,
  type CategoryId,
  type Product,
  type Unit,
} from './data/products'

const STORAGE_KEY = 'razkolbas.catalog.v1'

function loadCatalog(): Product[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultProducts
    const parsed = JSON.parse(raw) as Product[]
    if (!Array.isArray(parsed) || parsed.length === 0) return defaultProducts
    return parsed.map((p) => ({
      ...p,
      description: p.description || '',
      available: p.available !== false,
    }))
  } catch {
    return defaultProducts
  }
}

function saveCatalog(products: Product[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(products))
}

export function useCatalog() {
  const [products, setProducts] = useState<Product[]>(() =>
    typeof window === 'undefined' ? defaultProducts : loadCatalog(),
  )

  useEffect(() => {
    setProducts(loadCatalog())
  }, [])

  const persist = useCallback((next: Product[]) => {
    setProducts(next)
    saveCatalog(next)
  }, [])

  const upsert = useCallback(
    (product: Product) => {
      persist(
        products.some((p) => p.id === product.id)
          ? products.map((p) => (p.id === product.id ? product : p))
          : [product, ...products],
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
    setProducts(defaultProducts)
  }, [])

  const visible = products.filter((p) => p.available)

  return { products, visible, upsert, remove, reset, persist }
}

export function emptyProduct(): Product {
  return {
    id: `p-${Date.now()}`,
    name: '',
    category: 'sausages' as CategoryId,
    price: 0,
    unit: 'кг' as Unit,
    description: '',
    image: '/images/case-1.jpg',
    available: true,
  }
}
