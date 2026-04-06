import React, { useState, useEffect, useCallback } from 'react'
import { CustomerList } from '../components/customer/CustomerList'
import { CustomerDetail } from '../components/customer/CustomerDetail'
import { CustomerForm } from '../components/customer/CustomerForm'
import { useCustomers } from '../hooks/useCustomers'

export function CustomerPage() {
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const { customers, loading, fetchCustomers } = useCustomers()

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCustomers(query || undefined)
    }, 200)
    return () => clearTimeout(timer)
  }, [query, fetchCustomers])

  const handleRefresh = useCallback(() => {
    fetchCustomers(query || undefined)
  }, [fetchCustomers, query])

  const handleCreated = () => {
    handleRefresh()
  }

  const handleExport = useCallback(async () => {
    const result = await window.api.exportCustomers()
    if (result.success) {
      alert(`บันทึกไฟล์สำเร็จ: ${result.path}`)
    }
  }, [])

  const handleDelete = useCallback(async () => {
    if (!selectedId) return
    const confirmed = confirm('ต้องการลบลูกค้านี้หรือไม่?')
    if (!confirmed) return

    const result = await window.api.deleteCustomer(selectedId)
    if (result.success) {
      setSelectedId(null)
      handleRefresh()
    } else {
      alert(result.error)
    }
  }, [selectedId, handleRefresh])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b bg-white">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-gray-900">ลูกค้า</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              className="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
            >
              ส่งออก Excel
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              + เพิ่มลูกค้า
            </button>
          </div>
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ค้นหาลูกค้า (ชื่อ/เบอร์โทร)..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left - Customer list */}
        <div className="w-96 border-r flex flex-col shrink-0">
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="text-center py-12 text-gray-400">กำลังโหลด...</div>
            ) : (
              <CustomerList
                customers={customers}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            )}
          </div>
          {selectedId && (
            <div className="border-t px-4 py-2">
              <button
                onClick={handleDelete}
                className="text-xs text-red-500 hover:text-red-700 transition-colors"
              >
                ลบลูกค้า
              </button>
            </div>
          )}
        </div>

        {/* Right - Detail */}
        <div className="flex-1 overflow-hidden">
          <CustomerDetail customerId={selectedId} onRefreshList={handleRefresh} />
        </div>
      </div>

      <CustomerForm
        open={showCreate}
        onClose={() => setShowCreate(false)}
        customer={null}
        onSave={handleCreated}
      />
    </div>
  )
}
