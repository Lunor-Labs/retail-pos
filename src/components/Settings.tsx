import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { supabase } from '../lib/supabase';
import { KeyRound, UserPlus, Users, Check, X, Star } from 'lucide-react';
import { Database } from '../lib/database.types';
import { loyaltyService } from '../services';

type UserProfile = Database['public']['Tables']['user_profiles']['Row'];

export function Settings() {
  const { profile, createUser } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<UserProfile[]>([]);

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [cashierData, setCashierData] = useState({
    email: '',
    password: '',
    fullName: '',
  });

  const [passwordMessage, setPasswordMessage] = useState('');
  const [cashierMessage, setCashierMessage] = useState('');

  const [loyaltyEarnRate, setLoyaltyEarnRate] = useState(100);
  const [loyaltySavingRates, setLoyaltySavingRates] = useState(false);

  useEffect(() => {
    loadUsers();
    loyaltyService.getEarnRate().then(setLoyaltyEarnRate).catch(() => {});
  }, []);

  async function loadUsers() {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error: any) {
      console.error('Error loading users:', error);
    }
  }

  async function handlePasswordUpdate(e: React.FormEvent) {
    e.preventDefault();
    setPasswordMessage('');

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordMessage('New passwords do not match');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setPasswordMessage('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      });

      if (error) throw error;

      setPasswordMessage('Password updated successfully');
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (error: any) {
      setPasswordMessage(error.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddCashier(e: React.FormEvent) {
    e.preventDefault();
    setCashierMessage('');

    if (cashierData.password.length < 6) {
      setCashierMessage('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      await createUser(cashierData.email, cashierData.password, cashierData.fullName, 'cashier');

      setCashierMessage('Cashier added successfully');
      setCashierData({
        email: '',
        password: '',
        fullName: '',
      });
      loadUsers();
    } catch (error: any) {
      setCashierMessage(error.message || 'Failed to add cashier');
    } finally {
      setLoading(false);
    }
  }

  async function toggleUserStatus(userId: string, currentStatus: boolean) {
    try {
      const { error } = await (supabase
        .from('user_profiles') as any)
        .update({ active: !currentStatus })
        .eq('id', userId);

      if (error) throw error;
      loadUsers();
      showToast(`User ${!currentStatus ? 'activated' : 'deactivated'} successfully`, 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to update user status', 'error');
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-600 mt-1">Manage your account and system users</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-slate-100 rounded-lg">
              <KeyRound className="w-6 h-6 text-slate-900" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Update Password</h2>
              <p className="text-sm text-slate-600">Change your account password</p>
            </div>
          </div>

          <form onSubmit={handlePasswordUpdate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                New Password <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                required
                minLength={6}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                placeholder="Enter new password"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Confirm New Password <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                required
                minLength={6}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                placeholder="Confirm new password"
              />
            </div>

            {passwordMessage && (
              <div className={`text-sm p-3 rounded-lg ${passwordMessage.includes('success')
                ? 'bg-green-50 text-green-700'
                : 'bg-red-50 text-red-700'
                }`}>
                {passwordMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition disabled:opacity-50"
            >
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-slate-100 rounded-lg">
              <UserPlus className="w-6 h-6 text-slate-900" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Add Cashier</h2>
              <p className="text-sm text-slate-600">Create a new cashier account</p>
            </div>
          </div>

          <form onSubmit={handleAddCashier} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={cashierData.fullName}
                onChange={(e) => setCashierData({ ...cashierData, fullName: e.target.value })}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                placeholder="Enter full name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={cashierData.email}
                onChange={(e) => setCashierData({ ...cashierData, email: e.target.value })}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                placeholder="Enter email address"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Password <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={cashierData.password}
                onChange={(e) => setCashierData({ ...cashierData, password: e.target.value })}
                required
                minLength={6}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                placeholder="Enter password"
              />
            </div>

            {cashierMessage && (
              <div className={`text-sm p-3 rounded-lg ${cashierMessage.includes('success')
                ? 'bg-green-50 text-green-700'
                : 'bg-red-50 text-red-700'
                }`}>
                {cashierMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition disabled:opacity-50"
            >
              {loading ? 'Adding...' : 'Add Cashier'}
            </button>
          </form>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-slate-100 rounded-lg">
            <Users className="w-6 h-6 text-slate-900" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">System Users</h2>
            <p className="text-sm text-slate-600">Manage all system users</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900">Name</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900">Email</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900">Role</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900">Status</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-3 px-4 text-sm text-slate-900">{user.full_name}</td>
                  <td className="py-3 px-4 text-sm text-slate-600">{user.email}</td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${user.role === 'admin'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700'
                      }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${user.active
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                      }`}>
                      {user.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    {user.id !== profile?.id && (
                      <button
                        onClick={() => toggleUserStatus(user.id, user.active)}
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-sm font-medium transition ${user.active
                          ? 'bg-red-50 text-red-700 hover:bg-red-100'
                          : 'bg-green-50 text-green-700 hover:bg-green-100'
                          }`}
                      >
                        {user.active ? (
                          <>
                            <X className="w-4 h-4" />
                            Deactivate
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4" />
                            Activate
                          </>
                        )}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {users.length === 0 && (
            <div className="text-center py-8 text-slate-500">
              No users found
            </div>
          )}
        </div>
      </div>

      {/* Loyalty Rate Settings */}
      {profile?.role === 'admin' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-amber-100 p-2 rounded-lg">
              <Star className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Loyalty Points Settings</h3>
              <p className="text-sm text-slate-500">Configure how customers earn loyalty points</p>
            </div>
          </div>

          <div className="space-y-4 max-w-sm">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Earn Rate (LKR per 1 point)
              </label>
              <input
                type="number"
                min={1}
                step={1}
                value={loyaltyEarnRate}
                onChange={(e) => setLoyaltyEarnRate(Number(e.target.value) || 1)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
              />
              <p className="text-xs text-slate-400 mt-1">
                Customer earns 1 point for every LKR {loyaltyEarnRate} spent. 1 point = LKR 1 off at redemption.
              </p>
            </div>

            <button
              disabled={loyaltySavingRates}
              onClick={async () => {
                setLoyaltySavingRates(true);
                try {
                  await loyaltyService.setEarnRate(loyaltyEarnRate);
                  showToast('Loyalty rate updated', 'success');
                } catch {
                  showToast('Failed to update loyalty rate', 'error');
                } finally {
                  setLoyaltySavingRates(false);
                }
              }}
              className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition disabled:opacity-50 font-medium"
            >
              {loyaltySavingRates ? 'Saving...' : 'Save Loyalty Settings'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
