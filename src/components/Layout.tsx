import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  Package,
  ShoppingCart,
  Users,
  Truck,
  FileText,
  RotateCcw,
  TrendingUp,
  Menu,
  X,
  BarChart3,
  UserCheck,
  Settings,
  LogOut,
  Bell,
  Search,
} from 'lucide-react';
import revonlakLogo from '../assets/revonlak.jpeg';

interface LayoutProps {
  children: React.ReactNode;
  currentView: string;
  onNavigate: (view: string) => void;
}

type NavItem = { id: string; label: string; Icon: React.ElementType; roles: string[]; desktopOnly?: boolean };

const NAV_GROUPS: { label: string | null; items: NavItem[] }[] = [
  {
    label: null,
    items: [
      { id: 'dashboard', label: 'Dashboard', Icon: BarChart3, roles: ['admin', 'cashier'] },
    ],
  },
  {
    label: 'Operations',
    items: [
      { id: 'pos',      label: 'Point of Sale', Icon: ShoppingCart, roles: ['admin', 'cashier'], desktopOnly: true },
      { id: 'products', label: 'Products',       Icon: Package,     roles: ['admin', 'cashier'] },
      { id: 'returns',  label: 'Returns',        Icon: RotateCcw,   roles: ['admin', 'cashier'] },
    ],
  },
  {
    label: 'Parties',
    items: [
      { id: 'customers',       label: 'Customers',  Icon: Users,    roles: ['admin', 'cashier'] },
      { id: 'suppliers',       label: 'Suppliers',  Icon: Truck,    roles: ['admin', 'cashier'] },
      { id: 'referral-agents', label: 'Sales Staff', Icon: UserCheck, roles: ['admin'] },
    ],
  },
  {
    label: 'Insights',
    items: [
      { id: 'sales-history', label: 'Sales History', Icon: FileText,   roles: ['admin', 'cashier'] },
      { id: 'reports',       label: 'Reports',       Icon: TrendingUp, roles: ['admin'] },
    ],
  },
  {
    label: 'System',
    items: [
      { id: 'settings', label: 'Settings', Icon: Settings, roles: ['admin'] },
    ],
  },
];

