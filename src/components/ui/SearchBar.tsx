import React from 'react';
import { Search } from 'lucide-react';

interface SearchBarProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    children?: React.ReactNode;
}

export const SearchBar: React.FC<SearchBarProps> = ({
    value,
    onChange,
    placeholder = 'Search…',
    className = '',
    children
}) => {
    return (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, height: 36, padding: '0 12px', borderRadius: 8, background: 'var(--panel-2)', border: '1px solid var(--line)', minWidth: 240 }} className={className}>
            <Search size={15} style={{ color: 'var(--muted)', flexShrink: 0 }} strokeWidth={1.6} />
            <input
                type="text"
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                style={{ flex: 1, border: 0, outline: 'none', background: 'transparent', fontSize: 13, color: 'var(--ink)', minWidth: 0 }}
            />
            {value && (
                <button onClick={() => onChange('')} style={{ border: 0, background: 'transparent', color: 'var(--faint)', cursor: 'default', padding: 0, fontSize: 16, lineHeight: 1 }}>×</button>
            )}
            {children}
        </div>
    );
};
