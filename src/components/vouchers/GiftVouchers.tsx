import { useState, useEffect, useCallback } from 'react';
import { Plus, Gift, Check, X, Eye, Ban } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { LoadingSpinner } from '../ui';
import { openVoucherCard, VoucherCardData } from './voucherCardHTML';

interface GiftVoucher {
  id: string;
  code: string;
  amount: number;
  issued_to: string | null;
  issued_by_name: string | null;
  message: string | null;
  expires_at: string | null;
  status: 'active' | 'used' | 'voided';
  redeemed_at: string | null;
  created_at: string;
}

// Unambiguous chars for code generation (no 0,O,1,I,l)
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function genCode(): string {
  const rand = (n: number) => Array.from({ length: n }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
  return `RVL-${rand(4)}-${rand(3)}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtLKR(n: number) { return 'LKR ' + Math.round(n).toLocaleString('en-US'); }
function fmtK(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1000) return Math.round(n / 1000) + 'k';
  return n.toString();
}

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  active: { bg: 'var(--accent-soft)', color: 'var(--accent-ink)', label: 'Active' },
  used:   { bg: 'rgba(20,22,26,0.06)', color: 'var(--muted)', label: 'Used' },
  voided: { bg: 'color-mix(in oklab, var(--danger) 10%, var(--panel-2))', color: 'var(--danger)', label: 'Voided' },
};

const EXPIRY_OPTIONS = [
  { label: '1 month', days: 30 },
  { label: '3 months', days: 90 },
  { label: '6 months', days: 180 },
  { label: '1 year', days: 365 },
  { label: 'No expiry', days: 0 },
];

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

// ─── Issue Voucher Modal ───────────────────────────────────────────────────
function IssueModal({ onClose, onIssued }: { onClose: () => void; onIssued: () => void }) {
  const { showToast } = useToast();
  const { profile } = useAuth();
  const [amount, setAmount] = useState('');
  const [issuedTo, setIssuedTo] = useState('');
  const [issuedBy, setIssuedBy] = useState('');
  const [message, setMessage] = useState('');
  const [expiryDays, setExpiryDays] = useState(90);
  const [saving, setSaving] = useState(false);

  async function handleIssue() {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { showToast('Enter a valid amount', 'error'); return; }
    setSaving(true);
    try {
      const code = genCode();
      const expiresAt = expiryDays > 0 ? addDays(expiryDays) : null;
      const { error } = await (supabase.from('gift_vouchers') as any).insert({
        code,
        amount: amt,
        issued_to: issuedTo.trim() || null,
        issued_by_name: issuedBy.trim() || null,
        message: message.trim() || null,
        issued_by_staff_id: profile?.id ?? null,
        expires_at: expiresAt,
        status: 'active',
      });
      if (error) throw error;

      // Open card for download
      const cardData: VoucherCardData = {
        code,
        amount: amt,
        issuedTo: issuedTo.trim() || undefined,
        issuedByName: issuedBy.trim() || undefined,
        message: message.trim() || undefined,
        expiresAt: expiresAt ?? undefined,
        issuedAt: new Date().toISOString(),
      };
      openVoucherCard(cardData);

      showToast(`Voucher ${code} issued`, 'success');
      onIssued();
      onClose();
    } catch (e: any) {
      showToast(e?.message ?? 'Failed to issue voucher', 'error');
    } finally {
      setSaving(false);
    }
  }

  const inp: React.CSSProperties = {
    width: '100%', height: 36, padding: '0 11px', borderRadius: 7,
    border: '1px solid var(--line)', background: 'var(--panel-2)',
    color: 'var(--ink)', fontSize: 13, outline: 'none', boxSizing: 'border-box',
  };
  const lbl: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 5,
    display: 'block', letterSpacing: '.06em', textTransform: 'uppercase',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(10,12,15,0.55)', backdropFilter: 'blur(4px)',
      display: 'grid', placeItems: 'center', padding: 20,
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: 'var(--panel)', borderRadius: 14, width: '100%', maxWidth: 440,
        boxShadow: '0 24px 64px rgba(0,0,0,0.28)', overflow: 'hidden',
      }}>
        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Gift size={16} style={{ color: 'var(--accent-ink)' }} strokeWidth={1.7} />
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>Issue Gift Voucher</h2>
          </div>
          <button onClick={onClose} style={{ border: 0, background: 'transparent', color: 'var(--muted)', cursor: 'pointer', padding: 4, lineHeight: 0, borderRadius: 6 }}>
            <X size={17} />
          </button>
        </div>

        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Amount */}
          <div>
            <label style={lbl}>Amount (LKR) *</label>
            <div style={{ display: 'flex', alignItems: 'center', height: 36, borderRadius: 7, border: '1px solid var(--line)', background: 'var(--panel-2)', overflow: 'hidden' }}>
              <span style={{ padding: '0 10px', fontSize: 12.5, color: 'var(--muted)', borderRight: '1px solid var(--line-2)', height: '100%', display: 'flex', alignItems: 'center', flexShrink: 0 }}>LKR</span>
              <input
                type="number" min={1} step={100} autoFocus
                value={amount} onChange={e => setAmount(e.target.value)}
                placeholder="2,000"
                style={{ flex: 1, border: 0, outline: 'none', background: 'transparent', padding: '0 10px', fontSize: 14, fontWeight: 600, color: 'var(--ink)', fontFamily: "'JetBrains Mono',monospace" }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>Issued To</label>
              <input style={inp} value={issuedTo} onChange={e => setIssuedTo(e.target.value)} placeholder="Recipient name" />
            </div>
            <div>
              <label style={lbl}>From</label>
              <input style={inp} value={issuedBy} onChange={e => setIssuedBy(e.target.value)} placeholder="Sender name" />
            </div>
          </div>

          <div>
            <label style={lbl}>Message (optional)</label>
            <textarea
              value={message} onChange={e => setMessage(e.target.value)}
              placeholder="Happy Birthday! Enjoy your shopping 🎂"
              rows={2}
              style={{ ...inp, height: 'auto', padding: '8px 11px', resize: 'none', lineHeight: 1.5, fontFamily: 'inherit' }}
            />
          </div>

          <div>
            <label style={lbl}>Valid For</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {EXPIRY_OPTIONS.map(opt => (
                <button key={opt.days} onClick={() => setExpiryDays(opt.days)} style={{
                  padding: '5px 11px', borderRadius: 999, fontSize: 12.5, cursor: 'pointer',
                  border: expiryDays === opt.days ? '1px solid var(--accent)' : '1px solid var(--line)',
                  background: expiryDays === opt.days ? 'var(--accent-soft)' : 'var(--panel-2)',
                  color: expiryDays === opt.days ? 'var(--accent-ink)' : 'var(--ink-2)',
                  fontWeight: expiryDays === opt.days ? 600 : 400,
                }}>
                  {opt.label}
                </button>
              ))}
            </div>
            {expiryDays > 0 && (
              <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 6 }}>
                Expires: {fmtDate(addDays(expiryDays))}
              </div>
            )}
          </div>
        </div>

        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} className="btn" style={{ height: 34, fontSize: 12.5 }} disabled={saving}>Cancel</button>
          <button onClick={handleIssue} className="btn btn-primary" style={{ height: 34, fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6 }} disabled={saving}>
            {saving ? 'Issuing…' : <><Gift size={13} /> Issue & Download Card</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────
export function GiftVouchers() {
  const { isAdmin } = useAuth();
  const { showToast } = useToast();
  const [vouchers, setVouchers] = useState<GiftVoucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [showIssue, setShowIssue] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'used' | 'voided'>('all');
  const [voiding, setVoiding] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      let q = (supabase.from('gift_vouchers') as any)
        .select('*').order('created_at', { ascending: false });
      if (filter !== 'all') q = q.eq('status', filter);
      const { data } = await q;
      setVouchers(data ?? []);
    } catch {
      showToast('Failed to load vouchers', 'error');
    } finally {
      setLoading(false);
    }
  }, [filter, showToast]);

  useEffect(() => { load(); }, [load]);

  async function voidVoucher(id: string, code: string) {
    setVoiding(id);
    try {
      const { error } = await (supabase.from('gift_vouchers') as any)
        .update({ status: 'voided' }).eq('id', id);
      if (error) throw error;
      showToast(`Voucher ${code} voided`, 'success');
      load();
    } catch (e: any) {
      showToast(e?.message ?? 'Failed to void voucher', 'error');
    } finally {
      setVoiding(null);
    }
  }

  function previewCard(v: GiftVoucher) {
    openVoucherCard({
      code: v.code,
      amount: v.amount,
      issuedTo: v.issued_to ?? undefined,
      issuedByName: v.issued_by_name ?? undefined,
      message: v.message ?? undefined,
      expiresAt: v.expires_at ?? undefined,
      issuedAt: v.created_at,
    });
  }

  const active = vouchers.filter(v => v.status === 'active');
  const used   = vouchers.filter(v => v.status === 'used');
  const totalIssued = vouchers.reduce((s, v) => s + v.amount, 0);
  const totalActive = active.reduce((s, v) => s + v.amount, 0);

  if (loading) return <LoadingSpinner message="Loading vouchers…" />;

  return (
    <div className="sh-outer" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Header */}
      <div style={{ paddingTop: 24, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)' }}>Gift Vouchers</h1>
          <p style={{ margin: '6px 0 0', fontSize: 13.5, color: 'var(--muted)' }}>
            Issue, track, and manage gift vouchers
          </p>
        </div>
        <button onClick={() => setShowIssue(true)} className="btn btn-primary" style={{ height: 36, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={14} /> Issue Voucher
        </button>
      </div>

      {/* KPI strip */}
      <div className="rpt-kpi rpt-kpi-4">
        {[
          { label: 'Total Issued', value: vouchers.length.toString(), sub: fmtLKR(totalIssued) + ' value' },
          { label: 'Active', value: active.length.toString(), sub: fmtLKR(totalActive) + ' outstanding' },
          { label: 'Redeemed', value: used.length.toString(), sub: `${vouchers.length > 0 ? Math.round(used.length / vouchers.length * 100) : 0}% redemption rate` },
          { label: 'Voided', value: vouchers.filter(v => v.status === 'voided').length.toString(), sub: 'cancelled vouchers' },
        ].map((k, i) => (
          <div key={i} className="card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>{k.label}</span>
            <div className="num" style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.05, color: 'var(--ink)' }}>{k.value}</div>
            <div style={{ fontSize: 11.5, color: 'var(--faint)', fontWeight: 500 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Filter + table */}
      <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
        {/* Filter bar */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', display: 'flex', gap: 6, alignItems: 'center', background: 'var(--panel-2)' }}>
          {(['all', 'active', 'used', 'voided'] as const).map(f => {
            const labels = { all: 'All', active: 'Active', used: 'Redeemed', voided: 'Voided' };
            const isA = filter === f;
            return (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: '4px 12px', borderRadius: 999, fontSize: 12.5, cursor: 'pointer',
                border: isA ? '1px solid var(--accent)' : '1px solid var(--line)',
                background: isA ? 'var(--accent-soft)' : 'transparent',
                color: isA ? 'var(--accent-ink)' : 'var(--ink-2)',
                fontWeight: isA ? 600 : 400,
              }}>
                {labels[f]}
              </button>
            );
          })}
        </div>

        {/* Table header */}
        <div style={{ display: 'grid', gridTemplateColumns: '150px 100px 1fr 1fr 110px 90px 110px', gap: 0, padding: '9px 16px', borderBottom: '1px solid var(--line-2)', background: 'var(--panel-2)' }}>
          {['Code', 'Amount', 'Recipient', 'Message', 'Expiry', 'Status', ''].map(h => (
            <div key={h} style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--muted)', letterSpacing: '.04em', textTransform: 'uppercase' }}>{h}</div>
          ))}
        </div>

        {vouchers.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center' }}>
            <Gift size={32} style={{ color: 'var(--faint)', marginBottom: 12 }} strokeWidth={1.4} />
            <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ink-2)', marginBottom: 6 }}>No vouchers yet</div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>Issue your first gift voucher to get started</div>
          </div>
        ) : vouchers.map((v, i) => {
          const ss = STATUS_STYLE[v.status];
          const isVoiding = voiding === v.id;
          const isExpired = v.expires_at && new Date(v.expires_at) < new Date() && v.status === 'active';

          return (
            <div key={v.id} style={{
              display: 'grid', gridTemplateColumns: '150px 100px 1fr 1fr 110px 90px 110px',
              gap: 0, padding: '12px 16px', alignItems: 'center',
              borderBottom: i < vouchers.length - 1 ? '1px solid var(--line-2)' : 'none',
              background: isExpired ? 'color-mix(in oklab, var(--warn) 3%, var(--panel))' : 'var(--panel)',
            }}>
              {/* Code */}
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 700, color: 'var(--ink)', letterSpacing: '0.04em' }}>
                {v.code}
                <div style={{ fontSize: 10.5, color: 'var(--faint)', fontWeight: 400, marginTop: 2, letterSpacing: 0 }}>
                  {fmtDate(v.created_at)}
                </div>
              </div>
              {/* Amount */}
              <div className="num" style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>
                {fmtLKR(v.amount)}
              </div>
              {/* Recipient */}
              <div style={{ fontSize: 13, color: 'var(--ink-2)', paddingRight: 8 }}>
                {v.issued_to ?? <span style={{ color: 'var(--faint)' }}>—</span>}
                {v.issued_by_name && <div style={{ fontSize: 11, color: 'var(--muted)' }}>From: {v.issued_by_name}</div>}
              </div>
              {/* Message */}
              <div style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>
                {v.message ?? <span style={{ color: 'var(--faint)', fontStyle: 'normal' }}>—</span>}
              </div>
              {/* Expiry */}
              <div style={{ fontSize: 12, color: isExpired ? 'var(--warn)' : 'var(--ink-2)' }}>
                {v.expires_at ? fmtDate(v.expires_at) : <span style={{ color: 'var(--faint)' }}>No expiry</span>}
                {isExpired && <div style={{ fontSize: 10.5, color: 'var(--warn)', fontWeight: 600 }}>Expired</div>}
              </div>
              {/* Status */}
              <div>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 600, padding: '3px 8px', borderRadius: 999, background: ss.bg, color: ss.color }}>
                  {v.status === 'active' && <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }} />}
                  {v.status === 'used' && <Check size={10} strokeWidth={2.5} />}
                  {v.status === 'voided' && <Ban size={10} strokeWidth={2} />}
                  {ss.label}
                </span>
                {v.redeemed_at && <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 3 }}>{fmtDate(v.redeemed_at)}</div>}
              </div>
              {/* Actions */}
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                <button onClick={() => previewCard(v)} title="View / Download Card"
                  className="btn" style={{ height: 28, width: 28, padding: 0, display: 'grid', placeItems: 'center' }}>
                  <Eye size={13} strokeWidth={1.8} />
                </button>
                {isAdmin && v.status === 'active' && (
                  <button
                    onClick={() => voidVoucher(v.id, v.code)}
                    disabled={isVoiding}
                    title="Void voucher"
                    style={{
                      height: 28, width: 28, padding: 0, display: 'grid', placeItems: 'center',
                      border: '1px solid var(--line)', borderRadius: 6, background: 'transparent',
                      color: 'var(--faint)', cursor: 'pointer',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.borderColor = 'var(--danger)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--faint)'; e.currentTarget.style.borderColor = 'var(--line)'; }}
                  >
                    <Ban size={12} strokeWidth={2} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showIssue && (
        <IssueModal onClose={() => setShowIssue(false)} onIssued={load} />
      )}
    </div>
  );
}
