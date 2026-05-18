import { useState, useEffect, useCallback } from 'react'
import type { Product, ProductListOptions } from '../lib/types'

export function useProducts(
  initialQuery?: string,
  initialStoreId?: number,
  initialOptions?: ProductListOptions
) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)

  const fetchProducts = useCallback(
    async (query?: string, storeId?: number, options?: ProductListOptions) => {
    setLoading(true)
    try {
      const result = await window.api.getProducts(query, storeId, options)
      setProducts(result)
    } finally {
      setLoading(false)
    }
    },
    []
  )

  useEffect(() => {
    fetchProducts(initialQuery, initialStoreId, initialOptions)
  }, [fetchProducts, initialQuery, initialStoreId, initialOptions])

  return { products, loading, refetch: fetchProducts }
}

export function useProductSearch() {
  const [results, setResults] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)

  const search = useCallback(async (query: string) => {
    if (!query.trim()) {
      setResults([])
      return
    }
    setLoading(true)
    try {
      const result = await window.api.searchProducts(query)
      setResults(result)
    } finally {
      setLoading(false)
    }
  }, [])

  const clear = useCallback(() => setResults([]), [])

  return { results, loading, search, clear }
}
