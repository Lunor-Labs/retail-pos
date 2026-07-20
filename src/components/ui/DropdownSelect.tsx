import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Search, Plus } from 'lucide-react';

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
  searchThreshold?: number; // show search box when option count >= this (default 6)
  variant?: 'box' | 'pill'; // 'box' = form-input style (default), 'pill' = filter pill
  // When provided, a "+ Add '<search>'" row appears for a typed value with no
  // exact match. Should persist the new item; the typed value is then selected.
  onCreate?: (name: string) => Promise<void> | void;
}

export function DropdownSelect({ value, onChange, options, placeholder = 'Select…', disabled = false, style, searchThreshold = 6, variant = 'box', onCreate }: DropdownSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [panelPos, setPanelPos] = useState<{ top?: number; bottom?: number; left: number; width: number; maxListHeight: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  // Guard on a non-empty value so a "clear" option (value: '') doesn't render as
  // the trigger label — the empty state should fall through to the placeholder.
  const selectedLabel = value ? (options.find(o => o.value === value)?.label ?? '') : '';
  const showSearch = options.length >= searchThreshold || !!onCreate;
  const isPill = variant === 'pill';
  const isActive = isPill && value !== '';

  const filtered = search.trim()
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  const q = search.trim();
  const hasExact = options.some(o => o.label.toLowerCase() === q.toLowerCase());
  const showCreate = !!onCreate && q !== '' && !hasExact;

  async function handleCreate() {
    try { await onCreate!(q); onChange(q); } catch { /* parent surfaces the error */ }
    setOpen(false);
    setSearch('');
  }

  function handleOpen() {
    if (disabled) return;
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      const gap = 4;
      const edgeMargin = 8;
      const searchBoxHeight = showSearch ? 46 : 0;
      const spaceBelow = window.innerHeight - r.bottom - gap - edgeMargin;
      const spaceAbove = r.top - gap - edgeMargin;
      // Flip the panel above the trigger when there isn't enough room below —
      // otherwise a `position: fixed` panel gets cropped by the viewport edge
      // and its tail is unreachable by scroll (the panel itself doesn't move).
      const openUp = spaceBelow < 160 && spaceAbove > spaceBelow;
      const available = Math.max(120, openUp ? spaceAbove : spaceBelow);
      setPanelPos({
        top: openUp ? undefined : r.bottom + gap,
        bottom: openUp ? window.innerHeight - r.top + gap : undefined,
        left: r.left,
        width: r.width,
        maxListHeight: Math.min(220, available - searchBoxHeight),
      });
    }
    setOpen(o => !o);
  }

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      // The options panel renders as a position:fixed sibling OUTSIDE btnRef, so
      // it must be checked too — otherwise a mousedown on an option counts as an
      // "outside" click and closes (unmounts) the panel before the option's
      // onClick/mouseup can fire, and the selection is silently lost.
      const insideBtn = btnRef.current?.contains(target);
      const insidePanel = panelRef.current?.contains(target);
      if (!insideBtn && !insidePanel) {
        setOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (open && showSearch) {
      setTimeout(() => searchRef.current?.focus(), 30);
    }
    if (!open) setSearch('');
  }, [open, showSearch]);

  return (
    <div style={{ position: 'relative', ...style }}>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={handleOpen}
        style={isPill ? {
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 5,
          height: 28,
          padding: '0 10px 0 11px',
          border: `1px solid ${isActive || open ? 'var(--accent)' : 'var(--line)'}`,
          borderRadius: 999,
          background: isActive ? 'var(--accent-soft)' : 'transparent',
          color: isActive ? 'var(--accent-ink)' : 'var(--ink-2)',
          fontSize: 12.5,
          fontWeight: isActive ? 600 : 400,
          cursor: disabled ? 'not-allowed' : 'default',
          whiteSpace: 'nowrap',
          transition: 'all .1s',
          outline: 'none',
          opacity: disabled ? 0.6 : 1,
        } : {
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
        <span style={{ flex: isPill ? '0 1 auto' : 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedLabel || placeholder}
        </span>
        <ChevronDown
          size={isPill ? 11 : 14}
          style={{ flexShrink: 0, color: isActive ? 'var(--accent-ink)' : 'var(--muted)', opacity: isPill ? 0.7 : 1, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}
        />
      </button>

      {open && panelPos && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 299 }} onClick={() => { setOpen(false); setSearch(''); }} />
          <div ref={panelRef} style={{
          position: 'fixed',
          ...(panelPos.top !== undefined ? { top: panelPos.top } : { bottom: panelPos.bottom }),
          left: panelPos.left,
          width: isPill ? Math.max(panelPos.width, 180) : panelPos.width,
          zIndex: 300,
          background: 'var(--panel)',
          border: '1px solid var(--line)',
          borderRadius: 10,
          boxShadow: '0 8px 24px rgba(20,22,26,0.12)',
          overflow: 'hidden',
        }}>
          {/* Search input */}
          {showSearch && (
            <div style={{ padding: '8px 8px 4px', borderBottom: '1px solid var(--line-2)' }}>
              <div style={{ position: 'relative' }}>
                <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }} />
                <input
                  ref={searchRef}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Escape') { setOpen(false); setSearch(''); }
                    if (e.key === 'Enter' && filtered.length === 1) {
                      onChange(filtered[0].value);
                      setOpen(false);
                      setSearch('');
                    } else if (e.key === 'Enter' && filtered.length === 0 && showCreate) {
                      handleCreate();
                    }
                  }}
                  placeholder="Search…"
                  style={{
                    width: '100%', height: 30, padding: '0 9px 0 28px', border: '1px solid var(--line)',
                    borderRadius: 6, background: 'var(--panel-2)', color: 'var(--ink)',
                    fontSize: 12.5, outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>
          )}

          {/* Options list */}
          <div style={{ maxHeight: panelPos.maxListHeight, overflowY: 'auto', padding: 4 }} className="custom-scrollbar">
            {/* Clear option */}
            {placeholder && !search && (
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

            {filtered.length === 0 && !showCreate ? (
              <div style={{ padding: '10px 10px', fontSize: 12.5, color: 'var(--muted)', textAlign: 'center' }}>No results</div>
            ) : filtered.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false); setSearch(''); }}
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

            {showCreate && (
              <button
                type="button"
                onClick={handleCreate}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, width: '100%', textAlign: 'left',
                  padding: '7px 10px', border: 0, borderRadius: 7, marginTop: filtered.length > 0 ? 2 : 0,
                  background: 'transparent', color: 'var(--accent-ink)', fontSize: 13, fontWeight: 600, cursor: 'default',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-soft)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                <Plus size={13} strokeWidth={2.2} /> Add &ldquo;{q}&rdquo;
              </button>
            )}
          </div>
        </div>
        </>
      )}
    </div>
  );
}
