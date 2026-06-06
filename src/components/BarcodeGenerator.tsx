import { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import { Printer } from 'lucide-react';
import { Modal } from './ui';

export interface BarcodeVariant {
  sku: string;
  label: string;
  price?: number;
  encodedCost?: string;
  supplierName?: string;
  date?: string;
}

interface BarcodeGeneratorProps {
  productName: string;
  sku: string;
  price?: number;
  encodedCost?: string;
  supplierName?: string;
  date?: string;
  variants?: BarcodeVariant[];
  onClose: () => void;
}

function SingleBarcode({ value, label, price, encodedCost, supplierName, date }: {
  value: string; label: string; price?: number;
  encodedCost?: string; supplierName?: string; date?: string;
}) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (ref.current && value) {
      try {
        JsBarcode(ref.current, value, {
          format: 'CODE128',
          width: 1.5,
          height: 40,
          displayValue: true,
          fontSize: 11,
          margin: 5,
        });
      } catch (e) {
        console.error('Barcode error:', e);
      }
    }
  }, [value]);

  return (
    <div className="barcode-print bg-white border-2 border-dashed border-slate-300 rounded-lg p-6 text-center">
      <h3 className="text-lg font-bold text-slate-900 mb-1">{label}</h3>
      <div className="flex justify-center mb-4">
        <svg ref={ref} className="max-w-full"></svg>
      </div>
      {price !== undefined && (
        <p className="print-price text-xl font-bold text-slate-900">LKR {price.toFixed(2)}</p>
      )}
      {(supplierName || date) && (
        <p className="print-meta text-sm text-slate-500 mt-1">
          {[supplierName, date].filter(Boolean).join(' · ')}
        </p>
      )}
      {encodedCost && (
        <p className="print-meta text-sm font-mono font-semibold text-slate-700 mt-0.5 tracking-widest">{encodedCost}</p>
      )}
    </div>
  );
}

export function BarcodeGenerator({ productName, sku, price, encodedCost, supplierName, date, variants, onClose }: BarcodeGeneratorProps) {
  const hasVariants = variants && variants.length > 1;
  const [tab, setTab] = useState<'product' | 'variants'>('product');
  const [qty, setQty] = useState(1);

  return (
    <>
      <Modal isOpen onClose={onClose} title="Print Barcode">
        <div className="p-6" id="barcode-content">
          <div className="flex justify-end mb-4 print:hidden">
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
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-600 font-medium">Qty</label>
              <input
                type="number"
                min={1}
                max={100}
                value={qty}
                onChange={e => setQty(Math.max(1, Math.min(100, Number(e.target.value))))}
                className="w-16 px-2 py-1.5 border border-slate-300 rounded-lg text-sm text-center"
              />
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition"
              >
                <Printer className="w-4 h-4" />
                Print
              </button>
            </div>
          </div>

          {tab === 'product' || !hasVariants ? (
            <SingleBarcode value={sku} label={productName} price={price} encodedCost={encodedCost} supplierName={supplierName} date={date} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {variants!.map(v => (
                <SingleBarcode key={v.sku} value={v.sku} label={`${productName} — ${v.label}`} price={v.price} encodedCost={v.encodedCost} supplierName={v.supplierName} date={v.date} />
              ))}
            </div>
          )}

          <p className="text-xs text-slate-500 text-center mt-4 print:hidden">
            Print this barcode and attach it to the product
          </p>
        </div>
      </Modal>

      <style>{`
        @media print {
          @page { size: 38mm 25mm; margin: 0; }
          body { visibility: hidden; background-color: white; margin: 0; }
          #barcode-content {
            visibility: visible;
            position: absolute; left: 0; top: 0;
            background-color: white; z-index: 9999;
            padding: 0; margin: 0;
          }
          #barcode-content * { visibility: visible; }
          .barcode-print {
            width: 38mm;
            height: 25mm;
            padding: 1mm;
            box-sizing: border-box;
            overflow: hidden;
            page-break-after: always;
            border: none !important;
            border-radius: 0 !important;
            background: white;
            display: flex;
            flex-direction: column;
            justify-content: center;
            text-align: center;
          }
          .barcode-print h3 {
            font-size: 7pt !important;
            font-weight: bold !important;
            margin: 0 0 1px !important;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .barcode-print svg {
            width: 100% !important;
            height: auto !important;
            max-height: 28pt;
            display: block;
          }
          .barcode-print .print-price {
            font-size: 8pt !important;
            font-weight: bold !important;
            margin: 1px 0 0 !important;
          }
          .barcode-print .print-meta {
            font-size: 6pt !important;
            margin: 0 !important;
          }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </>
  );
}
