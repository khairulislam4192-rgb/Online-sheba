import React, { useState } from 'react';
import { ArrowDownRight, Banknote, Check } from 'lucide-react';
import { PaymentMethod, Transaction } from '../types';

interface ExpenseTrackerProps {
  onAddExpense: (expense: Omit<Transaction, 'id' | 'created_at'>) => Promise<void>;
  isLoading: boolean;
}

export const ExpenseTracker: React.FC<ExpenseTrackerProps> = ({
  onAddExpense,
  isLoading,
}) => {
  const [category, setCategory] = useState<string>('Paper & Stationery');
  const [description, setDescription] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [showSuccessBadge, setShowSuccessBadge] = useState<boolean>(false);

  const commonExpenseCategories = [
    'Paper & Stationery',
    'Toner & Printer Ink',
    'Electricity / Power Bill',
    'Internet & WiFi Bill',
    'Shop Rent',
    'Snacks & Refreshment',
    'Hardware Repair & Maintenance',
    'Office Supplies & Other',
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) return;

    await onAddExpense({
      type: 'expense',
      category: category,
      description: description.trim() || category,
      amount: numAmount,
      payment_method: paymentMethod,
    });

    setAmount('');
    setDescription('');
    setShowSuccessBadge(true);
    setTimeout(() => setShowSuccessBadge(false), 2000);
  };

  return (
    <div className="bg-white rounded-2xl border border-zinc-200/90 p-5 sm:p-6 shadow-xs hover:border-zinc-300 transition-colors">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3.5 border-b border-zinc-100 mb-4">
        <div>
          <h3 className="text-sm font-bold text-zinc-900 tracking-tight flex items-center gap-2">
            <span>Daily Expense Tracker</span>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
              Shop Expenses
            </span>
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            Log overheads, utilities, paper, ink, and daily maintenance costs
          </p>
        </div>

        {showSuccessBadge && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-800 bg-rose-100 border border-rose-300 px-3 py-1 rounded-full animate-fade-in shadow-2xs">
            <Check className="w-3.5 h-3.5" /> Expense Saved!
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Category Dropdown */}
        <div>
          <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
            Expense Category:
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-800 focus:outline-none focus:border-zinc-900"
          >
            {commonExpenseCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Description Input */}
        <div>
          <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
            Description:
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. 2 Reams A4 Double A Paper"
            className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-800 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900"
          />
        </div>

        {/* Amount Input */}
        <div>
          <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
            Amount (৳):
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400 font-mono font-bold text-xl">
              ৳
            </div>
            <input
              type="number"
              step="any"
              min="1"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full pl-9 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-xl font-mono font-bold text-zinc-900 placeholder:text-zinc-300 focus:outline-none focus:border-zinc-900 transition-colors"
            />
          </div>
        </div>

        {/* Payment Method - Separated Cash, bKash, and Nagad */}
        <div>
          <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-2">
            Paid Via:
          </label>
          <div className="grid grid-cols-3 gap-2">
            {/* Cash */}
            <button
              type="button"
              onClick={() => setPaymentMethod('cash')}
              className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border text-xs font-bold transition-all ${
                paymentMethod === 'cash'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                  : 'bg-white text-emerald-800 border-zinc-200 hover:bg-emerald-50/50'
              }`}
            >
              <Banknote className="w-4 h-4" />
              <span>Cash</span>
            </button>

            {/* bKash */}
            <button
              type="button"
              onClick={() => setPaymentMethod('bkash')}
              className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border text-xs font-bold transition-all ${
                paymentMethod === 'bkash'
                  ? 'bg-[#e2136e] text-white border-[#e2136e] shadow-sm'
                  : 'bg-white text-[#e2136e] border-zinc-200 hover:bg-pink-50/50'
              }`}
            >
              <span className="font-extrabold text-[13px]">৳</span>
              <span>bKash</span>
            </button>

            {/* Nagad */}
            <button
              type="button"
              onClick={() => setPaymentMethod('nagad')}
              className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border text-xs font-bold transition-all ${
                paymentMethod === 'nagad'
                  ? 'bg-[#ea580c] text-white border-[#ea580c] shadow-sm'
                  : 'bg-white text-[#ea580c] border-zinc-200 hover:bg-orange-50/50'
              }`}
            >
              <span className="font-extrabold text-[13px]">৳</span>
              <span>Nagad</span>
            </button>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading || !amount || Number(amount) <= 0}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-[0.99] text-white text-xs font-bold transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ArrowDownRight className="w-4 h-4" />
          <span>Add Expense {amount ? `(৳${amount})` : ''}</span>
        </button>
      </form>
    </div>
  );
};
