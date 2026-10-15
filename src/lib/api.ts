import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import { Category, Transaction, UserProfile, AgentWallet, AgentTransaction } from '../types';

// Default / fallback Supabase Credentials for "Online Sheba"
const DEFAULT_SUPABASE_URL =
  (import.meta as any).env?.VITE_SUPABASE_URL ||
  'https://zddpfivtokgodmyefvxf.supabase.co';

const DEFAULT_SUPABASE_ANON_KEY =
  (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
  'sb_publishable_bdRh9D_iCFXtO_CX4__6eQ_Q8UKD4Sl';

export const LOCAL_STORAGE_KEYS = {
  SUPABASE_URL: 'online_sheba_supabase_url',
  SUPABASE_KEY: 'online_sheba_supabase_key',
  ACTIVE_SESSION: 'online_sheba_active_session',
  REGISTERED_USERS: 'online_sheba_registered_users',
  MASTER_BACKUP: 'online_sheba_master_backup',
  PENDING_SYNC: 'online_sheba_pending_sync',
};

const LOCAL_STORAGE_PREFIX = 'online_sheba_user_';
export const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

export const DEFAULT_CATEGORIES = [
  'ফটোকপি (Photocopy)',
  'কম্পোজ ও টাইপিং (Composition & Typing)',
  'অনলাইন আবেদন (Online Govt Application)',
  'ফরম ফিলাপ (Job Form Fill-Up)',
  'ছবি প্রিন্ট ও লেমিনেটিং (Photo Print & Laminating)',
  'স্ক্যান ও ইমেইল সার্ভিস (Scan & Email Services)',
  'অন্যান্য সার্ভিস (Other Online Service)',
];

export const SQL_SETUP_SCRIPT = `-- ========================================================
-- Supabase Database Schema for "Online Sheba"
-- Execute this script in your Supabase SQL Editor:
-- ========================================================

-- 1. Create or Upgrade Categories Table
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE categories ADD COLUMN IF NOT EXISTS user_id TEXT;

-- 2. Create or Upgrade Transactions Table (Sales & Expenses)
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT,
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
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS user_id TEXT;

-- 3. Create Agent Wallets Table (bKash & Nagad Agent SIMs)
CREATE TABLE IF NOT EXISTS agent_wallets (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  provider TEXT NOT NULL,
  account_number TEXT NOT NULL,
  name TEXT NOT NULL,
  current_balance NUMERIC(14, 2) NOT NULL DEFAULT 0,
  cash_in_hand NUMERIC(14, 2) DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE agent_wallets ADD COLUMN IF NOT EXISTS user_id TEXT;

-- 4. Create Agent Transactions Table (Cash In, Cash Out, Bill Pay, DSR Load)
CREATE TABLE IF NOT EXISTS agent_transactions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT,
  provider TEXT NOT NULL,
  type TEXT NOT NULL,
  amount NUMERIC(14, 2) NOT NULL,
  commission NUMERIC(10, 2) DEFAULT 0,
  customer_phone TEXT NOT NULL,
  customer_name TEXT,
  trx_id TEXT,
  bill_type TEXT,
  bill_number TEXT,
  note TEXT,
  wallet_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE agent_transactions ADD COLUMN IF NOT EXISTS user_id TEXT;

-- 5. Enable Row Level Security (RLS) & Allow Read/Write
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read and write on categories" ON categories;
CREATE POLICY "Allow public read and write on categories" 
ON categories FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read and write on transactions" ON transactions;
CREATE POLICY "Allow public read and write on transactions" 
ON transactions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read and write on agent_wallets" ON agent_wallets;
CREATE POLICY "Allow public read and write on agent_wallets" 
ON agent_wallets FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read and write on agent_transactions" ON agent_transactions;
CREATE POLICY "Allow public read and write on agent_transactions" 
ON agent_transactions FOR ALL USING (true) WITH CHECK (true);

-- 6. Storage Bucket for Digital Receipts
INSERT INTO storage.buckets (id, name, public) 
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public Access for Receipts" ON storage.objects;
CREATE POLICY "Public Access for Receipts" 
ON storage.objects FOR ALL 
USING (bucket_id = 'receipts') 
WITH CHECK (bucket_id = 'receipts');
`;

// Helper to generate a valid UUID
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Convert any string identifier to a strictly valid PostgreSQL UUID
export function toValidUUID(id?: string): string {
  if (id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return id;
  }
  return generateUUID();
}

// ---------------- DYNAMIC SUPABASE CLIENT & SCHEMA ADAPTER ----------------

export function getStoredSupabaseConfig() {
  const storedUrl = localStorage.getItem(LOCAL_STORAGE_KEYS.SUPABASE_URL) || DEFAULT_SUPABASE_URL;
  const storedKey = localStorage.getItem(LOCAL_STORAGE_KEYS.SUPABASE_KEY) || DEFAULT_SUPABASE_ANON_KEY;
  return {
    url: storedUrl.trim(),
    anonKey: storedKey.trim(),
  };
}

let activeClient: SupabaseClient | null = null;
let currentClientUrl = '';
let currentClientKey = '';

export interface SchemaCapabilities {
  transactionsHasUserId: boolean;
  categoriesHasUserId: boolean;
  hasAgentWalletsTable: boolean;
  hasAgentTransactionsTable: boolean;
}

let cachedCapabilities: SchemaCapabilities | null = null;

export function resetSchemaCapabilitiesCache() {
  cachedCapabilities = null;
}

export async function detectSchemaCapabilities(client: SupabaseClient): Promise<SchemaCapabilities> {
  if (cachedCapabilities) return cachedCapabilities;

  const caps: SchemaCapabilities = {
    transactionsHasUserId: false,
    categoriesHasUserId: false,
    hasAgentWalletsTable: false,
    hasAgentTransactionsTable: false,
  };

  try {
    const { error: txErr } = await client.from('transactions').select('user_id').limit(1);
    caps.transactionsHasUserId = !txErr || (txErr.code !== '42703' && !txErr.message?.includes('user_id'));
  } catch {
    caps.transactionsHasUserId = false;
  }

  try {
    const { error: catErr } = await client.from('categories').select('user_id').limit(1);
    caps.categoriesHasUserId = !catErr || (catErr.code !== '42703' && !catErr.message?.includes('user_id'));
  } catch {
    caps.categoriesHasUserId = false;
  }

  try {
    const { error: wErr } = await client.from('agent_wallets').select('id').limit(1);
    caps.hasAgentWalletsTable = !wErr || (wErr.code !== 'PGRST205' && wErr.code !== '42P01' && !wErr.message?.includes('not find'));
  } catch {
    caps.hasAgentWalletsTable = false;
  }

  try {
    const { error: atErr } = await client.from('agent_transactions').select('id').limit(1);
    caps.hasAgentTransactionsTable = !atErr || (atErr.code !== 'PGRST205' && atErr.code !== '42P01' && !atErr.message?.includes('not find'));
  } catch {
    caps.hasAgentTransactionsTable = false;
  }

  cachedCapabilities = caps;
  return caps;
}

export function getSupabase(): SupabaseClient | null {
  const { url, anonKey } = getStoredSupabaseConfig();
  if (!url || !anonKey) return null;

  if (activeClient && currentClientUrl === url && currentClientKey === anonKey) {
    return activeClient;
  }

  try {
    activeClient = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
    currentClientUrl = url;
    currentClientKey = anonKey;
    resetSchemaCapabilitiesCache();
    return activeClient;
  } catch (err) {
    console.warn('Failed to initialize Supabase client:', err);
    return null;
  }
}

export function saveSupabaseConfig(url: string, key: string) {
  const cleanUrl = url.trim();
  const cleanKey = key.trim();
  localStorage.setItem(LOCAL_STORAGE_KEYS.SUPABASE_URL, cleanUrl);
  localStorage.setItem(LOCAL_STORAGE_KEYS.SUPABASE_KEY, cleanKey);
  activeClient = null;
  resetSchemaCapabilitiesCache();
}

export async function testSupabaseConnection(
  url: string,
  key: string
): Promise<{ success: boolean; message: string }> {
  try {
    const client = createClient(url.trim(), key.trim(), { auth: { persistSession: false } });
    const { error } = await client.from('categories').select('id').limit(1);
    if (error) {
      if (error.code === '42P01') {
        return {
          success: true,
          message: 'Connected to Supabase! (Note: Tables not created yet. Please run the SQL setup script).',
        };
      }
      return { success: false, message: `Supabase error (${error.code}): ${error.message}` };
    }
    return { success: true, message: 'Successfully connected to Supabase database!' };
  } catch (err: any) {
    return { success: false, message: err.message || 'Connection failed' };
  }
}

// ---------------- DEEP LOCAL STORAGE PERSISTENCE & DATA RECOVERY ----------------

function recoverAllLegacyData(userId: string): Transaction[] {
  const collected: Transaction[] = [];
  const seenIds = new Set<string>();

  // 1. Current user storage
  try {
    const userRaw = localStorage.getItem(`${LOCAL_STORAGE_PREFIX}${userId}_transactions`);
    if (userRaw) {
      const parsed: Transaction[] = JSON.parse(userRaw);
      for (const t of parsed) {
        if (!seenIds.has(t.id)) {
          seenIds.add(t.id);
          collected.push(t);
        }
      }
    }
  } catch (e) {
    console.warn(e);
  }

  // 2. Scan legacy master backup
  try {
    const masterRaw = localStorage.getItem(LOCAL_STORAGE_KEYS.MASTER_BACKUP);
    if (masterRaw) {
      const parsed = JSON.parse(masterRaw);
      const txs = parsed.transactions || [];
      for (const t of txs) {
        if (!seenIds.has(t.id)) {
          seenIds.add(t.id);
          collected.push(t);
        }
      }
    }
  } catch (e) {
    console.warn(e);
  }

  // 3. Scan old un-partitioned 'online_sheba_transactions'
  try {
    const legacyRaw = localStorage.getItem('online_sheba_transactions');
    if (legacyRaw) {
      const parsed: Transaction[] = JSON.parse(legacyRaw);
      for (const t of parsed) {
        if (!seenIds.has(t.id)) {
          seenIds.add(t.id);
          collected.push(t);
        }
      }
    }
  } catch (e) {
    console.warn(e);
  }

  // 4. Scan any other user prefixes in localStorage to rescue user data
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(LOCAL_STORAGE_PREFIX) && k.endsWith('_transactions')) {
      try {
        const raw = localStorage.getItem(k);
        if (raw) {
          const parsed: Transaction[] = JSON.parse(raw);
          for (const t of parsed) {
            if (!seenIds.has(t.id)) {
              seenIds.add(t.id);
              collected.push(t);
            }
          }
        }
      } catch (e) {
        console.warn(e);
      }
    }
  }

  // Sort by date descending
  collected.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Save back to user storage & master backup so it's safely consolidated
  saveLocalUserTransactions(userId, collected);
  saveMasterBackup(userId, collected, getLocalUserCategories(userId));

  return collected;
}

