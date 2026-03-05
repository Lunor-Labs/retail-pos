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
    /*
     * THERMAL RECEIPT PRINT CSS
     * ─────────────────────────────────────────────────────────────────────
     * KEY PRINCIPLE: Use ONLY physical units (mm, pt) for ALL sizes.
     * Browsers scale px-based content to fit the page, shrinking text when
     * there are many items. Physical units are immune to that scaling.
     *
     * @page height is patched by JS after measuring actual content height
     * so the thermal cutter fires exactly after the last printed line.
     */
    @page {
      size: 80mm auto;   /* JS will override with exact mm height */
      margin: 0mm;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    html {
      /* Lock render width to exactly 80mm — no browser rescaling */
      width: 80mm;
      font-size: 8pt;        /* base: 1rem = 8pt ≈ 2.8mm */
    }

    body {
      width: 80mm;
      background: #fff;
      font-family: 'Courier New', Courier, monospace;
      font-size: 8pt;
      line-height: 1.4;
      color: #000;
    }

    #receipt {
      width: 76mm;           /* 80mm − 2×2mm side padding */
      padding: 3mm 2mm 5mm;
    }

    /* ── Header ── */
    .center { text-align: center; }

    .logo {
      display: block;
      width: 11mm;
      height: 11mm;
      object-fit: cover;
      border-radius: 1mm;
      margin: 0 auto 1mm;
    }

    .store-name {
      font-size: 10pt;
      font-weight: 700;
      letter-spacing: 0.2mm;
    }

    .store-sub  { font-size: 7pt; }
    .store-addr { font-size: 7pt; color: #333; }

    /* ── Dividers ── */
    .dash {
      border: none;
      border-top: 0.3mm dashed #555;
      margin: 1.2mm 0;
    }
    .solid {
      border: none;
      border-top: 0.5mm solid #000;
      margin: 1.2mm 0;
    }

    /* ── Two-column rows ── */
    .row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 1mm;
      margin-bottom: 0.4mm;
      font-size: 8pt;
    }

    .total-row {
      font-size: 10pt;
      font-weight: 700;
    }

    /* ── Items ── */
    .item {
      margin-bottom: 1.5mm;
    }

    .item-name {
      font-weight: 700;
      font-size: 8pt;
      word-break: break-word;
      white-space: normal;
    }

    .warranty {
      font-size: 6.5pt;
      padding-left: 3mm;
    }

    .item-price {
      padding-left: 3mm;
      font-size: 8pt;
    }

    /* ── Footer ── */
    .footer { margin-top: 1mm; }

    .qr {
      display: block;
      width: 18mm;
      height: 18mm;
      object-fit: contain;
      margin: 1mm auto;
    }

    .thank  { font-size: 7pt;  margin-top: 1mm; }
    .google { font-size: 7pt;  font-weight: 700; margin-bottom: 0.5mm; }
    .power  { font-size: 6pt;  color: #555; margin-top: 1mm; }
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
   * THERMAL RECEIPT AUTO-SIZING & AUTO-CUT
   * ────────────────────────────────────────────────────────────────────
   * Problem 1 – Font shrinking:
   *   Browsers scale the page content to fit the driver's fixed paper size.
   *   We fix this by measuring the ACTUAL rendered height (in mm) and
   *   injecting an exact @page rule BEFORE calling print(), so the browser
   *   sees the page as exactly content-height tall — no scaling needed.
   *
   * Problem 2 – Fixed cut length:
   *   CUPS/PPD may define a fixed paper height. The injected @page rule
   *   overrides it, so the cutter fires right after the last printed line.
   *
   * All CSS uses physical units (pt/mm) so there is nothing to scale.
   */
  function measureAndPrint() {
    const receipt = document.getElementById('receipt');

    // getBoundingClientRect gives CSS-pixel dimensions of the rendered div.
    // At standard 96 dpi screen: 1 CSS px = 25.4/96 mm = 0.2646 mm.
    // We use the screen DPI of the rendering context, not the printer DPI.
    const heightPx  = receipt.getBoundingClientRect().height;
    const heightMm  = Math.ceil(heightPx * 25.4 / 96) + 10; // +10mm cutter buffer

    // Remove any previously injected @page rule (safety guard)
    var old = document.getElementById('dynamic-page-style');
    if (old) old.parentNode.removeChild(old);

    // Inject precise @page that overrides CUPS/driver paper height
    var style = document.createElement('style');
    style.id = 'dynamic-page-style';
    style.textContent = '@page { size: 80mm ' + heightMm + 'mm; margin: 0mm; }';
    document.head.appendChild(style);

    window.focus();
    window.print();

    // Close the popup after the print dialog is dismissed.
    // afterprint fires both on Print and on Cancel — that is intentional
    // so orphaned popups never pile up.
    window.addEventListener('afterprint', function () {
      window.close();
    });
  }

  function doPrint() {
    // Two animation frames: first lets the browser finish layout,
    // second ensures the paint (and font metrics) are fully committed.
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        // Extra 80ms for web fonts / slow image decode
        setTimeout(measureAndPrint, 80);
      });
    });
  }

  // ── Wait for all <img> tags to load before measuring height ──
  var images = document.querySelectorAll('img');
  var pending = images.length;

  function onImageSettled() {
    pending -= 1;
    if (pending <= 0) doPrint();
  }

  if (pending === 0) {
    doPrint();
  } else {
    images.forEach(function (img) {
      if (img.complete) {
        onImageSettled();
      } else {
        img.addEventListener('load',  onImageSettled);
        img.addEventListener('error', onImageSettled); // broken img must not block
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