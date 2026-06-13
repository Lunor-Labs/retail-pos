import { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import { Printer } from 'lucide-react';
import { Modal } from './ui';
import { printLabels } from '../lib/qzPrint';

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

interface StickerSpec {
  value: string;        // barcode value (SKU)
  label: string;        // product name line
  price?: number;
  metaText?: string;    // "supplier · date · cost"
}

// Render canvas resolution: 12 px/mm ≈ 305 dpi (crisp on a 203 dpi thermal head)
const PX_PER_MM = 12;
const LABEL_W = Math.round(38 * PX_PER_MM); // 456
const LABEL_H = Math.round(25 * PX_PER_MM); // 300

/** Draw text centered at (cx, y), truncating with an ellipsis if wider than maxW. */
function fillTruncated(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, maxW: number) {
  if (ctx.measureText(text).width <= maxW) { ctx.fillText(text, cx, y); return; }
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  ctx.fillText(t + '…', cx, y);
}

/** Lay out an upright sticker (name → barcode → price → meta), vertically centered. */
function drawSticker(ctx: CanvasRenderingContext2D, spec: StickerSpec) {
  const padX = Math.round(1.5 * PX_PER_MM);
  const maxW = LABEL_W - padX * 2;
  const cx = LABEL_W / 2;
  ctx.fillStyle = '#000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Barcode → its own canvas, then scaled to fit
  let bc: HTMLCanvasElement | null = document.createElement('canvas');
  try {
    JsBarcode(bc, spec.value, {
      format: 'CODE128', width: 2, height: 70,
      displayValue: true, fontSize: 16, textMargin: 2, margin: 10,
    });
  } catch { bc = null; }
  let bcW = 0, bcH = 0;
  if (bc && bc.width > 0) {
    const scale = Math.min(maxW / bc.width, 130 / bc.height);
    bcW = bc.width * scale;
    bcH = bc.height * scale;
  }

  // Build the vertical stack and center it
  const gap = 8;
  const blocks: { kind: string; h: number }[] = [{ kind: 'name', h: 26 }];
  if (bcH > 0) blocks.push({ kind: 'bc', h: bcH });
  if (spec.price !== undefined) blocks.push({ kind: 'price', h: 36 });
  if (spec.metaText) blocks.push({ kind: 'meta', h: 22 });
  const total = blocks.reduce((s, b) => s + b.h, 0) + gap * (blocks.length - 1);
  let y = (LABEL_H - total) / 2;

  for (const b of blocks) {
    const mid = y + b.h / 2;
    if (b.kind === 'name') {
      ctx.fillStyle = '#000';
      ctx.font = 'bold 22px Arial';
      fillTruncated(ctx, spec.label, cx, mid, maxW);
    } else if (b.kind === 'bc' && bc) {
      ctx.imageSmoothingEnabled = false; // keep bars sharp when scaled
      ctx.drawImage(bc, cx - bcW / 2, y, bcW, bcH);
    } else if (b.kind === 'price') {
      ctx.fillStyle = '#000';
      ctx.font = 'bold 30px Arial';
      ctx.fillText(`LKR ${spec.price!.toFixed(2)}`, cx, mid);
    } else if (b.kind === 'meta') {
      ctx.fillStyle = '#333';
      ctx.font = '17px Arial';
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
function renderStickerDataURL(spec: StickerSpec): string {
  const canvas = document.createElement('canvas');
  canvas.width = LABEL_W;
  canvas.height = LABEL_H;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, LABEL_W, LABEL_H);
  // Bake the 180° flip: draw upright content into a rotated context.
  ctx.translate(LABEL_W, LABEL_H);
  ctx.rotate(Math.PI);
  drawSticker(ctx, spec);
  return canvas.toDataURL('image/png');
}

const metaLine = (...parts: (string | undefined)[]) => parts.filter(Boolean).join(' · ');

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
  <span class="title">Barcode Stickers <span style="font-size:8pt;color:#16a34a;font-weight:600;">v10 (browser fallback)</span></span>
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
  const [printing, setPrinting] = useState(false);
  const [selectedBatchIds, setSelectedBatchIds] = useState<Set<string>>(
    () => new Set(batches?.map(b => b.id) ?? [])
  );
  const [selectedVariantBatchIds, setSelectedVariantBatchIds] = useState<Map<string, Set<string>>>(
    () => new Map(variants?.map(v => [v.sku, new Set(v.batches?.map(b => b.id) ?? [])]) ?? [])
  );

  useEffect(() => {
    setSelectedVariantBatchIds(
      new Map(variants?.map(v => [v.sku, new Set(v.batches?.map(b => b.id) ?? [])]) ?? [])
    );
  }, [variants]);

  const productSvgRef = useRef<SVGSVGElement | null>(null);
  const variantSvgsRef = useRef<Map<string, SVGSVGElement>>(new Map());

  const previewBatch = batches?.find(b => selectedBatchIds.has(b.id));

  function buildSpecs(): StickerSpec[] {
    const specs: StickerSpec[] = [];

    if (tab === 'product' || !hasVariants) {
      if (batches && batches.length > 0) {
        batches.filter(b => selectedBatchIds.has(b.id)).forEach(b =>
          specs.push({ value: sku, label: productName, price: b.sellingPrice, metaText: metaLine(b.supplierName, b.date, b.encodedCost) })
        );
      } else {
        specs.push({ value: sku, label: productName, price, metaText: metaLine(supplierName, date, encodedCost) });
      }
    } else {
      (variants ?? []).forEach(v => {
        if (v.batches && v.batches.length > 0) {
          const vSelected = selectedVariantBatchIds.get(v.sku) ?? new Set<string>();
          v.batches.filter(b => vSelected.has(b.id)).forEach(b =>
            specs.push({ value: v.sku, label: `${productName} — ${v.label}`, price: b.sellingPrice, metaText: metaLine(b.supplierName, b.date, b.encodedCost) })
          );
        } else {
          specs.push({ value: v.sku, label: `${productName} — ${v.label}`, price: v.price, metaText: metaLine(v.supplierName, v.date, v.encodedCost) });
        }
      });
    }
    return specs;
  }

  /** Fallback when QZ Tray is unreachable: open the browser print popup (v9 path). */
  function browserPrint(specs: StickerSpec[]) {
    const imgsHtml = specs.map(s => `<img class="sticker" src="${renderStickerDataURL(s)}" />`).join('');
    const popup = window.open('', '_blank', 'width=400,height=600,scrollbars=yes,menubar=no,toolbar=no,location=no,status=no');
    if (!popup) { alert('Please allow popups for this site to enable printing.'); return; }
    popup.document.write(buildPopupHtml(imgsHtml));
    popup.document.close();
  }

  async function handlePrint() {
    const specs = buildSpecs();
    if (specs.length === 0) { alert('No stickers selected to print.'); return; }

    setPrinting(true);
    try {
      // Primary path: send native TSPL straight to the XP-365B via QZ Tray.
      await printLabels(specs);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const useBrowser = window.confirm(
        `Couldn't reach QZ Tray.\n\n${msg}\n\n` +
        `Make sure QZ Tray is installed and running on this PC (download at qz.io).\n\n` +
        `Click OK to print through the browser instead (remember to set Margins to "None"), or Cancel to stop.`,
      );
      if (useBrowser) browserPrint(specs);
    } finally {
      setPrinting(false);
    }
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
            disabled={printing}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition disabled:opacity-60"
          >
            <Printer className="w-4 h-4" />
            {printing ? 'Printing…' : 'Print'}
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {variants!.map(v => {
              const vBatches = v.batches ?? [];
              const vSelected = selectedVariantBatchIds.get(v.sku) ?? new Set<string>();
              const vPreviewBatch = vBatches.find(b => vSelected.has(b.id));
              return (
                <div key={v.sku}>
                  <SingleBarcode
                    value={v.sku}
                    label={`${productName} — ${v.label}`}
                    price={vPreviewBatch ? vPreviewBatch.sellingPrice : v.price}
                    encodedCost={vPreviewBatch ? vPreviewBatch.encodedCost : v.encodedCost}
                    supplierName={vPreviewBatch ? vPreviewBatch.supplierName : v.supplierName}
                    date={vPreviewBatch ? vPreviewBatch.date : v.date}
                    onSvgReady={el => {
                      if (el) variantSvgsRef.current.set(v.sku, el);
                      else variantSvgsRef.current.delete(v.sku);
                    }}
                  />
                  {vBatches.length > 1 && (
                    <div className="mt-2 border border-slate-200 rounded-lg overflow-hidden">
                      <div className="px-3 py-1 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        Batches
                      </div>
                      {vBatches.map(b => batchRow(
                        b,
                        vSelected.has(b.id),
                        checked => setSelectedVariantBatchIds(prev => {
                          const next = new Map(prev);
                          const ids = new Set(next.get(v.sku) ?? []);
                          if (checked) ids.add(b.id); else ids.delete(b.id);
                          next.set(v.sku, ids);
                          return next;
                        }),
                        false,
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <p className="text-xs text-slate-500 text-center mt-4">
          Print this barcode and attach it to the product
        </p>
      </div>
    </Modal>
  );
}
