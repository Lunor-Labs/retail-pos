import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { supabase } from '../lib/supabase';
import { KeyRound, Users, Star, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { loyaltyService } from '../services';

type UserProfile = {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'cashier';
  active: boolean;
  created_at: string;
};

type SectionId = 'account' | 'users' | 'loyalty';

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

// ─── Section: System Users ────────────────────────────────────────────────
function UsersSection({ currentUserId }: { currentUserId: string }) {
  const { showToast } = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadUsers() {
    const { data } = await supabase.from('user_profiles').select('*').order('created_at', { ascending: false });
    setUsers((data ?? []) as UserProfile[]);
    setLoading(false);
  }

  useEffect(() => { loadUsers(); }, []);

  async function toggleStatus(user: UserProfile) {
    try {
      const { error } = await (supabase.from('user_profiles') as any)
        .update({ active: !user.active })
        .eq('id', user.id);
      if (error) throw error;
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, active: !u.active } : u));
      showToast(`${user.full_name} ${!user.active ? 'activated' : 'deactivated'}`, 'success');
    } catch (e: any) {
      showToast(e?.message ?? 'Failed to update user', 'error');
    }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Loading…</div>;

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>System Users</div>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>
            {users.length} accounts · {users.filter(u => u.active).length} active
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--muted)' }}>
          <Users size={14} strokeWidth={1.6} />
          Manage roles in Sales Staff
        </div>
      </div>

      {/* Column headers — desktop only */}
      <div className="settings-user-row settings-col-header" style={{ background: 'var(--panel-2)', borderBottom: '1px solid var(--line-2)' }}>
        {['User', 'Role', 'Status', ''].map((h, i) => (
          <div key={i} style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--muted)', letterSpacing: '.06em', textTransform: 'uppercase', textAlign: i > 1 ? 'right' : 'left' }}>{h}</div>
        ))}
      </div>

      {users.length === 0 ? (
        <div style={{ padding: '40px 22px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>No users found</div>
      ) : users.map((user, i) => {
        const isSelf = user.id === currentUserId;
        const roleChip = (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600,
            background: user.role === 'admin' ? 'var(--accent-soft)' : 'rgba(20,22,26,0.06)',
            color: user.role === 'admin' ? 'var(--accent-ink)' : 'var(--ink-2)',
            textTransform: 'capitalize',
          }}>
            {user.role === 'admin' && <ShieldCheck size={10} strokeWidth={2} />}
            {user.role}
          </span>
        );
        const statusChip = (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600,
            background: user.active ? 'var(--accent-soft)' : 'rgba(20,22,26,0.06)',
            color: user.active ? 'var(--accent-ink)' : 'var(--muted)',
          }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: user.active ? 'var(--accent)' : 'var(--faint)', flexShrink: 0 }} />
            {user.active ? 'Active' : 'Inactive'}
          </span>
        );
        return (
          <div key={user.id} className="settings-user-row" style={{ borderBottom: i < users.length - 1 ? '1px solid var(--line-2)' : 'none' }}>
            {/* User */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
              <Avatar name={user.full_name} size={34} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.full_name}</span>
                  {isSelf && <span style={{ fontSize: 10, fontWeight: 600, background: 'var(--accent-soft)', color: 'var(--accent-ink)', padding: '1px 6px', borderRadius: 999, flexShrink: 0 }}>You</span>}
                </div>
                <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 2, fontFamily: "'JetBrains Mono', monospace", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
                {/* Chips visible on mobile only */}
                <div className="settings-user-chips">{roleChip}{statusChip}</div>
              </div>
            </div>

            {/* Role — desktop only */}
            <div className="settings-col-role">{roleChip}</div>

            {/* Status — desktop only */}
            <div className="settings-col-status" style={{ textAlign: 'right' }}>{statusChip}</div>

            {/* Action */}
            <div style={{ textAlign: 'right' }}>
              {!isSelf && (
                <button onClick={() => toggleStatus(user)} style={{
                  height: 30, padding: '0 12px', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 500,
                  border: user.active
                    ? '1px solid color-mix(in oklab, var(--danger) 35%, var(--line))'
                    : '1px solid var(--line)',
                  background: 'transparent',
                  color: user.active ? 'var(--danger)' : 'var(--accent-ink)',
                  transition: 'all .12s', whiteSpace: 'nowrap',
                }}>
                  {user.active ? 'Deactivate' : 'Activate'}
                </button>
              )}
            </div>
          </div>
        );
      })}
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
    { id: 'users', label: 'System Users', icon: <Users size={15} strokeWidth={1.7} />, adminOnly: true },
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
          {section === 'users' && isAdmin && <UsersSection currentUserId={profile.id} />}
          {section === 'loyalty' && isAdmin && <LoyaltySection />}
        </div>
      </div>
    </div>
  );
}
