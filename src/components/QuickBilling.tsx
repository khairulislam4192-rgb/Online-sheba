import React, { useState } from 'react';
import { Plus, Banknote, Check, Sparkles } from 'lucide-react';
import { Category, PaymentMethod, Transaction } from '../types';

interface QuickBillingProps {
  categories: Category[];
  onAddSale: (sale: Omit<Transaction, 'id' | 'created_at'>) => Promise<void>;
  isLoading: boolean;
}

export const QuickBilling: React.FC<QuickBillingProps> = ({
  categories,
  onAddSale,
  isLoading,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [description, setDescription] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [showSuccessBadge, setShowSuccessBadge] = useState<boolean>(false);

  React.useEffect(() => {
    if (categories.length > 0 && !selectedCategory) {
      setSelectedCategory(categories[0].name);
    }
  }, [categories, selectedCategory]);

  const presetAmounts = [10, 20, 30, 50, 100, 150, 200, 500];

  const handleAddPreset = (val: number) => {
    const current = Number(amount) || 0;
    setAmount(String(current + val));
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) return;

    const catName = selectedCategory || (categories[0]?.name ?? 'General Sale');

    await onAddSale({
      type: 'sale',
      category: catName,
      description: description.trim() || catName,
      amount: numAmount,
      payment_method: paymentMethod,
      customer_name: customerName.trim() || undefined,
    });

    setAmount('');
    setDescription('');
    setCustomerName('');
    setShowSuccessBadge(true);
    setTimeout(() => setShowSuccessBadge(false), 2000);
  };

  return (
    <div className="bg-white rounded-2xl border border-zinc-200/90 p-5 sm:p-6 shadow-xs hover:border-zinc-300 transition-colors">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3.5 border-b border-zinc-100 mb-4">
        <div>
          <h3 className="text-sm font-bold text-zinc-900 tracking-tight flex items-center gap-2">
            <span>Quick Billing Counter</span>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              One-Click Sale
            </span>
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            Select a service category and record cash or mobile sales instantly
          </p>
        </div>

        {showSuccessBadge && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 bg-emerald-100 border border-emerald-300 px-3 py-1 rounded-full animate-fade-in shadow-2xs">
            <Check className="w-3.5 h-3.5" /> Sale Added!
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Dynamic Category Chips */}
        <div>
          <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-2">
            Service Category (Dynamic from DB):
          </label>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat.name;
              return (
                <button
                  type="button"
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.name)}
                  className={`text-xs px-3.5 py-2 rounded-xl font-semibold border transition-all text-left flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-zinc-900 text-white border-zinc-900 shadow-sm ring-2 ring-zinc-900/10 scale-[1.02]'
                      : 'bg-zinc-50/80 hover:bg-zinc-100 text-zinc-700 border-zinc-200 hover:border-zinc-300'
                  }`}
                >
                  <span>{cat.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Amount Input and Quick Preset Pills */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
              Amount (৳):
            </label>
            {amount && (
              <button
                type="button"
                onClick={() => setAmount('')}
                className="text-[11px] text-zinc-400 hover:text-zinc-700 font-semibold"
              >
                Clear
              </button>
            )}
          </div>

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
              className="w-full pl-9 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-xl font-mono font-bold text-zinc-900 placeholder:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-colors"
            />
          </div>

          {/* Quick Preset Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
            <span className="text-[11px] text-zinc-400 font-medium mr-1">Quick Add:</span>
            {presetAmounts.map((val) => (
              <button
                type="button"
                key={val}
                onClick={() => handleAddPreset(val)}
                className="text-xs font-mono font-semibold px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-lg border border-zinc-200 transition-colors shadow-2xs"
              >
                +৳{val}
              </button>
            ))}
          </div>
        </div>

        {/* Payment Method Selector - Separated Cash, bKash, and Nagad */}
        <div>
          <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-2">
            Payment Method:
          </label>
          <div className="grid grid-cols-3 gap-2">
            {/* Cash */}
            <button
              type="button"
              onClick={() => setPaymentMethod('cash')}
              className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border text-xs font-bold transition-all ${
                paymentMethod === 'cash'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm ring-2 ring-emerald-500/20'
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
                  ? 'bg-[#e2136e] text-white border-[#e2136e] shadow-sm ring-2 ring-pink-500/20'
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
                  ? 'bg-[#ea580c] text-white border-[#ea580c] shadow-sm ring-2 ring-orange-500/20'
                  : 'bg-white text-[#ea580c] border-zinc-200 hover:bg-orange-50/50'
              }`}
            >
              <span className="font-extrabold text-[13px]">৳</span>
              <span>Nagad</span>
            </button>
          </div>
        </div>

        {/* Optional Note & Customer Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
          <div>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Note (e.g. 15 Copies, Urgent)"
              className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-800 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900"
            />
          </div>
          <div>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Customer Name (Optional)"
              className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-800 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900"
            />
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading || !amount || Number(amount) <= 0}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 active:scale-[0.99] text-white text-sm font-bold transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
          <span>Record Sale {amount ? `(৳${amount})` : ''}</span>
        </button>
      </form>
    </div>
  );
};
