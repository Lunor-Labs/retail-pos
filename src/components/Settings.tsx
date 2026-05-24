import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { supabase } from '../lib/supabase';
import { KeyRound, Users, Star, ShieldCheck, Eye, EyeOff, X, ChevronDown, Check, Tag, Pencil } from 'lucide-react';
import { loyaltyService, referenceDataService } from '../services';
import type { RefType, ReferenceItem } from '../services';

type UserProfile = {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'cashier' | 'stock_manager' | 'staff';
  active: boolean;
  created_at: string;
};

type UnifiedStaff = {
  id: string;
  full_name: string;
  email: string;
  role: 'staff' | 'cashier' | 'stock_manager' | 'admin';
  active: boolean;
  source: 'profile' | 'member';
};

const ROLE_CONFIG: Record<UnifiedStaff['role'], { label: string; desc: string; bg: string; color: string }> = {
  staff:         { label: 'Staff',         desc: 'No system access',     bg: 'rgba(20,22,26,0.07)',                                  color: 'var(--ink-2)' },
  cashier:       { label: 'Cashier',       desc: 'POS access',           bg: 'color-mix(in oklab, var(--warn) 13%, var(--panel-2))', color: '#8A5E00' },
  stock_manager: { label: 'Stock Manager', desc: 'Products & inventory', bg: 'color-mix(in oklab, #3340A6 11%, var(--panel-2))',     color: '#3340A6' },
  admin:         { label: 'Admin',         desc: 'Full access',          bg: 'var(--accent-soft)',                                   color: 'var(--accent-ink)' },
};

type SectionId = 'account' | 'staff-access' | 'loyalty' | 'catalog';

// ─── Helpers ─────────────────────────────────────────────────────────────
const TONES = ['#1B6B4F','#3A4E6B','#7A2235','#6A7048','#22324F','#B89456','#5C6675','#8A9078'];
function getTone(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xfffff;
  return TONES[h % TONES.length];
}
function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase();
}
function fmtJoined(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

// ─── Avatar ──────────────────────────────────────────────────────────────
function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const tone = getTone(name);
  const initials = getInitials(name);
  const fontSize = size >= 44 ? 15 : size >= 36 ? 13 : 12;
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: `linear-gradient(135deg, ${tone}, color-mix(in oklab, ${tone} 65%, #000))`,
      color: '#fff', display: 'grid', placeItems: 'center',
      fontWeight: 600, fontSize, letterSpacing: '-0.01em',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,.18)',
    }}>{initials}</div>
  );
}

// ─── Shared input style ───────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: '100%', height: 38, padding: '0 11px', borderRadius: 8,
  border: '1px solid var(--line)', background: 'var(--panel-2)',
  color: 'var(--ink)', fontSize: 13.5, outline: 'none', boxSizing: 'border-box',
};
const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 6,
  display: 'block', letterSpacing: '.06em', textTransform: 'uppercase',
};