function getLocalUserCategories(userId: string): Category[] {
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_PREFIX}${userId}_categories`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn(e);
  }

  // Check legacy un-partitioned categories
  try {
    const legacy = localStorage.getItem('online_sheba_categories');
    if (legacy) {
      const parsed = JSON.parse(legacy);
      if (Array.isArray(parsed) && parsed.length > 0) {
        saveLocalUserCategories(userId, parsed);
        return parsed;
      }
    }
  } catch (e) {
    console.warn(e);
  }

  const initial = DEFAULT_CATEGORIES.map((name) => ({
    id: generateUUID(),
    user_id: userId,
    name,
    created_at: new Date().toISOString(),
  }));
  saveLocalUserCategories(userId, initial);
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
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn(e);
  }

  // If empty, attempt deep recovery from legacy keys so no data is lost!
  return recoverAllLegacyData(userId);
}

function saveLocalUserTransactions(userId: string, txs: Transaction[]) {
  try {
    localStorage.setItem(`${LOCAL_STORAGE_PREFIX}${userId}_transactions`, JSON.stringify(txs));
  } catch (e) {
    console.warn(e);
  }
}

function saveMasterBackup(userId: string, txs: Transaction[], cats: Category[]) {
  try {
    const backupObj = {
      timestamp: new Date().toISOString(),
      userId,
      transactions: txs,
      categories: cats,
    };
    localStorage.setItem(LOCAL_STORAGE_KEYS.MASTER_BACKUP, JSON.stringify(backupObj));
  } catch (e) {
    console.warn('Master backup save failed:', e);
  }
}

// ---------------- AUTHENTICATION & MULTI-TENANCY ----------------

export async function getCurrentUser(): Promise<UserProfile | null> {
  const client = getSupabase();
  if (client) {
    try {
      const {
        data: { session },
      } = await client.auth.getSession();
      if (session?.user) {
        return {
          id: session.user.id,
          email: session.user.email || '',
          shop_name: session.user.user_metadata?.shop_name || 'Online Sheba',
        };
      }
    } catch (err) {
      console.warn('Supabase getSession warning:', err);
    }
  }

  const localSession = localStorage.getItem(LOCAL_STORAGE_KEYS.ACTIVE_SESSION);
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
  const client = getSupabase();

  if (client) {
    try {
      const { data, error } = await client.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (!error && data.user) {
        const profile: UserProfile = {
          id: data.user.id,
          email: data.user.email || cleanEmail,
          shop_name: data.user.user_metadata?.shop_name || 'Online Sheba',
        };
        localStorage.setItem(LOCAL_STORAGE_KEYS.ACTIVE_SESSION, JSON.stringify(profile));
        return profile;
      }
    } catch (err: any) {
      console.warn('Supabase signIn remote attempt fallback:', err.message);
    }
  }

  // Local Accounts Store
  const usersRaw = localStorage.getItem(LOCAL_STORAGE_KEYS.REGISTERED_USERS);
  if (usersRaw) {
    const users = JSON.parse(usersRaw);
    const match = users.find((u: any) => u.email === cleanEmail && u.password === password);
    if (match) {
      const profile: UserProfile = {
        id: match.id,
        email: match.email,
        shop_name: match.shop_name || 'Online Sheba',
      };
      localStorage.setItem(LOCAL_STORAGE_KEYS.ACTIVE_SESSION, JSON.stringify(profile));
      return profile;
    }
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
  const client = getSupabase();

  if (client) {
    try {
      const { data, error } = await client.auth.signUp({
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
        localStorage.setItem(LOCAL_STORAGE_KEYS.ACTIVE_SESSION, JSON.stringify(profile));
        return profile;
      }
    } catch (err: any) {
      console.warn('Supabase signUp warning:', err.message);
    }
  }

  const newId = generateUUID();
  const profile: UserProfile = {
    id: newId,
    email: cleanEmail,
    shop_name: cleanShop,
  };

  const usersRaw = localStorage.getItem(LOCAL_STORAGE_KEYS.REGISTERED_USERS);
  const users = usersRaw ? JSON.parse(usersRaw) : [];
  users.push({ id: newId, email: cleanEmail, password, shop_name: cleanShop });
  localStorage.setItem(LOCAL_STORAGE_KEYS.REGISTERED_USERS, JSON.stringify(users));
  localStorage.setItem(LOCAL_STORAGE_KEYS.ACTIVE_SESSION, JSON.stringify(profile));

  return profile;
}

export async function signOut(): Promise<void> {
  const client = getSupabase();
  if (client) {
    try {
      await client.auth.signOut();
    } catch (err) {
      console.warn('Sign out warning:', err);
    }
  }
  localStorage.removeItem(LOCAL_STORAGE_KEYS.ACTIVE_SESSION);
}

// ---------------- CATEGORIES API ----------------

export async function fetchCategories(userId: string): Promise<Category[]> {
  if (!userId) return [];
  const client = getSupabase();

  if (client) {
    try {
      const { data, error } = await client
        .from('categories')
        .select('*')
        .order('created_at', { ascending: true });

      if (!error && data && data.length > 0) {
        // Merge with local categories
        const local = getLocalUserCategories(userId);
        const mergedMap = new Map<string, Category>();
        for (const c of local) mergedMap.set(c.id, c);
        for (const c of data) mergedMap.set(c.id, c);
        const mergedList = Array.from(mergedMap.values());
        saveLocalUserCategories(userId, mergedList);
        return mergedList;
      }
    } catch (err) {
      console.warn('Supabase fetchCategories fallback:', err);
    }
  }

  return getLocalUserCategories(userId);
}

export async function addCategory(userId: string, name: string): Promise<Category> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Category name cannot be empty');

  const newCat: Category = {
    id: generateUUID(),
    user_id: userId,
    name: trimmed,
    created_at: new Date().toISOString(),
  };

  // 1. Save locally immediately
  const current = getLocalUserCategories(userId);
  const updated = [...current, newCat];
  saveLocalUserCategories(userId, updated);
  saveMasterBackup(userId, getLocalUserTransactions(userId), updated);

  // 2. Auto-sync to Supabase
  const client = getSupabase();
  if (client) {
    try {
      const caps = await detectSchemaCapabilities(client);
      const row: any = {
        id: toValidUUID(newCat.id),
        name: trimmed,
        created_at: newCat.created_at,
      };
      if (caps.categoriesHasUserId) {
        row.user_id = userId;
      }
      await client.from('categories').insert([row]);
    } catch (err) {
      console.warn('Supabase addCategory background sync warning:', err);
    }
  }

  return newCat;
}

export async function updateCategory(
  userId: string,
  id: string,
  newName: string
): Promise<Category> {
  const trimmed = newName.trim();
  if (!trimmed) throw new Error('Category name cannot be empty');

  const current = getLocalUserCategories(userId);
  const updated = current.map((c) => (c.id === id ? { ...c, name: trimmed } : c));
  saveLocalUserCategories(userId, updated);
  saveMasterBackup(userId, getLocalUserTransactions(userId), updated);

  const client = getSupabase();
  if (client) {
    try {
      await client.from('categories').update({ name: trimmed }).eq('id', id);
    } catch (err) {
      console.warn('Supabase updateCategory sync error:', err);
    }
  }

  const target = updated.find((c) => c.id === id);
  if (!target) throw new Error('Category not found');
  return target;
}

export async function deleteCategory(userId: string, id: string): Promise<void> {
  const current = getLocalUserCategories(userId);
  const updated = current.filter((c) => c.id !== id);
  saveLocalUserCategories(userId, updated);
  saveMasterBackup(userId, getLocalUserTransactions(userId), updated);

  const client = getSupabase();
  if (client) {
    try {
      await client.from('categories').delete().eq('id', id);
    } catch (err) {
      console.warn('Supabase deleteCategory sync warning:', err);
    }
  }
}

// ---------------- TRANSACTIONS API (AUTO-SAVE & 12-HOUR DELETE POLICY) ----------------

export async function fetchTransactions(userId: string): Promise<Transaction[]> {
  if (!userId) return [];
  const client = getSupabase();

  if (client) {
    try {
      const caps = await detectSchemaCapabilities(client);
      let query = client.from('transactions').select('*');
      if (caps.transactionsHasUserId) {
        query = query.eq('user_id', userId);
      }
      const { data, error } = await query.order('created_at', { ascending: false });

      if (!error && data) {
        // Merge remote and local transactions to guarantee NO loss
        const localTxs = getLocalUserTransactions(userId);
        const map = new Map<string, Transaction>();
        for (const t of localTxs) map.set(t.id, t);
        for (const t of data) map.set(t.id, t);

        const merged = Array.from(map.values()).sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        saveLocalUserTransactions(userId, merged);
        saveMasterBackup(userId, merged, getLocalUserCategories(userId));
        return merged;
      }
    } catch (err) {
      console.warn('Supabase fetchTransactions error, using local fallback:', err);
    }
  }

  return getLocalUserTransactions(userId);
}

export async function addTransaction(
  userId: string,
  tx: Omit<Transaction, 'id' | 'created_at' | 'user_id'>
): Promise<Transaction> {
  const now = new Date().toISOString();
  const txId = generateUUID();

  const newTx: Transaction = {
    ...tx,
    id: txId,
    user_id: userId,
    created_at: now,
  };

  // 1. Instant local persistence & master backup
  const current = getLocalUserTransactions(userId);
  const updated = [newTx, ...current];
  saveLocalUserTransactions(userId, updated);
  saveMasterBackup(userId, updated, getLocalUserCategories(userId));

  // 2. Real-time Auto-Save directly into Supabase account
  const client = getSupabase();
  if (client) {
    try {
      const caps = await detectSchemaCapabilities(client);
      const row: any = {
        id: toValidUUID(txId),
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
      if (caps.transactionsHasUserId) {
        row.user_id = userId;
      }
      const { error } = await client.from('transactions').insert([row]);

      if (error) {
        console.warn('Supabase direct insert error, queueing pending sync:', error.message);
        queuePendingSync(newTx);
      }
    } catch (err: any) {
      console.warn('Supabase auto-save network warning:', err.message);
      queuePendingSync(newTx);
    }
  }

  return newTx;
}

export async function deleteTransaction(userId: string, id: string): Promise<void> {
  const current = getLocalUserTransactions(userId);
  const target = current.find((t) => t.id === id);

  if (target) {
    const ageMs = Date.now() - new Date(target.created_at).getTime();
    if (ageMs > TWELVE_HOURS_MS) {
      throw new Error('This transaction is older than 12 hours and is permanently locked.');
    }
  }

  // 1. Delete locally
  const updated = current.filter((t) => t.id !== id);
  saveLocalUserTransactions(userId, updated);
  saveMasterBackup(userId, updated, getLocalUserCategories(userId));

  // 2. Delete on Supabase
  const client = getSupabase();
  if (client) {
    try {
      await client.from('transactions').delete().eq('id', id);
    } catch (err) {
      console.warn('Supabase deleteTransaction sync warning:', err);
    }
  }
}

// ---------------- BACKGROUND SYNC & BACKUP TOOLS ----------------

function queuePendingSync(tx: Transaction) {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEYS.PENDING_SYNC);
    const list = raw ? JSON.parse(raw) : [];
    if (!list.some((t: any) => t.id === tx.id)) {
      list.push(tx);
      localStorage.setItem(LOCAL_STORAGE_KEYS.PENDING_SYNC, JSON.stringify(list));
    }
  } catch (e) {
    console.warn(e);
  }
}

export async function getSyncStats(userId: string) {
  const localTxs = getLocalUserTransactions(userId);
  const rawPending = localStorage.getItem(LOCAL_STORAGE_KEYS.PENDING_SYNC);
  const pending = rawPending ? JSON.parse(rawPending) : [];

  let remoteCount = 0;
  let isConnected = false;

  const client = getSupabase();
  if (client) {
    try {
      const caps = await detectSchemaCapabilities(client);
      let query = client.from('transactions').select('*', { count: 'exact', head: true });
      if (caps.transactionsHasUserId) {
        query = query.eq('user_id', userId);
      }
      const { count, error } = await query;
      if (!error) {
        remoteCount = count || 0;
        isConnected = true;
      }
    } catch {
      isConnected = false;
    }
  }

  return {
    localCount: localTxs.length,
    remoteCount,
    pendingCount: pending.length,
    isConnected,
  };
}

export async function syncAllDataToSupabase(
  userId: string
): Promise<{ success: boolean; message: string; count?: number; warning?: string }> {
  const client = getSupabase();
  if (!client) {
    return {
      success: false,
      message: 'Supabase is not configured. Please enter your Supabase URL and Key.',
    };
  }

  const localCats = getLocalUserCategories(userId);
  const localTxs = getLocalUserTransactions(userId);
  const localWallets = getLocalAgentWallets(userId);
  const localAgentTxs = getLocalAgentTransactions(userId);

  try {
    const caps = await detectSchemaCapabilities(client);
    let syncedTxs = 0;
    let syncedCats = 0;
    let syncedWallets = 0;
    let syncedAgentTxs = 0;
    let agentWarning = '';

    // 1. Sync Categories (safely omitting user_id if table doesn't have it)
    if (localCats.length > 0) {
      const catPayload = localCats.map((c) => {
        const item: any = {
          id: toValidUUID(c.id),
          name: c.name,
          created_at: c.created_at,
        };
        if (caps.categoriesHasUserId) {
          item.user_id = userId;
        }
        return item;
      });
      const { error: catErr } = await client.from('categories').upsert(catPayload, { onConflict: 'id' });
      if (catErr) {
        console.warn('Category sync warning:', catErr.message);
      } else {
        syncedCats = catPayload.length;
      }
    }

    // 2. Sync Transactions (safely omitting user_id if table doesn't have it)
    if (localTxs.length > 0) {
      const txPayload = localTxs.map((t) => {
        const item: any = {
          id: toValidUUID(t.id),
          type: t.type,
          category: t.category,
          description: t.description,
          amount: t.amount,
          payment_method: t.payment_method,
          customer_name: t.customer_name || null,
          customer_phone: t.customer_phone || null,
          receipt_url: t.receipt_url || null,
          created_at: t.created_at,
        };
        if (caps.transactionsHasUserId) {
          item.user_id = userId;
        }
        return item;
      });

      const { error } = await client.from('transactions').upsert(txPayload, { onConflict: 'id' });
      if (error) {
        // If error was about user_id, retry without user_id
        if (error.code === 'PGRST204' || error.message?.includes('user_id')) {
          caps.transactionsHasUserId = false;
          const retryPayload = txPayload.map((row) => {
            const { user_id, ...rest } = row;
            return rest;
          });
          const { error: retryErr } = await client.from('transactions').upsert(retryPayload, { onConflict: 'id' });
          if (retryErr) throw retryErr;
          syncedTxs = retryPayload.length;
        } else {
          throw error;
        }
      } else {
        syncedTxs = txPayload.length;
      }
    }

    // 3. Sync Agent Wallets (if table exists)
    if (caps.hasAgentWalletsTable && localWallets.length > 0) {
      const walletPayload = localWallets.map((w) => ({
        id: w.id,
        user_id: userId,
        provider: w.provider,
        account_number: w.account_number,
        name: w.name,
        current_balance: w.current_balance,
        cash_in_hand: w.cash_in_hand || 0,
        updated_at: w.updated_at,
      }));
      try {
        const { error } = await client.from('agent_wallets').upsert(walletPayload, { onConflict: 'id' });
        if (!error) syncedWallets = walletPayload.length;
      } catch (e) {
        console.warn('Agent wallets sync note:', e);
      }
    } else if (!caps.hasAgentWalletsTable && (localWallets.length > 0 || localAgentTxs.length > 0)) {
      agentWarning = 'বিঃদ্রঃ বিকাশ/নগদ এজেন্ট টেবিল এখনো সুপাবেজে তৈরি হয়নি। SQL স্ক্রিপ্টটি সুপাবেজ SQL এডিটরে রান করলে এজেন্ট হিসাবও ক্লাউডে সেভ হবে।';
    }

    // 4. Sync Agent Transactions (if table exists)
    if (caps.hasAgentTransactionsTable && localAgentTxs.length > 0) {
      const agentTxPayload = localAgentTxs.map((at) => ({
        id: toValidUUID(at.id),
        user_id: userId,
        provider: at.provider,
        type: at.type,
        amount: at.amount,
        commission: at.commission,
        customer_phone: at.customer_phone,
        customer_name: at.customer_name || null,
        trx_id: at.trx_id || null,
        bill_type: at.bill_type || null,
        bill_number: at.bill_number || null,
        note: at.note || null,
        wallet_id: at.wallet_id || null,
        created_at: at.created_at,
      }));
      try {
        const { error } = await client.from('agent_transactions').upsert(agentTxPayload, { onConflict: 'id' });
        if (!error) syncedAgentTxs = agentTxPayload.length;
      } catch (e) {
        console.warn('Agent transactions sync note:', e);
      }
    }

    // Clear pending sync
    localStorage.removeItem(LOCAL_STORAGE_KEYS.PENDING_SYNC);

    let message = `সফলভাবে ${syncedTxs}টি লেনদেন ও ${syncedCats}টি ক্যাটাগরি সুপাবেজ ক্লাউডে ব্যাকআপ হয়েছে!`;
    if (syncedAgentTxs > 0 || syncedWallets > 0) {
      message += ` (${syncedAgentTxs}টি এজেন্ট লেনদেন সিঙ্ক হয়েছে)`;
    }
    if (agentWarning) {
      message += `\n${agentWarning}`;
    }

    return {
      success: true,
      message,
      count: syncedTxs + syncedAgentTxs,
      warning: agentWarning || undefined,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `সিঙ্ক সমস্যা: ${err.message || 'দয়া করে ডাটাবেজ চেক করুন'}`,
    };
  }
}

export function exportFullBackupJson(userId: string) {
  const txs = getLocalUserTransactions(userId);
  const cats = getLocalUserCategories(userId);
  const agentWallets = getLocalAgentWallets(userId);
  const agentTxs = getLocalAgentTransactions(userId);
  const config = getStoredSupabaseConfig();

  const backupData = {
    app: 'Online Sheba',
    version: '2.5',
    exportDate: new Date().toISOString(),
    userId,
    supabaseUrl: config.url,
    categories: cats,
    transactions: txs,
    agentWallets,
    agentTransactions: agentTxs,
  };

  const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
    JSON.stringify(backupData, null, 2)
  )}`;
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', jsonString);
  const dateStr = new Date().toISOString().slice(0, 10);
  downloadAnchor.setAttribute('download', `OnlineSheba_FullBackup_${dateStr}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

export async function restoreFullBackupJson(
  userId: string,
  jsonString: string
): Promise<{ success: boolean; message?: string; restoredTxs?: number; restoredCats?: number }> {
  try {
    const data = JSON.parse(jsonString);
    if (!data.transactions && !data.categories && !data.agentTransactions) {
      return { success: false, message: 'Invalid backup file format' };
    }

    const txs: Transaction[] = data.transactions || [];
    const cats: Category[] = data.categories || [];
    const agentWallets: AgentWallet[] = data.agentWallets || [];
    const agentTxs: AgentTransaction[] = data.agentTransactions || [];

    // Merge into local storage
    const currentTxs = getLocalUserTransactions(userId);
    const txMap = new Map<string, Transaction>();
    for (const t of currentTxs) txMap.set(t.id, t);
    for (const t of txs) txMap.set(t.id, t);
    const mergedTxs = Array.from(txMap.values());
    saveLocalUserTransactions(userId, mergedTxs);

    const currentCats = getLocalUserCategories(userId);
    const catMap = new Map<string, Category>();
    for (const c of currentCats) catMap.set(c.id, c);
    for (const c of cats) catMap.set(c.id, c);
    const mergedCats = Array.from(catMap.values());
    saveLocalUserCategories(userId, mergedCats);

    // Merge Agent Wallets
    if (agentWallets.length > 0) {
      saveLocalAgentWallets(userId, agentWallets);
    }

    // Merge Agent Transactions
    if (agentTxs.length > 0) {
      const currentAgentTxs = getLocalAgentTransactions(userId);
      const atMap = new Map<string, AgentTransaction>();
      for (const at of currentAgentTxs) atMap.set(at.id, at);
      for (const at of agentTxs) atMap.set(at.id, at);
      const mergedAgentTxs = Array.from(atMap.values());
      saveLocalAgentTransactions(userId, mergedAgentTxs);
    }

    saveMasterBackup(userId, mergedTxs, mergedCats);

    // If Supabase is connected, auto-sync restored data
    syncAllDataToSupabase(userId).catch(console.warn);

    return {
      success: true,
      restoredTxs: txs.length + agentTxs.length,
      restoredCats: cats.length,
    };
  } catch (err: any) {
    return { success: false, message: err.message || 'Failed to parse JSON file' };
  }
}

// ---------------- RECEIPT STORAGE API ----------------

export async function uploadReceipt(
  imageData: string,
  fileName?: string
): Promise<{ url: string; provider: string }> {
  const client = getSupabase();
  if (client) {
    try {
      const cleanName = (fileName || `receipt_${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '');
      const filePath = `receipts/${Date.now()}-${cleanName}.png`;

      const response = await fetch(imageData);
      const blob = await response.blob();

      const { error: uploadError } = await client.storage
        .from('receipts')
        .upload(filePath, blob, {
          contentType: 'image/png',
          upsert: true,
        });

      if (!uploadError) {
        const { data } = client.storage.from('receipts').getPublicUrl(filePath);
        return { url: data.publicUrl, provider: 'supabase' };
      }
    } catch (err) {
      console.warn('Receipt upload exception:', err);
    }
  }

  return { url: imageData, provider: 'local' };
}

