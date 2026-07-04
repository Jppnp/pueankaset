import path from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      // Tests run outside Electron; the stub captures ipcMain.handle
      // registrations and points app.getPath('userData') at a temp dir.
      electron: path.resolve(__dirname, 'tests/mocks/electron.ts'),
      '@': path.resolve(__dirname, 'src/renderer')
    }
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node'
  }
})
