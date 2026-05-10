import type { ReceiptLine } from './receipt'

export function printMock(lines: ReceiptLine[]): void {
  console.log('\n========== MOCK RECEIPT ==========')
  for (const line of lines) {
    const text =
      line.type === 'item-row' && line.rightContent
        ? `${line.content}   ${line.rightContent}`
        : line.content
    if (line.bold) {
      console.log(`** ${text} **`)
    } else {
      console.log(text)
    }
  }
  console.log('========== END RECEIPT ===========\n')
}
