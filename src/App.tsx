import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Login } from './components/Login';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { Products } from './components/Products';
import { Suppliers } from './components/Suppliers';
import { Customers } from './components/Customers';
import { SalesStaff } from './components/SalesStaff';
import { POS } from './components/POS';
import { Returns } from './components/Returns';
import { SalesHistory } from './components/SalesHistory';
import { Reports } from './components/Reports';
import { Settings } from './components/Settings';
import { StockFilter } from './hooks/useProducts';
import { ToastProvider } from './contexts/ToastContext';
import { CostCodeProvider } from './contexts/CostCodeContext';
import { ToastContainer } from './components/ui';

function AppContent() {
  const { user, profile, loading } = useAuth();
  const role = profile?.role;
  const defaultView = role === 'cashier' ? 'pos' : role === 'stock_manager' ? 'products' : 'dashboard';
  const [currentView, setCurrentView] = useState(defaultView);
  const [initialStockFilter, setInitialStockFilter] = useState<StockFilter>('all');

  // Lock restricted roles to their single allowed view
  const ALLOWED: Record<string, string[]> = {
    cashier: ['pos'],
    stock_manager: ['products', 'suppliers'],
  };

  const handleNavigate = (view: string, filter: StockFilter = 'all') => {
    const allowed = role ? ALLOWED[role] : null;
    if (allowed && !allowed.includes(view)) return;
    setInitialStockFilter(filter);
    setCurrentView(view);
  };

  // Sync default view when profile loads
  useEffect(() => {
    if (profile) setCurrentView(defaultView);
  }, [profile?.role]);

  // Redirect away from POS on mobile (< 1024px) — only for admin
  useEffect(() => {
    const check = () => {
      if (window.innerWidth < 1024 && currentView === 'pos' && role === 'admin') {
        setCurrentView('dashboard');
      }
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [currentView, role]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--sidebar)' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 mx-auto mb-4" style={{ border: '2px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--accent)' }} />
          <p style={{ color: 'var(--sidebar-muted)', fontSize: 13 }}>Loading…</p>
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    return <Login />;
  }

  return (
    <Layout currentView={currentView} onNavigate={(view) => handleNavigate(view)}>
      {currentView === 'dashboard' && (
        <Dashboard
          onNavigate={(view) => handleNavigate(view)}
          onFilterNavigate={(filter) => handleNavigate('products', filter)}
        />
      )}

      {/* POS is always mounted but hidden — preserves cart and all state */}
      <div style={{ display: currentView === 'pos' ? 'block' : 'none' }}>
        <POS isActive={currentView === 'pos'} />
      </div>

      {currentView === 'products' && (
        <Products key={initialStockFilter} initialStockFilter={initialStockFilter} />
      )}
      {currentView === 'customers' && <Customers />}
      {currentView === 'suppliers' && <Suppliers />}
      {currentView === 'referral-agents' && <SalesStaff />}
      {currentView === 'returns' && <Returns />}
      {currentView === 'sales-history' && <SalesHistory />}
      {currentView === 'reports' && <Reports />}
      {currentView === 'settings' && <Settings />}
    </Layout>
  );
}

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <CostCodeProvider>
          <AppContent />
          <ToastContainer />
        </CostCodeProvider>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
