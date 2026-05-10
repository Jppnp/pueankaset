import type { ReceiptLine } from './receipt'
import type { PrinterConfig } from './config'
import { promises as fs } from 'fs'
import net from 'net'

export async function printEscPos(lines: ReceiptLine[], config: PrinterConfig): Promise<void> {
  const data = buildEscPosBuffer(lines, config)

  if (config.mode === 'network') {
    await writeToNetworkPrinter(data, config.host, config.port)
    return
  }

  if (config.mode === 'device') {
    await writeToDevicePath(data, config.devicePath)
    return
  }

  throw new Error('โหมดเครื่องพิมพ์ไม่รองรับ ESC/POS')
}

function buildEscPosBuffer(lines: ReceiptLine[], config: PrinterConfig): Buffer {
  const parts: Buffer[] = []

  parts.push(Buffer.from([0x1b, 0x40])) // Initialize
  if (config.encoding === 'tis620') {
    parts.push(Buffer.from([0x1b, 0x74, config.codePage])) // Select code page
  }

  for (const line of lines) {
    const align = line.type === 'header' || line.type === 'footer' ? 1 : 0
    const content = formatContent(line, config.charactersPerLine)

    parts.push(Buffer.from([0x1b, 0x61, align]))
    parts.push(Buffer.from([0x1b, 0x45, line.bold ? 1 : 0]))
    parts.push(encodeText(content, config.encoding))
    parts.push(Buffer.from([0x0a]))
    parts.push(Buffer.from([0x1b, 0x45, 0]))
  }

  parts.push(Buffer.from([0x1b, 0x64, 0x03])) // Feed three lines
  if (config.cutPaper) {
    parts.push(Buffer.from([0x1d, 0x56, 0x42, 0x00])) // Partial cut
  }

  return Buffer.concat(parts)
}

function formatContent(line: ReceiptLine, width: number): string {
  if (line.type === 'separator') {
    const char = line.content.includes('=') ? '=' : '-'
    return char.repeat(width)
  }

  if (line.type === 'header' || line.type === 'footer') {
    return center(line.content, width)
  }

  if (line.type === 'item-row') {
    return justify(line.content, line.rightContent ?? '', width)
  }

  return line.content
}

function justify(left: string, right: string, width: number): string {
  if (left.length + right.length + 1 > width) {
    return `${left}\n${' '.repeat(Math.max(0, width - right.length))}${right}`
  }
  const gap = width - left.length - right.length
  return `${left}${' '.repeat(gap)}${right}`
}

function center(text: string, width: number): string {
  const padding = Math.max(0, Math.floor((width - text.length) / 2))
  return `${' '.repeat(padding)}${text}`
}

function encodeText(text: string, encoding: PrinterConfig['encoding']): Buffer {
  if (encoding === 'utf8') {
    return Buffer.from(text, 'utf8')
  }

  return Buffer.from(toTis620Bytes(text))
}

function toTis620Bytes(text: string): number[] {
  const bytes: number[] = []

  for (const char of text) {
    const codePoint = char.codePointAt(0) ?? 0x3f
    if (codePoint <= 0x7f) {
      bytes.push(codePoint)
    } else if (codePoint >= 0x0e01 && codePoint <= 0x0e5b) {
      bytes.push(codePoint - 0x0e01 + 0xa1)
    } else {
      bytes.push(0x3f)
    }
  }

  return bytes
}

function writeToNetworkPrinter(data: Buffer, host: string, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port })
    let settled = false

    const fail = (err: Error) => {
      if (settled) return
      settled = true
      socket.destroy()
      reject(err)
    }

    socket.setTimeout(5000, () => {
      fail(new Error('เชื่อมต่อเครื่องพิมพ์หมดเวลา'))
    })

    socket.on('error', fail)

    socket.on('connect', () => {
      socket.write(data, (err) => {
        if (err) {
          fail(err)
          return
        }

        settled = true
        socket.end()
        resolve()
      })
    })
  })
}

async function writeToDevicePath(data: Buffer, devicePath: string): Promise<void> {
  const handle = await fs.open(devicePath, 'w')
  try {
    await handle.writeFile(data)
  } finally {
    await handle.close()
  }
}
