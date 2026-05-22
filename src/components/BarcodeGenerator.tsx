import { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import { Printer } from 'lucide-react';
import { Modal } from './ui';

export interface BarcodeVariant {
  sku: string;
  label: string;
  price?: number;
}

interface BarcodeGeneratorProps {
  productName: string;
  sku: string;
  price?: number;
  variants?: BarcodeVariant[];
  onClose: () => void;
}

function SingleBarcode({ value, label, price }: { value: string; label: string; price?: number }) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (ref.current && value) {
      try {
        JsBarcode(ref.current, value, {
          format: 'CODE128',
          width: 2,
          height: 50,
          displayValue: true,
          fontSize: 14,
          margin: 10,
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
    </div>
  );
}

export function BarcodeGenerator({ productName, sku, price, variants, onClose }: BarcodeGeneratorProps) {
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
            <SingleBarcode value={sku} label={productName} price={price} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {variants!.map(v => (
                <SingleBarcode key={v.sku} value={v.sku} label={`${productName} — ${v.label}`} price={v.price} />
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
          body { visibility: hidden; background-color: white; }
          #barcode-content {
            visibility: visible;
            position: absolute; left: 0; top: 0;
            width: 100vw; padding: 20px;
            background-color: white; z-index: 9999;
          }
          #barcode-content * { visibility: visible; }
          .barcode-print {
            border: 2px solid #000 !important;
            padding: 40px !important;
            max-width: 400px;
            margin: 0 auto 24px;
            text-align: center;
          }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </>
  );
}
