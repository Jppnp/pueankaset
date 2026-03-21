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
- `ipc/` — IPC handlers registered via `ipcMain.handle()`. Each file exports a `register*Handlers()` function. Channels are namespaced: `products:*`, `sales:*`, `parked-orders:*`, `printer:*`, `import:*`, `stores:*`, `auth:*`
- `printer/` — Receipt generation. `receipt.ts` builds structured receipt lines, `mock.ts` logs to console, `escpos.ts` is a placeholder for real USB printer support

### Preload (`src/preload/index.ts`)
- Bridges main↔renderer via `contextBridge.exposeInMainWorld('api', ...)`. All IPC calls go through `window.api`.

### Renderer (`src/renderer/`)
- React 18 + React Router (HashRouter) + Tailwind CSS
- Path alias: `@/*` maps to `src/renderer/*`
- Three pages: `/` (SalePage), `/stock` (StockPage), `/history` (HistoryPage)
- `lib/types.ts` — All shared TypeScript interfaces including `ElectronAPI` type declared on `window.api`
- `lib/format.ts` — Thai date formatting (Buddhist Era), Baht currency formatting, and `calcCardFee()` (5% rounded up to nearest 10)
- `lib/ipc.ts` — Thin wrapper exporting `getApi()` → `window.api`
- `hooks/` — Custom hooks: `useSale` (cart/checkout state), `useProducts`, `useParkedOrders`, `useHistory`
- `components/shared/` — Reusable UI: Button, Input, Modal, Pagination, ErrorBoundary
- `components/auth/` — AuthScreen (role selection + owner password), ChangePasswordDialog
- `components/layout/` — Sidebar, SaleNotification
- `components/sale/` — SearchBar, SearchResults, OrderPanel, ParkedOrderBar, CheckoutDialog (includes card payment fee toggle)
- `components/stock/` — ProductTable, ProductForm
- `components/history/` — DateRangeFilter, OrderList, OrderDetail

### Database schema (7 tables)
- `stores` — id, name, created_at (added in migration 2; default "ร้านหลัก" seeded at id=1)
- `products` — id, name, description, cost_price, sale_price, stock_on_hand, exclude_from_profit, store_id (FK to stores)
- `sales` — id, date, total_amount, remark, seller_role (added in migration 3; 'owner' or 'employee')
- `sale_items` — id, sale_id, product_id, quantity, price, cost_price (FK to sales and products)
- `parked_orders` — id, label, items_json, created_at (temporary saved carts)
- `app_settings` — key (PK), value (added in migration 3; stores owner_password as scrypt hash)
- `schema_version` — tracks applied migration versions

## Key Patterns

- **Adding IPC channels**: Create handler in `src/main/ipc/`, register in `src/main/index.ts`, expose in `src/preload/index.ts`, add type to `ElectronAPI` in `src/renderer/lib/types.ts`
- **Database migrations**: Append to the `migrations` array in `src/database.ts` with incrementing version numbers. Migrations run automatically on app start.
- **Sales create flow**: `sales:create` runs in a transaction — validates stock availability, inserts sale, inserts sale_items, and decrements product stock_on_hand atomically. Throws if any product has insufficient stock. Accepts optional `extraAmount` (e.g. card fee) added to `total_amount`. Requires `sellerRole` ('owner' | 'employee').
- **Card payment fee**: 5% of order total, rounded up to nearest 10 baht (`calcCardFee` in `format.ts`). Toggled in `CheckoutDialog`, passed as `extraAmount` through `useSale.checkout()` → `sales:create` IPC. Receipt shows a `ค่าบริการชำระบัตร` line when fee is present (derived from `total_amount - sum(sale_items)`).
- **Store filtering**: Products have a `store_id` FK. `products:list` accepts an optional `storeId` param. `sales:profit` accepts an optional `storeId` to filter the summary to items belonging to that store's products. History and Stock pages both have a store selector dropdown.
- **Adding a store**: Use the "+ เพิ่มร้านค้า" button on the Stock page, or call `stores:create` IPC. All existing products default to store id=1 ("ร้านหลัก").
- **better-sqlite3 is unpacked from asar** (`asarUnpack` in electron-builder.yml) because it's a native module
- **Auto-updater** publishes to GitHub Releases (provider: github, owner: jppnp, repo: pueankaset)
- **Authentication**: Owner role requires password. Passwords are hashed with Node.js `crypto.scryptSync` + random salt, stored in `app_settings` table. Rate-limited to 5 attempts per 30-second window. Default password is '1234' (auto-hashed on first use). `auth:verify-password` returns `{ success, error? }` (not a bare boolean). `auth:change-password` validates current password before updating.
- **Input validation**: IPC handlers validate inputs server-side — product name non-empty, prices/stock >= 0, seller_role enum, JSON validity for parked orders, store name non-empty + unique constraint handling.
- **Error boundary**: `ErrorBoundary` class component wraps the entire app in `App.tsx`, catches render errors and shows a recovery UI.
- Font: Sarabun (Thai-friendly sans-serif), green primary color palette
