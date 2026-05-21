import { Edit, Eye, Printer, PackagePlus } from 'lucide-react';
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

export function ProductTable({
  products,
  onView,
  onEdit,
  onAddStock,
  onPrintBarcode,
  isAdmin,
}: ProductTableProps) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ background: 'var(--panel-2)', borderBottom: '1px solid var(--line)' }}>
          {['Product', 'SKU / Brand', 'Category', 'Stock', 'Unit', ...(isAdmin ? ['Cost', 'Markup'] : []), 'Actions'].map(h => (
            <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10.5, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {products.map((product, i) => {
          const latestBatch = product.batches && product.batches.length > 0
            ? [...product.batches].sort((a, b) => new Date(b.received_date).getTime() - new Date(a.received_date).getTime())[0]
            : null;
          const stock = product.total_stock;
          const stockColor = stock === 0 ? 'var(--danger)' : stock <= 5 ? 'var(--warn)' : 'var(--pos)';
          const stockChipClass = stock === 0 ? 'chip chip-neg' : stock <= 10 ? 'chip chip-warn' : 'chip chip-pos';

          return (
            <tr key={product.id} style={{ borderBottom: i === products.length - 1 ? 'none' : '1px solid var(--line-2)', transition: 'background .1s' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--panel-2)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
              <td style={{ padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <ProductImage imageUrl={product.image_url} alt={product.name} size="sm" />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>{product.name}</div>
                    {product.description && (
                      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{product.description}</div>
                    )}
                  </div>
                </div>
              </td>
              <td style={{ padding: '12px 14px' }}>
                <div className="num" style={{ fontSize: 12, color: 'var(--ink-2)' }}>{product.sku}</div>
                <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 2 }}>{(product as any).brand || ''}</div>
              </td>
              <td style={{ padding: '12px 14px', fontSize: 12.5, color: 'var(--ink-2)' }}>{product.category || '—'}</td>
              <td style={{ padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span className="num" style={{ fontSize: 13, fontWeight: 600, color: stockColor }}>{stock}</span>
                </div>
                <div style={{ marginTop: 4, height: 3, width: 56, background: 'var(--line-2)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(100, stock * 5)}%`, background: stockColor, borderRadius: 2 }} />
                </div>
              </td>
              <td style={{ padding: '12px 14px', fontSize: 12.5, color: 'var(--ink-2)' }}>{product.unit}</td>
              {isAdmin && (
                <>
                  <td style={{ padding: '12px 14px' }}>
                    <span className="num" style={{ fontSize: 12.5, color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>
                      {latestBatch ? `LKR ${latestBatch.cost_price.toFixed(2)}` : '—'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    {latestBatch ? (
                      <span className="chip chip-neutral num" style={{ fontSize: 10.5 }}>{latestBatch.markup_percentage}%</span>
                    ) : '—'}
                  </td>
                </>
              )}
              <td style={{ padding: '12px 14px' }}>
                <div style={{ display: 'flex', gap: 2 }}>
                  {[
                    { fn: () => onView(product), Icon: Eye, title: 'View' },
                    ...(isAdmin ? [
                      { fn: () => onAddStock(product), Icon: PackagePlus, title: 'Add Stock' },
                      { fn: () => onEdit(product), Icon: Edit, title: 'Edit' },
                      { fn: () => onPrintBarcode(product), Icon: Printer, title: 'Print Barcode' },
                    ] : []),
                  ].map(({ fn, Icon, title }) => (
                    <button key={title} onClick={fn} title={title} style={{ width: 28, height: 28, padding: 0, borderRadius: 6, border: '1px solid transparent', background: 'transparent', color: 'var(--muted)', cursor: 'default', display: 'grid', placeItems: 'center', transition: 'all .1s' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--panel-2)'; e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.color = 'var(--ink)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.color = 'var(--muted)'; }}>
                      <Icon size={14} />
                    </button>
                  ))}
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
      {products.length === 0 && (
        <tfoot>
          <tr>
            <td colSpan={99} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)', fontSize: 13 }}>No products found</td>
          </tr>
        </tfoot>
      )}
    </table>
  );
}
