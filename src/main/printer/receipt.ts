export interface ReceiptLine {
  type: 'header' | 'text' | 'item' | 'item-row' | 'description' | 'separator' | 'total' | 'footer'
  content: string
  rightContent?: string
  description?: string
  bold?: boolean
}

const SHOP_NAME = 'ก.เพื่อนเกษตร'
const SHOP_PHONE = '085-733-1118'
const DOTTED_SEPARATOR = '................................'

export function buildReceipt(
  sale: {
    id: number
    date: string
    total_amount: number
    remark: string | null
    customer_name?: string
    payment_type?: string
  },
  items: {
    product_name: string
    description?: string | null
    quantity: number
    price: number
  }[]
): ReceiptLine[] {
  const lines: ReceiptLine[] = []

  lines.push({ type: 'header', content: SHOP_NAME, bold: true })
  lines.push({ type: 'header', content: SHOP_PHONE, bold: true })
  lines.push({ type: 'header', content: 'ใบเสร็จรับเงิน' })
  lines.push({ type: 'header', content: `รายการที่ #${sale.id}`, bold: true })
  lines.push({ type: 'header', content: formatThaiDateTime(sale.date) })
  if (sale.customer_name) {
    lines.push({ type: 'text', content: `ลูกค้า: ${sale.customer_name}` })
  }
  lines.push({ type: 'separator', content: DOTTED_SEPARATOR })

  for (const item of items) {
    const lineTotal = item.price * item.quantity
    lines.push({
      type: 'item',
      content: item.product_name,
      rightContent: `${item.quantity} x ${formatBaht(item.price)} = ${formatBaht(lineTotal)}`,
      description: item.description?.trim() || undefined
    })
  }

  lines.push({ type: 'separator', content: DOTTED_SEPARATOR })

  const itemsSubtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0)
  const cardFee = sale.total_amount - itemsSubtotal

  if (cardFee > 0) {
    lines.push({ type: 'text', content: `ยอดสินค้า: ${formatBaht(itemsSubtotal)}` })
    lines.push({ type: 'text', content: `ค่าบริการชำระบัตร: ${formatBaht(cardFee)}` })
  }

  lines.push({
    type: 'total',
    content: `รวม: ${formatBaht(sale.total_amount)}`,
    bold: true
  })

  if (sale.payment_type === 'credit') {
    lines.push({ type: 'text', content: '** เชื่อ **', bold: true })
  } else if (sale.payment_type === 'card') {
    lines.push({ type: 'text', content: 'ชำระบัตร' })
  }

  if (sale.remark) {
    lines.push({ type: 'text', content: `หมายเหตุ: ${sale.remark}` })
  }

  lines.push({ type: 'separator', content: DOTTED_SEPARATOR })
  lines.push({ type: 'footer', content: 'ขอบคุณที่อุดหนุน' })

  return lines
}

export interface DebtReceiptSale {
  id: number
  date: string
  total_amount: number
  items: {
    product_name: string
    description?: string | null
    quantity: number
    price: number
  }[]
  appliedPayments: { date: string; amount: number; note?: string | null }[]
  remaining: number
}

export function buildDebtReceipt(
  customer: { name: string; phone?: string | null },
  sales: DebtReceiptSale[],
  outstandingTotal: number
): ReceiptLine[] {
  const lines: ReceiptLine[] = []

  lines.push({ type: 'header', content: SHOP_NAME, bold: true })
  lines.push({ type: 'header', content: SHOP_PHONE, bold: true })
  lines.push({ type: 'header', content: 'ใบสรุปยอดค้างชำระ', bold: true })
  lines.push({ type: 'header', content: formatThaiDateTime(new Date().toISOString()) })
  lines.push({ type: 'separator', content: DOTTED_SEPARATOR })
  lines.push({ type: 'text', content: `ลูกค้า: ${customer.name}` })
  if (customer.phone) {
    lines.push({ type: 'text', content: `โทร: ${customer.phone}` })
  }
  lines.push({ type: 'separator', content: DOTTED_SEPARATOR })

  if (sales.length === 0) {
    lines.push({ type: 'text', content: 'ไม่มีรายการค้างชำระ' })
  } else {
    sales.forEach((sale, index) => {
      if (index > 0) {
        lines.push({ type: 'separator', content: DOTTED_SEPARATOR })
      }
      lines.push({
        type: 'item-row',
        content: `#${sale.id} ${formatThaiDate(sale.date)}`,
        rightContent: formatBaht(sale.total_amount),
        bold: true
      })

      for (const item of sale.items) {
        const lineTotal = item.price * item.quantity
        lines.push({
          type: 'item-row',
          content: `  ${item.product_name} x${item.quantity}`,
          rightContent: formatBaht(lineTotal)
        })
        const description = item.description?.trim()
        if (description) {
          lines.push({ type: 'description', content: description })
        }
      }

      if (sale.appliedPayments.length === 0) {
        lines.push({ type: 'text', content: '  (ยังไม่มีการชำระ)' })
      } else {
        for (const payment of sale.appliedPayments) {
          lines.push({
            type: 'item-row',
            content: `  ชำระ ${formatThaiDate(payment.date)}`,
            rightContent: `-${formatBaht(payment.amount)}`
          })
        }
      }

      lines.push({
        type: 'item-row',
        content: '  ค้าง',
        rightContent: formatBaht(sale.remaining),
        bold: true
      })
    })
  }

  lines.push({ type: 'separator', content: DOTTED_SEPARATOR })
  lines.push({
    type: 'total',
    content: `ค้างรวมทั้งสิ้น: ${formatBaht(outstandingTotal)}`,
    bold: true
  })
  lines.push({ type: 'separator', content: DOTTED_SEPARATOR })
  lines.push({ type: 'footer', content: 'ขอบคุณที่อุดหนุน' })

  return lines
}

function formatThaiDate(dateStr: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(parseStoredDate(dateStr))
  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? ''
  const buddhistYear = Number(get('year')) + 543
  return `${get('day')}/${get('month')}/${buddhistYear}`
}

function formatBaht(amount: number): string {
  return `฿${amount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatThaiDateTime(dateStr: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(parseStoredDate(dateStr))
  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? ''
  const buddhistYear = Number(get('year')) + 543
  return `${Number(get('day'))}/${Number(get('month'))}/${buddhistYear} ${get('hour')}:${get('minute')}:${get('second')}`
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
