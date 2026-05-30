import { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Search, X, Pencil, ChevronRight, ChevronLeft, Users, Target, Check, ChevronDown, TrendingUp } from 'lucide-react';
import { salesService } from '../services';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { LoadingSpinner } from './ui';
import { supabase } from '../lib/supabase';

type StaffRole = 'admin' | 'cashier' | 'stock_manager' | 'staff';
type StaffSource = 'profile' | 'member';

interface StaffMember {
  id: string;
  email: string;
  full_name: string;
  role: StaffRole;
  active: boolean;
  daily_target: number;
  commission_rate: number;
  created_at: string;
  source: StaffSource;
  // enriched
  initials: string;
  tone: string;
  today: { sales: number; revenue: number };
  month: { sales: number; revenue: number };
  week: number[];
  isActiveToday: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────
const TONES = ['#1B6B4F','#3A4E6B','#7A2235','#6A7048','#22324F','#B89456','#5C6675','#8A9078','#7A8050','#6B4A2B'];
function getTone(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xfffff;
  return TONES[h % TONES.length];
}
function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase();
}
function fmtLKR(n: number) { return 'LKR ' + Math.round(n).toLocaleString('en-US'); }
function fmtK(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1000) return Math.round(n / 1000) + 'k';
  return n.toString();
}
function fmtJoined(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}
const ROLE_LABEL: Record<StaffRole, string> = {
  admin: 'Admin',
  cashier: 'Cashier',
  stock_manager: 'Stock Manager',
  staff: 'Staff',
};

// ─── Avatar ──────────────────────────────────────────────────────────────
function Avatar({ initials, tone, size = 40, active }: { initials: string; tone: string; size?: number; active?: boolean }) {
  const fontSize = size >= 44 ? 14 : size >= 36 ? 13 : size >= 30 ? 12 : 10;
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <div style={{
        width: size, height: size, borderRadius: '50%',
        background: `linear-gradient(135deg, ${tone}, color-mix(in oklab, ${tone} 65%, #000))`,
        color: '#fff', display: 'grid', placeItems: 'center',
        fontWeight: 600, fontSize, letterSpacing: '-0.01em',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,.18)',
      }}>{initials}</div>
      {active !== undefined && size >= 30 && (
        <span style={{
          position: 'absolute', bottom: -1, right: -1,
          width: Math.max(8, size * 0.25), height: Math.max(8, size * 0.25),
          borderRadius: '50%',
          background: active ? 'var(--accent)' : 'var(--faint)',
          border: '2px solid var(--panel)',
        }} />
      )}
    </div>
  );
}

// ─── Mini bar chart ───────────────────────────────────────────────────────
function MiniBars({ data }: { data: number[] }) {
  const max = Math.max(...data, 1);
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 34 }}>
        {data.map((v, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{
              width: '100%', height: Math.max(2, (v / max) * 32) + 'px',
              background: i === data.length - 1 ? 'var(--accent)' : 'color-mix(in oklab, var(--accent) 35%, var(--panel-2))',
              borderRadius: 2,
            }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 5, marginTop: 4 }}>
        {days.map((d, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 9.5, color: 'var(--faint)', fontFamily: "'JetBrains Mono', monospace" }}>{d}</div>
        ))}
      </div>
    </div>
  );
}

// ─── Add / Edit Staff Modal ───────────────────────────────────────────────
type ModalMode = { kind: 'add' } | { kind: 'edit'; member: StaffMember };

