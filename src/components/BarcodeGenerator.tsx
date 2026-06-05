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
        <p className="text-xl font-bold text-slate-900">LKR {price.toFixed(2)}</p>
      )}
      {(supplierName || date) && (
        <p className="text-sm text-slate-500 mt-1">
          {[supplierName, date].filter(Boolean).join(' · ')}
        </p>
      )}
      {encodedCost && (
        <p className="text-sm font-mono font-semibold text-slate-700 mt-0.5 tracking-widest">{encodedCost}</p>
      )}
    </div>
  );
}

export function BarcodeGenerator({ productName, sku, price, encodedCost, supplierName, date, variants, onClose }: BarcodeGeneratorProps) {
  const hasVariants = variants && variants.length > 1;
  const [tab, setTab] = useState<'product' | 'variants'>('product');

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
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
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
          @page { margin: 3mm; }
          body { visibility: hidden; background-color: white; margin: 0; }
          #barcode-content {
            visibility: visible;
            position: absolute; left: 0; top: 0;
            width: 100%; padding: 2mm;
            background-color: white; z-index: 9999;
            box-sizing: border-box;
          }
          #barcode-content * { visibility: visible; }
          .barcode-print {
            border: 1px solid #000 !important;
            padding: 4px 6px !important;
            max-width: 100% !important;
            width: 100%;
            margin: 0 0 6px;
            text-align: center;
            box-sizing: border-box;
            border-radius: 0 !important;
            page-break-inside: avoid;
          }
          .barcode-print h3 { font-size: 9pt !important; margin: 0 0 2px !important; }
          .barcode-print svg { width: 100% !important; height: auto !important; max-height: 40mm; }
          .barcode-print p { font-size: 8pt !important; margin: 1px 0 !important; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </>
  );
}
