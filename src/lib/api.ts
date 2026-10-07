import { Category, Transaction } from '../types';

export async function getBackendStatus(): Promise<{
  isReady: boolean;
  categoriesCount: number;
  transactionsCount: number;
  isCloudSynced: boolean;
}> {
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
