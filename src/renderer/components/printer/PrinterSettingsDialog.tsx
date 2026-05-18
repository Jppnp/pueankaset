import React, { useEffect, useMemo, useState } from 'react'
import { Modal } from '../shared/Modal'
import { Button } from '../shared/Button'
import type { PrinterConfig, PrinterDevice, PrinterMode, PrinterTextEncoding } from '../../lib/types'

interface PrinterSettingsDialogProps {
  open: boolean
  onClose: () => void
}

const FALLBACK_CONFIG: PrinterConfig = {
  mode: 'mock',
  printerName: '',
  host: '',
  port: 9100,
  devicePath: '',
  paperWidthMm: 80,
  charactersPerLine: 48,
  encoding: 'tis620',
  codePage: 21,
  cutPaper: true
}

const modeOptions: { value: PrinterMode; label: string }[] = [
  { value: 'system', label: 'เครื่องพิมพ์ในระบบ' },
  { value: 'network', label: 'ESC/POS เครือข่าย' },
  { value: 'device', label: 'ESC/POS พาธอุปกรณ์' },
  { value: 'mock', label: 'ทดสอบใน Console' }
]

const paperOptions: { value: 58 | 80; label: string }[] = [
  { value: 58, label: '58 มม.' },
  { value: 80, label: '80 มม.' }
]

const RECEIPT_SHOP_NAME_KEY = 'receipt_shop_name'
const RECEIPT_SHOP_PHONE_KEY = 'receipt_shop_phone'
const DEFAULT_RECEIPT_SHOP_NAME = 'ก.เพื่อนเกษตร'
const DEFAULT_RECEIPT_SHOP_PHONE = '085-733-1118'

const selectClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500'
const inputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 caret-green-700 shadow-sm selection:bg-green-100 selection:text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500'

