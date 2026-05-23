import { Plus, Minus, X, Tag } from 'lucide-react';
import { CartItem } from '../../types';

interface CartItemsListProps {
  items: CartItem[];
  onUpdateQuantity: (index: number, change: number) => void;
  onUpdatePrice?: (index: number, newPrice: number) => void;
  onRemoveItem: (index: number) => void;
}

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" };

export function CartItemsList({ items, onUpdateQuantity, onUpdatePrice, onRemoveItem }: CartItemsListProps) {
  if (items.length === 0) return null;

  return (
    <div>
      {items.map((item, index) => {
        const subtotal = item.price * item.quantity;
        const isDiscounted = item.price < item.original_price;
        const name = item.isManual ? item.manualDescription : item.product.name;

        return (
          <div
            key={index}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '7px 18px',
              borderBottom: '1px solid var(--line-2)',
              borderLeft: item.isManual ? '3px solid var(--warn)' : '3px solid transparent',
              background: item.isManual ? 'color-mix(in srgb, var(--warn) 4%, transparent)' : 'transparent',
              minWidth: 0,
            }}
          >
            {/* Qty stepper — compact, borderless */}
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

            {/* Name + unit price — flex 1 */}
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
              {/* Ghost unit price input — looks like text, editable on focus */}
              <input
                type="number"
                step="0.01"
                value={item.price}
                onChange={e => onUpdatePrice && onUpdatePrice(index, parseFloat(e.target.value) || 0)}
                title="Unit price (editable)"
                style={{
                  width: 52, border: 0, outline: 'none', background: 'transparent',
                  fontSize: 11.5, color: isDiscounted ? 'var(--accent-ink)' : 'var(--muted)',
                  textAlign: 'right', flexShrink: 0, ...mono,
                  textDecoration: isDiscounted ? 'underline dotted' : 'none',
                }}
                onFocus={e => {
                  e.currentTarget.style.color = 'var(--ink)';
                  e.currentTarget.select();
                }}
                onBlur={e => {
                  e.currentTarget.style.color = isDiscounted ? 'var(--accent-ink)' : 'var(--muted)';
                }}
              />
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
        );
      })}
    </div>
  );
}
