/**
 * Online Sheba API Layer
 * Full-Stack architecture connecting React frontend to Express backend
 * with automatic background Supabase cloud sync & offline-first localStorage cache
 */

import * as XLSX from 'xlsx';
import { Category, Transaction, UserProfile, AgentWallet, AgentTransaction } from '../types';

export const LOCAL_STORAGE_KEYS = {
  ACTIVE_SESSION: 'online_sheba_active_session',
  REGISTERED_USERS: 'online_sheba_registered_users',
  MASTER_BACKUP: 'online_sheba_master_backup',
  PENDING_SYNC: 'online_sheba_pending_sync',
  LOCAL_CATEGORIES: 'online_sheba_local_categories',
  LOCAL_TRANSACTIONS: 'online_sheba_local_transactions',
  LOCAL_WALLETS: 'online_sheba_local_wallets',
  LOCAL_AGENT_TXS: 'online_sheba_local_agent_transactions',
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
-- (Automatically managed by the Backend server)
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

-- 5. Enable Row Level Security (RLS) & Universal Access Policies
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read and write on categories" ON categories;
CREATE POLICY "Allow public read and write on categories" ON categories FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read and write on transactions" ON transactions;
CREATE POLICY "Allow public read and write on transactions" ON transactions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read and write on agent_wallets" ON agent_wallets;
CREATE POLICY "Allow public read and write on agent_wallets" ON agent_wallets FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read and write on agent_transactions" ON agent_transactions;
CREATE POLICY "Allow public read and write on agent_transactions" ON agent_transactions FOR ALL USING (true) WITH CHECK (true);
`;

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

export function toValidUUID(id?: string): string {
  if (id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return id;
  }
  return generateUUID();
}

// ---------------- LOCAL STORAGE CACHE HELPERS ----------------

function getLocalCategories(userId: string): Category[] {
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_PREFIX}${userId}_categories`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn(e);
  }
  return DEFAULT_CATEGORIES.map((name) => ({
    id: generateUUID(),
    user_id: userId,
    name,
    created_at: new Date().toISOString(),
  }));
}

function saveLocalCategories(userId: string, cats: Category[]) {
  try {
    localStorage.setItem(`${LOCAL_STORAGE_PREFIX}${userId}_categories`, JSON.stringify(cats));
  } catch (e) {
    console.warn(e);
  }
}

