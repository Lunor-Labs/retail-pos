import qz from 'qz-tray';

/**
 * Direct label printing to the Xprinter XP-365B via QZ Tray.
 *
 * Why QZ Tray + TSPL instead of window.print():
 *   The browser print dialog sits between the app and the printer and overrides
 *   everything with Margins / Scale / Paper / Orientation settings that staff
 *   must re-set every time and that silently revert. That made browser printing
 *   to this label printer unreliable. QZ Tray sends native TSPL commands
 *   straight to the printer — no dialog, no margins, no scaling, no orientation
 *   guessing. The printer renders the barcode in firmware, so it's always sharp
 *   and correctly sized.
 *
 * Requires QZ Tray (free) running on the till PC: https://qz.io/download/
 */

export interface LabelSpec {
  value: string; // barcode value (SKU)
  label: string; // product name line
  price?: number;
  metaText?: string; // "supplier · date · cost"
}

// XP-365B is 203 dpi = 8 dots/mm. A 38 × 25 mm label = 304 × 200 dots.
const DOTS_W = 304;

// If labels print upside down, change this to 0. (TSPL print direction.)
const PRINT_DIRECTION = 1;

// TSC internal font cell widths (dots), used to center TEXT lines.
const FONT_W: Record<string, number> = { '1': 8, '2': 12, '3': 16, '4': 24, '5': 32 };

let securityConfigured = false;
function configureSecurity() {
  if (securityConfigured) return;
  // Unsigned mode: QZ Tray shows a one-time "Allow" prompt (tick "Remember").
  qz.security.setCertificatePromise((resolve: (v?: unknown) => void) => resolve());
  qz.security.setSignaturePromise(() => (resolve: (v?: unknown) => void) => resolve());
  securityConfigured = true;
}

/** Connect to QZ Tray on localhost (reuses an existing connection if active). */
async function ensureConnected(): Promise<void> {
  configureSecurity();
  if (qz.websocket.isActive()) return;
  await qz.websocket.connect();
}

/** Pick a printer whose name matches `re`, else the system default, else the first. */
async function findPrinter(re: RegExp): Promise<string> {
  const printers: string[] = await qz.printers.find();
  const match = printers.find((p) => re.test(p));
  if (match) return match;
  const def: string | undefined = await qz.printers.getDefault();
  if (def) return def;
  if (printers.length) return printers[0];
  throw new Error('No printers found on this PC.');
}

// The 38×25 label printer vs the 80mm receipt printer (matched by name).
const findLabelPrinter = () => findPrinter(/xp.?365|label/i);
const findReceiptPrinter = () => findPrinter(/xp.?80|80c|receipt|pos.?80|thermal/i);

/** Strip characters that would break a TSPL quoted string. */
function esc(s: string | undefined): string {
  return (s ?? '').replace(/["\\]/g, ' ').replace(/[\r\n]+/g, ' ').trim();
}

/** A TEXT command horizontally centered on the label, truncated to fit. */
function centeredText(text: string, font: string, y: number): string {
  const cw = FONT_W[font] ?? 12;
  const maxChars = Math.floor((DOTS_W - 16) / cw);
  let t = esc(text);
  if (t.length > maxChars) t = t.slice(0, maxChars);
  if (!t) return '';
  const x = Math.max(0, Math.round((DOTS_W - t.length * cw) / 2));
  return `TEXT ${x},${y},"${font}",0,1,1,"${t}"`;
}

/** A centered CODE128 barcode; narrow-bar width chosen to fit the 38 mm width. */
function barcode(value: string, y: number): string {
  const v = esc(value);
  if (!v) return '';
  const modules = 11 * (v.length + 2) + 13; // CODE128, Code-B worst case
  const usable = DOTS_W - 24; // ~12-dot quiet zone each side
  const narrow = Math.max(1, Math.min(3, Math.floor(usable / modules)));
  const x = Math.max(0, Math.round((DOTS_W - modules * narrow) / 2));
  return `BARCODE ${x},${y},"128",64,1,0,${narrow},${narrow},"${v}"`;
}

/** Build the TSPL program for a single label. */
function buildLabel(spec: LabelSpec): string {
  return [
    'SIZE 38 mm, 25 mm',
    'GAP 2 mm, 0 mm',
    `DIRECTION ${PRINT_DIRECTION}`,
    'CLS',
    centeredText(spec.label, '2', 6),
    barcode(spec.value, 38),
    spec.price != null ? centeredText(`LKR ${spec.price.toFixed(2)}`, '3', 132) : '',
    spec.metaText ? centeredText(spec.metaText, '1', 164) : '',
    'PRINT 1,1',
  ]
    .filter(Boolean)
    .join('\r\n') + '\r\n';
}

/**
 * Print one label per spec on the XP-365B.
 * Throws if QZ Tray isn't reachable so the caller can fall back / inform the user.
 */
export async function printLabels(specs: LabelSpec[]): Promise<void> {
  await ensureConnected();
  const printer = await findLabelPrinter();
  const config = qz.configs.create(printer, { encoding: 'UTF-8' });
  const program = specs.map(buildLabel).join('');
  await qz.print(config, [program]);
}

/**
 * Print a receipt to the 80mm XP-80C by rasterizing the receipt HTML.
 *
 * HTML (not raw ESC/POS) because the receipt has a logo and Sinhala text, which
 * thermal text commands can't render. QZ renders the HTML at 80mm width and
 * content height, then sends the bitmap to the printer — no dialog.
 *
 * Throws if QZ Tray isn't reachable so the caller can fall back to the browser.
 */
export async function printReceiptHTML(html: string): Promise<void> {
  await ensureConnected();
  const printer = await findReceiptPrinter();
  const config = qz.configs.create(printer, {
    units: 'mm',
    size: { width: 80 }, // 80mm paper; height follows content
    margins: 0,
    colorType: 'blackwhite',
  });
  await qz.print(config, [{ type: 'pixel', format: 'html', flavor: 'plain', data: html }]);
}
