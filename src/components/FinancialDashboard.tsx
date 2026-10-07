import React from 'react';
import { ArrowUpRight, ArrowDownRight, Banknote, TrendingUp, TrendingDown, Layers } from 'lucide-react';
import { Transaction } from '../types';

interface FinancialDashboardProps {
  transactions: Transaction[];
  selectedDateFilter: 'today' | 'yesterday' | 'week' | 'month' | 'all';
  onDateFilterChange: (filter: 'today' | 'yesterday' | 'week' | 'month' | 'all') => void;
}

export const FinancialDashboard: React.FC<FinancialDashboardProps> = ({
  transactions,
  selectedDateFilter,
  onDateFilterChange,
}) => {
  // Filter transactions
  const filteredTransactions = React.useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
    const startOfWeek = startOfToday - 7 * 24 * 60 * 60 * 1000;
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    return transactions.filter((tx) => {
      const txTime = new Date(tx.created_at).getTime();
      switch (selectedDateFilter) {
        case 'today':
          return txTime >= startOfToday;
        case 'yesterday':
          return txTime >= startOfYesterday && txTime < startOfToday;
        case 'week':
          return txTime >= startOfWeek;
        case 'month':
          return txTime >= startOfMonth;
        case 'all':
        default:
          return true;
      }
    });
  }, [transactions, selectedDateFilter]);

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
    { id: 'today', label: 'Today' },
    { id: 'yesterday', label: 'Yesterday' },
    { id: 'week', label: '7 Days' },
    { id: 'month', label: 'This Month' },
    { id: 'all', label: 'All Time' },
  ] as const;

  const isProfit = metrics.netProfit >= 0;

  return (
    <div className="space-y-3.5">
      {/* Date Filter & Control Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-600" />
          <h2 className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
            Financial Overview ({filterTabs.find((f) => f.id === selectedDateFilter)?.label})
          </h2>
        </div>

        {/* Date Filter Pills */}
        <div className="inline-flex rounded-xl border border-zinc-200 bg-white p-1 text-xs shadow-2xs self-start sm:self-auto overflow-x-auto max-w-full">
          {filterTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onDateFilterChange(tab.id)}
              className={`px-3 py-1.5 font-semibold rounded-lg transition-all whitespace-nowrap ${
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

      {/* 3 Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Total Sales */}
        <div className="bg-white rounded-2xl border border-emerald-200/80 p-5 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-bl-full pointer-events-none" />

          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              {selectedDateFilter === 'today' ? "Today's Total Sale" : 'Total Sales'}
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
              {selectedDateFilter === 'today' ? "Today's Total Expense" : 'Total Expenses'}
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
              Net Profit / Loss
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
