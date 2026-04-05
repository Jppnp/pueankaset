import { ipcMain } from 'electron'
import { getDb } from '../database'
import { scryptSync, randomBytes, timingSafeEqual } from 'crypto'

const SALT_LENGTH = 16
const KEY_LENGTH = 64
const MAX_ATTEMPTS = 5
const LOCK_DURATION_MS = 30_000

// In-memory rate limiting
let failedAttempts = 0
let lockUntil = 0

function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const s = salt ?? randomBytes(SALT_LENGTH).toString('hex')
  const hash = scryptSync(password, s, KEY_LENGTH).toString('hex')
  return { hash, salt: s }
}

function verifyPassword(password: string, stored: string): boolean {
  // stored format: "salt:hash"
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const derived = scryptSync(password, salt, KEY_LENGTH)
  const expected = Buffer.from(hash, 'hex')
  if (derived.length !== expected.length) return false
  return timingSafeEqual(derived, expected)
}

function getStoredPassword(db: ReturnType<typeof getDb>): string {
  const row = db
    .prepare("SELECT value FROM app_settings WHERE key = 'owner_password'")
    .get() as { value: string } | undefined
  return row?.value ?? ''
}

function isHashed(value: string): boolean {
  return value.includes(':') && value.length > 50
}

function ensurePasswordHashed(db: ReturnType<typeof getDb>): void {
  const stored = getStoredPassword(db)
  // Migrate plaintext to hashed (including default '1234')
  if (!stored || !isHashed(stored)) {
    const plaintext = stored || '1234'
    const { hash, salt } = hashPassword(plaintext)
    const hashed = `${salt}:${hash}`
    db.prepare(
      "INSERT INTO app_settings (key, value) VALUES ('owner_password', ?) ON CONFLICT(key) DO UPDATE SET value = ?"
    ).run(hashed, hashed)
  }
}

export function registerAuthHandlers(): void {
  ipcMain.handle('auth:verify-password', (_event, password: string) => {
    const now = Date.now()
    if (now < lockUntil) {
      const remaining = Math.ceil((lockUntil - now) / 1000)
      return { success: false, error: `กรุณารอ ${remaining} วินาที` }
    }

    const db = getDb()
    ensurePasswordHashed(db)

    const stored = getStoredPassword(db)
    const valid = verifyPassword(password, stored)

    if (valid) {
      failedAttempts = 0
      return { success: true }
    }

    failedAttempts++
    if (failedAttempts >= MAX_ATTEMPTS) {
      lockUntil = now + LOCK_DURATION_MS
      failedAttempts = 0
      return { success: false, error: 'ลองผิดหลายครั้ง กรุณารอ 30 วินาที' }
    }

    return { success: false, error: 'รหัสผ่านไม่ถูกต้อง' }
  })

  ipcMain.handle(
    'auth:change-password',
    (_event, currentPassword: string, newPassword: string) => {
      const db = getDb()
      ensurePasswordHashed(db)

      const stored = getStoredPassword(db)
      if (!verifyPassword(currentPassword, stored)) {
        return { success: false, error: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' }
      }

      const { hash, salt } = hashPassword(newPassword)
      const hashed = `${salt}:${hash}`
      db.prepare("UPDATE app_settings SET value = ? WHERE key = 'owner_password'").run(hashed)
      return { success: true }
    }
  )
}
