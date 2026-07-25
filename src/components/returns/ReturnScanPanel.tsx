import { useEffect, useRef, useState } from 'react';
import { Search, X, ChevronRight, AlertTriangle, PackageCheck } from 'lucide-react';
import { productService, variantService } from '../../services';
import type { ProductBatch, VariantWithStock } from '../../types';

/** One item the customer is handing back, tied to the batch it is going back into. */
export interface ReturnLine {
    key: string;
    batch_id: string;
    batch_number: string;
    /** Price on the label for this batch — the ceiling for the refund. */
    tag_price: number;
    product_name: string;
    variant_label: string;
    sku: string;
    unit: string;
    quantity: number;
    amount: number;
}

interface ReturnScanPanelProps {
    lines: ReturnLine[];
    onChange: (lines: ReturnLine[]) => void;
    disabled?: boolean;
}

function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Scan an item, choose which batch it came from, and it becomes a return line.
 *
 * The batch choice does two jobs at once: it decides where the stock goes back to —
 * which keeps cost prices and therefore margins right — and it sets the refund, since
 * labels are printed per batch and so carry that batch's price. That is what makes a
 * return possible without the original bill.
 *
 * A barcode identifies a variant, not an individual unit, so there is no way to tell
 * which past sale this particular item came from. The desk picks the batch whose
 * price matches the tag in their hand.
 */
