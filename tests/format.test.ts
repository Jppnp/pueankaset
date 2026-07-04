import { describe, it, expect } from 'vitest'
import {
  calcCardFee,
  formatBaht,
  formatPaymentType,
  formatDeliveryStatus,
  formatThaiDate,
  formatThaiDateShort,
  toISODate,
  localDayRangeUtc,
  localRangeUtc,
  monthRange
} from '../src/renderer/lib/format'

describe('calcCardFee', () => {
  it('charges the percentage rounded up to the nearest 10 baht', () => {
    expect(calcCardFee(1000, 5)).toBe(50)
    expect(calcCardFee(1010, 5)).toBe(60) // 50.50 → 60
    expect(calcCardFee(100, 5)).toBe(10) // 5 → 10
    expect(calcCardFee(1, 5)).toBe(10) // minimum step is 10
  })

  it('defaults to 5%', () => {
    expect(calcCardFee(2000)).toBe(100)
  })

  it('returns 0 for a zero total or zero percent', () => {
    expect(calcCardFee(0, 5)).toBe(0)
    expect(calcCardFee(1000, 0)).toBe(0)
  })
})

describe('formatBaht', () => {
  it('formats with thousands separators and two decimals', () => {
    expect(formatBaht(1234.5)).toBe('฿1,234.50')
    expect(formatBaht(0)).toBe('฿0.00')
    expect(formatBaht(1500000)).toBe('฿1,500,000.00')
  })
})

describe('payment and delivery labels', () => {
  it('maps payment types to Thai labels, defaulting to cash', () => {
    expect(formatPaymentType('card')).toBe('บัตร')
    expect(formatPaymentType('transfer')).toBe('โอนเงิน')
    expect(formatPaymentType('credit')).toBe('เชื่อ')
    expect(formatPaymentType('cash')).toBe('เงินสด')
    expect(formatPaymentType(null)).toBe('เงินสด')
  })

  it('maps delivery statuses to Thai labels, defaulting to pickup', () => {
    expect(formatDeliveryStatus('waiting')).toBe('รอจัดส่ง')
    expect(formatDeliveryStatus('shipped')).toBe('จัดส่งแล้ว')
    expect(formatDeliveryStatus(undefined)).toBe('รับหน้าร้าน')
  })
})

describe('Thai (Buddhist Era) date formatting', () => {
  // SQLite stores datetime('now') as UTC; display is Asia/Bangkok (UTC+7).
  it('renders stored UTC timestamps as Bangkok wall-clock with BE year', () => {
    expect(formatThaiDate('2026-05-18 06:47:26')).toBe('18/05/2569 13:47')
  })

  it('crosses the date boundary when UTC evening is Bangkok morning', () => {
    expect(formatThaiDateShort('2026-05-17 18:30:00')).toBe('18/05/2569')
  })

  it('converts the Gregorian year to Buddhist Era (+543)', () => {
    expect(formatThaiDateShort('2026-01-01')).toBe('01/01/2569')
  })
})

describe('date range helpers (Bangkok day → UTC SQL bounds)', () => {
  it('maps a local calendar day to UTC bounds shifted by -7h', () => {
    expect(localDayRangeUtc('2026-05-18')).toEqual({
      from: '2026-05-17 17:00:00',
      to: '2026-05-18 16:59:59'
    })
  })

  it('spans multiple local days', () => {
    expect(localRangeUtc('2026-05-01', '2026-05-31')).toEqual({
      from: '2026-04-30 17:00:00',
      to: '2026-05-31 16:59:59'
    })
  })

  it('computes month bounds including leap February', () => {
    expect(monthRange(2028, 1)).toEqual({
      from: '2028-01-31 17:00:00',
      to: '2028-02-29 16:59:59'
    })
  })

  it('toISODate uses local date parts', () => {
    expect(toISODate(new Date(2026, 4, 18, 9, 30))).toBe('2026-05-18')
  })
})