// ---------------- EXCEL (.XLSX) EXPORT FUNCTION ----------------

export function exportTransactionsToExcel(
  transactions: Transaction[],
  shopName: string = 'Online Sheba'
) {
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

// ---------------- AGENT WALLETS & TRANSACTIONS API ----------------

export const DEFAULT_AGENT_WALLETS = (userId: string): AgentWallet[] => [
  {
    id: `wallet-bkash-${userId}`,
    user_id: userId,
    provider: 'bkash',
    account_number: '01700-000000',
    name: 'বিকাশ এজেন্ট (bKash Agent B-SIM)',
    current_balance: 50000,
    cash_in_hand: 20000,
    updated_at: new Date().toISOString(),
  },
  {
    id: `wallet-nagad-${userId}`,
    user_id: userId,
    provider: 'nagad',
    account_number: '01800-000000',
    name: 'নগদ এজেন্ট (Nagad Agent B-SIM)',
    current_balance: 50000,
    cash_in_hand: 20000,
    updated_at: new Date().toISOString(),
  },
];

export function getLocalAgentWallets(userId: string): AgentWallet[] {
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_PREFIX}${userId}_agent_wallets`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn(e);
  }
  const initial = DEFAULT_AGENT_WALLETS(userId);
  saveLocalAgentWallets(userId, initial);
  return initial;
}

export function saveLocalAgentWallets(userId: string, wallets: AgentWallet[]) {
  try {
    localStorage.setItem(`${LOCAL_STORAGE_PREFIX}${userId}_agent_wallets`, JSON.stringify(wallets));
  } catch (e) {
    console.warn(e);
  }
}

export async function fetchAgentWallets(userId: string): Promise<AgentWallet[]> {
  if (!userId) return [];
  const client = getSupabase();
  if (client) {
    try {
      const { data, error } = await client
        .from('agent_wallets')
        .select('*')
        .eq('user_id', userId);
      if (!error && data && data.length > 0) {
        saveLocalAgentWallets(userId, data);
        return data;
      }
    } catch (e) {
      console.warn('Supabase fetchAgentWallets note:', e);
    }
  }
  return getLocalAgentWallets(userId);
}

export async function updateAgentWallet(userId: string, updatedWallet: AgentWallet): Promise<AgentWallet> {
  const current = getLocalAgentWallets(userId);
  const exists = current.some((w) => w.id === updatedWallet.id);
  const updatedList = exists
    ? current.map((w) => (w.id === updatedWallet.id ? updatedWallet : w))
    : [...current, updatedWallet];
  saveLocalAgentWallets(userId, updatedList);

  const client = getSupabase();
  if (client) {
    try {
      const caps = await detectSchemaCapabilities(client);
      if (caps.hasAgentWalletsTable) {
        await client.from('agent_wallets').upsert([updatedWallet], { onConflict: 'id' });
      }
    } catch (e) {
      console.warn('Supabase updateAgentWallet note:', e);
    }
  }
  return updatedWallet;
}

export function getLocalAgentTransactions(userId: string): AgentTransaction[] {
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_PREFIX}${userId}_agent_transactions`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn(e);
  }
  return [];
}

