import React, { useState, useEffect, useCallback } from 'react'
import { Modal } from '../shared/Modal'
import { Pagination } from '../shared/Pagination'
import { formatThaiDate } from '../../lib/format'
import type { Product, StockMovement, PaginatedResult } from '../../lib/types'

interface Props {
  open: boolean
  onClose: () => void
  product: Product
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  in: { label: 'เข้า', color: 'bg-green-100 text-green-700' },
  out: { label: 'ออก', color: 'bg-red-100 text-red-700' },
  adjust: { label: 'ปรับ', color: 'bg-amber-100 text-amber-700' }
}

export function StockMovementDialog({ open, onClose, product }: Props) {
  const [data, setData] = useState<PaginatedResult<StockMovement> | null>(null)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)

  const fetchMovements = useCallback(async (p: number) => {
    setLoading(true)
    try {
      const result = await window.api.getStockMovements({
        productId: product.id,
        page: p,
        pageSize: 15
      })
      setData(result)
    } finally {
      setLoading(false)
    }
  }, [product.id])

  useEffect(() => {
    if (open) {
      setPage(1)
      fetchMovements(1)
    }
  }, [open, fetchMovements])

  const handlePageChange = (p: number) => {
    setPage(p)
    fetchMovements(p)
  }

  return (
    <Modal open={open} onClose={onClose} title={`ประวัติสต็อก — ${product.name}`} width="max-w-2xl">
      <div className="space-y-3">
        <div className="bg-gray-50 rounded-lg px-4 py-2">
          <span className="text-sm text-gray-500">คงเหลือปัจจุบัน:</span>
          <span className="text-sm font-bold text-gray-900 ml-2">{product.stock_on_hand}</span>
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-400">กำลังโหลด...</div>
        ) : data && data.data.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-600 border-b">
                    <th className="px-3 py-2 text-left font-medium">วันที่</th>
                    <th className="px-3 py-2 text-center font-medium">ประเภท</th>
                    <th className="px-3 py-2 text-right font-medium">จำนวน</th>
                    <th className="px-3 py-2 text-right font-medium">ก่อน</th>
                    <th className="px-3 py-2 text-right font-medium">หลัง</th>
                    <th className="px-3 py-2 text-left font-medium">เหตุผล</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.data.map((m) => {
                    const typeInfo = TYPE_LABELS[m.type] || { label: m.type, color: 'bg-gray-100 text-gray-700' }
                    return (
                      <tr key={m.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                          {formatThaiDate(m.created_at)}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeInfo.color}`}>
                            {typeInfo.label}
                          </span>
                        </td>
                        <td className={`px-3 py-2 text-right font-medium ${
                          m.type === 'in' ? 'text-green-600' : m.type === 'out' ? 'text-red-600' : 'text-amber-600'
                        }`}>
                          {m.type === 'in' ? '+' : m.type === 'out' ? '-' : ''}{m.quantity}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-500">{m.stock_before}</td>
                        <td className="px-3 py-2 text-right text-gray-900 font-medium">{m.stock_after}</td>
                        <td className="px-3 py-2 text-gray-600 text-xs max-w-48 truncate">
                          {m.reason || '-'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <Pagination
              page={data.page}
              total={data.total}
              pageSize={data.pageSize}
              onPageChange={handlePageChange}
            />
          </>
        ) : (
          <div className="text-center py-8 text-gray-400">ยังไม่มีประวัติการเคลื่อนไหวสต็อก</div>
        )}
      </div>
    </Modal>
  )
}
