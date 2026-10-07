/**
 * Online Sheba - Daily Sales, Expense and Accounts Management
 * Multi-Tenant Protected Architecture with User Authentication & Excel Export
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { FinancialDashboard } from './components/FinancialDashboard';
import { QuickBilling } from './components/QuickBilling';
import { ExpenseTracker } from './components/ExpenseTracker';
import { TransactionHistory } from './components/TransactionHistory';
import { CategoryModal } from './components/CategoryModal';
import { ReceiptModal } from './components/ReceiptModal';
import { ReceiptViewerModal } from './components/ReceiptViewerModal';
import { AuthModal } from './components/AuthModal';
import {
  getCurrentUser,
  fetchCategories,
  fetchTransactions,
  addCategory,
  updateCategory,
  deleteCategory,
  addTransaction,
  deleteTransaction,
  signOut,
} from './lib/api';
import { Category, Transaction, UserProfile } from './types';

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedDateFilter, setSelectedDateFilter] = useState<
    'today' | 'yesterday' | 'week' | 'month' | 'all'
  >('today');

  // Modals
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState<boolean>(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState<boolean>(false);
  const [viewingReceiptUrl, setViewingReceiptUrl] = useState<string | null>(null);

  // Check initial user authentication session
  useEffect(() => {
    getCurrentUser()
      .then((user) => {
        setCurrentUser(user);
      })
      .finally(() => {
        setIsAuthChecking(false);
      });
  }, []);

  // Load current user's isolated data
  const loadUserData = useCallback(async (userId: string) => {
    if (!userId) return;
    setIsLoading(true);
    try {
      const [cats, txs] = await Promise.all([
        fetchCategories(userId),
        fetchTransactions(userId),
      ]);
      setCategories(cats || []);
      setTransactions(txs || []);
    } catch (err) {
      console.error('Error fetching user accounts data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentUser?.id) {
      loadUserData(currentUser.id);
    }
  }, [currentUser, loadUserData]);

  // Auth Handlers
  const handleAuthSuccess = (user: UserProfile) => {
    setCurrentUser(user);
    loadUserData(user.id);
  };

  const handleSignOut = async () => {
    await signOut();
    setCurrentUser(null);
    setCategories([]);
    setTransactions([]);
  };

  // Category Actions
  const handleAddCategory = async (name: string) => {
    if (!currentUser) return;
    const created = await addCategory(currentUser.id, name);
    setCategories((prev) => [...prev, created]);
  };

  const handleUpdateCategory = async (id: string, newName: string) => {
    if (!currentUser) return;
    const updated = await updateCategory(currentUser.id, id, newName);
    setCategories((prev) => prev.map((c) => (c.id === id ? updated : c)));
  };

  const handleDeleteCategory = async (id: string) => {
    if (!currentUser) return;
    await deleteCategory(currentUser.id, id);
    setCategories((prev) => prev.filter((c) => c.id !== id));
  };

  // Transaction Actions
  const handleAddSale = async (sale: Omit<Transaction, 'id' | 'created_at' | 'user_id'>) => {
    if (!currentUser) return;
    const created = await addTransaction(currentUser.id, sale);
    setTransactions((prev) => [created, ...prev]);
  };

  const handleAddExpense = async (expense: Omit<Transaction, 'id' | 'created_at' | 'user_id'>) => {
    if (!currentUser) return;
    const created = await addTransaction(currentUser.id, expense);
    setTransactions((prev) => [created, ...prev]);
  };

  const handleDeleteTransaction = async (id: string) => {
    if (!currentUser) return;
    await deleteTransaction(currentUser.id, id);
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  };

  const handleSaveReceiptTransaction = async (tx: Omit<Transaction, 'id' | 'created_at' | 'user_id'>) => {
    if (!currentUser) throw new Error('You must be logged in.');
    const created = await addTransaction(currentUser.id, tx);
    setTransactions((prev) => [created, ...prev]);
    return created;
  };

  const currentShopName = currentUser?.shop_name || 'Online Sheba';

  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-zinc-900 text-white flex items-center justify-center font-bold animate-pulse">
            OS
          </div>
          <span className="text-xs text-zinc-500 font-semibold">Loading Accounts Center...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans text-zinc-900 selection:bg-indigo-100">
      {/* 1. Header with Current User & Shop Details */}
      <Header
        currentUser={currentUser}
        isLoading={isLoading}
        onRefresh={() => currentUser && loadUserData(currentUser.id)}
        onOpenCategories={() => setIsCategoryModalOpen(true)}
        onOpenReceiptModal={() => setIsReceiptModalOpen(true)}
        onSignOut={handleSignOut}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* 2. Financial Dashboard */}
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
              shopName={currentShopName}
              onViewReceipt={(url) => setViewingReceiptUrl(url)}
            />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 bg-white py-4 text-xs text-zinc-500 no-print mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
          <p className="font-medium">
            © {new Date().getFullYear()} <span className="font-bold text-zinc-800">{currentShopName}</span> — Daily Accounts Management
          </p>
          <div className="flex items-center gap-2 text-zinc-400">
            <span className="font-semibold text-emerald-700">Cash</span>
            <span>•</span>
            <span className="font-semibold text-[#e2136e]">bKash</span>
            <span>•</span>
            <span className="font-semibold text-[#ea580c]">Nagad</span>
            <span>•</span>
            <span className="text-zinc-500 font-medium">Secured & Isolated</span>
          </div>
        </div>
      </footer>

      {/* Authentication Modal Gate (Shown when not logged in) */}
      <AuthModal
        isOpen={!currentUser}
        onSuccess={handleAuthSuccess}
      />

      {/* Categories Management Modal */}
      <CategoryModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        categories={categories}
        onAddCategory={handleAddCategory}
        onUpdateCategory={handleUpdateCategory}
        onDeleteCategory={handleDeleteCategory}
        isLoading={isLoading}
      />

      {/* Cash Memo & Digital Receipt Modal (With Thermal & A4 Print Formats) */}
      <ReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        categories={categories}
        shopName={currentShopName}
        onSaveReceiptTransaction={handleSaveReceiptTransaction}
      />

      {/* Receipt Viewer Modal */}
      <ReceiptViewerModal
        receiptUrl={viewingReceiptUrl}
        onClose={() => setViewingReceiptUrl(null)}
      />
    </div>
  );
}
