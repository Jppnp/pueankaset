import { app, BrowserWindow } from 'electron'
import { mkdir, writeFile, copyFile, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { print as pdfPrint } from 'pdf-to-printer'
import type { ReceiptLine } from './receipt'
import type { PrinterConfig } from './config'
import { getPaperWidthMicrons } from './config'

export async function printSystemReceipt(lines: ReceiptLine[], config: PrinterConfig): Promise<void> {
  const window = new BrowserWindow({
    show: false,
    webPreferences: {
      sandbox: true,
      contextIsolation: true
    }
  })

  let pdfPath: string | null = null

  try {
    const html = buildReceiptHtml(lines, config)
    await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)

    // did-finish-load fires before paint completes; without this wait the PDF
    // surface can be captured mid-render and emit blank pages.
    const receiptHeightMicrons = await window.webContents.executeJavaScript(
      `(async () => {
        if (document.fonts && document.fonts.ready) { await document.fonts.ready }
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
        const receipt = document.querySelector('.receipt')
        if (!receipt) { return ${getEstimatedReceiptHeightMicrons(lines.length, config.paperWidthMm)} }
        const rect = receipt.getBoundingClientRect()
        const heightPx = Math.max(receipt.scrollHeight, rect.height)
        const heightMm = Math.ceil((heightPx * 25.4) / 96) + 2
        return Math.max(heightMm * 1000, ${(config.paperWidthMm + 2) * 1000})
      })()`
    ) as number

    // printToPDF's pageSize is in INCHES (Puppeteer-compatible API since
    // Electron 21), unlike webContents.print which uses microns. Mixing them
    // up produces a ~2km-square page with content rendered as a tiny dot.
    const pdf = await window.webContents.printToPDF({
      landscape: false,
      printBackground: true,
      margins: { marginType: 'none' },
      pageSize: {
        width: config.paperWidthMm / 25.4,
        height: receiptHeightMicrons / 25400
      }
    })

    pdfPath = join(tmpdir(), `pueankaset-receipt-${Date.now()}.pdf`)
    await writeFile(pdfPath, pdf)

    // Mirror the latest PDF into userData/printer-debug so the client can
    // share it for diagnosis if a print still comes out blank.
    try {
      const debugDir = join(app.getPath('userData'), 'printer-debug')
      await mkdir(debugDir, { recursive: true })
      await copyFile(pdfPath, join(debugDir, 'last-receipt.pdf'))
    } catch {
      // diagnostic copy is best-effort
    }

    if (process.platform === 'win32') {
      // Bypasses Electron's silent-print blank-page bug (electron/electron#39179)
      // by handing the PDF to SumatraPDF, which the bundled driver accepts.
      await pdfPrint(pdfPath, {
        printer: config.printerName || undefined,
        silent: true,
        orientation: 'portrait',
        scale: 'noscale',
        monochrome: true
      })
    } else {
      // pdf-to-printer ships SumatraPDF.exe only; fall back to Electron's
      // own print path on macOS/Linux dev environments.
      await new Promise<void>((resolve, reject) => {
        window.webContents.print(
          {
            silent: true,
            printBackground: true,
            deviceName: config.printerName || undefined,
            margins: { marginType: 'none' },
            landscape: false,
            dpi: { horizontal: 203, vertical: 203 },
            pageSize: {
              width: getPaperWidthMicrons(config),
              height: receiptHeightMicrons
            }
          },
          (success, failureReason) => {
            if (success) {
              resolve()
            } else {
              reject(new Error(failureReason || 'เครื่องพิมพ์ไม่ตอบสนอง'))
            }
          }
        )
      })
    }
  } finally {
    if (pdfPath) {
      await unlink(pdfPath).catch(() => {})
    }
    if (!window.isDestroyed()) {
      window.destroy()
    }
  }
}

