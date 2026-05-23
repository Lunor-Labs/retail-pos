import { useState, FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import logo from '../assets/favicon.jpeg';
import { Store, User, Mail, Lock, Building } from 'lucide-react';

interface SignupProps {
  onToggleToLogin: () => void;
}

export function Signup({ onToggleToLogin }: SignupProps) {
  const { signupTenant } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    businessName: '',
    slug: '',
    businessType: 'retail',
    fullName: '',
    email: '',
    password: '',
  });

  // Basic slug generator
  const handleBusinessNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    const autoSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    setFormData(prev => ({ ...prev, businessName: name, slug: autoSlug }));
  };

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signupTenant(
        formData.email,
        formData.password,
        formData.fullName,
        formData.businessName,
        formData.slug,
        formData.businessType
      );
      // Wait for session to automatically populate and reload the app
    } catch (err: any) {
      setError(err.message || 'Failed to sign up');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 overflow-hidden bg-slate-900 relative">
      <div className="absolute inset-0 bg-black/40"></div>

      <div className="relative z-10 bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl overflow-hidden w-full max-w-4xl border-4 border-white my-8">
        <div className="grid grid-cols-1 lg:grid-cols-5">
          {/* Left Column - Branding */}
          <div className="hidden lg:flex lg:col-span-2 flex-col justify-between p-10 bg-teal-900 relative overflow-hidden">
             {/* Decorative circles */}
            <div className="absolute top-0 left-0 w-64 h-64 bg-teal-800 rounded-full mix-blend-multiply filter blur-3xl opacity-50 transform -translate-x-1/2 -translate-y-1/2"></div>
            <div className="absolute bottom-0 right-0 w-64 h-64 bg-teal-700 rounded-full mix-blend-multiply filter blur-3xl opacity-50 transform translate-x-1/2 translate-y-1/2"></div>
            
            <div className="relative z-10 flex flex-col justify-between h-full">
              <div className="flex items-center gap-3">
                <img src={logo} alt="Logo" className="w-10 h-10 rounded-lg object-cover shadow-md" />
                <div>
                  <h2 className="text-xl font-bold text-white tracking-wide">POS Platform</h2>
                </div>
              </div>

              <div className="text-white space-y-4">
                <h3 className="text-3xl font-bold leading-tight">
                  Start Managing<br/>Your Business
                </h3>
                <p className="text-teal-100 text-sm leading-relaxed">
                  Join thousands of businesses managing their sales, inventory, and staff with our powerful platform.
                </p>
              </div>

              <div className="pt-8 text-sm text-teal-200">
                Already have an account? 
                <button onClick={onToggleToLogin} className="text-white font-bold ml-2 hover:underline">
                  Log in here
                </button>
              </div>
            </div>
          </div>

          {/* Right Column - Signup Form */}
          <div className="col-span-1 lg:col-span-3 p-8 lg:p-10">
             <div className="lg:hidden flex justify-between items-center mb-6">
                <img src={logo} alt="Logo" className="w-10 h-10 rounded-lg object-cover" />
                <button onClick={onToggleToLogin} className="text-sm font-medium text-teal-700 hover:text-teal-800">
                  Log in instead
                </button>
             </div>

            <h1 className="text-2xl font-bold text-slate-900 mb-1">Create your workspace</h1>
            <p className="text-slate-500 text-sm mb-6">Setup your business and admin account in minutes.</p>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Business Details Section */}
              <div>
                <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4 pb-2 border-b border-slate-100 flex items-center gap-2">
                  <Store className="w-4 h-4" /> Business Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Business Name</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Building className="h-4 w-4 text-slate-400" />
                      </div>
                      <input
                        type="text"
                        required
                        value={formData.businessName}
                        onChange={handleBusinessNameChange}
                        className="pl-10 w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-600 focus:bg-white outline-none transition text-sm"
                        placeholder="e.g. Acme Supermarket"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Workspace URL</label>
                    <input
                      type="text"
                      required
                      value={formData.slug}
                      onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-600 focus:bg-white outline-none transition text-sm text-slate-600"
                      placeholder="acme-supermarket"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Business Type</label>
                    <select
                      value={formData.businessType}
                      onChange={(e) => setFormData({ ...formData, businessType: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-600 focus:bg-white outline-none transition text-sm"
                    >
                      <option value="retail">Retail Store</option>
                      <option value="restaurant">Restaurant / Cafe</option>
                      <option value="pharmacy">Pharmacy</option>
                      <option value="vehicle_parts">Vehicle Parts</option>
                      <option value="clothing">Clothing & Apparel</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Admin Account Section */}
              <div>
                <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4 pb-2 border-b border-slate-100 flex items-center gap-2">
                  <User className="w-4 h-4" /> Admin Account
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <User className="h-4 w-4 text-slate-400" />
                      </div>
                      <input
                        type="text"
                        required
                        value={formData.fullName}
                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                        className="pl-10 w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-600 focus:bg-white outline-none transition text-sm"
                        placeholder="John Doe"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Mail className="h-4 w-4 text-slate-400" />
                      </div>
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="pl-10 w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-600 focus:bg-white outline-none transition text-sm"
                        placeholder="john@example.com"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className="h-4 w-4 text-slate-400" />
                      </div>
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="pl-10 w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-600 focus:bg-white outline-none transition text-sm"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-teal-700 text-white py-3 rounded-lg hover:bg-teal-800 transition disabled:opacity-50 disabled:cursor-not-allowed font-semibold mt-4 shadow-sm"
              >
                {loading ? 'Creating Workspace...' : 'Create Workspace'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
