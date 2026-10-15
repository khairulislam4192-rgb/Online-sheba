import React, { useState, useMemo } from 'react';
import {
  Smartphone,
  ArrowDownLeft,
  ArrowUpRight,
  Receipt,
  FileSpreadsheet,
  Search,
  Filter,
  Trash2,
  Check,
  Copy,
  Plus,
  RefreshCw,
  Coins,
  Settings,
  Calendar,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  SlidersHorizontal,
  X,
  CreditCard,
  Zap,
} from 'lucide-react';
import {
  AgentTransaction,
  AgentWallet,
  AgentProvider,
  AgentTransactionType,
  DateFilterType,
} from '../types';
import {
  exportAgentTransactionsToExcel,
} from '../lib/api';
import { AgentReceiptModal } from './AgentReceiptModal';

interface AgentSectionProps {
  userId: string;
  shopName: string;
  wallets: AgentWallet[];
  transactions: AgentTransaction[];
  isLoading: boolean;
  onAddTransaction: (
    tx: Omit<AgentTransaction, 'id' | 'created_at' | 'user_id'>
  ) => Promise<AgentTransaction>;
  onDeleteTransaction: (id: string) => Promise<void>;
  onUpdateWallet: (wallet: AgentWallet) => Promise<AgentWallet>;
  onRefresh: () => void;
}

