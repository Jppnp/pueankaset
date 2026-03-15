import React, { useState } from 'react'
import { Modal } from '../shared/Modal'
import type { Store } from '../../lib/types'

interface ImportDialogProps {
  open: boolean
  filePath: string
  stores: Store[]
  onConfirm: (storeId: number) => void
  onClose: () => void
}

export function ImportDialog({ open, filePath, stores, onConfirm, onClose }: ImportDialogProps) {
  const [selectedStoreId, setSelectedStoreId] = useState<number | ''>('')
  const [newStoreName, setNewStoreName] = useState('')
  const [mode, setMode] = useState<'existing' | 'new'>('existing')

  const fileName = filePath.split('/').pop() ?? filePath

  const handleConfirm = async () => {
    if (mode === 'existing' && selectedStoreId !== '') {
      onConfirm(Number(selectedStoreId))
    } else if (mode === 'new' && newStoreName.trim()) {
      const store = await window.api.createStore(newStoreName.trim())
      onConfirm(store.id)
    }
  }

  const isValid =
    (mode === 'existing' && selectedStoreId !== '') ||
    (mode === 'new' && newStoreName.trim() !== '')

  return (
    <Modal open={open} onClose={onClose} title="นำเข้าสินค้า">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          ไฟล์: <span className="font-medium text-gray-800">{fileName}</span>
        </p>
        <p className="text-sm text-gray-600">เลือกร้านค้าที่จะนำเข้าสินค้าเข้า:</p>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setMode('existing')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
              mode === 'existing'
                ? 'bg-green-600 text-white border-green-600'
                : 'bg-white text-gray-600 border-gray-300 hover:border-green-400'
            }`}
          >
            ร้านค้าที่มีอยู่
          </button>
          <button
            type="button"
            onClick={() => setMode('new')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
              mode === 'new'
                ? 'bg-green-600 text-white border-green-600'
                : 'bg-white text-gray-600 border-gray-300 hover:border-green-400'
            }`}
          >
            สร้างร้านค้าใหม่
          </button>
        </div>

        {mode === 'existing' ? (
          <select
            value={selectedStoreId}
            onChange={(e) => setSelectedStoreId(e.target.value === '' ? '' : Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="">-- เลือกร้านค้า --</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            value={newStoreName}
            onChange={(e) => setNewStoreName(e.target.value)}
            placeholder="ชื่อร้านค้าใหม่"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            autoFocus
          />
        )}

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!isValid}
            className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-40"
          >
            นำเข้า
          </button>
        </div>
      </div>
    </Modal>
  )
}
