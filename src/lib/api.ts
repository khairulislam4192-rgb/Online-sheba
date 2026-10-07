import { BackendStatus, Category, Transaction } from '../types';

export const SQL_SETUP_SCRIPT = `-- Supabase Database Schema for "Online Sheba"

-- 1. Create Categories Table
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default categories
INSERT INTO categories (name) VALUES
  ('Photocopy'),
  ('Composition & Typing'),
  ('Online Govt Application'),
  ('Job Form Fill-Up'),
  ('Photo Print & Laminating'),
  ('Scan & Email Services'),
  ('Other Online Service')
ON CONFLICT (name) DO NOTHING;

-- 2. Create Transactions Table
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('sale', 'expense')),
  category TEXT NOT NULL,
  description TEXT,
  amount NUMERIC(12, 2) NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'bkash', 'nagad')),
  customer_name TEXT,
  customer_phone TEXT,
  receipt_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security (RLS) & allow public read/write
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read and write on categories" 
ON categories FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow public read and write on transactions" 
ON transactions FOR ALL USING (true) WITH CHECK (true);

-- 3. Storage Bucket for Digital Receipts
-- In Supabase Dashboard -> Storage:
-- Create a new public bucket named "receipts"
INSERT INTO storage.buckets (id, name, public) 
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public Access for Receipts" 
ON storage.objects FOR ALL 
USING (bucket_id = 'receipts') 
WITH CHECK (bucket_id = 'receipts');
`;

export async function getBackendStatus(): Promise<BackendStatus> {
  const res = await fetch('/api/status');
  if (!res.ok) throw new Error('Failed to fetch backend status');
  return res.json();
}

export async function fetchCategories(): Promise<{ categories: Category[]; source: string }> {
  const res = await fetch('/api/categories');
  if (!res.ok) throw new Error('Failed to fetch categories');
  return res.json();
}

export async function addCategory(name: string): Promise<Category> {
  const res = await fetch('/api/categories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to add category');
  }
  const data = await res.json();
  return data.category;
}

export async function deleteCategory(id: string): Promise<void> {
  const res = await fetch(`/api/categories/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete category');
}

export async function fetchTransactions(): Promise<{ transactions: Transaction[]; source: string }> {
  const res = await fetch('/api/transactions');
  if (!res.ok) throw new Error('Failed to fetch transactions');
  return res.json();
}

export async function addTransaction(tx: Omit<Transaction, 'id' | 'created_at'>): Promise<Transaction> {
  const res = await fetch('/api/transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tx),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to add transaction');
  }
  const data = await res.json();
  return data.transaction;
}

export async function deleteTransaction(id: string): Promise<void> {
  const res = await fetch(`/api/transactions/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete transaction');
}

export async function uploadReceipt(imageData: string, fileName?: string): Promise<{ url: string; provider: string }> {
  const res = await fetch('/api/receipts/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageData, fileName }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to upload receipt');
  }
  return res.json();
}

export async function getSettings(): Promise<{ supabaseUrl: string; hasKey: boolean }> {
  const res = await fetch('/api/settings');
  if (!res.ok) throw new Error('Failed to get settings');
  return res.json();
}

export async function updateSettings(supabaseUrl: string, supabaseAnonKey: string): Promise<{ success: boolean; testSuccess: boolean; message: string }> {
  const res = await fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ supabaseUrl, supabaseAnonKey }),
  });
  if (!res.ok) throw new Error('Failed to update settings');
  return res.json();
}
