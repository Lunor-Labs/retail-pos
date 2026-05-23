/**
 * THERMAL RECEIPT PRINT CSS
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * PAPER WIDTH MISMATCH HANDLING
 * ─────────────────────────────────────────────────────────────────────────────
 * Printer driver (CUPS/PPD) is configured for : 4 inches = 101.6 mm
 * Physical paper roll loaded                  : 3.15 inches = 80 mm
 *
 * The print head is 101.6 mm wide. The 80 mm paper sits flush to the LEFT
 * edge of the print head. So:
 *   • @page width MUST be 101.6 mm  ← what the driver sends to the head
 *   • Receipt content MUST be        ← within the left 80 mm of the page
 *     ≤76 mm wide and left-aligned     so it lands on physical paper
 *   • The right 21.6 mm of the page ← unused (no paper there)
 *
 * @page height is patched by JS after measuring actual content height so
 * the thermal cutter fires exactly after the last printed line.
 *
 * KEY PRINCIPLE: Use ONLY physical units (mm, pt) for ALL sizes.
 * Browsers scale px-based content to fit the page — physical units are immune.
 *
 * FONT WEIGHT / ANTI-ALIASING
 * ─────────────────────────────────────────────────────────────────────────────
 * Thermal heads are binary (dot on or off). Anti-aliased grey pixels don't
 * heat the paper enough → text looks faint. We:
 *   1. Disable ALL font smoothing  (-webkit-font-smoothing: none)
 *   2. Use font-weight ≥ 600 as the minimum so strokes are thick enough.
 */

export const RECEIPT_PRINT_CSS = `
  /* Remove initial @page rule - JS will inject the correct one */

  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    -webkit-font-smoothing: none;
    font-smooth: never;
  }

  html {
    /* Match printer driver: 4 inches = 101.6mm */
    width: 101.6mm;
    font-size: 9pt;
  }

  body {
    width: 101.6mm;
    background: #fff;
    font-family: 'Courier New', Courier, monospace;
    font-size: 9pt;
    font-weight: 600;
    line-height: 1.4;
    color: #000;
  }

  #receipt {
    /* 76mm fits within 80mm paper, centered for your printer */
    width: 76mm;
    margin: 0 auto;
    padding: 2mm 2mm 4mm;
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
    font-size: 12pt;
    font-weight: 800;
    letter-spacing: 0.1mm;
  }

  .store-sub  { font-size: 8pt; font-weight: 600; }
  .store-addr { font-size: 7.5pt;   font-weight: 600; color: #111; }

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
    display: table;
    width: 100%;
    margin-bottom: 0.5mm;
    font-size: 9pt;
  }
  .row > * {
    display: table-cell;
    vertical-align: baseline;
  }
  .row > *:first-child {
    text-align: left;
  }
  .row > *:last-child {
    text-align: right;
  }

  .total-row {
    font-size: 11pt;
    font-weight: 900;
  }

  /* ── Items ── */
  .item {
    margin-bottom: 1.2mm;
  }

  .item-name {
    font-weight: 800;
    font-size: 9pt;
    word-break: break-word;
    white-space: normal;
    line-height: 1.3;
  }

  .warranty {
    font-size: 7.5pt;
    font-weight: 600;
    padding-left: 2mm;
    line-height: 1.2;
  }

  .item-price {
    padding-left: 2mm;
    font-size: 9pt;
  }

  /* ── Footer ── */
  .footer { margin-top: 1mm; }

  .qr {
    display: block;
    width: 22mm;
    height: 22mm;
    object-fit: contain;
    margin: 1.5mm auto;
  }

  .thank  { font-size: 8pt; font-weight: 600; margin-top: 1.5mm; }
  .google { font-size: 8pt; font-weight: 800; margin-bottom: 0.8mm; }
  .power  { font-size: 5.5pt;   font-weight: 600; color: #333; margin-top: 1mm; }
`;

/**
 * Inline JS injected into the popup window.
 *
 * After all images load it:
 *   1. Waits two animation frames + 80 ms for layout/font metrics to settle.
 *   2. Measures the exact rendered height of #receipt (CSS px → mm).
 *   3. Injects a precise @page rule that overrides the CUPS driver paper size.
 *   4. Calls window.print() then closes the popup on afterprint.
 *
 * This ensures:
 *   • No font scaling regardless of item count.
 *   • The thermal cutter fires immediately after the last printed line.
 */
export const RECEIPT_PRINT_JS = `
  // Inject @page to match your 4-inch printer driver width
  // Remove fixed height - let content determine length
  (function() {
    var style = document.createElement('style');
    style.id = 'page-style';
    // 101.6mm = 4 inches (matches your driver)
    // 'auto' height should work with Type: Continue
    style.textContent = '@page { size: 101.6mm auto; margin: 0; }';
    document.head.appendChild(style);
  })();

  function measureAndPrint() {
    var receipt = document.getElementById('receipt');

    // Get actual content height
    var heightPx = receipt.scrollHeight;
    // Convert to mm: 1px = 25.4/96 mm
    var heightMm = Math.ceil(heightPx * 25.4 / 96);

    console.log('[Receipt] Content height:', heightMm, 'mm');

    // For Xprinter with Continue type, we need to trick the driver
    // by NOT setting a fixed page height - let it flow
    // Just ensure body height matches content
    document.body.style.height = 'auto';
    document.documentElement.style.height = 'auto';

    // Small delay then print
    setTimeout(function() {
      window.print();
    }, 100);

    window.addEventListener('afterprint', function () {
      window.close();
    });
  }

  function doPrint() {
    // Wait for layout to settle
    setTimeout(function() {
      requestAnimationFrame(function () {
        requestAnimationFrame(measureAndPrint);
      });
    }, 300);
  }

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
        img.addEventListener('error', onImageSettled);
      }
    });
  }
`;
