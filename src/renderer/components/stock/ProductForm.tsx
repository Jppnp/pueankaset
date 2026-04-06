import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Modal } from '../shared/Modal'
import type { Product, Store } from '../../lib/types'

interface ProductFormProps {
  open: boolean
  onClose: () => void
  product: Product | null
  stores: Store[]
  onSave: (data: {
    name: string
    description: string | null
    cost_price: number
    sale_price: number
    stock_on_hand: number
    exclude_from_profit: number
    store_id: number
  }) => void
}

export function ProductForm({ open, onClose, product, stores, onSave }: ProductFormProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [costPrice, setCostPrice] = useState('')
  const [salePrice, setSalePrice] = useState('')
  const [stock, setStock] = useState('')
  const [exclude, setExclude] = useState(false)
  const [storeId, setStoreId] = useState(1)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null)
  const storesRef = useRef(stores)
  storesRef.current = stores
  const dupTimerRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (product) {
      setName(product.name)
      setDescription(product.description ?? '')
      setCostPrice(product.cost_price.toString())
      setSalePrice(product.sale_price.toString())
      setStock(product.stock_on_hand.toString())
      setExclude(product.exclude_from_profit === 1)
      setStoreId(product.store_id ?? 1)
    } else {
      setName('')
      setDescription('')
      setCostPrice('')
      setSalePrice('')
      setStock('0')
      setExclude(false)
      setStoreId(storesRef.current[0]?.id ?? 1)
    }
    setErrors({})
    setDuplicateWarning(null)
  }, [product, open])

  const checkDuplicate = useCallback(
    (value: string) => {
      clearTimeout(dupTimerRef.current)
      const trimmed = value.trim()
      if (!trimmed) {
        setDuplicateWarning(null)
        return
      }
      dupTimerRef.current = setTimeout(async () => {
        const dup = await window.api.checkDuplicateProduct(trimmed, product?.id)
        setDuplicateWarning(dup ? `มีสินค้าชื่อ "${dup.name}" อยู่แล้ว` : null)
      }, 300)
    },
    [product]
  )

  const handleNameChange = (value: string) => {
    setName(value)
    if (!value.trim()) {
      setErrors((e) => ({ ...e, name: 'กรุณาระบุชื่อสินค้า' }))
    } else {
      setErrors((e) => { const { name: _, ...rest } = e; return rest })
    }
    checkDuplicate(value)
  }

  const validateNumber = (field: string, value: string, label: string) => {
    const num = parseFloat(value)
    if (value && (isNaN(num) || num < 0)) {
      setErrors((e) => ({ ...e, [field]: `${label}ต้องไม่ติดลบ` }))
    } else {
      setErrors((e) => { const { [field]: _, ...rest } = e; return rest })
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) {
      setErrors((e) => ({ ...e, name: 'กรุณาระบุชื่อสินค้า' }))
      return
    }
    const cp = parseFloat(costPrice) || 0
    const sp = parseFloat(salePrice) || 0
    const st = parseInt(stock) || 0
    if (cp < 0 || sp < 0 || st < 0) return

    onSave({
      name: trimmedName,
      description: description.trim() || null,
      cost_price: cp,
      sale_price: sp,
      stock_on_hand: st,
      exclude_from_profit: exclude ? 1 : 0,
      store_id: storeId
    })
  }

  const hasErrors = Object.keys(errors).length > 0

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={product ? 'แก้ไขสินค้า' : 'เพิ่มสินค้าใหม่'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            ชื่อสินค้า *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${
              errors.name ? 'border-red-400' : 'border-gray-300'
            }`}
            required
          />
          {errors.name && (
            <p className="text-xs text-red-500 mt-1">{errors.name}</p>
          )}
          {duplicateWarning && !errors.name && (
            <p className="text-xs text-amber-600 mt-1">{duplicateWarning}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">รายละเอียด</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="เช่น ขนาด, ยี่ห้อ"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ราคาทุน</label>
            <input
              type="number"
              value={costPrice}
              onChange={(e) => {
                setCostPrice(e.target.value)
                validateNumber('costPrice', e.target.value, 'ราคาทุน')
              }}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${
                errors.costPrice ? 'border-red-400' : 'border-gray-300'
              }`}
              step="0.01"
              min="0"
            />
            {errors.costPrice && (
              <p className="text-xs text-red-500 mt-1">{errors.costPrice}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ราคาขาย</label>
            <input
              type="number"
              value={salePrice}
              onChange={(e) => {
                setSalePrice(e.target.value)
                validateNumber('salePrice', e.target.value, 'ราคาขาย')
              }}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${
                errors.salePrice ? 'border-red-400' : 'border-gray-300'
              }`}
              step="0.01"
              min="0"
            />
            {errors.salePrice && (
              <p className="text-xs text-red-500 mt-1">{errors.salePrice}</p>
            )}
          </div>
        </div>

        {costPrice && salePrice && parseFloat(salePrice) > 0 && parseFloat(costPrice) > 0 && (
          <div className="text-xs text-gray-500 -mt-2">
            กำไรต่อชิ้น: ฿{(parseFloat(salePrice) - parseFloat(costPrice)).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
            {' '}({((parseFloat(salePrice) - parseFloat(costPrice)) / parseFloat(costPrice) * 100).toFixed(1)}%)
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">จำนวนคงเหลือ</label>
          <input
            type="number"
            value={stock}
            onChange={(e) => {
              setStock(e.target.value)
              const num = parseInt(e.target.value)
              if (e.target.value && (isNaN(num) || num < 0)) {
                setErrors((er) => ({ ...er, stock: 'จำนวนต้องไม่ติดลบ' }))
              } else {
                setErrors((er) => { const { stock: _, ...rest } = er; return rest })
              }
            }}
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${
              errors.stock ? 'border-red-400' : 'border-gray-300'
            }`}
            min="0"
          />
          {errors.stock && (
            <p className="text-xs text-red-500 mt-1">{errors.stock}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">ร้านค้า</label>
          <select
            value={storeId}
            onChange={(e) => setStoreId(Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            {stores.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={exclude}
            onChange={(e) => setExclude(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
          />
          <span className="text-sm text-gray-700">ไม่นับกำไร (เช่น สินค้าฝากขาย)</span>
        </label>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300"
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            disabled={!name.trim() || hasErrors}
            className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-40"
          >
            {product ? 'บันทึก' : 'เพิ่มสินค้า'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
