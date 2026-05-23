import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import loginImage from '../assets/login-new.jpg';
import logo from '../assets/revonlak.jpeg';

export function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(email, password);
    } catch (err: any) {
      setError(err.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: 44,
    padding: '0 12px',
    border: '1px solid var(--line)',
    borderRadius: 10,
    fontSize: 16,
    color: 'var(--ink)',
    background: 'var(--panel)',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color .15s',
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0E0F12' }}>

      {/* ── Left brand panel ───────────────────────────────── */}
      <div style={{
        display: 'none',
        position: 'relative',
        overflow: 'hidden',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '40px 44px',
        flex: '0 0 52%',
      }} className="login-left">

        {/* Background image */}
        <img
          src={loginImage}
          alt=""
          aria-hidden
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />

        {/* Gradient overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(160deg, rgba(10,12,14,0.72) 0%, rgba(10,12,14,0.45) 50%, rgba(10,12,14,0.8) 100%)',
        }} />

        {/* Content */}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src={logo} alt="RIVONLAK" style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover' }} />
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', letterSpacing: '-0.01em' }}>RIVONLAK</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 1 }}>Clothing Retail Shop</div>
            </div>
          </div>

          {/* Tagline */}
          <div>
            <p style={{ fontSize: 38, fontWeight: 800, color: '#fff', lineHeight: 1.15, letterSpacing: '-0.03em', marginBottom: 16 }}>
              Drive your<br />business<br />forward.
            </p>
            <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, maxWidth: 340 }}>
              Manage inventory, process sales, and track performance — all from one place.
            </p>
          </div>
        </div>
      </div>

      {/* ── Right form panel ───────────────────────────────── */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 24px',
        background: 'var(--bg)',
      }}>
        <div style={{ width: '100%', maxWidth: 380 }}>

          {/* Mobile logo */}
          <div className="login-mobile-logo" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
            <img src={logo} alt="RIVONLAK" style={{ width: 40, height: 40, borderRadius: 9, objectFit: 'cover' }} />
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em' }}>RIVONLAK</div>
              <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>Clothing Retail Shop</div>
            </div>
          </div>

          {/* Heading */}
          <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.02em', marginBottom: 6 }}>
            Welcome back
          </h1>
          <p style={{ fontSize: 13.5, color: 'var(--muted)', marginBottom: 28 }}>
            Sign in to your account to continue.
          </p>

          {/* Error */}
          {error && (
            <div style={{
              background: 'var(--danger-soft)', border: '1px solid rgba(176,52,31,0.2)',
              color: 'var(--danger)', borderRadius: 9, padding: '10px 14px',
              fontSize: 13, marginBottom: 18,
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Email */}
            <div>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 6 }}>
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                onBlur={e => (e.target.style.borderColor = 'var(--line)')}
              />
            </div>

            {/* Password */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)' }}>
                  Password
                </label>
                <button
                  type="button"
                  style={{ fontSize: 12, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}
                  onClick={() => setShowPw(v => !v)}
                >
                  {showPw ? 'Hide' : 'Show'}
                </button>
              </div>
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                onBlur={e => (e.target.style.borderColor = 'var(--line)')}
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
              style={{
                width: '100%', height: 44, borderRadius: 10, marginTop: 4,
                fontSize: 14.5, fontWeight: 700, letterSpacing: '-0.01em',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                border: 'none',
                justifyContent: 'center',
              }}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          {/* Demo credentials */}
          <div style={{
            marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--line)',
            fontSize: 12, color: 'var(--muted)', textAlign: 'center', lineHeight: 1.7,
          }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--ink-2)' }}>admin@chameera.lk</span>
            {' '}·{' '}
            <span style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--ink-2)' }}>admin@123</span>
          </div>
        </div>
      </div>

      <style>{`
        @media (min-width: 768px) {
          .login-left { display: flex !important; }
          .login-mobile-logo { display: none !important; }
        }
      `}</style>
    </div>
  );
}
