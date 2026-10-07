export type PaymentMethod = 'cash' | 'bkash' | 'nagad';
export type TransactionType = 'sale' | 'expense';

export interface Category {
  id: string;
  name: string;
  icon?: string;
  created_at: string;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  category: string;
  description: string;
  amount: number;
  payment_method: PaymentMethod;
  customer_name?: string;
  customer_phone?: string;
  receipt_url?: string;
  created_at: string;
}

export interface ReceiptItem {
  description: string;
  quantity: number;
  rate: number;
  total: number;
}

export interface ReceiptData {
  id: string;
  receipt_no: string;
  date: string;
  customer_name: string;
  customer_phone: string;
  items: ReceiptItem[];
  total_amount: number;
  discount: number;
  paid_amount: number;
  due_amount: number;
  payment_method: PaymentMethod;
  note?: string;
}

export interface BackendStatus {
  isSupabaseConnected: boolean;
  storageProvider: 'supabase' | 'server';
  supabaseUrl?: string;
  categoriesCount: number;
  transactionsCount: number;
}
