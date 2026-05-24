import { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Database } from '../lib/database.types';

type UserProfile = Database['public']['Tables']['user_profiles']['Row'];

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string, role: 'admin' | 'cashier') => Promise<void>;
  createUser: (email: string, password: string, fullName: string, role: 'admin' | 'cashier' | 'stock_manager' | 'staff') => Promise<void>;
  signupTenant: (email: string, password: string, fullName: string, businessName: string, slug: string, businessType: string) => Promise<void>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  isCashier: boolean;
  isStockManager: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        setUser(session?.user ?? null);
        if (session?.user) {
          await loadProfile(session.user.id);
        } else {
          setProfile(null);
          setLoading(false);
        }
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadProfile(userId: string) {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  }

  async function signUp(email: string, password: string, fullName: string, role: 'admin' | 'cashier') {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) throw error;

    if (data.user) {
      const { error: profileError } = await (supabase.from('user_profiles') as any)
        .insert({
          id: data.user.id,
          email,
          full_name: fullName,
          role,
        });
      if (profileError) throw profileError;
    }
  }

  async function createUser(email: string, password: string, fullName: string, role: 'admin' | 'cashier' | 'stock_manager') {
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (!currentSession) {
      throw new Error('You must be logged in to create users');
    }

    const savedRefreshToken = currentSession.refresh_token;
    const savedAccessToken = currentSession.access_token;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      await supabase.auth.setSession({
        access_token: savedAccessToken,
        refresh_token: savedRefreshToken,
      });
      throw error;
    }

    if (data.user) {
      await supabase.auth.setSession({
        access_token: savedAccessToken,
        refresh_token: savedRefreshToken,
      });

      const { error: profileError } = await (supabase.from('user_profiles') as any)
        .insert({
          id: data.user.id,
          email,
          full_name: fullName,
          role,
          active: true,
        });

      if (profileError) throw profileError;
    }
  }

  async function signOut() {
    // Clear local session immediately so the UI always logs out,
    // even if the server rejects the request (e.g. expired token).
    await supabase.auth.signOut({ scope: 'local' });
    // Best-effort server-side invalidation — ignore errors.
    supabase.auth.signOut({ scope: 'global' }).catch(() => {});
  }

  async function signupTenant(_email: string, _password: string, _fullName: string, _businessName: string, _slug: string, _businessType: string) {
    throw new Error('Multi-tenant signup not yet implemented for this deployment.');
  }

  const value = {
    user,
    profile,
    loading,
    signIn,
    signUp,
    createUser,
    signupTenant,
    signOut,
    isAdmin: profile?.role === 'admin',
    isCashier: profile?.role === 'cashier',
    isStockManager: profile?.role === 'stock_manager',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