export function saveLocalAgentTransactions(userId: string, txs: AgentTransaction[]) {
  try {
    localStorage.setItem(`${LOCAL_STORAGE_PREFIX}${userId}_agent_transactions`, JSON.stringify(txs));
  } catch (e) {
    console.warn(e);
  }
}

export async function fetchAgentTransactions(userId: string): Promise<AgentTransaction[]> {
  if (!userId) return [];
  const client = getSupabase();
  if (client) {
    try {
      const { data, error } = await client
        .from('agent_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (!error && data) {
        const local = getLocalAgentTransactions(userId);
        const map = new Map<string, AgentTransaction>();
        for (const at of local) map.set(at.id, at);
        for (const at of data) map.set(at.id, at);
        const merged = Array.from(map.values()).sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        saveLocalAgentTransactions(userId, merged);
        return merged;
      }
    } catch (e) {
      console.warn('Supabase fetchAgentTransactions note:', e);
    }
  }
  return getLocalAgentTransactions(userId);
}

export async function addAgentTransaction(
  userId: string,
  tx: Omit<AgentTransaction, 'id' | 'created_at' | 'user_id'>
): Promise<AgentTransaction> {
  const newTx: AgentTransaction = {
    ...tx,
    id: generateUUID(),
    user_id: userId,
    created_at: new Date().toISOString(),
  };

  // 1. Automatically update Agent Wallet Float based on Bangladesh MFS Agent principles:
  // - Cash In: Agent e-money decreases, Drawer Cash increases
  // - Cash Out: Agent e-money increases, Drawer Cash decreases
  // - Bill Pay: Agent e-money decreases, Drawer Cash increases
  // - DSR Balance In: Agent e-money increases, Drawer Cash decreases
  const wallets = getLocalAgentWallets(userId);
  const targetWallet = wallets.find((w) => w.provider === tx.provider) || wallets[0];
  if (targetWallet) {
    let newBalance = targetWallet.current_balance;
    let newCash = targetWallet.cash_in_hand ?? 0;

    if (tx.type === 'cash_in') {
      newBalance = Math.max(0, newBalance - tx.amount);
      newCash = newCash + tx.amount;
    } else if (tx.type === 'cash_out') {
      newBalance = newBalance + tx.amount;
      newCash = Math.max(0, newCash - tx.amount);
    } else if (tx.type === 'bill_pay') {
      newBalance = Math.max(0, newBalance - tx.amount);
      newCash = newCash + tx.amount;
    } else if (tx.type === 'dsr_balance_in') {
      newBalance = newBalance + tx.amount;
      newCash = Math.max(0, newCash - tx.amount);
    } else if (tx.type === 'balance_adjustment') {
      newBalance = tx.amount;
    }

    const updatedWallet: AgentWallet = {
      ...targetWallet,
      current_balance: newBalance,
      cash_in_hand: newCash,
      updated_at: new Date().toISOString(),
    };
    newTx.wallet_id = updatedWallet.id;
    updateAgentWallet(userId, updatedWallet).catch(console.warn);
  }

  // 2. Save transaction locally
  const currentTxs = getLocalAgentTransactions(userId);
  const updatedTxs = [newTx, ...currentTxs];
  saveLocalAgentTransactions(userId, updatedTxs);

  // 3. Supabase sync
  const client = getSupabase();
  if (client) {
    try {
      const caps = await detectSchemaCapabilities(client);
      if (caps.hasAgentTransactionsTable) {
        await client.from('agent_transactions').insert([
          {
            ...newTx,
            id: toValidUUID(newTx.id),
          },
        ]);
      }
    } catch (e) {
      console.warn('Supabase addAgentTransaction note:', e);
    }
  }

  return newTx;
}

