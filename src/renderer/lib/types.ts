export type Role = 'owner' | 'employee'

export interface Store {
  id: number
  name: string
  created_at: string
}

export interface Product {
  id: number
  name: string
  description: string | null
  cost_price: number
  sale_price: number
  stock_on_hand: number
  exclude_from_profit: number
  store_id: number
  created_at: string
  updated_at: string
}

export interface Sale {
  id: number
  date: string
  total_amount: number
  remark: string | null
  seller_role: Role
}

export interface SaleItem {
  id: number
  sale_id: number
  product_id: number
  quantity: number
  price: number
  cost_price: number
}

export interface SaleWithItems extends Sale {
  items: (SaleItem & { product_name: string })[]
}

export interface OrderItem {
  product_id: number
  name: string
  description: string | null
  price: number
  cost_price: number
  quantity: number
  stock_on_hand: number
}

export interface ParkedOrder {
  id: number
  label: string | null
  items_json: string
  created_at: string
}

export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
}

export interface ProfitSummary {
  total_revenue: number
  total_cost: number
  total_profit: number
  sale_count: number
}

export interface CreateSaleInput {
  items: {
    product_id: number
    quantity: number
    price: number
    cost_price: number
  }[]
  remark?: string
  extraAmount?: number
  sellerRole: Role
}

export interface CreateSaleResult {
  saleId: number
  total: number
}

// IPC API type for contextBridge
export interface ElectronAPI {
  // Products
  getProducts: (query?: string, storeId?: number) => Promise<Product[]>
  getProduct: (id: number) => Promise<Product | null>
  createProduct: (product: Omit<Product, 'id' | 'created_at' | 'updated_at'>) => Promise<Product>
  updateProduct: (id: number, product: Partial<Product>) => Promise<Product>
  searchProducts: (query: string) => Promise<Product[]>

  // Sales
  createSale: (input: CreateSaleInput) => Promise<CreateSaleResult>
  getSales: (params: {
    page: number
    pageSize: number
    dateFrom?: string
    dateTo?: string
    storeId?: number
  }) => Promise<PaginatedResult<Sale>>
  getSaleDetail: (id: number) => Promise<SaleWithItems | null>
  getProfitSummary: (dateFrom?: string, dateTo?: string, storeId?: number) => Promise<ProfitSummary>

  // Stores
  getStores: () => Promise<Store[]>
  createStore: (name: string) => Promise<Store>

  // Parked Orders
  parkOrder: (label: string | null, items: OrderItem[]) => Promise<ParkedOrder>
  getParkedOrders: () => Promise<ParkedOrder[]>
  deleteParkedOrder: (id: number) => Promise<void>

  // Printer
  printReceipt: (saleId: number) => Promise<{ success: boolean; error?: string }>

  // Import
  importFromStore: (filePath: string, storeId: number) => Promise<{ imported: number }>
  selectFile: () => Promise<string | null>
  getDbInfo: () => Promise<{ productCount: number; saleCount: number }>

  // Auth
  verifyOwnerPassword: (password: string) => Promise<boolean>
  changeOwnerPassword: (
    currentPassword: string,
    newPassword: string
  ) => Promise<{ success: boolean; error?: string }>
}

declare global {
  interface Window {
    api: ElectronAPI
  }
}
