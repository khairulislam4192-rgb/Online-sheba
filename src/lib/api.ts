import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Category, Transaction } from '../types';

// Supabase Credentials for "Online Sheba"
const SUPABASE_URL =
  (import.meta as any).env?.VITE_SUPABASE_URL ||
  'https://zddpfivtokgodmyefvxf.supabase.co';

const SUPABASE_ANON_KEY =
  (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
  'sb_publishable_bdRh9D_iCFXtO_CX4__6eQ_Q8UKD4Sl';

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

// Default pre-seeded categories for Online Sheba
export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat-1', name: 'Photocopy', created_at: new Date().toISOString() },
  { id: 'cat-2', name: 'Composition & Typing', created_at: new Date().toISOString() },
  { id: 'cat-3', name: 'Online Govt Application', created_at: new Date().toISOString() },
  { id: 'cat-4', name: 'Job Form Fill-Up', created_at: new Date().toISOString() },
  { id: 'cat-5', name: 'Photo Print & Laminating', created_at: new Date().toISOString() },
  { id: 'cat-6', name: 'Scan & Email Services', created_at: new Date().toISOString() },
  { id: 'cat-7', name: 'Other Online Service', created_at: new Date().toISOString() },
];

const LOCAL_STORAGE_KEYS = {
  CATEGORIES: 'online_sheba_categories',
  TRANSACTIONS: 'online_sheba_transactions',
};

function getLocalCategories(): Category[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEYS.CATEGORIES);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Error reading local categories', e);
  }
  localStorage.setItem(LOCAL_STORAGE_KEYS.CATEGORIES, JSON.stringify(DEFAULT_CATEGORIES));
  return DEFAULT_CATEGORIES;
}

function saveLocalCategories(cats: Category[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEYS.CATEGORIES, JSON.stringify(cats));
  } catch (e) {
    console.warn('Error saving local categories', e);
  }
}

function getLocalTransactions(): Transaction[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEYS.TRANSACTIONS);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Error reading local transactions', e);
  }
  return [];
}

function saveLocalTransactions(txs: Transaction[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEYS.TRANSACTIONS, JSON.stringify(txs));
  } catch (e) {
    console.warn('Error saving local transactions', e);
  }
}

// ---------------- CATEGORIES API ----------------

export async function fetchCategories(): Promise<{ categories: Category[]; source: string }> {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('created_at', { ascending: true });

    if (!error && data && data.length > 0) {
      saveLocalCategories(data);
      return { categories: data, source: 'supabase' };
    }
  } catch (err) {
    console.warn('Supabase fetchCategories failed, using fallback:', err);
  }

  // Graceful local fallback so categories are NEVER 0
  const localCats = getLocalCategories();
  return { categories: localCats, source: 'local' };
}

export async function addCategory(name: string): Promise<Category> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Category name cannot be empty');

  // Try saving to Supabase
  try {
    const { data, error } = await supabase
      .from('categories')
      .insert([{ name: trimmed }])
      .select()
      .single();

    if (!error && data) {
      const current = getLocalCategories();
      saveLocalCategories([...current, data]);
      return data;
    }

    if (error) {
      console.warn('Supabase addCategory error:', error.message);
      if (error.code === '23505') {
        throw new Error('A category with this name already exists.');
      }
    }
  } catch (err: any) {
    if (err.message?.includes('already exists')) throw err;
    console.warn('Supabase insert failed, saving to local state:', err.message);
  }

  // Fallback save to ensure user's action never fails
  const newCat: Category = {
    id: `cat-${Date.now()}`,
    name: trimmed,
    created_at: new Date().toISOString(),
  };
  const list = getLocalCategories();
  saveLocalCategories([...list, newCat]);
  return newCat;
}

export async function deleteCategory(id: string): Promise<void> {
  try {
    await supabase.from('categories').delete().eq('id', id);
  } catch (err) {
    console.warn('Supabase deleteCategory warning:', err);
  }

  const list = getLocalCategories().filter((c) => c.id !== id);
  saveLocalCategories(list);
}

// ---------------- TRANSACTIONS API ----------------

export async function fetchTransactions(): Promise<{ transactions: Transaction[]; source: string }> {
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      saveLocalTransactions(data);
      return { transactions: data, source: 'supabase' };
    }
  } catch (err) {
    console.warn('Supabase fetchTransactions warning:', err);
  }

  const localTxs = getLocalTransactions();
  return { transactions: localTxs, source: 'local' };
}

export async function addTransaction(
  tx: Omit<Transaction, 'id' | 'created_at'>
): Promise<Transaction> {
  const now = new Date().toISOString();

  try {
    const { data, error } = await supabase
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
      const current = getLocalTransactions();
      saveLocalTransactions([data, ...current]);
      return data;
    }

    if (error) {
      console.warn('Supabase insert transaction error:', error.message);
    }
  } catch (err: any) {
    console.warn('Supabase transaction insert exception:', err);
  }

  // Safe fallback to ensure user's sale/expense is NEVER lost
  const localTx: Transaction = {
    ...tx,
    id: `tx-${Date.now()}`,
    created_at: now,
  };
  const current = getLocalTransactions();
  saveLocalTransactions([localTx, ...current]);
  return localTx;
}

export async function deleteTransaction(id: string): Promise<void> {
  try {
    await supabase.from('transactions').delete().eq('id', id);
  } catch (err) {
    console.warn('Supabase deleteTransaction warning:', err);
  }

  const current = getLocalTransactions().filter((t) => t.id !== id);
  saveLocalTransactions(current);
}

// ---------------- RECEIPT STORAGE API ----------------

export async function uploadReceipt(
  imageData: string,
  fileName?: string
): Promise<{ url: string; provider: string }> {
  const cleanName = (fileName || `receipt_${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '');
  const filePath = `receipts/${Date.now()}-${cleanName}.png`;

  try {
    // Convert base64 Data URL to Blob
    const response = await fetch(imageData);
    const blob = await response.blob();

    const { error: uploadError } = await supabase.storage
      .from('receipts')
      .upload(filePath, blob, {
        contentType: 'image/png',
        upsert: true,
      });

    if (!uploadError) {
      const { data } = supabase.storage.from('receipts').getPublicUrl(filePath);
      return { url: data.publicUrl, provider: 'supabase' };
    } else {
      console.warn('Supabase storage upload error:', uploadError.message);
    }
  } catch (err) {
    console.warn('Receipt upload exception:', err);
  }

  // Fallback to data url if storage bucket is not created yet
  return { url: imageData, provider: 'local' };
}
