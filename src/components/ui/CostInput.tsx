import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useCostCode } from '../../contexts/CostCodeContext';

interface CostInputProps {
  value: number;
  onChange: (v: number) => void;
  style?: React.CSSProperties;
  placeholder?: string;
  disabled?: boolean;
}

// Renders a plain number input for admins.
// For non-admins when a code key is configured: renders a text input that accepts
// encoded letter codes, decodes on blur, and reverts on invalid input.
export function CostInput({ value, onChange, style, placeholder, disabled }: CostInputProps) {
  const { isAdmin } = useAuth();
  const { encode, decode, isConfigured } = useCostCode();
  const useEncoding = !isAdmin && isConfigured;

  const [text, setText] = useState(() =>
    useEncoding ? encode(value) : (value ? String(value) : '')
  );

  // Sync when the underlying value changes from outside
  useEffect(() => {
    setText(useEncoding ? encode(value) : (value ? String(value) : ''));
  }, [value, useEncoding]);

  if (!useEncoding) {
    return (
      <input
        type="number"
        min={0}
        step="any"
        value={value || ''}
        disabled={disabled}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        style={style}
        placeholder={placeholder ?? '0'}
      />
    );
  }

  return (
    <input
      type="text"
      value={text}
      disabled={disabled}
      onChange={e => setText(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
      onFocus={e => e.currentTarget.select()}
      onBlur={() => {
        if (!text) { onChange(0); return; }
        const decoded = decode(text);
        if (!isNaN(decoded)) {
          onChange(decoded);
          setText(encode(decoded));
        } else {
          setText(encode(value)); // revert on invalid
        }
      }}
      onKeyDown={e => {
        if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
        if (e.key === 'Escape') { setText(encode(value)); (e.currentTarget as HTMLInputElement).blur(); }
      }}
      style={{ ...style, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.06em', textTransform: 'uppercase' }}
      placeholder={placeholder ?? 'code'}
    />
  );
}

// Read-only display — shows encoded text for non-admins, LKR for admins.
export function CostDisplay({ value, className, style }: { value: number; className?: string; style?: React.CSSProperties }) {
  const { isAdmin } = useAuth();
  const { encode, isConfigured } = useCostCode();
  const display = (!isAdmin && isConfigured) ? encode(value) : `LKR ${value.toLocaleString()}`;
  return <span className={className} style={style}>{display}</span>;
}