export function Layout({ children, currentView, onNavigate }: LayoutProps) {
  const { profile, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const role = profile?.role || '';
  const initials = profile?.full_name
    ?.split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'U';

  const currentLabel = NAV_GROUPS
    .flatMap((g) => g.items)
    .find((i) => i.id === currentView)?.label ?? 'Dashboard';

  return (
    <div className="flex" style={{ background: 'var(--bg)', height: '100vh', overflow: 'hidden' }}>
      {/* Mobile overlay */}
      <div
        className={`fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity duration-300 ${
          sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 flex flex-col transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
        style={{ width: 232, flexShrink: 0, height: '100vh', overflowY: 'hidden', background: 'var(--sidebar)', color: 'var(--sidebar-ink)', borderRight: '1px solid rgba(255,255,255,0.05)' }}
      >
        {/* Brand */}
        <div style={{ padding: '18px 18px 14px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <img
            src={revonlakLogo}
            alt="RIVONLAK"
            style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'cover', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.18)' }}
          />
          <div style={{ lineHeight: 1.1 }}>
            <div style={{ fontWeight: 600, fontSize: 13.5, letterSpacing: '-0.01em' }}>Rivonlak</div>
            <div style={{ fontSize: 11, color: 'var(--sidebar-muted)', marginTop: 2 }}>Fashion · Colombo</div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden"
            style={{ marginLeft: 'auto', color: 'var(--sidebar-muted)', background: 'transparent', border: 0, padding: 0, lineHeight: 0 }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '12px 14px 6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 32, padding: '0 10px', borderRadius: 7, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'var(--sidebar-muted)', fontSize: 12.5 }}>
            <Search size={14} />
            <span style={{ flex: 1 }}>Search…</span>
            <span className="kbd" style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.06)', color: 'var(--sidebar-muted)' }}>⌘K</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto custom-scrollbar" style={{ padding: '8px 10px 12px' }}>
          {NAV_GROUPS.map((group, gi) => {
            const visible = group.items.filter((it) => it.roles.includes(role));
            if (visible.length === 0) return null;
            return (
              <div key={gi} style={{ marginTop: group.label ? 14 : 4 }}>
                {group.label && (
                  <div style={{ padding: '6px 8px', fontSize: 10.5, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(126,132,141,.85)' }}>
                    {group.label}
                  </div>
                )}
                {visible.map((item) => {
                  const isActive = currentView === item.id;
                  const { Icon } = item;
                  return (
                    <button
                      key={item.id}
                      onClick={() => { onNavigate(item.id); setSidebarOpen(false); }}
                      className={item.desktopOnly ? 'nav-desktop-only' : ''}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '7px 10px',
                        borderRadius: 7,
                        border: 0,
                        cursor: 'default',
                        background: isActive ? 'rgba(255,255,255,0.06)' : 'transparent',
                        color: isActive ? '#fff' : 'rgba(230,231,233,.78)',
                        fontSize: 13,
                        fontWeight: isActive ? 500 : 400,
                        position: 'relative',
                        textAlign: 'left',
                        transition: 'background .12s ease, color .12s ease',
                        marginBottom: 1,
                      }}
                      onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                      onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                    >
                      {isActive && (
                        <span style={{ position: 'absolute', left: -10, top: '50%', transform: 'translateY(-50%)', width: 3, height: 18, borderRadius: '0 2px 2px 0', background: 'var(--accent)' }} />
                      )}
                      <Icon size={16} strokeWidth={1.7} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div style={{ padding: '10px 12px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg,#3A4E6B,#1B2433)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
            {initials}
          </div>
          <div style={{ lineHeight: 1.15, flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 500, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile?.full_name}</div>
            <div style={{ fontSize: 11, color: 'var(--sidebar-muted)', textTransform: 'capitalize' }}>{profile?.role}</div>
          </div>
          <button
            onClick={signOut}
            title="Sign out"
            style={{ color: 'var(--sidebar-muted)', background: 'transparent', border: 0, padding: 0, width: 28, height: 28, display: 'grid', placeItems: 'center', lineHeight: 0, borderRadius: 6, transition: 'color .12s' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--sidebar-muted)')}
          >
            <LogOut size={15} />
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header
          className="sticky top-0 z-30"
          style={{ height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', background: 'rgba(247,246,242,0.85)', backdropFilter: 'blur(8px)', borderBottom: '1px solid var(--line)' }}
        >
          {/* Mobile toggle */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden"
            style={{ color: 'var(--muted)', background: 'transparent', border: 0, padding: 4, marginLeft: -4, lineHeight: 0 }}
          >
            <Menu size={22} />
          </button>

          {/* Desktop breadcrumb */}
          <div className="hidden lg:flex items-center gap-2" style={{ fontSize: 13, color: 'var(--muted)' }}>
            <span>Overview</span>
            <span style={{ color: 'var(--faint)' }}>·</span>
            <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{currentLabel}</span>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2 ml-auto">
            {/* Notifications */}
            <button
              className="relative"
              style={{ width: 34, height: 34, borderRadius: 8, border: '1px solid var(--line)', background: 'var(--panel)', color: 'var(--muted)', display: 'grid', placeItems: 'center', lineHeight: 0 }}
            >
              <span
                className="absolute"
                style={{ top: 7, right: 7, width: 7, height: 7, background: 'var(--danger)', borderRadius: '50%', border: '1.5px solid var(--bg)' }}
              />
              <Bell size={15} />
            </button>

            {/* Profile */}
            <div className="relative">
              <button
                onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--panel)', cursor: 'default' }}
              >
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent), var(--accent-ink))', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 700 }}>
                  {initials}
                </div>
                <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--ink)', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} className="hidden md:block">
                  {profile?.full_name?.split(' ')[0]}
                </span>
              </button>

              {profileMenuOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setProfileMenuOpen(false)} />
                  <div
                    className="absolute right-0 z-40"
                    style={{ top: 'calc(100% + 6px)', width: 200, background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 10, boxShadow: '0 8px 24px rgba(20,22,26,0.12)', overflow: 'hidden' }}
                  >
                    <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--line-2)' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{profile?.full_name}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{profile?.email}</div>
                    </div>
                    <div style={{ padding: 6 }}>
                      <button
                        onClick={() => { setProfileMenuOpen(false); onNavigate('settings'); }}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', borderRadius: 7, border: 0, background: 'transparent', fontSize: 13, color: 'var(--ink-2)', textAlign: 'left', cursor: 'default' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--panel-2)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <Settings size={14} /> Settings
                      </button>
                      <button
                        onClick={() => { setProfileMenuOpen(false); signOut(); }}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', borderRadius: 7, border: 0, background: 'transparent', fontSize: 13, color: 'var(--danger)', textAlign: 'left', cursor: 'default' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--danger-soft)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <LogOut size={14} /> Sign out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6">
          <div style={{ maxWidth: 1400, margin: '0 auto' }}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