function StaffModal({ mode, onClose, onSaved }: {
  mode: ModalMode;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { showToast } = useToast();
  const isAdd = mode.kind === 'add';

  const [fullName, setFullName] = useState(isAdd ? '' : mode.member.full_name);
  const [emailInput, setEmailInput] = useState(isAdd ? '' : mode.member.email);
  const [active, setActive] = useState(isAdd ? true : mode.member.active);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function handleSave() {
    setErr('');
    if (!fullName.trim()) { setErr('Full name is required.'); return; }
    if (isAdd && !emailInput.trim()) { setErr('Email is required.'); return; }
    setSaving(true);
    try {
      if (isAdd) {
        const { error } = await (supabase.from('staff_members') as any)
          .insert({ full_name: fullName.trim(), email: emailInput.trim().toLowerCase(), active: true });
        if (error) throw error;
        showToast(`${fullName.trim()} added to staff`, 'success');
        onSaved();
        onClose();
      } else {
        const table = mode.member.source === 'member' ? 'staff_members' : 'user_profiles';
        const { error } = await (supabase.from(table) as any)
          .update({ full_name: fullName.trim(), active })
          .eq('id', mode.member.id);
        if (error) throw error;
        showToast('Staff member updated', 'success');
        onSaved();
        onClose();
      }
    } catch (e: any) {
      setErr(e?.message ?? 'An error occurred.');
    } finally {
      setSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', height: 36, padding: '0 11px', borderRadius: 7,
    border: '1px solid var(--line)', background: 'var(--panel-2)',
    color: 'var(--ink)', fontSize: 13, outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = {
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
        background: 'var(--panel)', borderRadius: 14, width: '100%', maxWidth: 420,
        boxShadow: '0 24px 64px rgba(0,0,0,0.28)', overflow: 'hidden',
      }}>
        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>
            {isAdd ? 'Add Staff Member' : 'Edit Staff Member'}
          </h2>
          <button onClick={onClose} style={{ border: 0, background: 'transparent', color: 'var(--muted)', cursor: 'pointer', padding: 4, lineHeight: 0, borderRadius: 6 }}>
            <X size={17} />
          </button>
        </div>

        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {err && (
            <div style={{ padding: '10px 12px', borderRadius: 8, background: 'color-mix(in oklab, var(--danger) 10%, var(--panel-2))', color: 'var(--danger)', fontSize: 12.5 }}>
              {err}
            </div>
          )}
          <div>
            <label style={labelStyle}>Full Name</label>
            <input style={inputStyle} value={fullName} onChange={e => setFullName(e.target.value)} placeholder="e.g. Kasun Perera" />
          </div>
          <div>
            <label style={labelStyle}>Email</label>
            <input value={emailInput} onChange={e => isAdd && setEmailInput(e.target.value)}
              placeholder="e.g. kasun@example.com" type="email" disabled={!isAdd}
              style={{ ...inputStyle, opacity: isAdd ? 1 : 0.6 }} />
          </div>
          {!isAdd && (
            <>
              <div style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--panel-2)', border: '1px solid var(--line)', fontSize: 12.5, color: 'var(--muted)' }}>
                {mode.member.source === 'member'
                  ? 'To give system access, use Settings → Staff Access.'
                  : <>Role is managed in <strong style={{ color: 'var(--ink-2)' }}>Settings → Staff Access</strong></>
                }
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 8, background: 'var(--panel-2)', border: '1px solid var(--line)' }}>
                <span style={{ fontSize: 13, color: 'var(--ink)' }}>Active</span>
                <button onClick={() => setActive(v => !v)} style={{
                  width: 40, height: 22, borderRadius: 99, border: 0, cursor: 'pointer',
                  background: active ? 'var(--accent)' : 'var(--faint)',
                  position: 'relative', transition: 'background .15s',
                }}>
                  <span style={{
                    position: 'absolute', top: 3, left: active ? 21 : 3,
                    width: 16, height: 16, borderRadius: '50%', background: '#fff',
                    transition: 'left .15s', boxShadow: '0 1px 3px rgba(0,0,0,.2)',
                  }} />
                </button>
              </div>
            </>
          )}
          {isAdd && (
            <div style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--panel-2)', border: '1px solid var(--line)', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.5 }}>
              Added as <strong style={{ color: 'var(--ink-2)' }}>Staff</strong> — no system login. Upgrade to Cashier or Stock Manager in Settings → Staff Access.
            </div>
          )}
        </div>

        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} className="btn" style={{ height: 34, fontSize: 12.5 }} disabled={saving}>Cancel</button>
          <button onClick={handleSave} className="btn btn-primary" style={{ height: 34, fontSize: 12.5, minWidth: 80 }} disabled={saving}>
            {saving ? 'Saving…' : isAdd ? 'Add Staff' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Detail panel ─────────────────────────────────────────────────────────
function DetailPanel({ member, isAdmin, onEdit, onBack, onTargetSaved, onCommissionRateSaved }: {
  member: StaffMember;
  isAdmin: boolean;
  onEdit: () => void;
  onBack: () => void;
  onTargetSaved: (id: string, target: number) => void;
  onCommissionRateSaved: (id: string, rate: number) => void;
}) {
  const { showToast } = useToast();
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetInput, setTargetInput] = useState(member.daily_target.toString());
  const [savingTarget, setSavingTarget] = useState(false);
  const [editingRate, setEditingRate] = useState(false);
  const [rateInput, setRateInput] = useState(member.commission_rate.toString());
  const [savingRate, setSavingRate] = useState(false);

  useEffect(() => {
    setTargetInput(member.daily_target.toString());
    setEditingTarget(false);
    setRateInput(member.commission_rate.toString());
    setEditingRate(false);
  }, [member.id]);

  async function saveTarget() {
    const val = Math.max(0, Number(targetInput) || 0);
    setSavingTarget(true);
    try {
      const table = member.source === 'member' ? 'staff_members' : 'user_profiles';
      const { error } = await (supabase.from(table) as any)
        .update({ daily_target: val })
        .eq('id', member.id);
      if (error) throw error;
      await (supabase.from('staff_rate_history') as any).upsert({
        staff_id: member.id, staff_source: member.source,
        commission_rate: member.commission_rate, daily_target: val,
        effective_from: new Date().toISOString().split('T')[0],
      }, { onConflict: 'staff_id,effective_from' });
      onTargetSaved(member.id, val);
      setEditingTarget(false);
      showToast('Daily target updated', 'success');
    } catch {
      showToast('Failed to update target', 'error');
    } finally {
      setSavingTarget(false);
    }
  }

  async function saveRate() {
    const val = Math.max(0, Math.min(100, Number(rateInput) || 0));
    setSavingRate(true);
    try {
      const table = member.source === 'member' ? 'staff_members' : 'user_profiles';
      const { error } = await (supabase.from(table) as any)
        .update({ commission_rate: val })
        .eq('id', member.id);
      if (error) throw error;
      await (supabase.from('staff_rate_history') as any).upsert({
        staff_id: member.id, staff_source: member.source,
        commission_rate: val, daily_target: member.daily_target,
        effective_from: new Date().toISOString().split('T')[0],
      }, { onConflict: 'staff_id,effective_from' });
      onCommissionRateSaved(member.id, val);
      setEditingRate(false);
      showToast('Commission rate updated', 'success');
    } catch {
      showToast('Failed to update commission rate', 'error');
    } finally {
      setSavingRate(false);
    }
  }

  const targetPct = member.daily_target > 0
    ? Math.min(100, (member.today.revenue / member.daily_target) * 100)
    : 0;
  const targetMet = member.daily_target > 0 && member.today.revenue >= member.daily_target;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)', padding: '0 0 24px' }}>
      <button className="sh-back" onClick={onBack} style={{
        display: 'none', alignItems: 'center', gap: 6, border: 0, background: 'transparent',
        color: 'var(--accent-ink)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', padding: '4px 0',
      }}>
        <ChevronLeft size={18} strokeWidth={2} /> Back to Staff
      </button>

      {/* Identity card */}
      <div className="card" style={{ padding: '20px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Avatar initials={member.initials} tone={member.tone} size={52} active={member.isActiveToday} />
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)' }}>{member.full_name}</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
                  background: member.role === 'admin' ? 'var(--accent-soft)' : member.role === 'staff' ? 'rgba(20,22,26,0.06)' : 'color-mix(in oklab, var(--warn) 12%, var(--panel-2))',
                  color: member.role === 'admin' ? 'var(--accent-ink)' : member.role === 'staff' ? 'var(--ink-2)' : 'var(--warn)',
                }}>
                  {ROLE_LABEL[member.role]}
                </span>
                {!member.active && (
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: 'rgba(20,22,26,0.06)', color: 'var(--muted)' }}>Inactive</span>
                )}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 4 }}>Joined {fmtJoined(member.created_at)}</div>
            </div>
          </div>
          {isAdmin && (
            <button onClick={onEdit} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px',
              border: '1px solid var(--line)', borderRadius: 7, background: 'var(--panel-2)',
              color: 'var(--ink-2)', fontSize: 12, fontWeight: 500, cursor: 'pointer',
            }}>
              <Pencil size={12} strokeWidth={1.7} /> Edit
            </button>
          )}
        </div>

        <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--line-2)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--ink-2)' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', letterSpacing: '.04em', textTransform: 'uppercase', width: 48, flexShrink: 0 }}>Email</span>
            {member.email
              ? <a href={`mailto:${member.email}`} style={{ color: 'var(--accent-ink)', textDecoration: 'none' }}>{member.email}</a>
              : <span style={{ color: 'var(--faint)' }}>—</span>
            }
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', letterSpacing: '.04em', textTransform: 'uppercase', width: 48, flexShrink: 0 }}>Status</span>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: member.isActiveToday ? 'var(--accent)' : 'var(--faint)', flexShrink: 0 }} />
              <span style={{ fontSize: 12.5, color: member.isActiveToday ? 'var(--accent-ink)' : 'var(--muted)' }}>
                {member.isActiveToday ? 'Active today' : 'No sales today'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Daily target */}
      <div className="card" style={{ padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Target size={14} style={{ color: 'var(--muted)' }} strokeWidth={1.7} />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', letterSpacing: '.03em', textTransform: 'uppercase' }}>Daily Target</span>
          </div>
          {isAdmin && !editingTarget && (
            <button onClick={() => { setTargetInput(member.daily_target.toString()); setEditingTarget(true); }} style={{
              display: 'inline-flex', alignItems: 'center', gap: 5, height: 28, padding: '0 10px',
              border: '1px solid var(--line)', borderRadius: 6, background: 'transparent',
              color: 'var(--ink-2)', fontSize: 11.5, fontWeight: 500, cursor: 'pointer',
            }}>
              <Pencil size={11} strokeWidth={1.7} /> {member.daily_target > 0 ? 'Edit' : 'Set target'}
            </button>
          )}
        </div>

        {editingTarget ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', flex: 1, height: 36, borderRadius: 7, border: '1px solid var(--line)', background: 'var(--panel-2)', overflow: 'hidden' }}>
              <span style={{ padding: '0 10px', fontSize: 12.5, color: 'var(--muted)', borderRight: '1px solid var(--line-2)', height: '100%', display: 'flex', alignItems: 'center', flexShrink: 0 }}>LKR</span>
              <input
                type="number" min={0} step={1000}
                value={targetInput}
                onChange={e => setTargetInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveTarget(); if (e.key === 'Escape') setEditingTarget(false); }}
                autoFocus
                style={{ flex: 1, border: 0, outline: 'none', background: 'transparent', padding: '0 10px', fontSize: 13, color: 'var(--ink)', fontFamily: "'JetBrains Mono',monospace" }}
              />
            </div>
            <button onClick={saveTarget} disabled={savingTarget} style={{
              width: 36, height: 36, borderRadius: 7, border: 0, background: 'var(--accent)', color: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0,
            }}>
              <Check size={15} strokeWidth={2.5} />
            </button>
            <button onClick={() => setEditingTarget(false)} style={{
              width: 36, height: 36, borderRadius: 7, border: '1px solid var(--line)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0,
            }}>
              <X size={14} />
            </button>
          </div>
        ) : member.daily_target > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span className="num" style={{ fontSize: 18, fontWeight: 600, color: targetMet ? 'var(--accent-ink)' : 'var(--ink)', letterSpacing: '-0.02em' }}>
                  {fmtLKR(member.today.revenue)}
                </span>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>of {fmtLKR(member.daily_target)}</span>
              </div>
              <span style={{
                fontSize: 12, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace",
                color: targetMet ? 'var(--accent-ink)' : targetPct >= 70 ? 'var(--warn)' : 'var(--muted)',
              }}>{targetPct.toFixed(0)}%</span>
            </div>
            <div style={{ height: 6, background: 'var(--line-2)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                width: targetPct + '%', height: '100%', borderRadius: 3,
                background: targetMet ? 'var(--accent)' : targetPct >= 70 ? 'var(--warn)' : 'var(--accent)',
                transition: 'width .3s',
              }} />
            </div>
            {targetMet && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--accent-ink)', fontWeight: 600 }}>
                <Check size={12} strokeWidth={2.5} /> Target achieved
              </div>
            )}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--faint)' }}>
            {isAdmin ? 'No target set — click "Set target" above.' : 'No daily target assigned.'}
          </div>
        )}
      </div>

      {/* Commission Rate */}
      <div className="card" style={{ padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrendingUp size={14} style={{ color: 'var(--muted)' }} strokeWidth={1.7} />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', letterSpacing: '.03em', textTransform: 'uppercase' }}>Commission Rate</span>
          </div>
          {isAdmin && !editingRate && (
            <button onClick={() => { setRateInput(member.commission_rate.toString()); setEditingRate(true); }} style={{
              display: 'inline-flex', alignItems: 'center', gap: 5, height: 28, padding: '0 10px',
              border: '1px solid var(--line)', borderRadius: 6, background: 'transparent',
              color: 'var(--ink-2)', fontSize: 11.5, fontWeight: 500, cursor: 'pointer',
            }}>
              <Pencil size={11} strokeWidth={1.7} /> {member.commission_rate > 0 ? 'Edit' : 'Set rate'}
            </button>
          )}
        </div>

        {editingRate ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', flex: 1, height: 36, borderRadius: 7, border: '1px solid var(--line)', background: 'var(--panel-2)', overflow: 'hidden' }}>
              <input
                type="number" min={0} max={100} step={0.5}
                value={rateInput}
                onChange={e => setRateInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveRate(); if (e.key === 'Escape') setEditingRate(false); }}
                autoFocus
                style={{ flex: 1, border: 0, outline: 'none', background: 'transparent', padding: '0 10px', fontSize: 13, color: 'var(--ink)', fontFamily: "'JetBrains Mono',monospace" }}
              />
              <span style={{ padding: '0 10px', fontSize: 12.5, color: 'var(--muted)', borderLeft: '1px solid var(--line-2)', height: '100%', display: 'flex', alignItems: 'center', flexShrink: 0 }}>%</span>
            </div>
            <button onClick={saveRate} disabled={savingRate} style={{
              width: 36, height: 36, borderRadius: 7, border: 0, background: 'var(--accent)', color: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0,
            }}>
              <Check size={15} strokeWidth={2.5} />
            </button>
            <button onClick={() => setEditingRate(false)} style={{
              width: 36, height: 36, borderRadius: 7, border: '1px solid var(--line)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0,
            }}>
              <X size={14} />
            </button>
          </div>
        ) : member.commission_rate > 0 ? (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span className="num" style={{ fontSize: 18, fontWeight: 600, color: 'var(--accent-ink)', letterSpacing: '-0.02em' }}>{member.commission_rate}%</span>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>of qualifying day revenue</span>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--faint)' }}>
            {isAdmin ? 'No rate set — click "Set rate" above.' : 'No commission rate assigned.'}
          </div>
        )}
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--gap)' }}>
        {[
          { label: 'Revenue · Today', value: member.today.revenue > 0 ? fmtLKR(member.today.revenue) : '—', sub: member.today.sales > 0 ? `${member.today.sales} sales` : 'No sales' },
          { label: 'Revenue · MTD', value: member.month.revenue > 0 ? fmtLKR(member.month.revenue) : '—', sub: `${member.month.sales} sales` },
          { label: 'Avg Sale · MTD', value: member.month.sales > 0 ? fmtLKR(member.month.revenue / member.month.sales) : '—', sub: 'per transaction' },
        ].map((s, i) => (
          <div key={i} className="card" style={{ padding: '12px 14px' }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500, marginBottom: 6, letterSpacing: '.03em' }}>{s.label}</div>
            <div className="num" style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.02em', lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 5 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Weekly trend */}
      <div className="card" style={{ padding: '16px 18px' }}>
        <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500, marginBottom: 12 }}>7-day revenue trend</div>
        <MiniBars data={member.week} />
      </div>
    </div>
  );
}

