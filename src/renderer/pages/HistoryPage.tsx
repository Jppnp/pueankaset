import React, { useState, useEffect, useCallback } from 'react'
import { DateRangeFilter } from '../components/history/DateRangeFilter'
import { OrderList } from '../components/history/OrderList'
import { OrderDetail } from '../components/history/OrderDetail'
import { Pagination } from '../components/shared/Pagination'
import { useHistory } from '../hooks/useHistory'
import { formatBaht, todayRange, thisMonthRange, toISODate, yesterdayRange } from '../lib/format'
import { useRole } from '../contexts/RoleContext'
import type { Product, SaleWithItems, Store } from '../lib/types'

type FilterPreset = 'today' | 'yesterday' | 'month' | 'custom'

export function HistoryPage() {
  const [preset, setPreset] = useState<FilterPreset>('today')
  const [customFrom, setCustomFrom] = useState(toISODate(new Date()))
  const [customTo, setCustomTo] = useState(toISODate(new Date()))
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<SaleWithItems | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [stores, setStores] = useState<Store[]>([])
  const [selectedStoreId, setSelectedStoreId] = useState<number | undefined>(undefined)
  const [pageSize, setPageSize] = useState(20)
  const [itemSearch, setItemSearch] = useState('')
  const [itemResults, setItemResults] = useState<Product[]>([])
  const [itemSearchLoading, setItemSearchLoading] = useState(false)
  const [selectedItem, setSelectedItem] = useState<Product | null>(null)

  const { isOwner } = useRole()
  const { sales, loading, profitSummary, fetchSales, fetchProfit, getSaleDetail } = useHistory()
  const selectedItemId = selectedItem?.id
  const paidRevenue = profitSummary?.total_paid_revenue ?? profitSummary?.total_revenue ?? 0
  const creditRevenue = profitSummary?.total_credit_revenue ?? 0
  const debtPayments = profitSummary?.total_debt_payments ?? 0
  const receivedAmount = profitSummary?.total_received_amount ?? paidRevenue

  useEffect(() => {
    window.api.getStores().then(setStores)
  }, [])

  useEffect(() => {
    const query = itemSearch.trim()
    if (!query) {
      setItemResults([])
      setItemSearchLoading(false)
      return
    }

    let active = true
    const timeout = window.setTimeout(async () => {
      setItemSearchLoading(true)
      try {
        const results = await window.api.getProducts(query, selectedStoreId, { status: 'all' })
        if (active) setItemResults(results)
      } finally {
        if (active) setItemSearchLoading(false)
      }
    }, 250)
    return () => {
      active = false
      window.clearTimeout(timeout)
    }
  }, [itemSearch, selectedStoreId])

  const getDateRange = useCallback(() => {
    switch (preset) {
      case 'today':
        return todayRange()
      case 'yesterday':
        return yesterdayRange()
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
    setSelectedId(null)
    setDetail(null)
  }, [preset, customFrom, customTo, selectedStoreId, selectedItemId])

  useEffect(() => {
    const range = getDateRange()
    fetchSales({
      page: 1,
      pageSize,
      dateFrom: range.from,
      dateTo: range.to,
      storeId: selectedStoreId,
      itemId: selectedItemId
    })
    fetchProfit(range.from, range.to, selectedStoreId, selectedItemId)
  }, [preset, customFrom, customTo, selectedStoreId, pageSize, selectedItemId, fetchSales, fetchProfit, getDateRange])

  const handlePageChange = useCallback(
    (page: number) => {
      const range = getDateRange()
      fetchSales({
        page,
        pageSize,
        dateFrom: range.from,
        dateTo: range.to,
        storeId: selectedStoreId,
        itemId: selectedItemId
      })
    },
    [fetchSales, getDateRange, selectedStoreId, pageSize, selectedItemId]
  )

  const handlePageSizeChange = useCallback(
    (newSize: number) => {
      setPageSize(newSize)
    },
    []
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

  const handleExport = useCallback(
    async (detailed: boolean) => {
      const range = getDateRange()
      const params = { dateFrom: range.from, dateTo: range.to, storeId: selectedStoreId, itemId: selectedItemId }
      const result = detailed
        ? await window.api.exportSalesDetail(params)
        : await window.api.exportSales(params)
      if (result.success) {
        alert(`บันทึกไฟล์สำเร็จ: ${result.path}`)
      }
    },
    [getDateRange, selectedStoreId, selectedItemId]
  )

  const handleRefundSuccess = useCallback(() => {
    // Re-fetch the detail, sales list, and profit summary
    if (selectedId) {
      handleSelect(selectedId)
    }
    const range = getDateRange()
    fetchSales({
      page: sales.page,
      pageSize,
      dateFrom: range.from,
      dateTo: range.to,
      storeId: selectedStoreId,
      itemId: selectedItemId
    })
    fetchProfit(range.from, range.to, selectedStoreId, selectedItemId)
  }, [selectedId, handleSelect, fetchSales, fetchProfit, getDateRange, sales.page, pageSize, selectedStoreId, selectedItemId])

  const handleStoreChange = useCallback((value: string) => {
    setSelectedStoreId(value ? Number(value) : undefined)
    setSelectedItem(null)
    setItemSearch('')
    setItemResults([])
  }, [])

  const handleItemSelect = useCallback((product: Product) => {
    setSelectedItem(product)
    setItemSearch('')
    setItemResults([])
  }, [])

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b bg-white">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-gray-900">ประวัติการขาย</h1>
          <div className="flex items-center gap-2">
            <div className="relative group">
              <button className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium">
                ส่งออก Excel
              </button>
              <div className="hidden group-hover:block absolute right-0 top-full pt-1 z-10">
                <div className="bg-white border border-gray-200 rounded-lg shadow-lg min-w-[180px]">
                  <button
                    onClick={() => handleExport(false)}
                    className="w-full px-4 py-2 text-sm text-left text-gray-700 hover:bg-gray-50 rounded-t-lg"
                  >
                    สรุปรายการขาย
                  </button>
                  <button
                    onClick={() => handleExport(true)}
                    className="w-full px-4 py-2 text-sm text-left text-gray-700 hover:bg-gray-50 rounded-b-lg border-t"
                  >
                    รายละเอียด (แยกสินค้า)
                  </button>
                </div>
              </div>
            </div>
            <span className="text-sm text-gray-500">ร้านค้า:</span>
            <select
              value={selectedStoreId ?? ''}
              onChange={(e) => handleStoreChange(e.target.value)}
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
          itemSearch={itemSearch}
          itemResults={itemResults}
          itemSearchLoading={itemSearchLoading}
          selectedItem={selectedItem}
          onPresetChange={setPreset}
          onCustomFromChange={setCustomFrom}
          onCustomToChange={setCustomTo}
          onItemSearchChange={setItemSearch}
          onItemSelect={handleItemSelect}
          onClearItem={() => setSelectedItem(null)}
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
                showItemNames={Boolean(selectedItemId)}
                emptyMessage={
                  selectedItemId
                    ? 'ไม่พบรายการขายที่มีสินค้านี้ในช่วงเวลานี้'
                    : undefined
                }
              />
            )}
          </div>
          <div className="border-t px-4 py-2">
            <Pagination
              page={sales.page}
              total={sales.total}
              pageSize={sales.pageSize}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
            />
          </div>
        </div>

        {/* Right - Detail */}
        <div className="flex-1 overflow-y-auto">
          <OrderDetail
            sale={detail}
            loading={detailLoading}
            onPrint={handlePrint}
            onRefundSuccess={handleRefundSuccess}
            onDeliveryStatusChange={handleRefundSuccess}
          />
        </div>
      </div>

      {/* Profit summary */}
      {profitSummary && (
        <div className="border-t bg-white px-6 py-3">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
            <div>
              <span className="text-sm text-gray-500">จำนวนการขาย</span>
              <p className="text-lg font-semibold">{profitSummary.sale_count} รายการ</p>
            </div>
            <div>
              <span className="text-sm text-gray-500">ยอดรับชำระแล้ว</span>
              <p className="text-lg font-semibold text-blue-600">
                {formatBaht(receivedAmount)}
              </p>
            </div>
            {debtPayments > 0 && (
              <div>
                <span className="text-sm text-gray-500">รับชำระหนี้</span>
                <p className="text-lg font-semibold text-green-600">
                  {formatBaht(debtPayments)}
                </p>
              </div>
            )}
            {creditRevenue > 0 && (
              <div>
                <span className="text-sm text-gray-500">ยอดขายเชื่อ</span>
                <p className="text-lg font-semibold text-orange-600">
                  {formatBaht(creditRevenue)}
                </p>
              </div>
            )}
            {isOwner && (
              <>
                <div>
                  <span className="text-sm text-gray-500">ต้นทุนรวม</span>
                  <p className="text-lg font-semibold text-red-500">
                    {formatBaht(profitSummary.total_cost)}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">กำไรขั้นต้น</span>
                  <p className="text-lg font-semibold text-green-600">
                    {formatBaht(profitSummary.total_profit)}
                  </p>
                </div>
                {profitSummary.total_expenses !== undefined && (
                  <>
                    <div>
                      <span className="text-sm text-gray-500">ค่าใช้จ่าย</span>
                      <p className="text-lg font-semibold text-orange-500">
                        {formatBaht(profitSummary.total_expenses)}
                      </p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">กำไรสุทธิ</span>
                      <p className="text-xl font-bold text-green-600">
                        {formatBaht(profitSummary.net_profit ?? profitSummary.total_profit)}
                      </p>
                    </div>
                  </>
                )}
              </>
            )}
            <div className="text-xs text-gray-400 ml-auto">
              {selectedItem
                ? `* แสดงเฉพาะสินค้า: ${selectedItem.name}`
                : selectedStoreId
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
