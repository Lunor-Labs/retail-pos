export interface VoucherCardData {
  code: string;
  amount: number;
  issuedTo?: string;
  issuedByName?: string;
  message?: string;
  expiresAt?: string; // ISO date string
  storeName?: string;
  issuedAt: string;   // ISO date string
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
}

function fmtAmount(n: number) {
  return 'LKR ' + Math.round(n).toLocaleString('en-US');
}

export function buildVoucherCardHTML(data: VoucherCardData): string {
  const storeName = data.storeName ?? 'RIVONLAK';
  const expiryLine = data.expiresAt
    ? `Valid until &nbsp;<b>${fmtDate(data.expiresAt)}</b>`
    : 'No expiry date';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Gift Voucher · ${data.code}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Inter:wght@300;400;500;600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  html, body {
    width: 100%; height: 100%;
    background: #0a0c12;
    display: flex; align-items: center; justify-content: center;
    min-height: 100vh;
  }

  .card {
    width: 820px;
    background: linear-gradient(135deg, #1a1d2e 0%, #12141f 60%, #1e1828 100%);
    border-radius: 20px;
    overflow: hidden;
    position: relative;
    box-shadow: 0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(201,168,76,0.2);
    font-family: 'Inter', system-ui, sans-serif;
  }

  /* Decorative gold top bar */
  .top-bar {
    height: 5px;
    background: linear-gradient(90deg, #8a6f2c, #c9a84c, #e8c96a, #c9a84c, #8a6f2c);
  }

  /* Background pattern */
  .card::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image: radial-gradient(circle, rgba(201,168,76,0.04) 1px, transparent 1px);
    background-size: 28px 28px;
    pointer-events: none;
  }

  /* Corner ornaments */
  .corner { position: absolute; width: 60px; height: 60px; }
  .corner svg { width: 100%; height: 100%; }
  .corner.tl { top: 20px; left: 20px; }
  .corner.tr { top: 20px; right: 20px; transform: scaleX(-1); }
  .corner.bl { bottom: 20px; left: 20px; transform: scaleY(-1); }
  .corner.br { bottom: 20px; right: 20px; transform: scale(-1); }

  .body {
    padding: 44px 56px 40px;
    position: relative;
    z-index: 1;
  }

  /* Store name */
  .store-name {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 13px;
    font-weight: 400;
    letter-spacing: 0.3em;
    text-transform: uppercase;
    color: #c9a84c;
    text-align: center;
    margin-bottom: 4px;
  }

  .divider {
    display: flex; align-items: center; justify-content: center; gap: 10px;
    margin: 10px 0 18px;
  }
  .divider-line { flex: 1; height: 1px; background: linear-gradient(90deg, transparent, rgba(201,168,76,0.35), transparent); }
  .divider-diamond { width: 6px; height: 6px; background: #c9a84c; transform: rotate(45deg); flex-shrink: 0; }

  .voucher-label {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 11px;
    font-weight: 400;
    letter-spacing: 0.5em;
    text-transform: uppercase;
    color: rgba(201,168,76,0.6);
    text-align: center;
    margin-bottom: 28px;
  }

  /* Amount */
  .amount-wrap {
    text-align: center;
    margin: 0 0 30px;
    position: relative;
  }
  .amount-wrap::before, .amount-wrap::after {
    content: '✦';
    font-size: 14px;
    color: rgba(201,168,76,0.4);
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
  }
  .amount-wrap::before { left: 0; }
  .amount-wrap::after { right: 0; }

  .amount {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 52px;
    font-weight: 700;
    color: #e8c96a;
    letter-spacing: -0.02em;
    line-height: 1;
    text-shadow: 0 2px 20px rgba(201,168,76,0.3);
  }

  /* Info grid */
  .info-row {
    display: flex;
    justify-content: space-between;
    gap: 24px;
    margin-bottom: 24px;
    padding: 0 4px;
  }
  .info-item { flex: 1; }
  .info-label {
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: rgba(201,168,76,0.5);
    margin-bottom: 5px;
  }
  .info-value {
    font-size: 14px;
    font-weight: 500;
    color: rgba(255,255,255,0.85);
    line-height: 1.3;
  }

  /* Message */
  .message {
    text-align: center;
    font-style: italic;
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 14px;
    color: rgba(255,255,255,0.6);
    margin-bottom: 28px;
    line-height: 1.5;
    padding: 0 20px;
  }
  .message::before { content: '"'; margin-right: 2px; color: rgba(201,168,76,0.5); }
  .message::after  { content: '"'; margin-left: 2px; color: rgba(201,168,76,0.5); }

  /* Code section */
  .code-section {
    background: rgba(0,0,0,0.3);
    border: 1px solid rgba(201,168,76,0.2);
    border-radius: 10px;
    padding: 16px 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 20px;
  }
  .code-label {
    font-size: 9px;
    letter-spacing: 0.25em;
    text-transform: uppercase;
    color: rgba(201,168,76,0.5);
    margin-bottom: 6px;
  }
  .code {
    font-family: 'Courier New', Courier, monospace;
    font-size: 24px;
    font-weight: 700;
    letter-spacing: 0.2em;
    color: #e8c96a;
    text-shadow: 0 0 20px rgba(201,168,76,0.4);
  }
  .validity {
    text-align: right;
    flex-shrink: 0;
  }
  .validity-label {
    font-size: 9px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: rgba(201,168,76,0.5);
    margin-bottom: 5px;
  }
  .validity-value {
    font-size: 12px;
    color: rgba(255,255,255,0.65);
    font-weight: 500;
  }

  /* Footer */
  .footer {
    text-align: center;
    font-size: 10px;
    letter-spacing: 0.12em;
    color: rgba(255,255,255,0.25);
    margin-top: 6px;
  }

  @media print {
    html, body { background: #0a0c12; margin: 0; padding: 0; }
    @page { size: 820px 480px; margin: 0; }
    body { display: block; }
    .card { border-radius: 0; box-shadow: none; width: 100%; }
  }
</style>
</head>
<body>
<div class="card">
  <div class="top-bar"></div>
  <!-- Corner ornaments -->
  <div class="corner tl">
    <svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 56 L4 4 L56 4" stroke="rgba(201,168,76,0.3)" stroke-width="1.5" fill="none"/>
      <path d="M4 20 L20 4" stroke="rgba(201,168,76,0.2)" stroke-width="1" fill="none"/>
      <circle cx="4" cy="4" r="3" fill="rgba(201,168,76,0.5)"/>
    </svg>
  </div>
  <div class="corner tr">
    <svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 56 L4 4 L56 4" stroke="rgba(201,168,76,0.3)" stroke-width="1.5" fill="none"/>
      <path d="M4 20 L20 4" stroke="rgba(201,168,76,0.2)" stroke-width="1" fill="none"/>
      <circle cx="4" cy="4" r="3" fill="rgba(201,168,76,0.5)"/>
    </svg>
  </div>
  <div class="corner bl">
    <svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 56 L4 4 L56 4" stroke="rgba(201,168,76,0.3)" stroke-width="1.5" fill="none"/>
      <path d="M4 20 L20 4" stroke="rgba(201,168,76,0.2)" stroke-width="1" fill="none"/>
      <circle cx="4" cy="4" r="3" fill="rgba(201,168,76,0.5)"/>
    </svg>
  </div>
  <div class="corner br">
    <svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 56 L4 4 L56 4" stroke="rgba(201,168,76,0.3)" stroke-width="1.5" fill="none"/>
      <path d="M4 20 L20 4" stroke="rgba(201,168,76,0.2)" stroke-width="1" fill="none"/>
      <circle cx="4" cy="4" r="3" fill="rgba(201,168,76,0.5)"/>
    </svg>
  </div>

  <div class="body">
    <div class="store-name">${storeName}</div>
    <div class="divider">
      <div class="divider-line"></div>
      <div class="divider-diamond"></div>
      <div class="divider-line"></div>
    </div>
    <div class="voucher-label">Gift Voucher</div>

    <div class="amount-wrap">
      <div class="amount">${fmtAmount(data.amount)}</div>
    </div>

    ${data.message ? `<div class="message">${data.message}</div>` : ''}

    ${(data.issuedTo || data.issuedByName) ? `
    <div class="info-row">
      ${data.issuedTo ? `
      <div class="info-item">
        <div class="info-label">For</div>
        <div class="info-value">${data.issuedTo}</div>
      </div>` : ''}
      ${data.issuedByName ? `
      <div class="info-item" style="text-align:right;">
        <div class="info-label">From</div>
        <div class="info-value">${data.issuedByName}</div>
      </div>` : ''}
    </div>` : ''}

    <div class="code-section">
      <div>
        <div class="code-label">Voucher Code</div>
        <div class="code">${data.code}</div>
      </div>
      <div class="validity">
        <div class="validity-label">Issued</div>
        <div class="validity-value">${fmtDate(data.issuedAt)}</div>
        <div class="validity-label" style="margin-top:8px;">${data.expiresAt ? 'Valid Until' : ''}</div>
        <div class="validity-value">${data.expiresAt ? fmtDate(data.expiresAt) : ''}</div>
      </div>
    </div>

    <div class="footer">
      Present this voucher at ${storeName} · One-time use · Non-transferable
    </div>
  </div>
</div>
</body>
</html>`;
}

// Normalise phone to wa.me format (digits only, LK 0XX → 94XX)
export function normalisePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('0')) return '94' + digits.slice(1);
  if (digits.startsWith('94')) return digits;
  return digits;
}

// Build pre-filled WhatsApp message text
export function buildWhatsAppMessage(data: VoucherCardData, storeName = 'RIVONLAK'): string {
  const lines: string[] = [];
  lines.push(`🎁 *Gift Voucher — ${storeName}*`);
  lines.push('');
  if (data.issuedTo) lines.push(`Dear *${data.issuedTo}*,`);
  lines.push(`You've received a gift voucher worth *${fmtAmount(data.amount)}*!`);
  if (data.issuedByName) lines.push(`From: *${data.issuedByName}*`);
  lines.push('');
  lines.push(`🔑 *${data.code}*`);
  if (data.expiresAt) lines.push(`📅 Valid until ${fmtDate(data.expiresAt)}`);
  if (data.message) { lines.push(''); lines.push(`_"${data.message}"_`); }
  lines.push('');
  lines.push(`Present this code at *${storeName}* to redeem your voucher.`);
  return lines.join('\n');
}

// Opens WhatsApp web/app with pre-filled message
export function openWhatsApp(phone: string, data: VoucherCardData, storeName?: string) {
  const number = normalisePhone(phone);
  const text = encodeURIComponent(buildWhatsAppMessage(data, storeName));
  window.open(`https://wa.me/${number}?text=${text}`, '_blank');
}

// Opens the card in a new window for print-to-PDF
export function openVoucherCard(data: VoucherCardData) {
  const html = buildVoucherCardHTML(data);
  const win = window.open('', '_blank', 'width=900,height=560');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  // Short delay then print dialog (browser saves as PDF)
  setTimeout(() => win.print(), 600);
}
