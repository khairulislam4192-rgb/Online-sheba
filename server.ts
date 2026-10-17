import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Force override with .env file variables
dotenv.config({ override: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

// Backend-Only Supabase Credentials
const SUPABASE_PROJECT_URL =
  process.env.SUPABASE_URL || 'https://zddpfivtokgodmyefvxf.supabase.co';
const SUPABASE_KEY =
  process.env.SUPABASE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  'sb_publishable_bdRh9D_iCFXtO_CX4__6eQ_Q8UKD4Sl';

// Middleware for parsing JSON with generous limit for image uploads & backups
app.use(express.json({ limit: '35mb' }));
app.use(express.urlencoded({ extended: true, limit: '35mb' }));

// Ensure data, backups, and uploads directories exist
const dataDir = path.join(__dirname, 'data');
const backupsDir = path.join(dataDir, 'backups');
const uploadsDir = path.join(__dirname, 'uploads', 'receipts');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Serve uploaded receipts statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const dbFilePath = path.join(dataDir, 'db.json');

export interface CategoryModel {
  id: string;
  user_id?: string;
  name: string;
  created_at: string;
}

export interface TransactionModel {
  id: string;
  user_id?: string;
  type: 'sale' | 'expense';
  category: string;
  description: string;
  amount: number;
  payment_method: 'cash' | 'bkash' | 'nagad';
  customer_name?: string;
  customer_phone?: string;
  receipt_url?: string;
  created_at: string;
}

export interface AgentWalletModel {
  id: string;
  user_id?: string;
  provider: 'bkash' | 'nagad' | 'rocket' | 'upay';
  account_number: string;
  name: string;
  current_balance: number;
  cash_in_hand?: number;
  updated_at: string;
}

export interface AgentTransactionModel {
  id: string;
  user_id?: string;
  provider: 'bkash' | 'nagad' | 'rocket' | 'upay';
  type: string;
  amount: number;
  commission?: number;
  customer_phone: string;
  customer_name?: string;
  trx_id?: string;
  bill_type?: string;
  bill_number?: string;
  note?: string;
  wallet_id?: string;
  created_at: string;
}

export interface LocalDB {
  categories: CategoryModel[];
  transactions: TransactionModel[];
  agent_wallets: AgentWalletModel[];
  agent_transactions: AgentTransactionModel[];
  sync_meta?: {
    last_sync: string;
    status: string;
    cloud_synced_count: number;
    error?: string;
  };
}

const defaultCategories: CategoryModel[] = [
  { id: 'cat-1', name: 'ফটোকপি (Photocopy)', created_at: new Date().toISOString() },
  { id: 'cat-2', name: 'কম্পোজ ও টাইপিং (Composition & Typing)', created_at: new Date().toISOString() },
  { id: 'cat-3', name: 'অনলাইন আবেদন (Online Govt Application)', created_at: new Date().toISOString() },
  { id: 'cat-4', name: 'ফরম ফিলাপ (Job Form Fill-Up)', created_at: new Date().toISOString() },
  { id: 'cat-5', name: 'ছবি প্রিন্ট ও লেমিনেটিং (Photo Print & Laminating)', created_at: new Date().toISOString() },
  { id: 'cat-6', name: 'স্ক্যান ও ইমেইল সার্ভিস (Scan & Email Services)', created_at: new Date().toISOString() },
  { id: 'cat-7', name: 'অন্যান্য সার্ভিস (Other Online Service)', created_at: new Date().toISOString() },
];

const defaultWallets: AgentWalletModel[] = [
  {
    id: 'wallet-bkash',
    provider: 'bkash',
    account_number: '01700-000000',
    name: 'bKash Agent SIM 1',
    current_balance: 25000,
    cash_in_hand: 15000,
    updated_at: new Date().toISOString(),
  },
  {
    id: 'wallet-nagad',
    provider: 'nagad',
    account_number: '01800-000000',
    name: 'Nagad Agent SIM 1',
    current_balance: 20000,
    cash_in_hand: 10000,
    updated_at: new Date().toISOString(),
  },
];

function readDB(): LocalDB {
  try {
    if (!fs.existsSync(dbFilePath)) {
      const initial: LocalDB = {
        categories: defaultCategories,
        transactions: [],
        agent_wallets: defaultWallets,
        agent_transactions: [],
        sync_meta: {
          last_sync: new Date().toISOString(),
          status: 'initialized',
          cloud_synced_count: 0,
        },
      };
      fs.writeFileSync(dbFilePath, JSON.stringify(initial, null, 2), 'utf-8');
      return initial;
    }
    const content = fs.readFileSync(dbFilePath, 'utf-8');
    const parsed = JSON.parse(content);
    if (!parsed.agent_wallets) parsed.agent_wallets = defaultWallets;
    if (!parsed.agent_transactions) parsed.agent_transactions = [];
    if (!parsed.categories || parsed.categories.length === 0) parsed.categories = defaultCategories;
    if (!parsed.transactions) parsed.transactions = [];
    return parsed;
  } catch (err) {
    console.error('Error reading local db:', err);
    return {
      categories: defaultCategories,
      transactions: [],
      agent_wallets: defaultWallets,
      agent_transactions: [],
    };
  }
}

// ---------------- BACKEND AUTO-BACKUP ENGINE (SERVER SNAPSHOTS) ----------------
function performBackendAutoBackup(db: LocalDB, trigger = 'auto') {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const backupData = {
      app: 'Online Sheba',
      version: '3.0',
      backup_trigger: trigger,
      timestamp: new Date().toISOString(),
      counts: {
        categories: db.categories.length,
        transactions: db.transactions.length,
        agent_wallets: db.agent_wallets.length,
        agent_transactions: db.agent_transactions.length,
      },
      categories: db.categories,
      transactions: db.transactions,
      agent_wallets: db.agent_wallets,
      agent_transactions: db.agent_transactions,
      sync_meta: db.sync_meta,
    };

    // 1. Always keep latest snapshot file
    fs.writeFileSync(
      path.join(backupsDir, 'auto_backup_latest.json'),
      JSON.stringify(backupData, null, 2),
      'utf-8'
    );

    // 2. Keep daily snapshot file
    const dailyFile = path.join(backupsDir, `backup_${today}.json`);
    fs.writeFileSync(dailyFile, JSON.stringify(backupData, null, 2), 'utf-8');

    // 3. Keep latest 14 snapshots, prune older
    const files = fs.readdirSync(backupsDir).filter((f) => f.startsWith('backup_') && f.endsWith('.json'));
    if (files.length > 14) {
      files
        .sort()
        .slice(0, files.length - 14)
        .forEach((f) => {
          try {
            fs.unlinkSync(path.join(backupsDir, f));
          } catch {}
        });
    }
  } catch (err) {
    console.warn('Backend auto-backup snapshot warning:', err);
  }
}

function writeDB(data: LocalDB) {
  try {
    fs.writeFileSync(dbFilePath, JSON.stringify(data, null, 2), 'utf-8');
    performBackendAutoBackup(data, 'write_db');
  } catch (err) {
    console.error('Error writing local db:', err);
  }
}

// ---------------- SERVER-SIDE SUPABASE CLIENT & ADAPTER ----------------

let supabaseClient: SupabaseClient | null = null;

function getSupabase(): SupabaseClient | null {
  if (supabaseClient) return supabaseClient;
  if (!SUPABASE_PROJECT_URL || !SUPABASE_KEY) return null;

  try {
    supabaseClient = createClient(SUPABASE_PROJECT_URL, SUPABASE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return supabaseClient;
  } catch (err) {
    console.error('Failed to initialize server-side Supabase client:', err);
    return null;
  }
}

const DEFAULT_CAT_UUIDS: Record<string, string> = {
  'cat-1': 'a0000000-0000-4000-8000-000000000001',
  'cat-2': 'a0000000-0000-4000-8000-000000000002',
  'cat-3': 'a0000000-0000-4000-8000-000000000003',
  'cat-4': 'a0000000-0000-4000-8000-000000000004',
  'cat-5': 'a0000000-0000-4000-8000-000000000005',
  'cat-6': 'a0000000-0000-4000-8000-000000000006',
  'cat-7': 'a0000000-0000-4000-8000-000000000007',
};

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function toValidUUID(id?: string): string {
  if (!id) return generateUUID();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return id;
  }
  if (DEFAULT_CAT_UUIDS[id]) {
    return DEFAULT_CAT_UUIDS[id];
  }
  let hash1 = 5381;
  let hash2 = 52711;
  for (let i = 0; i < id.length; i++) {
    const char = id.charCodeAt(i);
    hash1 = (hash1 * 33) ^ char;
    hash2 = (hash2 * 33) ^ char;
  }
  const h1 = Math.abs(hash1).toString(16).padStart(8, '0').slice(0, 8);
  const h2 = Math.abs(hash2).toString(16).padStart(4, '0').slice(0, 4);
  const h3 = Math.abs(hash1 ^ hash2).toString(16).padStart(4, '0').slice(0, 4);
  const h4 = Math.abs(hash2 * 7).toString(16).padStart(4, '0').slice(0, 4);
  const h5 = Math.abs(hash1 * 13).toString(16).padStart(12, '0').slice(0, 12);
  return `${h1}-${h2}-4${h3.slice(1)}-8${h4.slice(1)}-${h5}`;
}

interface ServerSchemaCapabilities {
  transactionsHasUserId: boolean;
  categoriesHasUserId: boolean;
  hasAgentWalletsTable: boolean;
  hasAgentTransactionsTable: boolean;
}

let cachedCaps: ServerSchemaCapabilities | null = null;

async function detectServerSchemaCapabilities(client: SupabaseClient): Promise<ServerSchemaCapabilities> {
  if (cachedCaps) return cachedCaps;

  const caps: ServerSchemaCapabilities = {
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

  cachedCaps = caps;
  return caps;
}

// ---------------- BACKEND AUTO-SYNC & CLOUD BACKUP ENGINE ----------------
// Continuous background cloud persistence directly between Node backend and Supabase
let isSyncInProgress = false;

async function syncBackendDataWithSupabase(): Promise<{
  success: boolean;
  message: string;
  syncedCount: number;
}> {
  if (isSyncInProgress) {
    return { success: true, message: 'Sync already running in background', syncedCount: 0 };
  }

  const sb = getSupabase();
  if (!sb) {
    return { success: false, message: 'Supabase credentials not configured in backend', syncedCount: 0 };
  }

  isSyncInProgress = true;
  try {
    const caps = await detectServerSchemaCapabilities(sb);
    const db = readDB();
    let totalSynced = 0;

    // 1. Sync Categories to Supabase
    if (db.categories.length > 0) {
      const catRows = db.categories.map((c) => {
        const row: any = {
          id: toValidUUID(c.id),
          name: c.name,
          created_at: c.created_at || new Date().toISOString(),
        };
        if (caps.categoriesHasUserId && c.user_id) row.user_id = c.user_id;
        return row;
      });
      const { error: catErr } = await sb.from('categories').upsert(catRows, { onConflict: 'id' });
      if (!catErr) {
        totalSynced += catRows.length;
      } else {
        console.warn('Backend categories sync notice:', catErr.message);
      }
    }

    // 2. Sync Transactions to Supabase
    if (db.transactions.length > 0) {
      const txRows = db.transactions.map((t) => {
        const row: any = {
          id: toValidUUID(t.id),
          type: t.type,
          category: t.category,
          description: t.description || t.category,
          amount: Number(t.amount),
          payment_method: t.payment_method || 'cash',
          customer_name: t.customer_name || null,
          customer_phone: t.customer_phone || null,
          receipt_url: t.receipt_url || null,
          created_at: t.created_at || new Date().toISOString(),
        };
        if (caps.transactionsHasUserId && t.user_id) row.user_id = t.user_id;
        return row;
      });

      const { error: txErr } = await sb.from('transactions').upsert(txRows, { onConflict: 'id' });
      if (txErr) {
        if (txErr.code === 'PGRST204' || txErr.message?.includes('user_id')) {
          caps.transactionsHasUserId = false;
          const retryRows = txRows.map((r) => {
            const { user_id, ...rest } = r;
            return rest;
          });
          const { error: retryErr } = await sb.from('transactions').upsert(retryRows, { onConflict: 'id' });
          if (!retryErr) totalSynced += retryRows.length;
        } else {
          console.warn('Backend transactions sync notice:', txErr.message);
        }
      } else {
        totalSynced += txRows.length;
      }
    }

    // 3. Sync Agent Wallets to Supabase (if table exists)
    if (caps.hasAgentWalletsTable && db.agent_wallets.length > 0) {
      const walletRows = db.agent_wallets.map((w) => ({
        id: w.id,
        user_id: w.user_id || null,
        provider: w.provider,
        account_number: w.account_number,
        name: w.name,
        current_balance: Number(w.current_balance),
        cash_in_hand: Number(w.cash_in_hand || 0),
        updated_at: w.updated_at || new Date().toISOString(),
      }));
      const { error: wErr } = await sb.from('agent_wallets').upsert(walletRows, { onConflict: 'id' });
      if (!wErr) totalSynced += walletRows.length;
    }

    // 4. Sync Agent Transactions to Supabase (if table exists)
    if (caps.hasAgentTransactionsTable && db.agent_transactions.length > 0) {
      const agentTxRows = db.agent_transactions.map((at) => ({
        id: toValidUUID(at.id),
        user_id: at.user_id || null,
        provider: at.provider,
        type: at.type,
        amount: Number(at.amount),
        commission: Number(at.commission || 0),
        customer_phone: at.customer_phone,
        customer_name: at.customer_name || null,
        trx_id: at.trx_id || null,
        bill_type: at.bill_type || null,
        bill_number: at.bill_number || null,
        note: at.note || null,
        wallet_id: at.wallet_id || null,
        created_at: at.created_at || new Date().toISOString(),
      }));
      const { error: atErr } = await sb.from('agent_transactions').upsert(agentTxRows, { onConflict: 'id' });
      if (!atErr) totalSynced += agentTxRows.length;
    }

    // 5. Pull remote categories and transactions from Supabase into db.json
    try {
      const { data: remoteCats } = await sb.from('categories').select('*').limit(150);
      if (remoteCats && remoteCats.length > 0) {
        const catMap = new Map<string, CategoryModel>();
        for (const c of db.categories) catMap.set(c.id, c);
        for (const rc of remoteCats) {
          if (!catMap.has(rc.id)) {
            catMap.set(rc.id, {
              id: rc.id,
              name: rc.name,
              user_id: rc.user_id,
              created_at: rc.created_at || new Date().toISOString(),
            });
          }
        }
        db.categories = Array.from(catMap.values());
      }
    } catch (pullCatErr) {
      console.warn('Pull remote categories notice:', pullCatErr);
    }

    try {
      const { data: remoteTxs } = await sb
        .from('transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (remoteTxs && remoteTxs.length > 0) {
        const txMap = new Map<string, TransactionModel>();
        for (const t of db.transactions) txMap.set(t.id, t);
        for (const rt of remoteTxs) {
          txMap.set(rt.id, {
            id: rt.id,
            user_id: rt.user_id,
            type: rt.type,
            category: rt.category,
            description: rt.description || rt.category,
            amount: Number(rt.amount),
            payment_method: rt.payment_method,
            customer_name: rt.customer_name,
            customer_phone: rt.customer_phone,
            receipt_url: rt.receipt_url,
            created_at: rt.created_at,
          });
        }
        db.transactions = Array.from(txMap.values()).sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      }
    } catch (pullErr) {
      console.warn('Pull remote transactions note:', pullErr);
    }

    // 6. Pull remote agent transactions if table exists
    if (caps.hasAgentTransactionsTable) {
      try {
        const { data: remoteAgentTxs } = await sb
          .from('agent_transactions')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(500);
        if (remoteAgentTxs && remoteAgentTxs.length > 0) {
          const atMap = new Map<string, AgentTransactionModel>();
          for (const at of db.agent_transactions) atMap.set(at.id, at);
          for (const rat of remoteAgentTxs) {
            atMap.set(rat.id, {
              id: rat.id,
              user_id: rat.user_id,
              provider: rat.provider,
              type: rat.type,
              amount: Number(rat.amount),
              commission: Number(rat.commission || 0),
              customer_phone: rat.customer_phone,
              customer_name: rat.customer_name,
              trx_id: rat.trx_id,
              bill_type: rat.bill_type,
              bill_number: rat.bill_number,
              note: rat.note,
              wallet_id: rat.wallet_id,
              created_at: rat.created_at,
            });
          }
          db.agent_transactions = Array.from(atMap.values()).sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        }
      } catch (pullAtErr) {
        console.warn('Pull remote agent transactions note:', pullAtErr);
      }
    }

    // Update metadata and persist snapshot
    db.sync_meta = {
      last_sync: new Date().toISOString(),
      status: 'success',
      cloud_synced_count: totalSynced,
    };
    writeDB(db);
    performBackendAutoBackup(db, 'periodic_sync');

    return {
      success: true,
      message: `Backend auto-sync completed: ${totalSynced} records synced with Supabase.`,
      syncedCount: totalSynced,
    };
  } catch (err: any) {
    console.error('Backend auto-sync error:', err);
    return {
      success: false,
      message: err.message || 'Auto-sync error',
      syncedCount: 0,
    };
  } finally {
    isSyncInProgress = false;
  }
}

// Background interval to ensure continuous auto-sync every 45 seconds
setInterval(() => {
  syncBackendDataWithSupabase().catch((e) => console.warn('Periodic background sync note:', e));
}, 45 * 1000);

// Initial auto-sync shortly after boot
setTimeout(() => {
  syncBackendDataWithSupabase().catch((e) => console.warn('Initial boot sync note:', e));
}, 2000);

// ---------------- BACKEND API REST ENDPOINTS ----------------

// 1. Status & Cloud Sync Health Endpoint
app.get('/api/status', async (req: Request, res: Response) => {
  const sb = getSupabase();
  let isConnected = false;

  if (sb) {
    try {
      const { error } = await sb.from('categories').select('id').limit(1);
      if (!error || error.code === '42P01') {
        isConnected = true;
      }
    } catch {
      isConnected = false;
    }
  }

  const db = readDB();
  res.json({
    isReady: true,
    isCloudSynced: isConnected,
    categoriesCount: db.categories.length,
    transactionsCount: db.transactions.length,
    agentWalletsCount: db.agent_wallets.length,
    agentTransactionsCount: db.agent_transactions.length,
    lastSync: db.sync_meta?.last_sync || new Date().toISOString(),
    syncStatus: db.sync_meta?.status || 'active',
  });
});

// 2. Full Sync Trigger Endpoint
app.post('/api/sync/full', async (req: Request, res: Response) => {
  try {
    const { categories, transactions, agent_wallets, agent_transactions } = req.body;
    const db = readDB();

    // Merge incoming frontend cache into backend db.json
    if (Array.isArray(categories) && categories.length > 0) {
      const catMap = new Map<string, CategoryModel>();
      for (const c of db.categories) catMap.set(c.id, c);
      for (const c of categories) catMap.set(c.id, c);
      db.categories = Array.from(catMap.values());
    }

    if (Array.isArray(transactions) && transactions.length > 0) {
      const txMap = new Map<string, TransactionModel>();
      for (const t of db.transactions) txMap.set(t.id, t);
      for (const t of transactions) txMap.set(t.id, t);
      db.transactions = Array.from(txMap.values()).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }

    if (Array.isArray(agent_wallets) && agent_wallets.length > 0) {
      const wMap = new Map<string, AgentWalletModel>();
      for (const w of db.agent_wallets) wMap.set(w.id, w);
      for (const w of agent_wallets) wMap.set(w.id, w);
      db.agent_wallets = Array.from(wMap.values());
    }

    if (Array.isArray(agent_transactions) && agent_transactions.length > 0) {
      const atMap = new Map<string, AgentTransactionModel>();
      for (const at of db.agent_transactions) atMap.set(at.id, at);
      for (const at of agent_transactions) atMap.set(at.id, at);
      db.agent_transactions = Array.from(atMap.values()).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }

    writeDB(db);

    // Run backend Supabase auto-sync
    const syncRes = await syncBackendDataWithSupabase();
    const updatedDB = readDB();

    res.json({
      success: true,
      message: syncRes.message,
      data: {
        categories: updatedDB.categories,
        transactions: updatedDB.transactions,
        agent_wallets: updatedDB.agent_wallets,
        agent_transactions: updatedDB.agent_transactions,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Sync failed' });
  }
});

// 3. Categories Endpoints
app.get('/api/categories', async (req: Request, res: Response) => {
  const db = readDB();
  res.json({ categories: db.categories });
});

app.post('/api/categories', async (req: Request, res: Response) => {
  const { name, user_id } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Category name is required' });
  }

  const trimmed = name.trim();
  const db = readDB();

  const newCat: CategoryModel = {
    id: generateUUID(),
    user_id: user_id ? String(user_id) : undefined,
    name: trimmed,
    created_at: new Date().toISOString(),
  };

  db.categories.push(newCat);
  writeDB(db);

  // Trigger non-blocking backend sync
  syncBackendDataWithSupabase().catch(console.warn);

  res.status(201).json({ category: newCat });
});

app.put('/api/categories/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });

  const db = readDB();
  const target = db.categories.find((c) => c.id === id);
  if (!target) return res.status(404).json({ error: 'Category not found' });

  target.name = name.trim();
  writeDB(db);

  syncBackendDataWithSupabase().catch(console.warn);
  res.json({ category: target });
});

app.delete('/api/categories/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const db = readDB();
  db.categories = db.categories.filter((c) => c.id !== id);
  writeDB(db);

  const sb = getSupabase();
  if (sb) {
    sb.from('categories').delete().eq('id', id).then(null, console.warn);
  }

  res.json({ success: true });
});

// 4. Shop Transactions Endpoints (Sales & Expenses)
app.get('/api/transactions', async (req: Request, res: Response) => {
  const db = readDB();
  res.json({ transactions: db.transactions });
});

app.post('/api/transactions', async (req: Request, res: Response) => {
  const {
    id,
    user_id,
    type,
    category,
    description,
    amount,
    payment_method,
    customer_name,
    customer_phone,
    receipt_url,
    created_at,
  } = req.body;

  if (!type || !category || typeof amount !== 'number' || !payment_method) {
    return res.status(400).json({ error: 'Missing required transaction fields' });
  }

  const validPayment = ['cash', 'bkash', 'nagad'].includes(payment_method)
    ? payment_method
    : 'cash';

  const newTx: TransactionModel = {
    id: id ? toValidUUID(id) : generateUUID(),
    user_id: user_id ? String(user_id) : undefined,
    type: type as 'sale' | 'expense',
    category: String(category),
    description: String(description || category),
    amount: Number(amount),
    payment_method: validPayment as 'cash' | 'bkash' | 'nagad',
    customer_name: customer_name ? String(customer_name) : undefined,
    customer_phone: customer_phone ? String(customer_phone) : undefined,
    receipt_url: receipt_url ? String(receipt_url) : undefined,
    created_at: created_at || new Date().toISOString(),
  };

  const db = readDB();
  db.transactions.unshift(newTx);
  writeDB(db);

  // Auto-sync in background
  syncBackendDataWithSupabase().catch(console.warn);

  res.status(201).json({ transaction: newTx });
});

app.delete('/api/transactions/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const db = readDB();
  db.transactions = db.transactions.filter((t) => t.id !== id);
  writeDB(db);

  const sb = getSupabase();
  if (sb) {
    sb.from('transactions').delete().eq('id', id).then(null, console.warn);
  }

  res.json({ success: true });
});

// 5. Agent Wallets Endpoints (bKash & Nagad Agent accounts)
app.get('/api/agent/wallets', async (req: Request, res: Response) => {
  const db = readDB();
  res.json({ wallets: db.agent_wallets });
});

app.put('/api/agent/wallets/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const updateData = req.body;

  const db = readDB();
  const existingIndex = db.agent_wallets.findIndex((w) => w.id === id);

  const updatedWallet: AgentWalletModel = {
    id,
    provider: updateData.provider || 'bkash',
    account_number: updateData.account_number || '',
    name: updateData.name || '',
    current_balance: Number(updateData.current_balance ?? 0),
    cash_in_hand: Number(updateData.cash_in_hand ?? 0),
    user_id: updateData.user_id,
    updated_at: new Date().toISOString(),
  };

  if (existingIndex >= 0) {
    db.agent_wallets[existingIndex] = updatedWallet;
  } else {
    db.agent_wallets.push(updatedWallet);
  }
  writeDB(db);

  syncBackendDataWithSupabase().catch(console.warn);
  res.json({ wallet: updatedWallet });
});

