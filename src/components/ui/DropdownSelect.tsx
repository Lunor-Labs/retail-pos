import { useState, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';

interface Option {
  value: string;
  label: string;
}

interface DropdownSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
}

export function DropdownSelect({ value, onChange, options, placeholder = 'Select…', disabled = false, style }: DropdownSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selectedLabel = options.find(o => o.value === value)?.label ?? '';

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative', ...style }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(o => !o)}
        style={{
          width: '100%',
          height: 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 6,
          padding: '0 10px',
          border: `1px solid ${open ? 'var(--accent)' : 'var(--line)'}`,
          borderRadius: 8,
          background: disabled ? 'var(--panel-2)' : 'var(--panel)',
          color: value ? 'var(--ink)' : 'var(--muted)',
          fontSize: 13,
          fontWeight: value ? 500 : 400,
          cursor: disabled ? 'not-allowed' : 'default',
          textAlign: 'left',
          transition: 'border-color .1s',
          outline: 'none',
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedLabel || placeholder}
        </span>
        <ChevronDown
          size={14}
          style={{ flexShrink: 0, color: 'var(--muted)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}
        />
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          left: 0,
          right: 0,
          zIndex: 200,
          background: 'var(--panel)',
          border: '1px solid var(--line)',
          borderRadius: 10,
          boxShadow: '0 8px 24px rgba(20,22,26,0.12)',
          padding: 4,
          maxHeight: 240,
          overflowY: 'auto',
        }}
          className="custom-scrollbar"
        >
          {/* Clear option */}
          {placeholder && (
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false); }}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '7px 10px', border: 0, borderRadius: 7,
                background: value === '' ? 'var(--accent-soft)' : 'transparent',
                color: value === '' ? 'var(--accent-ink)' : 'var(--muted)',
                fontSize: 13, fontWeight: value === '' ? 600 : 400,
                cursor: 'default',
              }}
              onMouseEnter={e => { if (value !== '') e.currentTarget.style.background = 'var(--panel-2)'; }}
              onMouseLeave={e => { if (value !== '') e.currentTarget.style.background = 'transparent'; }}
            >
              {placeholder}
            </button>
          )}

          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '7px 10px', border: 0, borderRadius: 7,
                background: value === opt.value ? 'var(--accent-soft)' : 'transparent',
                color: value === opt.value ? 'var(--accent-ink)' : 'var(--ink-2)',
                fontSize: 13, fontWeight: value === opt.value ? 600 : 400,
                cursor: 'default',
              }}
              onMouseEnter={e => { if (value !== opt.value) e.currentTarget.style.background = 'var(--panel-2)'; }}
              onMouseLeave={e => { if (value !== opt.value) e.currentTarget.style.background = 'transparent'; }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
