import React, { useState, useCallback } from 'react'
import { ProductTable } from '../components/stock/ProductTable'
import { ProductForm } from '../components/stock/ProductForm'
import { useProducts } from '../hooks/useProducts'
import type { Product } from '../lib/types'

export function StockPage() {
  const [search, setSearch] = useState('')
  const { products, loading, refetch } = useProducts(search || undefined)
  const [formOpen, setFormOpen] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [importing, setImporting] = useState(false)
  const [dbInfo, setDbInfo] = useState<{ productCount: number; saleCount: number } | null>(null)

  const fetchDbInfo = React.useCallback(() => {
    window.api.getDbInfo().then(setDbInfo)
  }, [])

  React.useEffect(() => {
    fetchDbInfo()
  }, [fetchDbInfo])

  const handleEdit = useCallback((product: Product) => {
    setEditProduct(product)
    setFormOpen(true)
  }, [])

  const handleCreate = useCallback(() => {
    setEditProduct(null)
    setFormOpen(true)
  }, [])

  const handleSave = useCallback(
    async (data: {
      name: string
      description: string | null
      cost_price: number
      sale_price: number
      stock_on_hand: number
      exclude_from_profit: number
    }) => {
      if (editProduct) {
        await window.api.updateProduct(editProduct.id, data)
      } else {
        await window.api.createProduct(data)
      }
      setFormOpen(false)
      setEditProduct(null)
      refetch(search || undefined)
      fetchDbInfo()
    },
    [editProduct, refetch, search, fetchDbInfo]
  )

  const handleImport = useCallback(async () => {
    const filePath = await window.api.selectFile()
    if (!filePath) return
    setImporting(true)
    try {
      const result = await window.api.importFromStore(filePath)
      alert(`นำเข้าสำเร็จ ${result.imported} สินค้า`)
      refetch(search || undefined)
      fetchDbInfo()
    } catch (err) {
      alert(`เกิดข้อผิดพลาด: ${err instanceof Error ? err.message : 'ไม่ทราบ'}`)
    } finally {
      setImporting(false)
    }
  }, [refetch, search, fetchDbInfo])

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b bg-white flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">คลังสินค้า</h1>
          {dbInfo && (
            <p className="text-sm text-gray-500">
              สินค้าทั้งหมด {dbInfo.productCount} รายการ
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาสินค้า..."
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 w-64"
          />
          <button
            onClick={handleImport}
            disabled={importing}
            className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50"
          >
            {importing ? 'กำลังนำเข้า...' : 'นำเข้าจาก store.db'}
          </button>
          <button
            onClick={handleCreate}
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
          >
            + เพิ่มสินค้า
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <ProductTable products={products} loading={loading} onEdit={handleEdit} />
      </div>

      <ProductForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false)
          setEditProduct(null)
        }}
        product={editProduct}
        onSave={handleSave}
      />
    </div>
  )
}
