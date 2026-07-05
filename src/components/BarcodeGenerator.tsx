import { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import { Printer } from 'lucide-react';
import { Modal } from './ui';
import { StickerSpec, metaLine, buildVariantSpecs, VariantPrintEntry } from './barcodePrintSpecs';
import { VariantPrintRow } from './VariantPrintRow';

export interface BarcodeBatch {
  id: string;
  batchNumber?: string;
  sellingPrice: number;
  encodedCost?: string;
  supplierName?: string;
  date?: string;
  currentStock?: number;
}

export interface BarcodeVariant {
  sku: string;
  label: string;
  price?: number;
  encodedCost?: string;
  supplierName?: string;
  date?: string;
  batches?: BarcodeBatch[];
}

interface BarcodeGeneratorProps {
  productName: string;
  sku: string;
  price?: number;
  encodedCost?: string;
  supplierName?: string;
  date?: string;
  variants?: BarcodeVariant[];
  batches?: BarcodeBatch[];
  onClose: () => void;
}

// Render at the printer's NATIVE resolution so the bitmap maps 1:1 to printer
// dots. The XP-365B head is 203 dpi = 8 dots/mm. Rendering at a higher density
// (e.g. 12 px/mm) forced the driver to resample 456→304 px — a messy 0.667×
// downscale that blurred every thin stroke and barcode bar. At 8 px/mm there is
// no resampling, so small text and bars stay sharp.
const PX_PER_MM = 8;
const LABEL_W = Math.round(38 * PX_PER_MM); // 304
const LABEL_H = Math.round(25 * PX_PER_MM); // 200
/** millimetres → device pixels at the native head resolution. */
const mm = (v: number) => Math.round(v * PX_PER_MM);

// Luminance cutoff for the 1-bit pass. A thermal head prints each dot full-black
// or nothing — it cannot reproduce the gray anti-alias pixels canvas draws around
// small text, so those either smear black or drop to white and the stroke falls
// apart. We snap every pixel to pure black/white below; a cutoff slightly above
// mid-gray (160/255) keeps thin strokes solid without fattening barcode bars.
const MONO_THRESHOLD = 160;

/**
 * Snap every pixel to pure black or white. Thermal heads are 1-bit devices —
 * resolving the anti-alias grays here is the single biggest win for small-text
 * legibility, and it also cleans up the barcode's resampled edges.
 */
function thresholdToMonochrome(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const v = lum < MONO_THRESHOLD ? 0 : 255;
    d[i] = d[i + 1] = d[i + 2] = v;
    d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

/** Draw text centered at (cx, y), truncating with an ellipsis if wider than maxW. */
function fillTruncated(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, maxW: number) {
  if (ctx.measureText(text).width <= maxW) { ctx.fillText(text, cx, y); return; }
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  ctx.fillText(t + '…', cx, y);
}

/**
 * Draw "name — suffix" centered at (cx, y). The suffix (variant size/colour)
 * is what tells stickers apart, so it must stay visible — reserve room for it
 * first and truncate only the name when the combined text is too wide.
 */
function fillNameWithSuffix(ctx: CanvasRenderingContext2D, name: string, suffix: string | undefined, cx: number, y: number, maxW: number) {
  if (!suffix) { fillTruncated(ctx, name, cx, y, maxW); return; }
  const tail = ` — ${suffix}`;
  const tailW = ctx.measureText(tail).width;
  if (tailW >= maxW) { fillTruncated(ctx, suffix, cx, y, maxW); return; }
  const nameMaxW = maxW - tailW;
  let n = name;
  if (ctx.measureText(n).width > nameMaxW) {
    while (n.length > 1 && ctx.measureText(n + '…').width > nameMaxW) n = n.slice(0, -1);
    n = n + '…';
  }
  ctx.fillText(n + tail, cx, y);
}

/** Lay out an upright sticker (name → barcode → price → meta), vertically centered. */
function drawSticker(ctx: CanvasRenderingContext2D, spec: StickerSpec) {
  const padX = mm(1.5);
  const maxW = LABEL_W - padX * 2;
  const cx = LABEL_W / 2;
  ctx.fillStyle = '#000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Barcode → its own canvas, then scaled to fit. The 1-bit pass later cleans up
  // any edge softening introduced by this scale.
  let bc: HTMLCanvasElement | null = document.createElement('canvas');
  try {
    JsBarcode(bc, spec.value, {
      format: 'CODE128', width: 2, height: 70,
      displayValue: true, fontSize: 20, textMargin: 2, margin: 8,
    });
  } catch { bc = null; }
  let bcW = 0, bcH = 0;
  if (bc && bc.width > 0) {
    const scale = Math.min(maxW / bc.width, mm(11) / bc.height);
    bcW = bc.width * scale;
    bcH = bc.height * scale;
  }

  // Build the vertical stack and center it. Heights are in mm so the layout holds
  // at any render density; small text (meta) is bumped so each stroke clears the
  // ~2-dot floor a thermal head needs to reproduce it.
  const gap = mm(0.7);
  const blocks: { kind: string; h: number }[] = [{ kind: 'name', h: mm(3.1) }];
  if (bcH > 0) blocks.push({ kind: 'bc', h: bcH });
  if (spec.price !== undefined) blocks.push({ kind: 'price', h: mm(3.2) });
  if (spec.metaText) blocks.push({ kind: 'meta', h: mm(2.3) });
  const total = blocks.reduce((s, b) => s + b.h, 0) + gap * (blocks.length - 1);
  let y = (LABEL_H - total) / 2;

  for (const b of blocks) {
    const mid = y + b.h / 2;
    if (b.kind === 'name') {
      ctx.fillStyle = '#000';
      ctx.font = `bold ${mm(2.7)}px Arial`;
      fillNameWithSuffix(ctx, spec.label, spec.variantSuffix, cx, mid, maxW);
    } else if (b.kind === 'bc' && bc) {
      ctx.imageSmoothingEnabled = false; // keep bars sharp when scaled
      ctx.drawImage(bc, cx - bcW / 2, y, bcW, bcH);
    } else if (b.kind === 'price') {
      ctx.fillStyle = '#000';
      ctx.font = `bold ${mm(2.8)}px Arial`;
      ctx.fillText(`LKR ${spec.price!.toFixed(2)}`, cx, mid);
    } else if (b.kind === 'meta') {
      ctx.fillStyle = '#000'; // pure black — a 1-bit head can't print the old #333 gray
      ctx.font = `bold ${mm(1.9)}px Arial`;
      fillTruncated(ctx, spec.metaText!, cx, mid, maxW);
    }
    y += b.h + gap;
  }
}

/**
 * Render one sticker to a fixed-size PNG, pre-flipped 180°.
 *
 * Why an image instead of HTML/CSS: the XP-365B + Edge print path mangled CSS
 * layout (90° landscape spin, auto-height growth across labels, edge clipping).
 * A fixed-size bitmap can't reflow, grow, or spin — it prints exactly as drawn.
 * The printer prints 180° flipped, so we bake the flip into the bitmap.
 */
// Render text/vectors at SS× the head resolution, then box-downscale to native.
// Rasterizing tiny bold Arial straight at 8 px/mm relies on the font's low-res
// hinting and leaves strokes patchy; capturing the glyph at 3× and averaging down
// places each native dot by true ink coverage, so small strokes stay whole.
const SUPERSAMPLE = 3;

function renderStickerDataURL(spec: StickerSpec): string {
  // 1. Draw the upright, pre-flipped sticker at SS× resolution. scale() lets
  //    drawSticker keep working in native (logical) coordinates.
  const hi = document.createElement('canvas');
  hi.width = LABEL_W * SUPERSAMPLE;
  hi.height = LABEL_H * SUPERSAMPLE;
  const hctx = hi.getContext('2d')!;
  hctx.scale(SUPERSAMPLE, SUPERSAMPLE);
  hctx.fillStyle = '#fff';
  hctx.fillRect(0, 0, LABEL_W, LABEL_H);
  // Bake the 180° flip: draw upright content into a rotated context.
  hctx.translate(LABEL_W, LABEL_H);
  hctx.rotate(Math.PI);
  drawSticker(hctx, spec);

  // 2. Downscale to the native dot grid, then snap to pure black/white for the
  //    1-bit head. The high-quality downscale + threshold is what sharpens text.
  const canvas = document.createElement('canvas');
  canvas.width = LABEL_W;
  canvas.height = LABEL_H;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(hi, 0, 0, hi.width, hi.height, 0, 0, LABEL_W, LABEL_H);
  thresholdToMonochrome(ctx, LABEL_W, LABEL_H);
  return canvas.toDataURL('image/png');
}

function buildPopupHtml(imgsHtml: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  /* AUTO height keeps the 38mm-wide page from being treated as landscape (which
     spins content 90°). Each sticker is a fixed-size pre-flipped PNG, so there
     is no CSS layout to reflow, grow, or rotate — it prints exactly as drawn. */
  @page { size: 38mm auto; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { margin: 0; padding: 0; background: white; font-family: Arial, sans-serif; }
  .toolbar {
    position: fixed; top: 0; left: 0; right: 0; z-index: 9999;
    padding: 8px 12px;
    background: #f1f5f9; border-bottom: 1px solid #e2e8f0;
    display: flex; align-items: center; gap: 10px;
  }
  .toolbar .title { font-size: 11pt; font-weight: 600; color: #1e293b; }
  .toolbar .tip { font-size: 8pt; color: #64748b; flex: 1; }
  .toolbar button {
    padding: 6px 18px; background: #0f172a; color: white;
    border: none; border-radius: 6px; font-size: 11pt; cursor: pointer;
  }
  .content { margin-top: 44px; }
  img.sticker {
    display: block;
    width: 38mm;
    height: 25mm;
    break-after: page;
    page-break-after: always;
  }
  img.sticker:last-child { break-after: auto; page-break-after: auto; }
  @media print { .toolbar { display: none !important; } .content { margin-top: 0 !important; } }
</style>
</head>
<body>
<div class="toolbar">
  <span class="title">Barcode Stickers <span style="font-size:8pt;color:#16a34a;font-weight:600;">v11 (sharp · 3× SS)</span></span>
  <span class="tip">In print dialog: set Margins to "None"</span>
  <button onclick="window.print()">Print</button>
</div>
<div class="content">
${imgsHtml}
</div>
</body>
</html>`;
}

function SingleBarcode({ value, label, price, encodedCost, supplierName, date, onSvgReady }: {
  value: string; label: string; price?: number;
  encodedCost?: string; supplierName?: string; date?: string;
  onSvgReady?: (el: SVGSVGElement | null) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const callbackRef = useRef(onSvgReady);
  useEffect(() => { callbackRef.current = onSvgReady; });

  useEffect(() => {
    if (svgRef.current && value) {
      try {
        JsBarcode(svgRef.current, value, {
          format: 'CODE128',
          width: 1.5,
          height: 26,
          displayValue: true,
          fontSize: 9,
          margin: 2,
          textMargin: 1,
        });
        callbackRef.current?.(svgRef.current);
      } catch (e) {
        console.error('Barcode error:', e);
      }
    }
    return () => { callbackRef.current?.(null); };
  }, [value]);

  return (
    <div className="bg-white border-2 border-dashed border-slate-300 rounded-lg p-4 text-center">
      <h3 className="text-sm font-bold text-slate-900 mb-1 truncate">{label}</h3>
      <div className="flex justify-center mb-2">
        <svg ref={svgRef} className="max-w-full"></svg>
      </div>
      {price !== undefined && (
        <p className="text-base font-bold text-slate-900">LKR {price.toFixed(2)}</p>
      )}
      {(supplierName || date) && (
        <p className="text-xs text-slate-500 mt-1">
          {[supplierName, date].filter(Boolean).join(' · ')}
        </p>
      )}
      {encodedCost && (
        <p className="text-xs font-mono font-semibold text-slate-700 mt-0.5 tracking-widest">{encodedCost}</p>
      )}
    </div>
  );
}

export function BarcodeGenerator({ productName, sku, price, encodedCost, supplierName, date, variants, batches, onClose }: BarcodeGeneratorProps) {
  const hasVariants = variants && variants.length > 1;
  const [tab, setTab] = useState<'product' | 'variants'>('product');
  const [selectedBatchIds, setSelectedBatchIds] = useState<Set<string>>(
    () => new Set<string>()
  );
  const makeVariantState = () =>
    new Map<string, VariantPrintEntry>((variants ?? []).map(v => [v.sku, { selected: false, batchId: v.batches?.[0]?.id ?? '' }]));
  const [variantPrint, setVariantPrint] = useState<Map<string, VariantPrintEntry>>(makeVariantState);

  useEffect(() => {
    setVariantPrint(makeVariantState());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variants]);

  const productSvgRef = useRef<SVGSVGElement | null>(null);

  const variantTotal = Array.from(variantPrint.values()).filter(e => e.selected).length;

  const updateVariant = (sku: string, patch: Partial<VariantPrintEntry>) =>
    setVariantPrint(prev => {
      const next = new Map(prev);
      const cur = next.get(sku) ?? { selected: false, batchId: '' };
      next.set(sku, { ...cur, ...patch });
      return next;
    });

  const previewBatch = batches?.find(b => selectedBatchIds.has(b.id));

  function handlePrint() {
    const specs: StickerSpec[] = [];

    if (tab === 'product' || !hasVariants) {
      // Batch selection only applies when there's more than one batch (the
      // checkbox UI only renders for batches.length > 1). With a single batch —
      // or when no batch is ticked — fall back to the product-level sticker,
      // whose price/supplier/date/cost props already come from batches[0].
      const selectedBatches = batches?.filter(b => selectedBatchIds.has(b.id)) ?? [];
      if (selectedBatches.length > 0) {
        selectedBatches.forEach(b =>
          specs.push({ value: sku, label: productName, price: b.sellingPrice, metaText: metaLine(b.supplierName, b.date, b.encodedCost) })
        );
      } else {
        specs.push({ value: sku, label: productName, price, metaText: metaLine(supplierName, date, encodedCost) });
      }
    } else {
      specs.push(...buildVariantSpecs(variants ?? [], variantPrint, productName));
    }

    if (specs.length === 0) { alert('No stickers selected to print.'); return; }

    const imgsHtml = specs
      .map(s => `<img class="sticker" src="${renderStickerDataURL(s)}" />`)
      .join('');

    const popup = window.open('', '_blank', 'width=400,height=600,scrollbars=yes,menubar=no,toolbar=no,location=no,status=no');
    if (!popup) { alert('Please allow popups for this site to enable printing.'); return; }
    popup.document.write(buildPopupHtml(imgsHtml));
    popup.document.close();
  }

  function batchRow(b: BarcodeBatch, checked: boolean, onChange: (checked: boolean) => void, showSupplier: boolean) {
    const parts = [
      b.date,
      showSupplier ? b.supplierName : undefined,
      `LKR ${b.sellingPrice.toFixed(2)}`,
      b.currentStock !== undefined ? `${b.currentStock} in stock` : undefined,
    ].filter(Boolean);
    return (
      <label key={b.id} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={e => onChange(e.target.checked)}
          className="w-4 h-4 rounded"
        />
        <span className="text-sm text-slate-700">{parts.join(' · ')}</span>
      </label>
    );
  }

  return (
    <Modal isOpen onClose={onClose} title="Print Barcode">
      <div className="p-6">
        <div className="flex justify-end mb-4">
          {hasVariants && (
            <div style={{ display: 'flex', gap: 4, marginRight: 'auto', background: 'var(--panel-2)', borderRadius: 8, padding: 3 }}>
              {(['product', 'variants'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  style={{
                    padding: '4px 14px', border: 0, borderRadius: 6, cursor: 'default', fontSize: 12.5, fontWeight: 500,
                    background: tab === t ? 'var(--panel)' : 'transparent',
                    color: tab === t ? 'var(--ink)' : 'var(--muted)',
                    boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,.08)' : 'none',
                  }}
                >
                  {t === 'product' ? 'Product' : 'Per Variant'}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={handlePrint}
            disabled={tab === 'variants' && hasVariants && variantTotal === 0}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Printer className="w-4 h-4" />
            {tab === 'variants' && hasVariants && variantTotal > 0 ? `Print ${variantTotal} labels` : 'Print'}
          </button>
        </div>

        {(tab === 'product' || !hasVariants) && batches && batches.length > 1 && (
          <div className="mb-4 border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wide">
              Batches
            </div>
            {batches.map(b => batchRow(
              b,
              selectedBatchIds.has(b.id),
              checked => setSelectedBatchIds(prev => {
                const next = new Set(prev);
                if (checked) next.add(b.id); else next.delete(b.id);
                return next;
              }),
              true,
            ))}
          </div>
        )}

        {tab === 'product' || !hasVariants ? (
          <SingleBarcode
            value={sku}
            label={productName}
            price={previewBatch ? previewBatch.sellingPrice : price}
            encodedCost={previewBatch ? previewBatch.encodedCost : encodedCost}
            supplierName={previewBatch ? previewBatch.supplierName : supplierName}
            date={previewBatch ? previewBatch.date : date}
            onSvgReady={el => { productSvgRef.current = el; }}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {variants!.map(v => {
              const entry = variantPrint.get(v.sku) ?? { selected: false, batchId: v.batches?.[0]?.id ?? '' };
              return (
                <VariantPrintRow
                  key={v.sku}
                  variant={v}
                  selected={entry.selected}
                  batchId={entry.batchId}
                  onToggle={selected => updateVariant(v.sku, { selected })}
                  onBatch={batchId => updateVariant(v.sku, { batchId })}
                />
              );
            })}
            <div className="text-right text-sm font-semibold text-slate-700 mt-1">
              Total: {variantTotal} {variantTotal === 1 ? 'label' : 'labels'}
            </div>
          </div>
        )}

        <p className="text-xs text-slate-500 text-center mt-4">
          Print this barcode and attach it to the product
        </p>
      </div>
    </Modal>
  );
}
