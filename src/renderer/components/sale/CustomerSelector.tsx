import React, { useState, useEffect, useRef } from 'react'
import type { Customer } from '../../lib/types'

interface Props {
  selectedCustomer: Customer | null
  onSelect: (customer: Customer | null) => void
  canCreate?: boolean
}

export function CustomerSelector({ selectedCustomer, onSelect, canCreate = true }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Customer[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      return
    }
    const timer = setTimeout(async () => {
      const data = await window.api.getCustomers(query)
      setResults(data)
    }, 200)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (customer: Customer) => {
    onSelect(customer)
    setQuery('')
    setShowDropdown(false)
  }

  const handleClear = () => {
    onSelect(null)
    setQuery('')
  }

  const handleQuickAdd = async () => {
    if (!newName.trim()) return
    try {
      const customer = await window.api.createCustomer({
        name: newName.trim(),
        phone: newPhone.trim() || undefined
      })
      onSelect(customer)
      setShowQuickAdd(false)
      setNewName('')
      setNewPhone('')
      setQuery('')
      setShowDropdown(false)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด')
    }
  }

  if (selectedCustomer) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
        <span className="text-sm text-blue-800 font-medium flex-1">
          {selectedCustomer.name}
          {selectedCustomer.phone && (
            <span className="text-blue-500 ml-2 font-normal">{selectedCustomer.phone}</span>
          )}
        </span>
        <button
          onClick={handleClear}
          className="text-blue-400 hover:text-blue-600 text-sm"
        >
          ยกเลิก
        </button>
      </div>
    )
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setShowDropdown(true)
          }}
          onFocus={() => query.trim() && setShowDropdown(true)}
          placeholder="ค้นหาลูกค้า (ชื่อ/เบอร์โทร)..."
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        {canCreate && (
          <button
            onClick={() => setShowQuickAdd(true)}
            className="px-3 py-2 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors whitespace-nowrap"
          >
            + เพิ่มลูกค้า
          </button>
        )}
      </div>

      {showDropdown && results.length > 0 && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {results.map((c) => (
            <button
              key={c.id}
              onClick={() => handleSelect(c)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-green-50 transition-colors"
            >
              <span className="font-medium text-gray-900">{c.name}</span>
              {c.phone && <span className="text-gray-500 ml-2">{c.phone}</span>}
            </button>
          ))}
        </div>
      )}

      {showQuickAdd && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg p-3 space-y-2">
          <p className="text-sm font-medium text-gray-700">เพิ่มลูกค้าใหม่</p>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="ชื่อลูกค้า *"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            autoFocus
          />
          <input
            type="text"
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
            placeholder="เบอร์โทร (ไม่บังคับ)"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <div className="flex gap-2">
            <button
              onClick={() => { setShowQuickAdd(false); setNewName(''); setNewPhone('') }}
              className="flex-1 px-3 py-1.5 text-sm bg-gray-200 rounded-lg hover:bg-gray-300"
            >
              ยกเลิก
            </button>
            <button
              onClick={handleQuickAdd}
              disabled={!newName.trim()}
              className="flex-1 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              บันทึก
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
