import { contextBridge, ipcRenderer } from 'electron'

const api = {
  // Products
  getProducts: (query?: string) => ipcRenderer.invoke('products:list', query),
  getProduct: (id: number) => ipcRenderer.invoke('products:get', id),
  createProduct: (product: Record<string, unknown>) =>
    ipcRenderer.invoke('products:create', product),
  updateProduct: (id: number, updates: Record<string, unknown>) =>
    ipcRenderer.invoke('products:update', id, updates),
  searchProducts: (query: string) => ipcRenderer.invoke('products:search', query),

  // Sales
  createSale: (input: { items: unknown[]; remark?: string }) =>
    ipcRenderer.invoke('sales:create', input),
  getSales: (params: {
    page: number
    pageSize: number
    dateFrom?: string
    dateTo?: string
  }) => ipcRenderer.invoke('sales:list', params),
  getSaleDetail: (id: number) => ipcRenderer.invoke('sales:detail', id),
  getProfitSummary: (dateFrom?: string, dateTo?: string) =>
    ipcRenderer.invoke('sales:profit', dateFrom, dateTo),

  // Parked Orders
  parkOrder: (label: string | null, items: unknown[]) =>
    ipcRenderer.invoke('parked-orders:save', label, JSON.stringify(items)),
  getParkedOrders: () => ipcRenderer.invoke('parked-orders:list'),
  deleteParkedOrder: (id: number) => ipcRenderer.invoke('parked-orders:delete', id),

  // Printer
  printReceipt: (saleId: number) => ipcRenderer.invoke('printer:print', saleId),

  // Import
  importFromStore: (filePath: string) => ipcRenderer.invoke('import:from-store', filePath),
  selectFile: () => ipcRenderer.invoke('import:select-file'),
  getDbInfo: () => ipcRenderer.invoke('import:db-info')
}

contextBridge.exposeInMainWorld('api', api)
