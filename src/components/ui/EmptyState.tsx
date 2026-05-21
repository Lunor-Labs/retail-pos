import React from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
    icon: LucideIcon;
    title: string;
    description: string;
    action?: {
        label: string;
        onClick: () => void;
    };
}

export const EmptyState: React.FC<EmptyStateProps> = ({
    icon: Icon,
    title,
    description,
    action
}) => {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', textAlign: 'center', background: 'var(--panel)', border: '1px dashed var(--line)', borderRadius: 12 }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--panel-2)', display: 'grid', placeItems: 'center', marginBottom: 16 }}>
                <Icon size={24} style={{ color: 'var(--faint)' }} />
            </div>
            <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{title}</h3>
            <p style={{ margin: '0 0 20px', fontSize: 13.5, color: 'var(--muted)', maxWidth: 320 }}>{description}</p>
            {action && (
                <button onClick={action.onClick} className="btn btn-primary" style={{ height: 36 }}>
                    {action.label}
                </button>
            )}
        </div>
    );
};
