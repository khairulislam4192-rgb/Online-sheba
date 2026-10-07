import React from 'react';
import { Database, FolderTree, Receipt, RefreshCw, CheckCircle2, Server, Smartphone, Banknote } from 'lucide-react';
import { BackendStatus } from '../types';

interface HeaderProps {
  backendStatus: BackendStatus | null;
  isLoading: boolean;
  onRefresh: () => void;
  onOpenCategories: () => void;
  onOpenSettings: () => void;
  onOpenReceiptModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  backendStatus,
  isLoading,
  onRefresh,
  onOpenCategories,
  onOpenSettings,
  onOpenReceiptModal,
}) => {
  const todayFormatted = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date());

  const isSupabase = backendStatus?.isSupabaseConnected;

  return (
    <header className="border-b border-zinc-200/80 bg-white/95 backdrop-blur-md sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Identity */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 text-white flex items-center justify-center font-black tracking-tight text-base shadow-sm ring-2 ring-indigo-500/20">
              OS
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black text-zinc-900 tracking-tight leading-none">
                  Online Sheba
                </h1>
                <span className="hidden xs:inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Accounts Center
                </span>
              </div>
              <p className="text-xs text-zinc-500 mt-0.5 font-medium flex items-center gap-1.5">
                <span>Computer & Online Services</span>
                <span className="hidden sm:inline text-zinc-300">•</span>
                <span className="hidden sm:inline text-zinc-400 font-mono text-[11px]">{todayFormatted}</span>
              </p>
            </div>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Backend / Cloud Status Pill */}
            <button
              onClick={onOpenSettings}
              title={
                isSupabase
                  ? 'Supabase Cloud Database Connected'
                  : 'Backend Server Database Active (Click to configure Supabase)'
              }
              className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-all ${
                isSupabase
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                  : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
              }`}
            >
              {isSupabase ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="hidden md:inline">Supabase Cloud</span>
                </>
              ) : (
                <>
                  <Server className="w-3.5 h-3.5 text-amber-600" />
                  <span className="hidden md:inline">Server DB</span>
                </>
              )}
            </button>

            {/* Refresh Data */}
            <button
              onClick={onRefresh}
              disabled={isLoading}
              title="Refresh Records"
              className="p-2 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg border border-zinc-200 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>

            {/* Categories Management */}
            <button
              onClick={onOpenCategories}
              className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700 hover:text-zinc-900 bg-white hover:bg-zinc-50 border border-zinc-200 px-2.5 sm:px-3 py-2 rounded-lg transition-colors shadow-2xs"
            >
              <FolderTree className="w-3.5 h-3.5 text-indigo-600" />
              <span className="hidden sm:inline">Categories</span>
            </button>

            {/* Digital Receipt / Memo Button */}
            <button
              onClick={onOpenReceiptModal}
              className="flex items-center gap-1.5 text-xs font-semibold text-violet-800 bg-violet-50 hover:bg-violet-100 border border-violet-200 px-2.5 sm:px-3 py-2 rounded-lg transition-colors shadow-2xs"
            >
              <Receipt className="w-3.5 h-3.5 text-violet-600" />
              <span className="hidden sm:inline">Cash Memo</span>
            </button>

            {/* Supabase / Backend Settings */}
            <button
              onClick={onOpenSettings}
              className="flex items-center gap-1.5 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 px-2.5 sm:px-3 py-2 rounded-lg transition-all shadow-xs"
            >
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Database</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
