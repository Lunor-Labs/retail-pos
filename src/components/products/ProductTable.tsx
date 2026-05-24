import { Edit, PackagePlus, Printer } from 'lucide-react';
import { ProductWithStock } from '../../types';
import { ProductImage } from '../ProductImage';

interface ProductTableProps {
  products: ProductWithStock[];
  onView: (product: ProductWithStock) => void;
  onEdit: (product: ProductWithStock) => void;
  onAddStock: (product: ProductWithStock) => void;
  onPrintBarcode: (product: ProductWithStock) => void;
  isAdmin: boolean;
}

export function ProductTable({ products, onView, onEdit, onAddStock, onPrintBarcode, isAdmin }: ProductTableProps) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ background: 'var(--panel-2)', borderBottom: '1px solid var(--line)' }}>
          {['Product', 'SKU', 'Stock', ...(isAdmin ? ['Base Price'] : []), 'Actions'].map(h => (
            <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10.5, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {products.map((product, i) => {
          const stock = product.total_stock;
          const stockColor = stock === 0 ? 'var(--danger)' : stock <= 5 ? 'var(--warn)' : 'var(--pos)';
          const meta = [
            (product as any).brand,
            product.category,
            (product as any).gender,
          ].filter(Boolean).join(' · ');

          return (
            <tr
              key={product.id}
              style={{ borderBottom: i === products.length - 1 ? 'none' : '1px solid var(--line-2)', transition: 'background .1s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--panel-2)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {/* Product name + meta — click to view details */}
              <td style={{ padding: '12px 16px', cursor: 'pointer' }} onClick={() => onView(product)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <ProductImage imageUrl={product.image_url} alt={product.name} size="sm" />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 260 }}>
                      {product.name}
                    </div>
                    {meta && (
                      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{meta}</div>
                    )}
                  </div>
                </div>
              </td>

              {/* SKU */}
              <td style={{ padding: '12px 16px' }}>
                <span className="num" style={{ fontSize: 12, color: 'var(--ink-2)' }}>{product.sku}</span>
              </td>

              {/* Stock */}
              <td style={{ padding: '12px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span className="num" style={{ fontSize: 13, fontWeight: 600, color: stockColor }}>{stock}</span>
                  <span style={{ fontSize: 11, color: 'var(--faint)' }}>units</span>
                </div>
                <div style={{ marginTop: 4, height: 3, width: 56, background: 'var(--line-2)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(100, stock * 3)}%`, background: stockColor, borderRadius: 2 }} />
                </div>
              </td>

              {/* Base price (admin only) */}
              {isAdmin && (
                <td style={{ padding: '12px 16px' }}>
                  <span className="num" style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', whiteSpace: 'nowrap' }}>
                    {(product as any).base_price > 0 ? `LKR ${((product as any).base_price).toLocaleString()}` : '—'}
                  </span>
                </td>
              )}

              {/* Actions */}
              <td style={{ padding: '12px 16px' }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  {isAdmin && (
                    <>
                      <button
                        onClick={() => onAddStock(product)}
                        title="Add Stock"
                        className="btn btn-sm"
                        style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}
                      >
                        <PackagePlus size={13} /> Stock
                      </button>
                      <button
                        onClick={() => onEdit(product)}
                        title="Edit"
                        style={{ width: 28, height: 28, padding: 0, borderRadius: 6, border: '1px solid transparent', background: 'transparent', color: 'var(--muted)', cursor: 'default', display: 'grid', placeItems: 'center', transition: 'all .1s' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--panel-2)'; e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.color = 'var(--ink)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.color = 'var(--muted)'; }}
                      >
                        <Edit size={13} />
                      </button>
                      <button
                        onClick={() => onPrintBarcode(product)}
                        title="Print Barcode"
                        style={{ width: 28, height: 28, padding: 0, borderRadius: 6, border: '1px solid transparent', background: 'transparent', color: 'var(--muted)', cursor: 'default', display: 'grid', placeItems: 'center', transition: 'all .1s' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--panel-2)'; e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.color = 'var(--ink)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.color = 'var(--muted)'; }}
                      >
                        <Printer size={13} />
                      </button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          );
        })}
        {products.length === 0 && (
          <tr>
            <td colSpan={99} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)', fontSize: 13 }}>
              No products found
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
