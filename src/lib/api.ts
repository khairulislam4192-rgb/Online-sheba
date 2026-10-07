import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import { Category, Transaction, UserProfile } from '../types';

// Supabase Credentials for "Online Sheba"
const SUPABASE_URL =
  (import.meta as any).env?.VITE_SUPABASE_URL ||
  'https://zddpfivtokgodmyefvxf.supabase.co';

const SUPABASE_ANON_KEY =
  (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
  'sb_publishable_bdRh9D_iCFXtO_CX4__6eQ_Q8UKD4Sl';

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export const DEFAULT_CATEGORIES = [
  'Photocopy',
  'Composition & Typing',
  'Online Govt Application',
  'Job Form Fill-Up',
  'Photo Print & Laminating',
  'Scan & Email Services',
  'Other Online Service',
];

const LOCAL_STORAGE_PREFIX = 'online_sheba_user_';
export const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

// Helper to check if string is valid UUID
function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

// ---------------- AUTHENTICATION & MULTI-TENANCY ----------------

export async function getCurrentUser(): Promise<UserProfile | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      return {
        id: session.user.id,
        email: session.user.email || '',
        shop_name: session.user.user_metadata?.shop_name || 'Online Sheba',
      };
    }
  } catch (err) {
    console.warn('Error fetching Supabase session:', err);
  }

  const localSession = localStorage.getItem('online_sheba_active_session');
  if (localSession) {
    try {
      return JSON.parse(localSession);
    } catch {
      return null;
    }
  }
  return null;
}

export async function signIn(email: string, password: string): Promise<UserProfile> {
  const cleanEmail = email.trim().toLowerCase();

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (!error && data.user) {
      const profile: UserProfile = {
        id: data.user.id,
        email: data.user.email || cleanEmail,
        shop_name: data.user.user_metadata?.shop_name || 'Online Sheba',
      };
      localStorage.setItem('online_sheba_active_session', JSON.stringify(profile));
      return profile;
    }

    if (error && error.message !== 'Failed to fetch') {
      throw error;
    }
  } catch (err: any) {
    console.warn('Supabase signIn fallback to local store:', err.message);
    const usersRaw = localStorage.getItem('online_sheba_registered_users');
    if (usersRaw) {
      const users = JSON.parse(usersRaw);
      const match = users.find((u: any) => u.email === cleanEmail && u.password === password);
      if (match) {
        const profile: UserProfile = {
          id: match.id,
          email: match.email,
          shop_name: match.shop_name || 'Online Sheba',
        };
        localStorage.setItem('online_sheba_active_session', JSON.stringify(profile));
        return profile;
      }
    }
    throw new Error(err.message || 'Invalid email or password.');
  }

  throw new Error('Invalid email or password.');
}

export async function signUp(
  email: string,
  password: string,
  shopName: string
): Promise<UserProfile> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanShop = shopName.trim() || 'Online Sheba';

  try {
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          shop_name: cleanShop,
        },
      },
    });

    if (!error && data.user) {
      const profile: UserProfile = {
        id: data.user.id,
        email: data.user.email || cleanEmail,
        shop_name: cleanShop,
      };
      localStorage.setItem('online_sheba_active_session', JSON.stringify(profile));
      return profile;
    }

    if (error && error.message !== 'Failed to fetch') {
      throw error;
    }
  } catch (err: any) {
    console.warn('Supabase signUp warning:', err.message);
  }

  const newId = `user_${Date.now()}`;
  const profile: UserProfile = {
    id: newId,
    email: cleanEmail,
    shop_name: cleanShop,
  };

  const usersRaw = localStorage.getItem('online_sheba_registered_users');
  const users = usersRaw ? JSON.parse(usersRaw) : [];
  users.push({ id: newId, email: cleanEmail, password, shop_name: cleanShop });
  localStorage.setItem('online_sheba_registered_users', JSON.stringify(users));
  localStorage.setItem('online_sheba_active_session', JSON.stringify(profile));

  return profile;
}

export async function signOut(): Promise<void> {
  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.warn('Sign out warning:', err);
  }
  localStorage.removeItem('online_sheba_active_session');
}

// ---------------- LOCAL STORAGE HELPERS ----------------

