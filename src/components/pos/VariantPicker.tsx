import { useState, useRef, useEffect } from 'react';
import { X, ChevronRight } from 'lucide-react';
import { Product, ProductVariant, ProductBatch, VariantWithStock } from '../../types';

interface VariantPickerProps {
  product: Product;
  variants: VariantWithStock[];
  /** When set (e.g. a scan pinpointed one variant), open jumped straight to its batch step. */
  initialVariantId?: string | null;
  onSelect: (variant: ProductVariant, batch: ProductBatch, quantity: number) => void;
  onClose: () => void;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function VariantPicker({ product, variants, initialVariantId, onSelect, onClose }: VariantPickerProps) {
  const preselected = initialVariantId ? variants.find(v => v.id === initialVariantId) ?? null : null;
  const preselectedBatches = preselected
    ? preselected.batches.filter(b => b.current_quantity > 0)
    : [];

  const [selectedVariant, setSelectedVariant] = useState<VariantWithStock | null>(preselected);
  const [selectedBatch, setSelectedBatch] = useState<ProductBatch | null>(preselectedBatches.length === 1 ? preselectedBatches[0] : null);
  const [quantity, setQuantity] = useState<number>(1);

  // Keyboard navigation state
  const [focusedVariantIdx, setFocusedVariantIdx] = useState(0);
  const [focusedBatchIdx, setFocusedBatchIdx] = useState(0);
  const [hoveredVariantIdx, setHoveredVariantIdx] = useState(-1);
  const [hoveredBatchIdx, setHoveredBatchIdx] = useState(-1);

  const variantItemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const batchItemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const isDecimal = product.unit === 'yard' || product.unit === 'meter';
  const unitLabel = product.unit === 'yard' ? 'yd' : product.unit === 'meter' ? 'm' : product.unit === 'pack' ? 'pk' : 'pc';

  const activeVariants = variants.filter(v => v.active && v.total_stock > 0);

  function activeBatches(variant: VariantWithStock): ProductBatch[] {
    return variant.batches
      .filter(b => b.current_quantity > 0)
      .sort((a, b) => new Date(a.received_date).getTime() - new Date(b.received_date).getTime());
  }

  function handleVariantClick(variant: VariantWithStock) {
    const batches = activeBatches(variant);
    setSelectedVariant(variant);
    setSelectedBatch(batches.length === 1 ? batches[0] : null);
    setQuantity(1);
  }

  const handleConfirm = () => {
    if (!selectedVariant || !selectedBatch || quantity <= 0) return;
    onSelect(selectedVariant, selectedBatch, quantity);
  };

  const step = !selectedVariant ? 'variant' : !selectedBatch ? 'batch' : 'qty';

  // Reset focused indices when step changes
  useEffect(() => {
    if (step === 'variant') setFocusedVariantIdx(0);
    if (step === 'batch') setFocusedBatchIdx(0);
  }, [step]);

  // Scroll focused variant into view
  useEffect(() => {
    if (step === 'variant' && variantItemRefs.current[focusedVariantIdx]) {
      variantItemRefs.current[focusedVariantIdx]!.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [focusedVariantIdx, step]);

  // Scroll focused batch into view
  useEffect(() => {
    if (step === 'batch' && batchItemRefs.current[focusedBatchIdx]) {
      batchItemRefs.current[focusedBatchIdx]!.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [focusedBatchIdx, step]);

  // Global keyboard handler — runs while picker is open
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape: go back one step or close
      if (e.key === 'Escape') {
        e.preventDefault();
        if (step === 'qty') {
          setSelectedBatch(null);
        } else if (step === 'batch') {
          setSelectedVariant(null);
          setSelectedBatch(null);
        } else {
          onClose();
        }
        return;
      }

      if (step === 'variant') {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setFocusedVariantIdx(i => Math.min(activeVariants.length - 1, i + 1));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setFocusedVariantIdx(i => Math.max(0, i - 1));
        } else if (e.key === 'Enter') {
          const v = activeVariants[focusedVariantIdx];
          if (v) { e.preventDefault(); handleVariantClick(v); }
        }
        return;
      }

      if (step === 'batch' && selectedVariant) {
        const batches = activeBatches(selectedVariant);
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setFocusedBatchIdx(i => Math.min(batches.length - 1, i + 1));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setFocusedBatchIdx(i => Math.max(0, i - 1));
        } else if (e.key === 'Enter') {
          const b = batches[focusedBatchIdx];
          if (b) { e.preventDefault(); setSelectedBatch(b); }
        }
        return;
      }

      if (step === 'qty') {
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setQuantity(q => parseFloat((q + (isDecimal ? 0.1 : 1)).toFixed(1)));
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          setQuantity(q => Math.max(isDecimal ? 0.1 : 1, parseFloat((q - (isDecimal ? 0.1 : 1)).toFixed(1))));
        } else if (e.key === 'Enter') {
          e.preventDefault();
          handleConfirm();
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [step, focusedVariantIdx, focusedBatchIdx, activeVariants, selectedVariant, quantity, isDecimal, onClose]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,12,15,0.55)', backdropFilter: 'blur(4px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--panel)', borderRadius: 14, width: '100%', maxWidth: 480, boxShadow: '0 24px 64px rgba(0,0,0,0.28)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{product.name}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
              {[(product as any).brand, product.category].filter(Boolean).join(' · ')}
              {' · '}
              {step === 'variant' ? 'Select variant' : step === 'batch' ? 'Select batch' : 'Confirm quantity'}
              <span style={{ marginLeft: 8, color: 'var(--faint)', fontSize: 11 }}>↑↓ navigate · Enter select · Esc back</span>
            </div>
          </div>
          <button onClick={onClose} style={{ border: 0, background: 'transparent', color: 'var(--muted)', cursor: 'pointer', padding: 4, lineHeight: 0, borderRadius: 6 }}>
            <X size={18} />
          </button>
        </div>

        {/* Breadcrumb trail */}
        {step !== 'variant' && (
          <div style={{ padding: '8px 18px', borderBottom: '1px solid var(--line-2)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <button onClick={() => { setSelectedVariant(null); setSelectedBatch(null); }} style={{ border: 0, background: 'transparent', color: 'var(--accent)', cursor: 'pointer', padding: 0, fontSize: 12, fontWeight: 500 }}>
              Variants
            </button>
            <ChevronRight size={12} style={{ color: 'var(--faint)' }} />
            <span style={{ color: step === 'batch' ? 'var(--ink)' : 'var(--accent)', fontWeight: step === 'batch' ? 600 : 500, cursor: step === 'qty' ? 'pointer' : 'default' }}
              onClick={() => step === 'qty' && setSelectedBatch(null)}>
              {[selectedVariant!.size, selectedVariant!.color].filter(Boolean).join(' · ') || selectedVariant!.sku}
            </span>
            {step === 'qty' && (
              <>
                <ChevronRight size={12} style={{ color: 'var(--faint)' }} />
                <span style={{ color: 'var(--ink)', fontWeight: 600 }}>
                  {fmtDate(selectedBatch!.received_date)} · LKR {selectedBatch!.selling_price.toLocaleString()}
                </span>
              </>
            )}
          </div>
        )}

        {/* Step 1 — Variant list */}
        {step === 'variant' && (
          <div style={{ maxHeight: 340, overflowY: 'auto', padding: '8px 10px' }} className="custom-scrollbar">
            {activeVariants.length === 0 ? (
              <div style={{ padding: '32px 0', textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>No stock available</div>
            ) : activeVariants.map((v, idx) => {
              const batches = activeBatches(v);
              const price = batches[0]?.selling_price;
              const isFocused = focusedVariantIdx === idx;
              const isHovered = hoveredVariantIdx === idx;
              return (
                <button key={v.id}
                  ref={el => { variantItemRefs.current[idx] = el; }}
                  onClick={() => handleVariantClick(v)}
                  onMouseEnter={() => setHoveredVariantIdx(idx)}
                  onMouseLeave={() => setHoveredVariantIdx(-1)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 12px', borderRadius: 9,
                    border: isFocused ? '1px solid var(--accent)' : '1px solid var(--line)',
                    background: (isFocused || isHovered) ? 'var(--accent-soft)' : 'var(--panel-2)',
                    marginBottom: 6, cursor: 'pointer', textAlign: 'left',
                    outline: 'none',
                    boxShadow: isFocused ? '0 0 0 2px var(--accent-soft)' : 'none',
                    transition: 'border-color .1s, background .1s',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>
                      {[v.size, v.color].filter(Boolean).join(' · ') || v.sku}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>
                      {v.total_stock} {unitLabel} in stock
                      {batches.length > 1 && <span style={{ marginLeft: 6, color: 'var(--warn)', fontWeight: 500 }}>{batches.length} batches</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {price !== undefined && (
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                        LKR {price.toLocaleString()}
                      </span>
                    )}
                    <ChevronRight size={14} style={{ color: 'var(--faint)' }} />
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Step 2 — Batch list */}
        {step === 'batch' && selectedVariant && (
          <div style={{ maxHeight: 340, overflowY: 'auto', padding: '8px 10px' }} className="custom-scrollbar">
            {activeBatches(selectedVariant).map((batch, idx) => {
              const isFocused = focusedBatchIdx === idx;
              const isHovered = hoveredBatchIdx === idx;
              return (
                <button key={batch.id}
                  ref={el => { batchItemRefs.current[idx] = el; }}
                  onClick={() => setSelectedBatch(batch)}
                  onMouseEnter={() => setHoveredBatchIdx(idx)}
                  onMouseLeave={() => setHoveredBatchIdx(-1)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 12px', borderRadius: 9,
                    border: isFocused ? '1px solid var(--accent)' : '1px solid var(--line)',
                    background: (isFocused || isHovered) ? 'var(--accent-soft)' : 'var(--panel-2)',
                    marginBottom: 6, cursor: 'pointer', textAlign: 'left',
                    outline: 'none',
                    boxShadow: isFocused ? '0 0 0 2px var(--accent-soft)' : 'none',
                    transition: 'border-color .1s, background .1s',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                      Received {fmtDate(batch.received_date)}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>
                      {batch.current_quantity} {unitLabel} remaining · #{batch.batch_number}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>
                      LKR {batch.selling_price.toLocaleString()}
                    </span>
                    <ChevronRight size={14} style={{ color: 'var(--faint)' }} />
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Step 3 — Quantity */}
        {step === 'qty' && selectedBatch && (
          <div style={{ padding: '20px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>Quantity ({unitLabel})</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{selectedBatch.current_quantity} available</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <button
                onClick={() => setQuantity(q => Math.max(isDecimal ? 0.1 : 1, parseFloat((q - (isDecimal ? 0.1 : 1)).toFixed(1))))}
                style={{ width: 38, height: 38, borderRadius: 8, border: '1px solid var(--line)', background: 'var(--panel-2)', fontSize: 18, cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--ink)', fontWeight: 500 }}
              >−</button>
              <input
                type="number"
                min={isDecimal ? 0.1 : 1}
                step={isDecimal ? 0.1 : 1}
                value={quantity}
                onChange={e => setQuantity(isDecimal ? parseFloat(e.target.value) || 0 : parseInt(e.target.value) || 0)}
                // Prevent browser's built-in number spinning from doubling with our global handler
                onKeyDown={e => {
                  if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Enter') e.preventDefault();
                }}
                style={{ flex: 1, height: 38, textAlign: 'center', border: '1px solid var(--accent)', borderRadius: 8, fontSize: 16, fontWeight: 600, color: 'var(--ink)', background: 'var(--panel)', outline: 'none' }}
                autoFocus
              />
              <button
                onClick={() => setQuantity(q => parseFloat((q + (isDecimal ? 0.1 : 1)).toFixed(1)))}
                style={{ width: 38, height: 38, borderRadius: 8, border: '1px solid var(--line)', background: 'var(--panel-2)', fontSize: 18, cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--ink)', fontWeight: 500 }}
              >+</button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                Total: <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>
                  LKR {(selectedBatch.selling_price * quantity).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <button
                onClick={handleConfirm}
                disabled={quantity <= 0 || quantity > selectedBatch.current_quantity}
                className="btn btn-primary"
                style={{ height: 38, fontSize: 13.5, minWidth: 130 }}
              >
                Add to Cart
              </button>
            </div>
            <div style={{ marginTop: 10, fontSize: 11, color: 'var(--faint)', textAlign: 'center' }}>
              ↑↓ adjust quantity · Enter add to cart · Esc back
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
