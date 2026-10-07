import React, { useState, useRef } from 'react';
import { X, Printer, Download, CloudUpload, Check, Copy, AlertCircle, Plus, Trash2, Banknote } from 'lucide-react';
import html2canvas from 'html2canvas';
import { Category, PaymentMethod, Transaction } from '../types';
import { uploadReceipt } from '../lib/api';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  onSaveReceiptTransaction: (tx: Omit<Transaction, 'id' | 'created_at'>) => Promise<Transaction>;
  isRemote: boolean;
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
  onSaveReceiptTransaction,
  isRemote,
}) => {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
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
      backgroundColor: '#ffffff',
    });
  };

  const handleDownloadImage = async () => {
    const canvas = await captureCanvas();
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `Online_Sheba_Memo_${receiptNumber}.png`;
    link.href = dataUrl;
    link.click();
  };

  const handleUploadAndSave = async () => {
    setIsUploading(true);
    setUploadError(null);

    try {
      const canvas = await captureCanvas();
      if (!canvas) throw new Error('Failed to render receipt canvas');

      const dataUrl = canvas.toDataURL('image/png');
      const uploadRes = await uploadReceipt(dataUrl, `receipt_${receiptNumber}`);
      setUploadedUrl(uploadRes.url);

      const itemDescriptions = items.map((i) => i.description).filter(Boolean).join(', ');
      await onSaveReceiptTransaction({
        type: 'sale',
        category: items[0]?.description || 'Digital Cash Memo',
        description: `Memo #${receiptNumber} - ${itemDescriptions}`,
        amount: grandTotal,
        payment_method: paymentMethod,
        customer_name: customerName || undefined,
        customer_phone: customerPhone || undefined,
        receipt_url: uploadRes.url,
      });

      setIsSavedInDb(true);
    } catch (err: any) {
      setUploadError(err.message || 'Failed to save receipt');
    } finally {
      setIsUploading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const copyUrlToClipboard = () => {
    if (uploadedUrl) {
      const fullUrl = uploadedUrl.startsWith('http')
        ? uploadedUrl
        : `${window.location.origin}${uploadedUrl}`;
      navigator.clipboard.writeText(fullUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-zinc-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-3xl max-w-4xl w-full border border-zinc-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Bar */}
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/70">
          <div>
            <h3 className="text-base font-extrabold text-zinc-900">
              Digital Cash Memo / Receipt Generator
            </h3>
            <p className="text-xs text-zinc-500">
              Generate branded receipts and backup to cloud storage
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200/60"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Form Inputs (Left) */}
          <div className="lg:col-span-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  Customer Name:
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Md. Kabir Hossain"
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-medium focus:border-zinc-900 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  Mobile Number:
                </label>
                <input
                  type="text"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="01XXXXXXXXX"
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono font-medium focus:border-zinc-900 focus:outline-none"
                />
              </div>
            </div>

            {/* Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-zinc-700">
                  Services / Line Items:
                </label>
                <button
                  type="button"
                  onClick={addItem}
                  className="text-xs font-semibold text-indigo-700 hover:text-indigo-900 flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Row
                </button>
              </div>

              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                      placeholder="Service description"
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
                  className="w-full px-2.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono"
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
                  className="w-full px-2.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono font-bold"
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

            {/* Payment Method Selector - Separated Cash, bKash, and Nagad */}
            <div>
              <label className="block text-xs font-bold text-zinc-700 mb-1.5">
                Payment Method:
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

            {/* Status alerts */}
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

          {/* Printable Preview (Right) */}
          <div className="lg:col-span-6 flex flex-col items-center justify-between bg-zinc-50/70 p-4 sm:p-5 rounded-2xl border border-zinc-200">
            <div
              id="printable-receipt"
              ref={receiptRef}
              className="w-full max-w-sm bg-white p-6 rounded-xl border border-zinc-300 shadow-sm text-zinc-900 text-xs font-sans"
            >
              {/* Receipt Header */}
              <div className="text-center pb-3.5 border-b-2 border-zinc-900">
                <h4 className="text-base font-black tracking-tight text-zinc-950 uppercase">
                  ONLINE SHEBA
                </h4>
                <p className="text-[11px] font-semibold text-indigo-700 mt-0.5">
                  Computer & Online Services Center
                </p>
                <p className="text-[10px] text-zinc-500">
                  Photocopy • Composition • Govt & Job Applications
                </p>
                <div className="mt-2 inline-block px-2.5 py-0.5 bg-zinc-900 text-white rounded font-mono font-bold text-[10px] tracking-wider uppercase">
                  Official Cash Memo
                </div>
              </div>

              {/* Receipt Metadata */}
              <div className="py-3 border-b border-zinc-200 space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Receipt No:</span>
                  <span className="font-mono font-bold text-zinc-900">{receiptNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Date & Time:</span>
                  <span className="font-mono text-zinc-700">
                    {new Date().toLocaleDateString('en-US')} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                {customerName && (
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Customer:</span>
                    <span className="font-bold text-zinc-900">{customerName}</span>
                  </div>
                )}
                {customerPhone && (
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Phone:</span>
                    <span className="font-mono text-zinc-800">{customerPhone}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-zinc-500">Payment Via:</span>
                  <span className="font-bold uppercase text-zinc-800">{paymentMethod}</span>
                </div>
              </div>

              {/* Items Table */}
              <div className="py-3 border-b border-zinc-200">
                <table className="w-full text-left text-[11px]">
                  <thead>
                    <tr className="border-b border-zinc-200 text-zinc-500 font-bold">
                      <th className="pb-1.5">Service</th>
                      <th className="pb-1.5 text-center">Qty</th>
                      <th className="pb-1.5 text-right">Rate</th>
                      <th className="pb-1.5 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {items.map((it, i) => (
                      <tr key={i} className="text-zinc-800">
                        <td className="py-1.5 pr-1 font-medium">{it.description || 'Service Item'}</td>
                        <td className="py-1.5 text-center font-mono">{it.quantity}</td>
                        <td className="py-1.5 text-right font-mono">৳{it.rate}</td>
                        <td className="py-1.5 text-right font-mono font-bold">৳{it.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals Breakdown */}
              <div className="pt-3 space-y-1 text-[11px]">
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
                <div className="flex justify-between text-zinc-950 font-black border-t border-zinc-200 pt-1.5 text-xs">
                  <span>Grand Total:</span>
                  <span className="font-mono text-sm">৳{grandTotal}</span>
                </div>
                <div className="flex justify-between text-zinc-700">
                  <span>Paid ({paymentMethod.toUpperCase()}):</span>
                  <span className="font-mono font-bold">৳{paid}</span>
                </div>
                {due > 0 && (
                  <div className="flex justify-between text-rose-600 font-bold">
                    <span>Due Balance:</span>
                    <span className="font-mono">৳{due}</span>
                  </div>
                )}
              </div>

              {/* Receipt Footer */}
              <div className="mt-4 pt-3 border-t border-dashed border-zinc-300 text-center space-y-1">
                <p className="text-[10px] text-zinc-500 font-semibold">
                  Thank you for visiting Online Sheba!
                </p>
                <p className="text-[9px] text-zinc-400">
                  Fast • Reliable • Professional Computing Services
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="w-full max-w-sm mt-4 flex items-center gap-2 no-print">
              <button
                type="button"
                onClick={handlePrint}
                className="flex-1 py-2.5 px-3 bg-white border border-zinc-300 hover:bg-zinc-100 rounded-xl text-xs font-bold text-zinc-800 flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Memo</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadImage}
                className="flex-1 py-2.5 px-3 bg-white border border-zinc-300 hover:bg-zinc-100 rounded-xl text-xs font-bold text-zinc-800 flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download PNG</span>
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-zinc-100 bg-zinc-50 flex items-center justify-between">
          <span className="text-xs text-zinc-500 font-medium">
            {isRemote ? 'Backing up to Supabase Cloud Storage' : 'Backing up to Server Storage'}
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
              className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              <CloudUpload className="w-3.5 h-3.5" />
              <span>
                {isUploading ? 'Uploading...' : isSavedInDb ? 'Saved to DB' : 'Generate & Save Memo'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
