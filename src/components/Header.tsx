import React from 'react';
import { FolderTree, Receipt, RefreshCw, LogOut, User, Store } from 'lucide-react';
import { UserProfile } from '../types';

interface HeaderProps {
  currentUser: UserProfile | null;
  isLoading: boolean;
  onRefresh: () => void;
  onOpenCategories: () => void;
  onOpenReceiptModal: () => void;
  onSignOut: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  isLoading,
  onRefresh,
  onOpenCategories,
  onOpenReceiptModal,
  onSignOut,
}) => {
  const todayFormatted = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date());

  const shopTitle = currentUser?.shop_name || 'Online Sheba';

  return (
    <header className="border-b border-zinc-200/80 bg-white/95 backdrop-blur-md sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Identity */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 text-white flex items-center justify-center font-black tracking-tight text-base shadow-sm ring-2 ring-indigo-500/20">
              {shopTitle.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black text-zinc-900 tracking-tight leading-none">
                  {shopTitle}
                </h1>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Accounts Center
                </span>
              </div>
              <p className="text-xs text-zinc-500 mt-0.5 font-medium flex items-center gap-1.5">
                <span className="hidden sm:inline">Accounts & Sales Manager</span>
                <span className="hidden sm:inline text-zinc-300">•</span>
                <span className="text-zinc-500 font-mono text-[11px]">{todayFormatted}</span>
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {/* Refresh Data */}
            <button
              onClick={onRefresh}
              disabled={isLoading}
              title="Refresh Data"
              className="p-2 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl border border-zinc-200 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>

            {/* Categories Management */}
            <button
              onClick={onOpenCategories}
              className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700 hover:text-zinc-900 bg-white hover:bg-zinc-50 border border-zinc-200 px-3 py-2 rounded-xl transition-colors shadow-2xs"
            >
              <FolderTree className="w-3.5 h-3.5 text-indigo-600" />
              <span className="hidden sm:inline">Categories</span>
            </button>

            {/* Digital Cash Memo */}
            <button
              onClick={onOpenReceiptModal}
              className="flex items-center gap-1.5 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 px-3.5 py-2 rounded-xl transition-all shadow-xs"
            >
              <Receipt className="w-3.5 h-3.5 text-violet-300" />
              <span>Cash Memo</span>
            </button>

            {/* User Account / Logout */}
            {currentUser && (
              <div className="flex items-center pl-1 sm:pl-2 border-l border-zinc-200">
                <button
                  onClick={() => {
                    if (window.confirm(`Log out from ${currentUser.email}?`)) {
                      onSignOut();
                    }
                  }}
                  title={`Logged in as ${currentUser.email}. Click to Log Out.`}
                  className="p-2 rounded-xl border border-zinc-200 text-zinc-600 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-colors flex items-center gap-1.5 text-xs font-bold"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden md:inline text-[11px]">Logout</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
