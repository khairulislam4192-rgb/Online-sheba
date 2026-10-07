import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Category, Transaction } from '../types';

// Default initial categories for Online Sheba computer shop
export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat-1', name: 'ফটোকপি (Photocopy)', created_at: new Date().toISOString() },
  { id: 'cat-2', name: 'কম্পোজ ও টাইপিং (Composition)', created_at: new Date().toISOString() },
  { id: 'cat-3', name: 'অনলাইন আবেদন (Govt / Job Application)', created_at: new Date().toISOString() },
  { id: 'cat-4', name: 'ফরম ফিলাপ (Form Fillup)', created_at: new Date().toISOString() },
  { id: 'cat-5', name: 'ছবি প্রিন্ট ও লেমিনেটিং (Photo & Laminating)', created_at: new Date().toISOString() },
  { id: 'cat-6', name: 'স্ক্যান ও ইমেইল (Scan & Email)', created_at: new Date().toISOString() },
  { id: 'cat-7', name: 'অন্যান্য সার্ভিস (Other Service)', created_at: new Date().toISOString() },
];

export const SQL_SETUP_SCRIPT = `-- Supabase Database Schema for "Online Sheba"

-- 1. Create Categories Table
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default categories
INSERT INTO categories (name) VALUES
  ('ফটোকপি (Photocopy)'),
  ('কম্পোজ ও টাইপিং (Composition)'),
  ('অনলাইন আবেদন (Govt / Job Application)'),
  ('ফরম ফিলাপ (Form Fillup)'),
  ('ছবি প্রিন্ট ও লেমিনেটিং (Photo & Laminating)'),
  ('স্ক্যান ও ইমেইল (Scan & Email)'),
  ('অন্যান্য সার্ভিস (Other Service)')
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

-- Enable Row Level Security (RLS) & allow public read/write for shop manager
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read and write on categories" 
ON categories FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow public read and write on transactions" 
ON transactions FOR ALL USING (true) WITH CHECK (true);

-- 3. Storage Bucket for Digital Receipts
-- In Supabase Dashboard -> Storage:
-- Create a new public bucket named "receipts"
-- Or run:
INSERT INTO storage.buckets (id, name, public) 
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public Access for Receipts" 
ON storage.objects FOR ALL 
USING (bucket_id = 'receipts') 
WITH CHECK (bucket_id = 'receipts');
`;

const LOCAL_STORAGE_KEYS = {
  CATEGORIES: 'online_sheba_categories',
  TRANSACTIONS: 'online_sheba_transactions',
  SUPABASE_URL: 'online_sheba_supabase_url',
  SUPABASE_KEY: 'online_sheba_supabase_key',
};

// Retrieve configured credentials from environment or localStorage
export function getStoredSupabaseConfig() {
  const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
  const envKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

  const storedUrl = localStorage.getItem(LOCAL_STORAGE_KEYS.SUPABASE_URL) || envUrl;
  const storedKey = localStorage.getItem(LOCAL_STORAGE_KEYS.SUPABASE_KEY) || envKey;

  return {
    url: storedUrl.trim(),
    anonKey: storedKey.trim(),
  };
}

let cachedClient: SupabaseClient | null = null;
let lastUrl = '';
let lastKey = '';

export function getSupabaseClient(): SupabaseClient | null {
  const { url, anonKey } = getStoredSupabaseConfig();

  if (!url || !anonKey || url === 'YOUR_SUPABASE_URL' || anonKey === 'YOUR_SUPABASE_ANON_KEY') {
    return null;
  }

  if (cachedClient && lastUrl === url && lastKey === anonKey) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(url, anonKey, {
      auth: { persistSession: false },
    });
    lastUrl = url;
    lastKey = anonKey;
    return cachedClient;
  } catch (err) {
    console.warn('Failed to initialize Supabase client:', err);
    return null;
  }
}

export function saveSupabaseConfig(url: string, key: string) {
  localStorage.setItem(LOCAL_STORAGE_KEYS.SUPABASE_URL, url.trim());
  localStorage.setItem(LOCAL_STORAGE_KEYS.SUPABASE_KEY, key.trim());
  cachedClient = null;
}

// ---------------- LOCAL STORAGE FALLBACK HELPERS ----------------

function getLocalCategories(): Category[] {
  const stored = localStorage.getItem(LOCAL_STORAGE_KEYS.CATEGORIES);
  if (!stored) {
    localStorage.setItem(LOCAL_STORAGE_KEYS.CATEGORIES, JSON.stringify(DEFAULT_CATEGORIES));
    return DEFAULT_CATEGORIES;
  }
  try {
    return JSON.parse(stored);
  } catch {
    return DEFAULT_CATEGORIES;
  }
}