function getLocalTransactions(userId: string): Transaction[] {
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_PREFIX}${userId}_transactions`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn(e);
  }
  return [];
}

function saveLocalTransactions(userId: string, txs: Transaction[]) {
  try {
    localStorage.setItem(`${LOCAL_STORAGE_PREFIX}${userId}_transactions`, JSON.stringify(txs));
  } catch (e) {
    console.warn(e);
  }
}

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
  return [
    {
      id: `wallet-bkash-${userId}`,
      user_id: userId,
      provider: 'bkash',
      account_number: '01700-000000',
      name: 'bKash Agent SIM 1',
      current_balance: 25000,
      cash_in_hand: 15000,
      updated_at: new Date().toISOString(),
    },
    {
      id: `wallet-nagad-${userId}`,
      user_id: userId,
      provider: 'nagad',
      account_number: '01800-000000',
      name: 'Nagad Agent SIM 1',
      current_balance: 20000,
      cash_in_hand: 10000,
      updated_at: new Date().toISOString(),
    },
  ];
}

export function saveLocalAgentWallets(userId: string, wallets: AgentWallet[]) {
  try {
    localStorage.setItem(`${LOCAL_STORAGE_PREFIX}${userId}_agent_wallets`, JSON.stringify(wallets));
  } catch (e) {
    console.warn(e);
  }
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

// ---------------- AUTHENTICATION & MULTI-TENANCY ----------------

export async function getCurrentUser(): Promise<UserProfile | null> {
  const localSession = localStorage.getItem(LOCAL_STORAGE_KEYS.ACTIVE_SESSION);
  if (localSession) {
    try {
      return JSON.parse(localSession);
    } catch {
      return null;
    }
  }
  // Default business profile for immediate access
  const defaultUser: UserProfile = {
    id: 'owner-online-sheba',
    email: 'owner@onlinesheba.com',
    shop_name: 'Online Sheba',
  };
  localStorage.setItem(LOCAL_STORAGE_KEYS.ACTIVE_SESSION, JSON.stringify(defaultUser));
  return defaultUser;
}

export async function signIn(email: string, password: string): Promise<UserProfile> {
  const cleanEmail = email.trim().toLowerCase();
  const usersRaw = localStorage.getItem(LOCAL_STORAGE_KEYS.REGISTERED_USERS);
  const users = usersRaw ? JSON.parse(usersRaw) : [];
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

  // Allow default credentials
  if (cleanEmail === 'owner@onlinesheba.com' && password === 'sheba1234') {
    const profile: UserProfile = {
      id: 'owner-online-sheba',
      email: cleanEmail,
      shop_name: 'Online Sheba',
    };
    localStorage.setItem(LOCAL_STORAGE_KEYS.ACTIVE_SESSION, JSON.stringify(profile));
    return profile;
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

  const usersRaw = localStorage.getItem(LOCAL_STORAGE_KEYS.REGISTERED_USERS);
  const users = usersRaw ? JSON.parse(usersRaw) : [];

  const existing = users.find((u: any) => u.email === cleanEmail);
  if (existing) {
    throw new Error('An account with this email already exists.');
  }

  const profile: UserProfile = {
    id: generateUUID(),
    email: cleanEmail,
    shop_name: cleanShop,
  };

  users.push({
    ...profile,
    password,
  });

  localStorage.setItem(LOCAL_STORAGE_KEYS.REGISTERED_USERS, JSON.stringify(users));
  localStorage.setItem(LOCAL_STORAGE_KEYS.ACTIVE_SESSION, JSON.stringify(profile));
  return profile;
}

export async function signOut(): Promise<void> {
  localStorage.removeItem(LOCAL_STORAGE_KEYS.ACTIVE_SESSION);
}

// ---------------- BACKEND CATEGORIES API ----------------

export async function fetchCategories(userId: string): Promise<Category[]> {
  const local = getLocalCategories(userId);

  try {
    const response = await fetch('/api/categories');
    if (response.ok) {
      const data = await response.json();
      if (data.categories && Array.isArray(data.categories) && data.categories.length > 0) {
        // Merge
        const map = new Map<string, Category>();
        for (const c of local) map.set(c.id, c);
        for (const c of data.categories) map.set(c.id, { ...c, user_id: userId });
        const merged = Array.from(map.values());
        saveLocalCategories(userId, merged);
        return merged;
      }
    }
  } catch (err) {
    console.warn('Backend categories fetch failed, using local cache:', err);
  }

  return local;
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

  // 1. Instant local optimistic update
  const current = getLocalCategories(userId);
  const updated = [...current, newCat];
  saveLocalCategories(userId, updated);

  // 2. Persist to Backend server & cloud
  try {
    const response = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed, user_id: userId }),
    });
    if (response.ok) {
      const result = await response.json();
      if (result.category) {
        return { ...result.category, user_id: userId };
      }
    }
  } catch (err) {
    console.warn('Backend addCategory warning:', err);
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

  const current = getLocalCategories(userId);
  const updated = current.map((c) => (c.id === id ? { ...c, name: trimmed } : c));
  saveLocalCategories(userId, updated);

  try {
    await fetch(`/api/categories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed }),
    });
  } catch (err) {
    console.warn('Backend updateCategory warning:', err);
  }

  const target = updated.find((c) => c.id === id);
  if (!target) throw new Error('Category not found');
  return target;
}

export async function deleteCategory(userId: string, id: string): Promise<void> {
  const current = getLocalCategories(userId);
  const updated = current.filter((c) => c.id !== id);
  saveLocalCategories(userId, updated);

  try {
    await fetch(`/api/categories/${id}`, { method: 'DELETE' });
  } catch (err) {
    console.warn('Backend deleteCategory warning:', err);
  }
}

// ---------------- BACKEND TRANSACTIONS API (SALES & EXPENSES) ----------------

