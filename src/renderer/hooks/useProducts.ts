import { useState, useEffect, useCallback } from 'react'
import type { Product } from '../lib/types'

export function useProducts(initialQuery?: string) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)

  const fetchProducts = useCallback(async (query?: string) => {
    setLoading(true)
    try {
      const result = await window.api.getProducts(query)
      setProducts(result)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProducts(initialQuery)
  }, [fetchProducts, initialQuery])

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