// 6. Agent Transactions Endpoints (Cash In, Cash Out, Bill Pay, DSR Float)
app.get('/api/agent/transactions', async (req: Request, res: Response) => {
  const db = readDB();
  res.json({ transactions: db.agent_transactions });
});

app.post('/api/agent/transactions', async (req: Request, res: Response) => {
  const {
    id,
    user_id,
    provider,
    type,
    amount,
    commission,
    customer_phone,
    customer_name,
    trx_id,
    bill_type,
    bill_number,
    note,
    wallet_id,
    created_at,
  } = req.body;

  if (!provider || !type || typeof amount !== 'number' || !customer_phone) {
    return res.status(400).json({ error: 'Missing required agent transaction fields' });
  }

  const txAmount = Number(amount);
  const db = readDB();

  // Auto update wallet float & drawer cash based on Bangladesh MFS agent principles
  const targetWallet =
    db.agent_wallets.find((w) => (wallet_id ? w.id === wallet_id : w.provider === provider)) ||
    db.agent_wallets.find((w) => w.provider === provider);

  if (targetWallet) {
    let newBalance = targetWallet.current_balance;
    let newCash = targetWallet.cash_in_hand ?? 0;

    if (type === 'cash_in') {
      newBalance = Math.max(0, newBalance - txAmount);
      newCash = newCash + txAmount;
    } else if (type === 'cash_out') {
      newBalance = newBalance + txAmount;
      newCash = Math.max(0, newCash - txAmount);
    } else if (type === 'bill_pay') {
      newBalance = Math.max(0, newBalance - txAmount);
      newCash = newCash + txAmount;
    } else if (type === 'dsr_balance_in') {
      newBalance = newBalance + txAmount;
      newCash = Math.max(0, newCash - txAmount);
    } else if (type === 'balance_adjustment') {
      newBalance = txAmount;
    }

    targetWallet.current_balance = newBalance;
    targetWallet.cash_in_hand = newCash;
    targetWallet.updated_at = new Date().toISOString();
  }

  const newAgentTx: AgentTransactionModel = {
    id: id ? toValidUUID(id) : generateUUID(),
    user_id: user_id ? String(user_id) : undefined,
    provider: provider as 'bkash' | 'nagad' | 'rocket' | 'upay',
    type: String(type),
    amount: txAmount,
    commission: Number(commission || 0),
    customer_phone: String(customer_phone),
    customer_name: customer_name ? String(customer_name) : undefined,
    trx_id: trx_id ? String(trx_id) : undefined,
    bill_type: bill_type ? String(bill_type) : undefined,
    bill_number: bill_number ? String(bill_number) : undefined,
    note: note ? String(note) : undefined,
    wallet_id: targetWallet?.id || wallet_id,
    created_at: created_at || new Date().toISOString(),
  };

  db.agent_transactions.unshift(newAgentTx);
  writeDB(db);

  // Auto-sync in background
  syncBackendDataWithSupabase().catch(console.warn);

  res.status(201).json({
    transaction: newAgentTx,
    updated_wallets: db.agent_wallets,
  });
});

