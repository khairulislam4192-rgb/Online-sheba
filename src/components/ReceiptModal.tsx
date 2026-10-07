import React, { useState, useRef } from 'react';
import { X, Printer, Download, CloudUpload, Check, Copy, AlertCircle, Plus, Trash2, Banknote, Sparkles, FileText, CheckCircle2 } from 'lucide-react';
import html2canvas from 'html2canvas';
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

  const captureCanvas = async (): Promise<HTMLCanvasElement | null> => {
    if (!receiptRef.current) return null;
    return await html2canvas(receiptRef.current, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });
  };

  const handleDownloadImage = async () => {
    try {
      const canvas = await captureCanvas();
      if (!canvas) return;
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `${shopName.replace(/\s+/g, '_')}_Memo_${receiptNumber}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err: any) {
      alert('Could not download image: ' + err.message);
    }
  };

  const handlePrint = () => {
    if (!receiptRef.current) return;
    const content = receiptRef.current.innerHTML;
    const printWindow = window.open('', '_blank', 'width=850,height=950');
    if (!printWindow) {
      window.print();
      return;
    }

    const isThermal = paperSize === 'thermal';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Cash Memo - ${receiptNumber}</title>
          <style>
            @page {
              size: ${isThermal ? '80mm auto' : 'A4 portrait'};
              margin: ${isThermal ? '3mm' : '15mm'};
            }
            body {
              font-family: ${
                isThermal
                  ? "'JetBrains Mono', 'Courier New', Courier, monospace"
                  : "'Geist', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
              };
              color: #111;
              background: #fff;
              margin: 0;
              padding: ${isThermal ? '2px' : '10px'};
              font-size: ${isThermal ? '11px' : '13px'};
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            * { box-sizing: border-box; }
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: ${isThermal ? '4px 2px' : '8px 6px'}; }
            .border-grid th, .border-grid td { border: 1px solid #d1d5db; }
            .dashed-line { border-bottom: 1px dashed #4b5563; margin: 8px 0; }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .font-bold { font-weight: bold; }
            .badge-paid { background: #dcfce7; color: #166534; padding: 2px 8px; border-radius: 9999px; font-weight: bold; border: 1px solid #86efac; }
            .badge-due { background: #ffe4e6; color: #9f1239; padding: 2px 8px; border-radius: 9999px; font-weight: bold; border: 1px solid #fda4af; }
          </style>
        </head>
        <body>
          ${content}
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 600);
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
        const canvas = await captureCanvas();
        if (canvas) {
          const dataUrl = canvas.toDataURL('image/png');
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
            {/* The Actual Renderable Element */}
            <div
              id="printable-receipt"
              ref={receiptRef}
              className={`bg-white rounded-xl shadow-md text-zinc-950 transition-all ${
                paperSize === 'thermal'
                  ? 'w-[320px] p-5 border border-zinc-400 font-mono text-[11px]'
                  : 'w-full max-w-lg p-7 border border-zinc-300 font-sans text-xs'
              }`}
            >
              {/* === A4 / STANDARD FORMAT === */}
              {paperSize === 'a4' ? (
                <div className="space-y-4">
                  {/* Big Colorful Header Banner */}
                  <div className="flex items-start justify-between pb-4 border-b-2 border-indigo-600">
                    <div>
                      {/* Big Bold Shop Name */}
                      <h2 className="text-2xl sm:text-3xl font-black text-indigo-950 tracking-tight uppercase">
                        {shopName}
                      </h2>
                      <p className="text-xs font-bold text-indigo-600 mt-0.5">
                        COMPUTER & ONLINE DIGITAL SERVICE CENTER
                      </p>
                      <p className="text-[11px] text-zinc-500 mt-1">
                        Photocopy • Composition • Govt & Job Applications • Photo Print
                      </p>
                    </div>

                    <div className="text-right">
                      <div className="inline-block px-3 py-1 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-lg font-black text-xs uppercase tracking-wider">
                        CASH MEMO
                      </div>
                      <div className="mt-2 font-mono text-xs">
                        <span className="text-zinc-400">NO: </span>
                        <span className="font-bold text-zinc-900">{receiptNumber}</span>
                      </div>
                      <div className="font-mono text-[11px] text-zinc-500">
                        {new Date().toLocaleDateString('en-GB')}
                      </div>
                    </div>
                  </div>

                  {/* Customer & Billing Meta Grid */}
                  <div className="grid grid-cols-2 gap-4 p-3 rounded-xl bg-zinc-50/80 border border-zinc-200 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-zinc-400 block">Billed To:</span>
                      <span className="font-bold text-zinc-900 text-sm">{customerName || 'Walk-in Customer'}</span>
                      {customerPhone && (
                        <span className="text-zinc-600 font-mono block text-xs mt-0.5">Phone: {customerPhone}</span>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-zinc-400 block">Payment Mode:</span>
                      <span className="font-bold uppercase text-zinc-900">{paymentMethod}</span>
                      <div className="mt-1">
                        {isFullyPaid ? (
                          <span className="inline-block px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold border border-emerald-300">
                            PAID IN FULL
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-extrabold border border-rose-300">
                            PARTIAL / DUE
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Structured Rows & Columns Product Table */}
                  <div className="overflow-hidden rounded-xl border border-zinc-300">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-indigo-900 text-white font-bold text-[11px]">
                          <th className="py-2.5 px-3 w-10 text-center">SL</th>
                          <th className="py-2.5 px-3">Service / Item Description</th>
                          <th className="py-2.5 px-3 text-center w-14">Qty</th>
                          <th className="py-2.5 px-3 text-right w-20">Rate (৳)</th>
                          <th className="py-2.5 px-3 text-right w-24">Total (৳)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200 text-zinc-800">
                        {items.map((it, i) => (
                          <tr key={i} className={i % 2 === 1 ? 'bg-zinc-50/70' : 'bg-white'}>
                            <td className="py-2 px-3 text-center font-mono text-zinc-400">{i + 1}</td>
                            <td className="py-2 px-3 font-semibold text-zinc-900">{it.description || 'Service'}</td>
                            <td className="py-2 px-3 text-center font-mono">{it.quantity}</td>
                            <td className="py-2 px-3 text-right font-mono">৳{it.rate}</td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-zinc-950">৳{it.total}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Totals Section */}
                  <div className="flex justify-end pt-2">
                    <div className="w-56 space-y-1.5 text-xs">
                      <div className="flex justify-between text-zinc-600">
                        <span>Subtotal:</span>
                        <span className="font-mono font-bold">৳{subtotal}</span>
                      </div>
                      {discount > 0 && (
                        <div className="flex justify-between text-zinc-600">
                          <span>Discount:</span>
                          <span className="font-mono text-emerald-600 font-bold">-৳{discount}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-indigo-950 font-black border-t-2 border-indigo-600 pt-1.5 text-sm">
                        <span>Total Payable:</span>
                        <span className="font-mono">৳{grandTotal}</span>
                      </div>
                      <div className="flex justify-between text-zinc-800 font-bold">
                        <span>Amount Paid ({paymentMethod.toUpperCase()}):</span>
                        <span className="font-mono text-emerald-700">৳{paid}</span>
                      </div>
                      {due > 0 && (
                        <div className="flex justify-between text-rose-600 font-bold">
                          <span>Due Balance:</span>
                          <span className="font-mono">৳{due}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Signatures Section */}
                  <div className="pt-10 grid grid-cols-2 gap-8 text-center text-[11px] text-zinc-600">
                    <div>
                      <div className="border-b border-zinc-400 w-36 mx-auto mb-1.5"></div>
                      <span className="font-semibold">Customer Signature</span>
                      <p className="text-[9px] text-zinc-400">(গ্রাহকের স্বাক্ষর)</p>
                    </div>
                    <div>
                      <div className="border-b border-zinc-400 w-36 mx-auto mb-1.5"></div>
                      <span className="font-semibold">Authorized Signature & Seal</span>
                      <p className="text-[9px] text-zinc-400">(কর্তৃপক্ষের স্বাক্ষর ও সিল)</p>
                    </div>
                  </div>

                  {/* Memo Footer */}
                  <div className="pt-4 border-t border-dashed border-zinc-200 text-center text-[10px] text-zinc-400">
                    Thank you for your business! Please preserve this memo for any queries.
                  </div>
                </div>
              ) : (
                /* === 88MM / 80MM POS THERMAL FORMAT === */
                <div className="space-y-3 font-mono text-black text-[11px]">
                  {/* Big Bold Shop Name */}
                  <div className="text-center pb-2 border-b-2 border-black">
                    <h3 className="text-xl font-black uppercase tracking-tight text-black">
                      {shopName}
                    </h3>
                    <p className="text-[10px] font-bold mt-0.5">
                      COMPUTER & ONLINE SERVICES
                    </p>
                    <p className="text-[9px] text-zinc-600">
                      Photocopy • Compose • Online Forms
                    </p>
                    <div className="mt-1 font-bold text-[10px] border border-black inline-block px-2 py-0.2">
                      CASH RECEIPT (POS)
                    </div>
                  </div>

                  {/* POS Details */}
                  <div className="space-y-0.5 text-[10px] border-b border-dashed border-zinc-600 pb-2">
                    <div className="flex justify-between">
                      <span>MEMO NO:</span>
                      <span className="font-bold">{receiptNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>DATE:</span>
                      <span>{new Date().toLocaleDateString('en-GB')} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
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
                  <div className="border-b border-dashed border-zinc-600 pb-2">
                    <table className="w-full text-left text-[10px]">
                      <thead>
                        <tr className="border-b border-black text-black font-black">
                          <th className="pb-1">ITEM</th>
                          <th className="pb-1 text-center w-8">QTY</th>
                          <th className="pb-1 text-right w-12">RATE</th>
                          <th className="pb-1 text-right w-14">TOTAL</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-dotted divide-zinc-400">
                        {items.map((it, i) => (
                          <tr key={i}>
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
                  <div className="space-y-0.5 text-[11px] border-b-2 border-black pb-2">
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
                    <div className="flex justify-between font-black text-xs pt-1 border-t border-black">
                      <span>NET TOTAL:</span>
                      <span>৳{grandTotal}</span>
                    </div>
                    <div className="flex justify-between font-bold">
                      <span>PAID ({paymentMethod.toUpperCase()}):</span>
                      <span>৳{paid}</span>
                    </div>
                    {due > 0 && (
                      <div className="flex justify-between font-bold text-rose-700">
                        <span>DUE:</span>
                        <span>৳{due}</span>
                      </div>
                    )}
                  </div>

                  {/* POS Signature Line */}
                  <div className="pt-5 pb-1 flex justify-between text-[9px] text-zinc-700">
                    <div className="text-center">
                      <div className="border-b border-zinc-500 w-24 mb-1"></div>
                      <span>Customer Sign</span>
                    </div>
                    <div className="text-center">
                      <div className="border-b border-zinc-500 w-24 mb-1"></div>
                      <span>Authorized Sign</span>
                    </div>
                  </div>

                  {/* POS Barcode / Footer */}
                  <div className="text-center pt-2 space-y-0.5 text-[9px]">
                    <div className="tracking-[4px] font-mono font-bold text-xs">||| | |||| | ||||| |||</div>
                    <p className="font-bold">THANK YOU FOR YOUR VISIT!</p>
                    <p className="text-zinc-500">PLEASE COME AGAIN</p>
                  </div>
                </div>
              )}
            </div>

            {/* Print & Download Action Buttons */}
            <div className="w-full max-w-lg mt-4 flex items-center gap-2.5 no-print">
              <button
                type="button"
                onClick={handlePrint}
                className="flex-1 py-3 px-4 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md active:scale-98"
              >
                <Printer className="w-4 h-4 text-emerald-400" />
                <span>Print {paperSize === 'thermal' ? '88mm POS Receipt' : 'A4 Invoice'}</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadImage}
                className="flex-1 py-3 px-4 bg-white border border-zinc-300 hover:bg-zinc-100 rounded-xl text-xs font-bold text-zinc-800 flex items-center justify-center gap-2 transition-all shadow-xs"
              >
                <Download className="w-4 h-4 text-indigo-600" />
                <span>Download PNG</span>
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
