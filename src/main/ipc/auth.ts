import { ipcMain } from 'electron'
import { getDb } from '../database'

export function registerAuthHandlers(): void {
  ipcMain.handle('auth:verify-password', (_event, password: string) => {
    const db = getDb()
    const row = db
      .prepare("SELECT value FROM app_settings WHERE key = 'owner_password'")
      .get() as { value: string } | undefined

    const stored = row?.value ?? '1234'
    return password === stored
  })

  ipcMain.handle(
    'auth:change-password',
    (_event, currentPassword: string, newPassword: string) => {
      const db = getDb()
      const row = db
        .prepare("SELECT value FROM app_settings WHERE key = 'owner_password'")
        .get() as { value: string } | undefined

      const stored = row?.value ?? '1234'
      if (currentPassword !== stored) {
        return { success: false, error: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' }
      }

      db.prepare("UPDATE app_settings SET value = ? WHERE key = 'owner_password'").run(newPassword)
      return { success: true }
    }
  )
}
