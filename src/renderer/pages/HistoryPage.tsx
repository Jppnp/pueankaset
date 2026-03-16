import React, { useState, useEffect, useCallback } from 'react'
import { DateRangeFilter } from '../components/history/DateRangeFilter'
import { OrderList } from '../components/history/OrderList'
import { OrderDetail } from '../components/history/OrderDetail'
import { Pagination } from '../components/shared/Pagination'
import { useHistory } from '../hooks/useHistory'
import { formatBaht, todayRange, thisMonthRange, toISODate } from '../lib/format'
import { useRole } from '../contexts/RoleContext'
import type { SaleWithItems, Store } from '../lib/types'

type FilterPreset = 'today' | 'month' | 'custom'

export function HistoryPage() {
  const [preset, setPreset] = useState<FilterPreset>('today')
  const [customFrom, setCustomFrom] = useState(toISODate(new Date()))
  const [customTo, setCustomTo] = useState(toISODate(new Date()))
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<SaleWithItems | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [stores, setStores] = useState<Store[]>([])
  const [selectedStoreId, setSelectedStoreId] = useState<number | undefined>(undefined)

  const { isOwner } = useRole()
  const { sales, loading, profitSummary, fetchSales, fetchProfit, getSaleDetail } = useHistory()

  useEffect(() => {
    window.api.getStores().then(setStores)
  }, [])

  const getDateRange = useCallback(() => {
    switch (preset) {
      case 'today':
        return todayRange()
      case 'month':
        return thisMonthRange()
      case 'custom':
        return {
          from: `${customFrom} 00:00:00`,
          to: `${customTo} 23:59:59`
        }
    }
  }, [preset, customFrom, customTo])

  useEffect(() => {
    const range = getDateRange()
    fetchSales({ page: 1, dateFrom: range.from, dateTo: range.to, storeId: selectedStoreId })
    fetchProfit(range.from, range.to, selectedStoreId)
  }, [preset, customFrom, customTo, selectedStoreId, fetchSales, fetchProfit, getDateRange])

  const handlePageChange = useCallback(
    (page: number) => {
      const range = getDateRange()
      fetchSales({ page, dateFrom: range.from, dateTo: range.to, storeId: selectedStoreId })
    },
    [fetchSales, getDateRange, selectedStoreId]
  )

  const handleSelect = useCallback(
    async (id: number) => {
      setSelectedId(id)
      setDetailLoading(true)
      const sale = await getSaleDetail(id)
      setDetail(sale)
      setDetailLoading(false)
    },
    [getSaleDetail]
  )

  const handlePrint = useCallback(async (saleId: number) => {
    const result = await window.api.printReceipt(saleId)
    if (!result.success) {
      alert(`พิมพ์ไม่สำเร็จ: ${result.error}`)
    }
  }, [])

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b bg-white">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-gray-900">ประวัติการขาย</h1>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">ร้านค้า:</span>
            <select
              value={selectedStoreId ?? ''}
              onChange={(e) => setSelectedStoreId(e.target.value ? Number(e.target.value) : undefined)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">ทุกร้านค้า</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>
        <DateRangeFilter
          preset={preset}
          customFrom={customFrom}
          customTo={customTo}
          onPresetChange={setPreset}
          onCustomFromChange={setCustomFrom}
          onCustomToChange={setCustomTo}
        />
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left - Order list */}
        <div className="w-96 border-r flex flex-col shrink-0">
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="text-center py-12 text-gray-400">กำลังโหลด...</div>
            ) : (
              <OrderList
                sales={sales.data}
                selectedId={selectedId}
                onSelect={handleSelect}
              />
            )}
          </div>
          <div className="border-t px-4 py-2">
            <Pagination
              page={sales.page}
              total={sales.total}
              pageSize={sales.pageSize}
              onPageChange={handlePageChange}
            />
          </div>
        </div>

        {/* Right - Detail */}
        <div className="flex-1 overflow-y-auto">
          <OrderDetail sale={detail} loading={detailLoading} onPrint={handlePrint} />
        </div>
      </div>

      {/* Profit summary */}
      {profitSummary && (
        <div className="border-t bg-white px-6 py-3">
          <div className="flex items-center gap-8">
            <div>
              <span className="text-sm text-gray-500">จำนวนการขาย</span>
              <p className="text-lg font-semibold">{profitSummary.sale_count} รายการ</p>
            </div>
            <div>
              <span className="text-sm text-gray-500">ยอดขายรวม</span>
              <p className="text-lg font-semibold text-blue-600">
                {formatBaht(profitSummary.total_revenue)}
              </p>
            </div>
            {isOwner && (
              <>
                <div>
                  <span className="text-sm text-gray-500">ต้นทุนรวม</span>
                  <p className="text-lg font-semibold text-red-500">
                    {formatBaht(profitSummary.total_cost)}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">กำไรสุทธิ</span>
                  <p className="text-xl font-bold text-green-600">
                    {formatBaht(profitSummary.total_profit)}
                  </p>
                </div>
              </>
            )}
            <div className="text-xs text-gray-400 ml-auto">
              {selectedStoreId
                ? `* แสดงเฉพาะ: ${stores.find((s) => s.id === selectedStoreId)?.name}`
                : isOwner
                  ? '* ไม่รวมสินค้าที่ตั้งค่าไม่นับกำไร'
                  : ''}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
