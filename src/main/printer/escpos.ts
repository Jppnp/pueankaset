import type { ReceiptLine } from './receipt'

// Placeholder for Phase 6 - Real ESC/POS USB printer
export async function printEscPos(_lines: ReceiptLine[]): Promise<void> {
  throw new Error('ESC/POS printer not yet implemented')
}
