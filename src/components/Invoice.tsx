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
      message += `\nStudy by: ${invoiceData.cashierName}`;
    }

    message += `\n\nThank you for your business! 🙏`;

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto">
          <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
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

          <div className="p-6" id="invoice-content">
            <div className="invoice-print">
              <div className="text-center mb-6">
                <div className="flex justify-center mb-2">
                  <img src={logo} alt="Gasith Motors" className="h-16 w-16 object-cover rounded-lg" />
                </div>
                <h1 className="text-2xl font-bold text-slate-900 mb-1">Gasith Motors</h1>
                <p className="text-sm text-slate-600">Auto Parts & Accessories</p>
                <p className="text-xs text-slate-500 mt-1">No: 123, Main Street, Colombo</p>
                <p className="text-xs text-slate-500">Tel: 011-2345678</p>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-6 pb-6 border-b border-slate-200">
                <div>
                  <p className="text-sm font-medium text-slate-500 mb-1">Invoice Number</p>
                  <p className="font-bold text-slate-900">{invoiceData.saleNumber}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500 mb-1">Date</p>
                  <p className="font-bold text-slate-900">{invoiceData.date}</p>
                </div>
                {invoiceData.customerName && (
                  <div>
                    <p className="text-sm font-medium text-slate-500 mb-1">Customer</p>
                    <p className="font-bold text-slate-900">{invoiceData.customerName}</p>
                    {invoiceData.customerPhone && (
                      <p className="text-sm text-slate-600">{invoiceData.customerPhone}</p>
                    )}
                  </div>
                )}
                {invoiceData.cashierName && (
                  <div>
                    <p className="text-sm font-medium text-slate-500 mb-1">Cashier</p>
                    <p className="font-bold text-slate-900">{invoiceData.cashierName}</p>
                  </div>
                )}
              </div>

              <div className="mb-6">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-slate-300">
                      <th className="text-left py-2 text-sm font-bold text-slate-700">#</th>
                      <th className="text-left py-2 text-sm font-bold text-slate-700">Item</th>
                      <th className="text-center py-2 text-sm font-bold text-slate-700">Qty</th>
                      <th className="text-right py-2 text-sm font-bold text-slate-700">Price</th>
                      <th className="text-right py-2 text-sm font-bold text-slate-700">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoiceData.items.map((item, index) => (
                      <tr key={index} className="border-b border-slate-200">
                        <td className="py-3 text-sm text-slate-600">{index + 1}</td>
                        <td className="py-3">
                          <p className="text-sm font-medium text-slate-900">{item.name}</p>
                          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-0.5">
                            {item.batchNumber && (
                              <p className="text-xs text-slate-500">Batch: {item.batchNumber}</p>
                            )}
                            {item.warranty && item.warranty.duration > 0 && (
                              <p className="text-xs font-medium text-blue-600">
                                Warranty: {item.warranty.duration} {item.warranty.unit} {item.warranty.type ? `(${item.warranty.type})` : ''}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="py-3 text-sm text-slate-600 text-center">{item.quantity}</td>
                        <td className="py-3 text-sm text-slate-600 text-right">
                          LKR {item.unitPrice.toFixed(2)}
                        </td>
                        <td className="py-3 text-sm font-medium text-slate-900 text-right">
                          LKR {item.subtotal.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end mb-6">
                <div className="w-64 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Subtotal:</span>
                    <span className="font-medium text-slate-900">
                      LKR {invoiceData.subtotal.toFixed(2)}
                    </span>
                  </div>
                  {invoiceData.discount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Discount:</span>
                      <span className="font-medium text-slate-900">
                        -LKR {invoiceData.discount.toFixed(2)}
                      </span>
                    </div>
                  )}
                  {invoiceData.tax > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Tax:</span>
                      <span className="font-medium text-slate-900">
                        LKR {invoiceData.tax.toFixed(2)}
                      </span>
                    </div>
                  )}
                  {invoiceData.serviceCharge !== undefined && invoiceData.serviceCharge > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Service Charge:</span>
                      <span className="font-medium text-slate-900">
                        LKR {invoiceData.serviceCharge.toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold border-t-2 border-slate-300 pt-2">
                    <span className="text-slate-900">TOTAL:</span>
                    <span className="text-slate-900">LKR {invoiceData.total.toFixed(2)}</span>
                  </div>
                  {invoiceData.paymentMethod !== 'credit' && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Paid:</span>
                        <span className="font-medium text-slate-900">
                          LKR {invoiceData.paidAmount.toFixed(2)}
                        </span>
                      </div>
                      {invoiceData.changeAmount > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">Change:</span>
                          <span className="font-medium text-green-600">
                            LKR {invoiceData.changeAmount.toFixed(2)}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                  <div className="flex justify-between text-sm pt-2 border-t border-slate-200">
                    <span className="text-slate-600">Payment Method:</span>
                    <span className="font-medium text-slate-900 uppercase">
                      {invoiceData.paymentMethod}
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-center pt-6 border-t border-slate-200">
                <p className="text-sm text-slate-600">Thank you for your business!</p>
                <p className="text-xs text-slate-500 mt-1">This is a computer generated invoice</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @page {
          margin: 0;
          size: auto;
        }
        @media print {
          body {
            visibility: hidden;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #invoice-content {
            visibility: visible;
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 10mm;
            background-color: white;
          }
          #invoice-content * {
            visibility: visible;
          }
          .print\:hidden {
            display: none !important;
          }
          /* Ensure table cells don't break awkwardly */
          tr { page-break-inside: avoid; }
          /* Adjust for thermal printers (usually narrow) */
          @media (max-width: 80mm) {
            #invoice-content {
              padding: 2mm;
            }
            .text-2xl { font-size: 1.25rem; }
            .text-xl { font-size: 1.1rem; }
            .text-sm { font-size: 0.75rem; }
            .text-xs { font-size: 0.65rem; }
            .w-64 { width: 100%; }
          }
        }
      `}</style>
    </>
  );
}
