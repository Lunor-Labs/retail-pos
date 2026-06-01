import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { AuditActionType } from '../../lib/auditLog';

interface LogEntry {
  id: string;
  action_type: AuditActionType;
  actor_name: string;
  product_id: string | null;
  product_name: string;
  detail: string | null;
  created_at: string;
}

const ACTION_LABEL: Record<string, string> = {
  product_added:   'Added product',
  product_updated: 'Updated product',
  product_deleted: 'Deleted product',
  variant_added:   'Added variant',
  variant_updated: 'Updated variant',
  batch_updated:   'Updated pricing',
  stock_restocked: 'Restocked',
  csv_imported:    'Imported via CSV',
};

const ACTION_DOT: Record<string, string> = {
  product_added:   'var(--accent)',
  product_updated: 'var(--warn)',
  product_deleted: 'var(--danger)',
  stock_restocked: '#3A6EA5',
  csv_imported:    'var(--muted)',
  batch_updated:   'var(--warn)',
};

type DateFilter = 'today' | 'week' | 'month' | 'all';

const TONES = ['#1B6B4F','#3A4E6B','#7A2235','#6A7048','#22324F','#B89456','#5C6675','#8A9078','#7A8050','#6B4A2B'];
function getTone(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xfffff;
  return TONES[h % TONES.length];
}
function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase() || '?';
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function dayLabel(dateStr: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (dateStr === today) return 'Today';
  if (dateStr === yesterday) return 'Yesterday';
  return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function ProductActivityLog() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [actionFilter, setActionFilter] = useState<string>('');
  const [limit, setLimit] = useState(60);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let query = (supabase.from('product_audit_log') as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      const now = new Date();
      if (dateFilter === 'today') {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        query = query.gte('created_at', start);
      } else if (dateFilter === 'week') {
        const start = new Date(now.getTime() - 7 * 86400000).toISOString();
        query = query.gte('created_at', start);
      } else if (dateFilter === 'month') {
        const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        query = query.gte('created_at', start);
      }

      if (actionFilter) query = query.eq('action_type', actionFilter);

      const { data } = await query;
      setEntries(data ?? []);
    } finally {
      setLoading(false);
    }
  }, [dateFilter, actionFilter, limit]);

  useEffect(() => { load(); }, [load]);

  // Group by calendar day
  const grouped: { day: string; items: LogEntry[] }[] = [];
  for (const entry of entries) {
    const day = new Date(entry.created_at).toISOString().slice(0, 10);
    const last = grouped[grouped.length - 1];
    if (last && last.day === day) {
      last.items.push(entry);
    } else {
      grouped.push({ day, items: [entry] });
    }
  }

  const chipStyle = (active: boolean): React.CSSProperties => ({
    height: 28, padding: '0 12px', borderRadius: 999, border: `1px solid ${active ? 'var(--accent)' : 'var(--line)'}`,
    background: active ? 'var(--accent-soft)' : 'transparent',
    color: active ? 'var(--accent-ink)' : 'var(--ink-2)',
    fontSize: 12.5, fontWeight: active ? 600 : 400, cursor: 'pointer', whiteSpace: 'nowrap' as const,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Filter bar */}
      <div className="card" style={{ padding: '12px 16px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Date chips */}
        {(['today', 'week', 'month', 'all'] as DateFilter[]).map(f => {
          const labels: Record<DateFilter, string> = { today: 'Today', week: 'This week', month: 'This month', all: 'All time' };
          return (
            <button key={f} style={chipStyle(dateFilter === f)} onClick={() => { setDateFilter(f); setLimit(60); }}>
              {labels[f]}
            </button>
          );
        })}

        <div style={{ width: 1, height: 18, background: 'var(--line)', margin: '0 2px', flexShrink: 0 }} />

        {/* Action type filter */}
        <button style={chipStyle(actionFilter === '')} onClick={() => setActionFilter('')}>All actions</button>
        {Object.entries(ACTION_LABEL).map(([key, label]) => (
          <button key={key} style={chipStyle(actionFilter === key)} onClick={() => setActionFilter(actionFilter === key ? '' : key)}>
            {label}
          </button>
        ))}
      </div>

      {/* Timeline */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Loading…</div>
        ) : entries.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ink-2)', marginBottom: 6 }}>No activity found</div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>Product changes will appear here once staff start making them.</div>
          </div>
        ) : (
          <>
            {grouped.map(group => (
              <div key={group.day}>
                {/* Day header */}
                <div style={{
                  padding: '8px 16px', fontSize: 11.5, fontWeight: 700,
                  color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em',
                  background: 'var(--panel-2)', borderBottom: '1px solid var(--line-2)',
                  borderTop: '1px solid var(--line-2)',
                }}>
                  {dayLabel(group.day)}
                </div>

                {group.items.map((entry, i) => {
                  const tone = getTone(entry.actor_name);
                  const initials = getInitials(entry.actor_name);
                  const dot = ACTION_DOT[entry.action_type] ?? 'var(--faint)';
                  const label = ACTION_LABEL[entry.action_type] ?? entry.action_type;

                  return (
                    <div key={entry.id} style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px',
                      borderBottom: i < group.items.length - 1 ? '1px solid var(--line-2)' : 'none',
                    }}>
                      {/* Actor avatar */}
                      <div style={{
                        width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                        background: `linear-gradient(135deg, ${tone}, color-mix(in oklab, ${tone} 65%, #000))`,
                        color: '#fff', display: 'grid', placeItems: 'center',
                        fontSize: 10.5, fontWeight: 700, letterSpacing: '-0.01em',
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,.18)',
                      }}>
                        {initials}
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap' }}>
                          {entry.actor_name}
                        </span>
                        {/* Action dot + label */}
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: 'var(--muted)' }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: dot, flexShrink: 0 }} />
                          {label}
                        </span>
                        {/* Product name */}
                        <span style={{ fontSize: 12.5, color: 'var(--ink-2)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>
                          {entry.product_name}
                        </span>
                        {/* Detail */}
                        {entry.detail && (
                          <span style={{
                            fontSize: 11.5, color: 'var(--faint)',
                            fontFamily: "'JetBrains Mono', monospace",
                            background: 'var(--panel-2)', padding: '2px 7px',
                            borderRadius: 5, border: '1px solid var(--line-2)',
                            whiteSpace: 'nowrap',
                          }}>
                            {entry.detail}
                          </span>
                        )}
                      </div>

                      {/* Time */}
                      <div style={{ fontSize: 11.5, color: 'var(--faint)', fontFamily: "'JetBrains Mono', monospace", flexShrink: 0 }}>
                        {fmtTime(entry.created_at)}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}

            {/* Load more */}
            {entries.length >= limit && (
              <div style={{ padding: '14px 16px', borderTop: '1px solid var(--line-2)', textAlign: 'center' }}>
                <button onClick={() => setLimit(l => l + 60)} className="btn" style={{ height: 32, fontSize: 12.5 }}>
                  Load more
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