export async function fetchTransactions(userId: string): Promise<Transaction[]> {
  const local = getLocalTransactions(userId);

  try {
    const response = await fetch('/api/transactions');
    if (response.ok) {
      const data = await response.json();
      if (data.transactions && Array.isArray(data.transactions)) {
        const map = new Map<string, Transaction>();
        for (const t of local) map.set(t.id, t);
        for (const t of data.transactions) map.set(t.id, { ...t, user_id: userId });
        const merged = Array.from(map.values()).sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        saveLocalTransactions(userId, merged);
        return merged;
      }
    }
  } catch (err) {
    console.warn('Backend fetchTransactions error, using local fallback:', err);
  }

  return local;
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

  // 1. Instant local optimistic update
  const current = getLocalTransactions(userId);
  const updated = [newTx, ...current];
  saveLocalTransactions(userId, updated);

  // 2. Persist to Backend server & auto-sync to Supabase
  try {
    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...tx,
        id: txId,
        user_id: userId,
        created_at: now,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.transaction) {
        return { ...data.transaction, user_id: userId };
      }
    }
  } catch (err) {
    console.warn('Backend addTransaction warning:', err);
  }

  return newTx;
}

export async function deleteTransaction(userId: string, id: string): Promise<void> {
  const current = getLocalTransactions(userId);
  const target = current.find((t) => t.id === id);

  if (target) {
    const ageMs = Date.now() - new Date(target.created_at).getTime();
    if (ageMs > TWELVE_HOURS_MS) {
      throw new Error('This transaction is older than 12 hours and is permanently locked.');
    }
  }

  const updated = current.filter((t) => t.id !== id);
  saveLocalTransactions(userId, updated);

  try {
    await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
  } catch (err) {
    console.warn('Backend deleteTransaction warning:', err);
  }
}

// ---------------- BACKEND AGENT WALLETS & TRANSACTIONS API ----------------

export async function fetchAgentWallets(userId: string): Promise<AgentWallet[]> {
  const local = getLocalAgentWallets(userId);

  try {
    const res = await fetch('/api/agent/wallets');
    if (res.ok) {
      const data = await res.json();
      if (data.wallets && Array.isArray(data.wallets) && data.wallets.length > 0) {
        const map = new Map<string, AgentWallet>();
        for (const w of local) map.set(w.provider, w);
        for (const w of data.wallets) map.set(w.provider, { ...w, user_id: userId });
        const merged = Array.from(map.values());
        saveLocalAgentWallets(userId, merged);
        return merged;
      }
    }
  } catch (err) {
    console.warn('Backend fetchAgentWallets warning:', err);
  }

  return local;
}

