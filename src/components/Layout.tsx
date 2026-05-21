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
} from 'lucide-react';
import revonlakLogo from '../assets/revonlak.jpeg';

interface LayoutProps {
  children: React.ReactNode;
  currentView: string;
  onNavigate: (view: string) => void;
}

export function Layout({ children, currentView, onNavigate }: LayoutProps) {
  const { profile, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const navigation = [
    { name: 'Dashboard', icon: BarChart3, view: 'dashboard', roles: ['admin', 'cashier'] },
    { name: 'POS', icon: ShoppingCart, view: 'pos', roles: ['admin', 'cashier'] },
    { name: 'Products', icon: Package, view: 'products', roles: ['admin', 'cashier'] },
    { name: 'Customers', icon: Users, view: 'customers', roles: ['admin', 'cashier'] },
    { name: 'Suppliers', icon: Truck, view: 'suppliers', roles: ['admin', 'cashier'] },
    { name: 'Sales Staff', icon: UserCheck, view: 'referral-agents', roles: ['admin'] },
    { name: 'Returns', icon: RotateCcw, view: 'returns', roles: ['admin', 'cashier'] },
    { name: 'Sales History', icon: FileText, view: 'sales-history', roles: ['admin', 'cashier'] },
    { name: 'Reports', icon: TrendingUp, view: 'reports', roles: ['admin'] },
    { name: 'Settings', icon: Settings, view: 'settings', roles: ['admin'] },
  ];

  const filteredNavigation = navigation.filter((item) =>
    item.roles.includes(profile?.role || '')
  );

  const navGroups = [
    { title: '', items: ['dashboard'] },
    { title: 'MANAGEMENT', items: ['pos', 'products', 'returns'] },
    { title: 'PARTIES', items: ['customers', 'suppliers', 'referral-agents'] },
    { title: 'REPORTS', items: ['reports', 'sales-history'] },
    { title: 'SYSTEM', items: ['settings'] }
  ];

  const renderNavItems = () => {
    return navGroups.map((group, groupIndex) => {
      const groupItems = filteredNavigation.filter(item => group.items.includes(item.view));
      if (groupItems.length === 0) return null;

      return (
        <div key={groupIndex} className="mb-6">
          {group.title && (
            <h3 className="px-6 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {group.title}
            </h3>
          )}
          <div className="space-y-1 px-3">
            {groupItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.view;

              return (
                <button
                  key={item.view}
                  onClick={() => {
                    onNavigate(item.view);
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${isActive
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                >
                  <Icon className={`w-5 h-5 transition-colors ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} />
                  <span className="font-medium">{item.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      );
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Mobile Sidebar Overlay */}
      <div
        className={`fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity duration-300 ${sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 w-64 bg-[#0f172a] text-white z-50 transition-transform duration-300 flex flex-col ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          }`}
      >
        {/* Brand */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800/50">
          <div className="flex items-center gap-3">
            <img src={revonlakLogo} alt="RIVONLAK" className="w-8 h-8 rounded-lg object-cover" />
            <div className="flex flex-col">
              <span className="font-bold text-lg tracking-wide">RIVONLAK</span>
              <span className="text-[10px] text-slate-400 uppercase tracking-[0.2em] -mt-1">Fashion</span>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-6 custom-scrollbar">
          {renderNavItems()}
        </nav>

        {/* Bottom Actions */}
        <div className="p-4 border-t border-slate-800/50">
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header (Mobile Toggle + Desktop Info) */}
        <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-6 sticky top-0 z-30">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <Menu className="w-6 h-6" />
          </button>

          {/* Desktop Left: Dashboard Title */}
          <h2 className="hidden lg:block text-xl font-bold text-slate-800">
            {navigation.find(n => n.view === currentView)?.name || 'Dashboard Overview'}
          </h2>

          <div className="flex items-center gap-4 ml-auto">
            {/* Search Bar - Optional/Hidden as per request, keeping space if needed or just removing */}
            <div className="hidden md:flex relative">
              {/* Search placeholder if needed, user said no need top search bar, so skipping */}
            </div>

            {/* Notification Bell */}
            <button className="relative p-2 text-slate-400 hover:text-slate-600 transition-colors">
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
              <Bell className="w-5 h-5" />
            </button>

            {/* Profile */}
            <div className="relative">
              <button
                onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                className="flex items-center gap-3 focus:outline-none"
              >
                <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-white font-bold text-sm ring-2 ring-white ring-offset-2 ring-offset-slate-50 hover:ring-red-100 transition-all">
                  {profile?.full_name?.[0]?.toUpperCase() || 'U'}
                </div>
              </button>

              {/* Profile Dropdown */}
              {profileMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setProfileMenuOpen(false)}
                  ></div>
                  <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-40 animate-in fade-in zoom-in-95 duration-200">
                    <div className="px-4 py-3 border-b border-slate-50">
                      <p className="text-sm font-semibold text-slate-900">{profile?.full_name}</p>
                      <p className="text-xs text-slate-500 truncate">{profile?.email}</p>
                    </div>

                    <div className="p-1">
                      <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg transition-colors text-left">
                        <Settings className="w-4 h-4" />
                        Settings
                      </button>
                      <button
                        onClick={() => {
                          setProfileMenuOpen(false);
                          signOut();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors text-left"
                      >
                        <LogOut className="w-4 h-4" />
                        Sign Out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
