import type { ReceiptLine } from './receipt'

export function printMock(lines: ReceiptLine[]): void {
  console.log('\n========== MOCK RECEIPT ==========')
  for (const line of lines) {
    if (line.bold) {
      console.log(`** ${line.content} **`)
    } else {
      console.log(line.content)
    }
  }
  console.log('========== END RECEIPT ===========\n')
}
