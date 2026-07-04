import { describe, it, expect } from 'vitest'
import { freshDb } from './helpers'
import { initializeDatabaseSchema } from '../src/main/database'

describe('database migrations', () => {
  it('brings a fresh database to the latest schema version with no gaps', () => {
    const db = freshDb()
    const rows = db.prepare('SELECT version FROM schema_version ORDER BY version').all() as {
      version: number
    }[]

    expect(rows.length).toBeGreaterThanOrEqual(13)
    // every version from 1..max applied exactly once
    expect(rows.map((r) => r.version)).toEqual(rows.map((_, i) => i + 1))
  })

  it('is idempotent — re-running migrations on a current database changes nothing', () => {
    const db = freshDb()
    const before = db.prepare('SELECT COUNT(*) as n FROM schema_version').get() as { n: number }

    expect(() => initializeDatabaseSchema(db)).not.toThrow()

    const after = db.prepare('SELECT COUNT(*) as n FROM schema_version').get() as { n: number }
    expect(after.n).toBe(before.n)
  })

  it('seeds the default store and owner password', () => {
    const db = freshDb()

    const store = db.prepare('SELECT name FROM stores WHERE id = 1').get() as { name: string }
    expect(store.name).toBe('ร้านหลัก')

    const password = db
      .prepare("SELECT value FROM app_settings WHERE key = 'owner_password'")
      .get() as { value: string }
    expect(password.value).toBeTruthy()
  })

  it('creates the core tables the app depends on', () => {
    const db = freshDb()
    const tables = (
      db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]
    ).map((t) => t.name)

    for (const table of [
      'products',
      'sales',
      'sale_items',
      'parked_orders',
      'stores',
      'app_settings',
      'customers',
      'customer_payments',
      'refunds',
      'refund_items',
      'exchanges',
      'expenses'
    ]) {
      expect(tables).toContain(table)
    }
  })
})
