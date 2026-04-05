export interface ReceiptLine {
  type: 'header' | 'text' | 'item' | 'separator' | 'total' | 'footer'
  content: string
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
  items: { product_name: string; quantity: number; price: number }[]
): ReceiptLine[] {
  const lines: ReceiptLine[] = []

  lines.push({ type: 'header', content: 'เพื่อนเกษตร', bold: true })
  lines.push({ type: 'text', content: '0857331118' })
  lines.push({ type: 'separator', content: '================================' })
  lines.push({ type: 'text', content: `ใบเสร็จ #${sale.id}` })
  lines.push({ type: 'text', content: `วันที่: ${formatThaiDate(sale.date)}` })
  if (sale.customer_name) {
    lines.push({ type: 'text', content: `ลูกค้า: ${sale.customer_name}` })
  }
  lines.push({ type: 'separator', content: '--------------------------------' })

  for (const item of items) {
    const lineTotal = item.price * item.quantity
    lines.push({
      type: 'item',
      content: `${item.product_name}`
    })
    lines.push({
      type: 'item',
      content: `  ${item.quantity} x ${formatBaht(item.price)} = ${formatBaht(lineTotal)}`
    })
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

function formatThaiDate(dateStr: string): string {
  const date = new Date(dateStr)
  const buddhistYear = date.getFullYear() + 543
  const day = date.getDate().toString().padStart(2, '0')
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  return `${day}/${month}/${buddhistYear}`
}
