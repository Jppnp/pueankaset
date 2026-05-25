// Calculate card fee: percentage of total, rounded up to nearest 10
export function calcCardFee(total: number, percent: number = 5): number {
  const raw = total * (percent / 100)
  return Math.ceil(raw / 10) * 10
}

export function formatBaht(amount: number): string {
  return `฿${amount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatPaymentType(paymentType: string | null | undefined): string {
  switch (paymentType) {
    case 'card':
      return 'บัตร'
    case 'transfer':
      return 'โอนเงิน'
    case 'credit':
      return 'เชื่อ'
    case 'cash':
    default:
      return 'เงินสด'
  }
}

export function formatDeliveryStatus(deliveryStatus: string | null | undefined): string {
  switch (deliveryStatus) {
    case 'waiting':
      return 'รอจัดส่ง'
    case 'shipped':
      return 'จัดส่งแล้ว'
    case 'none':
    default:
      return 'รับหน้าร้าน'
  }
}

export function formatThaiDate(dateStr: string): string {
  const parts = getThaiDateParts(dateStr, true)
  return `${parts.day}/${parts.month}/${parts.buddhistYear} ${parts.hour}:${parts.minute}`
}

export function formatThaiDateShort(dateStr: string): string {
  const parts = getThaiDateParts(dateStr)
  return `${parts.day}/${parts.month}/${parts.buddhistYear}`
}

export const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน',
  'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม',
  'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
]

export function formatThaiDateLong(dateStr: string): string {
  const parts = getThaiDateParts(dateStr)
  const month = THAI_MONTHS[Number(parts.month) - 1]
  return `${Number(parts.day)} ${month} ${parts.buddhistYear}`
}

function getThaiDateParts(
  dateStr: string,
  includeTime = false
): { day: string; month: string; buddhistYear: number; hour: string; minute: string } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...(includeTime
      ? {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }
      : {})
  }).formatToParts(parseStoredDate(dateStr))
  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? ''

  return {
    day: get('day'),
    month: get('month'),
    buddhistYear: Number(get('year')) + 543,
    hour: get('hour'),
    minute: get('minute')
  }
}

function parseStoredDate(dateStr: string): Date {
  const value = dateStr.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00Z`)
  }
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(value)) {
    return new Date(`${value.replace(' ', 'T')}Z`)
  }
  return new Date(dateStr)
}

export function toISODate(date: Date): string {
  const year = date.getFullYear()
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Asia/Bangkok is UTC+7 year-round (no DST).
const THAI_OFFSET_MS = 7 * 60 * 60 * 1000

function pad2(n: number): string {
  return n.toString().padStart(2, '0')
}

// Convert a Thai-local "YYYY-MM-DD HH:MM:SS" wall-clock string into the UTC
// "YYYY-MM-DD HH:MM:SS" form that SQLite's datetime('now') produces, so it can
// be compared against stored UTC timestamps with plain string >=/<=.
function thaiLocalToUtcSql(local: string): string {
  const asUtc = new Date(`${local.replace(' ', 'T')}Z`)
  const utc = new Date(asUtc.getTime() - THAI_OFFSET_MS)
  return (
    `${utc.getUTCFullYear()}-${pad2(utc.getUTCMonth() + 1)}-${pad2(utc.getUTCDate())} ` +
    `${pad2(utc.getUTCHours())}:${pad2(utc.getUTCMinutes())}:${pad2(utc.getUTCSeconds())}`
  )
}

// Build UTC SQL bounds for a Thai-local calendar day ("YYYY-MM-DD").
export function localDayRangeUtc(localDay: string): { from: string; to: string } {
  return {
    from: thaiLocalToUtcSql(`${localDay} 00:00:00`),
    to: thaiLocalToUtcSql(`${localDay} 23:59:59`)
  }
}

// Build UTC SQL bounds spanning multiple Thai-local calendar days.
export function localRangeUtc(fromDay: string, toDay: string): { from: string; to: string } {
  return {
    from: thaiLocalToUtcSql(`${fromDay} 00:00:00`),
    to: thaiLocalToUtcSql(`${toDay} 23:59:59`)
  }
}

export function todayRange(): { from: string; to: string } {
  return localDayRangeUtc(toISODate(new Date()))
}

export function yesterdayRange(): { from: string; to: string } {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  return localDayRangeUtc(toISODate(yesterday))
}

export function monthRange(year: number, month: number): { from: string; to: string } {
  const lastDay = new Date(year, month + 1, 0).getDate()
  const mm = pad2(month + 1)
  return localRangeUtc(`${year}-${mm}-01`, `${year}-${mm}-${pad2(lastDay)}`)
}

export function thisMonthRange(): { from: string; to: string } {
  const now = new Date()
  return monthRange(now.getFullYear(), now.getMonth())
}
