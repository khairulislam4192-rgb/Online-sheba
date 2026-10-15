import React, { useRef, useState } from 'react';
import { X, Printer, Download, Check, Copy, ShieldCheck, Smartphone } from 'lucide-react';
import { toPng } from 'html-to-image';
import { AgentTransaction, PaperSize } from '../types';

interface AgentReceiptModalProps {
  transaction: AgentTransaction | null;
  shopName: string;
  agentNumber?: string;
  onClose: () => void;
}

export const AgentReceiptModal: React.FC<AgentReceiptModalProps> = ({
  transaction,
  shopName,
  agentNumber,
  onClose,
}) => {
  const [paperSize, setPaperSize] = useState<PaperSize>('thermal');
  const [isPrinting, setIsPrinting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [copiedTrx, setCopiedTrx] = useState(false);
  const [printNotice, setPrintNotice] = useState<string | null>(null);
  const receiptRef = useRef<HTMLDivElement>(null);

  if (!transaction) return null;

  const dateObj = new Date(transaction.created_at);
  const formattedDate = dateObj.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const formattedTime = dateObj.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const providerNames: Record<string, { name: string; color: string; bg: string; border: string }> = {
    bkash: { name: 'bKash Agent', color: '#e2136e', bg: '#fdf2f8', border: '#fbcfe8' },
    nagad: { name: 'Nagad Agent', color: '#ea580c', bg: '#fff7ed', border: '#fed7aa' },
    rocket: { name: 'Rocket Agent', color: '#8b5cf6', bg: '#f5f3ff', border: '#ddd6fe' },
    upay: { name: 'Upay Agent', color: '#0284c7', bg: '#f0f9ff', border: '#bae6fd' },
  };

  const typeNames: Record<string, { label: string; en: string }> = {
    cash_in: { label: 'ক্যাশ ইন (Cash In)', en: 'Cash In' },
    cash_out: { label: 'ক্যাশ আউট (Cash Out)', en: 'Cash Out' },
    bill_pay: { label: 'বিল পে (Bill Pay)', en: 'Bill Payment' },
    dsr_balance_in: { label: 'ডিএসআর লোড (DSR Load)', en: 'DSR Float Purchase' },
    balance_adjustment: { label: 'ব্যালেন্স সমন্বয়', en: 'Balance Adjustment' },
  };

  const providerInfo = providerNames[transaction.provider] || {
    name: transaction.provider.toUpperCase(),
    color: '#374151',
    bg: '#f3f4f6',
    border: '#e5e7eb',
  };

  const typeInfo = typeNames[transaction.type] || {
    label: transaction.type,
    en: transaction.type,
  };

  const cleanShopName = shopName || 'Online Sheba';
  const receiptNo = transaction.trx_id || `AGT-${dateObj.getTime().toString().slice(-6)}`;

  const triggerPrintHtml = (printContentHtml: string) => {
    // 1. Direct mount into #print-mount-container
    const printContainer = document.getElementById('print-mount-container');
    if (printContainer) {
      printContainer.innerHTML = printContentHtml;
      document.body.classList.add('printing-active');

      const cleanup = () => {
        document.body.classList.remove('printing-active');
        if (printContainer) printContainer.innerHTML = '';
        setIsPrinting(false);
      };

      window.onafterprint = cleanup;

      setTimeout(() => {
        try {
          window.print();
        } catch (e) {
          console.warn('Direct print error:', e);
        }
        setTimeout(cleanup, 3000);
      }, 150);
      return;
    }

    // 2. Hidden iframe fallback
    const oldIframes = document.querySelectorAll('.agent-receipt-print-iframe');
    oldIframes.forEach((el) => el.remove());

    const iframe = document.createElement('iframe');
    iframe.className = 'agent-receipt-print-iframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!doc) {
      window.print();
      setIsPrinting(false);
      return;
    }

    const isThermal = paperSize === 'thermal';
    const pageStyles = isThermal
      ? `@page { size: 80mm auto; margin: 2mm; }
         body { width: 78mm; margin: 0 auto; padding: 4px; font-family: 'JetBrains Mono', monospace; font-size: 11px; }`
      : `@page { size: A4 portrait; margin: 10mm; }
         body { width: 100%; max-width: 600px; margin: 0 auto; padding: 16px; font-family: sans-serif; font-size: 12px; }`;

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${cleanShopName} - ${providerInfo.name} Slip</title>
          <style>
            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color-adjust: exact !important;
            }
            html {
              background: #ffffff;
              color: #111827;
            }
            ${pageStyles}
            table {
              border-collapse: collapse;
              width: 100%;
            }
          </style>
        </head>
        <body>
          ${printContentHtml}
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (e) {
        console.error('Print iframe error:', e);
      } finally {
        setIsPrinting(false);
        setTimeout(() => {
          iframe.remove();
        }, 3000);
      }
    }, 350);
  };

  const handlePrint = () => {
    if (!receiptRef.current) return;
    setIsPrinting(true);
    setPrintNotice('প্রিন্ট প্রস্তুত হচ্ছে...');
    setTimeout(() => setPrintNotice(null), 3500);
    try {
      const html = receiptRef.current.innerHTML;
      triggerPrintHtml(html);
    } catch (e) {
      console.error(e);
      setIsPrinting(false);
    }
  };

  const handleDownload = async () => {
    if (!receiptRef.current) return;
    setIsDownloading(true);
    try {
      const dataUrl = await toPng(receiptRef.current, {
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        cacheBust: true,
      });
      const link = document.createElement('a');
      link.download = `${cleanShopName.replace(/\s+/g, '_')}_${transaction.provider}_${receiptNo}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setPrintNotice('মানি রিসিট স্লিপ সফলভাবে ডাউনলোড হয়েছে!');
      setTimeout(() => setPrintNotice(null), 3500);
    } catch (err: any) {
      setPrintNotice('ডাউনলোড সমস্যা: ' + (err.message || 'Error occurred'));
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCopyTrx = () => {
    if (transaction.trx_id) {
      navigator.clipboard.writeText(transaction.trx_id);
      setCopiedTrx(true);
      setTimeout(() => setCopiedTrx(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-zinc-950/70 backdrop-blur-xs overflow-y-auto no-print">
      <div className="bg-white rounded-2xl shadow-2xl border border-zinc-200 w-full max-w-xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Header Bar */}
        <div className="bg-zinc-900 text-white px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-white">
              <Smartphone className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight">Agent Money Slip / মানি রিসিট</h2>
              <p className="text-[11px] text-zinc-400">{providerInfo.name} • {receiptNo}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar: Paper Format & Actions */}
        <div className="bg-zinc-50 border-b border-zinc-200 px-5 py-3 flex flex-wrap items-center justify-between gap-3">
          {/* Format Selector */}
          <div className="flex items-center gap-1.5 bg-white border border-zinc-200 p-1 rounded-xl shadow-2xs">
            <button
              onClick={() => setPaperSize('thermal')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                paperSize === 'thermal'
                  ? 'bg-zinc-900 text-white shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
              }`}
            >
              🧾 Thermal POS (80mm)
            </button>
            <button
              onClick={() => setPaperSize('a4')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                paperSize === 'a4'
                  ? 'bg-zinc-900 text-white shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
              }`}
            >
              📄 A4 / Half Page
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 bg-white hover:bg-zinc-100 text-zinc-700 border border-zinc-300 rounded-xl transition-colors shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isDownloading ? 'Downloading...' : 'Image'}</span>
            </button>

            <button
              onClick={handlePrint}
              disabled={isPrinting}
              className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition-all active:scale-95 disabled:opacity-50"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{isPrinting ? 'Opening Print...' : 'Print Slip'}</span>
            </button>
          </div>
        </div>

        {/* Print Notice Feedback */}
        {printNotice && (
          <div className="mx-5 mt-3 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center justify-between no-print">
            <span>{printNotice}</span>
          </div>
        )}

        {/* Slip Preview Container */}
        <div className="p-4 sm:p-6 bg-zinc-100/70 overflow-x-auto flex justify-center max-h-[65vh] overflow-y-auto">
          <div
            ref={receiptRef}
            className={`bg-white shadow-md border border-zinc-300 text-zinc-900 p-5 ${
              paperSize === 'thermal'
                ? 'w-[320px] font-mono text-[11px] leading-tight rounded-sm'
                : 'w-full max-w-[520px] rounded-xl font-sans text-xs'
            }`}
          >
            {/* Header */}
            <div className="text-center pb-3 border-b border-dashed border-zinc-300">
              <h1 className="text-base sm:text-lg font-black tracking-tight text-zinc-900 uppercase">
                {cleanShopName}
              </h1>
              <p className="text-[11px] font-semibold text-zinc-600 mt-0.5">
                Authorized Mobile Financial Services Point
              </p>
              <div
                className="inline-block mt-1.5 px-3 py-0.5 rounded-full font-black text-[11px] tracking-wide"
                style={{
                  backgroundColor: providerInfo.bg,
                  color: providerInfo.color,
                  border: `1px solid ${providerInfo.border}`,
                }}
              >
                ★ {providerInfo.name} Authorized Agent ★
              </div>
              {agentNumber && (
                <p className="text-[10px] text-zinc-500 font-mono mt-1">
                  Agent SIM: <span className="font-bold text-zinc-700">{agentNumber}</span>
                </p>
              )}
            </div>

            {/* Transaction Title & Status */}
            <div className="my-3 py-2 px-3 rounded-lg text-center bg-zinc-50 border border-zinc-200">
              <div className="flex items-center justify-center gap-1.5 text-emerald-700 font-black text-xs">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>SUCCESSFUL TRANSACTION (সফল লেনদেন)</span>
              </div>
              <p className="text-xs font-bold text-zinc-800 mt-0.5">
                {typeInfo.label}
              </p>
            </div>

            {/* Key Value Details */}
            <div className="space-y-1.5 py-2 text-[11px] border-b border-dashed border-zinc-300 font-mono">
              <div className="flex justify-between">
                <span className="text-zinc-500">Date & Time:</span>
                <span className="font-semibold text-zinc-800">{formattedDate}, {formattedTime}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Customer Mobile:</span>
                <span className="font-bold text-zinc-900 tracking-wider text-xs">
                  {transaction.customer_phone}
                </span>
              </div>
              {transaction.customer_name && (
                <div className="flex justify-between">
                  <span className="text-zinc-500">Customer Name:</span>
                  <span className="font-medium text-zinc-800">{transaction.customer_name}</span>
                </div>
              )}
              {transaction.trx_id && (
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500">TrxID:</span>
                  <span className="font-bold text-indigo-700 font-mono">{transaction.trx_id}</span>
                </div>
              )}
              {transaction.bill_type && (
                <div className="flex justify-between">
                  <span className="text-zinc-500">Bill Type:</span>
                  <span className="font-semibold text-zinc-800">{transaction.bill_type}</span>
                </div>
              )}
              {transaction.bill_number && (
                <div className="flex justify-between">
                  <span className="text-zinc-500">Bill / Meter No:</span>
                  <span className="font-semibold text-zinc-800">{transaction.bill_number}</span>
                </div>
              )}
              {transaction.note && (
                <div className="flex justify-between">
                  <span className="text-zinc-500">Note:</span>
                  <span className="text-zinc-700">{transaction.note}</span>
                </div>
              )}
            </div>

            {/* Total Amount Box */}
            <div className="my-3 p-3 bg-zinc-900 text-white rounded-lg text-center">
              <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400">
                Transaction Amount / টাকার পরিমাণ
              </span>
              <div className="text-xl sm:text-2xl font-black tracking-tight mt-0.5 text-emerald-400 font-mono">
                ৳ {Number(transaction.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>

            {/* Signatures & Footer Note */}
            <div className="pt-4 mt-2">
              <div className="flex justify-between items-end text-[10px] text-zinc-500 pt-6">
                <div className="text-center">
                  <div className="w-24 border-t border-zinc-400 mb-1"></div>
                  <span>Customer Sign</span>
                </div>
                <div className="text-center">
                  <div className="w-24 border-t border-zinc-400 mb-1"></div>
                  <span>Agent Seal & Sign</span>
                </div>
              </div>
              <div className="text-center text-[9px] text-zinc-400 mt-4 border-t border-dotted border-zinc-200 pt-2 font-mono">
                * অনুগ্রহ করে লেনদেন সম্পন্ন হওয়ার সাথে সাথে প্রাপ্ত এসএমএস যাচাই করুন *
                <br />
                System generated by Online Sheba Agent Ledger
              </div>
            </div>
          </div>
        </div>

        {/* Footer Close */}
        <div className="bg-white border-t border-zinc-200 px-5 py-3 flex items-center justify-between text-xs text-zinc-500">
          <div className="flex items-center gap-2">
            {transaction.trx_id && (
              <button
                onClick={handleCopyTrx}
                className="flex items-center gap-1 text-zinc-700 hover:text-zinc-900 font-medium"
              >
                {copiedTrx ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedTrx ? 'Copied TrxID' : 'Copy TrxID'}</span>
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl border border-zinc-300 font-medium text-zinc-700 hover:bg-zinc-100 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