export async function deleteAgentTransaction(userId: string, id: string): Promise<void> {
  const current = getLocalAgentTransactions(userId);
  const target = current.find((t) => t.id === id);

  // Revert wallet balance if deleting
  if (target) {
    const wallets = getLocalAgentWallets(userId);
    const targetWallet = wallets.find((w) => w.provider === target.provider);
    if (targetWallet) {
      let newBalance = targetWallet.current_balance;
      let newCash = targetWallet.cash_in_hand ?? 0;
      if (target.type === 'cash_in') {
        newBalance = newBalance + target.amount;
        newCash = Math.max(0, newCash - target.amount);
      } else if (target.type === 'cash_out') {
        newBalance = Math.max(0, newBalance - target.amount);
        newCash = newCash + target.amount;
      } else if (target.type === 'bill_pay') {
        newBalance = newBalance + target.amount;
        newCash = Math.max(0, newCash - target.amount);
      } else if (target.type === 'dsr_balance_in') {
        newBalance = Math.max(0, newBalance - target.amount);
        newCash = newCash + target.amount;
      }
      updateAgentWallet(userId, {
        ...targetWallet,
        current_balance: newBalance,
        cash_in_hand: newCash,
        updated_at: new Date().toISOString(),
      }).catch(console.warn);
    }
  }

  const updated = current.filter((t) => t.id !== id);
  saveLocalAgentTransactions(userId, updated);

  const client = getSupabase();
  if (client) {
    try {
      const caps = await detectSchemaCapabilities(client);
      if (caps.hasAgentTransactionsTable) {
        await client.from('agent_transactions').delete().eq('id', id);
      }
    } catch (e) {
      console.warn('Supabase deleteAgentTransaction note:', e);
    }
  }
}

