import { useEffect, useRef, useState } from 'react';
import { ShieldCheck, X } from 'lucide-react';

interface PinPromptProps {
    /** Shown above the boxes, e.g. "Pay out LKR 1,200 in cash". */
    title: string;
    /** Optional second line explaining why approval is needed. */
    detail?: string;
    /** Message from a previous rejected attempt. */
    error?: string | null;
    busy?: boolean;
    onSubmit: (pin: string) => void;
    onCancel: () => void;
}

const BOX_COUNT = 4;

/**
 * Collects an admin's 4-digit approval PIN.
 *
 * It deliberately does no checking of its own — the PIN goes to the database function
 * performing the action, which verifies it there. A dialog that decided for itself
 * whether a PIN was right could be stepped over from the browser console.
 */
export function PinPrompt({ title, detail, error, busy = false, onSubmit, onCancel }: PinPromptProps) {
    const [digits, setDigits] = useState<string[]>(Array(BOX_COUNT).fill(''));
    const inputs = useRef<(HTMLInputElement | null)[]>([]);

    useEffect(() => {
        inputs.current[0]?.focus();
    }, []);

    // A rejected PIN clears the boxes so the next attempt starts fresh.
    useEffect(() => {
        if (error) {
            setDigits(Array(BOX_COUNT).fill(''));
            inputs.current[0]?.focus();
        }
    }, [error]);

    function submit(values: string[]) {
        const pin = values.join('');
        if (pin.length === BOX_COUNT) onSubmit(pin);
    }

    function setDigit(index: number, raw: string) {
        const digit = raw.replace(/\D/g, '').slice(-1);
        const next = [...digits];
        next[index] = digit;
        setDigits(next);

        if (digit && index < BOX_COUNT - 1) {
            inputs.current[index + 1]?.focus();
        }
        // Complete on the last digit, so the manager never reaches for a button.
        if (digit && index === BOX_COUNT - 1) {
            submit(next);
        }
    }

    function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
            return;
        }
        if (e.key === 'Enter') {
            e.preventDefault();
            submit(digits);
            return;
        }
        if (e.key === 'Backspace' && !digits[index] && index > 0) {
            e.preventDefault();
            const next = [...digits];
            next[index - 1] = '';
            setDigits(next);
            inputs.current[index - 1]?.focus();
        }
    }

    // Allow a scanner or paste to fill all four at once.
    function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, BOX_COUNT);
        if (!pasted) return;
        e.preventDefault();
        const next = Array(BOX_COUNT).fill('').map((_, i) => pasted[i] ?? '');
        setDigits(next);
        submit(next);
    }

    return (
        <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(20,22,26,0.45)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 70, padding: 16 }}
            onClick={onCancel}
        >
            <div
                style={{ background: 'var(--panel)', borderRadius: 14, boxShadow: '0 24px 64px rgba(20,22,26,0.22)', width: '100%', maxWidth: 380, border: '1px solid var(--line)' }}
                onClick={e => e.stopPropagation()}
            >
                <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <ShieldCheck size={16} strokeWidth={1.8} style={{ color: 'var(--accent-ink)' }} />
                        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>Admin approval</span>
                    </div>
                    <button
                        onClick={onCancel}
                        style={{ width: 26, height: 26, borderRadius: 6, border: 0, background: 'transparent', color: 'var(--muted)', display: 'grid', placeItems: 'center', cursor: 'default' }}
                    >
                        <X size={16} />
                    </button>
                </div>

                <div style={{ padding: '18px' }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', marginBottom: detail ? 3 : 14 }}>
                        {title}
                    </div>
                    {detail && (
                        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14 }}>{detail}</div>
                    )}

                    <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 12 }}>
                        {digits.map((digit, i) => (
                            <input
                                key={i}
                                ref={el => { inputs.current[i] = el; }}
                                type="password"
                                inputMode="numeric"
                                autoComplete="off"
                                value={digit}
                                disabled={busy}
                                onChange={e => setDigit(i, e.target.value)}
                                onKeyDown={e => handleKeyDown(i, e)}
                                onPaste={handlePaste}
                                onFocus={e => e.currentTarget.select()}
                                style={{
                                    width: 52, height: 58, textAlign: 'center',
                                    fontSize: 24, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace",
                                    color: 'var(--ink)', background: 'var(--bg)',
                                    border: `1px solid ${error ? 'var(--danger)' : digit ? 'var(--accent)' : 'var(--line)'}`,
                                    borderRadius: 9, outline: 'none',
                                    opacity: busy ? 0.6 : 1,
                                }}
                            />
                        ))}
                    </div>

                    {error && (
                        <div style={{ fontSize: 12, color: 'var(--danger)', textAlign: 'center', marginBottom: 10 }}>
                            {error}
                        </div>
                    )}

                    <div style={{ fontSize: 11, color: 'var(--faint)', textAlign: 'center' }}>
                        {busy ? 'Checking…' : 'Enter 4 digits · Esc to cancel'}
                    </div>
                </div>
            </div>
        </div>
    );
}
