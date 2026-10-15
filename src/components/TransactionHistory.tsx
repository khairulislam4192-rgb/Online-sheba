import React, { useState, useMemo } from 'react';
import {
  Trash2,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  FileSpreadsheet,
  FileText,
  Filter,
  Lock,
  Clock,
  Check,
  X,
  Calendar,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { PaymentMethod, Transaction, DateFilterType } from '../types';
import { exportTransactionsToExcel, TWELVE_HOURS_MS } from '../lib/api';

interface TransactionHistoryProps {
  transactions: Transaction[];
  onDeleteTransaction: (id: string) => Promise<void>;
  isLoading: boolean;
  selectedDateFilter?: DateFilterType;
  onDateFilterChange?: (filter: DateFilterType) => void;
  customDate?: string;
  onCustomDateChange?: (date: string) => void;
  customStartDate?: string;
  onCustomStartDateChange?: (date: string) => void;
  customEndDate?: string;
  onCustomEndDateChange?: (date: string) => void;
  shopName: string;
  onViewReceipt?: (url: string) => void;
}

function getLocalDateString(dateInput: Date | string | number): string {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDisplayDate(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      weekday: 'short',
    });
  } catch {
    return dateStr;
  }
}

export const TransactionHistory: React.FC<TransactionHistoryProps> = ({
  transactions,
  onDeleteTransaction,
  isLoading,
  selectedDateFilter = 'today',
  onDateFilterChange,
  customDate = getLocalDateString(new Date()),
  onCustomDateChange,
  customStartDate = getLocalDateString(new Date(Date.now() - 6 * 86400000)),
  onCustomStartDateChange,
  customEndDate = getLocalDateString(new Date()),
  onCustomEndDateChange,
  shopName,
  onViewReceipt,
}) => {
  // Local state if not controlled from parent
  const [localDateFilter, setLocalDateFilter] = useState<DateFilterType>(selectedDateFilter);
  const [localCustomDate, setLocalCustomDate] = useState<string>(customDate);
  const [localStartDate, setLocalStartDate] = useState<string>(customStartDate);
  const [localEndDate, setLocalEndDate] = useState<string>(customEndDate);

  const activeDateFilter = onDateFilterChange ? selectedDateFilter : localDateFilter;
  const activeCustomDate = onCustomDateChange ? customDate : localCustomDate;
  const activeStartDate = onCustomStartDateChange ? customStartDate : localStartDate;
  const activeEndDate = onCustomEndDateChange ? customEndDate : localEndDate;

  const handleSetDateFilter = (filter: DateFilterType) => {
    if (onDateFilterChange) onDateFilterChange(filter);
    else setLocalDateFilter(filter);
  };

  const handleSetCustomDate = (date: string) => {
    if (onCustomDateChange) onCustomDateChange(date);
    else setLocalCustomDate(date);
  };

  const handleSetStartDate = (date: string) => {
    if (onCustomStartDateChange) onCustomStartDateChange(date);
    else setLocalStartDate(date);
  };

  const handleSetEndDate = (date: string) => {
    if (onCustomEndDateChange) onCustomEndDateChange(date);
    else setLocalEndDate(date);
  };

  const [filterType, setFilterType] = useState<'all' | 'sale' | 'expense'>('all');
  const [filterPayment, setFilterPayment] = useState<'all' | PaymentMethod>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showDatePanel, setShowDatePanel] = useState<boolean>(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Day step handlers
  const handlePrevDay = () => {
    try {
      const [y, m, d] = activeCustomDate.split('-').map(Number);
      const prev = new Date(y, m - 1, d - 1);
      handleSetCustomDate(getLocalDateString(prev));
    } catch {
      // ignore
    }
  };

  const handleNextDay = () => {
    try {
      const [y, m, d] = activeCustomDate.split('-').map(Number);
      const next = new Date(y, m - 1, d + 1);
      handleSetCustomDate(getLocalDateString(next));
    } catch {
      // ignore
    }
  };

  const handleJumpToday = () => {
    handleSetCustomDate(getLocalDateString(new Date()));
  };

  // Filtered transactions list
  const filteredList = useMemo(() => {
    const todayStr = getLocalDateString(new Date());
    const yesterdayStr = getLocalDateString(new Date(Date.now() - 24 * 60 * 60 * 1000));
    const startOfWeek = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    return transactions.filter((tx) => {
      const txLocalDate = getLocalDateString(tx.created_at);
      const txTime = new Date(tx.created_at).getTime();

      // 1. Date filter matching
      let matchesDate = true;
      switch (activeDateFilter) {
        case 'today':
          matchesDate = txLocalDate === todayStr;
          break;
        case 'yesterday':
          matchesDate = txLocalDate === yesterdayStr;
          break;
        case 'week':
          matchesDate = txTime >= startOfWeek;
          break;
        case 'month':
          matchesDate = txTime >= startOfMonth;
          break;
        case 'custom':
          matchesDate = activeCustomDate ? txLocalDate === activeCustomDate : true;
          break;
        case 'range':
          if (activeStartDate && activeEndDate) {
            matchesDate = txLocalDate >= activeStartDate && txLocalDate <= activeEndDate;
          } else if (activeStartDate) {
            matchesDate = txLocalDate >= activeStartDate;
          } else if (activeEndDate) {
            matchesDate = txLocalDate <= activeEndDate;
          }
          break;
        case 'all':
        default:
          matchesDate = true;
          break;
      }

      if (!matchesDate) return false;

      // 2. Type filter
      if (filterType !== 'all' && tx.type !== filterType) return false;

      // 3. Payment method filter
      if (filterPayment !== 'all' && tx.payment_method !== filterPayment) return false;

      // 4. Smart search filter (matches category, description, customer name, phone, AND dates)
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const catMatch = tx.category.toLowerCase().includes(query);
        const descMatch = (tx.description || '').toLowerCase().includes(query);
        const nameMatch = (tx.customer_name || '').toLowerCase().includes(query);
        const phoneMatch = (tx.customer_phone || '').includes(query);

        // Date search matching: enables typing e.g. "2026-10-15", "15-10", "15/10", "15 Oct", "October"
        let dateMatch = false;
        try {
          const d = new Date(tx.created_at);
          const isoDate = txLocalDate; // YYYY-MM-DD
          const [yr, mn, dy] = isoDate.split('-');
          const dmyHyphen = `${dy}-${mn}-${yr}`; // DD-MM-YYYY
          const dmySlash = `${dy}/${mn}/${yr}`; // DD/MM/YYYY
          const shortDmy = `${dy}/${mn}`;
          const shortDmyHyphen = `${dy}-${mn}`;
          const formattedEn = d.toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          }).toLowerCase(); // e.g. "15 oct 2026"
          const formattedFull = d.toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          }).toLowerCase(); // e.g. "15 october 2026"

          if (
            isoDate.includes(query) ||
            dmyHyphen.includes(query) ||
            dmySlash.includes(query) ||
            shortDmy.includes(query) ||
            shortDmyHyphen.includes(query) ||
            formattedEn.includes(query) ||
            formattedFull.includes(query)
          ) {
            dateMatch = true;
          }
        } catch {
          // ignore
        }

        return catMatch || descMatch || nameMatch || phoneMatch || dateMatch;
      }

      return true;
    });
  }, [
    transactions,
    activeDateFilter,
    activeCustomDate,
    activeStartDate,
    activeEndDate,
    filterType,
    filterPayment,
    searchTerm,
  ]);

  // Metrics specifically for current filtered transactions view
  const summaryMetrics = useMemo(() => {
    let salesTotal = 0;
    let salesCount = 0;
    let expenseTotal = 0;
    let expenseCount = 0;
    let cashSales = 0;
    let bkashSales = 0;
    let nagadSales = 0;

    for (const tx of filteredList) {
      const amt = Number(tx.amount) || 0;
      if (tx.type === 'sale') {
        salesTotal += amt;
        salesCount += 1;
        if (tx.payment_method === 'cash') cashSales += amt;
        else if (tx.payment_method === 'bkash') bkashSales += amt;
        else if (tx.payment_method === 'nagad') nagadSales += amt;
      } else {
        expenseTotal += amt;
        expenseCount += 1;
      }
    }

    return {
      salesTotal,
      salesCount,
      expenseTotal,
      expenseCount,
      cashSales,
      bkashSales,
      nagadSales,
    };
  }, [filteredList]);

  // Execute deletion directly without browser window.confirm
  const executeDelete = async (tx: Transaction) => {
    const ageMs = Date.now() - new Date(tx.created_at).getTime();
    if (ageMs > TWELVE_HOURS_MS) {
      setDeleteError('This transaction is older than 12 hours and is permanently locked.');
      setConfirmDeleteId(null);
      return;
    }

    setDeletingId(tx.id);
    setDeleteError(null);
    try {
      await onDeleteTransaction(tx.id);
      setConfirmDeleteId(null);
    } catch (err: any) {
      setDeleteError(err.message || 'Could not delete entry.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleExportXLSX = () => {
    exportTransactionsToExcel(filteredList, shopName);
  };

  const formatItemDateTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const todayStr = getLocalDateString(new Date());
      const itemDateStr = getLocalDateString(isoString);
      const yesterdayStr = getLocalDateString(new Date(Date.now() - 24 * 60 * 60 * 1000));

      const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

      if (itemDateStr === todayStr) {
        return `Today, ${timeStr}`;
      } else if (itemDateStr === yesterdayStr) {
        return `Yesterday, ${timeStr}`;
      } else {
        const dStr = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        return `${dStr}, ${timeStr}`;
      }
    } catch {
      return '';
    }
  };

  const renderPaymentBadge = (method: PaymentMethod) => {
    switch (method) {
      case 'cash':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
            Cash
          </span>
        );
      case 'bkash':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pink-100 text-[#e2136e] border border-pink-300">
            bKash
          </span>
        );
      case 'nagad':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-[#ea580c] border border-orange-300">
            Nagad
          </span>
        );
    }
  };

  const dateFilterButtons = [
    { id: 'today', label: 'Today (আজ)' },
    { id: 'yesterday', label: 'Yesterday (গতকাল)' },
    { id: 'week', label: '7 Days' },
    { id: 'month', label: 'This Month' },
    { id: 'all', label: 'All Dates (সব)' },
    { id: 'custom', label: '📅 Pick Date (তারিখ বাছুন)' },
    { id: 'range', label: '📅 Range (পরিসীমা)' },
  ] as const;

  return (
    <div className="bg-white rounded-2xl border border-zinc-200/90 shadow-xs overflow-hidden flex flex-col h-full">
      {/* Header Bar */}
      <div className="p-4 sm:p-5 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-zinc-900 tracking-tight flex items-center gap-1.5">
              <span>Transaction Ledger</span>
              <span className="text-zinc-400 font-normal">/</span>
              <span className="text-xs font-semibold text-zinc-600">হিসাব খাতা</span>
            </h3>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-800">
              {filteredList.length} Records
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-0.5 flex items-center gap-1.5">
            <span>Accounts for {shopName}</span>
            <span className="text-zinc-300">•</span>
            <span className="text-amber-600 font-semibold flex items-center gap-1 text-[11px]">
              <Clock className="w-3 h-3" /> 12h Deletion Policy Active
            </span>
          </p>
        </div>

        {/* Search & Export Buttons */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-60">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search record, customer, or date..."
              className="w-full pl-8 pr-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <button
            onClick={handleExportXLSX}
            disabled={filteredList.length === 0}
            title="Export clean Excel (.XLSX) ledger with separate columns"
            className="p-2 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs disabled:opacity-50"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden sm:inline">Export Excel</span>
          </button>
        </div>
      </div>

      {deleteError && (
        <div className="mx-4 mt-3 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center justify-between">
          <span>{deleteError}</span>
          <button onClick={() => setDeleteError(null)} className="text-rose-500 hover:text-rose-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Date Search & Navigation Section (Dedicated for tarikh onujayi sales search) */}
      <div className="border-b border-zinc-200/80 bg-zinc-50/70 p-3 sm:px-4 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-800">
            <Calendar className="w-3.5 h-3.5 text-indigo-600" />
            <span>Search by Date (তারিখ অনুযায়ী বিক্রয় ও হিসাব খুঁজুন):</span>
          </div>

          {/* Quick Date Presets */}
          <div className="flex flex-wrap items-center gap-1">
            {dateFilterButtons.map((btn) => (
              <button
                key={btn.id}
                type="button"
                onClick={() => handleSetDateFilter(btn.id as DateFilterType)}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all ${
                  activeDateFilter === btn.id
                    ? 'bg-indigo-600 text-white shadow-2xs font-bold'
                    : 'bg-white border border-zinc-200/80 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {/* When Single Date Filter is Selected: Date Selector Controls */}
        {activeDateFilter === 'custom' && (
          <div className="bg-white border border-indigo-200 rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-2 animate-in fade-in">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-bold text-indigo-950 flex items-center gap-1">
                <span>নির্দিষ্ট দিন:</span>
              </span>

              {/* Prev Day Button */}
              <button
                type="button"
                onClick={handlePrevDay}
                title="Previous Day (আগের দিন)"
                className="p-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-100 text-zinc-700 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {/* Native Date Picker */}
              <input
                type="date"
                value={activeCustomDate}
                onChange={(e) => handleSetCustomDate(e.target.value)}
                className="px-2.5 py-1 text-xs font-bold text-zinc-900 bg-zinc-50 border border-zinc-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer shadow-2xs"
              />

              {/* Next Day Button */}
              <button
                type="button"
                onClick={handleNextDay}
                title="Next Day (পরের দিন)"
                className="p-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-100 text-zinc-700 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              {/* Today Button */}
              <button
                type="button"
                onClick={handleJumpToday}
                className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 font-bold rounded-lg text-xs transition-colors"
              >
                Today (আজ)
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="font-bold text-indigo-900 px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-200">
                {formatDisplayDate(activeCustomDate)}
              </span>
              <button
                type="button"
                onClick={() => handleSetDateFilter('all')}
                className="text-[11px] font-semibold text-zinc-500 hover:text-zinc-800 underline flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" /> Show All Dates
              </button>
            </div>
          </div>
        )}

        {/* When Date Range Filter is Selected: Range Picker Controls */}
        {activeDateFilter === 'range' && (
          <div className="bg-white border border-indigo-200 rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-2 animate-in fade-in text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-indigo-950 flex items-center gap-1">
                <CalendarRange className="w-3.5 h-3.5 text-indigo-600" />
                <span>পরিসীমা:</span>
              </span>

              <div className="flex items-center gap-1">
                <span className="text-[11px] text-zinc-500 font-medium">শুরু (From):</span>
                <input
                  type="date"
                  value={activeStartDate}
                  onChange={(e) => handleSetStartDate(e.target.value)}
                  className="px-2 py-1 text-xs font-bold text-zinc-900 bg-zinc-50 border border-zinc-300 rounded-lg focus:outline-none cursor-pointer"
                />
              </div>

              <div className="flex items-center gap-1">
                <span className="text-[11px] text-zinc-500 font-medium">শেষ (To):</span>
                <input
                  type="date"
                  value={activeEndDate}
                  onChange={(e) => handleSetEndDate(e.target.value)}
                  className="px-2 py-1 text-xs font-bold text-zinc-900 bg-zinc-50 border border-zinc-300 rounded-lg focus:outline-none cursor-pointer"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  const start = new Date(now.getFullYear(), now.getMonth(), 1);
                  handleSetStartDate(getLocalDateString(start));
                  handleSetEndDate(getLocalDateString(now));
                }}
                className="px-2 py-0.5 bg-zinc-100 hover:bg-zinc-200 rounded font-semibold text-zinc-700 text-[11px]"
              >
                This Month
              </button>
              <button
                type="button"
                onClick={() => handleSetDateFilter('all')}
                className="text-[11px] font-semibold text-zinc-500 hover:text-zinc-800 underline flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" /> Show All
              </button>
            </div>
          </div>
        )}

        {/* Date Filter Sales Stats Summary Bar */}
        <div className="bg-emerald-50/70 border border-emerald-200/90 rounded-xl px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-emerald-950 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>
                {activeDateFilter === 'custom'
                  ? `Sales on ${formatDisplayDate(activeCustomDate)}:`
                  : activeDateFilter === 'today'
                  ? "Today's Sales (আজকের মোট বিক্রি):"
                  : activeDateFilter === 'yesterday'
                  ? "Yesterday's Sales (গতকালের বিক্রি):"
                  : 'Filtered Sales (মোট বিক্রি):'}
              </span>
            </span>

            <span className="font-mono font-extrabold text-sm text-emerald-900">
              ৳{summaryMetrics.salesTotal.toLocaleString('en-IN')}
            </span>
            <span className="text-[11px] font-semibold text-emerald-800">
              ({summaryMetrics.salesCount} টি বিক্রি)
            </span>

            {/* Micro Breakdown */}
            <div className="flex items-center gap-1.5 ml-1 text-[11px] font-medium text-zinc-700">
              <span className="text-zinc-400">•</span>
              <span>Cash: <b className="font-mono text-emerald-900">৳{summaryMetrics.cashSales.toLocaleString('en-IN')}</b></span>
              <span className="text-zinc-400">•</span>
              <span>bKash: <b className="font-mono text-[#e2136e]">৳{summaryMetrics.bkashSales.toLocaleString('en-IN')}</b></span>
              <span className="text-zinc-400">•</span>
              <span>Nagad: <b className="font-mono text-[#ea580c]">৳{summaryMetrics.nagadSales.toLocaleString('en-IN')}</b></span>
            </div>
          </div>

          {activeDateFilter !== 'all' && (
            <button
              type="button"
              onClick={() => handleSetDateFilter('all')}
              className="text-[11px] font-bold text-emerald-900 hover:text-emerald-950 bg-emerald-100 hover:bg-emerald-200 px-2 py-0.5 rounded-md transition-colors"
            >
              Reset / View All
            </button>
          )}
        </div>
      </div>

      {/* Tabs Filter (Type: All / Sales / Expenses & Payment Method) */}
      <div className="border-b border-zinc-100 px-4 bg-zinc-50/50 flex flex-wrap items-center justify-between gap-2 py-1.5">
        {/* Type Filter */}
        <div className="flex gap-1">
          {(
            [
              { id: 'all', label: `All (${filteredList.length})` },
              { id: 'sale', label: `Sales (${filteredList.filter((t) => t.type === 'sale').length})` },
              { id: 'expense', label: `Expenses (${filteredList.filter((t) => t.type === 'expense').length})` },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setFilterType(t.id)}
              className={`py-1 px-3 text-xs font-bold rounded-lg transition-all ${
                filterType === t.id
                  ? 'bg-zinc-900 text-white shadow-2xs'
                  : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Payment Method Quick Filter */}
        <div className="flex items-center gap-1 text-[11px] font-semibold text-zinc-500">
          <Filter className="w-3 h-3 text-zinc-400" />
          <button
            onClick={() => setFilterPayment('all')}
            className={`px-2 py-0.5 rounded-md ${
              filterPayment === 'all' ? 'bg-zinc-200 text-zinc-900 font-bold' : 'hover:bg-zinc-100 text-zinc-600'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilterPayment('cash')}
            className={`px-2 py-0.5 rounded-md ${
              filterPayment === 'cash' ? 'bg-emerald-100 text-emerald-800 font-bold' : 'hover:bg-zinc-100 text-zinc-600'
            }`}
          >
            Cash
          </button>
          <button
            onClick={() => setFilterPayment('bkash')}
            className={`px-2 py-0.5 rounded-md ${
              filterPayment === 'bkash' ? 'bg-pink-100 text-[#e2136e] font-bold' : 'hover:bg-zinc-100 text-zinc-600'
            }`}
          >
            bKash
          </button>
          <button
            onClick={() => setFilterPayment('nagad')}
            className={`px-2 py-0.5 rounded-md ${
              filterPayment === 'nagad' ? 'bg-orange-100 text-[#ea580c] font-bold' : 'hover:bg-zinc-100 text-zinc-600'
            }`}
          >
            Nagad
          </button>
        </div>
      </div>

      {/* Transactions List */}
      <div className="divide-y divide-zinc-100 overflow-y-auto max-h-[580px] flex-1">
        {filteredList.length === 0 ? (
          <div className="py-14 text-center text-zinc-400 text-xs font-medium space-y-2">
            <div>No sales or transaction records match the selected date or search filter.</div>
            <div className="text-[11px] text-zinc-400">
              কোনো রেকর্ড পাওয়া যায়নি। অন্য কোনো তারিখ বাছুন অথবা "Show All Dates" বাটনে ক্লিক করুন।
            </div>
            <button
              type="button"
              onClick={() => {
                handleSetDateFilter('all');
                setSearchTerm('');
                setFilterType('all');
                setFilterPayment('all');
              }}
              className="mt-2 px-3 py-1.5 rounded-lg bg-zinc-900 text-white font-bold text-xs hover:bg-zinc-800 transition-colors"
            >
              View All Records (সব রেকর্ড দেখুন)
            </button>
          </div>
        ) : (
          filteredList.map((tx) => {
            const isSale = tx.type === 'sale';
            const displayCustName = tx.customer_name?.trim() ? tx.customer_name.trim() : 'Unknown';

            // 12-Hour Grace Period Check
            const ageMs = Date.now() - new Date(tx.created_at).getTime();
            const isDeletable = ageMs <= TWELVE_HOURS_MS;
            const hoursRemaining = Math.max(0, Math.floor((TWELVE_HOURS_MS - ageMs) / (60 * 60 * 1000)));
            const minsRemaining = Math.max(0, Math.floor(((TWELVE_HOURS_MS - ageMs) % (60 * 60 * 1000)) / (60 * 1000)));

            const isConfirming = confirmDeleteId === tx.id;

            return (
              <div
                key={tx.id}
                className="p-3.5 sm:px-5 hover:bg-zinc-50/80 transition-colors flex items-center justify-between gap-3 group"
              >
                {/* Left: Indicator, Category, Details */}
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={`mt-0.5 p-2 rounded-xl flex-shrink-0 ${
                      isSale
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    {isSale ? (
                      <ArrowUpRight className="w-4 h-4" />
                    ) : (
                      <ArrowDownRight className="w-4 h-4" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-xs text-zinc-900 truncate">
                        {tx.category}
                      </span>

                      {/* Explicit Date & Time Display */}
                      <span className="text-[11px] text-zinc-500 font-mono flex items-center gap-1 bg-zinc-100/80 px-1.5 py-0.5 rounded border border-zinc-200/60">
                        <Calendar className="w-3 h-3 text-zinc-400" />
                        {formatItemDateTime(tx.created_at)}
                      </span>

                      {renderPaymentBadge(tx.payment_method)}

                      {/* Locked or Deletable Status Badge */}
                      {!isDeletable ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-500 border border-zinc-200">
                          <Lock className="w-2.5 h-2.5" /> Permanent
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200"
                          title={`Can be deleted for next ${hoursRemaining}h ${minsRemaining}m`}
                        >
                          <Clock className="w-2.5 h-2.5" /> {hoursRemaining}h {minsRemaining}m left
                        </span>
                      )}
                    </div>

                    {tx.description && tx.description !== tx.category && (
                      <p className="text-xs text-zinc-600 truncate mt-0.5 font-medium">
                        {tx.description}
                      </p>
                    )}

                    <p className="text-[11px] text-zinc-500 truncate mt-0.5 font-medium">
                      Customer: <span className="text-zinc-800 font-semibold">{displayCustName}</span>
                      {tx.customer_phone ? ` (${tx.customer_phone})` : ''}
                    </p>
                  </div>
                </div>

                {/* Right: Amount, Memo & Interactive Delete Confirmation */}
                <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                  <div className="text-right">
                    <div
                      className={`font-mono text-sm sm:text-base font-extrabold ${
                        isSale ? 'text-zinc-950' : 'text-rose-600'
                      }`}
                    >
                      {isSale ? '+' : '-'}৳{Number(tx.amount).toLocaleString('en-IN')}
                    </div>
                  </div>

                  {/* Attached Digital Receipt Link */}
                  {tx.receipt_url && (
                    <button
                      type="button"
                      onClick={() =>
                        onViewReceipt ? onViewReceipt(tx.receipt_url!) : window.open(tx.receipt_url, '_blank')
                      }
                      title="View Digital Cash Memo"
                      className="p-1.5 rounded-lg text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 border border-indigo-200 transition-colors"
                    >
                      <FileText className="w-4 h-4" />
                    </button>
                  )}

                  {/* Delete Button (Allowed within 12h, Locked after 12h) - Inline Confirmation */}
                  {isDeletable ? (
                    isConfirming ? (
                      <div className="flex items-center gap-1 bg-rose-50 border border-rose-200 p-1 rounded-xl animate-in fade-in">
                        <button
                          type="button"
                          onClick={() => executeDelete(tx)}
                          disabled={deletingId === tx.id}
                          className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold shadow-xs transition-colors"
                        >
                          {deletingId === tx.id ? 'Deleting...' : 'Confirm'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200 transition-colors"
                          title="Cancel"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteError(null);
                          setConfirmDeleteId(tx.id);
                        }}
                        title={`Delete entry (${hoursRemaining}h ${minsRemaining}m remaining to delete)`}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )
                  ) : (
                    <span
                      title="Cannot delete: Permanently locked after 12 hours"
                      className="p-1.5 rounded-lg text-zinc-300 cursor-not-allowed"
                    >
                      <Lock className="w-4 h-4" />
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
