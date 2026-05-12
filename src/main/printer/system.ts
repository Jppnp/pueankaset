import { app, BrowserWindow } from 'electron'
import { mkdir, writeFile, copyFile, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { print as pdfPrint } from 'pdf-to-printer'
import type { ReceiptLine } from './receipt'
import type { PrinterConfig } from './config'
import { getPaperWidthMicrons } from './config'

const MM_PER_INCH = 25.4
const SCREEN_DPI = 96
const PDF_HEIGHT_SLACK_MM = 10

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
    await loadReceiptHtml(
      window,
      buildReceiptHtml(lines, config, getMeasurementPageHeightMm(lines, config.paperWidthMm))
    )
    const receiptHeightMm = await measureReceiptHeightMm(window, lines, config.paperWidthMm)
    const receiptHeightMicrons = receiptHeightMm * 1000

    // The final HTML must use the measured page height too. Leaving @page at
    // the early estimate lets Chromium paginate long receipts before the
    // custom PDF size is applied, which can split the footer onto a new page.
    await loadReceiptHtml(window, buildReceiptHtml(lines, config, receiptHeightMm))

    // printToPDF's pageSize is in INCHES (Puppeteer-compatible API since
    // Electron 21), unlike webContents.print which uses microns. Mixing them
    // up produces a ~2km-square page with content rendered as a tiny dot.
    const pdf = await window.webContents.printToPDF({
      landscape: false,
      printBackground: true,
      preferCSSPageSize: true,
      margins: { marginType: 'none' },
      pageSize: {
        width: config.paperWidthMm / MM_PER_INCH,
        height: receiptHeightMm / MM_PER_INCH
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

async function loadReceiptHtml(window: BrowserWindow, html: string): Promise<void> {
  await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  await waitForReceiptPaint(window)
}

async function waitForReceiptPaint(window: BrowserWindow): Promise<void> {
  // did-finish-load fires before paint completes; without this wait the PDF
  // surface can be captured mid-render and emit blank pages.
  await window.webContents.executeJavaScript(
    `(async () => {
      if (document.fonts && document.fonts.ready) { await document.fonts.ready }
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
    })()`
  )
}

async function measureReceiptHeightMm(
  window: BrowserWindow,
  lines: ReceiptLine[],
  paperWidthMm: number
): Promise<number> {
  const fallbackHeightMm = getEstimatedReceiptHeightMm(lines.length, paperWidthMm)
  const heightPx = (await window.webContents.executeJavaScript(
    `(() => {
      const receipt = document.querySelector('.receipt')
      if (!receipt) { return 0 }
      const rect = receipt.getBoundingClientRect()
      return Math.max(
        receipt.scrollHeight,
        receipt.clientHeight,
        rect.height
      )
    })()`
  )) as number

  if (!Number.isFinite(heightPx) || heightPx <= 0) {
    return fallbackHeightMm
  }

  const measuredHeightMm = Math.ceil((heightPx * MM_PER_INCH) / SCREEN_DPI) + PDF_HEIGHT_SLACK_MM
  return Math.max(measuredHeightMm, fallbackHeightMm, paperWidthMm + 2)
}

function getMeasurementPageHeightMm(lines: ReceiptLine[], paperWidthMm: number): number {
  return Math.max(getEstimatedReceiptHeightMm(lines.length, paperWidthMm) * 2, 300)
}

function buildReceiptHtml(lines: ReceiptLine[], config: PrinterConfig, pageHeightMm: number): string {
  const widthMm = config.paperWidthMm
  const fontSize = widthMm === 80 ? 12 : 11
  const body = lines.map((line) => renderLine(line, config)).join('')

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @page { margin: 0; size: ${widthMm}mm ${pageHeightMm}mm; }
    html, body {
      margin: 0;
      padding: 0;
      width: ${widthMm}mm;
      min-height: ${pageHeightMm}mm;
      background: #fff;
    }
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
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .line {
      white-space: pre-wrap;
      overflow-wrap: break-word;
      word-break: normal;
      line-break: loose;
    }
    .center { text-align: center; }
    .header {
      font-size: ${fontSize + 6}px;
      line-height: 1.25;
    }
    .bold { font-weight: 700; }
    .total {
      font-size: ${fontSize + 6}px;
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
    .item.inline {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 2mm;
    }
    .item-name {
      font-size: ${fontSize + 1}px;
      line-height: 1.25;
      font-weight: 700;
    }
    .item.inline .item-name {
      flex: 1;
      min-width: 0;
    }
    .item-meta {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 2mm;
      padding-left: 1.5mm;
      font-size: ${fontSize}px;
      line-height: 1.25;
      font-weight: 400;
    }
    .item-meta .desc {
      flex: 1;
      min-width: 0;
      text-align: left;
      overflow-wrap: break-word;
      word-break: normal;
    }
    .price {
      flex-shrink: 0;
      text-align: right;
      white-space: nowrap;
      font-size: ${fontSize}px;
      font-weight: 400;
    }
    .amount {
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

  if (line.type === 'header' || line.type === 'subheader' || line.type === 'footer') {
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
    const description = line.description?.trim() ?? ''
    const priceHtml = renderPriceBlock(line.rightContent ?? '')

    if (!description) {
      return [
        '<div class="item inline">',
        `<div class="item-name">${escapeHtml(content)}</div>`,
        `<div class="price">${priceHtml}</div>`,
        '</div>'
      ].join('')
    }

    return [
      '<div class="item">',
      `<div class="line item-name">${escapeHtml(content)}</div>`,
      '<div class="line item-meta">',
      `<span class="desc">${escapeHtml(description)}</span>`,
      `<span class="price">${priceHtml}</span>`,
      '</div>',
      '</div>'
    ].join('')
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

function renderPriceBlock(value: string): string {
  const eqIdx = value.lastIndexOf('= ')
  if (eqIdx < 0) return escapeHtml(value)
  return `${escapeHtml(value.slice(0, eqIdx).trim())} <span class="amount">= ${escapeHtml(value.slice(eqIdx + 2).trim())}</span>`
}

function getSeparatorChar(content: string): string {
  if (content.includes('.')) return '.'
  if (content.includes('=')) return '='
  return '-'
}

function getEstimatedReceiptHeightMm(lineCount: number, paperWidthMm: number): number {
  // 5mm padding (CSS) + 4mm slack for the enlarged total line +
  // ~5.5mm per line at 12px/1.35 line-height. The tiny portrait minimum keeps
  // short PDFs from rotating without feeding a long blank tail after the footer.
  const measuredHeightMm = 9 + lineCount * 5.5
  const portraitMinimumMm = paperWidthMm + 2
  return Math.ceil(Math.max(measuredHeightMm, portraitMinimumMm))
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
