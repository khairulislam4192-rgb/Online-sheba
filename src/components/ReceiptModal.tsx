import React, { useState, useRef } from 'react';
import { X, Printer, Download, CloudUpload, Check, Copy, AlertCircle, Plus, Trash2, Banknote, FileText } from 'lucide-react';
import html2canvas from 'html2canvas';
import { toPng } from 'html-to-image';
import { Category, PaymentMethod, Transaction, PaperSize } from '../types';
import { uploadReceipt } from '../lib/api';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  shopName: string;
  onSaveReceiptTransaction: (tx: Omit<Transaction, 'id' | 'created_at' | 'user_id'>) => Promise<Transaction>;
}

interface ItemRow {
  description: string;
  quantity: number;
  rate: number;
  total: number;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  onClose,
  categories,
  shopName,
  onSaveReceiptTransaction,
}) => {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paperSize, setPaperSize] = useState<PaperSize>('thermal');
  const [discount, setDiscount] = useState<number>(0);
  const [paidAmount, setPaidAmount] = useState<string>('');
  const [receiptNumber] = useState<string>(() => `OS-${Date.now().toString().slice(-6)}`);
  const [items, setItems] = useState<ItemRow[]>([
    { description: 'Online Govt Form Fill-Up & Print', quantity: 1, rate: 150, total: 150 },
  ]);

  const [isUploading, setIsUploading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isSavedInDb, setIsSavedInDb] = useState(false);

  const receiptRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const subtotal = items.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
  const grandTotal = Math.max(0, subtotal - (Number(discount) || 0));
  const paid = paidAmount !== '' ? Number(paidAmount) : grandTotal;
  const due = Math.max(0, grandTotal - paid);
  const isFullyPaid = due <= 0;

  const handleItemChange = (index: number, field: keyof ItemRow, value: any) => {
    const updated = [...items];
    const item = { ...updated[index], [field]: value };
    if (field === 'quantity' || field === 'rate') {
      const q = field === 'quantity' ? Number(value) : item.quantity;
      const r = field === 'rate' ? Number(value) : item.rate;
      item.total = q * r;
    }
    updated[index] = item;
    setItems(updated);
  };

  const addItem = () => {
    setItems([...items, { description: '', quantity: 1, rate: 0, total: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  // High-fidelity image capture using toPng (with html2canvas fallback)
  const captureReceiptImage = async (): Promise<string | null> => {
    if (!receiptRef.current) return null;
    const el = receiptRef.current;

    try {
      // Modern SVG foreignObject capture - preserves crisp CSS grid, flex, colors, borders
      const dataUrl = await toPng(el, {
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        cacheBust: true,
        skipFonts: true,
      });
      return dataUrl;
    } catch (err) {
      console.warn('toPng failed, falling back to html2canvas:', err);
      try {
        const canvas = await html2canvas(el, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
        });
        return canvas.toDataURL('image/png');
      } catch (canvasErr) {
        console.error('All capture methods failed:', canvasErr);
        return null;
      }
    }
  };

  const handleDownloadImage = async () => {
    try {
      setIsDownloading(true);
      const dataUrl = await captureReceiptImage();
      if (!dataUrl) {
        throw new Error('Unable to render memo image.');
      }
      const link = document.createElement('a');
      const cleanShopName = (shopName || 'Online_Sheba').replace(/\s+/g, '_');
      link.download = `${cleanShopName}_Cash_Memo_${receiptNumber}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      alert('Could not download memo image: ' + (err.message || 'Error occurred'));
    } finally {
      setIsDownloading(false);
    }
  };

  // Foolproof print engine matching preview 100% for A4 or 88mm Thermal POS
  const triggerPrintHtml = (printContentHtml: string) => {
    // 1. Remove old print iframes
    const oldIframes = document.querySelectorAll('.receipt-print-iframe');
    oldIframes.forEach((el) => el.remove());

    // 2. Create isolated hidden iframe
    const iframe = document.createElement('iframe');
    iframe.className = 'receipt-print-iframe';
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

    const isThermal = paperSize === 'thermal';
    const pageStyles = isThermal
      ? `@page { size: 80mm auto; margin: 2mm; }
         body { width: 78mm; margin: 0 auto; padding: 4px; font-family: 'JetBrains Mono', monospace; font-size: 11px; }`
      : `@page { size: A4 portrait; margin: 8mm; }
         body { width: 100%; max-width: 680px; margin: 0 auto; padding: 12px; font-family: 'Geist', 'Hind Siliguri', sans-serif; font-size: 12px; }`;

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${shopName || 'Online Sheba'} - Cash Memo ${receiptNumber}</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;600;700;800;900&family=Hind+Siliguri:wght@400;600;700&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet">
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
      } catch (err) {
        console.warn('iframe print was blocked, falling back to new window print:', err);
        handlePrintInNewWindow();
      } finally {
        setTimeout(() => {
          iframe.remove();
        }, 5000);
      }
    }, 400);
  };

  const handlePrint = () => {
    if (!receiptRef.current) return;
    setIsPrinting(true);
    try {
      const html = receiptRef.current.outerHTML;
      triggerPrintHtml(html);
    } catch (e) {
      console.error('Print failed:', e);
      handlePrintInNewWindow();
    } finally {
      setIsPrinting(false);
    }
  };

  const handlePrintInNewWindow = () => {
    if (!receiptRef.current) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Pop-up was blocked. Please allow popups for this site to open print window.');
      return;
    }
    const isThermal = paperSize === 'thermal';
    const html = receiptRef.current.outerHTML;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${shopName || 'Online Sheba'} - Cash Memo ${receiptNumber}</title>
          <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;600;700;800;900&family=Hind+Siliguri:wght@400;600;700&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet">
          <style>
            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color-adjust: exact !important;
            }
            body {
              margin: 0;
              padding: ${isThermal ? '6px' : '20px'};
              background: #ffffff;
              color: #111827;
              display: flex;
              justify-content: center;
              font-family: ${isThermal ? "'JetBrains Mono', monospace" : "'Geist', 'Hind Siliguri', sans-serif"};
            }
            .wrapper {
              width: ${isThermal ? '78mm' : '100%'};
              max-width: ${isThermal ? '78mm' : '680px'};
            }
            @page {
              size: ${isThermal ? '80mm auto' : 'A4 portrait'};
              margin: ${isThermal ? '2mm' : '8mm'};
            }
          </style>
        </head>
        <body>
          <div class="wrapper">
            ${html}
          </div>
          <script>
            window.onload = function() {
              window.focus();
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleUploadAndSave = async () => {
    setIsUploading(true);
    setUploadError(null);

    try {
      let receiptUrl: string | undefined = undefined;

      try {
        const dataUrl = await captureReceiptImage();
        if (dataUrl) {
          const uploadRes = await uploadReceipt(dataUrl, `receipt_${receiptNumber}`);
          receiptUrl = uploadRes.url;
          setUploadedUrl(uploadRes.url);
        }
      } catch (err: any) {
        console.warn('Receipt image render fallback:', err);
      }

      const itemDescriptions = items.map((i) => i.description).filter(Boolean).join(', ');
      await onSaveReceiptTransaction({
        type: 'sale',
        category: items[0]?.description || 'Cash Memo Sale',
        description: `Memo #${receiptNumber} - ${itemDescriptions}`,
        amount: grandTotal,
        payment_method: paymentMethod,
        customer_name: customerName || undefined,
        customer_phone: customerPhone || undefined,
        receipt_url: receiptUrl,
      });

      setIsSavedInDb(true);
    } catch (err: any) {
      setUploadError(err.message || 'Failed to save transaction');
    } finally {
      setIsUploading(false);
    }
  };

  const copyUrlToClipboard = () => {
    if (uploadedUrl) {
      navigator.clipboard.writeText(uploadedUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-zinc-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-3xl max-w-5xl w-full border border-zinc-200 shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-zinc-900">
                Official Cash Memo / Invoice
              </h3>
              <p className="text-xs text-zinc-500">
                Professional dual-format invoice with signature lines for A4 & 88mm Thermal POS
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

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Form (Inputs) */}
          <div className="lg:col-span-5 space-y-4">
            {/* Format Toggle Pill */}
            <div>
              <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                Paper Size & Font Style:
              </label>
              <div className="bg-zinc-100 p-1 rounded-xl grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={() => setPaperSize('thermal')}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition-all text-center ${
                    paperSize === 'thermal'
                      ? 'bg-zinc-900 text-white shadow-xs'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  88mm POS Thermal
                </button>
                <button
                  type="button"
                  onClick={() => setPaperSize('a4')}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition-all text-center ${
                    paperSize === 'a4'
                      ? 'bg-zinc-900 text-white shadow-xs'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  Standard A4 Invoice
                </button>
              </div>
            </div>

            {/* Customer Inputs */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  Customer Name:
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Md. Zahid Hasan"
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-semibold focus:border-zinc-900 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  Phone (Optional):
                </label>
                <input
                  type="text"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="01XXXXXXXXX"
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono font-semibold focus:border-zinc-900 focus:outline-none"
                />
              </div>
            </div>

            {/* Line Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-zinc-700">
                  Products & Services:
                </label>
                <button
                  type="button"
                  onClick={addItem}
                  className="text-xs font-semibold text-indigo-700 hover:text-indigo-900 flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Item
                </button>
              </div>

              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                      placeholder="Service / Product name"
                      className="flex-1 px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-medium focus:outline-none focus:border-zinc-900"
                    />
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                      placeholder="Qty"
                      title="Quantity"
                      className="w-14 px-2 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-center font-mono focus:outline-none"
                    />
                    <input
                      type="number"
                      min="0"
                      value={item.rate}
                      onChange={(e) => handleItemChange(idx, 'rate', e.target.value)}
                      placeholder="Rate"
                      title="Rate"
                      className="w-16 px-2 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-center font-mono focus:outline-none"
                    />
                    <span className="w-16 text-xs font-mono font-bold text-right text-zinc-900">
                      ৳{item.total}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      disabled={items.length <= 1}
                      className="p-1.5 text-zinc-300 hover:text-rose-600 disabled:opacity-30"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Calculations & Discounts */}
            <div className="grid grid-cols-3 gap-2.5 pt-2 border-t border-zinc-100">
              <div>
                <label className="block text-[11px] font-bold text-zinc-600 mb-1">
                  Discount (৳):
                </label>
                <input
                  type="number"
                  min="0"
                  value={discount || ''}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                  placeholder="0"
                  className="w-full px-2.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono font-semibold"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-zinc-600 mb-1">
                  Paid Amount (৳):
                </label>
                <input
                  type="number"
                  min="0"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  placeholder={String(grandTotal)}
                  className="w-full px-2.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono font-bold text-emerald-700"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-zinc-600 mb-1">
                  Due Balance:
                </label>
                <div className="px-2.5 py-2 bg-zinc-100 border border-zinc-200 rounded-xl text-xs font-mono font-bold text-rose-600">
                  ৳{due}
                </div>
              </div>
            </div>

            {/* Payment Method */}
            <div>
              <label className="block text-xs font-bold text-zinc-700 mb-1.5">
                Paid Via:
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('cash')}
                  className={`py-2 px-2 text-xs font-bold rounded-xl border flex items-center justify-center gap-1.5 transition-all ${
                    paymentMethod === 'cash'
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-zinc-50 text-emerald-800 border-zinc-200'
                  }`}
                >
                  <Banknote className="w-3.5 h-3.5" />
                  <span>Cash</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('bkash')}
                  className={`py-2 px-2 text-xs font-bold rounded-xl border flex items-center justify-center gap-1 transition-all ${
                    paymentMethod === 'bkash'
                      ? 'bg-[#e2136e] text-white border-[#e2136e]'
                      : 'bg-zinc-50 text-[#e2136e] border-zinc-200'
                  }`}
                >
                  <span className="font-extrabold text-[12px]">৳</span>
                  <span>bKash</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('nagad')}
                  className={`py-2 px-2 text-xs font-bold rounded-xl border flex items-center justify-center gap-1 transition-all ${
                    paymentMethod === 'nagad'
                      ? 'bg-[#ea580c] text-white border-[#ea580c]'
                      : 'bg-zinc-50 text-[#ea580c] border-zinc-200'
                  }`}
                >
                  <span className="font-extrabold text-[12px]">৳</span>
                  <span>Nagad</span>
                </button>
              </div>
            </div>

            {uploadError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            {isSavedInDb && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span className="font-semibold">Recorded into Transaction Ledger!</span>
                </div>
                {uploadedUrl && (
                  <button
                    onClick={copyUrlToClipboard}
                    className="flex items-center gap-1 text-[11px] font-bold text-emerald-800 underline"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {copiedLink ? 'Copied' : 'Copy Link'}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Right Preview (A4 or 88mm Thermal) */}
          <div className="lg:col-span-7 flex flex-col items-center justify-between bg-zinc-100/70 p-4 sm:p-5 rounded-2xl border border-zinc-200 overflow-x-auto">
            {/* The Actual Renderable Element with Pure Hex Colors & Explicit Inline Styles */}
            <div
              id="printable-receipt"
              ref={receiptRef}
              style={{
                backgroundColor: '#ffffff',
                color: '#111827',
              }}
              className={`bg-white rounded-xl shadow-md text-zinc-950 transition-all ${
                paperSize === 'thermal'
                  ? 'w-[320px] p-5 border border-zinc-400 font-mono text-[11px]'
                  : 'w-full max-w-[620px] p-6 sm:p-7 border border-zinc-300 font-sans text-xs'
              }`}
            >
              {/* === A4 / STANDARD FORMAT === */}
              {paperSize === 'a4' ? (
                <div className="space-y-4">
                  {/* Big Colorful Header Banner */}
                  <div
                    className="flex items-start justify-between pb-4 border-b-2"
                    style={{ borderBottomColor: '#4f46e5' }}
                  >
                    <div>
                      {/* Big Bold Shop Name */}
                      <h2
                        className="text-2xl sm:text-3xl font-black tracking-tight uppercase"
                        style={{ color: '#1e1b4b' }}
                      >
                        {shopName}
                      </h2>
                      <p
                        className="text-xs font-bold mt-0.5"
                        style={{ color: '#4f46e5' }}
                      >
                        COMPUTER & ONLINE DIGITAL SERVICE CENTER
                      </p>
                      <p
                        className="text-[11px] mt-1"
                        style={{ color: '#6b7280' }}
                      >
                        Photocopy • Composition • Govt & Job Applications • Photo Print
                      </p>
                    </div>

                    <div className="text-right">
                      <div
                        className="inline-block px-3 py-1 rounded-lg font-black text-xs uppercase tracking-wider"
                        style={{
                          backgroundColor: '#eef2ff',
                          color: '#312e81',
                          border: '1px solid #c7d2fe',
                        }}
                      >
                        CASH MEMO
                      </div>
                      <div className="mt-2 font-mono text-xs">
                        <span style={{ color: '#9ca3af' }}>NO: </span>
                        <span className="font-bold" style={{ color: '#111827' }}>{receiptNumber}</span>
                      </div>
                      <div className="font-mono text-[11px]" style={{ color: '#6b7280' }}>
                        {new Date().toLocaleDateString('en-GB')}
                      </div>
                    </div>
                  </div>

                  {/* Customer & Billing Meta Grid */}
                  <div
                    className="grid grid-cols-2 gap-4 p-3 rounded-xl text-xs"
                    style={{
                      backgroundColor: '#f9fafb',
                      border: '1px solid #e5e7eb',
                    }}
                  >
                    <div>
                      <span className="text-[10px] uppercase font-bold block" style={{ color: '#9ca3af' }}>
                        Billed To:
                      </span>
                      <span className="font-bold text-sm" style={{ color: '#111827' }}>
                        {customerName || 'Walk-in Customer'}
                      </span>
                      {customerPhone && (
                        <span className="font-mono block text-xs mt-0.5" style={{ color: '#4b5563' }}>
                          Phone: {customerPhone}
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold block" style={{ color: '#9ca3af' }}>
                        Payment Mode:
                      </span>
                      <span className="font-bold uppercase" style={{ color: '#111827' }}>
                        {paymentMethod}
                      </span>
                      <div className="mt-1">
                        {isFullyPaid ? (
                          <span
                            className="inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold"
                            style={{
                              backgroundColor: '#dcfce7',
                              color: '#166534',
                              border: '1px solid #86efac',
                            }}
                          >
                            PAID IN FULL
                          </span>
                        ) : (
                          <span
                            className="inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold"
                            style={{
                              backgroundColor: '#fee2e2',
                              color: '#991b1b',
                              border: '1px solid #fca5a5',
                            }}
                          >
                            PARTIAL / DUE
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Structured Rows & Columns Product Table */}
                  <div
                    className="overflow-hidden rounded-xl"
                    style={{ border: '1px solid #d1d5db' }}
                  >
                    <table className="w-full text-left text-xs" style={{ borderCollapse: 'collapse' }}>
                      <thead>
                        <tr
                          style={{
                            backgroundColor: '#1e1b4b',
                            color: '#ffffff',
                            fontWeight: 'bold',
                            fontSize: '11px',
                          }}
                        >
                          <th className="py-2.5 px-3 w-10 text-center">SL</th>
                          <th className="py-2.5 px-3">Service / Item Description</th>
                          <th className="py-2.5 px-3 text-center w-14">Qty</th>
                          <th className="py-2.5 px-3 text-right w-20">Rate (৳)</th>
                          <th className="py-2.5 px-3 text-right w-24">Total (৳)</th>
                        </tr>
                      </thead>
                      <tbody style={{ color: '#27272a' }}>
                        {items.map((it, i) => (
                          <tr
                            key={i}
                            style={{
                              backgroundColor: i % 2 === 1 ? '#f9fafb' : '#ffffff',
                              borderBottom: '1px solid #e5e7eb',
                            }}
                          >
                            <td className="py-2 px-3 text-center font-mono" style={{ color: '#9ca3af' }}>
                              {i + 1}
                            </td>
                            <td className="py-2 px-3 font-semibold" style={{ color: '#111827' }}>
                              {it.description || 'Service'}
                            </td>
                            <td className="py-2 px-3 text-center font-mono">{it.quantity}</td>
                            <td className="py-2 px-3 text-right font-mono">৳{it.rate}</td>
                            <td className="py-2 px-3 text-right font-mono font-bold" style={{ color: '#09090b' }}>
                              ৳{it.total}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Totals Section */}
                  <div className="flex justify-end pt-2">
                    <div className="w-56 space-y-1.5 text-xs">
                      <div className="flex justify-between" style={{ color: '#52525b' }}>
                        <span>Subtotal:</span>
                        <span className="font-mono font-bold">৳{subtotal}</span>
                      </div>
                      {discount > 0 && (
                        <div className="flex justify-between" style={{ color: '#52525b' }}>
                          <span>Discount:</span>
                          <span className="font-mono font-bold" style={{ color: '#059669' }}>
                            -৳{discount}
                          </span>
                        </div>
                      )}
                      <div
                        className="flex justify-between font-black pt-1.5 text-sm"
                        style={{
                          borderTop: '2px solid #4f46e5',
                          color: '#1e1b4b',
                        }}
                      >
                        <span>Total Payable:</span>
                        <span className="font-mono">৳{grandTotal}</span>
                      </div>
                      <div className="flex justify-between font-bold" style={{ color: '#27272a' }}>
                        <span>Amount Paid ({paymentMethod.toUpperCase()}):</span>
                        <span className="font-mono" style={{ color: '#047857' }}>
                          ৳{paid}
                        </span>
                      </div>
                      {due > 0 && (
                        <div className="flex justify-between font-bold" style={{ color: '#dc2626' }}>
                          <span>Due Balance:</span>
                          <span className="font-mono">৳{due}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Signatures Section */}
                  <div className="pt-10 grid grid-cols-2 gap-8 text-center text-[11px]" style={{ color: '#4b5563' }}>
                    <div>
                      <div
                        className="w-36 mx-auto mb-1.5"
                        style={{ borderBottom: '1px solid #9ca3af' }}
                      ></div>
                      <span className="font-semibold">Customer Signature</span>
                      <p className="text-[9px]" style={{ color: '#9ca3af' }}>(গ্রাহকের স্বাক্ষর)</p>
                    </div>
                    <div>
                      <div
                        className="w-36 mx-auto mb-1.5"
                        style={{ borderBottom: '1px solid #9ca3af' }}
                      ></div>
                      <span className="font-semibold">Authorized Signature & Seal</span>
                      <p className="text-[9px]" style={{ color: '#9ca3af' }}>(কর্তৃপক্ষের স্বাক্ষর ও সিল)</p>
                    </div>
                  </div>

                  {/* Memo Footer */}
                  <div
                    className="pt-4 text-center text-[10px]"
                    style={{
                      borderTop: '1px dashed #e5e7eb',
                      color: '#9ca3af',
                    }}
                  >
                    Thank you for your business! Please preserve this memo for any queries.
                  </div>
                </div>
              ) : (
                /* === 88MM / 80MM POS THERMAL FORMAT === */
                <div
                  className="space-y-3 font-mono text-[11px]"
                  style={{ color: '#000000' }}
                >
                  {/* Big Bold Shop Name */}
                  <div
                    className="text-center pb-2"
                    style={{ borderBottom: '2px solid #000000' }}
                  >
                    <h3 className="text-xl font-black uppercase tracking-tight text-black">
                      {shopName}
                    </h3>
                    <p className="text-[10px] font-bold mt-0.5">
                      COMPUTER & ONLINE SERVICES
                    </p>
                    <p className="text-[9px]" style={{ color: '#52525b' }}>
                      Photocopy • Compose • Online Forms
                    </p>
                    <div
                      className="mt-1 font-bold text-[10px] inline-block px-2 py-0.5"
                      style={{ border: '1px solid #000000' }}
                    >
                      CASH RECEIPT (POS)
                    </div>
                  </div>

                  {/* POS Details */}
                  <div
                    className="space-y-0.5 text-[10px] pb-2"
                    style={{ borderBottom: '1px dashed #52525b' }}
                  >
                    <div className="flex justify-between">
                      <span>MEMO NO:</span>
                      <span className="font-bold">{receiptNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>DATE:</span>
                      <span>
                        {new Date().toLocaleDateString('en-GB')}{' '}
                        {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>CUSTOMER:</span>
                      <span className="font-bold truncate max-w-[150px]">{customerName || 'Walk-in'}</span>
                    </div>
                    {customerPhone && (
                      <div className="flex justify-between">
                        <span>PHONE:</span>
                        <span>{customerPhone}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>PAY VIA:</span>
                      <span className="font-bold uppercase">{paymentMethod}</span>
                    </div>
                  </div>

                  {/* POS Rows & Columns Table */}
                  <div
                    className="pb-2"
                    style={{ borderBottom: '1px dashed #52525b' }}
                  >
                    <table className="w-full text-left text-[10px]" style={{ borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #000000', fontWeight: 'bold' }}>
                          <th className="pb-1">ITEM</th>
                          <th className="pb-1 text-center w-8">QTY</th>
                          <th className="pb-1 text-right w-12">RATE</th>
                          <th className="pb-1 text-right w-14">TOTAL</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((it, i) => (
                          <tr key={i} style={{ borderBottom: '1px dotted #a1a1aa' }}>
                            <td className="py-1 font-semibold pr-1">{it.description || 'Item'}</td>
                            <td className="py-1 text-center">{it.quantity}</td>
                            <td className="py-1 text-right">৳{it.rate}</td>
                            <td className="py-1 text-right font-bold">৳{it.total}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* POS Totals */}
                  <div
                    className="space-y-0.5 text-[11px] pb-2"
                    style={{ borderBottom: '2px solid #000000' }}
                  >
                    <div className="flex justify-between">
                      <span>SUBTOTAL:</span>
                      <span className="font-bold">৳{subtotal}</span>
                    </div>
                    {discount > 0 && (
                      <div className="flex justify-between">
                        <span>DISCOUNT:</span>
                        <span>-৳{discount}</span>
                      </div>
                    )}
                    <div
                      className="flex justify-between font-black text-xs pt-1"
                      style={{ borderTop: '1px solid #000000' }}
                    >
                      <span>NET TOTAL:</span>
                      <span>৳{grandTotal}</span>
                    </div>
                    <div className="flex justify-between font-bold">
                      <span>PAID ({paymentMethod.toUpperCase()}):</span>
                      <span>৳{paid}</span>
                    </div>
                    {due > 0 && (
                      <div className="flex justify-between font-bold" style={{ color: '#b91c1c' }}>
                        <span>DUE:</span>
                        <span>৳{due}</span>
                      </div>
                    )}
                  </div>

                  {/* POS Signature Line */}
                  <div className="pt-5 pb-1 flex justify-between text-[9px]" style={{ color: '#3f3f46' }}>
                    <div className="text-center">
                      <div className="w-24 mb-1" style={{ borderBottom: '1px solid #71717a' }}></div>
                      <span>Customer Sign</span>
                    </div>
                    <div className="text-center">
                      <div className="w-24 mb-1" style={{ borderBottom: '1px solid #71717a' }}></div>
                      <span>Authorized Sign</span>
                    </div>
                  </div>

                  {/* POS Barcode / Footer */}
                  <div className="text-center pt-2 space-y-0.5 text-[9px]">
                    <div className="tracking-[4px] font-mono font-bold text-xs">||| | |||| | ||||| |||</div>
                    <p className="font-bold">THANK YOU FOR YOUR VISIT!</p>
                    <p style={{ color: '#71717a' }}>PLEASE COME AGAIN</p>
                  </div>
                </div>
              )}
            </div>

            {/* Print & Download Action Buttons */}
            <div className="w-full max-w-[620px] mt-4 flex flex-wrap items-center gap-2.5 no-print">
              <button
                type="button"
                onClick={handlePrint}
                disabled={isPrinting}
                className="flex-1 min-w-[140px] py-3 px-4 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md active:scale-98 disabled:opacity-50"
              >
                <Printer className="w-4 h-4 text-emerald-400" />
                <span>
                  {isPrinting
                    ? 'Opening Print Dialog...'
                    : `Print ${paperSize === 'thermal' ? '88mm Thermal POS' : 'A4 Invoice'}`}
                </span>
              </button>

              <button
                type="button"
                onClick={handlePrintInNewWindow}
                className="py-3 px-3.5 bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 text-zinc-800 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-2xs"
                title="Open clean printable view in new browser tab"
              >
                <Printer className="w-4 h-4 text-zinc-600" />
                <span className="hidden sm:inline">Print in New Tab</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadImage}
                disabled={isDownloading}
                className="flex-1 min-w-[130px] py-3 px-4 bg-white border border-zinc-300 hover:bg-zinc-100 rounded-xl text-xs font-bold text-zinc-800 flex items-center justify-center gap-2 transition-all shadow-xs disabled:opacity-50"
              >
                <Download className="w-4 h-4 text-indigo-600" />
                <span>{isDownloading ? 'Generating PNG...' : 'Download PNG'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-zinc-100 bg-zinc-50 flex items-center justify-between">
          <span className="text-xs text-zinc-500 font-semibold">
            Paper: <span className="text-zinc-800 font-bold">{paperSize === 'thermal' ? '88mm POS Thermal' : 'A4 Office Sheet'}</span>
          </span>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-700 hover:bg-zinc-100"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleUploadAndSave}
              disabled={isUploading || isSavedInDb}
              className="px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold flex items-center gap-2 shadow-sm disabled:opacity-50"
            >
              <CloudUpload className="w-4 h-4 text-indigo-300" />
              <span>
                {isUploading ? 'Recording...' : isSavedInDb ? 'Saved to Accounts' : 'Save & Record Memo'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
