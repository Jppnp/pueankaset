import React, { useState, useEffect } from 'react'
import { Modal } from '../shared/Modal'
import type { Product } from '../../lib/types'

interface ProductFormProps {
  open: boolean
  onClose: () => void
  product: Product | null // null = create mode
  onSave: (data: {
    name: string
    description: string | null
    cost_price: number
    sale_price: number
    stock_on_hand: number
    exclude_from_profit: number
  }) => void
}

export function ProductForm({ open, onClose, product, onSave }: ProductFormProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [costPrice, setCostPrice] = useState('')
  const [salePrice, setSalePrice] = useState('')
  const [stock, setStock] = useState('')
  const [exclude, setExclude] = useState(false)

  useEffect(() => {
    if (product) {
      setName(product.name)
      setDescription(product.description ?? '')
      setCostPrice(product.cost_price.toString())
      setSalePrice(product.sale_price.toString())
      setStock(product.stock_on_hand.toString())
      setExclude(product.exclude_from_profit === 1)
    } else {
      setName('')
      setDescription('')
      setCostPrice('')
      setSalePrice('')
      setStock('0')
      setExclude(false)
    }
  }, [product, open])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      name: name.trim(),
      description: description.trim() || null,
      cost_price: parseFloat(costPrice) || 0,
      sale_price: parseFloat(salePrice) || 0,
      stock_on_hand: parseInt(stock) || 0,
      exclude_from_profit: exclude ? 1 : 0
    })
  }

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
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            required
          />
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
              onChange={(e) => setCostPrice(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              step="0.01"
              min="0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ราคาขาย</label>
            <input
              type="number"
              value={salePrice}
              onChange={(e) => setSalePrice(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              step="0.01"
              min="0"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">จำนวนคงเหลือ</label>
          <input
            type="number"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            min="0"
          />
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
            disabled={!name.trim()}
            className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-40"
          >
            {product ? 'บันทึก' : 'เพิ่มสินค้า'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
