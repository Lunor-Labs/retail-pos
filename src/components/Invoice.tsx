import { useState } from 'react';
import { X, Printer, Share2 } from 'lucide-react';
import logo from '../assets/favicon.jpeg';
import qrCode from '../assets/QR.jpeg';

export interface InvoiceItem {
  name: string;
  quantity: number;
  unitPrice: number;
  discountedUnitPrice?: number;
  subtotal: number;
  discountedSubtotal?: number;
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

/**
 * Builds a fully self-contained receipt HTML string for the popup window.
 * Images are inlined as absolute URLs so the popup can resolve them.
 * The @page rule uses `size: 80mm auto` — the printer measures the content
 * height and cuts immediately after the last line.
 */
function buildReceiptHTML(
  invoiceData: InvoiceData,
  showDiscount: boolean,
  logoSrc: string,
  qrSrc: string,
): string {
  const displaySubtotal = !showDiscount
    ? invoiceData.subtotal - invoiceData.discount
    : invoiceData.subtotal;

  const row = (label: string, value: string, bold = false) =>
    `<div class="row">${bold ? `<b>${label}</b><b>${value}</b>` : `<span>${label}</span><span>${value}</span>`}</div>`;

  const itemsHTML = invoiceData.items
    .map((item, i) => {
      const up =
        !showDiscount && item.discountedUnitPrice !== undefined
          ? item.discountedUnitPrice
          : item.unitPrice;
      const st =
        !showDiscount && item.discountedSubtotal !== undefined
          ? item.discountedSubtotal
          : item.subtotal;

      const warrantyLine =
        item.warranty && item.warranty.duration > 0
          ? `<div class="warranty">Warranty: ${item.warranty.duration} ${item.warranty.unit}${item.warranty.type ? ` (${item.warranty.type})` : ''}</div>`
          : '';

      return `
        <div class="item">
          <div class="item-name">${i + 1}. ${item.name}</div>
          ${warrantyLine}
          <div class="row item-price">
            <span>${item.quantity} x ${up.toFixed(2)}</span>
            <b>LKR ${st.toFixed(2)}</b>
          </div>
        </div>`;
    })
    .join('');

  const discountLine =
    showDiscount && invoiceData.discount > 0
      ? row('Discount:', `-LKR ${invoiceData.discount.toFixed(2)}`)
      : '';
  const taxLine =
    invoiceData.tax > 0 ? row('Tax:', `LKR ${invoiceData.tax.toFixed(2)}`) : '';
  const scLine =
    invoiceData.serviceCharge && invoiceData.serviceCharge > 0
      ? row('Service Charge:', `LKR ${invoiceData.serviceCharge.toFixed(2)}`)
      : '';

  const customerLine = invoiceData.customerName
    ? row('Customer:', invoiceData.customerName)
    : '';
  const phoneLine = invoiceData.customerPhone
    ? row('Phone:', invoiceData.customerPhone)
    : '';
  const cashierLine = invoiceData.cashierName
    ? row('Cashier:', invoiceData.cashierName)
    : '';

  const paymentBlock =
    invoiceData.paymentMethod !== 'credit'
      ? `${row('Paid:', `LKR ${invoiceData.paidAmount.toFixed(2)}`)}
         ${invoiceData.changeAmount > 0 ? row('Change:', `LKR ${invoiceData.changeAmount.toFixed(2)}`) : ''}`
      : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Receipt – ${invoiceData.saleNumber}</title>
  <style>
    /* @page size is set dynamically by JS after measuring actual content height.
       This overrides any fixed paper size configured in the printer driver (CUPS/PPD). */
    @page {
      size: 80mm auto;
      margin: 0;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    html, body {
      width: 80mm;
      background: #fff;
      font-family: 'Courier New', Courier, monospace;
      font-size: 11px;
      line-height: 1.4;
      color: #000;
    }

    #receipt {
      width: 76mm;           /* 80mm - 2×2mm side padding */
      padding: 3mm 2mm 5mm;
    }

    /* ── Header ── */
    .center { text-align: center; }

    .logo {
      display: block;
      width: 40px;
      height: 40px;
      object-fit: cover;
      border-radius: 4px;
      margin: 0 auto 4px;
    }

    .store-name {
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.5px;
    }

    .store-sub  { font-size: 10px; }
    .store-addr { font-size: 9px; color: #333; }

    /* ── Dividers ── */
    .dash {
      border: none;
      border-top: 1px dashed #555;
      margin: 4px 0;
    }
    .solid {
      border: none;
      border-top: 2px solid #000;
      margin: 4px 0;
    }

    /* ── Two-column rows ── */
    .row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 4px;
      margin-bottom: 1px;
      font-size: 11px;
    }

    .total-row {
      font-size: 13px;
      font-weight: 700;
    }

    /* ── Items ── */
    .item {
      margin-bottom: 5px;
    }

    .item-name {
      font-weight: 600;
      font-size: 11px;
      word-break: break-word;
      white-space: normal;
    }

    .warranty {
      font-size: 9px;
      padding-left: 10px;
    }

    .item-price {
      padding-left: 10px;
    }

    /* ── Footer ── */
    .footer { margin-top: 2px; }

    .qr {
      display: block;
      width: 64px;
      height: 64px;
      object-fit: contain;
      margin: 3px auto;
    }

    .thank  { font-size: 10px; margin-top: 4px; }
    .google { font-size: 10px; font-weight: 700; margin-bottom: 2px; }
    .power  { font-size: 8px; color: #555; margin-top: 3px; }
  </style>
</head>
<body>
<div id="receipt">

  <!-- Header -->
  <div class="center">
    <img class="logo" src="${logoSrc}" alt="Gasith Motors" />
    <div class="store-name">Gasith Motors</div>
    <div class="store-sub">Auto Parts &amp; Accessories</div>
    <div class="store-addr">No: 80, Beliatta Rd, Walasmulla</div>
    <div class="store-addr">Tel: +94 77 6600 285 / +94 47 2103 738</div>
  </div>

  <hr class="dash" />

  <!-- Invoice meta -->
  ${row('Invoice:', invoiceData.saleNumber, true)}
  ${row('Date:', invoiceData.date)}
  ${customerLine}
  ${phoneLine}
  ${cashierLine}

  <hr class="dash" />

  <!-- Items -->
  ${itemsHTML}

  <hr class="dash" />

  <!-- Totals -->
  ${row('Subtotal:', `LKR ${displaySubtotal.toFixed(2)}`)}
  ${discountLine}
  ${taxLine}
  ${scLine}

  <hr class="solid" />

  <div class="row total-row">
    <span>TOTAL:</span>
    <span>LKR ${invoiceData.total.toFixed(2)}</span>
  </div>

  <hr class="dash" />

  <!-- Payment -->
  ${row('Payment:', invoiceData.paymentMethod.toUpperCase())}
  ${paymentBlock}

  <hr class="dash" />

  <!-- Footer -->
  <div class="center footer">
    <div class="google">Review us on Google</div>
    <img class="qr" src="${qrSrc}" alt="QR Code" />
    <div class="thank">Thank you for your business!</div>
    <div class="power">System Powered by <b>Lunor Labs</b></div>
  </div>

</div>

<script>
  /**
   * Dynamic height measurement approach for thermal printers.
   *
   * Problem: Printer drivers (CUPS/PPD) define a fixed paper height (e.g. 5").
   * Even with @page { size: 80mm auto }, the driver can override and cut early.
   *
   * Solution: After the page fully renders (fonts + images loaded), measure the
   * exact pixel height of the receipt div, convert to mm, then inject a precise
   * @page rule that overrides the driver's hardcoded size before printing.
   */
  function doPrint() {
    // Let layout settle for one paint cycle after images load
    requestAnimationFrame(function () {
      const receipt = document.getElementById('receipt');
      const heightPx = receipt.getBoundingClientRect().height;

      // Convert screen pixels → mm ( 1px = 25.4/96 mm at standard 96dpi )
      // Add 8mm buffer so the cutter fires AFTER the last line, not on it.
      const heightMm = Math.ceil(heightPx * 25.4 / 96) + 8;

      // Inject a precise @page that overrides the CUPS/driver paper size
      const pageStyle = document.createElement('style');
      pageStyle.textContent =
        '@page { size: 80mm ' + heightMm + 'mm; margin: 0; }';
      document.head.appendChild(pageStyle);

      window.focus();
      window.print();
      window.addEventListener('afterprint', function () { window.close(); });
    });
  }

  const images = document.querySelectorAll('img');
  let loaded = 0;

  function tryPrint() {
    loaded++;
    if (loaded >= images.length) doPrint();
  }

  if (images.length === 0) {
    doPrint();
  } else {
    images.forEach(function (img) {
      if (img.complete) {
        tryPrint();
      } else {
        img.addEventListener('load', tryPrint);
        img.addEventListener('error', tryPrint); // Don't block on broken image
      }
    });
  }
</script>
</body>
</html>`;
}

export function Invoice({ invoiceData, onClose }: InvoiceProps) {
  const [showDiscount, setShowDiscount] = useState(false);

  const displaySubtotal = !showDiscount
    ? invoiceData.subtotal - invoiceData.discount
    : invoiceData.subtotal;

  /**
   * Industry-standard popup window approach for thermal receipt printing.
   *
   * Why NOT window.print() on the SPA:
   *   - The browser prints the ENTIRE page, causing duplicate regions.
   *   - @page CSS fights the app's own styles.
   *   - Results in multiple copies or garbled output.
   *
   * Why popup window:
   *   - Completely isolated HTML document — only the receipt exists.
   *   - @page { size: 80mm auto } works perfectly with no interference.
   *   - Single copy, guaranteed. Auto-closes after print.
   *   - Used by Square, Shopify POS, WooCommerce POS, etc.
   */
  const handlePrint = () => {
    // Resolve asset URLs relative to the current page origin
    const logoUrl = new URL(logo, window.location.href).href;
    const qrUrl = new URL(qrCode, window.location.href).href;

    const html = buildReceiptHTML(invoiceData, showDiscount, logoUrl, qrUrl);

    // Open a small, borderless popup — size doesn't matter, it will auto-resize to paper
    const popup = window.open('', '_blank', 'width=302,height=600,scrollbars=no,menubar=no,toolbar=no,location=no,status=no');
    if (!popup) {
      alert('Please allow popups for this site to enable printing.');
      return;
    }

    popup.document.open();
    popup.document.write(html);
    popup.document.close();
  };

  const handleWhatsAppShare = () => {
    let message = `🧾 *INVOICE: ${invoiceData.saleNumber}*\n`;
    message += `📅 Date: ${invoiceData.date}\n\n`;
    message += `🏢 *Gasith Motors*\n`;
    message += `📞 +94 77 6600 285/+94 47 2103 738\n\n`;

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
      const printUnitPrice = !showDiscount && item.discountedUnitPrice !== undefined ? item.discountedUnitPrice : item.unitPrice;
      const printSubtotal = !showDiscount && item.discountedSubtotal !== undefined ? item.discountedSubtotal : item.subtotal;
      message += `   ${item.quantity} x ${printUnitPrice.toFixed(2)} = LKR ${printSubtotal.toFixed(2)}\n\n`;
    });

    message += `--------------------------------\n`;

    if (invoiceData.discount > 0 || invoiceData.tax > 0 || (invoiceData.serviceCharge && invoiceData.serviceCharge > 0)) {
      message += `Subtotal: LKR ${displaySubtotal.toFixed(2)}\n`;
      if (showDiscount && invoiceData.discount > 0) message += `Discount: -LKR ${invoiceData.discount.toFixed(2)}\n`;
      if (invoiceData.tax > 0) message += `Tax: LKR ${invoiceData.tax.toFixed(2)}\n`;
      if (invoiceData.serviceCharge && invoiceData.serviceCharge > 0) message += `Service Charge: LKR ${invoiceData.serviceCharge.toFixed(2)}\n`;
      message += `\n`;
    }

    message += `💰 *TOTAL: LKR ${invoiceData.total.toFixed(2)}*\n`;
    message += `--------------------------------\n\n`;
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
        </div>

        {/* ── Screen preview (monospace receipt layout) ── */}
        <div className="p-6">
          <div style={{ maxWidth: '80mm', margin: '0 auto', fontFamily: 'monospace', fontSize: '12px' }}>
            {/* Header */}
            <div className="text-center mb-3">
              <img src={logo} alt="Gasith Motors" style={{ height: 48, width: 48, objectFit: 'cover', borderRadius: 6, margin: '0 auto 6px' }} />
              <div style={{ fontWeight: 700, fontSize: 15 }}>Gasith Motors</div>
              <div style={{ fontSize: 11, color: '#555' }}>Auto Parts &amp; Accessories</div>
              <div style={{ fontSize: 10, color: '#777' }}>No: 80, Beliatta Rd, Walasmulla</div>
              <div style={{ fontSize: 10, color: '#777' }}>Tel: +94 77 6600 285 / +94 47 2103 738</div>
            </div>
            <div style={{ borderTop: '1px dashed #999', margin: '6px 0' }} />

            {/* Meta */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}><span>Invoice:</span><b>{invoiceData.saleNumber}</b></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}><span>Date:</span><span>{invoiceData.date}</span></div>
            {invoiceData.customerName && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}><span>Customer:</span><span>{invoiceData.customerName}</span></div>}
            {invoiceData.customerPhone && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}><span>Phone:</span><span>{invoiceData.customerPhone}</span></div>}
            {invoiceData.cashierName && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}><span>Cashier:</span><span>{invoiceData.cashierName}</span></div>}
            <div style={{ borderTop: '1px dashed #999', margin: '6px 0' }} />

            {/* Items */}
            {invoiceData.items.map((item, i) => {
              const up = !showDiscount && item.discountedUnitPrice !== undefined ? item.discountedUnitPrice : item.unitPrice;
              const st = !showDiscount && item.discountedSubtotal !== undefined ? item.discountedSubtotal : item.subtotal;
              return (
                <div key={i} style={{ marginBottom: 6 }}>
                  <div style={{ fontWeight: 600, wordBreak: 'break-word' }}>{i + 1}. {item.name}</div>
                  {item.warranty && item.warranty.duration > 0 && (
                    <div style={{ fontSize: 10, paddingLeft: 12 }}>
                      Warranty: {item.warranty.duration} {item.warranty.unit}{item.warranty.type ? ` (${item.warranty.type})` : ''}
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: 12 }}>
                    <span>{item.quantity} x {up.toFixed(2)}</span>
                    <b>LKR {st.toFixed(2)}</b>
                  </div>
                </div>
              );
            })}
            <div style={{ borderTop: '1px dashed #999', margin: '6px 0' }} />

            {/* Totals */}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Subtotal:</span><span>LKR {displaySubtotal.toFixed(2)}</span></div>
            {showDiscount && invoiceData.discount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Discount:</span><span>-LKR {invoiceData.discount.toFixed(2)}</span></div>}
            {invoiceData.tax > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Tax:</span><span>LKR {invoiceData.tax.toFixed(2)}</span></div>}
            {invoiceData.serviceCharge !== undefined && invoiceData.serviceCharge > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Service Charge:</span><span>LKR {invoiceData.serviceCharge.toFixed(2)}</span></div>}
            <div style={{ borderTop: '2px solid #000', margin: '6px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 14 }}><span>TOTAL:</span><span>LKR {invoiceData.total.toFixed(2)}</span></div>
            <div style={{ borderTop: '1px dashed #999', margin: '6px 0' }} />

            {/* Payment */}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Payment:</span><span style={{ textTransform: 'uppercase' }}>{invoiceData.paymentMethod}</span></div>
            {invoiceData.paymentMethod !== 'credit' && <>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Paid:</span><span>LKR {invoiceData.paidAmount.toFixed(2)}</span></div>
              {invoiceData.changeAmount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Change:</span><span style={{ color: '#16a34a' }}>LKR {invoiceData.changeAmount.toFixed(2)}</span></div>}
            </>}
            <div style={{ borderTop: '1px dashed #999', margin: '6px 0' }} />

            {/* Footer */}
            <div className="text-center" style={{ paddingBottom: 6 }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Review us on Google</div>
              <img src={qrCode} alt="QR Code" style={{ height: 80, width: 80, objectFit: 'contain', margin: '0 auto' }} />
              <div style={{ marginTop: 6, color: '#555', fontSize: 11 }}>Thank you for your business!</div>
              <div style={{ marginTop: 4, fontSize: 9, color: '#aaa' }}>System Powered by <b>Lunor Labs</b></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}