function setLocalCategories(categories: Category[]) {
  localStorage.setItem(LOCAL_STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
}

function getLocalTransactions(): Transaction[] {
  const stored = localStorage.getItem(LOCAL_STORAGE_KEYS.TRANSACTIONS);
  if (!stored) {
    // Generate initial sample transaction for today so the user sees a functioning shop demo
    const today = new Date().toISOString();
    const sample: Transaction[] = [
      {
        id: 'tx-sample-1',
        type: 'sale',
        category: 'ফটোকপি (Photocopy)',
        description: '৫০ পাতা ফটোকপি',
        amount: 150,
        payment_method: 'cash',
        created_at: today,
      },
      {
        id: 'tx-sample-2',
        type: 'sale',
        category: 'Online Govt Application',
        description: 'Govt Job Application Form',
        amount: 200,
        payment_method: 'bkash',
        customer_name: 'Abdul Karim',
        customer_phone: '01711234567',
        created_at: today,
      },
      {
        id: 'tx-sample-3',
        type: 'expense',
        category: 'কাগজ / স্টেশনারি',
        description: 'A4 সাইজ কাগজ ১ রিম',
        amount: 450,
        payment_method: 'cash',
        created_at: today,
      },
    ];
    localStorage.setItem(LOCAL_STORAGE_KEYS.TRANSACTIONS, JSON.stringify(sample));
    return sample;
  }
  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

function setLocalTransactions(transactions: Transaction[]) {
  localStorage.setItem(LOCAL_STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
}

// ---------------- API FUNCTIONS WITH SUPABASE & LOCAL SYNC ----------------

export async function fetchCategories(): Promise<{ data: Category[]; isRemote: boolean }> {
  const client = getSupabaseClient();
  if (!client) {
    return { data: getLocalCategories(), isRemote: false };
  }

  try {
    const { data, error } = await client
      .from('categories')
      .select('*')
      .order('created_at', { ascending: true });

    if (error || !data) {
      console.warn('Supabase fetchCategories error, using local fallback:', error?.message);
      return { data: getLocalCategories(), isRemote: false };
    }

    // Save synced data locally as backup
    setLocalCategories(data);
    return { data, isRemote: true };
  } catch (err) {
    console.warn('Error fetching categories from Supabase:', err);
    return { data: getLocalCategories(), isRemote: false };
  }
}

export async function addCategory(name: string): Promise<Category> {
  const client = getSupabaseClient();
  const trimmed = name.trim();

  if (client) {
    try {
      const { data, error } = await client
        .from('categories')
        .insert([{ name: trimmed }])
        .select()
        .single();

      if (!error && data) {
        const local = getLocalCategories();
        setLocalCategories([...local, data]);
        return data;
      }
    } catch (err) {
      console.warn('Failed to add category to Supabase, saving locally:', err);
    }
  }

  // Local fallback
  const newCat: Category = {
    id: 'cat-' + Date.now(),
    name: trimmed,
    created_at: new Date().toISOString(),
  };
  const list = getLocalCategories();
  setLocalCategories([...list, newCat]);
  return newCat;
}

export async function deleteCategory(id: string): Promise<void> {
  const client = getSupabaseClient();
  if (client) {
    try {
      await client.from('categories').delete().eq('id', id);
    } catch (err) {
      console.warn('Failed to delete category on Supabase:', err);
    }
  }

  const list = getLocalCategories().filter((c) => c.id !== id);
  setLocalCategories(list);
}

export async function fetchTransactions(): Promise<{ data: Transaction[]; isRemote: boolean }> {
  const client = getSupabaseClient();
  if (!client) {
    return { data: getLocalTransactions(), isRemote: false };
  }

  try {
    const { data, error } = await client
      .from('transactions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data) {
      console.warn('Supabase fetchTransactions error, using local fallback:', error?.message);
      return { data: getLocalTransactions(), isRemote: false };
    }

    setLocalTransactions(data);
    return { data, isRemote: true };
  } catch (err) {
    console.warn('Error fetching transactions from Supabase:', err);
    return { data: getLocalTransactions(), isRemote: false };
  }
}

export async function addTransaction(
  tx: Omit<Transaction, 'id' | 'created_at'>
): Promise<Transaction> {
  const client = getSupabaseClient();
  const now = new Date().toISOString();

  if (client) {
    try {
      const { data, error } = await client
        .from('transactions')
        .insert([
          {
            type: tx.type,
            category: tx.category,
            description: tx.description,
            amount: tx.amount,
            payment_method: tx.payment_method,
            customer_name: tx.customer_name || null,
            customer_phone: tx.customer_phone || null,
            receipt_url: tx.receipt_url || null,
            created_at: now,
          },
        ])
        .select()
        .single();

      if (!error && data) {
        const local = getLocalTransactions();
        setLocalTransactions([data, ...local]);
        return data;
      } else {
        console.warn('Supabase insert failed:', error?.message);
      }
    } catch (err) {
      console.warn('Error adding transaction to Supabase:', err);
    }
  }

  // Fallback local
  const newTx: Transaction = {
    ...tx,
    id: 'tx-' + Date.now(),
    created_at: now,
  };
  const local = getLocalTransactions();
  setLocalTransactions([newTx, ...local]);
  return newTx;
}

export async function deleteTransaction(id: string): Promise<void> {
  const client = getSupabaseClient();
  if (client) {
    try {
      await client.from('transactions').delete().eq('id', id);
    } catch (err) {
      console.warn('Failed to delete transaction on Supabase:', err);
    }
  }

  const list = getLocalTransactions().filter((t) => t.id !== id);
  setLocalTransactions(list);
}

// ---------------- SUPABASE STORAGE FOR DIGITAL RECEIPTS ----------------

export async function uploadReceiptToSupabase(
  blob: Blob,
  fileName: string
): Promise<{ url: string | null; error: string | null }> {
  const client = getSupabaseClient();

  if (!client) {
    return {
      url: null,
      error: 'Supabase কানেক্টেড নেই। Settings থেকে Supabase URL ও Anon Key দিন।',
    };
  }

  try {
    const bucketName = 'receipts';
    const filePath = `receipts/${Date.now()}-${fileName}`;

    const { error: uploadError } = await client.storage
      .from(bucketName)
      .upload(filePath, blob, {
        contentType: 'image/png',
        upsert: true,
      });

    if (uploadError) {
      console.warn('Storage upload error:', uploadError);
      return { url: null, error: uploadError.message };
    }

    const { data: publicUrlData } = client.storage
      .from(bucketName)
      .getPublicUrl(filePath);

    return {
      url: publicUrlData.publicUrl,
      error: null,
    };
  } catch (err: any) {
    console.error('Receipt upload exception:', err);
    return {
      url: null,
      error: err.message || 'রসিদ আপলোড করতে সমস্যা হয়েছে',
    };
  }
}
