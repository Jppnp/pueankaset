export type Role = 'owner' | 'employee'
export type PaymentType = 'cash' | 'card' | 'credit'

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

export interface Customer {
  id: number
  name: string
  phone: string | null
  address: string | null
  created_at: string
  updated_at: string
}

export interface CustomerWithDebt extends Customer {
  total_credit: number
  total_paid: number
  outstanding: number
}

export interface CustomerPayment {
  id: number
  customer_id: number
  amount: number
  date: string
  note: string | null
  created_at: string
}

export interface DebtSummary {
  total_credit: number
  total_paid: number
  outstanding: number
}

export interface Sale {
  id: number
  date: string
  total_amount: number
  remark: string | null
  seller_role: Role
  customer_id: number | null
  payment_type: PaymentType
  customer_name?: string
  has_refund?: number
  has_exchange?: number
}

export interface SaleItem {
  id: number
  sale_id: number
  product_id: number
  quantity: number
  price: number
  cost_price: number
  refunded_qty?: number
}

export interface Refund {
  id: number
  sale_id: number
  date: string
  total_amount: number
  reason: string | null
  created_at: string
}

export interface RefundItem {
  id: number
  refund_id: number
  sale_item_id: number
  quantity: number
  price: number
  product_name: string
}

export interface RefundWithItems extends Refund {
  items: RefundItem[]
}

export interface CreateRefundInput {
  saleId: number
  items: { saleItemId: number; quantity: number }[]
  reason?: string
}

export interface CreateRefundResult {
  refundId: number
  totalAmount: number
}

export interface Exchange {
  id: number
  original_sale_id: number
  refund_id: number
  new_sale_id: number
  price_difference: number
  date: string
  reason: string | null
  created_at: string
}

export interface ExchangeWithDetails extends Exchange {
  returnItems: RefundItem[]
  newItems: (SaleItem & { product_name: string })[]
}

export interface CreateExchangeInput {
  originalSaleId: number
  returnItems: { saleItemId: number; quantity: number }[]
  newItems: { product_id: number; quantity: number; price: number; cost_price: number }[]
  reason?: string
  sellerRole: Role
}

export interface CreateExchangeResult {
  exchangeId: number
  refundId: number
  newSaleId: number
  returnTotal: number
  newTotal: number
  priceDifference: number
}

export interface SaleWithItems extends Sale {
  customer_phone?: string
  items: (SaleItem & { product_name: string })[]
  refunds?: RefundWithItems[]
  exchanges?: ExchangeWithDetails[]
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

export interface TopProduct {
  id: number
  name: string
  sale_price: number
  total_quantity: number
  total_revenue: number
}

export interface LowStockProduct {
  id: number
  name: string
  stock_on_hand: number
  sale_price: number
  store_id: number
}

export interface RevenueTrendPoint {
  day: string
  revenue: number
  order_count: number
}

export type StockMovementType = 'in' | 'out' | 'adjust'

export interface StockMovement {
  id: number
  product_id: number
  product_name?: string
  type: StockMovementType
  quantity: number
  stock_before: number
  stock_after: number
  reason: string | null
  reference_type: string | null
  reference_id: number | null
  created_by: string
  created_at: string
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
  customerId?: number
  paymentType?: PaymentType
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
    customerId?: number
  }) => Promise<PaginatedResult<Sale>>
  getSaleDetail: (id: number) => Promise<SaleWithItems | null>
  getProfitSummary: (dateFrom?: string, dateTo?: string, storeId?: number) => Promise<ProfitSummary>

  // Customers
  getCustomers: (query?: string) => Promise<Customer[]>
  getCustomer: (id: number) => Promise<Customer | null>
  createCustomer: (input: { name: string; phone?: string; address?: string }) => Promise<Customer>
  updateCustomer: (id: number, updates: { name?: string; phone?: string; address?: string }) => Promise<Customer>
  deleteCustomer: (id: number) => Promise<{ success: boolean; error?: string }>
  getCustomerDebtSummary: (id: number) => Promise<DebtSummary>
  getCustomerPurchaseHistory: (params: { customerId: number; page: number; pageSize: number }) => Promise<PaginatedResult<Sale>>
  getCustomersWithDebt: (query?: string) => Promise<CustomerWithDebt[]>
  createCustomerPayment: (input: { customerId: number; amount: number; note?: string }) => Promise<CustomerPayment>
  getCustomerPayments: (customerId: number) => Promise<CustomerPayment[]>

  // Refunds
  createRefund: (input: CreateRefundInput) => Promise<CreateRefundResult>
  getRefundsBySale: (saleId: number) => Promise<RefundWithItems[]>

  // Stock Movements
  getStockMovements: (params: {
    productId: number
    page: number
    pageSize: number
    dateFrom?: string
    dateTo?: string
  }) => Promise<PaginatedResult<StockMovement>>
  addStock: (input: {
    productId: number
    quantity: number
    reason: string
    createdBy: Role
  }) => Promise<StockMovement>
  adjustStock: (input: {
    productId: number
    newQuantity: number
    reason: string
    createdBy: Role
  }) => Promise<StockMovement>

  // Exchanges
  createExchange: (input: CreateExchangeInput) => Promise<CreateExchangeResult>
  getExchangesBySale: (saleId: number) => Promise<ExchangeWithDetails[]>

  // Dashboard
  getDashboardSummary: (dateFrom: string, dateTo: string, storeId?: number) => Promise<ProfitSummary>
  getTopProducts: (dateFrom: string, dateTo: string, limit?: number, storeId?: number) => Promise<TopProduct[]>
  getLowStockProducts: (threshold?: number, storeId?: number) => Promise<LowStockProduct[]>
  getRevenueTrend: (dateFrom: string, dateTo: string, storeId?: number) => Promise<RevenueTrendPoint[]>

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
  verifyOwnerPassword: (password: string) => Promise<{ success: boolean; error?: string }>
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
