import { useState } from 'react';
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
  const [discountOpen, setDiscountOpen] = useState<Set<number>>(new Set());

  function toggleDiscount(index: number) {
    setDiscountOpen(prev => {
      const s = new Set(prev);
      s.has(index) ? s.delete(index) : s.add(index);
      return s;
    });
  }

  if (items.length === 0) return null;

  return (
    <div>
      {items.map((item, index) => {
        const subtotal = item.price * item.quantity;
        const isDiscounted = item.price < item.original_price;
        const name = item.isManual ? item.manualDescription : item.product.name;
        const maxDisc = maxDiscount(item.original_price);
        const currentDiscount = Math.max(0, item.original_price - item.price);
        const isOpen = discountOpen.has(index);

        return (
          <div key={index}>
            {/* Main row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '7px 18px',
                borderBottom: isOpen ? 'none' : '1px solid var(--line-2)',
                borderLeft: item.isManual ? '3px solid var(--warn)' : '3px solid transparent',
                background: item.isManual ? 'color-mix(in srgb, var(--warn) 4%, transparent)' : 'transparent',
                minWidth: 0,
              }}
            >
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

              {/* Name + unit price */}
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4, minWidth: 0, overflow: 'hidden' }}>
                {item.isManual && (
                  <Tag size={11} strokeWidth={1.8} style={{ color: 'var(--warn)', flexShrink: 0 }} />
                )}
                <span style={{
                  fontSize: 13, fontWeight: 500, color: 'var(--ink)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 1,
                }}>
                  {name}
                </span>
                <span style={{ color: 'var(--line)', flexShrink: 0, fontSize: 11 }}>·</span>
                {/* Price input — cap enforced on blur */}
                <input
                  type="number"
                  step="0.01"
                  value={item.price}
                  onChange={e => onUpdatePrice && onUpdatePrice(index, parseFloat(e.target.value) || 0)}
                  title={`Unit price · max discount LKR ${maxDisc}`}
                  style={{
                    width: 56, border: 0, outline: 'none', background: 'transparent',
                    fontSize: 11.5, color: isDiscounted ? 'var(--accent-ink)' : 'var(--muted)',
                    textAlign: 'right', flexShrink: 0, ...mono,
                    textDecoration: isDiscounted ? 'underline dotted' : 'none',
                  }}
                  onFocus={e => {
                    e.currentTarget.style.color = 'var(--ink)';
                    e.currentTarget.select();
                  }}
                  onBlur={e => {
                    // Enforce cap — silently clamp if staff typed below minimum
                    const entered = parseFloat(e.target.value) || 0;
                    const minAllowed = item.original_price - maxDisc;
                    if (entered < minAllowed) {
                      onUpdatePrice && onUpdatePrice(index, minAllowed);
                    }
                    const discounted = item.price < item.original_price;
                    e.currentTarget.style.color = discounted ? 'var(--accent-ink)' : 'var(--muted)';
                  }}
                />
              </div>

              {/* Subtotal + remove + discount toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
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
                {/* Discount toggle */}
                <button
                  onClick={() => toggleDiscount(index)}
                  title="Apply discount"
                  style={{
                    width: 20, height: 20, display: 'grid', placeItems: 'center',
                    border: 0, background: isDiscounted || isOpen ? 'var(--accent-soft)' : 'transparent',
                    color: isDiscounted || isOpen ? 'var(--accent-ink)' : 'var(--faint)',
                    borderRadius: 4, cursor: 'default', flexShrink: 0,
                  }}
                  onMouseEnter={e => { if (!isDiscounted && !isOpen) { e.currentTarget.style.color = 'var(--ink-2)'; e.currentTarget.style.background = 'var(--panel-2)'; } }}
                  onMouseLeave={e => { if (!isDiscounted && !isOpen) { e.currentTarget.style.color = 'var(--faint)'; e.currentTarget.style.background = 'transparent'; } }}
                >
                  <Tag size={11} strokeWidth={2} />
                </button>
              </div>
            </div>

            {/* Discount row */}
            {isOpen && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '5px 18px 8px 72px',
                borderBottom: '1px solid var(--line-2)',
                background: 'color-mix(in oklab, var(--accent) 4%, var(--panel))',
              }}>
                <Tag size={11} strokeWidth={1.8} style={{ color: 'var(--accent-ink)', flexShrink: 0 }} />
                <span style={{ fontSize: 11.5, color: 'var(--muted)', flexShrink: 0 }}>Discount</span>
                {/* Discount amount input */}
                <div style={{
                  display: 'flex', alignItems: 'center', height: 26,
                  borderRadius: 6, border: '1px solid var(--line)', background: 'var(--panel)', overflow: 'hidden',
                }}>
                  <span style={{ padding: '0 7px', fontSize: 10.5, color: 'var(--muted)', borderRight: '1px solid var(--line-2)', lineHeight: '26px', flexShrink: 0 }}>LKR</span>
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
                      width: 52, border: 0, outline: 'none', background: 'transparent',
                      padding: '0 7px', fontSize: 12, textAlign: 'right', ...mono,
                      color: currentDiscount > 0 ? 'var(--accent-ink)' : 'var(--ink)',
                    }}
                  />
                </div>
                <span style={{ fontSize: 11, color: 'var(--faint)', flexShrink: 0 }}>
                  max LKR {maxDisc}
                </span>
                {isDiscounted && (
                  <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--muted)', flexShrink: 0, ...mono }}>
                    <span style={{ textDecoration: 'line-through', color: 'var(--faint)' }}>{item.original_price.toLocaleString()}</span>
                    {' → '}
                    <span style={{ color: 'var(--accent-ink)', fontWeight: 600 }}>{item.price.toLocaleString()}</span>
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