function getLocalUserCategories(userId: string): Category[] {
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_PREFIX}${userId}_categories`);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn(e);
  }
  const initial = DEFAULT_CATEGORIES.map((name, i) => ({
    id: `cat-${userId}-${i}`,
    user_id: userId,
    name,
    created_at: new Date().toISOString(),
  }));
  localStorage.setItem(`${LOCAL_STORAGE_PREFIX}${userId}_categories`, JSON.stringify(initial));
  return initial;
}

function saveLocalUserCategories(userId: string, cats: Category[]) {
  try {
    localStorage.setItem(`${LOCAL_STORAGE_PREFIX}${userId}_categories`, JSON.stringify(cats));
  } catch (e) {
    console.warn(e);
  }
}

function getLocalUserTransactions(userId: string): Transaction[] {
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_PREFIX}${userId}_transactions`);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn(e);
  }
  return [];
}

function saveLocalUserTransactions(userId: string, txs: Transaction[]) {
  try {
    localStorage.setItem(`${LOCAL_STORAGE_PREFIX}${userId}_transactions`, JSON.stringify(txs));
  } catch (e) {
    console.warn(e);
  }
}

// ---------------- CATEGORIES API (Editable & Deletable anytime) ----------------

export async function fetchCategories(userId: string): Promise<Category[]> {
  if (!userId) return [];

  try {
    let query = supabase.from('categories').select('*');
    if (isValidUUID(userId)) {
      query = query.or(`user_id.eq.${userId},user_id.is.null`);
    }

    const { data, error } = await query.order('created_at', { ascending: true });

    if (!error && data && data.length > 0) {
      saveLocalUserCategories(userId, data);
      return data;
    }
  } catch (err) {
    console.warn('Supabase fetchCategories error:', err);
  }

  return getLocalUserCategories(userId);
}

export async function addCategory(userId: string, name: string): Promise<Category> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Category name cannot be empty');

  const now = new Date().toISOString();

  try {
    const insertObj: any = { name: trimmed };
    if (isValidUUID(userId)) {
      insertObj.user_id = userId;
    }

    const { data, error } = await supabase
      .from('categories')
      .insert([insertObj])
      .select()
      .single();

    if (!error && data) {
      const current = getLocalUserCategories(userId);
      saveLocalUserCategories(userId, [...current, data]);
      return data;
    }

    if (error?.code === '23505') {
      throw new Error('A category with this name already exists.');
    }
  } catch (err: any) {
    if (err.message?.includes('already exists')) throw err;
    console.warn('Supabase addCategory fallback:', err.message);
  }

  const newCat: Category = {
    id: `cat-${Date.now()}`,
    user_id: userId,
    name: trimmed,
    created_at: now,
  };
  const list = getLocalUserCategories(userId);
  saveLocalUserCategories(userId, [...list, newCat]);
  return newCat;
}

export async function updateCategory(userId: string, id: string, newName: string): Promise<Category> {
  const trimmed = newName.trim();
  if (!trimmed) throw new Error('Category name cannot be empty');

  if (isValidUUID(id)) {
    try {
      const { data, error } = await supabase
        .from('categories')
        .update({ name: trimmed })
        .eq('id', id)
        .select()
        .single();

      if (!error && data) {
        const list = getLocalUserCategories(userId).map((c) => (c.id === id ? data : c));
        saveLocalUserCategories(userId, list);
        return data;
      }
    } catch (err) {
      console.warn('Supabase updateCategory fallback:', err);
    }
  }

  const list = getLocalUserCategories(userId).map((c) => (c.id === id ? { ...c, name: trimmed } : c));
  saveLocalUserCategories(userId, list);
  const updated = list.find((c) => c.id === id);
  if (!updated) throw new Error('Category not found');
  return updated;
}

export async function deleteCategory(userId: string, id: string): Promise<void> {
  if (isValidUUID(id)) {
    try {
      await supabase.from('categories').delete().eq('id', id);
    } catch (err) {
      console.warn('Supabase deleteCategory warning:', err);
    }
  }

  const list = getLocalUserCategories(userId).filter((c) => c.id !== id);
  saveLocalUserCategories(userId, list);
}

// ---------------- TRANSACTIONS API (12-Hour Deletion Policy) ----------------

export async function fetchTransactions(userId: string): Promise<Transaction[]> {
  if (!userId) return [];

  try {
    let query = supabase.from('transactions').select('*');
    if (isValidUUID(userId)) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (!error && data) {
      saveLocalUserTransactions(userId, data);
      return data;
    }
  } catch (err) {
    console.warn('Supabase fetchTransactions error:', err);
  }

  return getLocalUserTransactions(userId);
}

