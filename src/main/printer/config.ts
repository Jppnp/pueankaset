import type Database from 'better-sqlite3'

export const PRINTER_CONFIG_SETTING_KEY = 'printer_config'

export type PrinterMode = 'mock' | 'system' | 'network' | 'device'
export type PrinterTextEncoding = 'tis620' | 'utf8'
export type PaperWidthMm = 58 | 80

export interface PrinterConfig {
  mode: PrinterMode
  printerName: string
  host: string
  port: number
  devicePath: string
  paperWidthMm: PaperWidthMm
  charactersPerLine: number
  encoding: PrinterTextEncoding
  codePage: number
  cutPaper: boolean
}

const DEFAULT_CONFIG: PrinterConfig = {
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

const printerModes: PrinterMode[] = ['mock', 'system', 'network', 'device']
const encodings: PrinterTextEncoding[] = ['tis620', 'utf8']

export function getDefaultPrinterConfig(mode: PrinterMode = 'mock'): PrinterConfig {
  return { ...DEFAULT_CONFIG, mode }
}

export function getPrinterConfig(db: Database.Database, defaultMode: PrinterMode): PrinterConfig {
  const row = db
    .prepare('SELECT value FROM app_settings WHERE key = ?')
    .get(PRINTER_CONFIG_SETTING_KEY) as { value: string } | undefined

  if (!row?.value) {
    return getDefaultPrinterConfig(defaultMode)
  }

  try {
    return normalizePrinterConfig(JSON.parse(row.value), defaultMode)
  } catch {
    return getDefaultPrinterConfig(defaultMode)
  }
}

export function savePrinterConfig(db: Database.Database, config: PrinterConfig): void {
  db.prepare(
    'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?'
  ).run(PRINTER_CONFIG_SETTING_KEY, JSON.stringify(config), JSON.stringify(config))
}

export function normalizePrinterConfig(input: unknown, defaultMode: PrinterMode): PrinterConfig {
  const raw = isRecord(input) ? input : {}
  const paperWidthMm = toPaperWidth(raw.paperWidthMm, raw.charactersPerLine)

  return {
    mode: toPrinterMode(raw.mode, defaultMode),
    printerName: toTrimmedString(raw.printerName),
    host: toTrimmedString(raw.host),
    port: toInteger(raw.port, DEFAULT_CONFIG.port),
    devicePath: toTrimmedString(raw.devicePath),
    paperWidthMm,
    charactersPerLine: toInteger(
      normalizeCharactersPerLine(raw.charactersPerLine, paperWidthMm),
      paperWidthMm === 80 ? 48 : 32
    ),
    encoding: toEncoding(raw.encoding),
    codePage: toInteger(raw.codePage, DEFAULT_CONFIG.codePage),
    cutPaper: toBoolean(raw.cutPaper, DEFAULT_CONFIG.cutPaper)
  }
}

export function validatePrinterConfig(config: PrinterConfig): void {
  if (config.mode === 'network') {
    if (!config.host) {
      throw new Error('กรุณาระบุ IP หรือชื่อโฮสต์ของเครื่องพิมพ์')
    }
    if (config.port < 1 || config.port > 65535) {
      throw new Error('พอร์ตเครื่องพิมพ์ต้องอยู่ระหว่าง 1-65535')
    }
  }

  if (config.mode === 'device' && !config.devicePath) {
    throw new Error('กรุณาระบุพาธเครื่องพิมพ์')
  }

  if (config.charactersPerLine < 20 || config.charactersPerLine > 80) {
    throw new Error('จำนวนตัวอักษรต่อบรรทัดต้องอยู่ระหว่าง 20-80')
  }

  if (config.codePage < 0 || config.codePage > 255) {
    throw new Error('รหัส code page ต้องอยู่ระหว่าง 0-255')
  }
}

export function getPaperWidthMicrons(config: PrinterConfig): number {
  return config.paperWidthMm * 1000
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function toTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function toInteger(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value)
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return Math.round(parsed)
  }
  return fallback
}

function toBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function toPrinterMode(value: unknown, fallback: PrinterMode): PrinterMode {
  return typeof value === 'string' && printerModes.includes(value as PrinterMode)
    ? (value as PrinterMode)
    : fallback
}

function toEncoding(value: unknown): PrinterTextEncoding {
  return typeof value === 'string' && encodings.includes(value as PrinterTextEncoding)
    ? (value as PrinterTextEncoding)
    : DEFAULT_CONFIG.encoding
}

function toPaperWidth(value: unknown, charactersPerLine: unknown): PaperWidthMm {
  if (value === 80 || value === '80') return 80
  if (value === 58 || value === '58') {
    return isLegacyDefaultPaperConfig(charactersPerLine) ? DEFAULT_CONFIG.paperWidthMm : 58
  }
  return DEFAULT_CONFIG.paperWidthMm
}

function normalizeCharactersPerLine(value: unknown, paperWidthMm: PaperWidthMm): unknown {
  if (paperWidthMm === 80 && isLegacyDefaultPaperConfig(value)) return 48
  return value
}

function isLegacyDefaultPaperConfig(charactersPerLine: unknown): boolean {
  return charactersPerLine === undefined || charactersPerLine === 32 || charactersPerLine === '32'
}
