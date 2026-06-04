import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Gift, Check, X, Eye, Ban, MessageCircle, CornerDownLeft } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { LoadingSpinner } from '../ui';
import { openVoucherCard, openWhatsApp, VoucherCardData } from './voucherCardHTML';

interface GiftVoucher {
  id: string;
  code: string;
  amount: number;
  issued_to: string | null;
  issued_by_name: string | null;
  message: string | null;
  expires_at: string | null;
  recipient_phone: string | null;
  status: 'active' | 'used' | 'voided' | 'returned';
  redeemed_at: string | null;
  created_at: string;
  issued_source: 'sold' | 'reward';
  paid_amount: number | null;
  paid_via: 'cash' | 'card' | null;
  returned_at: string | null;
  refund_amount: number | null;
  refund_via: 'cash' | 'card' | null;
  return_note: string | null;
}

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
  active:   { bg: 'var(--accent-soft)', color: 'var(--accent-ink)', label: 'Active' },
  used:     { bg: 'rgba(20,22,26,0.06)', color: 'var(--muted)', label: 'Used' },
  voided:   { bg: 'color-mix(in oklab, var(--danger) 10%, var(--panel-2))', color: 'var(--danger)', label: 'Voided' },
  returned: { bg: 'color-mix(in oklab, #f97316 12%, var(--panel-2))', color: '#c2410c', label: 'Returned' },
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

// ─── Payment Via Pills ─────────────────────────────────────────────────────
function ViaSelector({ value, onChange }: { value: 'cash' | 'card'; onChange: (v: 'cash' | 'card') => void }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {(['cash', 'card'] as const).map(v => (
        <button key={v} type="button" onClick={() => onChange(v)} style={{
          padding: '5px 14px', borderRadius: 999, fontSize: 12.5, cursor: 'pointer',
          border: value === v ? '1px solid var(--accent)' : '1px solid var(--line)',
          background: value === v ? 'var(--accent-soft)' : 'var(--panel-2)',
          color: value === v ? 'var(--accent-ink)' : 'var(--ink-2)',
          fontWeight: value === v ? 600 : 400, textTransform: 'capitalize',
        }}>{v}</button>
      ))}
    </div>
  );
}

