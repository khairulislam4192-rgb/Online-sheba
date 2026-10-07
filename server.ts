import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

// Backend-Only Supabase Credentials loaded securely from process.env (.env file)
const SUPABASE_PROJECT_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SECRET_KEY = process.env.SUPABASE_KEY || '';
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_ANON_KEY || '';

// Middleware for parsing JSON with generous limit for image uploads
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Ensure data and uploads directories exist
const dataDir = path.join(__dirname, 'data');
const uploadsDir = path.join(__dirname, 'uploads', 'receipts');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Serve uploaded receipts statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const dbFilePath = path.join(dataDir, 'db.json');

interface LocalDB {
  categories: Array<{ id: string; name: string; created_at: string }>;
  transactions: Array<{
    id: string;
    type: 'sale' | 'expense';
    category: string;
    description: string;
    amount: number;
    payment_method: 'cash' | 'bkash' | 'nagad';
    customer_name?: string;
    customer_phone?: string;
    receipt_url?: string;
    created_at: string;
  }>;
}

const defaultCategories = [
  { id: 'cat-1', name: 'Photocopy', created_at: new Date().toISOString() },
  { id: 'cat-2', name: 'Composition & Typing', created_at: new Date().toISOString() },
  { id: 'cat-3', name: 'Online Govt Application', created_at: new Date().toISOString() },
  { id: 'cat-4', name: 'Job Form Fill-Up', created_at: new Date().toISOString() },
  { id: 'cat-5', name: 'Photo Print & Laminating', created_at: new Date().toISOString() },
  { id: 'cat-6', name: 'Scan & Email Services', created_at: new Date().toISOString() },
  { id: 'cat-7', name: 'Other Online Service', created_at: new Date().toISOString() },
];

function readDB(): LocalDB {
  try {
    if (!fs.existsSync(dbFilePath)) {
      const initial: LocalDB = {
        categories: defaultCategories,
        transactions: [
          {
            id: 'tx-init-1',
            type: 'sale',
            category: 'Photocopy',
            description: '50 Pages Photocopy',
            amount: 150,
            payment_method: 'cash',
            created_at: new Date().toISOString(),
          },
          {
            id: 'tx-init-2',
            type: 'sale',
            category: 'Online Govt Application',
            description: 'Govt Job Application Form',
            amount: 250,
            payment_method: 'bkash',
            customer_name: 'Rafiqul Islam',
            customer_phone: '01712345678',
            created_at: new Date().toISOString(),
          },
          {
            id: 'tx-init-3',
            type: 'sale',
            category: 'Composition & Typing',
            description: 'Legal Deed Typing',
            amount: 200,
            payment_method: 'nagad',
            customer_name: 'Sumon Ahmed',
            customer_phone: '01987654321',
            created_at: new Date().toISOString(),
          },
          {
            id: 'tx-init-4',
            type: 'expense',
            category: 'Paper & Stationery',
            description: 'A4 Size Paper 1 Ream',
            amount: 450,
            payment_method: 'cash',
            created_at: new Date().toISOString(),
          },
        ],
      };
      fs.writeFileSync(dbFilePath, JSON.stringify(initial, null, 2), 'utf-8');
      return initial;
    }
    const content = fs.readFileSync(dbFilePath, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    console.error('Error reading local db:', err);
    return {
      categories: defaultCategories,
      transactions: [],
    };
  }
}

function writeDB(data: LocalDB) {
  try {
    fs.writeFileSync(dbFilePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing local db:', err);
  }
}

// Server-side Supabase client singleton
let supabaseClient: SupabaseClient | null = null;

function getSupabase(): SupabaseClient | null {
  if (supabaseClient) return supabaseClient;

  // Prefer secret key for backend administrative access, or fallback to publishable
  const keyToUse = SUPABASE_SECRET_KEY || SUPABASE_PUBLISHABLE_KEY;
  if (!SUPABASE_PROJECT_URL || !keyToUse) return null;

  try {
    supabaseClient = createClient(SUPABASE_PROJECT_URL, keyToUse, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return supabaseClient;
  } catch (err) {
    console.error('Failed to initialize server-side Supabase client:', err);
    return null;
  }
}

// ---------------- BACKEND API ENDPOINTS ----------------

// Status endpoint without leaking any credentials
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
    categoriesCount: db.categories.length,
    transactionsCount: db.transactions.length,
    isCloudSynced: isConnected,
  });
});

// Categories
app.get('/api/categories', async (req: Request, res: Response) => {
  const sb = getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb
        .from('categories')
        .select('*')
        .order('created_at', { ascending: true });

      if (!error && data && data.length > 0) {
        // Keep local copy synced
        const db = readDB();
        db.categories = data;
        writeDB(db);
        return res.json({ categories: data, source: 'cloud' });
      }
    } catch (e) {
      console.warn('Supabase categories fetch error:', e);
    }
  }

  const db = readDB();
  res.json({ categories: db.categories, source: 'backend' });
});

