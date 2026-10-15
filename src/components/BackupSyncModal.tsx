import React, { useState, useEffect } from 'react';
import {
  X,
  Cloud,
  CloudCheck,
  RefreshCw,
  Download,
  Upload,
  Database,
  Check,
  AlertCircle,
  Copy,
  ShieldCheck,
  HardDrive,
  Key,
  ExternalLink,
} from 'lucide-react';
import {
  getStoredSupabaseConfig,
  saveSupabaseConfig,
  testSupabaseConnection,
  syncAllDataToSupabase,
  exportFullBackupJson,
  restoreFullBackupJson,
  SQL_SETUP_SCRIPT,
  getSyncStats,
} from '../lib/api';
import { Transaction, Category } from '../types';

interface BackupSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  transactions: Transaction[];
  categories: Category[];
  onDataRestored: () => void;
}

export const BackupSyncModal: React.FC<BackupSyncModalProps> = ({
  isOpen,
  onClose,
  userId,
  transactions,
  categories,
  onDataRestored,
}) => {
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string; count?: number } | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);
  const [showSql, setShowSql] = useState(false);
  const [stats, setStats] = useState({ localCount: 0, remoteCount: 0, pendingCount: 0, isConnected: false });

  useEffect(() => {
    if (isOpen) {
      const config = getStoredSupabaseConfig();
      setSupabaseUrl(config.url || '');
      setSupabaseKey(config.anonKey || '');
      setTestResult(null);
      setSyncResult(null);

      // Fetch stats
      getSyncStats(userId).then(setStats);
    }
  }, [isOpen, userId, transactions]);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await testSupabaseConnection(supabaseUrl, supabaseKey);
      setTestResult(result);
      if (result.success) {
        saveSupabaseConfig(supabaseUrl, supabaseKey);
        const updated = await getSyncStats(userId);
        setStats(updated);
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'Connection test failed' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveConfig = async () => {
    saveSupabaseConfig(supabaseUrl, supabaseKey);
    setTestResult({ success: true, message: 'Supabase credentials saved successfully!' });
    const updated = await getSyncStats(userId);
    setStats(updated);
  };

  const handleSyncNow = async () => {
    setIsSyncing(true);
    setSyncResult(null);
    try {
      const res = await syncAllDataToSupabase(userId);
      setSyncResult(res);
      const updated = await getSyncStats(userId);
      setStats(updated);
      if (res.success) {
        onDataRestored();
      }
    } catch (err: any) {
      setSyncResult({ success: false, message: err.message || 'Sync failed.' });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDownloadBackup = () => {
    exportFullBackupJson(userId);
  };

  const handleRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const res = await restoreFullBackupJson(userId, content);
        if (res.success) {
          alert(`Backup restored successfully! ${res.restoredTxs} transactions and ${res.restoredCats} categories restored.`);
          onDataRestored();
          onClose();
        } else {
          alert('Failed to restore backup: ' + res.message);
        }
      } catch (err: any) {
        alert('Invalid backup file: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(SQL_SETUP_SCRIPT);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-zinc-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full border border-zinc-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600 text-white rounded-2xl shadow-xs">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-zinc-900">
                Auto Backup & Supabase Cloud Sync
              </h3>
              <p className="text-xs text-zinc-500">
                ডাটা যেন কখনো না হারায় সেজন্য ক্লাউড অটো সেভ ও ব্যাকআপ সেন্টার
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200/60"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 text-xs text-zinc-700">
          {/* Cloud Status Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50/50 via-zinc-50 to-emerald-50/40 border border-zinc-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${stats.isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                <span className="font-bold text-sm text-zinc-900">
                  {stats.isConnected ? 'Supabase Cloud Connected (অটো সেভ সক্রিয়)' : 'Local Storage Active (ক্লাউড কানেক্ট করুন)'}
                </span>
              </div>
              <button
                type="button"
                onClick={handleSyncNow}
                disabled={isSyncing}
                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center gap-1.5 shadow-2xs transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Syncing...' : 'Sync All Data Now'}</span>
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2.5 pt-2 border-t border-zinc-200/60 text-center">
              <div className="p-2.5 rounded-xl bg-white border border-zinc-200">
                <span className="text-[10px] text-zinc-500 font-bold block uppercase">Local Records</span>
                <span className="text-base font-extrabold text-zinc-900 font-mono">{transactions.length}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white border border-zinc-200">
                <span className="text-[10px] text-zinc-500 font-bold block uppercase">Cloud Synced</span>
                <span className="text-base font-extrabold text-emerald-700 font-mono">{stats.remoteCount}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white border border-zinc-200">
                <span className="text-[10px] text-zinc-500 font-bold block uppercase">Pending Sync</span>
                <span className={`text-base font-extrabold font-mono ${stats.pendingCount > 0 ? 'text-amber-600' : 'text-zinc-600'}`}>
                  {stats.pendingCount}
                </span>
              </div>
            </div>

            {syncResult && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                  syncResult.success
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                {syncResult.success ? <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />}
                <span>{syncResult.message}</span>
              </div>
            )}
          </div>

          {/* Quick Offline Backup & Restore Section */}
          <div className="space-y-3">
            <h4 className="font-extrabold text-zinc-900 text-sm flex items-center gap-1.5">
              <HardDrive className="w-4 h-4 text-indigo-600" />
              <span>Offline Master Backup (কম্পিউটারে ব্যাকআপ ফাইল সংরক্ষণ)</span>
            </h4>
            <p className="text-zinc-500 text-[11px]">
              যেকোনো সময় ১-ক্লিকে আপনার সব সেলস, খরচ এবং ক্যাটাগরির ফুল ব্যাকআপ ফাইল ডাউনলোড করে রাখতে পারেন এবং পরবর্তীতে রিস্টোর করতে পারেন।
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleDownloadBackup}
                className="p-3.5 rounded-2xl bg-white border border-zinc-300 hover:border-zinc-400 hover:bg-zinc-50 flex items-center justify-center gap-2.5 font-bold text-zinc-800 transition-all shadow-xs"
              >
                <Download className="w-4 h-4 text-emerald-600" />
                <span>Download Full Backup (.json)</span>
              </button>

              <label className="p-3.5 rounded-2xl bg-white border border-zinc-300 hover:border-zinc-400 hover:bg-zinc-50 flex items-center justify-center gap-2.5 font-bold text-zinc-800 transition-all shadow-xs cursor-pointer">
                <Upload className="w-4 h-4 text-indigo-600" />
                <span>Restore from Backup File</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleRestoreFile}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Supabase Account Settings */}
          <div className="space-y-3 pt-4 border-t border-zinc-100">
            <div className="flex items-center justify-between">
              <h4 className="font-extrabold text-zinc-900 text-sm flex items-center gap-1.5">
                <Cloud className="w-4 h-4 text-indigo-600" />
                <span>Supabase Account Configuration (আপনার সুপাবেজ একাউন্ট)</span>
              </h4>
              <button
                type="button"
                onClick={() => setShowSql(!showSql)}
                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 underline"
              >
                {showSql ? 'Hide SQL Script' : 'View SQL Table Setup'}
              </button>
            </div>

            <div className="space-y-3 bg-zinc-50 p-4 rounded-2xl border border-zinc-200">
              <div>
                <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                  Supabase Project URL:
                </label>
                <input
                  type="text"
                  value={supabaseUrl}
                  onChange={(e) => setSupabaseUrl(e.target.value)}
                  placeholder="https://xyzcompany.supabase.co"
                  className="w-full px-3.5 py-2.5 bg-white border border-zinc-300 rounded-xl text-xs font-mono font-medium focus:border-zinc-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                  Supabase Anon / Publishable Key:
                </label>
                <input
                  type="password"
                  value={supabaseKey}
                  onChange={(e) => setSupabaseKey(e.target.value)}
                  placeholder="sb_publishable_... or eyJhbGci..."
                  className="w-full px-3.5 py-2.5 bg-white border border-zinc-300 rounded-xl text-xs font-mono font-medium focus:border-zinc-900 focus:outline-none"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTesting || !supabaseUrl.trim() || !supabaseKey.trim()}
                  className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-all disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                  <span>{isTesting ? 'Testing...' : 'Test Connection & Save'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveConfig}
                  className="px-4 py-2 rounded-xl border border-zinc-300 bg-white hover:bg-zinc-100 text-zinc-800 font-bold text-xs shadow-2xs"
                >
                  Save Credentials
                </button>
              </div>

              {testResult && (
                <div
                  className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                    testResult.success
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}
                >
                  {testResult.success ? <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />}
                  <span>{testResult.message}</span>
                </div>
              )}
            </div>

            {/* SQL Setup Script Helper */}
            {showSql && (
              <div className="p-4 rounded-2xl bg-zinc-900 text-zinc-100 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-indigo-300">
                    Supabase SQL Editor Script:
                  </span>
                  <button
                    type="button"
                    onClick={handleCopySql}
                    className="px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-zinc-200 flex items-center gap-1.5 transition-colors"
                  >
                    {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedSql ? 'Copied!' : 'Copy SQL Script'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-zinc-400">
                  আপনার সুপাবেজ ড্যাশবোর্ডের <b>SQL Editor</b>-এ গিয়ে নিচের স্ক্রিপ্টটি রান করলেই <code>categories</code>, <code>transactions</code> টেবিল এবং <code>receipts</code> স্টোরেজ রেডি হয়ে যাবে:
                </p>
                <pre className="p-3 bg-zinc-950 rounded-xl font-mono text-[11px] text-emerald-400 overflow-x-auto max-h-48 border border-zinc-800">
                  {SQL_SETUP_SCRIPT}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-zinc-100 bg-zinc-50 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-zinc-500 text-xs font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Dual Auto-Backup: Local Storage + Supabase Realtime</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs shadow-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
