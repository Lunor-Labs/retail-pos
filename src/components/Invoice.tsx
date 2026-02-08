import { X, Printer, Share2 } from 'lucide-react';
import logo from '../assets/favicon.jpeg';

export interface InvoiceItem {
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  batchNumber: string;
  warranty?: {
    duration: number;
    unit: 'days' | 'months' | 'years';
    type?: string;
  };
}

export interface InvoiceData {
  saleNumber: string;
  date: string;
  customerName?: string;
  customerPhone?: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paidAmount: number;
  changeAmount: number;
  serviceCharge?: number;
  paymentMethod: string;
  cashierName?: string;
}

interface InvoiceProps {
  invoiceData: InvoiceData;
  onClose: () => void;
}

export function Invoice({ invoiceData, onClose }: InvoiceProps) {
  const handlePrint = () => {
    window.print();
  };

  const handleWhatsAppShare = () => {
    let message = `🧾 *INVOICE: ${invoiceData.saleNumber}*\n`;
    message += `📅 Date: ${invoiceData.date}\n\n`;

    message += `🏢 *Gasith Motors*\n`;
    message += `📞 011-2345678\n\n`;

    if (invoiceData.customerName) {
      message += `👤 Customer: ${invoiceData.customerName}\n`;
      if (invoiceData.customerPhone) {
        message += `📱 Phone: ${invoiceData.customerPhone}\n`;
      }
      message += `\n`;
    }

    message += `*ITEMS*\n`;
    message += `--------------------------------\n`;

    invoiceData.items.forEach((item, index) => {
      message += `${index + 1}. ${item.name} ${item.batchNumber ? `(Batch: ${item.batchNumber})` : ''}\n`;
      if (item.warranty && item.warranty.duration > 0) {
        message += `   Warranty: ${item.warranty.duration} ${item.warranty.unit} ${item.warranty.type ? `(${item.warranty.type})` : ''}\n`;
      }
      message += `   ${item.quantity} x ${item.unitPrice.toFixed(2)} = LKR ${item.subtotal.toFixed(2)}\n\n`;
    });

    message += `--------------------------------\n`;

    // Summary details (Subtotal, Discount, Tax)
    if (invoiceData.discount > 0 || invoiceData.tax > 0 || (invoiceData.serviceCharge && invoiceData.serviceCharge > 0)) {
      message += `Subtotal: LKR ${invoiceData.subtotal.toFixed(2)}\n`;
      if (invoiceData.discount > 0) message += `Discount: -LKR ${invoiceData.discount.toFixed(2)}\n`;
      if (invoiceData.tax > 0) message += `Tax: LKR ${invoiceData.tax.toFixed(2)}\n`;
      if (invoiceData.serviceCharge && invoiceData.serviceCharge > 0) message += `Service Charge: LKR ${invoiceData.serviceCharge.toFixed(2)}\n`;
      message += `\n`;
    }

    // Grand Total
    message += `💰 *TOTAL: LKR ${invoiceData.total.toFixed(2)}*\n`;
    message += `--------------------------------\n\n`;

    // Payment details
    message += `💳 Payment: ${invoiceData.paymentMethod.toUpperCase()}\n`;
    if (invoiceData.paymentMethod !== 'credit') {
      message += `💵 Paid: LKR ${invoiceData.paidAmount.toFixed(2)}\n`;
      if (invoiceData.changeAmount > 0) {
        message += `🔄 Change: LKR ${invoiceData.changeAmount.toFixed(2)}\n`;
      }
    }

    if (invoiceData.cashierName) {
      message += `\nServed by: ${invoiceData.cashierName}`;
    }

    message += `\n\nThank you for your business! 🙏`;

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto">
          <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between no-print">
            <h2 className="text-xl font-bold text-slate-900">Invoice</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={handleWhatsAppShare}
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

          <div className="p-6 print:p-0" id="invoice-content">
            <div className="invoice-wrapper">
              {/* Header */}
              <div className="text-center mb-4">
                <div className="flex justify-center mb-2">
                  <img src={logo} alt="Gasith Motors" className="h-16 w-16 object-cover rounded-lg print:h-12 print:w-12" />
                </div>
                <h1 className="text-2xl font-bold text-slate-900 mb-1 print:text-lg">Gasith Motors</h1>
                <p className="text-sm text-slate-600 print:text-xs">Auto Parts & Accessories</p>
                <p className="text-xs text-slate-500 mt-1 print:text-[10px]">No: 123, Main Street, Colombo</p>
                <p className="text-xs text-slate-500 print:text-[10px]">Tel: 011-2345678</p>
              </div>

              {/* Divider */}
              <div className="border-t-2 border-dashed border-slate-300 my-3"></div>

              {/* Invoice Info */}
              <div className="space-y-2 mb-4 text-sm print:text-xs">
                <div className="flex justify-between">
                  <span className="font-medium text-slate-600">Invoice:</span>
                  <span className="font-bold text-slate-900">{invoiceData.saleNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-slate-600">Date:</span>
                  <span className="font-bold text-slate-900">{invoiceData.date}</span>
                </div>
                {invoiceData.customerName && (
                  <div className="flex justify-between">
                    <span className="font-medium text-slate-600">Customer:</span>
                    <span className="font-bold text-slate-900">{invoiceData.customerName}</span>
                  </div>
                )}
                {invoiceData.customerPhone && (
                  <div className="flex justify-between">
                    <span className="font-medium text-slate-600">Phone:</span>
                    <span className="font-bold text-slate-900">{invoiceData.customerPhone}</span>
                  </div>
                )}
                {invoiceData.cashierName && (
                  <div className="flex justify-between">
                    <span className="font-medium text-slate-600">Cashier:</span>
                    <span className="font-bold text-slate-900">{invoiceData.cashierName}</span>
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="border-t-2 border-dashed border-slate-300 my-3"></div>

              {/* Items */}
              <div className="mb-4">
                <div className="space-y-3">
                  {invoiceData.items.map((item, index) => (
                    <div key={index} className="text-sm print:text-xs">
                      <div className="flex justify-between font-medium text-slate-900 mb-1">
                        <span className="flex-1">{index + 1}. {item.name}</span>
                      </div>
                      {item.batchNumber && (
                        <div className="text-xs text-slate-500 pl-4 print:text-[10px]">
                          Batch: {item.batchNumber}
                        </div>
                      )}
                      {item.warranty && item.warranty.duration > 0 && (
                        <div className="text-xs font-medium text-blue-600 pl-4 print:text-[10px]">
                          Warranty: {item.warranty.duration} {item.warranty.unit}
                          {item.warranty.type ? ` (${item.warranty.type})` : ''}
                        </div>
                      )}
                      <div className="flex justify-between text-slate-600 mt-1">
                        <span className="pl-4">
                          {item.quantity} x LKR {item.unitPrice.toFixed(2)}
                        </span>
                        <span className="font-medium text-slate-900">
                          LKR {item.subtotal.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Divider */}
              <div className="border-t-2 border-dashed border-slate-300 my-3"></div>

              {/* Summary */}
              <div className="space-y-2 text-sm print:text-xs mb-4">
                <div className="flex justify-between">
                  <span className="text-slate-600">Subtotal:</span>
                  <span className="font-medium text-slate-900">
                    LKR {invoiceData.subtotal.toFixed(2)}
                  </span>
                </div>
                {invoiceData.discount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Discount:</span>
                    <span className="font-medium text-slate-900">
                      -LKR {invoiceData.discount.toFixed(2)}
                    </span>
                  </div>
                )}
                {invoiceData.tax > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Tax:</span>
                    <span className="font-medium text-slate-900">
                      LKR {invoiceData.tax.toFixed(2)}
                    </span>
                  </div>
                )}
                {invoiceData.serviceCharge !== undefined && invoiceData.serviceCharge > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Service Charge:</span>
                    <span className="font-medium text-slate-900">
                      LKR {invoiceData.serviceCharge.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="border-t-2 border-slate-900 my-3"></div>

              {/* Total */}
              <div className="flex justify-between text-lg font-bold mb-4 print:text-base">
                <span className="text-slate-900">TOTAL:</span>
                <span className="text-slate-900">LKR {invoiceData.total.toFixed(2)}</span>
              </div>

              {/* Divider */}
              <div className="border-t-2 border-dashed border-slate-300 my-3"></div>

              {/* Payment Info */}
              <div className="space-y-2 text-sm print:text-xs mb-4">
                <div className="flex justify-between">
                  <span className="text-slate-600">Payment Method:</span>
                  <span className="font-medium text-slate-900 uppercase">
                    {invoiceData.paymentMethod}
                  </span>
                </div>
                {invoiceData.paymentMethod !== 'credit' && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Paid:</span>
                      <span className="font-medium text-slate-900">
                        LKR {invoiceData.paidAmount.toFixed(2)}
                      </span>
                    </div>
                    {invoiceData.changeAmount > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-600">Change:</span>
                        <span className="font-medium text-green-600">
                          LKR {invoiceData.changeAmount.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Divider */}
              <div className="border-t-2 border-dashed border-slate-300 my-3"></div>

              {/* Footer */}
              <div className="text-center pt-2">
                <p className="text-sm text-slate-600 print:text-xs">Thank you for your business!</p>
                <p className="text-xs text-slate-500 mt-1 print:text-[10px]">This is a computer generated invoice</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        /* Print Styles for 80mm Thermal Printer */
        @page {
          size: 80mm auto;
          margin: 0;
        }

        @media print {
          /* Reset html and body for continuous printing */
          html, body {
            visibility: visible !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 80mm !important;
            height: auto !important;
            min-height: auto !important;
            max-height: none !important;
            background: white !important;
            overflow: visible !important;
          }

          /* Hide all body children except invoice */
          body > *:not(.fixed) {
            display: none !important;
            visibility: hidden !important;
          }

          /* Show the modal and invoice content */
          .fixed,
          #invoice-content, 
          #invoice-content * {
            visibility: visible !important;
          }

          /* Position invoice content for continuous printing */
          #invoice-content {
            display: block !important;
            position: static !important;
            width: 80mm !important;
            margin: 0 !important;
            padding: 4mm 10mm !important; /* 4mm top/bottom, 10mm left/right - equal side padding */
            background: white !important;
            z-index: 9999 !important;
            box-sizing: border-box !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          /* Hide UI elements that shouldn't print */
          .no-print,
          button,
          .sticky {
            display: none !important;
            visibility: hidden !important;
          }

          /* Show invoice wrapper - prevent page breaks */
          .invoice-wrapper {
            display: block !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          /* Prevent page breaks on all invoice elements */
          .invoice-wrapper *,
          #invoice-content * {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            page-break-before: avoid !important;
            break-before: avoid !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
          }

          /* Hide modal backdrop and container styling */
          .fixed.inset-0 {
            position: static !important;
            background: transparent !important;
            padding: 0 !important;
          }

          .fixed.inset-0 > div {
            max-height: none !important;
            overflow: visible !important;
            box-shadow: none !important;
            border-radius: 0 !important;
          }

          /* Optimize fonts for thermal printing */
          .print\\:text-lg {
            font-size: 1.1rem !important;
            font-weight: 700 !important;
          }

          .print\\:text-base {
            font-size: 0.95rem !important;
            font-weight: 700 !important;
          }

          .print\\:text-xs {
            font-size: 0.75rem !important;
          }

          .print\\:text-\\[10px\\] {
            font-size: 10px !important;
          }

          /* Image optimization */
          .print\\:h-12 {
            height: 3rem !important;
          }

          .print\\:w-12 {
            width: 3rem !important;
          }

          img {
            max-width: 100% !important;
            height: auto !important;
          }

          /* Ensure borders print */
          .border-slate-300,
          .border-slate-900 {
            border-color: #000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Ensure text prints clearly */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Remove any background colors */
          .bg-slate-50,
          .bg-slate-100 {
            background-color: transparent !important;
          }

          /* Ensure proper text wrapping */
          * {
            word-wrap: break-word !important;
            overflow-wrap: break-word !important;
          }

          /* Remove shadows and rounded corners for print */
          .rounded-xl,
          .rounded-lg,
          .shadow-xl {
            border-radius: 0 !important;
            box-shadow: none !important;
          }

          /* Compact spacing for thermal */
          .mb-4 {
            margin-bottom: 0.5rem !important;
          }

          .mb-3 {
            margin-bottom: 0.4rem !important;
          }

          .my-3 {
            margin-top: 0.4rem !important;
            margin-bottom: 0.4rem !important;
          }

          .space-y-2 > * + * {
            margin-top: 0.35rem !important;
          }

          .space-y-3 > * + * {
            margin-top: 0.5rem !important;
          }
        }

        /* Screen view styles */
        @media screen {
          .invoice-wrapper {
            max-width: 80mm;
            margin: 0 auto;
          }
        }
      `}</style>
    </>
  );
}