app.post('/api/categories', async (req: Request, res: Response) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Category name is required' });
  }

  const trimmed = name.trim();
  const sb = getSupabase();
  const now = new Date().toISOString();

  let createdCategory = {
    id: `cat-${Date.now()}`,
    name: trimmed,
    created_at: now,
  };

  if (sb) {
    try {
      const { data, error } = await sb
        .from('categories')
        .insert([{ name: trimmed }])
        .select()
        .single();

      if (error) {
        console.warn('Supabase insert category warning/error:', error.message);
        if (error.code === '23505') {
          return res.status(400).json({ error: 'A category with this name already exists.' });
        }
        // If table doesn't exist yet (PGRST205) or RLS error (42501), fallback gracefully to server DB
        if (error.code === 'PGRST205' || error.code === '42501' || error.message?.includes('schema cache') || error.message?.includes('row-level security')) {
          console.log('Falling back to backend storage while Supabase schema/RLS is being set up.');
        } else {
          console.warn('Supabase returned error, saving locally:', error.message);
        }
      }

      if (data) {
        createdCategory = data;
      }
    } catch (e: any) {
      console.warn('Supabase insert category exception, saving locally:', e.message);
    }
  }

  const db = readDB();
  db.categories.push(createdCategory);
  writeDB(db);

  res.status(201).json({ category: createdCategory });
});

app.delete('/api/categories/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const sb = getSupabase();

  if (sb) {
    try {
      await sb.from('categories').delete().eq('id', id);
    } catch (e) {
      console.warn('Supabase delete category error:', e);
    }
  }

  const db = readDB();
  db.categories = db.categories.filter((c) => c.id !== id);
  writeDB(db);

  res.json({ success: true });
});

// Transactions
app.get('/api/transactions', async (req: Request, res: Response) => {
  const sb = getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb
        .from('transactions')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        const db = readDB();
        db.transactions = data;
        writeDB(db);
        return res.json({ transactions: data, source: 'cloud' });
      }
    } catch (e) {
      console.warn('Supabase transactions fetch error:', e);
    }
  }

  const db = readDB();
  res.json({ transactions: db.transactions, source: 'backend' });
});

app.post('/api/transactions', async (req: Request, res: Response) => {
  const {
    type,
    category,
    description,
    amount,
    payment_method,
    customer_name,
    customer_phone,
    receipt_url,
  } = req.body;

  if (!type || !category || typeof amount !== 'number' || !payment_method) {
    return res.status(400).json({ error: 'Missing required transaction fields' });
  }

  const validPayment = ['cash', 'bkash', 'nagad'].includes(payment_method)
    ? payment_method
    : 'cash';
  const now = new Date().toISOString();

  let newTx = {
    id: `tx-${Date.now()}`,
    type: type as 'sale' | 'expense',
    category: String(category),
    description: String(description || category),
    amount: Number(amount),
    payment_method: validPayment as 'cash' | 'bkash' | 'nagad',
    customer_name: customer_name ? String(customer_name) : undefined,
    customer_phone: customer_phone ? String(customer_phone) : undefined,
    receipt_url: receipt_url ? String(receipt_url) : undefined,
    created_at: now,
  };

  const sb = getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb
        .from('transactions')
        .insert([
          {
            type: newTx.type,
            category: newTx.category,
            description: newTx.description,
            amount: newTx.amount,
            payment_method: newTx.payment_method,
            customer_name: newTx.customer_name || null,
            customer_phone: newTx.customer_phone || null,
            receipt_url: newTx.receipt_url || null,
            created_at: now,
          },
        ])
        .select()
        .single();

      if (error) {
        console.warn('Supabase insert transaction warning/error:', error.message);
        if (error.code === 'PGRST205' || error.code === '42501' || error.message?.includes('schema cache') || error.message?.includes('row-level security')) {
          console.log('Falling back to backend storage while Supabase schema/RLS is being set up.');
        } else {
          console.warn('Supabase returned error, saving transaction locally:', error.message);
        }
      }

      if (data) {
        newTx = data;
      }
    } catch (e: any) {
      console.warn('Supabase transaction exception, saving locally:', e.message);
    }
  }

  const db = readDB();
  db.transactions.unshift(newTx);
  writeDB(db);

  res.status(201).json({ transaction: newTx });
});

app.delete('/api/transactions/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const sb = getSupabase();

  if (sb) {
    try {
      await sb.from('transactions').delete().eq('id', id);
    } catch (e) {
      console.warn('Supabase delete transaction error:', e);
    }
  }

  const db = readDB();
  db.transactions = db.transactions.filter((t) => t.id !== id);
  writeDB(db);

  res.json({ success: true });
});

// Digital Receipt Upload (Stored to Supabase Storage or Server Statically)
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
        } else {
          console.warn('Supabase storage upload error:', uploadError.message);
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
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
