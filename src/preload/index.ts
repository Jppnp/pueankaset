import { contextBridge, ipcRenderer } from 'electron'

const api = {
  // Products
  getProducts: (query?: string, storeId?: number) => ipcRenderer.invoke('products:list', query, storeId),
  getProduct: (id: number) => ipcRenderer.invoke('products:get', id),
  createProduct: (product: Record<string, unknown>) =>
    ipcRenderer.invoke('products:create', product),
  updateProduct: (id: number, updates: Record<string, unknown>) =>
    ipcRenderer.invoke('products:update', id, updates),
  searchProducts: (query: string) => ipcRenderer.invoke('products:search', query),

  // Sales
  createSale: (input: { items: unknown[]; remark?: string; extraAmount?: number; sellerRole: string }) =>
    ipcRenderer.invoke('sales:create', input),
  getSales: (params: {
    page: number
    pageSize: number
    dateFrom?: string
    dateTo?: string
    storeId?: number
  }) => ipcRenderer.invoke('sales:list', params),
  getSaleDetail: (id: number) => ipcRenderer.invoke('sales:detail', id),
  getProfitSummary: (dateFrom?: string, dateTo?: string, storeId?: number) =>
    ipcRenderer.invoke('sales:profit', dateFrom, dateTo, storeId),

  // Stores
  getStores: () => ipcRenderer.invoke('stores:list'),
  createStore: (name: string) => ipcRenderer.invoke('stores:create', name),

  // Parked Orders
  parkOrder: (label: string | null, items: unknown[]) =>
    ipcRenderer.invoke('parked-orders:save', label, JSON.stringify(items)),
  getParkedOrders: () => ipcRenderer.invoke('parked-orders:list'),
  deleteParkedOrder: (id: number) => ipcRenderer.invoke('parked-orders:delete', id),

  // Printer
  printReceipt: (saleId: number) => ipcRenderer.invoke('printer:print', saleId),

  // Import
  importFromStore: (filePath: string, storeId: number) =>
    ipcRenderer.invoke('import:from-store', filePath, storeId),
  selectFile: () => ipcRenderer.invoke('import:select-file'),
  getDbInfo: () => ipcRenderer.invoke('import:db-info'),

  // Dashboard
  getDashboardSummary: (dateFrom: string, dateTo: string, storeId?: number) =>
    ipcRenderer.invoke('dashboard:summary', dateFrom, dateTo, storeId),
  getTopProducts: (dateFrom: string, dateTo: string, limit?: number, storeId?: number) =>
    ipcRenderer.invoke('dashboard:top-products', dateFrom, dateTo, limit, storeId),
  getLowStockProducts: (threshold?: number, storeId?: number) =>
    ipcRenderer.invoke('dashboard:low-stock', threshold, storeId),
  getRevenueTrend: (dateFrom: string, dateTo: string, storeId?: number) =>
    ipcRenderer.invoke('dashboard:revenue-trend', dateFrom, dateTo, storeId),

  // Auth
  verifyOwnerPassword: (password: string) => ipcRenderer.invoke('auth:verify-password', password),
  changeOwnerPassword: (currentPassword: string, newPassword: string) =>
    ipcRenderer.invoke('auth:change-password', currentPassword, newPassword)
}

contextBridge.exposeInMainWorld('api', api)