app.delete('/api/agent/transactions/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const db = readDB();
  const target = db.agent_transactions.find((t) => t.id === id);

  if (target) {
    // Revert wallet balance
    const targetWallet = db.agent_wallets.find((w) => w.provider === target.provider);
    if (targetWallet) {
      if (target.type === 'cash_in') {
        targetWallet.current_balance += target.amount;
        targetWallet.cash_in_hand = Math.max(0, (targetWallet.cash_in_hand ?? 0) - target.amount);
      } else if (target.type === 'cash_out') {
        targetWallet.current_balance = Math.max(0, targetWallet.current_balance - target.amount);
        targetWallet.cash_in_hand = (targetWallet.cash_in_hand ?? 0) + target.amount;
      } else if (target.type === 'bill_pay') {
        targetWallet.current_balance += target.amount;
        targetWallet.cash_in_hand = Math.max(0, (targetWallet.cash_in_hand ?? 0) - target.amount);
      } else if (target.type === 'dsr_balance_in') {
        targetWallet.current_balance = Math.max(0, targetWallet.current_balance - target.amount);
        targetWallet.cash_in_hand = (targetWallet.cash_in_hand ?? 0) + target.amount;
      }
      targetWallet.updated_at = new Date().toISOString();
    }
  }

  db.agent_transactions = db.agent_transactions.filter((t) => t.id !== id);
  writeDB(db);

  const sb = getSupabase();
  if (sb) {
    sb.from('agent_transactions').delete().eq('id', id).then(null, console.warn);
  }

  res.json({ success: true, updated_wallets: db.agent_wallets });
});

