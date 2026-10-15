import React from 'react';
import {
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  TrendingDown,
  Layers,
  Calendar,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from 'lucide-react';
import { Transaction, DateFilterType } from '../types';

interface FinancialDashboardProps {
  transactions: Transaction[];
  selectedDateFilter: DateFilterType;
  onDateFilterChange: (filter: DateFilterType) => void;
  customDate?: string;
  onCustomDateChange?: (date: string) => void;
  customStartDate?: string;
  onCustomStartDateChange?: (date: string) => void;
  customEndDate?: string;
  onCustomEndDateChange?: (date: string) => void;
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

export const FinancialDashboard: React.FC<FinancialDashboardProps> = ({
  transactions,
  selectedDateFilter,
  onDateFilterChange,
  customDate = getLocalDateString(new Date()),
  onCustomDateChange,
  customStartDate = getLocalDateString(new Date(Date.now() - 6 * 86400000)),
  customEndDate = getLocalDateString(new Date()),
  onCustomEndDateChange,
  onCustomStartDateChange,
}) => {
  // Filter transactions accurately based on local date
  const filteredTransactions = React.useMemo(() => {
    const todayStr = getLocalDateString(new Date());
    const yesterdayStr = getLocalDateString(new Date(Date.now() - 24 * 60 * 60 * 1000));
    const startOfWeek = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    return transactions.filter((tx) => {
      const txLocalDate = getLocalDateString(tx.created_at);
      const txTime = new Date(tx.created_at).getTime();

      switch (selectedDateFilter) {
        case 'today':
          return txLocalDate === todayStr;
        case 'yesterday':
          return txLocalDate === yesterdayStr;
        case 'week':
          return txTime >= startOfWeek;
        case 'month':
          return txTime >= startOfMonth;
        case 'custom':
          return customDate ? txLocalDate === customDate : true;
        case 'range':
          if (customStartDate && customEndDate) {
            return txLocalDate >= customStartDate && txLocalDate <= customEndDate;
          } else if (customStartDate) {
            return txLocalDate >= customStartDate;
          } else if (customEndDate) {
            return txLocalDate <= customEndDate;
          }
          return true;
        case 'all':
        default:
          return true;
      }
    });
  }, [transactions, selectedDateFilter, customDate, customStartDate, customEndDate]);

  // Calculate metrics separated by Cash, bKash, and Nagad
  const metrics = React.useMemo(() => {
    let totalSale = 0;
    let saleCash = 0;
    let saleBkash = 0;
    let saleNagad = 0;

    let totalExpense = 0;
    let expenseCash = 0;
    let expenseBkash = 0;
    let expenseNagad = 0;

    for (const tx of filteredTransactions) {
      const amt = Number(tx.amount) || 0;
      if (tx.type === 'sale') {
        totalSale += amt;
        if (tx.payment_method === 'cash') saleCash += amt;
        else if (tx.payment_method === 'bkash') saleBkash += amt;
        else if (tx.payment_method === 'nagad') saleNagad += amt;
      } else if (tx.type === 'expense') {
        totalExpense += amt;
        if (tx.payment_method === 'cash') expenseCash += amt;
        else if (tx.payment_method === 'bkash') expenseBkash += amt;
        else if (tx.payment_method === 'nagad') expenseNagad += amt;
      }
    }

    const netProfit = totalSale - totalExpense;

    return {
      totalSale,
      saleCash,
      saleBkash,
      saleNagad,
      totalExpense,
      expenseCash,
      expenseBkash,
      expenseNagad,
      netProfit,
      salesCount: filteredTransactions.filter((t) => t.type === 'sale').length,
      expenseCount: filteredTransactions.filter((t) => t.type === 'expense').length,
    };
  }, [filteredTransactions]);

  const filterTabs = [
    { id: 'today', label: 'Today (আজ)' },
    { id: 'yesterday', label: 'Yesterday (গতকাল)' },
    { id: 'week', label: '7 Days (৭ দিন)' },
    { id: 'month', label: 'This Month (চলতি মাস)' },
    { id: 'all', label: 'All Time (সব সময়)' },
    { id: 'custom', label: '📅 Custom Date (নির্দিষ্ট তারিখ)' },
    { id: 'range', label: '📅 Range (পরিসীমা)' },
  ] as const;

  const isProfit = metrics.netProfit >= 0;

  // Day step handlers
  const handlePrevDay = () => {
    try {
      const [y, m, d] = customDate.split('-').map(Number);
      const prev = new Date(y, m - 1, d - 1);
      onCustomDateChange?.(getLocalDateString(prev));
    } catch {
      // ignore
    }
  };

  const handleNextDay = () => {
    try {
      const [y, m, d] = customDate.split('-').map(Number);
      const next = new Date(y, m - 1, d + 1);
      onCustomDateChange?.(getLocalDateString(next));
    } catch {
      // ignore
    }
  };

  const handleJumpToday = () => {
    onCustomDateChange?.(getLocalDateString(new Date()));
  };

  const getActiveFilterLabel = () => {
    if (selectedDateFilter === 'custom') {
      return `Date: ${formatDisplayDate(customDate)}`;
    }
    if (selectedDateFilter === 'range') {
      return `Range: ${customStartDate} to ${customEndDate}`;
    }
    return filterTabs.find((f) => f.id === selectedDateFilter)?.label || 'Overview';
  };

  return (
    <div className="space-y-3.5">
      {/* Date Filter & Control Bar */}
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-600" />
            <h2 className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
              Financial Overview ({getActiveFilterLabel()})
            </h2>
          </div>

          {/* Date Filter Pills */}
          <div className="inline-flex rounded-xl border border-zinc-200 bg-white p-1 text-xs shadow-2xs self-start sm:self-auto overflow-x-auto max-w-full">
            {filterTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => onDateFilterChange(tab.id as DateFilterType)}
                className={`px-3 py-1.5 font-semibold rounded-lg transition-all whitespace-nowrap text-xs ${
                  selectedDateFilter === tab.id
                    ? 'bg-zinc-900 text-white shadow-xs'
                    : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Single Date Selector Bar */}
        {selectedDateFilter === 'custom' && (
          <div className="bg-indigo-50/70 border border-indigo-200/90 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs animate-in fade-in">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-indigo-900 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-indigo-600" />
                Select Date (তারিখ নির্বাচন করুন):
              </span>
              <div className="flex items-center gap-1 bg-white border border-indigo-200 rounded-lg p-0.5 shadow-2xs">
                <button
                  type="button"
                  onClick={handlePrevDay}
                  title="Previous Day"
                  className="p-1.5 hover:bg-zinc-100 text-zinc-700 rounded-md transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <input
                  type="date"
                  value={customDate}
                  onChange={(e) => onCustomDateChange?.(e.target.value)}
                  className="px-2 py-1 text-xs font-bold text-zinc-900 bg-transparent border-0 focus:outline-none cursor-pointer"
                />
                <button
                  type="button"
                  onClick={handleNextDay}
                  title="Next Day"
                  className="p-1.5 hover:bg-zinc-100 text-zinc-700 rounded-md transition-colors"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                type="button"
                onClick={handleJumpToday}
                className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-2xs transition-colors"
              >
                Today (আজ)
              </button>
            </div>

            <div className="font-semibold text-indigo-900 flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-md bg-indigo-100/90 border border-indigo-300/80">
                {formatDisplayDate(customDate)}
              </span>
              <button
                type="button"
                onClick={() => onDateFilterChange('today')}
                className="text-indigo-700 hover:text-indigo-950 font-bold underline text-[11px] flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" /> Reset to Today
              </button>
            </div>
          </div>
        )}

        {/* Custom Date Range Selector Bar */}
        {selectedDateFilter === 'range' && (
          <div className="bg-indigo-50/70 border border-indigo-200/90 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs animate-in fade-in">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-indigo-900 flex items-center gap-1.5">
                <CalendarRange className="w-4 h-4 text-indigo-600" />
                Date Range (তারিখের পরিসীমা):
              </span>
              <div className="flex items-center gap-1.5">
                <label className="text-zinc-600 font-semibold text-[11px]">From:</label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => onCustomStartDateChange?.(e.target.value)}
                  className="px-2.5 py-1 text-xs font-bold text-zinc-900 bg-white border border-indigo-200 rounded-lg focus:outline-none shadow-2xs cursor-pointer"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <label className="text-zinc-600 font-semibold text-[11px]">To:</label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => onCustomEndDateChange?.(e.target.value)}
                  className="px-2.5 py-1 text-xs font-bold text-zinc-900 bg-white border border-indigo-200 rounded-lg focus:outline-none shadow-2xs cursor-pointer"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  const start = new Date(now.getFullYear(), now.getMonth(), 1);
                  onCustomStartDateChange?.(getLocalDateString(start));
                  onCustomEndDateChange?.(getLocalDateString(now));
                }}
                className="px-2 py-1 bg-white hover:bg-zinc-100 border border-indigo-200 rounded-md font-semibold text-zinc-700 text-[11px]"
              >
                This Month
              </button>
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  const start = new Date(Date.now() - 30 * 86400000);
                  onCustomStartDateChange?.(getLocalDateString(start));
                  onCustomEndDateChange?.(getLocalDateString(now));
                }}
                className="px-2 py-1 bg-white hover:bg-zinc-100 border border-indigo-200 rounded-md font-semibold text-zinc-700 text-[11px]"
              >
                Last 30 Days
              </button>
              <button
                type="button"
                onClick={() => onDateFilterChange('today')}
                className="text-indigo-700 hover:text-indigo-950 font-bold underline text-[11px] flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" /> Reset
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 3 Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Total Sales */}
        <div className="bg-white rounded-2xl border border-emerald-200/80 p-5 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-bl-full pointer-events-none" />

          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              {selectedDateFilter === 'today'
                ? "Today's Total Sale (আজকের বিক্রি)"
                : selectedDateFilter === 'custom'
                ? 'Filtered Date Sale (নির্বাচিত দিনের বিক্রি)'
                : 'Total Sales (মোট বিক্রি)'}
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-zinc-900 font-mono">
              ৳{metrics.totalSale.toLocaleString('en-IN')}
            </span>
            <span className="text-xs text-zinc-500 font-medium">
              ({metrics.salesCount} entries)
            </span>
          </div>

          {/* Dedicated Separate Breakdown: Cash, bKash, Nagad */}
          <div className="mt-4 pt-3.5 border-t border-zinc-100 grid grid-cols-3 gap-1.5 text-xs">
            {/* Cash */}
            <div className="bg-emerald-50/60 border border-emerald-200/60 rounded-lg p-2 text-center">
              <div className="text-[10px] font-bold text-emerald-800 uppercase tracking-tight">Cash</div>
              <div className="font-mono font-bold text-zinc-900 mt-0.5 text-xs">
                ৳{metrics.saleCash.toLocaleString('en-IN')}
              </div>
            </div>

            {/* bKash */}
            <div className="bg-pink-50/70 border border-pink-200/80 rounded-lg p-2 text-center">
              <div className="text-[10px] font-bold text-[#e2136e] uppercase tracking-tight">bKash</div>
              <div className="font-mono font-bold text-zinc-900 mt-0.5 text-xs">
                ৳{metrics.saleBkash.toLocaleString('en-IN')}
              </div>
            </div>

            {/* Nagad */}
            <div className="bg-orange-50/70 border border-orange-200/80 rounded-lg p-2 text-center">
              <div className="text-[10px] font-bold text-[#ea580c] uppercase tracking-tight">Nagad</div>
              <div className="font-mono font-bold text-zinc-900 mt-0.5 text-xs">
                ৳{metrics.saleNagad.toLocaleString('en-IN')}
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Total Expenses */}
        <div className="bg-white rounded-2xl border border-rose-200/80 p-5 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-bl-full pointer-events-none" />

          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-800 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              {selectedDateFilter === 'today'
                ? "Today's Total Expense (আজকের খরচ)"
                : selectedDateFilter === 'custom'
                ? 'Filtered Date Expense (নির্বাচিত দিনের খরচ)'
                : 'Total Expenses (মোট খরচ)'}
            </span>
            <div className="p-2 rounded-xl bg-rose-50 text-rose-700 border border-rose-200">
              <ArrowDownRight className="w-4 h-4" />
            </div>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-zinc-900 font-mono">
              ৳{metrics.totalExpense.toLocaleString('en-IN')}
            </span>
            <span className="text-xs text-zinc-500 font-medium">
              ({metrics.expenseCount} entries)
            </span>
          </div>

          {/* Dedicated Separate Breakdown: Cash, bKash, Nagad */}
          <div className="mt-4 pt-3.5 border-t border-zinc-100 grid grid-cols-3 gap-1.5 text-xs">
            {/* Cash */}
            <div className="bg-emerald-50/60 border border-emerald-200/60 rounded-lg p-2 text-center">
              <div className="text-[10px] font-bold text-emerald-800 uppercase tracking-tight">Cash</div>
              <div className="font-mono font-bold text-zinc-900 mt-0.5 text-xs">
                ৳{metrics.expenseCash.toLocaleString('en-IN')}
              </div>
            </div>

            {/* bKash */}
            <div className="bg-pink-50/70 border border-pink-200/80 rounded-lg p-2 text-center">
              <div className="text-[10px] font-bold text-[#e2136e] uppercase tracking-tight">bKash</div>
              <div className="font-mono font-bold text-zinc-900 mt-0.5 text-xs">
                ৳{metrics.expenseBkash.toLocaleString('en-IN')}
              </div>
            </div>

            {/* Nagad */}
            <div className="bg-orange-50/70 border border-orange-200/80 rounded-lg p-2 text-center">
              <div className="text-[10px] font-bold text-[#ea580c] uppercase tracking-tight">Nagad</div>
              <div className="font-mono font-bold text-zinc-900 mt-0.5 text-xs">
                ৳{metrics.expenseNagad.toLocaleString('en-IN')}
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Net Profit / Loss - Dynamic Color: GREEN if Profit, RED if Loss */}
        <div
          className={`rounded-2xl p-5 shadow-xs hover:shadow-md transition-all border-2 relative overflow-hidden ${
            isProfit
              ? 'bg-gradient-to-br from-emerald-50 via-emerald-50/80 to-teal-100/50 border-emerald-500 text-emerald-950'
              : 'bg-gradient-to-br from-rose-50 via-rose-50/80 to-red-100/50 border-rose-500 text-rose-950'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span
              className={`text-xs font-black uppercase tracking-wider ${
                isProfit ? 'text-emerald-800' : 'text-rose-800'
              }`}
            >
              Net Profit / Loss (লাভ বা লোকসান)
            </span>
            <div
              className={`p-2 rounded-xl border font-bold text-xs flex items-center gap-1 ${
                isProfit
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                  : 'bg-rose-600 text-white border-rose-600 shadow-xs'
              }`}
            >
              {isProfit ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              <span>{isProfit ? 'PROFIT' : 'LOSS'}</span>
            </div>
          </div>

          <div className="flex items-baseline gap-2">
            <span
              className={`text-3xl font-extrabold tracking-tight font-mono ${
                isProfit ? 'text-emerald-900' : 'text-rose-900'
              }`}
            >
              ৳{Math.abs(metrics.netProfit).toLocaleString('en-IN')}
            </span>
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                isProfit ? 'bg-emerald-200/80 text-emerald-900' : 'bg-rose-200/80 text-rose-900'
              }`}
            >
              {isProfit ? 'Net Gain' : 'Deficit'}
            </span>
          </div>

          {/* Cash Balance in Drawer vs Mobile Balances */}
          <div className="mt-4 pt-3.5 border-t border-black/10 flex items-center justify-between text-xs">
            <span className="font-semibold text-zinc-700">Net Cash In Hand:</span>
            <span
              className={`font-mono font-extrabold text-sm ${
                metrics.saleCash - metrics.expenseCash >= 0 ? 'text-emerald-800' : 'text-rose-800'
              }`}
            >
              ৳{(metrics.saleCash - metrics.expenseCash).toLocaleString('en-IN')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
