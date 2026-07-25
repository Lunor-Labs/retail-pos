import { useEffect, useRef } from 'react';
import { Printer, MessageCircle, Check, X } from 'lucide-react';
import JsBarcode from 'jsbarcode';
import { openReturnSlip, openReturnSlipWhatsApp, type ReturnSlipData } from './returnSlipHTML';

interface ReturnSlipProps {
    data: ReturnSlipData;
    /** Captured at the desk; enables the WhatsApp button when present. */
    phone?: string;
    onClose: () => void;
}

function fmtAmount(n: number) {
    return 'LKR ' + Math.round(n).toLocaleString('en-US');
}

function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Shown once a return is accepted: the credit code, ready to print or send.
 *
 * The barcode is drawn here as well as on the printed slip so the cashier can scan it
 * straight off the screen when the customer is standing right there.
 */
export function ReturnSlip({ data, phone, onClose }: ReturnSlipProps) {
    const barcodeRef = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
        if (!barcodeRef.current) return;
        try {
            JsBarcode(barcodeRef.current, data.code, {
                format: 'CODE128',
                width: 2,
                height: 52,
                displayValue: false,
                margin: 0,
            });
        } catch {
            // The code is shown as text regardless, so a failed render is not fatal.
        }
    }, [data.code]);

    return (
        <div
            style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(10,12,15,0.55)', backdropFilter: 'blur(4px)', display: 'grid', placeItems: 'center', padding: 20 }}
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div style={{ background: 'var(--panel)', borderRadius: 14, width: '100%', maxWidth: 400, boxShadow: '0 24px 64px rgba(0,0,0,0.28)', overflow: 'hidden' }}>

                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--accent-soft)', display: 'grid', placeItems: 'center' }}>
                            <Check size={14} strokeWidth={2.4} style={{ color: 'var(--accent-ink)' }} />
                        </div>
                        <div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>Return accepted</div>
                            <div style={{ fontSize: 11, color: 'var(--muted)' }}>{data.returnNumber}</div>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ border: 0, background: 'transparent', color: 'var(--muted)', padding: 4, lineHeight: 0, borderRadius: 6, cursor: 'default' }}>
                        <X size={17} />
                    </button>
                </div>

                <div style={{ padding: '20px', textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '.08em', textTransform: 'uppercase', fontWeight: 600 }}>
                        Credit value
                    </div>
                    <div className="num" style={{ fontSize: 30, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.02em', margin: '4px 0 16px' }}>
                        {fmtAmount(data.amount)}
                    </div>

                    <canvas ref={barcodeRef} style={{ maxWidth: '100%' }} />

                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 19, fontWeight: 700, letterSpacing: '.12em', color: 'var(--ink)', marginTop: 6 }}>
                        {data.code}
                    </div>

                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 10 }}>
                        Valid until <strong style={{ color: 'var(--ink-2)' }}>{fmtDate(data.expiresAt)}</strong>
                    </div>
                </div>

                <div style={{ padding: '14px 20px', borderTop: '1px solid var(--line-2)', display: 'flex', gap: 8 }}>
                    <button onClick={() => openReturnSlip(data)} className="btn btn-primary" style={{ flex: 1, height: 38, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                        <Printer size={15} strokeWidth={1.8} /> Print slip
                    </button>
                    {phone && (
                        <button onClick={() => openReturnSlipWhatsApp(phone, data)} className="btn" style={{ flex: 1, height: 38, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                            <MessageCircle size={15} strokeWidth={1.8} /> WhatsApp
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