// 7. Full Backup Export and Restore
app.get('/api/backup/export', (req: Request, res: Response) => {
  const db = readDB();
  const backupData = {
    app: 'Online Sheba',
    version: '3.0',
    exportDate: new Date().toISOString(),
    categories: db.categories,
    transactions: db.transactions,
    agent_wallets: db.agent_wallets,
    agent_transactions: db.agent_transactions,
    sync_meta: db.sync_meta,
  };
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename=OnlineSheba_Backup_${new Date().toISOString().slice(0, 10)}.json`);
  res.json(backupData);
});

app.post('/api/backup/restore', async (req: Request, res: Response) => {
  try {
    const data = req.body;
    if (!data.transactions && !data.categories && !data.agent_transactions) {
      return res.status(400).json({ error: 'Invalid backup format' });
    }

    const db = readDB();
    if (Array.isArray(data.categories)) db.categories = data.categories;
    if (Array.isArray(data.transactions)) db.transactions = data.transactions;
    if (Array.isArray(data.agent_wallets)) db.agent_wallets = data.agent_wallets;
    if (Array.isArray(data.agent_transactions)) db.agent_transactions = data.agent_transactions;
    writeDB(db);

    syncBackendDataWithSupabase().catch(console.warn);

    res.json({
      success: true,
      message: `Restored ${db.transactions.length} sales/expenses, ${db.agent_transactions.length} agent transactions, and ${db.categories.length} categories.`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to restore' });
  }
});

// 8. Digital Receipts Upload
app.post('/api/receipts/upload', async (req: Request, res: Response) => {
  try {
    const { imageData, fileName } = req.body;
    if (!imageData) {
      return res.status(400).json({ error: 'Image data is required' });
    }

    const cleanName = (fileName || `receipt_${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '');
    const finalFileName = `${cleanName}.png`;

    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    const sb = getSupabase();
    if (sb) {
      try {
        const filePath = `receipts/${Date.now()}-${finalFileName}`;
        const { error: uploadError } = await sb.storage.from('receipts').upload(filePath, buffer, {
          contentType: 'image/png',
          upsert: true,
        });

        if (!uploadError) {
          const { data } = sb.storage.from('receipts').getPublicUrl(filePath);
          return res.json({ url: data.publicUrl, provider: 'cloud' });
        }
      } catch (err) {
        console.warn('Supabase storage exception:', err);
      }
    }

    // Save on server statically
    const localFilePath = path.join(uploadsDir, finalFileName);
    fs.writeFileSync(localFilePath, buffer);

    const relativeUrl = `/uploads/receipts/${finalFileName}`;
    res.json({ url: relativeUrl, provider: 'server' });
  } catch (err: any) {
    console.error('Receipt upload error:', err);
    res.status(500).json({ error: err.message || 'Failed to save receipt' });
  }
});

// ---------------- VITE MIDDLEWARE / PRODUCTION SERVE ----------------

async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend Server running with auto-sync on http://0.0.0.0:${PORT}`);
  });
}

startServer();
