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
    await window.webContents.executeJavaScript(
      `(async () => {
        if (document.fonts && document.fonts.ready) { await document.fonts.ready }
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
      })()`
    )

    // printToPDF's pageSize is in INCHES (Puppeteer-compatible API since
    // Electron 21), unlike webContents.print which uses microns. Mixing them
    // up produces a ~2km-square page with content rendered as a tiny dot.
    const pdf = await window.webContents.printToPDF({
      landscape: false,
      printBackground: true,
      margins: { marginType: 'none' },
      pageSize: {
        width: config.paperWidthMm / 25.4,
        height: getReceiptHeightMicrons(lines.length, config.paperWidthMm) / 25400
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
        scale: 'noscale'
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
              height: getReceiptHeightMicrons(lines.length, config.paperWidthMm)
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
  const heightMm = Math.ceil(getReceiptHeightMicrons(lines.length, widthMm) / 1000)
  const fontSize = widthMm === 80 ? 12 : 10
  const body = lines.map((line) => renderLine(line, config)).join('')

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @page { margin: 0; size: ${widthMm}mm ${heightMm}mm; }
    html, body { margin: 0; padding: 0; background: #fff; }
    body { color: #000; }
    .receipt {
      box-sizing: border-box;
      width: ${widthMm}mm;
      padding: 3mm 3mm 2mm;
      font-family: Sarabun, Tahoma, Arial, sans-serif;
      font-size: ${fontSize}px;
      line-height: 1.35;
    }
    .line {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
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
      gap: 4mm;
    }
    .item-row .right {
      flex-shrink: 0;
      white-space: nowrap;
    }
    .description {
      color: #666;
      padding-left: 3mm;
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

function getSeparatorChar(content: string): string {
  if (content.includes('.')) return '.'
  if (content.includes('=')) return '='
  return '-'
}

function getReceiptHeightMicrons(lineCount: number, paperWidthMm: number): number {
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
