export interface ReceiptLine {
  type: 'header' | 'text' | 'item' | 'item-row' | 'description' | 'separator' | 'total' | 'footer'
  content: string
  rightContent?: string
  bold?: boolean
}

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

  lines.push({ type: 'header', content: 'เพื่อนเกษตร', bold: true })
  lines.push({ type: 'header', content: '0857331118' })
  lines.push({ type: 'separator', content: '================================' })
  lines.push({ type: 'text', content: `ใบเสร็จ #${sale.id}` })
  lines.push({ type: 'text', content: `วันที่: ${formatThaiDateTime(sale.date)}` })
  if (sale.customer_name) {
    lines.push({ type: 'text', content: `ลูกค้า: ${sale.customer_name}` })
  }
  lines.push({ type: 'separator', content: '--------------------------------' })

  for (const item of items) {
    const lineTotal = item.price * item.quantity
    lines.push({
      type: 'item-row',
      content: item.product_name,
      rightContent: `${item.quantity} x ${formatBaht(item.price)} = ${formatBaht(lineTotal)}`
    })
    const description = item.description?.trim()
    if (description) {
      lines.push({ type: 'description', content: description })
    }
  }

  lines.push({ type: 'separator', content: '================================' })

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

  lines.push({ type: 'separator', content: '--------------------------------' })
  lines.push({ type: 'footer', content: 'ขอบคุณที่อุดหนุน' })

  return lines
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
    hour12: false
  }).formatToParts(new Date(dateStr))
  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? ''
  const buddhistYear = Number(get('year')) + 543
  return `${get('day')}/${get('month')}/${buddhistYear} ${get('hour')}:${get('minute')}`
}
