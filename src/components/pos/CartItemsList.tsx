import { useRef } from 'react';
import { Plus, Minus, X, Tag } from 'lucide-react';
import { CartItem } from '../../types';

interface CartItemsListProps {
  items: CartItem[];
  onUpdateQuantity: (index: number, change: number) => void;
  onSetQuantity?: (index: number, qty: number) => void;
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

export function CartItemsList({ items, onUpdateQuantity, onSetQuantity, onUpdatePrice, onRemoveItem }: CartItemsListProps) {
  // Refs for focus management across items
  const qtyRefs = useRef<(HTMLInputElement | null)[]>([]);
  const discRefs = useRef<(HTMLInputElement | null)[]>([]);

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

              {/* Qty stepper with keyboard-editable centre */}
              <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                <button
                  onClick={() => onUpdateQuantity(index, -1)}
                  tabIndex={-1}
                  style={{ width: 22, height: 22, display: 'grid', placeItems: 'center', border: 0, background: 'var(--panel-2)', borderRadius: 5, color: 'var(--ink-2)', cursor: 'default' }}
                >
                  <Minus size={10} strokeWidth={2.5} />
                </button>

                {/* Qty — ghost input, always editable */}
                <input
                  ref={el => { qtyRefs.current[index] = el; }}
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={e => {
                    const v = parseInt(e.target.value);
                    if (!isNaN(v)) onSetQuantity?.(index, v);
                  }}
                  onFocus={e => {
                    e.currentTarget.select();
                    e.currentTarget.style.background = 'var(--panel-2)';
                    e.currentTarget.style.borderRadius = '4px';
                  }}
                  onBlur={e => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.borderRadius = '0';
                    // Ensure at least 1
                    const v = parseInt(e.target.value);
                    if (isNaN(v) || v < 1) onSetQuantity?.(index, 1);
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      // Jump to this item's discount input
                      discRefs.current[index]?.focus();
                      discRefs.current[index]?.select();
                    }
                    if (e.key === 'ArrowUp') { e.preventDefault(); onUpdateQuantity(index, 1); }
                    if (e.key === 'ArrowDown') { e.preventDefault(); onUpdateQuantity(index, -1); }
                  }}
                  style={{
                    width: 28, textAlign: 'center', fontSize: 13, fontWeight: 700,
                    color: 'var(--ink)', ...mono,
                    border: 0, outline: 'none', background: 'transparent',
                    // Hide browser number spin arrows
                    MozAppearance: 'textfield' as any,
                  }}
                />

                <button
                  onClick={() => onUpdateQuantity(index, 1)}
                  tabIndex={-1}
                  style={{ width: 22, height: 22, display: 'grid', placeItems: 'center', border: 0, background: 'var(--panel-2)', borderRadius: 5, color: 'var(--ink-2)', cursor: 'default' }}
                >
                  <Plus size={10} strokeWidth={2.5} />
                </button>
              </div>

              {/* Product name */}
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 5, minWidth: 0, overflow: 'hidden' }}>
                {item.isManual && <Tag size={11} strokeWidth={1.8} style={{ color: 'var(--warn)', flexShrink: 0 }} />}
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
                  tabIndex={-1}
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
              paddingLeft: 72,
            }}>
              {/* Original price (strikethrough when discounted) */}
              <span style={{
                fontSize: 11.5, ...mono, flexShrink: 0,
                color: isDiscounted ? 'var(--faint)' : 'var(--muted)',
                textDecoration: isDiscounted ? 'line-through' : 'none',
              }}>
                LKR {item.original_price.toLocaleString()}
              </span>

              <span style={{ color: 'var(--line-2)', fontSize: 11, flexShrink: 0 }}>·</span>

              <Tag size={10} strokeWidth={2} style={{ color: isDiscounted ? 'var(--accent-ink)' : 'var(--faint)', flexShrink: 0 }} />

              {/* Discount input */}
              <div style={{
                display: 'flex', alignItems: 'center', height: 24,
                borderRadius: 5, border: `1px solid ${isDiscounted ? 'var(--accent)' : 'var(--line)'}`,
                background: isDiscounted ? 'var(--accent-soft)' : 'var(--panel-2)',
                overflow: 'hidden', flexShrink: 0,
              }}>
                <span style={{
                  padding: '0 6px', fontSize: 10,
                  color: isDiscounted ? 'var(--accent-ink)' : 'var(--muted)',
                  borderRight: `1px solid ${isDiscounted ? 'color-mix(in oklab, var(--accent) 30%, transparent)' : 'var(--line-2)'}`,
                  lineHeight: '24px', flexShrink: 0,
                }}>
                  −
                </span>
                <input
                  ref={el => { discRefs.current[index] = el; }}
                  type="number"
                  min={0}
                  max={maxDisc}
                  step={1}
                  value={currentDiscount === 0 ? '' : currentDiscount}
                  placeholder="0"
                  onChange={e => {
                    const raw = parseFloat(e.target.value) || 0;
                    onUpdatePrice?.(index, item.original_price - Math.min(raw, maxDisc));
                  }}
                  onFocus={e => e.currentTarget.select()}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      // Move to next item's discount, or next item's qty if last disc
                      const nextDisc = discRefs.current[index + 1];
                      const nextQty = qtyRefs.current[index + 1];
                      if (nextDisc) { nextDisc.focus(); nextDisc.select(); }
                      else if (nextQty) { nextQty.focus(); nextQty.select(); }
                      else { (e.currentTarget as HTMLInputElement).blur(); }
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      onUpdatePrice?.(index, item.original_price); // clear discount
                      e.currentTarget.blur();
                    }
                    if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      const next = Math.min(currentDiscount + 10, maxDisc);
                      onUpdatePrice?.(index, item.original_price - next);
                    }
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      const next = Math.max(currentDiscount - 10, 0);
                      onUpdatePrice?.(index, item.original_price - next);
                    }
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

              {/* Final price badge */}
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
