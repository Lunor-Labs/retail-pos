import { useState } from 'react';
import { X, Printer, Share2 } from 'lucide-react';

import { InvoiceProps } from './types';
import { buildReceiptHTML } from './receiptHTML';
import { InvoicePreview } from './InvoicePreview';
import { shareOnWhatsApp, openPrintPopup } from './invoiceActions';

/**
 * Invoice modal — toolbar + on-screen preview.
 *
 * All thermal print logic lives in:
 *   receiptCSS.ts      → CSS + JS strings injected into the popup
 *   receiptHTML.ts     → assembles the standalone popup HTML document
 *   invoiceActions.ts  → openPrintPopup() + shareOnWhatsApp()
 *
 * The on-screen preview lives in:
 *   InvoicePreview.tsx → monospace receipt layout rendered in the modal
 */
export function Invoice({ invoiceData, onClose }: InvoiceProps) {
    const [showDiscount, setShowDiscount] = useState(false);

    const handlePrint = () =>
        openPrintPopup(invoiceData, showDiscount, buildReceiptHTML);

    const handleWhatsApp = () =>
        shareOnWhatsApp(invoiceData, showDiscount);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto">

                {/* ── Toolbar ── */}
                <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-slate-900">Invoice</h2>

                    <div className="flex items-center gap-4">
                        {invoiceData.discount > 0 && (
                            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={showDiscount}
                                    onChange={(e) => setShowDiscount(e.target.checked)}
                                    className="w-4 h-4 text-slate-900 border-slate-300 rounded focus:ring-slate-900"
                                />
                                Show Discount
                            </label>
                        )}

                        <div className="flex items-center gap-2 border-l pl-4 border-slate-200">
                            <button
                                onClick={handleWhatsApp}
                                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition"
                            >
                                <Share2 className="w-4 h-4" />
                                WhatsApp
                            </button>

                            <button
                                onClick={handlePrint}
                                className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition"
                            >
                                <Printer className="w-4 h-4" />
                                Print
                            </button>

                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-slate-100 rounded-lg transition"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* ── Screen preview ── */}
                <div className="p-6">
                    <InvoicePreview invoiceData={invoiceData} showDiscount={showDiscount} />
                </div>

            </div>
        </div>
    );
}
