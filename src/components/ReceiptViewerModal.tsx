import React, { useState } from 'react';
import { X, ExternalLink, Copy, Check, Download, Printer } from 'lucide-react';

interface ReceiptViewerModalProps {
  receiptUrl: string | null;
  onClose: () => void;
}

export const ReceiptViewerModal: React.FC<ReceiptViewerModalProps> = ({
  receiptUrl,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  if (!receiptUrl) return null;

  const fullUrl = receiptUrl.startsWith('http')
    ? receiptUrl
    : `${window.location.origin}${receiptUrl}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = fullUrl;
    link.download = `Cash_Memo_${Date.now()}.png`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    setIsPrinting(true);
    try {
      const old = document.querySelectorAll('.receipt-viewer-print-iframe');
      old.forEach((el) => el.remove());

      const iframe = document.createElement('iframe');
      iframe.className = 'receipt-viewer-print-iframe';
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
        return;
      }

      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Cash Memo Print</title>
            <style>
              * { box-sizing: border-box; }
              @page { margin: 5mm; size: auto; }
              body { margin: 0; padding: 10px; display: flex; justify-content: center; align-items: center; background: #fff; }
              img { max-width: 100%; height: auto; display: block; margin: 0 auto; }
            </style>
          </head>
          <body>
            <img src="${fullUrl}" onload="window.focus(); window.print();" />
          </body>
        </html>
      `);
      doc.close();

      setTimeout(() => {
        iframe.remove();
      }, 5000);
    } catch (e) {
      console.error('Print failed:', e);
      window.open(fullUrl, '_blank')?.print();
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-zinc-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full border border-zinc-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/70">
          <div>
            <h3 className="text-sm font-bold text-zinc-900">
              Cash Memo Preview
            </h3>
            <p className="text-xs text-zinc-500">
              Archived digital receipt
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200/60"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Image Preview */}
        <div className="flex-1 overflow-y-auto p-5 flex items-center justify-center bg-zinc-100/60 min-h-[300px]">
          <img
            src={receiptUrl}
            alt="Digital Cash Memo"
            className="max-w-full h-auto rounded-xl shadow-md border border-zinc-200"
          />
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-zinc-100 bg-zinc-50 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handlePrint}
              disabled={isPrinting}
              className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs"
            >
              <Printer className="w-3.5 h-3.5 text-emerald-400" />
              <span>{isPrinting ? 'Printing...' : 'Print'}</span>
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="px-3 py-2 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-xs font-bold text-zinc-700 flex items-center gap-1.5 shadow-2xs"
            >
              <Download className="w-3.5 h-3.5 text-indigo-600" />
              <span>Download</span>
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className="px-3 py-2 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-xs font-bold text-zinc-700 flex items-center gap-1.5 shadow-2xs"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={fullUrl}
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-2 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-xs font-bold text-zinc-700 flex items-center gap-1.5 shadow-2xs"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Open in Tab</span>
            </a>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-bold shadow-2xs"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
