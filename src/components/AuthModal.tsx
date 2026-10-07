import React, { useState } from 'react';
import { Lock, Mail, Store, ArrowRight, ShieldCheck, UserCheck, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { signIn, signUp } from '../lib/api';
import { UserProfile } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onSuccess: (user: UserProfile) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onSuccess }) => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [shopName, setShopName] = useState('Online Sheba');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (mode === 'signin') {
        const user = await signIn(email, password);
        onSuccess(user);
      } else {
        if (!shopName.trim()) {
          throw new Error('Please enter your business or shop name.');
        }
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters long.');
        }
        const user = await signUp(email, password, shopName);
        onSuccess(user);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickDemo = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const demoEmail = 'owner@onlinesheba.com';
      const demoPass = 'sheba1234';
      try {
        const user = await signIn(demoEmail, demoPass);
        onSuccess(user);
      } catch {
        const user = await signUp(demoEmail, demoPass, 'Online Sheba');
        onSuccess(user);
      }
    } catch (err: any) {
      setError(err.message || 'Demo login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-zinc-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-3xl max-w-md w-full border border-zinc-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Top Header */}
        <div className="p-6 text-center bg-gradient-to-b from-zinc-50 to-white border-b border-zinc-100">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-800 text-white flex items-center justify-center font-black text-lg shadow-md ring-4 ring-indigo-500/10 mb-3">
            OS
          </div>
          <h2 className="text-xl font-black text-zinc-900 tracking-tight">
            Online Sheba
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            Daily Accounts, Sales & Expense Management
          </p>
          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] font-semibold text-emerald-800">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Private & Isolated Business Accounts</span>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="px-6 pt-4 flex border-b border-zinc-100">
          <button
            type="button"
            onClick={() => {
              setMode('signin');
              setError(null);
            }}
            className={`flex-1 pb-3 text-xs font-bold border-b-2 transition-all ${
              mode === 'signin'
                ? 'border-zinc-900 text-zinc-900'
                : 'border-transparent text-zinc-400 hover:text-zinc-700'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('signup');
              setError(null);
            }}
            className={`flex-1 pb-3 text-xs font-bold border-b-2 transition-all ${
              mode === 'signup'
                ? 'border-zinc-900 text-zinc-900'
                : 'border-transparent text-zinc-400 hover:text-zinc-700'
            }`}
          >
            Create New Account
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                Shop / Business Name:
              </label>
              <div className="relative">
                <Store className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  required
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  placeholder="e.g. Online Sheba Computer"
                  className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-900 focus:outline-none focus:border-zinc-900"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
              Email / User ID:
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-900 focus:outline-none focus:border-zinc-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
              Password:
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-10 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-900 focus:outline-none focus:border-zinc-900"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <span>{isLoading ? 'Processing...' : mode === 'signin' ? 'Sign In to Dashboard' : 'Register & Start'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={handleQuickDemo}
              disabled={isLoading}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-bold underline"
            >
              Demo One-Click Sign In (Test Account)
            </button>
          </div>
        </form>

        {/* Security Note Footer */}
        <div className="p-4 bg-zinc-50 border-t border-zinc-100 text-center text-[11px] text-zinc-500">
          Your financial transactions & categories are 100% private and protected per user account.
        </div>
      </div>
    </div>
  );
};
