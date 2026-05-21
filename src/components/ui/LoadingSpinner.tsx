import React from 'react';

interface LoadingSpinnerProps {
    message?: string;
    fullPage?: boolean;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
    message = 'Loading…',
    fullPage = false
}) => {
    const content = (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
            <div className="animate-spin" style={{ width: 36, height: 36, borderRadius: '50%', border: '2px solid var(--line)', borderTopColor: 'var(--accent)' }} />
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>{message}</p>
        </div>
    );

    if (fullPage) {
        return (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(247,246,242,0.7)', backdropFilter: 'blur(4px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {content}
            </div>
        );
    }

    return content;
};