// ─── Section: Account ─────────────────────────────────────────────────────
function AccountSection({ profile }: { profile: UserProfile }) {
  const { showToast } = useToast();
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function handlePasswordUpdate(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    if (newPw.length < 6) { setErr('Password must be at least 6 characters.'); return; }
    if (newPw !== confirmPw) { setErr('Passwords do not match.'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) throw error;
      setNewPw(''); setConfirmPw('');
      showToast('Password updated successfully', 'success');
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to update password.');
    } finally {
      setSaving(false);
    }
  }

  const pwInput = (value: string, setter: (v: string) => void, show: boolean, toggleShow: () => void, placeholder: string) => (
    <div style={{ position: 'relative' }}>
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => setter(e.target.value)}
        placeholder={placeholder}
        style={{ ...inputStyle, paddingRight: 40 }}
      />
      <button type="button" onClick={toggleShow} style={{
        position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
        border: 0, background: 'transparent', color: 'var(--muted)', cursor: 'pointer', padding: 2, lineHeight: 0,
      }}>
        {show ? <EyeOff size={15} strokeWidth={1.6} /> : <Eye size={15} strokeWidth={1.6} />}
      </button>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
      {/* Profile card */}
      <div className="card" style={{ padding: '22px 24px' }}>
        <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 16 }}>Profile</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Avatar name={profile.full_name} size={56} />
          <div>
            <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{profile.full_name}</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 3 }}>{profile.email}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '3px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 600,
                background: profile.role === 'admin' ? 'var(--accent-soft)' : 'rgba(20,22,26,0.06)',
                color: profile.role === 'admin' ? 'var(--accent-ink)' : 'var(--ink-2)',
                textTransform: 'capitalize',
              }}>
                {profile.role === 'admin' && <ShieldCheck size={11} strokeWidth={2} />}
                {profile.role}
              </span>
              <span style={{ fontSize: 12, color: 'var(--faint)' }}>Member since {fmtJoined(profile.created_at)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Change password */}
      <div className="card" style={{ padding: '22px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--panel-2)', border: '1px solid var(--line)', display: 'grid', placeItems: 'center' }}>
            <KeyRound size={15} style={{ color: 'var(--ink-2)' }} strokeWidth={1.7} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>Change Password</div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>Set a new password for your account</div>
          </div>
        </div>

        <form onSubmit={handlePasswordUpdate} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {err && (
            <div style={{ padding: '10px 13px', borderRadius: 8, background: 'color-mix(in oklab, var(--danger) 10%, var(--panel-2))', color: 'var(--danger)', fontSize: 12.5 }}>
              {err}
            </div>
          )}
          <div>
            <label style={labelStyle}>New Password</label>
            {pwInput(newPw, setNewPw, showNew, () => setShowNew(v => !v), 'Minimum 6 characters')}
          </div>
          <div>
            <label style={labelStyle}>Confirm Password</label>
            {pwInput(confirmPw, setConfirmPw, showConfirm, () => setShowConfirm(v => !v), 'Repeat new password')}
          </div>
          <div>
            <button type="submit" className="btn btn-primary" style={{ height: 38, fontSize: 13, minWidth: 160 }} disabled={saving}>
              {saving ? 'Updating…' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Role Dropdown ────────────────────────────────────────────────────────
function RoleDropdown({ item, isSelf, onChange }: {
  item: UnifiedStaff;
  isSelf: boolean;
  onChange: (role: UnifiedStaff['role']) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const cfg = ROLE_CONFIG[item.role];
  const roles = Object.entries(ROLE_CONFIG) as [UnifiedStaff['role'], typeof ROLE_CONFIG[keyof typeof ROLE_CONFIG]][];

  function handleOpen() {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 6, right: window.innerWidth - r.right });
    }
    setOpen(v => !v);
  }

  if (isSelf) {
    return (
      <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 600, background: cfg.bg, color: cfg.color }}>
        {cfg.label}
      </span>
    );
  }

  return (
    <div>
      <button ref={btnRef} onClick={handleOpen} style={{
        padding: '3px 8px 3px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 600,
        background: cfg.bg, color: cfg.color, border: 0, cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', gap: 3,
      }}>
        {cfg.label}
        <ChevronDown size={11} strokeWidth={2.2} style={{ opacity: 0.7, marginTop: 0.5 }} />
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 100 }} onClick={() => setOpen(false)} />
          <div style={{
            position: 'fixed', top: pos.top, right: pos.right, zIndex: 101,
            background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 10,
            boxShadow: '0 8px 24px rgba(20,22,26,0.14)', padding: 5, minWidth: 190,
          }}>
            {roles.map(([r, c]) => {
              const isActive = r === item.role;
              return (
                <button key={r} onClick={() => { setOpen(false); if (!isActive) onChange(r); }} style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 10px', borderRadius: 7, border: 0, cursor: 'pointer', textAlign: 'left',
                  background: isActive ? 'var(--panel-2)' : 'transparent',
                }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--panel-2)'; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: isActive ? 600 : 500, color: 'var(--ink)' }}>{c.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{c.desc}</div>
                  </div>
                  {isActive && <Check size={13} strokeWidth={2.5} style={{ color: 'var(--accent)', flexShrink: 0 }} />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Grant Access Modal (upgrade staff → system role) ────────────────────
function GrantAccessModal({ item, targetRole, onClose, onDone }: {
  item: UnifiedStaff;
  targetRole: 'cashier' | 'stock_manager' | 'admin';
  onClose: () => void;
  onDone: () => void;
}) {
  const { createUser } = useAuth();
  const { showToast } = useToast();
  const cfg = ROLE_CONFIG[targetRole];

  const isReactivate = item.source === 'profile'; // previously had access
  const [email, setEmail] = useState(item.email);
  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function handleGrant() {
    setErr('');
    if (!email.trim()) { setErr('Email is required.'); return; }
    if (!isReactivate) {
      if (password.length < 6) { setErr('Password must be at least 6 characters.'); return; }
      if (password !== confirmPw) { setErr('Passwords do not match.'); return; }
    }
    setSaving(true);
    try {
      if (isReactivate) {
        const updates: any = { role: targetRole, active: true };
        if (password.length >= 6) updates.password = password; // only if provided
        const { error } = await (supabase.from('user_profiles') as any)
          .update({ role: targetRole, active: true })
          .eq('id', item.id);
        if (error) throw error;
        if (password.length >= 6) {
          // update auth password via admin — best effort, ignore if fails
          await supabase.auth.resetPasswordForEmail(email).catch(() => {});
        }
      } else {
        await createUser(email.trim(), password, item.full_name, targetRole);
        await (supabase.from('staff_members') as any).delete().eq('id', item.id);
      }
      showToast(`${item.full_name} now has ${cfg.label} access`, 'success');
      onDone();
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to grant access.');
    } finally {
      setSaving(false);
    }
  }

  const field = (label: string, value: string, setter: (v: string) => void, type = 'text', extra?: React.ReactNode) => (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 5, letterSpacing: '.06em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ position: 'relative' }}>
        <input type={type === 'password' && showPw ? 'text' : type} value={value}
          onChange={e => setter(e.target.value)}
          style={{ width: '100%', height: 36, padding: '0 11px', borderRadius: 7, border: '1px solid var(--line)', background: 'var(--panel-2)', color: 'var(--ink)', fontSize: 13, outline: 'none', boxSizing: 'border-box', paddingRight: extra ? 40 : 11 }} />
        {extra}
      </div>
    </div>
  );

  const eyeBtn = (
    <button type="button" onClick={() => setShowPw(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', border: 0, background: 'transparent', color: 'var(--muted)', cursor: 'pointer', padding: 2, lineHeight: 0 }}>
      {showPw ? <EyeOff size={14} strokeWidth={1.6} /> : <Eye size={14} strokeWidth={1.6} />}
    </button>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(10,12,15,0.55)', backdropFilter: 'blur(4px)', display: 'grid', placeItems: 'center', padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: 'var(--panel)', borderRadius: 14, width: '100%', maxWidth: 420, boxShadow: '0 24px 64px rgba(0,0,0,0.28)', overflow: 'hidden' }}>
        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>
              {isReactivate ? 'Restore Access' : 'Grant System Access'}
            </h2>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>
              {item.full_name} → <span style={{ fontWeight: 600, color: cfg.color }}>{cfg.label}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ border: 0, background: 'transparent', color: 'var(--muted)', cursor: 'pointer', padding: 4, lineHeight: 0, borderRadius: 6 }}>
            <X size={17} />
          </button>
        </div>

        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {err && <div style={{ padding: '10px 12px', borderRadius: 8, background: 'color-mix(in oklab, var(--danger) 10%, var(--panel-2))', color: 'var(--danger)', fontSize: 12.5 }}>{err}</div>}

          {field('Login Email', email, setEmail, isReactivate ? 'email' : 'email')}

          {field('Password', password, setPassword, 'password', eyeBtn)}

          {!isReactivate && field('Confirm Password', confirmPw, setConfirmPw, 'password', eyeBtn)}

          {isReactivate && (
            <div style={{ fontSize: 12, color: 'var(--muted)', padding: '8px 12px', borderRadius: 8, background: 'var(--panel-2)', border: '1px solid var(--line)', lineHeight: 1.5 }}>
              Leave password blank to keep their existing password.
            </div>
          )}
        </div>

        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} className="btn" style={{ height: 34, fontSize: 12.5 }} disabled={saving}>Cancel</button>
          <button onClick={handleGrant} className="btn btn-primary" style={{ height: 34, fontSize: 12.5, minWidth: 110 }} disabled={saving}>
            {saving ? 'Saving…' : isReactivate ? 'Restore Access' : 'Grant Access'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Downgrade Confirm ────────────────────────────────────────────────────
function DowngradeConfirm({ item, onClose, onDone }: {
  item: UnifiedStaff;
  onClose: () => void;
  onDone: () => void;
}) {
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);

  async function handleDowngrade() {
    setSaving(true);
    try {
      const { error } = await (supabase.from('user_profiles') as any)
        .update({ role: 'staff', active: false })
        .eq('id', item.id);
      if (error) throw error;
      showToast(`${item.full_name} moved to Staff — access removed`, 'success');
      onDone();
    } catch (e: any) {
      showToast(e?.message ?? 'Failed to remove access', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(10,12,15,0.55)', backdropFilter: 'blur(4px)', display: 'grid', placeItems: 'center', padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: 'var(--panel)', borderRadius: 14, width: '100%', maxWidth: 400, boxShadow: '0 24px 64px rgba(0,0,0,0.28)', overflow: 'hidden' }}>
        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>Remove System Access</h2>
          <button onClick={onClose} style={{ border: 0, background: 'transparent', color: 'var(--muted)', cursor: 'pointer', padding: 4, lineHeight: 0, borderRadius: 6 }}><X size={17} /></button>
        </div>
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.6 }}>
            Remove system access for <strong>{item.full_name}</strong>? They'll be moved back to <strong>Staff</strong> and won't be able to log in.
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', padding: '10px 13px', borderRadius: 8, background: 'var(--panel-2)', border: '1px solid var(--line)' }}>
            You can restore their access at any time from this page.
          </div>
        </div>
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} className="btn" style={{ height: 34, fontSize: 12.5 }} disabled={saving}>Cancel</button>
          <button onClick={handleDowngrade} className="btn" style={{ height: 34, fontSize: 12.5, minWidth: 110, background: 'color-mix(in oklab, var(--danger) 10%, var(--panel-2))', color: 'var(--danger)', border: '1px solid color-mix(in oklab, var(--danger) 30%, var(--line))' }} disabled={saving}>
            {saving ? 'Removing…' : 'Remove Access'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Section: Staff Access ────────────────────────────────────────────────
function StaffAccessSection({ currentUserId }: { currentUserId: string }) {
  const { showToast } = useToast();
  const [staff, setStaff] = useState<UnifiedStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [grantModal, setGrantModal] = useState<{ item: UnifiedStaff; targetRole: 'cashier' | 'stock_manager' | 'admin' } | null>(null);
  const [downgradeModal, setDowngradeModal] = useState<UnifiedStaff | null>(null);

  async function load() {
    setLoading(true);
    const [{ data: profiles }, { data: members }] = await Promise.all([
      supabase.from('user_profiles').select('id, email, full_name, role, active, created_at').order('full_name'),
      (supabase.from('staff_members') as any).select('id, email, full_name, active, created_at').order('full_name'),
    ]);

    const profileList: UnifiedStaff[] = (profiles ?? []).map((p: any) => ({
      id: p.id,
      full_name: p.full_name,
      email: p.email,
      role: p.role as UnifiedStaff['role'],
      active: p.active,
      source: 'profile' as const,
    }));

    const memberList: UnifiedStaff[] = (members ?? []).map((m: any) => ({
      id: m.id,
      full_name: m.full_name,
      email: m.email || '',
      role: 'staff' as const,
      active: m.active,
      source: 'member' as const,
    }));

    const combined = [...profileList, ...memberList].sort((a, b) => a.full_name.localeCompare(b.full_name));
    setStaff(combined);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function handleRoleChange(item: UnifiedStaff, newRole: UnifiedStaff['role']) {
    if (newRole === 'staff') {
      if (item.source === 'profile' && item.role !== 'staff') {
        setDowngradeModal(item);
      }
    } else if (item.source === 'member' || (item.source === 'profile' && item.role === 'staff')) {
      setGrantModal({ item, targetRole: newRole as 'cashier' | 'stock_manager' | 'admin' });
    } else {
      updateSystemRole(item, newRole as 'cashier' | 'stock_manager' | 'admin');
    }
  }

  async function updateSystemRole(item: UnifiedStaff, newRole: 'cashier' | 'stock_manager' | 'admin') {
    setSaving(prev => ({ ...prev, [item.id]: true }));
    try {
      const { error } = await (supabase.from('user_profiles') as any)
        .update({ role: newRole })
        .eq('id', item.id);
      if (error) throw error;
      setStaff(prev => prev.map(s => s.id === item.id ? { ...s, role: newRole } : s));
      showToast(`${item.full_name} is now ${ROLE_CONFIG[newRole].label}`, 'success');
    } catch (e: any) {
      showToast(e?.message ?? 'Failed to update role', 'error');
    } finally {
      setSaving(prev => ({ ...prev, [item.id]: false }));
    }
  }

  async function toggleActive(item: UnifiedStaff) {
    setSaving(prev => ({ ...prev, [item.id + '_t']: true }));
    try {
      const table = item.source === 'profile' ? 'user_profiles' : 'staff_members';
      const { error } = await (supabase.from(table) as any)
        .update({ active: !item.active })
        .eq('id', item.id);
      if (error) throw error;
      setStaff(prev => prev.map(s => s.id === item.id ? { ...s, active: !s.active } : s));
      showToast(`${item.full_name} ${!item.active ? 'activated' : 'deactivated'}`, 'success');
    } catch (e: any) {
      showToast(e?.message ?? 'Failed to update status', 'error');
    } finally {
      setSaving(prev => ({ ...prev, [item.id + '_t']: false }));
    }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Loading…</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>All Staff</div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>Manage roles and system access for all team members</div>
          </div>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', background: 'rgba(20,22,26,0.06)', padding: '3px 9px', borderRadius: 999 }}>{staff.length}</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '8px 16px', padding: '8px 22px', background: 'var(--panel-2)', borderBottom: '1px solid var(--line-2)' }}>
          {['Staff member', 'Role', 'Active'].map((h, i) => (
            <div key={i} style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--muted)', letterSpacing: '.06em', textTransform: 'uppercase', textAlign: i > 0 ? 'right' : 'left' }}>{h}</div>
          ))}
        </div>

        {staff.length === 0 ? (
          <div style={{ padding: '40px 22px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>No staff yet</div>
        ) : staff.map((item, i) => {
          const isSelf = item.id === currentUserId;
          const isSaving = saving[item.id] || saving[item.id + '_t'];
          return (
            <div key={item.id} style={{
              display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '8px 16px',
              alignItems: 'center', padding: '13px 22px',
              borderBottom: i < staff.length - 1 ? '1px solid var(--line-2)' : 'none',
              opacity: isSaving ? 0.6 : 1, transition: 'opacity .15s',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
                <Avatar name={item.full_name} size={34} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.full_name}</span>
                    {isSelf && <span style={{ fontSize: 10, fontWeight: 600, background: 'var(--accent-soft)', color: 'var(--accent-ink)', padding: '1px 6px', borderRadius: 999, flexShrink: 0 }}>You</span>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 2, fontFamily: "'JetBrains Mono',monospace", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.email || '—'}</div>
                </div>
              </div>

              <RoleDropdown item={item} isSelf={isSelf} onChange={(role) => handleRoleChange(item, role)} />

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                {isSelf ? (
                  <span style={{ fontSize: 12, color: 'var(--faint)' }}>—</span>
                ) : (
                  <button onClick={() => toggleActive(item)} disabled={isSaving} style={{
                    width: 40, height: 22, borderRadius: 99, border: 0, cursor: 'pointer',
                    background: item.active ? 'var(--accent)' : 'var(--faint)',
                    position: 'relative', transition: 'background .15s',
                  }}>
                    <span style={{
                      position: 'absolute', top: 3, left: item.active ? 21 : 3,
                      width: 16, height: 16, borderRadius: '50%', background: '#fff',
                      transition: 'left .15s', boxShadow: '0 1px 3px rgba(0,0,0,.2)',
                    }} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {grantModal && (
        <GrantAccessModal
          item={grantModal.item}
          targetRole={grantModal.targetRole}
          onClose={() => setGrantModal(null)}
          onDone={() => { setGrantModal(null); load(); }}
        />
      )}

      {downgradeModal && (
        <DowngradeConfirm
          item={downgradeModal}
          onClose={() => setDowngradeModal(null)}
          onDone={() => { setDowngradeModal(null); load(); }}
        />
      )}
    </div>
  );
}

// ─── Section: Catalog ─────────────────────────────────────────────────────
const CATALOG_TABS: { type: RefType; label: string }[] = [
  { type: 'brand',        label: 'Brands' },
  { type: 'category',     label: 'Categories' },
  { type: 'material',     label: 'Materials' },
  { type: 'product_name', label: 'Product Names' },
];

function CatalogSection() {
  const { showToast } = useToast();
  const [activeType, setActiveType] = useState<RefType>('brand');
  const [items, setItems] = useState<ReferenceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  async function load(type: RefType) {
    setLoading(true);
    try {
      setItems(await referenceDataService.getByType(type));
    } catch {
      showToast('Failed to load catalog data', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(activeType); }, [activeType]);

  async function handleAdd() {
    const name = newName.trim();
    if (!name) return;
    setAdding(true);
    try {
      const item = await referenceDataService.add(activeType, name);
      setItems(prev => [...prev, item].sort((a, b) => a.name.localeCompare(b.name)));
      setNewName('');
    } catch (e: any) {
      showToast(e?.message?.includes('unique') ? 'Already exists' : (e?.message ?? 'Failed to add'), 'error');
    } finally {
      setAdding(false);
    }
  }

  async function handleRename(id: string) {
    const name = editName.trim();
    if (!name) return;
    setSaving(prev => ({ ...prev, [id]: true }));
    try {
      await referenceDataService.rename(id, name);
      setItems(prev => prev.map(i => i.id === id ? { ...i, name } : i).sort((a, b) => a.name.localeCompare(b.name)));
      setEditId(null);
    } catch (e: any) {
      showToast(e?.message ?? 'Failed to rename', 'error');
    } finally {
      setSaving(prev => ({ ...prev, [id]: false }));
    }
  }

  async function handleToggle(item: ReferenceItem) {
    setSaving(prev => ({ ...prev, [item.id]: true }));
    try {
      await referenceDataService.setActive(item.id, !item.active);
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, active: !i.active } : i));
    } catch (e: any) {
      showToast(e?.message ?? 'Failed to update', 'error');
    } finally {
      setSaving(prev => ({ ...prev, [item.id]: false }));
    }
  }

  const active = items.filter(i => i.active);
  const inactive = items.filter(i => !i.active);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--line)', padding: '0 4px' }}>
          {CATALOG_TABS.map(tab => {
            const isActive = tab.type === activeType;
            return (
              <button key={tab.type} onClick={() => { setActiveType(tab.type); setEditId(null); setNewName(''); }} style={{
                padding: '12px 16px', border: 0, background: 'transparent', cursor: 'pointer',
                fontSize: 13, fontWeight: isActive ? 600 : 500,
                color: isActive ? 'var(--accent-ink)' : 'var(--ink-2)',
                borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                marginBottom: -1, transition: 'color .1s',
              }}>
                {tab.label}
                <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 500, color: isActive ? 'var(--accent)' : 'var(--faint)', background: isActive ? 'var(--accent-soft)' : 'rgba(20,22,26,0.06)', padding: '1px 6px', borderRadius: 999 }}>
                  {items.filter(i => i.active).length || 0}
                </span>
              </button>
            );
          })}
        </div>

        {/* Add new */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--line-2)', display: 'flex', gap: 8 }}>
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
            placeholder={`Add new ${CATALOG_TABS.find(t => t.type === activeType)?.label.slice(0, -1).toLowerCase()}…`}
            style={{ flex: 1, height: 34, padding: '0 10px', borderRadius: 7, border: '1px solid var(--line)', background: 'var(--panel-2)', color: 'var(--ink)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
          />
          <button onClick={handleAdd} disabled={!newName.trim() || adding} className="btn btn-primary" style={{ height: 34, fontSize: 12.5, minWidth: 72 }}>
            {adding ? '…' : '+ Add'}
          </button>
        </div>

        {/* List */}
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Loading…</div>
        ) : items.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
            No {CATALOG_TABS.find(t => t.type === activeType)?.label.toLowerCase()} yet — add one above
          </div>
        ) : (
          <div>
            {[...active, ...inactive].map((item, i) => {
              const isEditing = editId === item.id;
              const isSaving = saving[item.id];
              return (
                <div key={item.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px',
                  borderBottom: i < items.length - 1 ? '1px solid var(--line-2)' : 'none',
                  opacity: isSaving ? 0.6 : item.active ? 1 : 0.45, transition: 'opacity .15s',
                }}>
                  {isEditing ? (
                    <>
                      <input
                        autoFocus
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleRename(item.id); if (e.key === 'Escape') setEditId(null); }}
                        style={{ flex: 1, height: 30, padding: '0 9px', borderRadius: 6, border: '1px solid var(--accent)', background: 'var(--panel-2)', color: 'var(--ink)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                      />
                      <button onClick={() => handleRename(item.id)} disabled={isSaving} className="btn btn-primary" style={{ height: 28, fontSize: 12, padding: '0 10px' }}>Save</button>
                      <button onClick={() => setEditId(null)} className="btn" style={{ height: 28, fontSize: 12, padding: '0 10px' }}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <span style={{ flex: 1, fontSize: 13, color: 'var(--ink)', fontWeight: 500 }}>{item.name}</span>
                      <button onClick={() => { setEditId(item.id); setEditName(item.name); }} style={{ border: 0, background: 'transparent', cursor: 'pointer', padding: 4, color: 'var(--muted)', lineHeight: 0, borderRadius: 5 }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--panel-2)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <Pencil size={13} strokeWidth={1.8} />
                      </button>
                      <button onClick={() => handleToggle(item)} disabled={isSaving} style={{
                        width: 36, height: 20, borderRadius: 99, border: 0, cursor: 'pointer',
                        background: item.active ? 'var(--accent)' : 'var(--faint)',
                        position: 'relative', transition: 'background .15s', flexShrink: 0,
                      }}>
                        <span style={{
                          position: 'absolute', top: 2, left: item.active ? 18 : 2,
                          width: 16, height: 16, borderRadius: '50%', background: '#fff',
                          transition: 'left .15s', boxShadow: '0 1px 3px rgba(0,0,0,.2)',
                        }} />
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Section: Loyalty ─────────────────────────────────────────────────────
function LoyaltySection() {
  const { showToast } = useToast();
  const [earnRate, setEarnRate] = useState(100);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loyaltyService.getEarnRate().then(r => { setEarnRate(r); setLoaded(true); }).catch(() => setLoaded(true));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await loyaltyService.setEarnRate(earnRate);
      showToast('Loyalty settings saved', 'success');
    } catch {
      showToast('Failed to save loyalty settings', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
      <div className="card" style={{ padding: '22px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: 'color-mix(in oklab, var(--warn) 12%, var(--panel-2))', border: '1px solid color-mix(in oklab, var(--warn) 20%, var(--line))', display: 'grid', placeItems: 'center' }}>
            <Star size={15} style={{ color: 'var(--warn)', fill: 'var(--warn)' }} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>Loyalty Points</div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>Configure how customers earn and redeem points</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 420 }}>
          <div>
            <label style={labelStyle}>Earn Rate (LKR per 1 point)</label>
            <input
              type="number" min={1} step={1} value={earnRate}
              onChange={e => setEarnRate(Math.max(1, Number(e.target.value) || 1))}
              disabled={!loaded}
              style={inputStyle}
            />
          </div>

          {/* Preview card */}
          <div style={{ padding: '14px 16px', borderRadius: 10, background: 'var(--panel-2)', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', letterSpacing: '.04em', textTransform: 'uppercase' }}>Preview</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { spend: 1000, pts: Math.floor(1000 / earnRate) },
                { spend: 5000, pts: Math.floor(5000 / earnRate) },
                { spend: 10000, pts: Math.floor(10000 / earnRate) },
              ].map(({ spend, pts }) => (
                <div key={spend} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, alignItems: 'center' }}>
                  <span style={{ color: 'var(--muted)' }}>Spend <span className="num" style={{ color: 'var(--ink)', fontWeight: 500 }}>LKR {spend.toLocaleString()}</span></span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'color-mix(in oklab, var(--warn) 10%, var(--panel))', color: 'var(--warn)', padding: '2px 9px', borderRadius: 999, fontSize: 12, fontWeight: 600 }}>
                    <Star size={10} strokeWidth={2} fill="currentColor" />
                    {pts} pts
                  </span>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--faint)', paddingTop: 8, borderTop: '1px solid var(--line-2)' }}>
              1 point = LKR 1 discount at redemption
            </div>
          </div>

          <button onClick={handleSave} disabled={saving || !loaded} className="btn btn-primary" style={{ height: 38, fontSize: 13, alignSelf: 'flex-start', minWidth: 160 }}>
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────
export function Settings() {
  const { profile } = useAuth();
  const [section, setSection] = useState<SectionId>('account');

  if (!profile) return null;

  const isAdmin = profile.role === 'admin';

  const NAV: { id: SectionId; label: string; icon: React.ReactNode; adminOnly?: boolean }[] = [
    { id: 'account', label: 'Account', icon: <KeyRound size={15} strokeWidth={1.7} /> },
    { id: 'staff-access', label: 'Staff Access', icon: <Users size={15} strokeWidth={1.7} />, adminOnly: true },
    { id: 'catalog', label: 'Catalog', icon: <Tag size={15} strokeWidth={1.7} />, adminOnly: true },
    { id: 'loyalty', label: 'Loyalty', icon: <Star size={15} strokeWidth={1.7} />, adminOnly: true },
  ].filter(n => !n.adminOnly || isAdmin);

  return (
    <div className="sh-outer" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Header */}
      <div style={{ paddingTop: 24 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)' }}>Settings</h1>
        <p style={{ margin: '6px 0 0', fontSize: 13.5, color: 'var(--muted)' }}>Manage your account, users, and store configuration</p>
      </div>

      {/* Layout */}
      <div className="settings-layout">
        {/* Nav */}
        <div className="card settings-nav">
          {NAV.map(n => {
            const isA = section === n.id;
            return (
              <button key={n.id} onClick={() => setSection(n.id)} style={{
                textAlign: 'left', padding: '9px 12px',
                borderRadius: 7, border: 0, cursor: 'pointer',
                background: isA ? 'var(--accent-soft)' : 'transparent',
                color: isA ? 'var(--accent-ink)' : 'var(--ink-2)',
                fontSize: 13, fontWeight: isA ? 600 : 500,
                display: 'flex', alignItems: 'center', gap: 9,
                transition: 'background .1s',
              }}
                onMouseEnter={e => { if (!isA) e.currentTarget.style.background = 'var(--panel-2)'; }}
                onMouseLeave={e => { if (!isA) e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ opacity: isA ? 1 : 0.7 }}>{n.icon}</span>
                {n.label}
              </button>
            );
          })}
        </div>

        {/* Section content */}
        <div>
          {section === 'account' && <AccountSection profile={profile as UserProfile} />}
          {section === 'staff-access' && isAdmin && <StaffAccessSection currentUserId={profile.id} />}
          {section === 'catalog' && isAdmin && <CatalogSection />}
          {section === 'loyalty' && isAdmin && <LoyaltySection />}
        </div>
      </div>
    </div>
  );
}