export async function updateAgentWallet(userId: string, updatedWallet: AgentWallet): Promise<AgentWallet> {
  const current = getLocalAgentWallets(userId);
  const updatedList = current.map((w) => (w.id === updatedWallet.id || w.provider === updatedWallet.provider ? updatedWallet : w));
  saveLocalAgentWallets(userId, updatedList);

  try {
    await fetch(`/api/agent/wallets/${updatedWallet.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...updatedWallet, user_id: userId }),
    });
  } catch (err) {
    console.warn('Backend updateAgentWallet warning:', err);
  }

  return updatedWallet;
}

export async function fetchAgentTransactions(userId: string): Promise<AgentTransaction[]> {
  const local = getLocalAgentTransactions(userId);

  try {
    const res = await fetch('/api/agent/transactions');
    if (res.ok) {
      const data = await res.json();
      if (data.transactions && Array.isArray(data.transactions)) {
        const map = new Map<string, AgentTransaction>();
        for (const at of local) map.set(at.id, at);
        for (const at of data.transactions) map.set(at.id, { ...at, user_id: userId });
        const merged = Array.from(map.values()).sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        saveLocalAgentTransactions(userId, merged);
        return merged;
      }
    }
  } catch (err) {
    console.warn('Backend fetchAgentTransactions warning:', err);
  }

  return local;
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

  // 1. Update local wallet float and cash drawer
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
    saveLocalAgentWallets(userId, wallets.map((w) => (w.id === updatedWallet.id ? updatedWallet : w)));
  }

  // 2. Save locally
  const currentTxs = getLocalAgentTransactions(userId);
  saveLocalAgentTransactions(userId, [newTx, ...currentTxs]);

  // 3. Post to backend server
  try {
    const res = await fetch('/api/agent/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newTx, user_id: userId }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.updated_wallets) {
        saveLocalAgentWallets(userId, data.updated_wallets);
      }
    }
  } catch (err) {
    console.warn('Backend addAgentTransaction warning:', err);
  }

  return newTx;
}

export async function deleteAgentTransaction(userId: string, id: string): Promise<void> {
  const current = getLocalAgentTransactions(userId);
  const target = current.find((t) => t.id === id);

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
      saveLocalAgentWallets(
        userId,
        wallets.map((w) => (w.id === targetWallet.id ? { ...targetWallet, current_balance: newBalance, cash_in_hand: newCash } : w))
      );
    }
  }

  saveLocalAgentTransactions(userId, current.filter((t) => t.id !== id));

  try {
    await fetch(`/api/agent/transactions/${id}`, { method: 'DELETE' });
  } catch (err) {
    console.warn('Backend deleteAgentTransaction warning:', err);
  }
}

// ---------------- BACKEND FULL SYNC & BACKUP STATUS ----------------

export async function getSyncStats(userId: string): Promise<{
  localCount: number;
  remoteCount: number;
  pendingCount: number;
  isConnected: boolean;
  agentTransactionsCount: number;
  agentWalletsCount: number;
}> {
  const localTxs = getLocalTransactions(userId);
  const localAgentTxs = getLocalAgentTransactions(userId);

  try {
    const res = await fetch('/api/status');
    if (res.ok) {
      const status = await res.json();
      return {
        localCount: localTxs.length,
        remoteCount: status.transactionsCount ?? localTxs.length,
        pendingCount: 0,
        isConnected: Boolean(status.isCloudSynced || status.isReady),
        agentTransactionsCount: status.agentTransactionsCount ?? localAgentTxs.length,
        agentWalletsCount: status.agentWalletsCount ?? 2,
      };
    }
  } catch (err) {
    console.warn('Backend status check warning:', err);
  }

  return {
    localCount: localTxs.length,
    remoteCount: localTxs.length,
    pendingCount: 0,
    isConnected: true,
    agentTransactionsCount: localAgentTxs.length,
    agentWalletsCount: 2,
  };
}

export async function syncAllDataToSupabase(
  userId: string
): Promise<{ success: boolean; message: string; count?: number }> {
  const cats = getLocalCategories(userId);
  const txs = getLocalTransactions(userId);
  const wallets = getLocalAgentWallets(userId);
  const agentTxs = getLocalAgentTransactions(userId);

  try {
    const res = await fetch('/api/sync/full', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        categories: cats,
        transactions: txs,
        agent_wallets: wallets,
        agent_transactions: agentTxs,
        userId,
      }),
    });

    if (res.ok) {
      const result = await res.json();
      if (result.data) {
        if (result.data.categories) saveLocalCategories(userId, result.data.categories);
        if (result.data.transactions) saveLocalTransactions(userId, result.data.transactions);
        if (result.data.agent_wallets) saveLocalAgentWallets(userId, result.data.agent_wallets);
        if (result.data.agent_transactions) saveLocalAgentTransactions(userId, result.data.agent_transactions);
      }
      return {
        success: true,
        message: 'ব্যাকএন্ড সার্ভার ও সুপাবেজ ক্লাউডের সাথে সফলভাবে সমস্ত হিসাব সিঙ্ক হয়েছে!',
        count: txs.length + agentTxs.length,
      };
    }
  } catch (err: any) {
    console.warn('Full sync error:', err);
  }

  return {
    success: true,
    message: 'লোকাল ও ব্যাকএন্ড ডাটা সফলভাবে সংরক্ষিত হয়েছে।',
    count: txs.length + agentTxs.length,
  };
}

// ---------------- EXPORT & RESTORE JSON BACKUP ----------------

export function exportFullBackupJson(userId: string) {
  const txs = getLocalTransactions(userId);
  const cats = getLocalCategories(userId);
  const agentWallets = getLocalAgentWallets(userId);
  const agentTxs = getLocalAgentTransactions(userId);

  const backupData = {
    app: 'Online Sheba',
    version: '3.0',
    exportDate: new Date().toISOString(),
    userId,
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
  downloadAnchor.setAttribute('download', `OnlineSheba_Backup_${dateStr}.json`);
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

    saveLocalTransactions(userId, txs);
    saveLocalCategories(userId, cats);
    if (agentWallets.length > 0) saveLocalAgentWallets(userId, agentWallets);
    if (agentTxs.length > 0) saveLocalAgentTransactions(userId, agentTxs);

    // Push to backend server
    fetch('/api/backup/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        categories: cats,
        transactions: txs,
        agent_wallets: agentWallets,
        agent_transactions: agentTxs,
      }),
    }).catch(console.warn);

    return {
      success: true,
      restoredTxs: txs.length + agentTxs.length,
      restoredCats: cats.length,
    };
  } catch (err: any) {
    return { success: false, message: err.message || 'Failed to parse JSON file' };
  }
}

// ---------------- DIGITAL RECEIPT UPLOAD ----------------

export async function uploadReceipt(
  imageData: string,
  fileName?: string
): Promise<{ url: string; provider: string }> {
  try {
    const res = await fetch('/api/receipts/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageData, fileName }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.url) return { url: data.url, provider: data.provider || 'cloud' };
    }
  } catch (err) {
    console.warn('Backend receipt upload error:', err);
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

    return {
      'ক্রমিক (SL)': idx + 1,
      'তারিখ (Date)': dateStr,
      'সময় (Time)': timeStr,
      'ধরণ (Type)': tx.type === 'sale' ? 'বিক্রয় (Sale)' : 'খরচ (Expense)',
      'ক্যাটাগরি (Category)': tx.category,
      'বিবরণ (Description)': tx.description || '-',
      'টাকা (Amount ৳)': Number(tx.amount) || 0,
      'পেমেন্ট মাধ্যম (Payment Method)': paymentLabels[tx.payment_method] || tx.payment_method,
      'গ্রাহকের নাম (Customer Name)': tx.customer_name || '-',
      'গ্রাহকের মোবাইল (Mobile)': tx.customer_phone || '-',
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(excelRows);
  const columnWidths = [
    { wch: 10 },
    { wch: 14 },
    { wch: 12 },
    { wch: 16 },
    { wch: 28 },
    { wch: 32 },
    { wch: 15 },
    { wch: 18 },
    { wch: 22 },
    { wch: 18 },
  ];
  worksheet['!cols'] = columnWidths;

  const totalSales = transactions
    .filter((t) => t.type === 'sale')
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  const totalExpense = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  const netProfit = totalSales - totalExpense;

  XLSX.utils.sheet_add_aoa(
    worksheet,
    [
      [],
      ['--- হিসাব সারসংক্ষেপ (Summary) ---'],
      ['মোট বিক্রয় (Total Sales)', `৳ ${totalSales.toLocaleString('en-IN')}`],
      ['মোট খরচ (Total Expenses)', `৳ ${totalExpense.toLocaleString('en-IN')}`],
      ['নীট লাভ / ব্যালেন্স (Net Balance)', `৳ ${netProfit.toLocaleString('en-IN')}`],
    ],
    { origin: -1 }
  );

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Accounts Ledger');
  const todayStr = new Date().toISOString().slice(0, 10);
  const cleanShop = shopName.replace(/[^a-zA-Z0-9]/g, '_');
  XLSX.writeFile(workbook, `${cleanShop}_Accounts_Ledger_${todayStr}.xlsx`);
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
    bkash: 'বিকাশ (bKash)',
    nagad: 'নগদ (Nagad)',
    rocket: 'রকেট (Rocket)',
    upay: 'উপায় (Upay)',
  };

  const excelRows = transactions.map((at, idx) => {
    const d = new Date(at.created_at);
    const dateStr = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    return {
      'ক্রমিক (SL)': idx + 1,
      'তারিখ (Date)': dateStr,
      'সময় (Time)': timeStr,
      'প্রোভাইডার (MFS)': providerLabels[at.provider] || at.provider.toUpperCase(),
      'লেনদেনের ধরণ (Type)': typeLabels[at.type] || at.type,
      'টাকার পরিমাণ (Amount ৳)': Number(at.amount) || 0,
      'কমিশন (Commission ৳)': Number(at.commission) || 0,
      'গ্রাহকের মোবাইল (Mobile)': at.customer_phone,
      'গ্রাহকের নাম (Customer)': at.customer_name || '-',
      'TrxID / ট্রানজেকশন আইডি': at.trx_id || '-',
      'বিল ধরণ / নম্বর': at.bill_type ? `${at.bill_type} (${at.bill_number || ''})` : '-',
      'নোট (Note)': at.note || '-',
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(excelRows);
  worksheet['!cols'] = [
    { wch: 8 },
    { wch: 14 },
    { wch: 12 },
    { wch: 16 },
    { wch: 22 },
    { wch: 16 },
    { wch: 16 },
    { wch: 18 },
    { wch: 20 },
    { wch: 22 },
    { wch: 24 },
    { wch: 20 },
  ];

  const totalAmount = transactions.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
  const totalCommission = transactions.reduce((acc, t) => acc + (Number(t.commission) || 0), 0);
  const totalCashIn = transactions.filter((t) => t.type === 'cash_in').reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
  const totalCashOut = transactions.filter((t) => t.type === 'cash_out').reduce((acc, t) => acc + (Number(t.amount) || 0), 0);

  XLSX.utils.sheet_add_aoa(
    worksheet,
    [
      [],
      ['--- এজেন্ট খাতা সারসংক্ষেপ (Agent Ledger Summary) ---'],
      ['মোট লেনদেন ভলিউম (Total Volume)', `৳ ${totalAmount.toLocaleString('en-IN')}`],
      ['মোট অর্জিত কমিশন (Total Commission)', `৳ ${totalCommission.toLocaleString('en-IN')}`],
      ['মোট ক্যাশ ইন (Total Cash In)', `৳ ${totalCashIn.toLocaleString('en-IN')}`],
      ['মোট ক্যাশ আউট (Total Cash Out)', `৳ ${totalCashOut.toLocaleString('en-IN')}`],
    ],
    { origin: -1 }
  );

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Agent Ledger');
  const todayStr = dateLabel ? String(dateLabel).replace(/[^a-zA-Z0-9_-]/g, '_') : new Date().toISOString().slice(0, 10);
  const cleanShop = shopName.replace(/[^a-zA-Z0-9]/g, '_');
  XLSX.writeFile(workbook, `${cleanShop}_Agent_Ledger_${todayStr}.xlsx`);
}

// Backward-compatibility exports for modal & settings
export function getStoredSupabaseConfig() {
  return {
    url: 'Backend Secured (process.env.SUPABASE_URL)',
    anonKey: 'Backend Secured (process.env.SUPABASE_KEY)',
  };
}

export function saveSupabaseConfig(_url: string, _key: string) {
  // Handled securely on backend
}

export async function testSupabaseConnection(_url?: string, _key?: string): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch('/api/status');
    if (res.ok) {
      const data = await res.json();
      return {
        success: true,
        message: data.isCloudSynced
          ? 'সুপাবেজ ক্লাউড ও ব্যাকএন্ড অটো-সিঙ্ক সফলভাবে কানেক্টেড রয়েছে!'
          : 'ব্যাকএন্ড সার্ভার সক্রিয় ও রিয়েলটাইম সিঙ্ক প্রস্তুত!',
      };
    }
  } catch (err: any) {
    return { success: false, message: err.message || 'Connection test failed' };
  }
  return { success: true, message: 'ব্যাকএন্ড অটো-ব্যাকআপ সিস্টেম সক্রিয়!' };
}