export function PrinterSettingsDialog({ open, onClose }: PrinterSettingsDialogProps) {
  const [config, setConfig] = useState<PrinterConfig>(FALLBACK_CONFIG)
  const [printers, setPrinters] = useState<PrinterDevice[]>([])
  const [shopName, setShopName] = useState(DEFAULT_RECEIPT_SHOP_NAME)
  const [shopPhone, setShopPhone] = useState(DEFAULT_RECEIPT_SHOP_PHONE)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const defaultPrinter = useMemo(() => printers.find((printer) => printer.isDefault), [printers])

  useEffect(() => {
    if (!open) return

    let cancelled = false
    setLoading(true)
    setMessage(null)

    Promise.all([
      window.api.getPrinterConfig(),
      window.api.listPrinters(),
      window.api.getSetting(RECEIPT_SHOP_NAME_KEY),
      window.api.getSetting(RECEIPT_SHOP_PHONE_KEY)
    ])
      .then(([nextConfig, nextPrinters, savedShopName, savedShopPhone]) => {
        if (cancelled) return
        setConfig(nextConfig)
        setPrinters(nextPrinters)
        setShopName(savedShopName ?? DEFAULT_RECEIPT_SHOP_NAME)
        setShopPhone(savedShopPhone ?? DEFAULT_RECEIPT_SHOP_PHONE)
      })
      .catch((err) => {
        if (cancelled) return
        const text = err instanceof Error ? err.message : 'โหลดการตั้งค่าเครื่องพิมพ์ไม่สำเร็จ'
        setMessage({ type: 'error', text })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [open])

  const updateConfig = (updates: Partial<PrinterConfig>) => {
    setConfig((current) => {
      const paperWidthMm = updates.paperWidthMm ?? current.paperWidthMm
      return {
        ...current,
        ...updates,
        charactersPerLine:
          updates.paperWidthMm && !updates.charactersPerLine
            ? paperWidthMm === 80
              ? 48
              : 32
            : updates.charactersPerLine ?? current.charactersPerLine
      }
    })
  }

  const handleRefreshPrinters = async () => {
    setLoading(true)
    setMessage(null)
    try {
      setPrinters(await window.api.listPrinters())
    } catch (err) {
      const text = err instanceof Error ? err.message : 'โหลดรายชื่อเครื่องพิมพ์ไม่สำเร็จ'
      setMessage({ type: 'error', text })
    } finally {
      setLoading(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    setMessage(null)
    try {
      const result = await window.api.testPrinter(config)
      setMessage(
        result.success
          ? { type: 'success', text: 'ส่งใบเสร็จทดสอบแล้ว' }
          : { type: 'error', text: result.error ?? 'ทดสอบพิมพ์ไม่สำเร็จ' }
      )
    } catch (err) {
      const text = err instanceof Error ? err.message : 'ทดสอบพิมพ์ไม่สำเร็จ'
      setMessage({ type: 'error', text })
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async () => {
    const trimmedShopName = shopName.trim()
    if (!trimmedShopName) {
      setMessage({ type: 'error', text: 'กรุณาระบุชื่อร้านบนใบเสร็จ' })
      return
    }

    setSaving(true)
    setMessage(null)
    try {
      const result = await window.api.savePrinterConfig(config)
      if (result.success && result.config) {
        await Promise.all([
          window.api.setSetting(RECEIPT_SHOP_NAME_KEY, trimmedShopName),
          window.api.setSetting(RECEIPT_SHOP_PHONE_KEY, shopPhone.trim())
        ])
        setConfig(result.config)
        setShopName(trimmedShopName)
        setShopPhone(shopPhone.trim())
        setMessage({ type: 'success', text: 'บันทึกการตั้งค่าแล้ว' })
      } else {
        setMessage({ type: 'error', text: result.error ?? 'บันทึกไม่สำเร็จ' })
      }
    } catch (err) {
      const text = err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ'
      setMessage({ type: 'error', text })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="ตั้งค่าเครื่องพิมพ์" width="max-w-xl">
      <div className="space-y-4">
        {message && (
          <div
            className={`rounded-lg border px-3 py-2 text-sm ${
              message.type === 'success'
                ? 'border-green-200 bg-green-50 text-green-700'
                : 'border-red-200 bg-red-50 text-red-700'
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-[1fr_180px] gap-3">
          <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1">ชื่อร้านบนใบเสร็จ</span>
            <input
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              className={inputClass}
              placeholder={DEFAULT_RECEIPT_SHOP_NAME}
            />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1">เบอร์โทร</span>
            <input
              value={shopPhone}
              onChange={(e) => setShopPhone(e.target.value)}
              className={inputClass}
              placeholder={DEFAULT_RECEIPT_SHOP_PHONE}
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1">โหมด</span>
            <div className="grid grid-cols-2 gap-2">
              {modeOptions.map((option) => {
                const selected = config.mode === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => updateConfig({ mode: option.value })}
                    disabled={loading}
                    className={`min-h-10 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      selected
                        ? 'border-green-600 bg-green-50 text-green-800 ring-2 ring-green-500'
                        : 'border-gray-300 bg-white text-gray-800 hover:bg-gray-50'
                    } disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
          </label>

          <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1">ขนาดกระดาษ</span>
            <div className="grid grid-cols-2 gap-2">
              {paperOptions.map((option) => {
                const selected = config.paperWidthMm === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => updateConfig({ paperWidthMm: option.value })}
                    disabled={loading}
                    className={`min-h-10 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      selected
                        ? 'border-green-600 bg-green-50 text-green-800 ring-2 ring-green-500'
                        : 'border-gray-300 bg-white text-gray-800 hover:bg-gray-50'
                    } disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
          </label>
        </div>

        {config.mode === 'system' && (
          <div className="space-y-2">
            <div className="flex items-end gap-2">
              <label className="block flex-1">
                <span className="block text-sm font-medium text-gray-700 mb-1">
                  เครื่องพิมพ์
                </span>
                <select
                  value={config.printerName}
                  onChange={(e) => updateConfig({ printerName: e.target.value })}
                  className={selectClass}
                  disabled={loading}
                >
                  <option value="" className="bg-white text-gray-900">
                    ค่าเริ่มต้น{defaultPrinter ? ` (${defaultPrinter.displayName})` : ''}
                  </option>
                  {printers.map((printer) => (
                    <option key={printer.name} value={printer.name} className="bg-white text-gray-900">
                      {printer.displayName}
                      {printer.isDefault ? ' *' : ''}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleRefreshPrinters}
                disabled={loading}
              >
                รีเฟรช
              </Button>
            </div>
          </div>
        )}

        {config.mode === 'network' && (
          <div className="grid grid-cols-[1fr_120px] gap-3">
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1">IP/โฮสต์</span>
              <input
                value={config.host}
                onChange={(e) => updateConfig({ host: e.target.value })}
                className={inputClass}
                placeholder="192.168.1.50"
              />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1">พอร์ต</span>
              <input
                type="number"
                min={1}
                max={65535}
                value={config.port}
                onChange={(e) => updateConfig({ port: Number(e.target.value) })}
                className={inputClass}
              />
            </label>
          </div>
        )}

        {config.mode === 'device' && (
          <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1">พาธเครื่องพิมพ์</span>
            <input
              value={config.devicePath}
              onChange={(e) => updateConfig({ devicePath: e.target.value })}
              className={inputClass}
              placeholder="/dev/usb/lp0 หรือ \\\\localhost\\Printer"
            />
          </label>
        )}

        {(config.mode === 'network' || config.mode === 'device') && (
          <div className="grid grid-cols-3 gap-3">
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1">ตัวอักษร/บรรทัด</span>
              <input
                type="number"
                min={20}
                max={80}
                value={config.charactersPerLine}
                onChange={(e) => updateConfig({ charactersPerLine: Number(e.target.value) })}
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1">Encoding</span>
              <select
                value={config.encoding}
                onChange={(e) =>
                  updateConfig({ encoding: e.target.value as PrinterTextEncoding })
                }
                className={selectClass}
              >
                <option value="tis620" className="bg-white text-gray-900">TIS-620</option>
                <option value="utf8" className="bg-white text-gray-900">UTF-8</option>
              </select>
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1">Code page</span>
              <input
                type="number"
                min={0}
                max={255}
                value={config.codePage}
                onChange={(e) => updateConfig({ codePage: Number(e.target.value) })}
                className={inputClass}
              />
            </label>
          </div>
        )}

        {(config.mode === 'network' || config.mode === 'device') && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.cutPaper}
              onChange={(e) => updateConfig({ cutPaper: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
            />
            <span className="text-sm text-gray-700">ตัดกระดาษหลังพิมพ์</span>
          </label>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            ปิด
          </Button>
          <Button type="button" variant="secondary" onClick={handleTest} disabled={testing || loading}>
            {testing ? 'กำลังทดสอบ...' : 'ทดสอบพิมพ์'}
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving || loading}>
            {saving ? 'กำลังบันทึก...' : 'บันทึก'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