// ─── Issue Voucher Modal ───────────────────────────────────────────────────
function IssueModal({ onClose, onIssued }: { onClose: () => void; onIssued: () => void }) {
  const { showToast } = useToast();
  const { profile } = useAuth();
  const [amount, setAmount] = useState('');
  const [issuedTo, setIssuedTo] = useState('');
  const [issuedBy, setIssuedBy] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [expiryDays, setExpiryDays] = useState(90);
  const [paidAmount, setPaidAmount] = useState('');
  const [paidVia, setPaidVia] = useState<'cash' | 'card'>('cash');
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);

  // Keep paid amount in sync with face value by default
  function handleAmountChange(val: string) {
    setAmount(val);
    if (!paidAmount || paidAmount === amount) setPaidAmount(val);
  }

  async function handleIssue() {
    if (inFlight.current) return;
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { showToast('Enter a valid amount', 'error'); return; }
    inFlight.current = true;
    setSaving(true);
    try {
      const code = genCode();
      const expiresAt = expiryDays > 0 ? addDays(expiryDays) : null;
      const paid = parseFloat(paidAmount);
      const { error } = await (supabase.from('gift_vouchers') as any).insert({
        code,
        amount: amt,
        issued_to: issuedTo.trim() || null,
        issued_by_name: issuedBy.trim() || null,
        message: message.trim() || null,
        recipient_phone: phone.trim() || null,
        issued_by_staff_id: profile?.id ?? null,
        expires_at: expiresAt,
        status: 'active',
        issued_source: 'sold',
        paid_amount: paid > 0 ? paid : null,
        paid_via: paid > 0 ? paidVia : null,
      });
      if (error) throw error;

      const cardData: VoucherCardData = {
        code,
        amount: amt,
        issuedTo: issuedTo.trim() || undefined,
        issuedByName: issuedBy.trim() || undefined,
        message: message.trim() || undefined,
        expiresAt: expiresAt ?? undefined,
        issuedAt: new Date().toISOString(),
      };

      if (phone.trim()) {
        openWhatsApp(phone.trim(), cardData);
      }

      showToast(`Voucher ${code} issued${phone.trim() ? ' · WhatsApp opening…' : ''}`, 'success');
      onIssued();
      onClose();
    } catch (e: any) {
      showToast(e?.message ?? 'Failed to issue voucher', 'error');
    } finally {
      inFlight.current = false;
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
            <label style={lbl}>Voucher Amount (LKR) *</label>
            <div style={{ display: 'flex', alignItems: 'center', height: 36, borderRadius: 7, border: '1px solid var(--line)', background: 'var(--panel-2)', overflow: 'hidden' }}>
              <span style={{ padding: '0 10px', fontSize: 12.5, color: 'var(--muted)', borderRight: '1px solid var(--line-2)', height: '100%', display: 'flex', alignItems: 'center', flexShrink: 0 }}>LKR</span>
              <input
                type="number" min={1} step={100} autoFocus
                value={amount} onChange={e => handleAmountChange(e.target.value)}
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

          {/* WhatsApp number */}
          <div>
            <label style={lbl}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <MessageCircle size={11} strokeWidth={2} style={{ color: '#25D366' }} />
                WhatsApp Number <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--faint)', fontSize: 10 }}>(optional — sends voucher automatically)</span>
              </span>
            </label>
            <div style={{ display: 'flex', alignItems: 'center', height: 36, borderRadius: 7, border: '1px solid var(--line)', background: 'var(--panel-2)', overflow: 'hidden' }}>
              <span style={{ padding: '0 10px', fontSize: 12, color: 'var(--muted)', borderRight: '1px solid var(--line-2)', height: '100%', display: 'flex', alignItems: 'center', flexShrink: 0 }}>+94</span>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value.replace(/[^0-9]/g, '').slice(0, 12))}
                placeholder="771234567"
                style={{ flex: 1, border: 0, outline: 'none', background: 'transparent', padding: '0 10px', fontSize: 13, color: 'var(--ink)', fontFamily: "'JetBrains Mono',monospace" }}
              />
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
                <button key={opt.days} type="button" onClick={() => setExpiryDays(opt.days)} style={{
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

          {/* Payment section */}
          <div style={{ borderTop: '1px solid var(--line-2)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', letterSpacing: '.06em', textTransform: 'uppercase' }}>Payment Received</div>
            <div>
              <label style={lbl}>Amount Paid (LKR)</label>
              <div style={{ display: 'flex', alignItems: 'center', height: 36, borderRadius: 7, border: '1px solid var(--line)', background: 'var(--panel-2)', overflow: 'hidden' }}>
                <span style={{ padding: '0 8px', fontSize: 12, color: 'var(--muted)', borderRight: '1px solid var(--line-2)', height: '100%', display: 'flex', alignItems: 'center', flexShrink: 0 }}>LKR</span>
                <input
                  type="number" min={0} step={100}
                  value={paidAmount} onChange={e => setPaidAmount(e.target.value)}
                  placeholder={amount || '0'}
                  style={{ flex: 1, border: 0, outline: 'none', background: 'transparent', padding: '0 8px', fontSize: 13, fontWeight: 600, color: 'var(--ink)', fontFamily: "'JetBrains Mono',monospace" }}
                />
              </div>
            </div>
            <div>
              <label style={lbl}>Paid Via</label>
              <ViaSelector value={paidVia} onChange={setPaidVia} />
            </div>
          </div>
        </div>

        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" onClick={onClose} className="btn" style={{ height: 34, fontSize: 12.5 }} disabled={saving}>Cancel</button>
          <button type="button" onClick={handleIssue} className="btn btn-primary" style={{ height: 34, fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6 }} disabled={saving}>
            {saving ? 'Issuing…' : <><Gift size={13} /> Issue Voucher</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Return Modal ──────────────────────────────────────────────────────────
function ReturnModal({ voucher, onClose, onReturned }: { voucher: GiftVoucher; onClose: () => void; onReturned: () => void }) {
  const { showToast } = useToast();
  const [refundAmount, setRefundAmount] = useState(voucher.paid_amount != null ? String(voucher.paid_amount) : String(voucher.amount));
  const [refundVia, setRefundVia] = useState<'cash' | 'card'>(voucher.paid_via ?? 'cash');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const maxRefund = voucher.paid_amount ?? voucher.amount;

  async function handleReturn() {
    const amt = parseFloat(refundAmount);
    if (!amt || amt <= 0) { showToast('Enter a valid refund amount', 'error'); return; }
    if (amt > maxRefund) { showToast(`Refund cannot exceed ${fmtLKR(maxRefund)}`, 'error'); return; }
    setSaving(true);
    try {
      const { error } = await (supabase.from('gift_vouchers') as any)
        .update({
          status: 'returned',
          returned_at: new Date().toISOString(),
          refund_amount: amt,
          refund_via: refundVia,
          return_note: note.trim() || null,
        })
        .eq('id', voucher.id);
      if (error) throw error;
      showToast(`Voucher ${voucher.code} returned · ${fmtLKR(amt)} refunded`, 'success');
      onReturned();
      onClose();
    } catch (e: any) {
      showToast(e?.message ?? 'Failed to process return', 'error');
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
        background: 'var(--panel)', borderRadius: 14, width: '100%', maxWidth: 380,
        boxShadow: '0 24px 64px rgba(0,0,0,0.28)', overflow: 'hidden',
      }}>
        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <CornerDownLeft size={15} style={{ color: '#c2410c' }} strokeWidth={2} />
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>Return Voucher</h2>
          </div>
          <button onClick={onClose} style={{ border: 0, background: 'transparent', color: 'var(--muted)', cursor: 'pointer', padding: 4, lineHeight: 0, borderRadius: 6 }}>
            <X size={17} />
          </button>
        </div>

        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--panel-2)', border: '1px solid var(--line-2)', fontSize: 12.5, color: 'var(--ink-2)' }}>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, color: 'var(--ink)' }}>{voucher.code}</span>
            {' · '}{fmtLKR(voucher.amount)} face value
            {voucher.paid_amount != null && <span style={{ color: 'var(--muted)' }}> · paid {fmtLKR(voucher.paid_amount)}</span>}
          </div>

          <div>
            <label style={lbl}>Refund Amount (LKR)</label>
            <div style={{ display: 'flex', alignItems: 'center', height: 36, borderRadius: 7, border: '1px solid var(--line)', background: 'var(--panel-2)', overflow: 'hidden' }}>
              <span style={{ padding: '0 10px', fontSize: 12.5, color: 'var(--muted)', borderRight: '1px solid var(--line-2)', height: '100%', display: 'flex', alignItems: 'center', flexShrink: 0 }}>LKR</span>
              <input
                type="number" min={1} max={maxRefund} step={100} autoFocus
                value={refundAmount} onChange={e => setRefundAmount(e.target.value)}
                style={{ flex: 1, border: 0, outline: 'none', background: 'transparent', padding: '0 10px', fontSize: 14, fontWeight: 600, color: 'var(--ink)', fontFamily: "'JetBrains Mono',monospace" }}
              />
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4 }}>Max: {fmtLKR(maxRefund)}</div>
          </div>

          <div>
            <label style={lbl}>Refund Via</label>
            <ViaSelector value={refundVia} onChange={setRefundVia} />
          </div>

          <div>
            <label style={lbl}>Note (optional)</label>
            <input style={inp} value={note} onChange={e => setNote(e.target.value)} placeholder="Reason for return…" />
          </div>
        </div>

        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" onClick={onClose} className="btn" style={{ height: 34, fontSize: 12.5 }} disabled={saving}>Cancel</button>
          <button
            type="button" onClick={handleReturn} disabled={saving}
            style={{
              height: 34, fontSize: 12.5, padding: '0 16px', borderRadius: 8, border: 0,
              background: '#ea580c', color: '#fff', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 6, opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? 'Processing…' : <><CornerDownLeft size={13} /> Confirm Return</>}
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
  const [filter, setFilter] = useState<'all' | 'active' | 'used' | 'voided' | 'returned'>('all');
  const [voiding, setVoiding] = useState<string | null>(null);
  const [returningVoucher, setReturningVoucher] = useState<GiftVoucher | null>(null);

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

  const allSold = vouchers.filter(v => v.issued_source === 'sold');
  const active  = vouchers.filter(v => v.status === 'active');
  const used    = vouchers.filter(v => v.status === 'used');
  const returned = vouchers.filter(v => v.status === 'returned');

  const cashIn  = allSold.filter(v => v.status !== 'returned').reduce((s, v) => s + (v.paid_amount ?? 0), 0);
  const cashOut = returned.reduce((s, v) => s + (v.refund_amount ?? 0), 0);
  const netIncome = cashIn - cashOut;

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

      {/* KPI strip — counts */}
      <div className="rpt-kpi rpt-kpi-4">
        {[
          { label: 'Total Issued', value: vouchers.length.toString(), sub: `${allSold.length} sold · ${vouchers.length - allSold.length} rewards` },
          { label: 'Active', value: active.length.toString(), sub: fmtLKR(active.reduce((s, v) => s + v.amount, 0)) + ' outstanding' },
          { label: 'Redeemed', value: used.length.toString(), sub: `${vouchers.length > 0 ? Math.round(used.length / vouchers.length * 100) : 0}% redemption rate` },
          { label: 'Voided / Returned', value: (vouchers.filter(v => v.status === 'voided').length + returned.length).toString(), sub: `${returned.length} returned · ${vouchers.filter(v => v.status === 'voided').length} voided` },
        ].map((k, i) => (
          <div key={i} className="card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>{k.label}</span>
            <div className="num" style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.05, color: 'var(--ink)' }}>{k.value}</div>
            <div style={{ fontSize: 11.5, color: 'var(--faint)', fontWeight: 500 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Financial summary strip */}
      <div className="gift-fin-grid">
        {[
          { label: 'Cash In', value: cashIn, sub: `${allSold.filter(v => v.status !== 'returned' && v.paid_amount != null).length} paid vouchers`, color: 'var(--accent-ink)', bg: 'var(--accent-soft)' },
          { label: 'Cash Out (Refunds)', value: cashOut, sub: `${returned.length} returned`, color: '#c2410c', bg: 'color-mix(in oklab, #f97316 10%, var(--panel))' },
          { label: 'Net Income', value: netIncome, sub: 'Cash In − Cash Out', color: netIncome >= 0 ? 'var(--accent-ink)' : '#c2410c', bg: netIncome >= 0 ? 'var(--accent-soft)' : 'color-mix(in oklab, #f97316 10%, var(--panel))' },
        ].map((k, i) => (
          <div key={i} className="card" style={{ padding: '14px 16px', background: k.bg, border: `1px solid color-mix(in oklab, ${k.color} 20%, transparent)` }}>
            <span style={{ fontSize: 11.5, color: k.color, fontWeight: 600, opacity: 0.8 }}>{k.label}</span>
            <div className="num" style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', color: k.color, marginTop: 6 }}>
              {fmtLKR(k.value)}
            </div>
            <div style={{ fontSize: 11, color: k.color, opacity: 0.65, marginTop: 4 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Filter + table */}
      <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
        {/* Filter bar */}
        <div className="gift-filter-bar" style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', alignItems: 'center', background: 'var(--panel-2)' }}>
          {(['all', 'active', 'used', 'returned', 'voided'] as const).map(f => {
            const labels = { all: 'All', active: 'Active', used: 'Redeemed', returned: 'Returned', voided: 'Voided' };
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

        {/* Table header — desktop only */}
        <div className="gift-table-header" style={{ gridTemplateColumns: '150px 100px 1fr 1fr 110px 110px 120px', gap: 0, padding: '9px 16px', borderBottom: '1px solid var(--line-2)', background: 'var(--panel-2)' }}>
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
          const ss = STATUS_STYLE[v.status] ?? STATUS_STYLE.voided;
          const isVoiding = voiding === v.id;
          const isExpired = v.expires_at && new Date(v.expires_at) < new Date() && v.status === 'active';
          const rowBg = isExpired ? 'color-mix(in oklab, var(--warn) 3%, var(--panel))' : 'var(--panel)';
          const divider = i < vouchers.length - 1 ? '1px solid var(--line-2)' : 'none';

          const sourceBadge = (
            <span style={{
              fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 999,
              background: v.issued_source === 'sold' ? 'color-mix(in oklab, #6366f1 12%, var(--panel-2))' : 'rgba(20,22,26,0.06)',
              color: v.issued_source === 'sold' ? '#4338ca' : 'var(--muted)',
              letterSpacing: '.04em', textTransform: 'uppercase' as const,
            }}>
              {v.issued_source === 'sold' ? 'Sold' : 'Reward'}
            </span>
          );

          const statusBadge = (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 600, padding: '3px 8px', borderRadius: 999, background: ss.bg, color: ss.color }}>
              {v.status === 'active'   && <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }} />}
              {v.status === 'used'     && <Check size={10} strokeWidth={2.5} />}
              {v.status === 'voided'   && <Ban size={10} strokeWidth={2} />}
              {v.status === 'returned' && <CornerDownLeft size={10} strokeWidth={2} />}
              {ss.label}
            </span>
          );

          const whatsAppData = {
            code: v.code, amount: v.amount,
            issuedTo: v.issued_to ?? undefined,
            issuedByName: v.issued_by_name ?? undefined,
            message: v.message ?? undefined,
            expiresAt: v.expires_at ?? undefined,
            issuedAt: v.created_at,
          };

          const actions = (
            <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end', flexShrink: 0 }}>
              <button onClick={() => previewCard(v)} title="View Card"
                className="btn" style={{ height: 28, width: 28, padding: 0, display: 'grid', placeItems: 'center' }}>
                <Eye size={13} strokeWidth={1.8} />
              </button>
              {v.recipient_phone && (
                <button onClick={() => openWhatsApp(v.recipient_phone!, whatsAppData)} title="Send via WhatsApp"
                  style={{ height: 28, width: 28, padding: 0, display: 'grid', placeItems: 'center', border: '1px solid #25D366', borderRadius: 6, background: 'transparent', color: '#25D366', cursor: 'pointer' }}>
                  <MessageCircle size={13} strokeWidth={1.8} />
                </button>
              )}
              {v.status === 'active' && v.issued_source === 'sold' && (
                <button onClick={() => setReturningVoucher(v)} title="Return voucher"
                  style={{ height: 28, width: 28, padding: 0, display: 'grid', placeItems: 'center', border: '1px solid var(--line)', borderRadius: 6, background: 'transparent', color: 'var(--faint)', cursor: 'pointer' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#c2410c'; e.currentTarget.style.borderColor = '#c2410c'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--faint)'; e.currentTarget.style.borderColor = 'var(--line)'; }}>
                  <CornerDownLeft size={12} strokeWidth={2} />
                </button>
              )}
              {isAdmin && v.status === 'active' && (
                <button onClick={() => voidVoucher(v.id, v.code)} disabled={isVoiding} title="Void voucher"
                  style={{ height: 28, width: 28, padding: 0, display: 'grid', placeItems: 'center', border: '1px solid var(--line)', borderRadius: 6, background: 'transparent', color: 'var(--faint)', cursor: 'pointer' }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.borderColor = 'var(--danger)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--faint)'; e.currentTarget.style.borderColor = 'var(--line)'; }}>
                  <Ban size={12} strokeWidth={2} />
                </button>
              )}
            </div>
          );

          return (
            <div key={v.id}>
              {/* Desktop row */}
              <div className="gift-row-desktop" style={{
                gridTemplateColumns: '150px 100px 1fr 1fr 110px 110px 120px',
                gap: 0, padding: '12px 16px', alignItems: 'center',
                borderBottom: divider, background: rowBg,
              }}>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 700, color: 'var(--ink)', letterSpacing: '0.04em' }}>
                  {v.code}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
                    {sourceBadge}
                    <span style={{ fontSize: 10.5, color: 'var(--faint)', fontWeight: 400, letterSpacing: 0, fontFamily: 'inherit' }}>{fmtDate(v.created_at)}</span>
                  </div>
                </div>
                <div>
                  <div className="num" style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{fmtLKR(v.amount)}</div>
                  {v.paid_amount != null && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Paid: {fmtLKR(v.paid_amount)} · {v.paid_via}</div>}
                </div>
                <div style={{ fontSize: 13, color: 'var(--ink-2)', paddingRight: 8 }}>
                  {v.issued_to ?? <span style={{ color: 'var(--faint)' }}>—</span>}
                  {v.issued_by_name && <div style={{ fontSize: 11, color: 'var(--muted)' }}>From: {v.issued_by_name}</div>}
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>
                  {v.message ?? <span style={{ color: 'var(--faint)', fontStyle: 'normal' }}>—</span>}
                </div>
                <div style={{ fontSize: 12, color: isExpired ? 'var(--warn)' : 'var(--ink-2)' }}>
                  {v.expires_at ? fmtDate(v.expires_at) : <span style={{ color: 'var(--faint)' }}>No expiry</span>}
                  {isExpired && <div style={{ fontSize: 10.5, color: 'var(--warn)', fontWeight: 600 }}>Expired</div>}
                </div>
                <div>
                  {statusBadge}
                  {v.redeemed_at && <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 3 }}>{fmtDate(v.redeemed_at)}</div>}
                  {v.returned_at && <div style={{ fontSize: 10.5, color: '#c2410c', marginTop: 3 }}>{fmtLKR(v.refund_amount ?? 0)} · {v.refund_via} · {fmtDate(v.returned_at)}</div>}
                </div>
                {actions}
              </div>

              {/* Mobile card */}
              <div className="gift-row-mobile" style={{ padding: '12px 14px', borderBottom: divider, background: rowBg, flexDirection: 'column', gap: 8 }}>
                {/* Top: code + actions */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div>
                    <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', letterSpacing: '0.04em' }}>{v.code}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
                      {sourceBadge}
                      <span style={{ fontSize: 10.5, color: 'var(--faint)' }}>{fmtDate(v.created_at)}</span>
                    </div>
                  </div>
                  {actions}
                </div>
                {/* Amount + status */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div>
                    <span className="num" style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{fmtLKR(v.amount)}</span>
                    {v.paid_amount != null && <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 6 }}>paid {fmtLKR(v.paid_amount)} · {v.paid_via}</span>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {statusBadge}
                    {v.redeemed_at && <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 2 }}>{fmtDate(v.redeemed_at)}</div>}
                    {v.returned_at && <div style={{ fontSize: 10.5, color: '#c2410c', marginTop: 2 }}>{fmtLKR(v.refund_amount ?? 0)} · {v.refund_via}</div>}
                  </div>
                </div>
                {/* Recipient / expiry */}
                {(v.issued_to || v.issued_by_name || v.expires_at || isExpired) && (
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12, color: 'var(--ink-2)' }}>
                    {v.issued_to && <span>To: <strong>{v.issued_to}</strong></span>}
                    {v.issued_by_name && <span style={{ color: 'var(--muted)' }}>From: {v.issued_by_name}</span>}
                    {v.expires_at && <span style={{ color: isExpired ? 'var(--warn)' : 'var(--muted)' }}>Exp: {fmtDate(v.expires_at)}{isExpired ? ' ⚠' : ''}</span>}
                  </div>
                )}
                {v.message && <div style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>&ldquo;{v.message}&rdquo;</div>}
              </div>
            </div>
          );
        })}
      </div>

      {showIssue && (
        <IssueModal onClose={() => setShowIssue(false)} onIssued={load} />
      )}
      {returningVoucher && (
        <ReturnModal
          voucher={returningVoucher}
          onClose={() => setReturningVoucher(null)}
          onReturned={load}
        />
      )}
    </div>
  );
}
