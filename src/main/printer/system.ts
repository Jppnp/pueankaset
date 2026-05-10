import { BrowserWindow } from 'electron'
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

  try {
    const html = buildReceiptHtml(lines, config)
    await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)

    await new Promise<void>((resolve, reject) => {
      window.webContents.print(
        {
          silent: true,
          printBackground: true,
          deviceName: config.printerName || undefined,
          margins: { marginType: 'none' },
          pageSize: {
            width: getPaperWidthMicrons(config),
            height: getReceiptHeightMicrons(lines.length)
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
  } finally {
    if (!window.isDestroyed()) {
      window.destroy()
    }
  }
}

function buildReceiptHtml(lines: ReceiptLine[], config: PrinterConfig): string {
  const widthMm = config.paperWidthMm
  const heightMm = Math.ceil(getReceiptHeightMicrons(lines.length) / 1000)
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
      padding: 3mm 3mm 5mm;
      font-family: Sarabun, Tahoma, Arial, sans-serif;
      font-size: ${fontSize}px;
      line-height: 1.35;
    }
    .line {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    .center { text-align: center; }
    .bold { font-weight: 700; }
    .total { font-size: ${fontSize + 2}px; }
    .separator {
      font-family: "Courier New", monospace;
      white-space: pre;
      overflow: hidden;
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
  if (line.bold) {
    classes.push('bold')
  }
  if (line.type === 'total') {
    classes.push('total')
  }
  if (line.type === 'separator') {
    const char = line.content.includes('=') ? '=' : '-'
    content = char.repeat(config.charactersPerLine)
    classes.push('separator')
  }

  return `<div class="${classes.join(' ')}">${escapeHtml(content)}</div>`
}

function getReceiptHeightMicrons(lineCount: number): number {
  return Math.max(80000, 30000 + lineCount * 5500)
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
