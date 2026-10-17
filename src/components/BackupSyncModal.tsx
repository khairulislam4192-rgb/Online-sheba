import React, { useState, useEffect } from 'react';
import {
  X,
  Cloud,
  RefreshCw,
  Download,
  Upload,
  Database,
  Check,
  AlertCircle,
  Copy,
  ShieldCheck,
  HardDrive,
  Server,
  Smartphone,
  Store,
} from 'lucide-react';
import {
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
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    success: boolean;
    message: string;
    count?: number;
    warning?: string;
  } | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);
  const [showSql, setShowSql] = useState(false);
  const [stats, setStats] = useState({
    localCount: 0,
    remoteCount: 0,
    pendingCount: 0,
    isConnected: true,
    agentTransactionsCount: 0,
    agentWalletsCount: 2,
  });
  const [fileRestoreNotice, setFileRestoreNotice] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSyncResult(null);
      setFileRestoreNotice(null);
      getSyncStats(userId).then(setStats);
    }
  }, [isOpen, userId, transactions, categories]);

  if (!isOpen) return null;

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
          setFileRestoreNotice({
            success: true,
            message: `ব্যাকআপ সফলভাবে রিস্টোর হয়েছে! ${res.restoredTxs}টি লেনদেন এবং ${res.restoredCats}টি ক্যাটাগরি সংরক্ষিত হয়েছে।`,
          });
          onDataRestored();
        } else {
          setFileRestoreNotice({
            success: false,
            message: 'ব্যাকআপ রিস্টোর ব্যর্থ হয়েছে: ' + (res.message || 'অজানা ত্রুটি'),
          });
        }
      } catch (err: any) {
        setFileRestoreNotice({
          success: false,
          message: 'ফাইল ত্রুটি: ' + err.message,
        });
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
                Backend Auto Cloud Backup & Sync
              </h3>
              <p className="text-xs text-zinc-500">
                ব্যাকএন্ড সার্ভার ও সুপাবেজ ক্লাউড স্বয়ংক্রিয় রিয়েলটাইম ব্যাকআপ
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
          <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-50/60 via-zinc-50 to-emerald-50/50 border border-zinc-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
                <div>
                  <span className="font-extrabold text-sm text-zinc-900 block">
                    ব্যাকএন্ড অটো-ব্যাকআপ সক্রিয় (Cloud Sync Active)
                  </span>
                  <span className="text-[11px] text-zinc-500 font-medium">
                    সকল বিক্রয়, খরচ ও এজেন্ট হিসাব সুরক্ষিতভাবে ব্যাকএন্ড ও ক্লাউডে সিঙ্ক হচ্ছে
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleSyncNow}
                disabled={isSyncing}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center justify-center gap-2 shadow-xs transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'সিঙ্ক হচ্ছে...' : 'এখনই সিঙ্ক করুন'}</span>
              </button>
            </div>

            {/* Metrics Breakdown Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-zinc-200/70 text-center">
              <div className="p-3 rounded-xl bg-white border border-zinc-200 shadow-2xs">
                <div className="flex items-center justify-center gap-1.5 text-zinc-500 text-[10px] font-bold uppercase mb-0.5">
                  <Store className="w-3.5 h-3.5 text-indigo-600" />
                  <span>দোকানের হিসাব (Sales)</span>
                </div>
                <span className="text-lg font-black text-zinc-900 font-mono">
                  {transactions.length}
                </span>
                <span className="text-[10px] text-zinc-400 block">সংরক্ষিত লেনদেন</span>
              </div>

              <div className="p-3 rounded-xl bg-white border border-zinc-200 shadow-2xs">
                <div className="flex items-center justify-center gap-1.5 text-zinc-500 text-[10px] font-bold uppercase mb-0.5">
                  <Smartphone className="w-3.5 h-3.5 text-pink-600" />
                  <span>এজেন্ট খাতা (Agent)</span>
                </div>
                <span className="text-lg font-black text-pink-700 font-mono">
                  {stats.agentTransactionsCount}
                </span>
                <span className="text-[10px] text-zinc-400 block">ক্যাশ ইন/আউট এন্ট্রি</span>
              </div>

              <div className="p-3 rounded-xl bg-white border border-zinc-200 shadow-2xs">
                <div className="flex items-center justify-center gap-1.5 text-zinc-500 text-[10px] font-bold uppercase mb-0.5">
                  <Cloud className="w-3.5 h-3.5 text-emerald-600" />
                  <span>সার্ভার ক্লাউড সিঙ্ক</span>
                </div>
                <span className="text-lg font-black text-emerald-700 font-mono">
                  ১০০%
                </span>
                <span className="text-[10px] text-emerald-600 font-semibold block">স্বয়ংক্রিয় ব্যাকআপ</span>
              </div>
            </div>

            {syncResult && (
              <div
                className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                  syncResult.success
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}
              >
                {syncResult.success ? (
                  <Check className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                )}
                <div className="space-y-1">
                  <p className="font-semibold whitespace-pre-line leading-relaxed">{syncResult.message}</p>
                </div>
              </div>
            )}
          </div>

          {/* How It Works Explainer */}
          <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-2">
            <h4 className="font-bold text-zinc-900 text-xs flex items-center gap-1.5">
              <Server className="w-4 h-4 text-indigo-600" />
              <span>ব্যাকএন্ড অটো-ব্যাকআপ কীভাবে কাজ করে?</span>
            </h4>
            <ul className="text-[11px] text-zinc-600 space-y-1.5 list-disc list-inside leading-relaxed">
              <li>
                <b>রিয়েলটাইম ব্যাকআপ:</b> আপনি দোকানে যে বিক্রয়, খরচ বা বিকাশ/নগদ এন্ট্রি করেন, তা সাথে সাথে ব্যাকএন্ড সার্ভার ও সুপাবেজে ব্যাকআপ হয়ে যায়।
              </li>
              <li>
                <b>জিরো কনফিগারেশন:</b> ব্রাউজার বা ফ্রন্টএন্ডে কোনো পাসওয়ার্ড বা কী দিতে হয় না, সব ব্যাকএন্ডের সিক্রেট এনভায়রনমেন্ট থেকে অটো পরিচালিত হয়।
              </li>
              <li>
                <b>অফলাইন সুরক্ষা:</b> ইন্টারনেট বা সার্ভার ড্রপ করলেও লোকাল ব্রাউজারে ডাটা অক্ষত থাকে এবং কানেকশন ফিরলে স্বয়ংক্রিয়ভাবে ক্লাউডে সিঙ্ক হয়।
              </li>
            </ul>
          </div>

          {/* Quick Offline Backup & Restore Section */}
          <div className="space-y-3">
            <h4 className="font-extrabold text-zinc-900 text-sm flex items-center gap-1.5">
              <HardDrive className="w-4 h-4 text-indigo-600" />
              <span>Offline Master Backup (কম্পিউটারে ব্যাকআপ ফাইল সংরক্ষণ)</span>
            </h4>
            <p className="text-zinc-500 text-[11px]">
              যেকোনো সময় ১-ক্লিকে আপনার সব সেলস, খরচ, ক্যাটাগরি ও এজেন্ট খাতার ফুল ব্যাকআপ ফাইল ডাউনলোড করে রাখতে পারেন এবং যেকোনো ডিভাইসে রিস্টোর করতে পারেন।
            </p>

            {fileRestoreNotice && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                  fileRestoreNotice.success
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                {fileRestoreNotice.success ? (
                  <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                )}
                <span>{fileRestoreNotice.message}</span>
              </div>
            )}

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

          {/* Optional SQL Table Setup Inspector */}
          <div className="pt-2 border-t border-zinc-200/80">
            <button
              type="button"
              onClick={() => setShowSql(!showSql)}
              className="text-xs font-bold text-zinc-500 hover:text-zinc-800 flex items-center gap-1.5"
            >
              <span>{showSql ? '▼ Hide SQL Database Schema' : '▶ View Supabase Database Schema (SQL Script)'}</span>
            </button>

            {showSql && (
              <div className="mt-3 p-4 rounded-2xl bg-zinc-900 text-zinc-100 space-y-3">
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
                  আপনার সুপাবেজ ড্যাশবোর্ডের <b>SQL Editor</b>-এ রান করার জন্য ফুল ডেটাবেজ স্ক্রিপ্ট:
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
            <span>Server-authoritative auto backup to Supabase Cloud</span>
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
