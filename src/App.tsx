/**
 * Online Sheba - Daily Sales, Expense and Accounts Management
 * Professional Full-Stack Web App with Backend Server & Supabase Integration
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { FinancialDashboard } from './components/FinancialDashboard';
import { QuickBilling } from './components/QuickBilling';
import { ExpenseTracker } from './components/ExpenseTracker';
import { TransactionHistory } from './components/TransactionHistory';
import { CategoryModal } from './components/CategoryModal';
import { ReceiptModal } from './components/ReceiptModal';
import { SupabaseSettingsModal } from './components/SupabaseSettingsModal';
import { ReceiptViewerModal } from './components/ReceiptViewerModal';
import {
  getBackendStatus,
  fetchCategories,
  fetchTransactions,
  addCategory,
  deleteCategory,
  addTransaction,
  deleteTransaction,
} from './lib/api';
import { BackendStatus, Category, Transaction } from './types';

export default function App() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [backendStatus, setBackendStatus] = useState<BackendStatus | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedDateFilter, setSelectedDateFilter] = useState<
    'today' | 'yesterday' | 'week' | 'month' | 'all'
  >('today');

  // Modal Dialogs
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState<boolean>(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState<boolean>(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [viewingReceiptUrl, setViewingReceiptUrl] = useState<string | null>(null);

  // Fetch all data from backend API
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [statusRes, catRes, txRes] = await Promise.all([
        getBackendStatus().catch(() => null),
        fetchCategories(),
        fetchTransactions(),
      ]);

      setBackendStatus(statusRes);
      setCategories(catRes.categories || []);
      setTransactions(txRes.transactions || []);
    } catch (err) {
      console.error('Error fetching data from backend:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Category Actions
  const handleAddCategory = async (name: string) => {
    const created = await addCategory(name);
    setCategories((prev) => [...prev, created]);
  };

  const handleDeleteCategory = async (id: string) => {
    await deleteCategory(id);
    setCategories((prev) => prev.filter((c) => c.id !== id));
  };

  // Transaction Actions
  const handleAddSale = async (sale: Omit<Transaction, 'id' | 'created_at'>) => {
    const created = await addTransaction(sale);
    setTransactions((prev) => [created, ...prev]);
  };

  const handleAddExpense = async (expense: Omit<Transaction, 'id' | 'created_at'>) => {
    const created = await addTransaction(expense);
    setTransactions((prev) => [created, ...prev]);
  };

  const handleDeleteTransaction = async (id: string) => {
    await deleteTransaction(id);
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  };

  const handleSaveReceiptTransaction = async (tx: Omit<Transaction, 'id' | 'created_at'>) => {
    const created = await addTransaction(tx);
    setTransactions((prev) => [created, ...prev]);
    return created;
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans text-zinc-900 selection:bg-indigo-100">
      {/* 1. Header */}
      <Header
        backendStatus={backendStatus}
        isLoading={isLoading}
        onRefresh={loadData}
        onOpenCategories={() => setIsCategoryModalOpen(true)}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onOpenReceiptModal={() => setIsReceiptModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* 2. Financial Dashboard (with Cash, bKash, Nagad Breakdown & Dynamic Green/Red Profit Card) */}
        <FinancialDashboard
          transactions={transactions}
          selectedDateFilter={selectedDateFilter}
          onDateFilterChange={setSelectedDateFilter}
        />

        {/* 3. Operational Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column (5 cols): Quick Billing Counter & Daily Expense Tracker */}
          <div className="lg:col-span-5 space-y-6">
            <QuickBilling
              categories={categories}
              onAddSale={handleAddSale}
              isLoading={isLoading}
            />

            <ExpenseTracker
              onAddExpense={handleAddExpense}
              isLoading={isLoading}
            />
          </div>

          {/* Right Column (7 cols): Transaction Ledger */}
          <div className="lg:col-span-7">
            <TransactionHistory
              transactions={transactions}
              onDeleteTransaction={handleDeleteTransaction}
              isLoading={isLoading}
              selectedDateFilter={selectedDateFilter}
              onViewReceipt={(url) => setViewingReceiptUrl(url)}
            />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 bg-white py-4 text-xs text-zinc-500 no-print mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
          <p className="font-medium">
            © {new Date().getFullYear()} <span className="font-bold text-zinc-800">Online Sheba</span> — Accounts Management
          </p>
          <div className="flex items-center gap-2 text-zinc-400">
            <span className="font-semibold text-emerald-700">Cash</span>
            <span>•</span>
            <span className="font-semibold text-[#e2136e]">bKash</span>
            <span>•</span>
            <span className="font-semibold text-[#ea580c]">Nagad</span>
            <span>•</span>
            <button
              onClick={() => setIsSettingsModalOpen(true)}
              className="text-zinc-600 hover:text-zinc-900 underline font-semibold"
            >
              Database Setup
            </button>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <CategoryModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        categories={categories}
        onAddCategory={handleAddCategory}
        onDeleteCategory={handleDeleteCategory}
        isLoading={isLoading}
      />

      <ReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        categories={categories}
        onSaveReceiptTransaction={handleSaveReceiptTransaction}
        isRemote={Boolean(backendStatus?.isSupabaseConnected)}
      />

      <SupabaseSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        onConfigSaved={() => loadData()}
        isRemote={Boolean(backendStatus?.isSupabaseConnected)}
      />

      <ReceiptViewerModal
        receiptUrl={viewingReceiptUrl}
        onClose={() => setViewingReceiptUrl(null)}
      />
    </div>
  );
}
