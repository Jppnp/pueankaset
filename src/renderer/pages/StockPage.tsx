import React, { useState, useCallback, useEffect } from 'react'
import { ProductTable } from '../components/stock/ProductTable'
import { ProductForm } from '../components/stock/ProductForm'
import { ImportDialog } from '../components/stock/ImportDialog'
import { useProducts } from '../hooks/useProducts'
import type { Product, Store } from '../lib/types'

export function StockPage() {
  const [search, setSearch] = useState('')
  const [filterStoreId, setFilterStoreId] = useState<number | undefined>(undefined)
  const [stores, setStores] = useState<Store[]>([])
  const { products, loading, refetch } = useProducts(search || undefined, filterStoreId)
  const [formOpen, setFormOpen] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [importing, setImporting] = useState(false)
  const [importFilePath, setImportFilePath] = useState<string | null>(null)
  const [dbInfo, setDbInfo] = useState<{ productCount: number; saleCount: number } | null>(null)
  const [newStoreName, setNewStoreName] = useState('')
  const [addingStore, setAddingStore] = useState(false)

  const fetchStores = useCallback(async () => {
    const result = await window.api.getStores()
    setStores(result)
  }, [])

  const fetchDbInfo = useCallback(() => {
    window.api.getDbInfo().then(setDbInfo)
  }, [])

  useEffect(() => {
    fetchStores()
    fetchDbInfo()
  }, [fetchStores, fetchDbInfo])

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
      store_id: number
    }) => {
      if (editProduct) {
        await window.api.updateProduct(editProduct.id, data)
      } else {
        await window.api.createProduct(data)
      }
      setFormOpen(false)
      setEditProduct(null)
      refetch(search || undefined, filterStoreId)
      fetchDbInfo()
    },
    [editProduct, refetch, search, filterStoreId, fetchDbInfo]
  )

  const handleImport = useCallback(async () => {
    const filePath = await window.api.selectFile()
    if (!filePath) return
    setImportFilePath(filePath)
  }, [])

  const handleImportConfirm = useCallback(async (storeId: number) => {
    if (!importFilePath) return
    setImportFilePath(null)
    setImporting(true)
    try {
      const result = await window.api.importFromStore(importFilePath, storeId)
      await fetchStores()
      alert(`นำเข้าสำเร็จ ${result.imported} สินค้า`)
      refetch(search || undefined, filterStoreId)
      fetchDbInfo()
    } catch (err) {
      alert(`เกิดข้อผิดพลาด: ${err instanceof Error ? err.message : 'ไม่ทราบ'}`)
    } finally {
      setImporting(false)
    }
  }, [importFilePath, refetch, search, filterStoreId, fetchDbInfo, fetchStores])

  const handleAddStore = useCallback(async () => {
    if (!newStoreName.trim()) return
    await window.api.createStore(newStoreName.trim())
    setNewStoreName('')
    setAddingStore(false)
    fetchStores()
  }, [newStoreName, fetchStores])

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
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 w-48"
          />
          <select
            value={filterStoreId ?? ''}
            onChange={(e) => setFilterStoreId(e.target.value ? Number(e.target.value) : undefined)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="">ทุกร้านค้า</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          {addingStore ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newStoreName}
                onChange={(e) => setNewStoreName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddStore()}
                placeholder="ชื่อร้านค้าใหม่"
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 w-40"
                autoFocus
              />
              <button
                onClick={handleAddStore}
                disabled={!newStoreName.trim()}
                className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
              >
                บันทึก
              </button>
              <button
                onClick={() => { setAddingStore(false); setNewStoreName('') }}
                className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300"
              >
                ยกเลิก
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAddingStore(true)}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600"
            >
              + เพิ่มร้านค้า
            </button>
          )}
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
        <ProductTable products={products} stores={stores} loading={loading} onEdit={handleEdit} />
      </div>

      <ProductForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false)
          setEditProduct(null)
        }}
        product={editProduct}
        stores={stores}
        onSave={handleSave}
      />

      <ImportDialog
        open={importFilePath !== null}
        filePath={importFilePath ?? ''}
        stores={stores}
        onConfirm={handleImportConfirm}
        onClose={() => setImportFilePath(null)}
      />

    </div>
  )
}
