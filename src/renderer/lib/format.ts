// Calculate card fee: 5% of total, rounded up to nearest 10
export function calcCardFee(total: number): number {
  const raw = total * 0.05
  return Math.ceil(raw / 10) * 10
}

export function formatBaht(amount: number): string {
  return `฿${amount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatThaiDate(dateStr: string): string {
  const date = new Date(dateStr)
  const buddhistYear = date.getFullYear() + 543
  const day = date.getDate().toString().padStart(2, '0')
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  return `${day}/${month}/${buddhistYear} ${hours}:${minutes}`
}

export function formatThaiDateShort(dateStr: string): string {
  const date = new Date(dateStr)
  const buddhistYear = date.getFullYear() + 543
  const day = date.getDate().toString().padStart(2, '0')
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  return `${day}/${month}/${buddhistYear}`
}

const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน',
  'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม',
  'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
]

export function formatThaiDateLong(dateStr: string): string {
  const date = new Date(dateStr)
  const buddhistYear = date.getFullYear() + 543
  const day = date.getDate()
  const month = THAI_MONTHS[date.getMonth()]
  return `${day} ${month} ${buddhistYear}`
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
