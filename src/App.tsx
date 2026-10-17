/**
 * Online Sheba - Daily Sales, Expense, Accounts Management & MFS Agent Ledger
 * Multi-Tenant Protected Architecture with User Authentication, bKash/Nagad Agent Point & Excel Export
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Store, Smartphone } from 'lucide-react';
import { Header } from './components/Header';
import { FinancialDashboard } from './components/FinancialDashboard';
import { QuickBilling } from './components/QuickBilling';
import { ExpenseTracker } from './components/ExpenseTracker';
import { TransactionHistory } from './components/TransactionHistory';
import { AgentSection } from './components/AgentSection';
import { CategoryModal } from './components/CategoryModal';
import { ReceiptModal } from './components/ReceiptModal';
import { ReceiptViewerModal } from './components/ReceiptViewerModal';
import { AuthModal } from './components/AuthModal';
import {
  getCurrentUser,
  fetchCategories,
  fetchTransactions,
  syncAllDataToSupabase,
  addCategory,
  updateCategory,
  deleteCategory,
  addTransaction,
  deleteTransaction,
  fetchAgentWallets,
  fetchAgentTransactions,
  addAgentTransaction,
  deleteAgentTransaction,
  updateAgentWallet,
  signOut,
} from './lib/api';
import {
  Category,
  Transaction,
  UserProfile,
  DateFilterType,
  AgentWallet,
  AgentTransaction,
  AppTab,
} from './types';

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<AppTab>('shop');

  // Shop Sales & Accounts States
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // Agent States (bKash & Nagad Agent)
  const [agentWallets, setAgentWallets] = useState<AgentWallet[]>([]);
  const [agentTransactions, setAgentTransactions] = useState<AgentTransaction[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedDateFilter, setSelectedDateFilter] = useState<DateFilterType>('today');
  const [customDate, setCustomDate] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

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

  // Load current user's isolated data (both shop sales and agent accounts)
  const loadUserData = useCallback(async (userId: string) => {
    if (!userId) return;
    setIsLoading(true);
    try {
      // Background two-way auto-sync ensuring server & local storage are unified
      await syncAllDataToSupabase(userId).catch(console.warn);

      const [cats, txs, wallets, agentTxs] = await Promise.all([
        fetchCategories(userId),
        fetchTransactions(userId),
        fetchAgentWallets(userId),
        fetchAgentTransactions(userId),
      ]);
      setCategories(cats || []);
      setTransactions(txs || []);
      setAgentWallets(wallets || []);
      setAgentTransactions(agentTxs || []);
    } catch (err) {
      console.error('Error fetching user accounts data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentUser?.id) {
      loadUserData(currentUser.id);

      // Silent background sync every 45 seconds to keep data unified across tabs
      const timer = setInterval(() => {
        syncAllDataToSupabase(currentUser.id).catch(() => {});
      }, 45000);
      return () => clearInterval(timer);
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
    setAgentWallets([]);
    setAgentTransactions([]);
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

  // Shop Transaction Actions
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

  // Agent Transaction Actions (bKash & Nagad)
  const handleAddAgentTransaction = async (
    agentTx: Omit<AgentTransaction, 'id' | 'created_at' | 'user_id'>
  ) => {
    if (!currentUser) throw new Error('You must be logged in.');
    const created = await addAgentTransaction(currentUser.id, agentTx);
    setAgentTransactions((prev) => [created, ...prev]);
    // Refresh wallets to get updated float balances
    const updatedWallets = await fetchAgentWallets(currentUser.id);
    setAgentWallets(updatedWallets);
    return created;
  };

  const handleDeleteAgentTransaction = async (id: string) => {
    if (!currentUser) return;
    await deleteAgentTransaction(currentUser.id, id);
    setAgentTransactions((prev) => prev.filter((at) => at.id !== id));
    // Refresh wallets to reflect reverted balance
    const updatedWallets = await fetchAgentWallets(currentUser.id);
    setAgentWallets(updatedWallets);
  };

  const handleUpdateAgentWallet = async (wallet: AgentWallet) => {
    if (!currentUser) throw new Error('You must be logged in.');
    const updated = await updateAgentWallet(currentUser.id, wallet);
    setAgentWallets((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
    return updated;
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
      {/* 1. Header with Current User & Shop Details + Tab Switcher */}
      <Header
        currentUser={currentUser}
        isLoading={isLoading}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        agentCount={agentTransactions.length}
        onRefresh={() => currentUser && loadUserData(currentUser.id)}
        onOpenCategories={() => setIsCategoryModalOpen(true)}
        onOpenReceiptModal={() => setIsReceiptModalOpen(true)}
        onSignOut={handleSignOut}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Main Section Navigation Switcher (Shop Accounts vs bKash/Nagad Agent) */}
        <div className="flex items-center justify-between border-b border-zinc-200/90 pb-3">
          <div className="flex items-center gap-2 bg-zinc-200/70 p-1.5 rounded-2xl w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('shop')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all ${
                activeTab === 'shop'
                  ? 'bg-white text-zinc-900 shadow-xs border border-zinc-200/80 ring-1 ring-zinc-900/5'
                  : 'text-zinc-600 hover:text-zinc-900 hover:bg-white/50'
              }`}
            >
              <Store className="w-4 h-4 text-indigo-600" />
              <span>দোকান বিক্রয় ও সাধারণ হিসাব (Shop Sales)</span>
            </button>

            <button
              onClick={() => setActiveTab('agent')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all ${
                activeTab === 'agent'
                  ? 'bg-zinc-900 text-white shadow-xs ring-1 ring-zinc-900'
                  : 'text-zinc-600 hover:text-zinc-900 hover:bg-white/50'
              }`}
            >
              <Smartphone className="w-4 h-4 text-pink-400" />
              <span>বিকাশ ও নগদ এজেন্ট খাতা (bKash & Nagad Agent)</span>
              {agentTransactions.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#e2136e] text-white">
                  {agentTransactions.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* 2. SECTION 1: SHOP POS & GENERAL ACCOUNTS */}
        {activeTab === 'shop' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            {/* Financial Dashboard */}
            <FinancialDashboard
              transactions={transactions}
              selectedDateFilter={selectedDateFilter}
              onDateFilterChange={setSelectedDateFilter}
              customDate={customDate}
              onCustomDateChange={setCustomDate}
              customStartDate={customStartDate}
              onCustomStartDateChange={setCustomStartDate}
              customEndDate={customEndDate}
              onCustomEndDateChange={setCustomEndDate}
            />

            {/* Operational Grid */}
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
                  onDateFilterChange={setSelectedDateFilter}
                  customDate={customDate}
                  onCustomDateChange={setCustomDate}
                  customStartDate={customStartDate}
                  onCustomStartDateChange={setCustomStartDate}
                  customEndDate={customEndDate}
                  onCustomEndDateChange={setCustomEndDate}
                  shopName={currentShopName}
                  onViewReceipt={(url) => setViewingReceiptUrl(url)}
                />
              </div>
            </div>
          </div>
        )}

        {/* 3. SECTION 2: BKASH & NAGAD AGENT POINT LEDGER */}
        {activeTab === 'agent' && (
          <div className="animate-in fade-in duration-150">
            <AgentSection
              userId={currentUser?.id || ''}
              shopName={currentShopName}
              wallets={agentWallets}
              transactions={agentTransactions}
              isLoading={isLoading}
              onAddTransaction={handleAddAgentTransaction}
              onDeleteTransaction={handleDeleteAgentTransaction}
              onUpdateWallet={handleUpdateAgentWallet}
              onRefresh={() => currentUser && loadUserData(currentUser.id)}
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 bg-white py-4 text-xs text-zinc-500 no-print mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
          <p className="font-medium">
            © {new Date().getFullYear()} <span className="font-bold text-zinc-800">{currentShopName}</span> — Accounts & MFS Agent Point
          </p>
          <div className="flex items-center gap-2 text-zinc-400">
            <span className="font-semibold text-emerald-700">Cash</span>
            <span>•</span>
            <span className="font-semibold text-[#e2136e]">bKash Agent</span>
            <span>•</span>
            <span className="font-semibold text-[#ea580c]">Nagad Agent</span>
            <span>•</span>
            <span className="text-zinc-500 font-medium">Auto Cloud Sync</span>
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
