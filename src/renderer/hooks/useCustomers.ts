import { useState, useCallback } from 'react'
import type { CustomerWithDebt } from '../lib/types'

export function useCustomers() {
  const [customers, setCustomers] = useState<CustomerWithDebt[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchCustomers = useCallback(async (query?: string) => {
    setLoading(true)
    setError(null)
    try {
      const data = await window.api.getCustomersWithDebt(query)
      setCustomers(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการโหลดข้อมูล')
    } finally {
      setLoading(false)
    }
  }, [])

  return { customers, loading, error, fetchCustomers }
}
