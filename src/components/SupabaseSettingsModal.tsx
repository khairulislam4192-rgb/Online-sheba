import React, { useState, useEffect } from 'react';
import { X, Database, Check, Copy, ShieldCheck, AlertCircle, RefreshCw, Server } from 'lucide-react';
import { getSettings, updateSettings, SQL_SETUP_SCRIPT } from '../lib/api';

interface SupabaseSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved: () => void;
  isRemote: boolean;
}

export const SupabaseSettingsModal: React.FC<SupabaseSettingsModalProps> = ({
  isOpen,
  onClose,
  onConfigSaved,
  isRemote,
}) => {
  const [url, setUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);

  useEffect(() => {
    if (isOpen) {
      getSettings().then((s) => {
        setUrl(s.supabaseUrl || '');
        setAnonKey(s.hasKey ? '••••••••••••••••' : '');
      }).catch(console.error);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestAndSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsTesting(true);
    setTestResult(null);

    const cleanUrl = url.trim();
    const cleanKey = anonKey.trim();

    if (!cleanUrl || !cleanKey) {
      setTestResult({
        success: false,
        message: 'Please provide both Supabase Project URL and Anon Key.',
      });
      setIsTesting(false);
      return;
    }

    try {
      const res = await updateSettings(cleanUrl, cleanKey);
      setTestResult({
        success: res.testSuccess,
        message: res.message,
      });
      onConfigSaved();
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Failed to save settings on server.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const copySqlScript = () => {
    navigator.clipboard.writeText(SQL_SETUP_SCRIPT);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  const handleSwitchToLocalServer = async () => {
    await updateSettings('', '');
    setUrl('');
    setAnonKey('');
    setTestResult({
      success: true,
      message: 'Switched to local backend database and server storage.',
    });
    onConfigSaved();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-zinc-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full border border-zinc-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-zinc-900 rounded-xl text-emerald-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-900">
                Database & Cloud Storage Setup
              </h3>
              <p className="text-xs text-zinc-500">
                Configure Supabase or use the persistent server database
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* Status Indicator */}
          <div
            className={`p-4 rounded-2xl border flex items-start gap-3.5 ${
              isRemote
                ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
                : 'bg-amber-50/80 border-amber-300 text-amber-950'
            }`}
          >
            {isRemote ? (
              <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            ) : (
              <Server className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            )}
            <div className="text-xs">
              <p className="font-bold text-sm">
                {isRemote ? 'Supabase Cloud Database Active' : 'Backend Server Database Active'}
              </p>
              <p className="mt-1 text-zinc-600 leading-relaxed">
                {isRemote
                  ? 'All sales, expenses, categories, and receipts are backed up directly to your Supabase cloud project.'
                  : 'All transactions and categories are safely persisted on the backend server. Enter your Supabase credentials below anytime to sync with the cloud.'}
              </p>
            </div>
          </div>

          {/* Credentials Form */}
          <form onSubmit={handleTestAndSave} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                Supabase Project URL:
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://your-project.supabase.co"
                className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono focus:border-zinc-900 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                Supabase Anon / Public Key:
              </label>
              <input
                type="password"
                value={anonKey}
                onChange={(e) => setAnonKey(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono focus:border-zinc-900 focus:outline-none"
              />
            </div>

            {testResult && (
              <div
                className={`p-3 rounded-xl text-xs border flex items-center gap-2.5 ${
                  testResult.success
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}
              >
                {testResult.success ? (
                  <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                )}
                <span className="font-medium">{testResult.message}</span>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <button
                type="button"
                onClick={handleSwitchToLocalServer}
                className="text-xs text-zinc-500 hover:text-zinc-800 underline font-semibold"
              >
                Reset / Use Local Server Storage
              </button>

              <button
                type="submit"
                disabled={isTesting || !url || !anonKey}
                className="px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-sm disabled:opacity-50"
              >
                {isTesting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Connecting...</span>
                  </>
                ) : (
                  <>
                    <Database className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Connect & Save</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* SQL Setup Instructions */}
          <div className="border-t border-zinc-100 pt-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                  Supabase SQL Schema Script
                </h4>
                <p className="text-[11px] text-zinc-500">
                  Run this inside the Supabase <span className="font-mono font-bold">SQL Editor</span> tab:
                </p>
              </div>
              <button
                type="button"
                onClick={copySqlScript}
                className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                {copiedSql ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy SQL</span>
                  </>
                )}
              </button>
            </div>

            <pre className="p-3.5 bg-zinc-900 text-zinc-200 rounded-xl text-[11px] font-mono overflow-x-auto max-h-48 border border-zinc-800">
              {SQL_SETUP_SCRIPT}
            </pre>

            <div className="text-[11px] text-zinc-600 space-y-1.5 bg-zinc-50 p-3.5 rounded-xl border border-zinc-200">
              <p className="font-bold text-zinc-900">How to create the Storage Bucket for Cash Memos:</p>
              <p>1. Open your Supabase Dashboard and go to the <span className="font-semibold text-zinc-800">Storage</span> menu.</p>
              <p>2. Click <span className="font-semibold text-zinc-800">"New bucket"</span> and name it <span className="font-mono text-zinc-900 font-bold">receipts</span>.</p>
              <p>3. Toggle <span className="font-semibold text-zinc-800">Public bucket</span> to ON so customer links are accessible.</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-100 bg-zinc-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-700 hover:bg-zinc-100"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
