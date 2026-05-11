// Calculate card fee: percentage of total, rounded up to nearest 10
export function calcCardFee(total: number, percent: number = 5): number {
  const raw = total * (percent / 100)
  return Math.ceil(raw / 10) * 10
}

export function formatBaht(amount: number): string {
  return `฿${amount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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

export function todayRange(): { from: string; to: string } {
  const today = toISODate(new Date())
  return { from: `${today} 00:00:00`, to: `${today} 23:59:59` }
}

export function monthRange(year: number, month: number): { from: string; to: string } {
  const lastDay = new Date(year, month + 1, 0).getDate()
  const mm = (month + 1).toString().padStart(2, '0')
  return {
    from: `${year}-${mm}-01 00:00:00`,
    to: `${year}-${mm}-${lastDay.toString().padStart(2, '0')} 23:59:59`
  }
}

export function thisMonthRange(): { from: string; to: string } {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const lastDay = new Date(year, month + 1, 0).getDate()
  const mm = (month + 1).toString().padStart(2, '0')
  return {
    from: `${year}-${mm}-01 00:00:00`,
    to: `${year}-${mm}-${lastDay.toString().padStart(2, '0')} 23:59:59`
  }
}