export const AgentSection: React.FC<AgentSectionProps> = ({
  shopName,
  wallets,
  transactions,
  isLoading,
  onAddTransaction,
  onDeleteTransaction,
  onUpdateWallet,
  onRefresh,
}) => {
  // Form State
  const [provider, setProvider] = useState<AgentProvider>('bkash');
  const [type, setType] = useState<AgentTransactionType>('cash_in');
  const [amount, setAmount] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [trxId, setTrxId] = useState<string>('');
  const [customCommission, setCustomCommission] = useState<string>('');
  const [billType, setBillType] = useState<string>('পল্লি বিদ্যুৎ');
  const [billNumber, setBillNumber] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Filters & Date Search State
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
  const [providerFilter, setProviderFilter] = useState<'all' | AgentProvider>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | AgentTransactionType>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals
  const [printingTx, setPrintingTx] = useState<AgentTransaction | null>(null);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState<boolean>(false);
  const [editingWallet, setEditingWallet] = useState<AgentWallet | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Quick Amount Presets
  const quickAmounts = [500, 1000, 2000, 5000, 10000, 20000];

  // Bill Type Presets
  const commonBillTypes = [
    'পল্লি বিদ্যুৎ (পোস্টপেইড)',
    'পল্লি বিদ্যুৎ (প্রিপেইড)',
    'ডেসকো (DESCO)',
    'নেসকো (NESCO)',
    'তিতাস গ্যাস (Titas Gas)',
    'ওয়াসা (WASA Water)',
    'ইন্টারনেট বিল (ISP)',
    'সরকারি ফি (Govt Fee)',
  ];

  // Auto-calculated commission based on standard Bangladesh MFS rates (4.10 Tk per 1000 Tk)
  const calculatedCommission = useMemo(() => {
    const num = Number(amount);
    if (!num || isNaN(num) || num <= 0) return 0;
    if (customCommission !== '') return Number(customCommission) || 0;

    if (type === 'cash_in' || type === 'cash_out') {
      // Standard bKash/Nagad agent commission is ~4.10 Tk per 1,000 Tk (0.41%)
      return Math.round((num * 0.0041) * 100) / 100;
    }
    if (type === 'bill_pay') {
      // Standard bill pay agent commission is 5 to 10 Tk flat or 0.25%
      return Math.max(5, Math.round((num * 0.0025) * 100) / 100);
    }
    return 0;
  }, [amount, type, customCommission]);

  // Generate random authentic TrxID
  const handleAutoGenerateTrx = () => {
    const prefix = provider === 'bkash' ? 'BK' : provider === 'nagad' ? 'NG' : 'RC';
    const randChars = Math.random().toString(36).substring(2, 9).toUpperCase();
    setTrxId(`${prefix}${randChars}`);
  };

  // Wallets mapping
  const bkashWallet = wallets.find((w) => w.provider === 'bkash') || {
    id: 'wallet-bkash',
    provider: 'bkash',
    account_number: '01700-000000',
    name: 'বিকাশ এজেন্ট (bKash Agent)',
    current_balance: 0,
    cash_in_hand: 0,
    updated_at: new Date().toISOString(),
  };

  const nagadWallet = wallets.find((w) => w.provider === 'nagad') || {
    id: 'wallet-nagad',
    provider: 'nagad',
    account_number: '01800-000000',
    name: 'নগদ এজেন্ট (Nagad Agent)',
    current_balance: 0,
    cash_in_hand: 0,
    updated_at: new Date().toISOString(),
  };

  // Helper date parsing
  const getLocalISODate = (isoString: string): string => {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  // Date Filtering Logic
  const filteredTransactions = useMemo(() => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = `${sevenDaysAgo.getFullYear()}-${String(sevenDaysAgo.getMonth() + 1).padStart(2, '0')}-${String(sevenDaysAgo.getDate()).padStart(2, '0')}`;

    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    return transactions.filter((tx) => {
      const txLocalDate = getLocalISODate(tx.created_at);

      // Date Filter
      if (selectedDateFilter === 'today' && txLocalDate !== todayStr) return false;
      if (selectedDateFilter === 'yesterday' && txLocalDate !== yesterdayStr) return false;
      if (selectedDateFilter === 'week' && (txLocalDate < sevenDaysAgoStr || txLocalDate > todayStr)) return false;
      if (selectedDateFilter === 'month' && !txLocalDate.startsWith(currentYearMonth)) return false;
      if (selectedDateFilter === 'custom' && customDate && txLocalDate !== customDate) return false;
      if (selectedDateFilter === 'range') {
        const start = customStartDate || todayStr;
        const end = customEndDate || todayStr;
        if (txLocalDate < start || txLocalDate > end) return false;
      }

      // Provider Filter
      if (providerFilter !== 'all' && tx.provider !== providerFilter) return false;

      // Type Filter
      if (typeFilter !== 'all' && tx.type !== typeFilter) return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const phoneMatch = tx.customer_phone?.toLowerCase().includes(q);
        const nameMatch = tx.customer_name?.toLowerCase().includes(q);
        const trxMatch = tx.trx_id?.toLowerCase().includes(q);
        const billMatch = tx.bill_type?.toLowerCase().includes(q) || tx.bill_number?.toLowerCase().includes(q);
        const noteMatch = tx.note?.toLowerCase().includes(q);
        const amountMatch = String(tx.amount).includes(q);
        if (!phoneMatch && !nameMatch && !trxMatch && !billMatch && !noteMatch && !amountMatch) {
          return false;
        }
      }

      return true;
    });
  }, [
    transactions,
    selectedDateFilter,
    customDate,
    customStartDate,
    customEndDate,
    providerFilter,
    typeFilter,
    searchQuery,
  ]);

  // Aggregate stats for filtered records
  const stats = useMemo(() => {
    let totalCashIn = 0;
    let totalCashOut = 0;
    let totalBillPay = 0;
    let totalDsrLoad = 0;
    let totalCommission = 0;
    let bkashCount = 0;
    let nagadCount = 0;

    for (const tx of filteredTransactions) {
      const amt = Number(tx.amount) || 0;
      const comm = Number(tx.commission) || 0;

      totalCommission += comm;
      if (tx.provider === 'bkash') bkashCount++;
      if (tx.provider === 'nagad') nagadCount++;

      if (tx.type === 'cash_in') totalCashIn += amt;
      else if (tx.type === 'cash_out') totalCashOut += amt;
      else if (tx.type === 'bill_pay') totalBillPay += amt;
      else if (tx.type === 'dsr_balance_in') totalDsrLoad += amt;
    }

    return {
      totalCashIn,
      totalCashOut,
      totalBillPay,
      totalDsrLoad,
      totalCommission,
      netDrawerMovement: totalCashIn + totalBillPay - totalCashOut - totalDsrLoad,
      count: filteredTransactions.length,
      bkashCount,
      nagadCount,
    };
  }, [filteredTransactions]);

  // Submit Handler
  const handleSubmit = async (andPrint: boolean = false) => {
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      alert('অনুগ্রহ করে সঠিক টাকার পরিমাণ লিখুন।');
      return;
    }

    if (!customerPhone.trim() && type !== 'dsr_balance_in' && type !== 'balance_adjustment') {
      alert('অনুগ্রহ করে গ্রাহকের মোবাইল নম্বর লিখুন।');
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await onAddTransaction({
        provider,
        type,
        amount: numAmount,
        commission: calculatedCommission,
        customer_phone: customerPhone.trim() || 'DSR / Self',
        customer_name: customerName.trim() || undefined,
        trx_id: trxId.trim() || undefined,
        bill_type: type === 'bill_pay' ? billType : undefined,
        bill_number: type === 'bill_pay' && billNumber.trim() ? billNumber.trim() : undefined,
        note: note.trim() || undefined,
      });

      // Clear form
      setAmount('');
      setCustomerPhone('');
      setCustomerName('');
      setTrxId('');
      setCustomCommission('');
      setBillNumber('');
      setNote('');

      if (andPrint) {
        setPrintingTx(created);
      }
    } catch (err: any) {
      alert('লেনদেন সংরক্ষণ করতে সমস্যা হয়েছে: ' + (err.message || 'Error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleExportExcel = () => {
    let dateLabel: string = selectedDateFilter;
    if (selectedDateFilter === 'custom') dateLabel = customDate;
    if (selectedDateFilter === 'range') dateLabel = `${customStartDate}_to_${customEndDate}`;
    exportAgentTransactionsToExcel(filteredTransactions, shopName, dateLabel);
  };

  // Helper date shift
  const handleShiftDate = (direction: 'prev' | 'next') => {
    const cur = new Date(customDate + 'T00:00:00');
    if (isNaN(cur.getTime())) return;
    cur.setDate(cur.getDate() + (direction === 'next' ? 1 : -1));
    const shifted = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
    setCustomDate(shifted);
  };

  const resetAllFilters = () => {
    setSelectedDateFilter('today');
    setProviderFilter('all');
    setTypeFilter('all');
    setSearchQuery('');
  };

  return (
    <div className="space-y-6">
      {/* 1. AGENT FLOAT BALANCES CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* bKash Agent Card */}
        <div className="relative overflow-hidden bg-gradient-to-br from-[#e2136e] via-[#c20e5c] to-[#990b47] rounded-2xl p-5 text-white shadow-md border border-pink-400/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center font-black text-sm">
                bK
              </span>
              <div>
                <h3 className="font-black text-sm tracking-tight">বিকাশ এজেন্ট (bKash Agent)</h3>
                <p className="text-[11px] text-pink-100 font-mono">{bkashWallet.account_number}</p>
              </div>
            </div>
            <button
              onClick={() => {
                setEditingWallet(bkashWallet);
                setIsWalletModalOpen(true);
              }}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors text-xs flex items-center gap-1 font-semibold"
              title="ব্যালেন্স সমন্বয় / এডিট"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>এডিট</span>
            </button>
          </div>

          <div className="mt-4 pt-3 border-t border-white/20">
            <span className="text-[10px] uppercase font-bold tracking-wider text-pink-200">
              Agent B-SIM Digital Balance (ই-মানি)
            </span>
            <div className="text-2xl font-black tracking-tight text-white font-mono mt-0.5">
              ৳ {Number(bkashWallet.current_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-pink-100 font-medium">
              <span>ক্যাশ ড্রয়ার শেয়ার: ৳ {Number(bkashWallet.cash_in_hand || 0).toLocaleString('en-IN')}</span>
              <span className="bg-white/20 px-2 py-0.5 rounded-full text-[10px] font-bold">
                আজ {stats.bkashCount} লেনদেন
              </span>
            </div>
          </div>
        </div>

        {/* Nagad Agent Card */}
        <div className="relative overflow-hidden bg-gradient-to-br from-[#ea580c] via-[#c2410c] to-[#9a3412] rounded-2xl p-5 text-white shadow-md border border-orange-400/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center font-black text-sm">
                NG
              </span>
              <div>
                <h3 className="font-black text-sm tracking-tight">নগদ এজেন্ট (Nagad Agent)</h3>
                <p className="text-[11px] text-orange-100 font-mono">{nagadWallet.account_number}</p>
              </div>
            </div>
            <button
              onClick={() => {
                setEditingWallet(nagadWallet);
                setIsWalletModalOpen(true);
              }}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors text-xs flex items-center gap-1 font-semibold"
              title="ব্যালেন্স সমন্বয় / এডিট"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>এডিট</span>
            </button>
          </div>

          <div className="mt-4 pt-3 border-t border-white/20">
            <span className="text-[10px] uppercase font-bold tracking-wider text-orange-200">
              Agent B-SIM Digital Balance (ই-মানি)
            </span>
            <div className="text-2xl font-black tracking-tight text-white font-mono mt-0.5">
              ৳ {Number(nagadWallet.current_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-orange-100 font-medium">
              <span>ক্যাশ ড্রয়ার শেয়ার: ৳ {Number(nagadWallet.cash_in_hand || 0).toLocaleString('en-IN')}</span>
              <span className="bg-white/20 px-2 py-0.5 rounded-full text-[10px] font-bold">
                আজ {stats.nagadCount} লেনদেন
              </span>
            </div>
          </div>
        </div>

        {/* Total Estimated Commission & Summary */}
        <div className="bg-white rounded-2xl p-5 border border-zinc-200/90 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-amber-500" />
                <span>অর্জিত কমিশন ও লাভ</span>
              </span>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                মোট আয়
              </span>
            </div>
            <div className="text-2xl font-black text-emerald-600 mt-2 font-mono">
              ৳ {stats.totalCommission.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-zinc-500 mt-1">
              ফিল্টারকৃত মোট {stats.count} টি লেনদেন থেকে প্রাপ্ত কমিশন
            </p>
          </div>

          <div className="pt-3 mt-3 border-t border-zinc-100 grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-zinc-500 block text-[10px] uppercase font-bold">ক্যাশ ইন</span>
              <span className="font-bold text-zinc-900 font-mono">৳ {stats.totalCashIn.toLocaleString('en-IN')}</span>
            </div>
            <div>
              <span className="text-zinc-500 block text-[10px] uppercase font-bold">ক্যাশ আউট</span>
              <span className="font-bold text-zinc-900 font-mono">৳ {stats.totalCashOut.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. OPERATIONAL GRID: LEFT (QUICK AGENT ENTRY FORM) + RIGHT (TRANSACTIONS LEDGER) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (5 cols): Quick Agent Entry Form */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-zinc-200/90 shadow-xs p-5 space-y-5">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-zinc-900 text-white flex items-center justify-center font-bold">
                <Smartphone className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-sm font-black text-zinc-900 tracking-tight">দ্রুত এজেন্ট লেনদেন এন্ট্রি</h2>
                <p className="text-[11px] text-zinc-500">বিকাশ ও নগদ ক্যাশ-ইন / ক্যাশ-আউট হিসাব</p>
              </div>
            </div>
          </div>

          {/* Provider Selector: bKash vs Nagad vs Rocket */}
          <div>
            <label className="text-xs font-bold text-zinc-700 block mb-1.5">এজেন্ট অপারেটর বাছুন:</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setProvider('bkash')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  provider === 'bkash'
                    ? 'bg-[#e2136e] text-white border-[#e2136e] shadow-xs ring-2 ring-pink-300'
                    : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50'
                }`}
              >
                <span>bKash বিকাশ</span>
              </button>

              <button
                type="button"
                onClick={() => setProvider('nagad')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  provider === 'nagad'
                    ? 'bg-[#ea580c] text-white border-[#ea580c] shadow-xs ring-2 ring-orange-300'
                    : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50'
                }`}
              >
                <span>Nagad নগদ</span>
              </button>

              <button
                type="button"
                onClick={() => setProvider('rocket')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  provider === 'rocket'
                    ? 'bg-[#8b5cf6] text-white border-[#8b5cf6] shadow-xs ring-2 ring-purple-300'
                    : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50'
                }`}
              >
                <span>Rocket রকেট</span>
              </button>
            </div>
          </div>

          {/* Service Type Selector */}
          <div>
            <label className="text-xs font-bold text-zinc-700 block mb-1.5">লেনদেনের ধরন (Service Type):</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <button
                type="button"
                onClick={() => setType('cash_in')}
                className={`py-2 px-2 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                  type === 'cash_in'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-500 ring-2 ring-emerald-200 shadow-2xs'
                    : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'
                }`}
              >
                <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
                <span>ক্যাশ ইন</span>
              </button>

              <button
                type="button"
                onClick={() => setType('cash_out')}
                className={`py-2 px-2 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                  type === 'cash_out'
                    ? 'bg-orange-50 text-orange-800 border-orange-500 ring-2 ring-orange-200 shadow-2xs'
                    : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'
                }`}
              >
                <ArrowUpRight className="w-4 h-4 text-orange-600" />
                <span>ক্যাশ আউট</span>
              </button>

              <button
                type="button"
                onClick={() => setType('bill_pay')}
                className={`py-2 px-2 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                  type === 'bill_pay'
                    ? 'bg-blue-50 text-blue-800 border-blue-500 ring-2 ring-blue-200 shadow-2xs'
                    : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'
                }`}
              >
                <Zap className="w-4 h-4 text-blue-600" />
                <span>বিল পে</span>
              </button>

              <button
                type="button"
                onClick={() => setType('dsr_balance_in')}
                className={`py-2 px-2 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                  type === 'dsr_balance_in'
                    ? 'bg-purple-50 text-purple-800 border-purple-500 ring-2 ring-purple-200 shadow-2xs'
                    : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'
                }`}
              >
                <RefreshCw className="w-4 h-4 text-purple-600" />
                <span>DSR লোড</span>
              </button>
            </div>
            <p className="text-[10px] text-zinc-500 mt-1">
              {type === 'cash_in' && '• ক্যাশ ইন: গ্রাহক নগদ টাকা দিয়েছে (+ক্যাশ), আপনার B-SIM থেকে ই-মানি কমেছে (-ব্যালেন্স)।'}
              {type === 'cash_out' && '• ক্যাশ আউট: গ্রাহক এজেন্টকে ব্যালেন্স দিয়েছে (+ব্যালেন্স), আপনি নগদ টাকা দিলেন (-ক্যাশ)।'}
              {type === 'bill_pay' && '• বিল পে: বিদ্যুৎ/গ্যাস বিল পরিশোধ। B-SIM থেকে ব্যালেন্স কাটবে, গ্রাহক ক্যাশ টাকা দিবে।'}
              {type === 'dsr_balance_in' && '• ডিএসআর লোড: কোম্পানির প্রতিনিধির কাছ থেকে এজেন্ট সিম ব্যালেন্স ক্রয়।'}
            </p>
          </div>

          {/* Amount Input & Quick Chips */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-zinc-700">টাকার পরিমাণ (Amount ৳):</label>
              {calculatedCommission > 0 && (
                <span className="text-[11px] font-bold text-emerald-600">
                  কমিশন: ৳ {calculatedCommission}
                </span>
              )}
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 font-bold text-base">
                ৳
              </span>
              <input
                type="number"
                placeholder="যেমন: 2000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-base font-bold text-zinc-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900 font-mono transition-all"
              />
            </div>
            {/* Quick Chips */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {quickAmounts.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setAmount(String(q))}
                  className="px-2.5 py-1 text-[11px] font-semibold bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg transition-colors font-mono"
                >
                  +{q.toLocaleString('en-IN')}
                </button>
              ))}
            </div>
          </div>

          {/* Customer Phone & TrxID */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-zinc-700 block mb-1">
                গ্রাহকের মোবাইল নম্বর:
              </label>
              <input
                type="tel"
                placeholder="017xxxxxxxx"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono font-bold text-zinc-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-zinc-700">TrxID / ট্রানজেকশন আইডি:</label>
                <button
                  type="button"
                  onClick={handleAutoGenerateTrx}
                  className="text-[10px] font-bold text-indigo-600 hover:underline"
                >
                  অটো তৈরি
                </button>
              </div>
              <input
                type="text"
                placeholder="SMS থেকে TrxID দিন"
                value={trxId}
                onChange={(e) => setTrxId(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono uppercase text-zinc-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
              />
            </div>
          </div>

          {/* Bill Pay Extra Fields (Conditional) */}
          {type === 'bill_pay' && (
            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2.5 animate-in fade-in">
              <span className="text-xs font-bold text-blue-900 block">বিল পে বিস্তারিত:</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-blue-800 block mb-0.5">বিলের ধরন:</label>
                  <select
                    value={billType}
                    onChange={(e) => setBillType(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-blue-200 rounded-lg text-xs text-zinc-900"
                  >
                    {commonBillTypes.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-blue-800 block mb-0.5">হিসাব/মিটার নম্বর:</label>
                  <input
                    type="text"
                    placeholder="হিসাব বা বিল নম্বর"
                    value={billNumber}
                    onChange={(e) => setBillNumber(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-blue-200 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Optional Customer Name & Custom Commission Override */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-zinc-600 block mb-1">
                গ্রাহকের নাম / রেফারেন্স (ঐচ্ছিক):
              </label>
              <input
                type="text"
                placeholder="গ্রাহকের নাম"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-600 block mb-1">
                কমিশন পরিবর্তন (যদি আলাদা হয় ৳):
              </label>
              <input
                type="number"
                placeholder={`স্বাভাবিক: ৳ ${calculatedCommission}`}
                value={customCommission}
                onChange={(e) => setCustomCommission(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono text-zinc-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
              />
            </div>
          </div>

          {/* Optional Note */}
          <div>
            <label className="text-xs font-medium text-zinc-600 block mb-1">নোট / মন্তব্য (ঐচ্ছিক):</label>
            <input
              type="text"
              placeholder="যেকোনো বিশেষ নোট..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
            />
          </div>

          {/* Action Buttons: Save Only / Save & Print Slip */}
          <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => handleSubmit(false)}
              disabled={isSubmitting || !amount}
              className="w-full py-2.5 px-4 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-all shadow-xs flex items-center justify-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>{isSubmitting ? 'সংরক্ষণ হচ্ছে...' : 'সংরক্ষণ করুন'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleSubmit(true)}
              disabled={isSubmitting || !amount}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-all shadow-xs flex items-center justify-center gap-1.5"
            >
              <Receipt className="w-4 h-4" />
              <span>সংরক্ষণ ও স্লিপ প্রিন্ট</span>
            </button>
          </div>
        </div>

        {/* Right Column (7 cols): Date Search, Filters & Ledger Records Table */}
        <div className="lg:col-span-7 space-y-4">
          {/* Filter & Date Search Toolbar */}
          <div className="bg-white rounded-2xl border border-zinc-200/90 shadow-xs p-4 space-y-3">
            {/* Top Row: Date Preset Tabs + Export Excel */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 pb-3">
              {/* Date Filters Tabs */}
              <div className="flex flex-wrap items-center gap-1 bg-zinc-100 p-1 rounded-xl">
                <button
                  onClick={() => setSelectedDateFilter('today')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    selectedDateFilter === 'today'
                      ? 'bg-white text-zinc-900 shadow-2xs'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  আজ (Today)
                </button>
                <button
                  onClick={() => setSelectedDateFilter('yesterday')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    selectedDateFilter === 'yesterday'
                      ? 'bg-white text-zinc-900 shadow-2xs'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  গতকাল
                </button>
                <button
                  onClick={() => setSelectedDateFilter('week')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    selectedDateFilter === 'week'
                      ? 'bg-white text-zinc-900 shadow-2xs'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  ৭ দিন
                </button>
                <button
                  onClick={() => setSelectedDateFilter('month')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    selectedDateFilter === 'month'
                      ? 'bg-white text-zinc-900 shadow-2xs'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  এই মাস
                </button>
                <button
                  onClick={() => setSelectedDateFilter('all')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    selectedDateFilter === 'all'
                      ? 'bg-white text-zinc-900 shadow-2xs'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  সব রেকর্ড
                </button>
                <button
                  onClick={() => setSelectedDateFilter('custom')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                    selectedDateFilter === 'custom'
                      ? 'bg-zinc-900 text-white shadow-2xs'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  <Calendar className="w-3 h-3" />
                  <span>তারিখ বাছুন</span>
                </button>
                <button
                  onClick={() => setSelectedDateFilter('range')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                    selectedDateFilter === 'range'
                      ? 'bg-zinc-900 text-white shadow-2xs'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  <CalendarRange className="w-3 h-3" />
                  <span>পরিসীমা</span>
                </button>
              </div>

              {/* Excel Export Button */}
              <button
                onClick={handleExportExcel}
                disabled={filteredTransactions.length === 0}
                className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-xl transition-colors disabled:opacity-50"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>এক্সেল এক্সপোর্ট</span>
              </button>
            </div>

            {/* Custom Date Picker Bar (If Custom Date Active) */}
            {selectedDateFilter === 'custom' && (
              <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-indigo-50/70 border border-indigo-200 rounded-xl">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleShiftDate('prev')}
                    className="p-1 rounded-lg bg-white border border-indigo-200 hover:bg-indigo-100 text-indigo-700"
                    title="পূর্ববর্তী দিন"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <input
                    type="date"
                    value={customDate}
                    onChange={(e) => setCustomDate(e.target.value)}
                    className="px-2.5 py-1 bg-white border border-indigo-200 rounded-lg text-xs font-bold text-zinc-900 font-mono"
                  />
                  <button
                    onClick={() => handleShiftDate('next')}
                    className="p-1 rounded-lg bg-white border border-indigo-200 hover:bg-indigo-100 text-indigo-700"
                    title="পরবর্তী দিন"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <button
                  onClick={() => {
                    const now = new Date();
                    setCustomDate(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`);
                  }}
                  className="text-xs font-bold text-indigo-700 hover:underline"
                >
                  আজকের তারিখ সেট করুন
                </button>
              </div>
            )}

            {/* Date Range Picker Bar (If Range Active) */}
            {selectedDateFilter === 'range' && (
              <div className="flex flex-wrap items-center gap-2 p-2.5 bg-indigo-50/70 border border-indigo-200 rounded-xl">
                <span className="text-xs font-bold text-indigo-900">হতে:</span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-2 py-1 bg-white border border-indigo-200 rounded-lg text-xs font-mono text-zinc-900"
                />
                <span className="text-xs font-bold text-indigo-900">পর্যন্ত:</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-2 py-1 bg-white border border-indigo-200 rounded-lg text-xs font-mono text-zinc-900"
                />
              </div>
            )}

            {/* Middle Row: Operator Filter, Service Filter, and Smart Search Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-1">
              {/* Operator Filter */}
              <div className="sm:col-span-3">
                <select
                  value={providerFilter}
                  onChange={(e) => setProviderFilter(e.target.value as any)}
                  className="w-full px-2.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-800"
                >
                  <option value="all">সব অপারেটর (All)</option>
                  <option value="bkash">বিকাশ (bKash)</option>
                  <option value="nagad">নগদ (Nagad)</option>
                  <option value="rocket">রকেট (Rocket)</option>
                </select>
              </div>

              {/* Service Type Filter */}
              <div className="sm:col-span-3">
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as any)}
                  className="w-full px-2.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-800"
                >
                  <option value="all">সব সার্ভিস (All)</option>
                  <option value="cash_in">ক্যাশ ইন (Cash In)</option>
                  <option value="cash_out">ক্যাশ আউট (Cash Out)</option>
                  <option value="bill_pay">বিল পে (Bill Pay)</option>
                  <option value="dsr_balance_in">DSR লোড</option>
                </select>
              </div>

              {/* Smart Search Input */}
              <div className="sm:col-span-6 relative">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="নম্বর, TrxID, গ্রাহক বা নোট খুঁজুন..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Active Filter Summary Strip */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-100 text-[11px] text-zinc-500 font-medium">
              <div className="flex items-center gap-2">
                <span className="font-bold text-zinc-900">রেকর্ড: {filteredTransactions.length} টি</span>
                <span>•</span>
                <span className="text-emerald-700 font-semibold">
                  ক্যাশ ইন: ৳ {stats.totalCashIn.toLocaleString('en-IN')}
                </span>
                <span>•</span>
                <span className="text-orange-700 font-semibold">
                  ক্যাশ আউট: ৳ {stats.totalCashOut.toLocaleString('en-IN')}
                </span>
                <span>•</span>
                <span className="text-blue-700 font-semibold">
                  কমিশন: ৳ {stats.totalCommission.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>

              {(selectedDateFilter !== 'today' || providerFilter !== 'all' || typeFilter !== 'all' || searchQuery) && (
                <button
                  onClick={resetAllFilters}
                  className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-bold"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>ফিল্টার মুছুন</span>
                </button>
              )}
            </div>
          </div>

          {/* Transactions Ledger List / Table */}
          <div className="bg-white rounded-2xl border border-zinc-200/90 shadow-xs overflow-hidden">
            <div className="px-5 py-3 border-b border-zinc-100 flex items-center justify-between">
              <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                এজেন্ট লেনদেন খাতা (Ledger Records)
              </h3>
              <span className="text-[11px] text-zinc-400 font-medium">
                সর্বশেষ লেনদেন উপরে
              </span>
            </div>

            {filteredTransactions.length === 0 ? (
              <div className="p-12 text-center text-zinc-400">
                <Smartphone className="w-10 h-10 mx-auto text-zinc-300 stroke-1 mb-2" />
                <p className="text-xs font-semibold text-zinc-600">কোনো এজেন্ট লেনদেন পাওয়া যায়নি</p>
                <p className="text-[11px] text-zinc-400 mt-1">
                  বাঁদিকের ফরম থেকে নতুন ক্যাশ-ইন বা ক্যাশ-আউট এন্ট্রি করুন
                </p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-100 max-h-[620px] overflow-y-auto">
                {filteredTransactions.map((tx) => {
                  const dateObj = new Date(tx.created_at);
                  const timeFormatted = dateObj.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true,
                  });
                  const dateFormatted = dateObj.toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                  });

                  return (
                    <div
                      key={tx.id}
                      className="p-4 hover:bg-zinc-50/80 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                    >
                      {/* Left: Provider + Type Badge + Customer Info */}
                      <div className="flex items-start gap-3">
                        {/* Provider Indicator Icon */}
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-black text-xs text-white ${
                            tx.provider === 'bkash'
                              ? 'bg-[#e2136e]'
                              : tx.provider === 'nagad'
                              ? 'bg-[#ea580c]'
                              : 'bg-[#8b5cf6]'
                          }`}
                        >
                          {tx.provider === 'bkash' ? 'bK' : tx.provider === 'nagad' ? 'NG' : 'RC'}
                        </div>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* Type Badge */}
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 ${
                                tx.type === 'cash_in'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : tx.type === 'cash_out'
                                  ? 'bg-orange-50 text-orange-700 border border-orange-200'
                                  : tx.type === 'bill_pay'
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                  : 'bg-purple-50 text-purple-700 border border-purple-200'
                              }`}
                            >
                              {tx.type === 'cash_in' && <ArrowDownLeft className="w-3 h-3" />}
                              {tx.type === 'cash_out' && <ArrowUpRight className="w-3 h-3" />}
                              {tx.type === 'bill_pay' && <Zap className="w-3 h-3" />}
                              {tx.type === 'dsr_balance_in' && <RefreshCw className="w-3 h-3" />}
                              <span>
                                {tx.type === 'cash_in'
                                  ? 'ক্যাশ ইন'
                                  : tx.type === 'cash_out'
                                  ? 'ক্যাশ আউট'
                                  : tx.type === 'bill_pay'
                                  ? 'বিল পে'
                                  : 'DSR লোড'}
                              </span>
                            </span>

                            {/* Customer Phone (click to copy) */}
                            <button
                              onClick={() => handleCopyText(tx.customer_phone, `phone-${tx.id}`)}
                              className="font-bold text-xs font-mono text-zinc-900 hover:text-indigo-600 flex items-center gap-1"
                              title="কপি করতে ক্লিক করুন"
                            >
                              <span>{tx.customer_phone}</span>
                              {copiedId === `phone-${tx.id}` ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3 text-zinc-400 opacity-60 hover:opacity-100" />
                              )}
                            </button>

                            {tx.customer_name && (
                              <span className="text-[11px] text-zinc-500 font-medium">
                                ({tx.customer_name})
                              </span>
                            )}
                          </div>

                          {/* Sub line: Date & Time + TrxID + Bill Info */}
                          <div className="flex items-center gap-2 mt-1 text-[11px] text-zinc-400 font-mono flex-wrap">
                            <span className="text-zinc-600 font-semibold">{dateFormatted}, {timeFormatted}</span>
                            {tx.trx_id && (
                              <>
                                <span>•</span>
                                <button
                                  onClick={() => handleCopyText(tx.trx_id!, `trx-${tx.id}`)}
                                  className="text-indigo-600 font-semibold hover:underline flex items-center gap-0.5"
                                  title="TrxID কপি করুন"
                                >
                                  <span>Trx: {tx.trx_id}</span>
                                  {copiedId === `trx-${tx.id}` ? (
                                    <Check className="w-2.5 h-2.5 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-2.5 h-2.5" />
                                  )}
                                </button>
                              </>
                            )}
                            {tx.bill_type && (
                              <>
                                <span>•</span>
                                <span className="text-zinc-600">{tx.bill_type}</span>
                              </>
                            )}
                            {tx.note && (
                              <>
                                <span>•</span>
                                <span className="text-zinc-500 italic">{tx.note}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Amount + Commission + Action Buttons */}
                      <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-100">
                        <div className="text-left sm:text-right">
                          <div className="text-sm font-black text-zinc-900 font-mono">
                            ৳ {Number(tx.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </div>
                          <div className="text-[10px] text-emerald-700 font-bold font-mono">
                            +কমিশন: ৳ {Number(tx.commission || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          {/* Print Slip Button */}
                          <button
                            onClick={() => setPrintingTx(tx)}
                            className="p-1.5 text-zinc-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors border border-zinc-200"
                            title="রিসিট / স্লিপ প্রিন্ট"
                          >
                            <Receipt className="w-4 h-4 text-emerald-600" />
                          </button>

                          {/* Delete Button with inline confirmation */}
                          {deleteConfirmId === tx.id ? (
                            <div className="flex items-center gap-1 bg-red-50 p-1 rounded-lg border border-red-200">
                              <button
                                onClick={async () => {
                                  await onDeleteTransaction(tx.id);
                                  setDeleteConfirmId(null);
                                }}
                                className="text-[10px] font-bold text-red-700 hover:underline px-1"
                              >
                                নিশ্চিত?
                              </button>
                              <button
                                onClick={() => setDeleteConfirmId(null)}
                                className="text-[10px] text-zinc-500 hover:text-zinc-700"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirmId(tx.id)}
                              className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="মুছুন"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. AGENT RECEIPT / SLIP PRINT MODAL */}
      {printingTx && (
        <AgentReceiptModal
          transaction={printingTx}
          shopName={shopName}
          agentNumber={
            printingTx.provider === 'bkash'
              ? bkashWallet.account_number
              : nagadWallet.account_number
          }
          onClose={() => setPrintingTx(null)}
        />
      )}

      {/* 4. WALLET SETTINGS / DSR LOAD MODAL */}
      {isWalletModalOpen && editingWallet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-zinc-200 max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="text-sm font-black text-zinc-900">
                {editingWallet.provider === 'bkash' ? 'বিকাশ' : 'নগদ'} এজেন্ট ওয়ালেট সেটিংস
              </h3>
              <button
                onClick={() => setIsWalletModalOpen(false)}
                className="p-1 text-zinc-400 hover:text-zinc-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-zinc-700 block mb-1">এজেন্ট সিম নম্বর:</label>
                <input
                  type="text"
                  value={editingWallet.account_number}
                  onChange={(e) =>
                    setEditingWallet({ ...editingWallet, account_number: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-zinc-300 rounded-xl font-mono text-xs"
                />
              </div>

              <div>
                <label className="font-bold text-zinc-700 block mb-1">
                  বর্তমান ডিজিটাল ব্যালেন্স (ই-মানি ৳):
                </label>
                <input
                  type="number"
                  value={editingWallet.current_balance}
                  onChange={(e) =>
                    setEditingWallet({
                      ...editingWallet,
                      current_balance: Number(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 border border-zinc-300 rounded-xl font-mono font-bold text-sm text-zinc-900"
                />
                <p className="text-[10px] text-zinc-500 mt-1">
                  * DSR থেকে নতুন ব্যালেন্স লোড নিলে বা প্রাথমিক ব্যালেন্স বসাতে এখানে আপডেট করুন।
                </p>
              </div>

              <div>
                <label className="font-bold text-zinc-700 block mb-1">
                  ক্যাশ ইন হ্যান্ড (ক্যাশ ড্রয়ার শেয়ার ৳):
                </label>
                <input
                  type="number"
                  value={editingWallet.cash_in_hand || 0}
                  onChange={(e) =>
                    setEditingWallet({
                      ...editingWallet,
                      cash_in_hand: Number(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 border border-zinc-300 rounded-xl font-mono text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => setIsWalletModalOpen(false)}
                className="px-3 py-1.5 rounded-xl border border-zinc-300 text-xs text-zinc-700 hover:bg-zinc-50"
              >
                বাতিল
              </button>
              <button
                type="button"
                onClick={async () => {
                  await onUpdateWallet(editingWallet);
                  setIsWalletModalOpen(false);
                }}
                className="px-4 py-1.5 rounded-xl bg-zinc-900 text-white font-bold text-xs hover:bg-zinc-800"
              >
                সংরক্ষণ করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
