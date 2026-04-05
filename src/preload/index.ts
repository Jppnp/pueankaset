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

  // Customers
  getCustomers: (query?: string) => ipcRenderer.invoke('customers:list', query),
  getCustomer: (id: number) => ipcRenderer.invoke('customers:get', id),
  createCustomer: (input: { name: string; phone?: string; address?: string }) =>
    ipcRenderer.invoke('customers:create', input),
  updateCustomer: (id: number, updates: { name?: string; phone?: string; address?: string }) =>
    ipcRenderer.invoke('customers:update', id, updates),
  deleteCustomer: (id: number) => ipcRenderer.invoke('customers:delete', id),
  getCustomerDebtSummary: (id: number) => ipcRenderer.invoke('customers:debt-summary', id),
  getCustomerPurchaseHistory: (params: { customerId: number; page: number; pageSize: number }) =>
    ipcRenderer.invoke('customers:purchase-history', params),
  getCustomersWithDebt: (query?: string) => ipcRenderer.invoke('customers:list-with-debt', query),
  createCustomerPayment: (input: { customerId: number; amount: number; note?: string }) =>
    ipcRenderer.invoke('customer-payments:create', input),
  getCustomerPayments: (customerId: number) =>
    ipcRenderer.invoke('customer-payments:list', customerId),

  // Refunds
  createRefund: (input: { saleId: number; items: { saleItemId: number; quantity: number }[]; reason?: string }) =>
    ipcRenderer.invoke('refunds:create', input),
  getRefundsBySale: (saleId: number) => ipcRenderer.invoke('refunds:list-by-sale', saleId),

  // Exchanges
  createExchange: (input: {
    originalSaleId: number
    returnItems: { saleItemId: number; quantity: number }[]
    newItems: { product_id: number; quantity: number; price: number; cost_price: number }[]
    reason?: string
    sellerRole: string
  }) => ipcRenderer.invoke('exchanges:create', input),
  getExchangesBySale: (saleId: number) => ipcRenderer.invoke('exchanges:list-by-sale', saleId),

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
