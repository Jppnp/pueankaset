# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

เพื่อนเกษตร POS (Pueankaset POS) — a point-of-sale desktop app for agricultural supply shops. Built with Electron + React + better-sqlite3. Thai language UI with Buddhist Era dates and Baht currency formatting.

## Commands

- `npm run dev` — Start dev mode (electron-vite dev server with hot reload)
- `npm run build` — Build renderer/main/preload (output to `out/`)
- `npm run package` — Build + package into distributable (output to `dist/`)
- `npm run package:win` / `npm run package:mac` — Platform-specific packaging
- `npm run release` — Interactive release script: bumps version, builds, pushes, creates GitHub Release with artifacts

There are no tests or linting configured.

## Architecture

Three-process Electron app using electron-vite:

### Main process (`src/main/`)
- `index.ts` — App entry: creates BrowserWindow, initializes DB, registers all IPC handlers, configures auto-updater
- `database.ts` — SQLite via better-sqlite3. DB stored in `app.getPath('userData')/pueankaset.db`. Uses WAL mode and versioned migrations (inline in the file, not separate SQL files)
- `ipc/` — IPC handlers registered via `ipcMain.handle()`. Each file exports a `register*Handlers()` function. Channels are namespaced: `products:*`, `sales:*`, `parked-orders:*`, `printer:*`, `import:*`
- `printer/` — Receipt generation. `receipt.ts` builds structured receipt lines, `mock.ts` logs to console, `escpos.ts` is a placeholder for real USB printer support

### Preload (`src/preload/index.ts`)
- Bridges main↔renderer via `contextBridge.exposeInMainWorld('api', ...)`. All IPC calls go through `window.api`.

### Renderer (`src/renderer/`)
- React 18 + React Router (HashRouter) + Tailwind CSS
- Path alias: `@/*` maps to `src/renderer/*`
- Three pages: `/` (SalePage), `/stock` (StockPage), `/history` (HistoryPage)
- `lib/types.ts` — All shared TypeScript interfaces including `ElectronAPI` type declared on `window.api`
- `lib/format.ts` — Thai date formatting (Buddhist Era) and Baht currency formatting
- `lib/ipc.ts` — Thin wrapper exporting `getApi()` → `window.api`
- `hooks/` — Custom hooks: `useSale` (cart/checkout state), `useProducts`, `useParkedOrders`, `useHistory`
- `components/shared/` — Reusable UI: Button, Input, Modal, Pagination
- `components/layout/` — Sidebar, SaleNotification
- `components/sale/` — SearchBar, SearchResults, OrderPanel, ParkedOrderBar, CheckoutDialog
- `components/stock/` — ProductTable, ProductForm
- `components/history/` — DateRangeFilter, OrderList, OrderDetail

### Database schema (4 tables)
- `products` — id, name, description, cost_price, sale_price, stock_on_hand, exclude_from_profit
- `sales` — id, date, total_amount, remark
- `sale_items` — id, sale_id, product_id, quantity, price, cost_price (FK to sales and products)
- `parked_orders` — id, label, items_json, created_at (temporary saved carts)
- `schema_version` — tracks applied migration versions

## Key Patterns

- **Adding IPC channels**: Create handler in `src/main/ipc/`, register in `src/main/index.ts`, expose in `src/preload/index.ts`, add type to `ElectronAPI` in `src/renderer/lib/types.ts`
- **Database migrations**: Append to the `migrations` array in `src/database.ts` with incrementing version numbers. Migrations run automatically on app start.
- **Sales create flow**: `sales:create` runs in a transaction — inserts sale, inserts sale_items, and decrements product stock_on_hand atomically
- **better-sqlite3 is unpacked from asar** (`asarUnpack` in electron-builder.yml) because it's a native module
- **Auto-updater** publishes to GitHub Releases (provider: github, owner: jppnp, repo: pueankaset)
- Font: Sarabun (Thai-friendly sans-serif), green primary color palette
