import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | 'full';
}

const maxWidths: Record<string, string> = {
    sm: '440px', md: '540px', lg: '640px', xl: '768px',
    '2xl': '900px', '3xl': '1024px', '4xl': '1200px', '5xl': '1400px', '6xl': '1600px', full: '95vw',
};

export function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(20,22,26,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}
            onClick={onClose}
        >
            <div
                style={{ background: 'var(--panel)', borderRadius: 14, boxShadow: '0 24px 64px rgba(20,22,26,0.18)', width: '100%', maxWidth: maxWidths[size], maxHeight: '90vh', display: 'flex', flexDirection: 'column', border: '1px solid var(--line)' }}
                onClick={(e) => e.stopPropagation()}
            >
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--panel)', borderRadius: '14px 14px 0 0', flexShrink: 0 }}>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{title}</h3>
                    <button
                        onClick={onClose}
                        style={{ width: 30, height: 30, borderRadius: 7, border: 0, background: 'transparent', color: 'var(--muted)', display: 'grid', placeItems: 'center', cursor: 'default', transition: 'all .1s' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--panel-2)'; e.currentTarget.style.color = 'var(--ink)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted)'; }}
                    >
                        <X size={18} />
                    </button>
                </div>
                <div style={{ flex: 1, overflowY: 'auto' }} className="custom-scrollbar">
                    {children}
                </div>
            </div>
        </div>
    );
}