export function exportAgentTransactionsToExcel(
  transactions: AgentTransaction[],
  shopName: string = 'Online Sheba',
  dateLabel?: string
) {
  if (transactions.length === 0) return;

  const typeLabels: Record<string, string> = {
    cash_in: 'ক্যাশ ইন (Cash In)',
    cash_out: 'ক্যাশ আউট (Cash Out)',
    bill_pay: 'বিল পে (Bill Pay)',
    dsr_balance_in: 'ডিএসআর লোড (DSR Load)',
    balance_adjustment: 'ব্যালেন্স সমন্বয় (Adjustment)',
  };

  const providerLabels: Record<string, string> = {
    bkash: 'bKash Agent',
    nagad: 'Nagad Agent',
    rocket: 'Rocket Agent',
    upay: 'Upay Agent',
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

    return {
      'SL': idx + 1,
      'Date': dateStr,
      'Time': timeStr,
      'Agent Provider': providerLabels[tx.provider] || tx.provider.toUpperCase(),
      'Transaction Type': typeLabels[tx.type] || tx.type,
      'Customer Mobile': tx.customer_phone || '-',
      'Customer / Ref': tx.customer_name || '-',
      'TrxID': tx.trx_id || '-',
      'Amount (BDT)': Number(tx.amount),
      'Earned Commission (BDT)': Number(tx.commission || 0),
      'Bill Info / Note': tx.bill_type ? `${tx.bill_type} (${tx.bill_number || '-'})` : (tx.note || '-'),
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(excelRows);
  worksheet['!cols'] = [
    { wch: 6 },
    { wch: 14 },
    { wch: 12 },
    { wch: 18 },
    { wch: 24 },
    { wch: 18 },
    { wch: 22 },
    { wch: 18 },
    { wch: 16 },
    { wch: 24 },
    { wch: 30 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Agent Ledger');

  const todayStr = dateLabel ? dateLabel.replace(/[^a-zA-Z0-9_-]/g, '_') : new Date().toISOString().slice(0, 10);
  const cleanShop = shopName.replace(/[^a-zA-Z0-9]/g, '_');
  XLSX.writeFile(workbook, `${cleanShop}_bKash_Nagad_Agent_Ledger_${todayStr}.xlsx`);
}
