import React, { useState } from 'react';
import { Trash2, Search, ArrowUpRight, ArrowDownRight, FileSpreadsheet, FileText, Filter } from 'lucide-react';
import { PaymentMethod, Transaction } from '../types';

interface TransactionHistoryProps {
  transactions: Transaction[];
  onDeleteTransaction: (id: string) => Promise<void>;
  isLoading: boolean;
  selectedDateFilter: 'today' | 'yesterday' | 'week' | 'month' | 'all';
  onViewReceipt?: (url: string) => void;
}

export const TransactionHistory: React.FC<TransactionHistoryProps> = ({
  transactions,
  onDeleteTransaction,
  isLoading,
  selectedDateFilter,
  onViewReceipt,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'sale' | 'expense'>('all');
  const [filterPayment, setFilterPayment] = useState<'all' | PaymentMethod>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filteredList = React.useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
    const startOfWeek = startOfToday - 7 * 24 * 60 * 60 * 1000;
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    return transactions.filter((tx) => {
      // Date filter
      const txTime = new Date(tx.created_at).getTime();
      let matchesDate = true;
      if (selectedDateFilter === 'today') {
        matchesDate = txTime >= startOfToday;
      } else if (selectedDateFilter === 'yesterday') {
        matchesDate = txTime >= startOfYesterday && txTime < startOfToday;
      } else if (selectedDateFilter === 'week') {
        matchesDate = txTime >= startOfWeek;
      } else if (selectedDateFilter === 'month') {
        matchesDate = txTime >= startOfMonth;
      }

      if (!matchesDate) return false;

      // Type filter
      if (filterType !== 'all' && tx.type !== filterType) return false;

      // Payment method filter
      if (filterPayment !== 'all' && tx.payment_method !== filterPayment) return false;

      // Search filter
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const catMatch = tx.category.toLowerCase().includes(query);
        const descMatch = (tx.description || '').toLowerCase().includes(query);
        const nameMatch = (tx.customer_name || '').toLowerCase().includes(query);
        const phoneMatch = (tx.customer_phone || '').includes(query);
        return catMatch || descMatch || nameMatch || phoneMatch;
      }

      return true;
    });
  }, [transactions, selectedDateFilter, filterType, filterPayment, searchTerm]);

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this transaction entry?')) {
      setDeletingId(id);
      try {
        await onDeleteTransaction(id);
      } finally {
        setDeletingId(null);
      }
    }
  };

  const exportToCSV = () => {
    if (filteredList.length === 0) return;
    const headers = ['Timestamp', 'Type', 'Category', 'Description', 'Amount', 'Payment Method', 'Customer Name', 'Phone', 'Receipt URL'];
    const rows = filteredList.map((tx) => [
      new Date(tx.created_at).toLocaleString('en-US'),
      tx.type.toUpperCase(),
      `"${tx.category.replace(/"/g, '""')}"`,
      `"${(tx.description || '').replace(/"/g, '""')}"`,
      tx.amount,
      tx.payment_method.toUpperCase(),
      `"${(tx.customer_name || '').replace(/"/g, '""')}"`,
      `"${tx.customer_phone || ''}"`,
      `"${tx.receipt_url || ''}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Online_Sheba_Ledger_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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

  return (
    <div className="bg-white rounded-2xl border border-zinc-200/90 shadow-xs overflow-hidden flex flex-col h-full">
      {/* Header Bar */}
      <div className="p-4 sm:p-5 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-zinc-900 tracking-tight flex items-center gap-2">
            <span>Transaction Ledger</span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-800">
              {filteredList.length} Records
            </span>
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            Real-time sales & expenses synchronized with database
          </p>
        </div>

        {/* Search & Export Buttons */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-52">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search transactions..."
              className="w-full pl-8 pr-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900"
            />
          </div>

          <button
            onClick={exportToCSV}
            title="Export Ledger to CSV"
            className="p-2 rounded-xl border border-zinc-200 text-zinc-700 hover:text-zinc-900 hover:bg-zinc-50 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </div>

      {/* Tabs Filter (Type & Payment Method) */}
      <div className="border-b border-zinc-100 px-4 bg-zinc-50/60 flex flex-wrap items-center justify-between gap-2 py-1.5">
        {/* Type Filter */}
        <div className="flex gap-1">
          {(
            [
              { id: 'all', label: `All (${transactions.length})` },
              { id: 'sale', label: `Sales (${transactions.filter((t) => t.type === 'sale').length})` },
              { id: 'expense', label: `Expenses (${transactions.filter((t) => t.type === 'expense').length})` },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setFilterType(t.id)}
              className={`py-1.5 px-3 text-xs font-bold rounded-lg transition-all ${
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
          <div className="py-14 text-center text-zinc-400 text-xs font-medium">
            No transaction records match the current filter.
          </div>
        ) : (
          filteredList.map((tx) => {
            const isSale = tx.type === 'sale';
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
                      <span className="text-[11px] text-zinc-400 font-mono">
                        {formatTime(tx.created_at)}
                      </span>
                      {renderPaymentBadge(tx.payment_method)}
                    </div>

                    {tx.description && tx.description !== tx.category && (
                      <p className="text-xs text-zinc-600 truncate mt-0.5 font-medium">
                        {tx.description}
                      </p>
                    )}

                    {tx.customer_name && (
                      <p className="text-[11px] text-zinc-500 truncate mt-0.5 font-medium">
                        Client: <span className="text-zinc-800 font-semibold">{tx.customer_name}</span>
                        {tx.customer_phone ? ` (${tx.customer_phone})` : ''}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right: Amount, Memo & Delete */}
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

                  {/* Delete Button */}
                  <button
                    type="button"
                    onClick={() => handleDelete(tx.id)}
                    disabled={deletingId === tx.id}
                    title="Delete Entry"
                    className="p-1.5 rounded-lg text-zinc-300 hover:text-rose-600 hover:bg-rose-50 transition-colors opacity-70 group-hover:opacity-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