export async function addTransaction(
  userId: string,
  tx: Omit<Transaction, 'id' | 'created_at' | 'user_id'>
): Promise<Transaction> {
  const now = new Date().toISOString();

  try {
    const insertObj: any = {
      type: tx.type,
      category: tx.category,
      description: tx.description,
      amount: tx.amount,
      payment_method: tx.payment_method,
      customer_name: tx.customer_name || null,
      customer_phone: tx.customer_phone || null,
      receipt_url: tx.receipt_url || null,
      created_at: now,
    };
    if (isValidUUID(userId)) {
      insertObj.user_id = userId;
    }

    const { data, error } = await supabase
      .from('transactions')
      .insert([insertObj])
      .select()
      .single();

    if (!error && data) {
      const current = getLocalUserTransactions(userId);
      saveLocalUserTransactions(userId, [data, ...current]);
      return data;
    }
  } catch (err: any) {
    console.warn('Supabase addTransaction fallback:', err.message);
  }

  const localTx: Transaction = {
    ...tx,
    id: `tx-${Date.now()}`,
    user_id: userId,
    created_at: now,
  };
  const current = getLocalUserTransactions(userId);
  saveLocalUserTransactions(userId, [localTx, ...current]);
  return localTx;
}

export async function deleteTransaction(userId: string, id: string): Promise<void> {
  // Check 12-hour grace period rule
  const currentTxs = getLocalUserTransactions(userId);
  const target = currentTxs.find((t) => t.id === id);

  if (target) {
    const ageMs = Date.now() - new Date(target.created_at).getTime();
    if (ageMs > TWELVE_HOURS_MS) {
      throw new Error('This transaction is older than 12 hours and is permanently locked.');
    }
  }

  if (isValidUUID(id)) {
    try {
      await supabase.from('transactions').delete().eq('id', id);
    } catch (err) {
      console.warn('Supabase deleteTransaction warning:', err);
    }
  }

  const updated = currentTxs.filter((t) => t.id !== id);
  saveLocalUserTransactions(userId, updated);
}

// ---------------- RECEIPT STORAGE API ----------------

export async function uploadReceipt(
  imageData: string,
  fileName?: string
): Promise<{ url: string; provider: string }> {
  const cleanName = (fileName || `receipt_${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '');
  const filePath = `receipts/${Date.now()}-${cleanName}.png`;

  try {
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
    }
  } catch (err) {
    console.warn('Receipt upload exception:', err);
  }

  return { url: imageData, provider: 'local' };
}

// ---------------- EXCEL (.XLSX) EXPORT FUNCTION ----------------

export function exportTransactionsToExcel(transactions: Transaction[], shopName: string = 'Online Sheba') {
  if (transactions.length === 0) return;

  const paymentLabels: Record<string, string> = {
    cash: 'Cash',
    bkash: 'bKash',
    nagad: 'Nagad',
  };

  const excelRows = transactions.map((tx, idx) => {
    const dateObj = new Date(tx.created_at);
    const dateStr = dateObj.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const timeStr = dateObj.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    const custName = tx.customer_name?.trim() ? tx.customer_name.trim() : 'Unknown';
    const custPhone = tx.customer_phone?.trim() ? tx.customer_phone.trim() : '-';

    return {
      'SL': idx + 1,
      'Date': dateStr,
      'Time': timeStr,
      'Type': tx.type.toUpperCase(),
      'Service / Category': tx.category,
      'Description': tx.description || '-',
      'Customer Name': custName,
      'Customer Phone': custPhone,
      'Payment Method': paymentLabels[tx.payment_method] || tx.payment_method.toUpperCase(),
      'Amount (BDT)': Number(tx.amount),
      'Receipt Link': tx.receipt_url || '-',
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(excelRows);

  worksheet['!cols'] = [
    { wch: 6 },
    { wch: 14 },
    { wch: 12 },
    { wch: 10 },
    { wch: 25 },
    { wch: 30 },
    { wch: 22 },
    { wch: 16 },
    { wch: 16 },
    { wch: 14 },
    { wch: 35 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Accounts Ledger');

  const todayStr = new Date().toISOString().slice(0, 10);
  const cleanShop = shopName.replace(/[^a-zA-Z0-9]/g, '_');
  XLSX.writeFile(workbook, `${cleanShop}_Accounts_Ledger_${todayStr}.xlsx`);
}
