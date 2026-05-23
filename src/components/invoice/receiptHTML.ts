import { InvoiceData } from './types';
import { RECEIPT_PRINT_CSS, RECEIPT_PRINT_JS } from './receiptCSS';

/**
 * Builds a fully self-contained receipt HTML string for the popup window.
 *
 * - Images are passed as fully-resolved absolute URLs so the popup can load them.
 * - All CSS and JS are inlined — the popup has no external dependencies.
 * - The @page size is patched by the injected JS after measuring actual height,
 *   so the thermal cutter fires immediately after the last printed line.
 */
export function buildReceiptHTML(
    invoiceData: InvoiceData,
    showDiscount: boolean,
    logoSrc: string,
    qrSrc: string,
): string {
    const displaySubtotal = !showDiscount
        ? invoiceData.subtotal - invoiceData.discount
        : invoiceData.subtotal;

    // ── Helper: two-column label / value row ──────────────────────────────────
    const row = (label: string, value: string, bold = false) =>
        `<div class="row">${bold
            ? `<b>${label}</b><b>${value}</b>`
            : `<span>${label}</span><span>${value}</span>`
        }</div>`;

    // ── Items section ─────────────────────────────────────────────────────────
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

            const variantLine = item.variantLabel
                ? `<div class="warranty">${item.variantLabel}</div>`
                : '';

            return `
        <div class="item">
          <div class="item-name">
            ${i + 1}. ${item.name}
          </div>
          ${variantLine}
          <div class="row item-price">
            <span>${item.quantity} x ${up.toFixed(2)}</span>
            <b>LKR ${st.toFixed(2)}</b>
          </div>
        </div>`;
        })
        .join('');

    // ── Conditional totals rows ───────────────────────────────────────────────
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

    // ── Conditional meta rows ─────────────────────────────────────────────────
    const customerLine = invoiceData.customerName
        ? row('Customer:', invoiceData.customerName)
        : '';
    const phoneLine = invoiceData.customerPhone
        ? row('Phone:', invoiceData.customerPhone)
        : '';
    const cashierLine = invoiceData.cashierName
        ? row('Cashier:', invoiceData.cashierName)
        : '';

    // ── Payment block (hidden for credit sales) ───────────────────────────────
    const paymentBlock =
        invoiceData.paymentMethod !== 'credit'
            ? `${row('Paid:', `LKR ${invoiceData.paidAmount.toFixed(2)}`)}
         ${invoiceData.changeAmount > 0
                ? row('Change:', `LKR ${invoiceData.changeAmount.toFixed(2)}`)
                : ''}`
            : '';

    // ── Assemble final HTML ───────────────────────────────────────────────────
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Receipt – ${invoiceData.saleNumber}</title>
  <style>${RECEIPT_PRINT_CSS}</style>
</head>
<body>
<div id="receipt">

  <!-- Header -->
  <div class="center">
    <img class="logo" src="${logoSrc}" alt="RIVONLAK" />
    <div class="store-name">RIVONLAK</div>
    <div class="store-sub">Fashion Retail</div>
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
    <div class="google">Shop Again at RIVONLAK</div>
    <img class="qr" src="${qrSrc}" alt="QR Code" />
    <div class="thank">Thank you for your business!</div>
    <div class="power">System Powered by <b>Lunor Labs</b></div>
  </div>

</div>

<script>${RECEIPT_PRINT_JS}</script>
</body>
</html>`;
}
