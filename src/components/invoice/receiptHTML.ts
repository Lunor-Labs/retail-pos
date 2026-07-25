import { InvoiceData } from './types';
import { BusinessProfile } from '../../contexts/BusinessProfileContext';
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
    business: BusinessProfile,
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
    // A credit is a settlement, not a discount, so it gets its own line.
    const creditLine =
        invoiceData.creditApplied && invoiceData.creditApplied > 0
            ? row(
                invoiceData.creditIsReturn ? 'Return Credit:' : 'Voucher:',
                `-LKR ${invoiceData.creditApplied.toFixed(2)}`,
            )
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
         ${invoiceData.cashPaidOut && invoiceData.cashPaidOut > 0
                ? row('Cash Refunded:', `LKR ${invoiceData.cashPaidOut.toFixed(2)}`)
                : ''}
         ${invoiceData.changeAmount > 0
                ? row('Change:', `LKR ${invoiceData.changeAmount.toFixed(2)}`)
                : ''}`
            : '';

    // What is still on the code, so the customer knows to bring it back.
    const creditRemainingBlock =
        invoiceData.creditRemaining && invoiceData.creditRemaining > 0 && invoiceData.creditCode
            ? `<hr class="dash" />
     <div class="center" style="font-size:11px;line-height:1.5">
       <div style="font-weight:700">Credit remaining: LKR ${invoiceData.creditRemaining.toFixed(2)}</div>
       <div style="font-family:monospace;letter-spacing:.08em">${invoiceData.creditCode}</div>
       <div style="color:#555">Keep this code — use it on your next visit</div>
     </div>`
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
    <img class="logo" src="${logoSrc}" alt="${business.name}" />
    <div class="store-name">${business.name}</div>
    <div class="store-sub">${business.tagline}</div>
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
  ${creditLine}

  <hr class="solid" />

  <div class="row total-row">
    <span>TOTAL:</span>
    <span>LKR ${invoiceData.total.toFixed(2)}</span>
  </div>

  <hr class="dash" />

  <!-- Payment -->
  ${row('Payment:', invoiceData.paymentMethod.toUpperCase())}
  ${paymentBlock}
  ${creditRemainingBlock}

  <hr class="dash" />

  <!-- Footer -->
  <div class="center footer">
    <div class="google">Shop Again at ${business.name}</div>
    <div class="center policy">
      <div class="policy-item">දින 4ක් ඇතුළත බිල්පත සමඟ මාරු කරගත හැක.</div>
      <div class="policy-item">සුදු රෙදි මාරු කරනු නොලැබේ.</div>
      <div class="policy-item">ටැග් ඉවත් කළ, භාවිතා කළ හෝ හානි වූ භාණ්ඩ</div>
      <div class="policy-item">මාරු කරනු නොලැබේ.</div>
    </div>
    <div class="thank">Thank you for your business!</div>
    <div class="power">System Powered by <b>Lunor Labs</b></div>
  </div>

</div>

<script>${RECEIPT_PRINT_JS}</script>
</body>
</html>`;
}
