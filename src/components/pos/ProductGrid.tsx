import { useState } from 'react';
import { X } from 'lucide-react';
import { ProductWithBatches } from '../../types';
import { ProductImage } from '../ProductImage';

interface ProductGridProps {
  products: ProductWithBatches[];
  onAddToCart: (product: ProductWithBatches) => void;
  viewMode: 'grid' | 'list';
  isAdmin: boolean;
}

function StockChip({ stock }: { stock: number }) {
  if (stock === 0) return <span className="chip chip-neg" style={{ fontSize: 10.5, whiteSpace: 'nowrap' }}>Out</span>;
  if (stock <= 5) return <span className="chip chip-warn" style={{ fontSize: 10.5, whiteSpace: 'nowrap' }}>Low · {stock}</span>;
  return <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: "'JetBrains Mono',monospace", whiteSpace: 'nowrap' }}>{stock} left</span>;
}

export function ProductGrid({ products, onAddToCart, viewMode, isAdmin }: ProductGridProps) {
  const [previewImage, setPreviewImage] = useState<{ url: string; alt: string } | null>(null);

  if (products.length === 0) {
    return null;
  }

  if (viewMode === 'list') {
    return (
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {products.map((product, i) => {
          const totalStock = product.batches.reduce((s, b) => s + b.current_quantity, 0);
          const lowestPrice = product.batches.length > 0 ? Math.min(...product.batches.map(b => b.selling_price)) : 0;
          const isOut = totalStock === 0;

          return (
            <button key={product.id}
              onClick={() => !isOut && onAddToCart(product)}
              disabled={isOut}
              style={{
                width: '100%', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12,
                border: 0, borderBottom: i === products.length - 1 ? 'none' : '1px solid var(--line-2)',
                background: 'transparent', textAlign: 'left', cursor: isOut ? 'not-allowed' : 'default',
                opacity: isOut ? 0.55 : 1,
              }}
              onMouseEnter={(e) => { if (!isOut) e.currentTarget.style.background = 'var(--panel-2)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <div style={{ width: 36, height: 44, borderRadius: 5, flexShrink: 0, overflow: 'hidden', background: 'var(--panel-2)' }}>
                <ProductImage imageUrl={product.image_url} alt={product.name} size="sm" className="w-full h-full object-cover" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{product.name}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 3, fontSize: 11, color: 'var(--muted)' }}>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", color: 'var(--faint)' }}>{product.sku}</span>
                  {product.category && <span>· {product.category}</span>}
                  {isAdmin && product.batches.length > 0 && (
                    <span style={{ color: 'var(--accent-ink)', background: 'var(--accent-soft)', borderRadius: 3, padding: '0 4px', fontFamily: "'JetBrains Mono',monospace" }}>
                      {[...product.batches].sort((a, b) => new Date(b.received_date).getTime() - new Date(a.received_date).getTime())[0].markup_percentage}%
                    </span>
                  )}
                </div>
              </div>
              <StockChip stock={totalStock} />
              <span className="num" style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', minWidth: 90, textAlign: 'right', whiteSpace: 'nowrap' }}>
                LKR {lowestPrice.toFixed(2)}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  // Grid view
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
        {products.map((product) => {
          const totalStock = product.batches.reduce((s, b) => s + b.current_quantity, 0);
          const lowestPrice = product.batches.length > 0 ? Math.min(...product.batches.map(b => b.selling_price)) : 0;
          const isOut = totalStock === 0;

          return (
            <button key={product.id}
              onClick={() => !isOut && onAddToCart(product)}
              disabled={isOut}
              style={{
                background: 'var(--panel)', border: '1px solid var(--line)',
                borderRadius: 12, padding: 0, overflow: 'hidden', textAlign: 'left',
                display: 'flex', flexDirection: 'column', cursor: isOut ? 'not-allowed' : 'default',
                opacity: isOut ? 0.55 : 1, transition: 'all .12s ease',
              }}
              onMouseEnter={(e) => {
                if (!isOut) {
                  e.currentTarget.style.borderColor = 'var(--accent)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(20,22,26,0.08)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--line)';
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div style={{ aspectRatio: '4/3', position: 'relative', overflow: 'hidden', background: 'var(--panel-2)' }}
                onClick={(e) => { if (product.image_url) { e.stopPropagation(); setPreviewImage({ url: product.image_url, alt: product.name }); } }}>
                <ProductImage imageUrl={product.image_url} alt={product.name} size="lg" className="w-full h-full object-cover" />
                <div style={{ position: 'absolute', top: 6, right: 6 }}>
                  <span style={{
                    background: 'rgba(255,255,255,.9)', color: 'var(--ink-2)',
                    fontFamily: "'JetBrains Mono',monospace",
                    fontSize: 9.5, padding: '2px 5px', borderRadius: 4, fontWeight: 500,
                  }}>{product.sku}</span>
                </div>
                {isOut && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,22,26,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span className="chip chip-neg">Out of stock</span>
                  </div>
                )}
              </div>
              <div style={{ padding: '10px 12px 12px', display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                <div style={{
                  fontSize: 12.5, fontWeight: 500, color: 'var(--ink)', lineHeight: 1.3,
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                }}>{product.name}</div>
                {isAdmin && product.batches.length > 0 && (
                  <span style={{ fontSize: 10, color: 'var(--accent-ink)', background: 'var(--accent-soft)', borderRadius: 3, padding: '1px 5px', alignSelf: 'flex-start', fontFamily: "'JetBrains Mono',monospace" }}>
                    {[...product.batches].sort((a, b) => new Date(b.received_date).getTime() - new Date(a.received_date).getTime())[0].markup_percentage}% markup
                  </span>
                )}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', gap: 6 }}>
                  <span className="num" style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap' }}>
                    LKR {lowestPrice.toFixed(2)}
                  </span>
                  <StockChip stock={totalStock} />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {previewImage && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(20,22,26,0.85)', padding: 16 }}
          onClick={() => setPreviewImage(null)}
        >
          <button
            onClick={() => setPreviewImage(null)}
            style={{ position: 'absolute', top: 20, right: 20, width: 36, height: 36, borderRadius: 8, border: 0, background: 'rgba(255,255,255,0.1)', color: '#fff', display: 'grid', placeItems: 'center', cursor: 'default' }}
          >
            <X size={18} />
          </button>
          <img
            src={previewImage.url}
            alt={previewImage.alt}
            style={{ maxWidth: '90vw', maxHeight: '80vh', objectFit: 'contain', borderRadius: 12, boxShadow: '0 24px 64px rgba(20,22,26,0.4)' }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