function buildReceiptHtml(lines: ReceiptLine[], config: PrinterConfig): string {
  const widthMm = config.paperWidthMm
  const heightMm = Math.ceil(getEstimatedReceiptHeightMicrons(lines.length, widthMm) / 1000)
  const fontSize = widthMm === 80 ? 12 : 11
  const body = lines.map((line) => renderLine(line, config)).join('')

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @page { margin: 0; size: ${widthMm}mm ${heightMm}mm; }
    html, body { margin: 0; padding: 0; background: #fff; }
    body {
      color: #000;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    * {
      color: #000 !important;
      -webkit-font-smoothing: none;
      font-smooth: never;
      text-rendering: geometricPrecision;
    }
    .receipt {
      box-sizing: border-box;
      width: ${widthMm}mm;
      padding: 2mm 4mm 2mm 2mm;
      font-family: Tahoma, "IBM Plex Sans Thai", Sarabun, "Noto Sans Thai", Arial, sans-serif;
      font-size: ${fontSize}px;
      line-height: 1.35;
      font-weight: 700;
    }
    .line {
      white-space: pre-wrap;
      overflow-wrap: break-word;
      word-break: normal;
      line-break: loose;
    }
    .center { text-align: center; }
    .header {
      font-size: ${fontSize + 2}px;
      line-height: 1.25;
    }
    .bold { font-weight: 700; }
    .total {
      font-size: ${fontSize + 8}px;
      margin: 1mm 0;
    }
    .separator {
      font-family: "Courier New", monospace;
      font-size: ${fontSize + 1}px;
      line-height: 1.1;
      margin: 0.5mm 0;
      white-space: pre;
      overflow: hidden;
    }
    .item-row {
      display: flex;
      justify-content: space-between;
      gap: 1.5mm;
    }
    .item-row .left {
      flex: 1;
      min-width: 0;
    }
    .item-row .right {
      flex-shrink: 0;
      margin-left: auto;
      text-align: right;
      white-space: nowrap;
    }
    .item {
      margin: 1mm 0;
    }
    .item-name {
      font-size: ${fontSize + 1}px;
      line-height: 1.25;
      font-weight: 700;
    }
    .item-meta {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 2mm;
      padding-left: 1.5mm;
      font-size: ${fontSize}px;
      line-height: 1.25;
      font-weight: 700;
    }
    .item-meta .desc {
      flex: 1;
      min-width: 0;
      text-align: left;
      overflow-wrap: break-word;
      word-break: normal;
      font-weight: 400;
    }
    .item-meta .price {
      flex-shrink: 0;
      text-align: right;
      white-space: nowrap;
    }
    .item-meta .amount {
      white-space: nowrap;
      font-weight: 700;
    }
    .description {
      padding-left: 1.5mm;
      font-weight: 400;
    }
  </style>
</head>
<body>
  <div class="receipt">${body}</div>
</body>
</html>`
}

function renderLine(line: ReceiptLine, config: PrinterConfig): string {
  const classes = ['line']
  let content = line.content

  if (line.type === 'header' || line.type === 'footer') {
    classes.push('center')
  }
  if (line.type === 'header') {
    classes.push('header')
  }
  if (line.bold) {
    classes.push('bold')
  }
  if (line.type === 'total') {
    classes.push('total')
  }
  if (line.type === 'description') {
    classes.push('description')
  }
  if (line.type === 'separator') {
    const char = getSeparatorChar(line.content)
    content = char.repeat(config.charactersPerLine)
    classes.push('separator')
  }
  if (line.type === 'item') {
    const itemMeta = renderItemMeta(line.rightContent ?? '', line.description)
    return `<div class="item"><div class="line item-name">${escapeHtml(content)}</div>${itemMeta}</div>`
  }
  if (line.type === 'item-row') {
    classes.push('item-row')
    const right = line.rightContent ?? ''
    const eqIdx = right.lastIndexOf('= ')
    const rightHtml =
      eqIdx >= 0
        ? `${escapeHtml(right.slice(0, eqIdx + 2))}<strong>${escapeHtml(right.slice(eqIdx + 2))}</strong>`
        : escapeHtml(right)
    return `<div class="${classes.join(' ')}"><span class="left">${escapeHtml(content)}</span><span class="right">${rightHtml}</span></div>`
  }

  return `<div class="${classes.join(' ')}">${escapeHtml(content)}</div>`
}

function renderItemMeta(value: string, description?: string): string {
  const desc = description?.trim() ?? ''
  const eqIdx = value.lastIndexOf('= ')
  const priceHtml =
    eqIdx < 0
      ? escapeHtml(value)
      : `${escapeHtml(value.slice(0, eqIdx).trim())} <span class="amount">= ${escapeHtml(value.slice(eqIdx + 2).trim())}</span>`

  return [
    '<div class="line item-meta">',
    `<span class="desc">${escapeHtml(desc)}</span>`,
    `<span class="price">${priceHtml}</span>`,
    '</div>'
  ].join('')
}

function getSeparatorChar(content: string): string {
  if (content.includes('.')) return '.'
  if (content.includes('=')) return '='
  return '-'
}

function getEstimatedReceiptHeightMicrons(lineCount: number, paperWidthMm: number): number {
  // 5mm padding (CSS) + 4mm slack for the enlarged total line +
  // ~5.5mm per line at 12px/1.35 line-height. The tiny portrait minimum keeps
  // short PDFs from rotating without feeding a long blank tail after the footer.
  const measuredHeightMicrons = 9000 + lineCount * 5500
  const portraitMinimumMicrons = (paperWidthMm + 2) * 1000
  return Math.max(measuredHeightMicrons, portraitMinimumMicrons)
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
