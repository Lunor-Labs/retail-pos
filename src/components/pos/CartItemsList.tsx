import { Plus, Minus, X, Tag } from 'lucide-react';
import { CartItem } from '../../types';

interface CartItemsListProps {
  items: CartItem[];
  onUpdateQuantity: (index: number, change: number) => void;
  onUpdatePrice?: (index: number, newPrice: number) => void;
  onRemoveItem: (index: number) => void;
}

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" };

function maxDiscount(originalPrice: number): number {
  if (originalPrice <= 1000) return 50;
  if (originalPrice <= 2000) return 100;
  if (originalPrice <= 5000) return 200;
  return 300;
}

export function CartItemsList({ items, onUpdateQuantity, onUpdatePrice, onRemoveItem }: CartItemsListProps) {
  if (items.length === 0) return null;

  return (
    <div>
      {items.map((item, index) => {
        const subtotal = item.price * item.quantity;
        const isDiscounted = item.price < item.original_price;
        const name = item.isManual ? item.manualDescription : item.product.name;
        const maxDisc = maxDiscount(item.original_price);
        const currentDiscount = Math.max(0, item.original_price - item.price);

        return (
          <div
            key={index}
            style={{
              padding: '8px 18px',
              borderBottom: '1px solid var(--line-2)',
              borderLeft: item.isManual ? '3px solid var(--warn)' : '3px solid transparent',
              background: item.isManual ? 'color-mix(in srgb, var(--warn) 4%, transparent)' : 'transparent',
            }}
          >
            {/* ── Row 1: qty · name · subtotal · remove ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              {/* Qty stepper */}
              <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                <button
                  onClick={() => onUpdateQuantity(index, -1)}
                  style={{ width: 22, height: 22, display: 'grid', placeItems: 'center', border: 0, background: 'var(--panel-2)', borderRadius: 5, color: 'var(--ink-2)', cursor: 'default' }}
                >
                  <Minus size={10} strokeWidth={2.5} />
                </button>
                <span style={{ width: 28, textAlign: 'center', fontSize: 13, fontWeight: 700, color: 'var(--ink)', ...mono }}>
                  {item.quantity}
                </span>
                <button
                  onClick={() => onUpdateQuantity(index, 1)}
                  style={{ width: 22, height: 22, display: 'grid', placeItems: 'center', border: 0, background: 'var(--panel-2)', borderRadius: 5, color: 'var(--ink-2)', cursor: 'default' }}
                >
                  <Plus size={10} strokeWidth={2.5} />
                </button>
              </div>

              {/* Product name */}
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 5, minWidth: 0, overflow: 'hidden' }}>
                {item.isManual && (
                  <Tag size={11} strokeWidth={1.8} style={{ color: 'var(--warn)', flexShrink: 0 }} />
                )}
                <span style={{
                  fontSize: 13, fontWeight: 500, color: 'var(--ink)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {name}
                </span>
              </div>

              {/* Subtotal + remove */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', ...mono, minWidth: 60, textAlign: 'right' }}>
                  {subtotal.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <button
                  onClick={() => onRemoveItem(index)}
                  style={{ width: 20, height: 20, display: 'grid', placeItems: 'center', border: 0, background: 'transparent', color: 'var(--faint)', borderRadius: 4, cursor: 'default', flexShrink: 0 }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.background = 'color-mix(in srgb, var(--danger) 10%, transparent)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--faint)'; e.currentTarget.style.background = 'transparent'; }}
                >
                  <X size={12} strokeWidth={2.5} />
                </button>
              </div>
            </div>

            {/* ── Row 2: unit price · discount input · max hint ── */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              marginTop: 5,
              paddingLeft: 72, /* aligns with name above (stepper 72px) */
            }}>
              {/* Unit price — editable, cap enforced on blur */}
              <span style={{
                fontSize: 11.5, ...mono,
                color: isDiscounted ? 'var(--faint)' : 'var(--muted)',
                textDecoration: isDiscounted ? 'line-through' : 'none',
                flexShrink: 0,
              }}>
                LKR {item.original_price.toLocaleString()}
              </span>

              {/* Separator */}
              <span style={{ color: 'var(--line-2)', fontSize: 11, flexShrink: 0 }}>·</span>

              {/* Discount label */}
              <Tag size={10} strokeWidth={2} style={{ color: isDiscounted ? 'var(--accent-ink)' : 'var(--faint)', flexShrink: 0 }} />

              {/* Discount amount input */}
              <div style={{
                display: 'flex', alignItems: 'center', height: 24,
                borderRadius: 5, border: `1px solid ${isDiscounted ? 'var(--accent)' : 'var(--line)'}`,
                background: isDiscounted ? 'var(--accent-soft)' : 'var(--panel-2)',
                overflow: 'hidden', flexShrink: 0,
              }}>
                <span style={{
                  padding: '0 6px', fontSize: 10, color: isDiscounted ? 'var(--accent-ink)' : 'var(--muted)',
                  borderRight: `1px solid ${isDiscounted ? 'color-mix(in oklab, var(--accent) 30%, transparent)' : 'var(--line-2)'}`,
                  lineHeight: '24px', flexShrink: 0,
                }}>
                  −
                </span>
                <input
                  type="number"
                  min={0}
                  max={maxDisc}
                  step={1}
                  value={currentDiscount === 0 ? '' : currentDiscount}
                  placeholder="0"
                  onChange={e => {
                    const raw = parseFloat(e.target.value) || 0;
                    const capped = Math.min(raw, maxDisc);
                    onUpdatePrice && onUpdatePrice(index, item.original_price - capped);
                  }}
                  style={{
                    width: 44, border: 0, outline: 'none', background: 'transparent',
                    padding: '0 6px', fontSize: 11.5, textAlign: 'right', ...mono,
                    color: isDiscounted ? 'var(--accent-ink)' : 'var(--ink-2)',
                    fontWeight: isDiscounted ? 600 : 400,
                  }}
                />
              </div>

              {/* Max hint */}
              <span style={{ fontSize: 10.5, color: 'var(--faint)', flexShrink: 0 }}>
                max {maxDisc}
              </span>

              {/* Discounted price badge */}
              {isDiscounted && (
                <span style={{ marginLeft: 2, fontSize: 11.5, fontWeight: 600, color: 'var(--accent-ink)', ...mono, flexShrink: 0 }}>
                  = LKR {item.price.toLocaleString()}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
