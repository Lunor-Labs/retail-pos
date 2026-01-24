import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LogIn } from 'lucide-react';

export function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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

  return (
    <div className="min-h-screen flex items-center justify-center p-4 overflow-hidden bg-slate-900 relative">
      {/* Background Video */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      >
        <source src="/src/assets/login_bg.mp4" type="video/mp4" />
      </video>

      {/* Dark Overlay */}
      <div className="absolute inset-0 bg-black/40"></div>

      {/* Main Container */}
      <div className="relative z-10 bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl overflow-hidden w-full max-w-6xl border-4 border-white">
        <div className="grid grid-cols-1 lg:grid-cols-2">
          {/* Left Column - Image, Logo & Quote */}
          <div className="hidden lg:flex flex-col justify-between p-12 relative overflow-hidden">
            {/* Background Image - Full Fill */}
            <div className="absolute inset-0 z-0">
              <img
                src="/src/assets/login.jpg"
                alt="Adventure"
                className="w-full h-full object-cover blur-sm"
              />
            </div>

            {/* Content */}
            <div className="relative z-10 flex flex-col justify-between h-full">
              <div className="flex items-center gap-3">
                <img
                  src="/src/assets/favicon.jpeg"
                  alt="Gasith Motors Logo"
                  className="w-12 h-12 rounded-lg object-cover"
                />
                <div>
                  <h2 className="text-2xl font-bold text-white">Gasith Motors</h2>
                  <p className="text-sm text-white/80">Inventory & POS System</p>
                </div>
              </div>

              <div className="text-white space-y-3">
                <p className="text-4xl font-bold leading-tight">
                  YOUR NEXT <br />
                  ADVENTURE <br />
                  AWAITS!
                </p>
                <p className="text-white/80 text-sm leading-relaxed">
                  Log in to unlock exclusive deals, manage your inventory efficiently, and streamline your business operations. Your journey starts here.
                </p>
              </div>
            </div>
          </div>

          {/* Right Column - Login Form */}
          <div className="flex flex-col items-center justify-center p-8 lg:p-12">
            {/* Mobile Logo */}
            <div className="lg:hidden flex justify-center mb-6">
              <img
                src="/src/assets/favicon.jpeg"
                alt="Gasith Motors Logo"
                className="w-14 h-14 rounded-lg object-cover"
              />
            </div>

            <div className="w-full max-w-sm">
              <h1 className="text-3xl lg:text-4xl font-bold text-center text-slate-900 mb-2">
                WELCOME BACK!
              </h1>
              <p className="text-center text-slate-600 mb-8">
                Welcome back! Please enter your details.
              </p>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-600 focus:border-transparent outline-none transition text-slate-900 placeholder-slate-500"
                    placeholder="Enter your email"
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-2">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-600 focus:border-transparent outline-none transition text-slate-900 placeholder-slate-500"
                    placeholder="••••••••"
                  />
                </div>

                <div className="flex items-center justify-between text-sm">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 rounded border-slate-300" />
                    <span className="text-slate-600">Remember me</span>
                  </label>
                  <a href="#" className="text-teal-600 hover:text-teal-700 font-medium">
                    Forgot password?
                  </a>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-teal-700 text-white py-2.5 rounded-lg hover:bg-teal-800 transition disabled:opacity-50 disabled:cursor-not-allowed font-semibold mt-6"
                >
                  {loading ? 'Signing in...' : 'Sign in'}
                </button>
              </form>

              <div className="mt-6 pt-6 border-t border-slate-200 text-center text-xs text-slate-600">
                <p>Demo credentials: <strong>admin@gasith.lk</strong> / <strong>gasith@123</strong></p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
