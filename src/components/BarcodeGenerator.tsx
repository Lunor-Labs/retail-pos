import { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import { Printer } from 'lucide-react';
import { Modal } from './ui';

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

function buildStickerHtml(
  svgStr: string,
  label: string,
  price?: number,
  supplierName?: string,
  date?: string,
  encodedCost?: string,
): string {
  const metaParts = [supplierName, date, encodedCost].filter(Boolean);
  return `
    <div class="sticker">
      <div class="name">${label}</div>
      <div class="svg-wrap">${svgStr}</div>
      ${price !== undefined ? `<div class="price">LKR ${price.toFixed(2)}</div>` : ''}
      ${metaParts.length ? `<div class="meta">${metaParts.join(' · ')}</div>` : ''}
    </div>`;
}

function buildPopupHtml(stickersHtml: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page { size: 38mm 25mm; margin: 0; }
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
  .sticker {
    width: 38mm;
    height: 25mm;
    padding: 1mm;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    text-align: center;
    break-after: page;
    page-break-after: always;
  }
  .name {
    font-size: 6.5pt;
    font-weight: bold;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    width: 100%;
    line-height: 1.1;
    flex-shrink: 0;
  }
  .svg-wrap {
    flex: 1;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    min-height: 0;
  }
  .svg-wrap svg { display: block; width: 100% !important; height: auto !important; max-height: 100%; }
  .price {
    font-size: 7.5pt; font-weight: bold; line-height: 1.1;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    width: 100%; flex-shrink: 0;
  }
  .meta {
    font-size: 5.5pt; color: #333; line-height: 1.1;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    width: 100%; flex-shrink: 0;
  }
  @media print { .toolbar { display: none !important; } .content { margin-top: 0 !important; } }
</style>
</head>
<body>
<div class="toolbar">
  <span class="title">Barcode Stickers</span>
  <span class="tip">In print dialog: set Margins to "None" for correct label alignment</span>
  <button onclick="window.print()">Print</button>
</div>
<div class="content">
${stickersHtml}
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

  function handlePrint() {
    const serializer = new XMLSerializer();
    let stickersHtml = '';

    if (tab === 'product' || !hasVariants) {
      const svgEl = productSvgRef.current;
      if (!svgEl) return;
      const svgStr = serializer.serializeToString(svgEl);

      if (batches && batches.length > 0) {
        const selected = batches.filter(b => selectedBatchIds.has(b.id));
        stickersHtml = selected.map(b =>
          buildStickerHtml(svgStr, productName, b.sellingPrice, b.supplierName, b.date, b.encodedCost)
        ).join('');
      } else {
        stickersHtml = buildStickerHtml(svgStr, productName, price, supplierName, date, encodedCost);
      }
    } else {
      stickersHtml = (variants ?? []).flatMap(v => {
        const svgEl = variantSvgsRef.current.get(v.sku);
        if (!svgEl) return [];
        const svgStr = serializer.serializeToString(svgEl);

        if (v.batches && v.batches.length > 0) {
          const vSelected = selectedVariantBatchIds.get(v.sku) ?? new Set<string>();
          return v.batches
            .filter(b => vSelected.has(b.id))
            .map(b => buildStickerHtml(svgStr, `${productName} — ${v.label}`, b.sellingPrice, b.supplierName, b.date, b.encodedCost));
        }
        return [buildStickerHtml(svgStr, `${productName} — ${v.label}`, v.price, v.supplierName, v.date, v.encodedCost)];
      }).join('');
    }

    const popup = window.open('', '_blank', 'width=400,height=600,scrollbars=yes,menubar=no,toolbar=no,location=no,status=no');
    if (!popup) { alert('Please allow popups for this site to enable printing.'); return; }
    popup.document.write(buildPopupHtml(stickersHtml));
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
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition"
          >
            <Printer className="w-4 h-4" />
            Print
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