// ─── Commission Report ────────────────────────────────────────────────────
interface DayData {
  date: string;
  revenue: number;
  hit: boolean;
  commission: number;
}

interface CommissionRow {
  member: StaffMember;
  effectiveRate: number;
  effectiveTarget: number;
  days: DayData[];
  totalRevenue: number;
  qualifyingDays: number;
  commissionBase: number;
  commissionAmount: number;
  isPaid: boolean;
}

function monthLabel(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function fmtDay(dateStr: string) {
  const [, m, d] = dateStr.split('-').map(Number);
  return new Date(2000, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function CommissionReport({ staff }: { staff: StaffMember[] }) {
  const { showToast } = useToast();
  const { isAdmin } = useAuth();
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(false);
  const [salesByStaffDay, setSalesByStaffDay] = useState<Record<string, Record<string, number>>>({});
  const [payments, setPayments] = useState<Record<string, boolean>>({});
  const [effectiveRates, setEffectiveRates] = useState<Record<string, { commission_rate: number; daily_target: number }>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState<string | null>(null);
  const [paying, setPaying] = useState<string | null>(null);

  const currentMonth = new Date().toISOString().slice(0, 7);

  const loadCommissionData = useCallback(async () => {
    setLoading(true);
    try {
      const client = (salesService as any).saleRepo.adapter.getClient();
      const [y, m] = month.split('-').map(Number);
      const monthStart = new Date(y, m - 1, 1).toISOString();
      const monthEnd = new Date(y, m, 1).toISOString();
      const monthLastDay = new Date(y, m, 0).toISOString().split('T')[0];

      const [{ data: sales }, { data: paidRecs }, { data: rateHistory }] = await Promise.all([
        client.from('sales')
          .select('cashier_id, total_amount, sale_date')
          .gte('sale_date', monthStart)
          .lt('sale_date', monthEnd)
          .not('cashier_id', 'is', null),
        client.from('staff_commission_payments')
          .select('staff_id')
          .eq('month', month),
        client.from('staff_rate_history')
          .select('staff_id, commission_rate, daily_target, effective_from')
          .lte('effective_from', monthLastDay)
          .order('effective_from', { ascending: false }),
      ]);

      const map: Record<string, Record<string, number>> = {};
      for (const s of (sales ?? [])) {
        const dayStr = new Date(s.sale_date).toISOString().split('T')[0];
        if (!map[s.cashier_id]) map[s.cashier_id] = {};
        map[s.cashier_id][dayStr] = (map[s.cashier_id][dayStr] ?? 0) + Number(s.total_amount);
      }
      setSalesByStaffDay(map);

      const pmap: Record<string, boolean> = {};
      for (const p of (paidRecs ?? [])) pmap[p.staff_id] = true;
      setPayments(pmap);

      // Most recent snapshot per staff member with effective_from <= month end
      const emap: Record<string, { commission_rate: number; daily_target: number }> = {};
      for (const r of (rateHistory ?? [])) {
        if (!emap[r.staff_id]) {
          emap[r.staff_id] = { commission_rate: Number(r.commission_rate), daily_target: Number(r.daily_target) };
        }
      }
      setEffectiveRates(emap);
    } catch {
      showToast('Failed to load commission data', 'error');
    } finally {
      setLoading(false);
    }
  }, [month, showToast]);

  useEffect(() => { loadCommissionData(); }, [loadCommissionData]);

  const rows = useMemo((): CommissionRow[] => {
    const [y, m] = month.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const today = new Date().toISOString().slice(0, 10);
    const isCurrentMonth = month === currentMonth;

    return staff.map(member => {
      const snap = effectiveRates[member.id];
      // Fall back to current values if no history snapshot exists for this month
      const effectiveRate = snap?.commission_rate ?? member.commission_rate;
      const effectiveTarget = snap?.daily_target ?? member.daily_target;

      const salesMap = salesByStaffDay[member.id] ?? {};
      const days: DayData[] = [];

      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        if (isCurrentMonth && dateStr > today) break;

        const revenue = salesMap[dateStr] ?? 0;
        const hit = effectiveTarget > 0 && revenue >= effectiveTarget;
        const commission = hit ? revenue * (effectiveRate / 100) : 0;
        days.push({ date: dateStr, revenue, hit, commission });
      }

      const qualifyingDays = days.filter(d => d.hit).length;
      const commissionBase = days.reduce((s, d) => s + (d.hit ? d.revenue : 0), 0);
      const commissionAmount = commissionBase * (effectiveRate / 100);
      const totalRevenue = days.reduce((s, d) => s + d.revenue, 0);

      return {
        member,
        effectiveRate,
        effectiveTarget,
        days,
        totalRevenue,
        qualifyingDays,
        commissionBase,
        commissionAmount,
        isPaid: !!payments[member.id],
      };
    }).sort((a, b) => b.commissionAmount - a.commissionAmount);
  }, [staff, month, salesByStaffDay, payments, effectiveRates, currentMonth]);

  const totalDue = rows.reduce((s, r) => s + r.commissionAmount, 0);
  const totalPaid = rows.filter(r => r.isPaid).reduce((s, r) => s + r.commissionAmount, 0);
  const pendingPayout = totalDue - totalPaid;
  const earningCount = rows.filter(r => r.commissionAmount > 0).length;

  async function markPaid(row: CommissionRow) {
    setPaying(row.member.id);
    try {
      const client = (salesService as any).saleRepo.adapter.getClient();
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await (client.from('staff_commission_payments') as any).insert({
        staff_id: row.member.id,
        staff_source: row.member.source,
        month,
        commission_amount: Math.round(row.commissionAmount * 100) / 100,
        paid_by: user?.id ?? null,
      });
      if (error) throw error;
      showToast(`Commission marked as paid for ${row.member.full_name}`, 'success');
      setConfirming(null);
      loadCommissionData();
    } catch (e: any) {
      showToast(e?.message ?? 'Failed to mark as paid', 'error');
    } finally {
      setPaying(null);
    }
  }

  function navMonth(delta: number) {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMonth(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'));
    setExpanded(new Set());
    setConfirming(null);
  }

  const colTemplate = '1fr 60px 110px 130px 120px 90px 100px';

  const headerCellStyle: React.CSSProperties = {
    fontSize: 10.5, fontWeight: 600, color: 'var(--muted)',
    letterSpacing: '.04em', textTransform: 'uppercase',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Month nav + print */}
      <div className="commission-print-hide" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => navMonth(-1)} style={{
            width: 32, height: 32, borderRadius: 8, border: '1px solid var(--line)',
            background: 'var(--panel-2)', cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--ink-2)',
          }}>
            <ChevronLeft size={15} />
          </button>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', minWidth: 130, textAlign: 'center' }}>
            {monthLabel(month)}
          </span>
          <button onClick={() => navMonth(1)} disabled={month >= currentMonth} style={{
            width: 32, height: 32, borderRadius: 8, border: '1px solid var(--line)',
            background: 'var(--panel-2)', cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--ink-2)',
            opacity: month >= currentMonth ? 0.35 : 1,
          }}>
            <ChevronRight size={15} />
          </button>
        </div>
        {/* <button onClick={() => window.print()} className="btn" style={{ height: 34, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
          <Printer size={13} /> Print Report
        </button> */}
      </div>

      {/* Print header (only visible in print) */}
      <div className="commission-print-only" style={{ display: 'none' }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700 }}>Commission Report — {monthLabel(month)}</h2>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>Generated {new Date().toLocaleDateString('en-US', { dateStyle: 'long' })}</p>
      </div>

      {/* KPI strip */}
      <div className="rpt-kpi rpt-kpi-4">
        {[
          { label: 'Total Commissions Due', value: fmtLKR(totalDue), sub: monthLabel(month) },
          { label: 'Staff Earning', value: earningCount.toString(), sub: 'with commission > 0' },
          { label: 'Total Paid', value: fmtLKR(totalPaid), sub: 'marked as paid' },
          { label: 'Pending Payout', value: fmtLKR(pendingPayout), sub: 'awaiting payment' },
        ].map((k, i) => (
          <div key={i} className="card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>{k.label}</span>
            <div className="num" style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.05, color: 'var(--ink)' }}>{k.value}</div>
            <div style={{ fontSize: 11.5, color: 'var(--faint)', fontWeight: 500 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Commission table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {/* Table header */}
        <div style={{
          display: 'grid', gridTemplateColumns: colTemplate,
          padding: '10px 16px', borderBottom: '1px solid var(--line)', background: 'var(--panel-2)',
          gap: 8,
        }}>
          {['Staff', 'Rate', 'Revenue', 'Qualifying Days', 'Commission', 'Status', ''].map((h, i) => (
            <div key={i} style={headerCellStyle}>{h}</div>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Loading…</div>
        ) : rows.map((row, i) => {
          const isExpanded = expanded.has(row.member.id);
          const isConfirming = confirming === row.member.id;
          const isPaying = paying === row.member.id;
          const hasTarget = row.effectiveTarget > 0;
          const hasRate = row.effectiveRate > 0;

          return (
            <div key={row.member.id} style={{ borderBottom: i < rows.length - 1 ? '1px solid var(--line-2)' : 'none' }}>
              {/* Main row */}
              <div style={{
                display: 'grid', gridTemplateColumns: colTemplate,
                padding: '12px 16px', alignItems: 'center', gap: 8,
              }}>
                {/* Staff */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <Avatar initials={row.member.initials} tone={row.member.tone} size={32} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {row.member.full_name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{ROLE_LABEL[row.member.role]}</div>
                  </div>
                </div>
                {/* Rate */}
                <div className="num" style={{ fontSize: 12.5, color: hasRate ? 'var(--ink-2)' : 'var(--faint)' }}>
                  {hasRate ? `${row.effectiveRate}%` : '—'}
                </div>
                {/* Revenue */}
                <div className="num" style={{ fontSize: 12.5, color: row.totalRevenue > 0 ? 'var(--ink-2)' : 'var(--faint)' }}>
                  {row.totalRevenue > 0 ? fmtLKR(row.totalRevenue) : '—'}
                </div>
                {/* Qualifying Days */}
                <div style={{ fontSize: 12.5 }}>
                  {hasTarget
                    ? <span style={{ color: 'var(--ink-2)' }}>{row.qualifyingDays} <span style={{ color: 'var(--faint)', fontSize: 11 }}>/ {row.days.length} days</span></span>
                    : <span style={{ color: 'var(--faint)', fontSize: 12 }}>No target</span>}
                </div>
                {/* Commission */}
                <div className="num" style={{
                  fontSize: 13, fontWeight: 600,
                  color: row.commissionAmount > 0 ? 'var(--accent-ink)' : 'var(--faint)',
                }}>
                  {row.commissionAmount > 0 ? fmtLKR(row.commissionAmount) : '—'}
                </div>
                {/* Status */}
                <div>
                  {row.isPaid ? (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5,
                      fontWeight: 600, color: 'var(--accent-ink)', padding: '3px 8px',
                      borderRadius: 999, background: 'var(--accent-soft)',
                    }}>
                      <Check size={10} strokeWidth={2.5} /> Paid
                    </span>
                  ) : row.commissionAmount > 0 ? (
                    <span style={{ fontSize: 11.5, color: 'var(--warn)', fontWeight: 500 }}>Pending</span>
                  ) : (
                    <span style={{ fontSize: 11.5, color: 'var(--faint)' }}>—</span>
                  )}
                </div>
                {/* Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} className="commission-print-hide">
                  {isAdmin && !row.isPaid && row.commissionAmount > 0 && !isConfirming && (
                    <button onClick={() => setConfirming(row.member.id)} className="btn" style={{ height: 28, padding: '0 10px', fontSize: 11.5 }}>
                      Pay
                    </button>
                  )}
                  <button
                    onClick={() => setExpanded(prev => {
                      const s = new Set(prev);
                      s.has(row.member.id) ? s.delete(row.member.id) : s.add(row.member.id);
                      return s;
                    })}
                    style={{
                      width: 28, height: 28, borderRadius: 6, border: '1px solid var(--line)',
                      background: isExpanded ? 'var(--panel-2)' : 'transparent',
                      cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--muted)',
                    }}
                  >
                    <ChevronDown size={14} style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
                  </button>
                </div>
              </div>

              {/* Pay confirmation */}
              {isConfirming && (
                <div className="commission-print-hide" style={{
                  margin: '0 16px 12px', padding: '10px 14px', borderRadius: 8,
                  background: 'color-mix(in oklab, var(--accent) 8%, var(--panel-2))',
                  border: '1px solid color-mix(in oklab, var(--accent) 40%, transparent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
                }}>
                  <span style={{ fontSize: 12.5, color: 'var(--ink)' }}>
                    Mark <strong>{fmtLKR(row.commissionAmount)}</strong> as paid for <strong>{row.member.full_name}</strong> — {monthLabel(month)}?
                  </span>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => markPaid(row)} disabled={isPaying} className="btn btn-primary" style={{ height: 30, fontSize: 12, padding: '0 12px' }}>
                      {isPaying ? 'Saving…' : 'Confirm'}
                    </button>
                    <button onClick={() => setConfirming(null)} className="btn" style={{ height: 30, fontSize: 12, padding: '0 10px' }}>Cancel</button>
                  </div>
                </div>
              )}

              {/* Day-by-day breakdown */}
              {isExpanded && (
                <div style={{ margin: '0 16px 14px', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--line)' }}>
                  {/* Breakdown header */}
                  <div style={{
                    display: 'grid', gridTemplateColumns: '110px 1fr 1fr 50px 1fr',
                    background: 'var(--panel-2)', padding: '8px 14px', borderBottom: '1px solid var(--line)', gap: 8,
                  }}>
                    {['Date', 'Revenue', 'Target', 'Hit?', 'Commission'].map(h => (
                      <div key={h} style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', letterSpacing: '.04em', textTransform: 'uppercase' }}>{h}</div>
                    ))}
                  </div>

                  {row.days.map((day, di) => (
                    <div key={day.date} style={{
                      display: 'grid', gridTemplateColumns: '110px 1fr 1fr 50px 1fr',
                      padding: '8px 14px', gap: 8,
                      background: day.hit
                        ? 'color-mix(in oklab, var(--accent) 5%, var(--panel))'
                        : 'var(--panel)',
                      borderBottom: di < row.days.length - 1 ? '1px solid var(--line-2)' : 'none',
                    }}>
                      <div style={{ fontSize: 12, color: day.hit ? 'var(--ink)' : 'var(--ink-2)', fontWeight: day.hit ? 600 : 400 }}>
                        {fmtDay(day.date)}
                      </div>
                      <div className="num" style={{ fontSize: 12, color: day.revenue > 0 ? 'var(--ink)' : 'var(--faint)' }}>
                        {day.revenue > 0 ? fmtLKR(day.revenue) : '—'}
                      </div>
                      <div className="num" style={{ fontSize: 12, color: 'var(--muted)' }}>
                        {hasTarget ? fmtLKR(row.effectiveTarget) : '—'}
                      </div>
                      <div style={{ fontSize: 13 }}>
                        {!hasTarget
                          ? <span style={{ color: 'var(--faint)' }}>—</span>
                          : day.hit
                            ? <span style={{ color: 'var(--accent-ink)', fontWeight: 700 }}>✓</span>
                            : <span style={{ color: 'var(--faint)' }}>✗</span>}
                      </div>
                      <div className="num" style={{
                        fontSize: 12,
                        color: day.commission > 0 ? 'var(--accent-ink)' : 'var(--faint)',
                        fontWeight: day.commission > 0 ? 600 : 400,
                      }}>
                        {day.commission > 0 ? fmtLKR(day.commission) : '—'}
                      </div>
                    </div>
                  ))}

                  {/* Totals row */}
                  <div style={{
                    display: 'grid', gridTemplateColumns: '110px 1fr 1fr 50px 1fr',
                    padding: '9px 14px', borderTop: '2px solid var(--line)', background: 'var(--panel-2)', gap: 8,
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-2)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Total</div>
                    <div className="num" style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>
                      {fmtLKR(row.totalRevenue)}
                    </div>
                    <div />
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)' }}>{row.qualifyingDays}d</div>
                    <div className="num" style={{ fontSize: 12, fontWeight: 700, color: row.commissionAmount > 0 ? 'var(--accent-ink)' : 'var(--faint)' }}>
                      {row.commissionAmount > 0 ? fmtLKR(row.commissionAmount) : '—'}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────
export function SalesStaff() {
  const { showToast } = useToast();
  const { isAdmin } = useAuth();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [selected, setSelected] = useState<StaffMember | null>(null);
  const [modal, setModal] = useState<ModalMode | null>(null);
  const [sort, setSort] = useState<'revenue' | 'sales' | 'name'>('revenue');
  const [tab, setTab] = useState<'staff' | 'commission'>('staff');

  const load = useCallback(async () => {
    try {
      const client = (salesService as any).saleRepo.adapter.getClient();

      const [{ data: profiles }, { data: members }] = await Promise.all([
        client.from('user_profiles').select('*').order('created_at'),
        client.from('staff_members').select('*').order('created_at'),
      ]);

      const today = new Date().toISOString().split('T')[0];
      const monthStart = today.slice(0, 7) + '-01';
      const weekDays: string[] = [];
      for (let d = 6; d >= 0; d--) {
        const dt = new Date(); dt.setDate(dt.getDate() - d);
        weekDays.push(dt.toISOString().split('T')[0]);
      }

      const [{ data: todaySales }, { data: monthSales }, { data: weekSales }] = await Promise.all([
        client.from('sales').select('cashier_id, total_amount').gte('sale_date', today).not('cashier_id', 'is', null),
        client.from('sales').select('cashier_id, total_amount').gte('sale_date', monthStart).not('cashier_id', 'is', null),
        client.from('sales').select('cashier_id, total_amount, sale_date').gte('sale_date', weekDays[0]).not('cashier_id', 'is', null),
      ]);

      const todayMap: Record<string, { sales: number; revenue: number }> = {};
      const monthMap: Record<string, { sales: number; revenue: number }> = {};
      const weekMap: Record<string, number[]> = {};

      for (const s of (todaySales ?? [])) {
        const id = s.cashier_id;
        if (!todayMap[id]) todayMap[id] = { sales: 0, revenue: 0 };
        todayMap[id].sales++;
        todayMap[id].revenue += Number(s.total_amount);
      }
      for (const s of (monthSales ?? [])) {
        const id = s.cashier_id;
        if (!monthMap[id]) monthMap[id] = { sales: 0, revenue: 0 };
        monthMap[id].sales++;
        monthMap[id].revenue += Number(s.total_amount);
      }
      for (const s of (weekSales ?? [])) {
        const id = s.cashier_id;
        if (!weekMap[id]) weekMap[id] = new Array(7).fill(0);
        const dayStr = new Date(s.sale_date).toISOString().split('T')[0];
        const idx = weekDays.indexOf(dayStr);
        if (idx >= 0) weekMap[id][idx] += Number(s.total_amount);
      }

      const enrich = (u: any, role: StaffRole, source: StaffSource): StaffMember => ({
        ...u,
        role,
        source,
        daily_target: u.daily_target ?? 0,
        commission_rate: u.commission_rate ?? 0,
        initials: getInitials(u.full_name),
        tone: getTone(u.full_name),
        today: todayMap[u.id] ?? { sales: 0, revenue: 0 },
        month: monthMap[u.id] ?? { sales: 0, revenue: 0 },
        week: weekMap[u.id] ?? new Array(7).fill(0),
        isActiveToday: !!(todayMap[u.id]?.sales),
      });

      const enriched: StaffMember[] = [
        ...(profiles ?? []).map((p: any) => enrich(p, p.role as StaffRole, 'profile')),
        ...(members ?? []).map((m: any) => enrich(m, 'staff', 'member')),
      ];

      setStaff(enriched);
      setSelected(prev => prev ? (enriched.find(s => s.id === prev.id) ?? null) : null);
    } catch {
      showToast('Failed to load staff data', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const roles = ['All', 'admin', 'cashier', 'stock_manager', 'staff'].filter(r =>
    r === 'All' || staff.some(s => s.role === r)
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    let rows = staff.filter(s => {
      if (roleFilter !== 'All' && s.role !== roleFilter) return false;
      if (q && !(s.full_name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q))) return false;
      return true;
    });
    return rows.sort((a, b) => {
      if (sort === 'name') return a.full_name.localeCompare(b.full_name);
      if (sort === 'sales') return b.month.sales - a.month.sales;
      return b.month.revenue - a.month.revenue;
    });
  }, [staff, search, roleFilter, sort]);

  const activeToday = staff.filter(s => s.isActiveToday).length;
  const totalRevToday = staff.reduce((s, m) => s + m.today.revenue, 0);
  const totalRevMTD = staff.reduce((s, m) => s + m.month.revenue, 0);

  if (loading) return <LoadingSpinner message="Loading staff data…" />;

  return (
    <div className="sh-outer" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Header */}
      <div style={{ padding: '24px 0 0', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)' }}>Sales Staff</h1>
          <p style={{ margin: '6px 0 0', fontSize: 13.5, color: 'var(--muted)' }}>
            <span style={{ color: 'var(--ink-2)', fontWeight: 500 }}>{staff.length} team members</span>{' · '}
            <span style={{ color: 'var(--ink-2)', fontWeight: 500 }}>{activeToday} active today</span>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {isAdmin && tab === 'staff' && (
            <button onClick={() => setModal({ kind: 'add' })} className="btn btn-primary" style={{ height: 36, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Plus size={14} /> Add Staff
            </button>
          )}
          {/* Tab switcher */}
          <div style={{ display: 'flex', gap: 2, padding: '2px', borderRadius: 9, background: 'var(--panel-2)', border: '1px solid var(--line)' }}>
            {([['staff', 'Staff'], ['commission', 'Commission']] as const).map(([t, l]) => (
              <button key={t} onClick={() => setTab(t)} style={{
                height: 30, padding: '0 14px', borderRadius: 7, border: 0,
                background: tab === t ? 'var(--panel)' : 'transparent',
                color: tab === t ? 'var(--ink)' : 'var(--muted)',
                fontSize: 12.5, fontWeight: tab === t ? 600 : 500, cursor: 'pointer',
                boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,.08)' : 'none',
                transition: 'all .1s',
              }}>{l}</button>
            ))}
          </div>
        </div>
      </div>

      {tab === 'commission' ? (
        <CommissionReport staff={staff} />
      ) : (
        <>
          {/* KPI row */}
          <div className="rpt-kpi rpt-kpi-4">
            {[
              { label: 'Total Staff', value: staff.length.toString(), sub: `${staff.filter(s => s.source === 'profile').length} with system access` },
              { label: 'Active Today', value: activeToday.toString(), sub: `of ${staff.length} staff` },
              { label: 'Revenue · Today', value: 'LKR ' + fmtK(totalRevToday), sub: 'all cashiers combined' },
              { label: 'Revenue · MTD', value: 'LKR ' + fmtK(totalRevMTD), sub: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) },
            ].map((k, i) => (
              <div key={i} className="card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>{k.label}</span>
                <div className="num" style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.05, color: 'var(--ink)' }}>{k.value}</div>
                <div style={{ fontSize: 11.5, color: 'var(--faint)', fontWeight: 500 }}>{k.sub}</div>
              </div>
            ))}
          </div>

          {/* Split layout */}
          <div className={`sh-split ${selected ? 'sh-detail-active' : ''}`}>
            {/* Left: list */}
            <div className="sh-list" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="card" style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10, height: 36, padding: '0 12px',
                  borderRadius: 8, background: 'var(--panel-2)', border: '1px solid var(--line)',
                }}>
                  <Search size={15} style={{ color: 'var(--muted)', flexShrink: 0 }} strokeWidth={1.6} />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or email…"
                    style={{ flex: 1, border: 0, outline: 'none', background: 'transparent', fontSize: 13, color: 'var(--ink)', minWidth: 0 }} />
                  {search && (
                    <button onClick={() => setSearch('')} style={{ border: 0, background: 'transparent', color: 'var(--faint)', cursor: 'pointer', padding: 0, lineHeight: 0 }}>
                      <X size={14} />
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {([['revenue', 'Top Revenue'], ['sales', 'Most Sales'], ['name', 'A–Z']] as const).map(([k, l]) => (
                    <button key={k} onClick={() => setSort(k)} style={{
                      flex: 1, height: 28, borderRadius: 6,
                      border: sort === k ? '1.5px solid var(--accent)' : '1px solid var(--line)',
                      background: sort === k ? 'var(--accent-soft)' : 'var(--panel-2)',
                      color: sort === k ? 'var(--accent-ink)' : 'var(--ink-2)',
                      fontSize: 11.5, fontWeight: sort === k ? 600 : 500, cursor: 'pointer',
                    }}>{l}</button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {roles.map(r => {
                    const isA = r === roleFilter;
                    const count = r === 'All' ? staff.length : staff.filter(s => s.role === r).length;
                    return (
                      <button key={r} onClick={() => setRoleFilter(r)} style={{
                        padding: '4px 10px', borderRadius: 999,
                        border: isA ? '1px solid var(--accent)' : '1px solid var(--line)',
                        background: isA ? 'var(--accent-soft)' : 'var(--panel)',
                        color: isA ? 'var(--accent-ink)' : 'var(--ink-2)',
                        fontSize: 11.5, fontWeight: isA ? 600 : 500, cursor: 'pointer',
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                      }}>
                        {r === 'All' ? 'All' : ROLE_LABEL[r as StaffRole]}
                        <span className="num" style={{ fontSize: 10.5, color: isA ? 'inherit' : 'var(--faint)' }}>{count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {filtered.length === 0 ? (
                  <div style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
                    <Users size={28} style={{ color: 'var(--faint)', marginBottom: 10 }} />
                    <div>No staff found</div>
                  </div>
                ) : filtered.map((s, i) => {
                  const isSelected = selected?.id === s.id;
                  return (
                    <div key={s.id} onClick={() => setSelected(isSelected ? null : s)} style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', cursor: 'pointer',
                      borderBottom: i < filtered.length - 1 ? '1px solid var(--line-2)' : 'none',
                      background: isSelected ? 'color-mix(in oklab, var(--accent) 6%, var(--panel))' : 'transparent',
                      borderLeft: isSelected ? '2.5px solid var(--accent)' : '2.5px solid transparent',
                      transition: 'background .1s',
                    }}
                      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--panel-2)'; }}
                      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <Avatar initials={s.initials} tone={s.tone} size={38} active={s.isActiveToday} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: s.active ? 'var(--ink)' : 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {s.full_name}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, display: 'flex', gap: 6, alignItems: 'center' }}>
                          <span>{ROLE_LABEL[s.role]}</span>
                          {s.isActiveToday && (
                            <>
                              <span style={{ color: 'var(--faint)' }}>·</span>
                              <span style={{ color: 'var(--accent-ink)', fontWeight: 500 }}>Active today</span>
                            </>
                          )}
                          {!s.active && (
                            <>
                              <span style={{ color: 'var(--faint)' }}>·</span>
                              <span style={{ color: 'var(--faint)' }}>Inactive</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        {s.month.revenue > 0 ? (
                          <div className="num" style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)' }}>LKR {fmtK(s.month.revenue)}</div>
                        ) : (
                          <div style={{ fontSize: 11, color: 'var(--faint)' }}>No sales</div>
                        )}
                        <ChevronRight size={14} style={{ color: 'var(--faint)', marginTop: 2 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: detail */}
            <div className="sh-detail">
              {selected ? (
                <DetailPanel
                  member={selected}
                  isAdmin={isAdmin}
                  onEdit={() => setModal({ kind: 'edit', member: selected })}
                  onBack={() => setSelected(null)}
                  onTargetSaved={(id, target) => {
                    setStaff(prev => prev.map(s => s.id === id ? { ...s, daily_target: target } : s));
                    setSelected(prev => prev?.id === id ? { ...prev, daily_target: target } : prev);
                  }}
                  onCommissionRateSaved={(id, rate) => {
                    setStaff(prev => prev.map(s => s.id === id ? { ...s, commission_rate: rate } : s));
                    setSelected(prev => prev?.id === id ? { ...prev, commission_rate: rate } : prev);
                  }}
                />
              ) : (
                <div className="card" style={{ display: 'grid', placeItems: 'center', minHeight: 300, color: 'var(--muted)' }}>
                  <div style={{ textAlign: 'center' }}>
                    <Users size={32} style={{ color: 'var(--faint)', marginBottom: 12 }} />
                    <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ink-2)' }}>Select a staff member</div>
                    <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 6 }}>Tap any row to view performance details</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {modal && (
        <StaffModal
          mode={modal}
          onClose={() => setModal(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}