export function ReturnScanPanel({ lines, onChange, disabled = false }: ReturnScanPanelProps) {
    const [code, setCode] = useState('');
    const [searching, setSearching] = useState(false);
    const [error, setError] = useState('');

    // The variant a scan resolved to, waiting for its batch to be chosen.
    const [pending, setPending] = useState<{ productName: string; unit: string; variant: VariantWithStock } | null>(null);

    // A product-level code was scanned, so the size/colour still has to be chosen.
    // Labels are not always printed per variant, so this is a normal path, not an error.
    const [pendingProduct, setPendingProduct] = useState<
        { name: string; unit: string; variants: VariantWithStock[] } | null
    >(null);

    const scanRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => { scanRef.current?.focus(); }, []);

    async function handleScan(raw: string) {
        const query = raw.trim();
        if (!query) return;

        setSearching(true);
        setError('');
        try {
            const product = await productService.findByBarcode(query);
            if (!product) {
                setError(`Nothing found for "${query}". Check the code and try again.`);
                return;
            }

            const variants = await variantService.getVariantsForProduct(product.id);
            const unit = product.unit ?? 'piece';

            if (variants.length === 0) {
                setError('This product has no sizes/colours on record, so there is nothing to take back.');
                return;
            }

            // The scanned code belongs to one variant — that pinpoints it exactly.
            const scanned = variants.find(v => v.sku === query || v.barcode === query);
            if (scanned) {
                if (scanned.batches.length === 0) {
                    setError('This item has no stock batches on record, so there is no price to refund against.');
                    return;
                }
                setPending({ productName: product.name, unit, variant: scanned });
                setCode('');
                return;
            }

            // Otherwise it is a product-level code. Labels are sometimes printed from
            // the product rather than the variant, so rather than refusing, let the
            // desk say which size/colour is in their hand.
            const withStock = variants.filter(v => v.batches.length > 0);

            if (withStock.length === 0) {
                setError('None of the sizes/colours for this product have stock batches on record.');
                return;
            }

            if (withStock.length === 1) {
                // Only one possibility, so there is nothing to ask.
                setPending({ productName: product.name, unit, variant: withStock[0] });
                setCode('');
                return;
            }

            setPendingProduct({ name: product.name, unit, variants: withStock });
            setCode('');
        } catch {
            setError('Could not look that code up. Check the connection and try again.');
        } finally {
            setSearching(false);
        }
    }

    function addLine(batch: ProductBatch) {
        if (!pending) return;
        const v = pending.variant;
        const label = [v.size, v.color].filter(Boolean).join(' · ');

        onChange([
            ...lines,
            {
                key: `${batch.id}-${Date.now()}`,
                batch_id: batch.id,
                batch_number: batch.batch_number,
                tag_price: batch.selling_price,
                product_name: pending.productName,
                variant_label: label,
                sku: v.sku,
                unit: pending.unit,
                quantity: 1,
                amount: batch.selling_price,
            },
        ]);
        setPending(null);
        setPendingProduct(null);
        scanRef.current?.focus();
    }

    function updateLine(key: string, patch: Partial<ReturnLine>) {
        onChange(lines.map(l => (l.key === key ? { ...l, ...patch } : l)));
    }

    function removeLine(key: string) {
        onChange(lines.filter(l => l.key !== key));
    }

    const isDecimal = (unit: string) => unit === 'yard' || unit === 'meter';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Scan box */}
            <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 40, padding: '0 12px', borderRadius: 9, background: 'var(--panel-2)', border: '1px solid var(--line)' }}>
                    <Search size={15} strokeWidth={1.7} style={{ color: 'var(--muted)', flexShrink: 0 }} />
                    <input
                        ref={scanRef}
                        value={code}
                        disabled={disabled || searching}
                        onChange={e => setCode(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter') { e.preventDefault(); handleScan(code); }
                        }}
                        placeholder="Scan the item's barcode, or type its code"
                        style={{ flex: 1, border: 0, outline: 'none', background: 'transparent', fontSize: 13, color: 'var(--ink)' }}
                    />
                    {searching && <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>Looking up…</span>}
                </div>
                {error && (
                    <div style={{ marginTop: 8, padding: '9px 11px', borderRadius: 7, background: 'color-mix(in oklab, var(--danger) 10%, var(--panel-2))', color: 'var(--danger)', fontSize: 12, display: 'flex', alignItems: 'flex-start', gap: 7 }}>
                        <AlertTriangle size={13} strokeWidth={1.8} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
                    </div>
                )}
            </div>

            {/* Size/colour step — only when a product-level code was scanned */}
            {pendingProduct && (
                <div style={{ borderRadius: 9, border: '1px solid var(--accent)', overflow: 'hidden' }}>
                    <div style={{ padding: '10px 14px', background: 'var(--accent-soft)', borderBottom: '1px solid var(--line-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--accent-ink)' }}>
                                {pendingProduct.name}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--accent-ink)', opacity: 0.8, marginTop: 2 }}>
                                That code covers the whole product — pick the size/colour being returned
                            </div>
                        </div>
                        <button type="button" onClick={() => setPendingProduct(null)}
                            style={{ border: 0, background: 'transparent', color: 'var(--accent-ink)', padding: 4, lineHeight: 0, borderRadius: 6, cursor: 'default' }}>
                            <X size={15} />
                        </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 260, overflowY: 'auto' }} className="custom-scrollbar">
                        {pendingProduct.variants.map((v, i, arr) => {
                            const label = [v.size, v.color].filter(Boolean).join(' · ') || v.sku;
                            return (
                                <button
                                    key={v.id}
                                    type="button"
                                    onClick={() => {
                                        setPending({ productName: pendingProduct.name, unit: pendingProduct.unit, variant: v });
                                        setPendingProduct(null);
                                    }}
                                    style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '10px 14px', border: 0, background: 'var(--panel)',
                                        borderBottom: i < arr.length - 1 ? '1px solid var(--line-2)' : 'none',
                                        textAlign: 'left', cursor: 'default', width: '100%',
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--panel-2)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'var(--panel)'; }}
                                >
                                    <div>
                                        <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>{label}</div>
                                        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>
                                            {v.sku}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                                            {v.batches.length} batch{v.batches.length === 1 ? '' : 'es'}
                                        </span>
                                        <ChevronRight size={14} style={{ color: 'var(--faint)' }} />
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Batch step — which shipment did this come from? */}
            {pending && (
                <div style={{ borderRadius: 9, border: '1px solid var(--accent)', overflow: 'hidden' }}>
                    <div style={{ padding: '10px 14px', background: 'var(--accent-soft)', borderBottom: '1px solid var(--line-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--accent-ink)' }}>
                                {pending.productName}
                                {[pending.variant.size, pending.variant.color].filter(Boolean).length > 0 && (
                                    <span> · {[pending.variant.size, pending.variant.color].filter(Boolean).join(' · ')}</span>
                                )}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--accent-ink)', opacity: 0.8, marginTop: 2 }}>
                                Pick the price shown on the item's label
                            </div>
                        </div>
                        <button type="button" onClick={() => setPending(null)}
                            style={{ border: 0, background: 'transparent', color: 'var(--accent-ink)', padding: 4, lineHeight: 0, borderRadius: 6, cursor: 'default' }}>
                            <X size={15} />
                        </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {pending.variant.batches
                            .slice()
                            .sort((a, b) => new Date(b.received_date).getTime() - new Date(a.received_date).getTime())
                            .map((batch, i, arr) => (
                                <button
                                    key={batch.id}
                                    type="button"
                                    onClick={() => addLine(batch)}
                                    style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '10px 14px', border: 0, background: 'var(--panel)',
                                        borderBottom: i < arr.length - 1 ? '1px solid var(--line-2)' : 'none',
                                        textAlign: 'left', cursor: 'default', width: '100%',
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--panel-2)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'var(--panel)'; }}
                                >
                                    <div>
                                        <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>
                                            Received {fmtDate(batch.received_date)}
                                        </div>
                                        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                                            #{batch.batch_number} · {batch.current_quantity} in stock
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span className="num" style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>
                                            LKR {batch.selling_price.toLocaleString()}
                                        </span>
                                        <ChevronRight size={14} style={{ color: 'var(--faint)' }} />
                                    </div>
                                </button>
                            ))}
                    </div>
                </div>
            )}

            {/* Lines */}
            {lines.length === 0 ? (
                <div style={{ padding: '26px 0', textAlign: 'center', color: 'var(--muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <PackageCheck size={26} strokeWidth={1.3} style={{ color: 'var(--faint)' }} />
                    <div style={{ fontSize: 12.5 }}>Scan the items the customer is returning</div>
                </div>
            ) : (
                <div style={{ borderRadius: 9, border: '1px solid var(--line)', overflow: 'hidden' }}>
                    <div style={{ padding: '9px 14px', background: 'var(--panel-2)', borderBottom: '1px solid var(--line-2)', fontSize: 11, fontWeight: 600, color: 'var(--muted)', letterSpacing: '.05em', textTransform: 'uppercase' }}>
                        Items coming back
                    </div>
                    {lines.map((line, i) => {
                        const dec = isDecimal(line.unit);
                        const max = line.tag_price * line.quantity;
                        const overTag = line.amount > max;
                        return (
                            <div key={line.key} style={{
                                padding: '10px 14px',
                                borderBottom: i < lines.length - 1 ? '1px solid var(--line-2)' : 'none',
                                display: 'flex', alignItems: 'center', gap: 10,
                            }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {line.product_name}
                                    </div>
                                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                        {line.variant_label && <span style={{ color: 'var(--accent-ink)' }}>{line.variant_label}</span>}
                                        <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{line.sku}</span>
                                        <span>#{line.batch_number}</span>
                                        <span>tag LKR {line.tag_price.toLocaleString()}</span>
                                    </div>
                                </div>

                                <input
                                    type="number" min={dec ? 0.1 : 1} step={dec ? 0.1 : 1}
                                    value={line.quantity}
                                    disabled={disabled}
                                    onChange={e => {
                                        const q = dec ? parseFloat(e.target.value) : parseInt(e.target.value);
                                        const qty = Math.max(dec ? 0.1 : 1, q || (dec ? 0.1 : 1));
                                        // Keep the refund at the tag price for the new quantity unless the
                                        // desk has already lowered it.
                                        const wasAtTag = line.amount === line.tag_price * line.quantity;
                                        updateLine(line.key, {
                                            quantity: qty,
                                            amount: wasAtTag ? line.tag_price * qty : line.amount,
                                        });
                                    }}
                                    title="Quantity"
                                    style={{ width: 58, height: 32, textAlign: 'center', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--panel-2)', color: 'var(--ink)', fontSize: 12.5, outline: 'none', flexShrink: 0 }}
                                />

                                <div style={{ display: 'flex', alignItems: 'center', height: 32, borderRadius: 6, border: `1px solid ${overTag ? 'var(--danger)' : 'var(--line)'}`, background: 'var(--panel-2)', overflow: 'hidden', flexShrink: 0 }}>
                                    <span style={{ padding: '0 7px', fontSize: 10.5, color: 'var(--muted)', borderRight: '1px solid var(--line-2)', lineHeight: '32px' }}>LKR</span>
                                    <input
                                        type="number" min={0} step={50}
                                        value={line.amount}
                                        disabled={disabled}
                                        onChange={e => updateLine(line.key, { amount: parseFloat(e.target.value) || 0 })}
                                        title="Refund for this line"
                                        style={{ width: 82, height: 32, border: 0, outline: 'none', background: 'transparent', textAlign: 'right', padding: '0 8px', fontSize: 12.5, fontFamily: "'JetBrains Mono', monospace", color: overTag ? 'var(--danger)' : 'var(--ink)' }}
                                    />
                                </div>

                                <button type="button" onClick={() => removeLine(line.key)} disabled={disabled}
                                    style={{ width: 24, height: 24, border: 0, background: 'transparent', color: 'var(--faint)', borderRadius: 5, display: 'grid', placeItems: 'center', cursor: 'default', flexShrink: 0 }}
                                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--danger)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--faint)'; }}>
                                    <X size={13} />
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Refunding above the label price is refused by the database too — this is
                just the early warning so nobody fills in a whole return first. */}
            {lines.some(l => l.amount > l.tag_price * l.quantity) && (
                <div style={{ padding: '9px 11px', borderRadius: 7, background: 'color-mix(in oklab, var(--danger) 10%, var(--panel-2))', color: 'var(--danger)', fontSize: 12, display: 'flex', alignItems: 'flex-start', gap: 7 }}>
                    <AlertTriangle size={13} strokeWidth={1.8} style={{ flexShrink: 0, marginTop: 1 }} />
                    A refund cannot be more than the price on the item's label. Lower the highlighted amount.
                </div>
            )}
        </div>
    );
}
