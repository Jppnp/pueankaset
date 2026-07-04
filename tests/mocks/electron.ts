import { mkdtempSync } from 'fs'
import os from 'os'
import path from 'path'

type IpcHandler = (event: unknown, ...args: unknown[]) => unknown

const handlers = new Map<string, IpcHandler>()

export const ipcMain = {
  handle(channel: string, handler: IpcHandler): void {
    handlers.set(channel, handler)
  },
  removeHandler(channel: string): void {
    handlers.delete(channel)
  }
}

let userDataDir = mkdtempSync(path.join(os.tmpdir(), 'pueankaset-test-'))

export const app = {
  getPath(name: string): string {
    if (name !== 'userData') throw new Error(`Unexpected app.getPath('${name}') in tests`)
    return userDataDir
  }
}

/** Point app.getPath('userData') at a fresh temp dir so initDatabase() creates a clean DB. */
export function useFreshUserDataDir(): string {
  userDataDir = mkdtempSync(path.join(os.tmpdir(), 'pueankaset-test-'))
  return userDataDir
}

/** Call a registered IPC handler the way ipcRenderer.invoke would. */
export function invoke<T = unknown>(channel: string, ...args: unknown[]): T {
  const handler = handlers.get(channel)
  if (!handler) throw new Error(`No handler registered for channel "${channel}"`)
  return handler({}, ...args) as T
}
