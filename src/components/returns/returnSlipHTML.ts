import JsBarcode from 'jsbarcode';

/**
 * The printed return-credit slip.
 *
 * Follows the same shape as `vouchers/voucherCardHTML.ts` — build a standalone HTML
 * document, open it in a window, print. Kept separate rather than shared because the
 * wording and branding differ per shop, so this is a per-brand file.
 *
 * The code is printed twice on purpose: as a barcode the cashier can scan, and as
 * text in case the print is smudged or the customer reads it out over the phone.
 */

export interface ReturnSlipData {
    code: string;
    amount: number;
    expiresAt: string;   // ISO date
    returnNumber: string;
    issuedAt: string;    // ISO date-time
    items: { name: string; variant?: string; quantity: number; amount: number }[];
    storeName?: string;
}

const STORE_NAME = 'RIVONLAK';

function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
}

function fmtAmount(n: number) {
    return 'LKR ' + Math.round(n).toLocaleString('en-US');
}

function escapeHtml(s: string) {
    return s.replace(/[&<>"']/g, c => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
    ));
}

/**
 * Render the code as a Code128 barcode and return it as a data URI, so the printed
 * slip carries no external references and prints identically offline.
 */
function barcodeDataUrl(code: string): string {
    try {
        const canvas = document.createElement('canvas');
        JsBarcode(canvas, code, {
            format: 'CODE128',
            width: 2,
            height: 54,
            displayValue: false,
            margin: 0,
        });
        return canvas.toDataURL('image/png');
    } catch {
        // A slip without a barcode is still usable — the code is printed as text too.
        return '';
    }
}

export function buildReturnSlipHTML(data: ReturnSlipData): string {
    const storeName = data.storeName ?? STORE_NAME;
    const barcode = barcodeDataUrl(data.code);

    const itemRows = data.items.map(it => `
      <tr>
        <td class="it">
          ${escapeHtml(it.name)}
          ${it.variant ? `<span class="vr">${escapeHtml(it.variant)}</span>` : ''}
        </td>
        <td class="qt">${it.quantity}</td>
        <td class="am">${fmtAmount(it.amount)}</td>
      </tr>`).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Return Credit ${escapeHtml(data.code)}</title>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 24px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #f4f5f7; color: #15171A;
    display: flex; justify-content: center;
  }
  .slip {
    width: 360px; background: #fff; border-radius: 12px;
    border: 1px solid #e3e5e9; padding: 22px 24px;
  }
  .head { text-align: center; border-bottom: 1px dashed #d5d8dd; padding-bottom: 14px; }
  .store { font-size: 15px; font-weight: 700; letter-spacing: .04em; }
  .kind { font-size: 11px; color: #6b7280; letter-spacing: .12em; text-transform: uppercase; margin-top: 4px; }
  .amt { font-size: 30px; font-weight: 800; letter-spacing: -0.02em; margin: 16px 0 2px; text-align: center; }
  .amtlbl { font-size: 11px; color: #6b7280; text-align: center; letter-spacing: .08em; text-transform: uppercase; }
  .bc { text-align: center; margin: 18px 0 6px; }
  .bc img { max-width: 100%; }
  .code {
    text-align: center; font-family: 'Courier New', monospace;
    font-size: 19px; font-weight: 700; letter-spacing: .14em;
  }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  th { font-size: 9.5px; color: #6b7280; text-transform: uppercase; letter-spacing: .08em; text-align: left; padding-bottom: 5px; border-bottom: 1px solid #e3e5e9; }
  td { font-size: 11.5px; padding: 6px 0; border-bottom: 1px solid #f1f2f4; vertical-align: top; }
  .qt { text-align: center; width: 34px; }
  .am { text-align: right; width: 78px; font-family: 'Courier New', monospace; }
  .vr { display: block; font-size: 10px; color: #6b7280; margin-top: 1px; }
  .meta { margin-top: 16px; font-size: 11px; color: #6b7280; display: flex; justify-content: space-between; }
  .how {
    margin-top: 16px; padding: 11px 12px; background: #f7f8fa;
    border: 1px solid #e8eaee; border-radius: 8px;
    font-size: 11px; color: #40454d; line-height: 1.55;
  }
  .exp { margin-top: 12px; text-align: center; font-size: 11.5px; }
  .exp b { font-weight: 700; }
  @media print {
    body { background: #fff; padding: 0; }
    .slip { border: 0; border-radius: 0; width: 100%; }
  }
</style>
</head>
<body>
  <div class="slip">
    <div class="head">
      <div class="store">${escapeHtml(storeName)}</div>
      <div class="kind">Return Credit</div>
    </div>

    <div class="amt">${fmtAmount(data.amount)}</div>
    <div class="amtlbl">Credit value</div>

    <div class="bc">
      ${barcode ? `<img src="${barcode}" alt="${escapeHtml(data.code)}"/>` : ''}
    </div>
    <div class="code">${escapeHtml(data.code)}</div>

    <table>
      <thead>
        <tr><th>Item returned</th><th style="text-align:center">Qty</th><th style="text-align:right">Value</th></tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>

    <div class="meta">
      <span>${escapeHtml(data.returnNumber)}</span>
      <span>${fmtDate(data.issuedAt)}</span>
    </div>

    <div class="exp">Valid until <b>${fmtDate(data.expiresAt)}</b></div>

    <div class="how">
      Bring this slip when you next shop with us. The cashier will scan it and take the
      amount off your bill. If you buy something cheaper, the rest stays on this code
      for another time — or you can ask for it back in cash.
    </div>
  </div>
</body>
</html>`;
}

/** Normalise a Sri Lankan phone number for wa.me (0XX → 94XX). */
export function normalisePhone(raw: string): string {
    const digits = raw.replace(/\D/g, '');
    if (digits.startsWith('0')) return '94' + digits.slice(1);
    if (digits.startsWith('94')) return digits;
    return digits;
}

export function buildReturnWhatsAppMessage(data: ReturnSlipData, storeName = STORE_NAME): string {
    const lines: string[] = [];
    lines.push(`♻️ *Return Credit — ${storeName}*`);
    lines.push('');
    lines.push(`Your return has been accepted. You have *${fmtAmount(data.amount)}* in credit.`);
    lines.push('');
    lines.push(`🔑 *${data.code}*`);
    lines.push(`📅 Valid until ${fmtDate(data.expiresAt)}`);
    lines.push('');
    lines.push('Show this code at the counter and it comes off your bill. Any balance left stays on the code.');
    return lines.join('\n');
}

/** Send the code to the customer, so losing the paper slip does not matter. */
export function openReturnSlipWhatsApp(phone: string, data: ReturnSlipData, storeName?: string) {
    const number = normalisePhone(phone);
    const text = encodeURIComponent(buildReturnWhatsAppMessage(data, storeName));
    window.open(`https://wa.me/${number}?text=${text}`, '_blank');
}

/** Open the slip in a new window and bring up the print dialog. */
export function openReturnSlip(data: ReturnSlipData) {
    const html = buildReturnSlipHTML(data);
    const win = window.open('', '_blank', 'width=460,height=760');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 600);
}
