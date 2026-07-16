import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

export type AppRole = 'admin' | 'comercial' | 'administrativa';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: { full_name: string; email: string; active: boolean } | null;
  role: AppRole | null;
  roles: AppRole[];
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  isAdministrativa: boolean;
  isComercial: boolean;
  canAccessObres: boolean;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthContextType['profile']>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProfileAndRole = async (userId: string) => {
    const [profileRes, rolesRes] = await Promise.all([
      supabase.from('profiles').select('full_name, email, active').eq('id', userId).single(),
      supabase.from('user_roles').select('role').eq('user_id', userId),
    ]);
    if (profileRes.data) setProfile(profileRes.data as any);
    const allRoles: AppRole[] = ((rolesRes.data as any[]) || []).map((r) => r.role as AppRole);
    setRoles(allRoles);
    // Display/primary role: prefer non-admin identity (comercial/administrativa) so
    // secondary admin privileges don't override how the user is shown in the UI/PDFs.
    const primary: AppRole | null =
      allRoles.find((r) => r === 'comercial') ||
      allRoles.find((r) => r === 'administrativa') ||
      allRoles.find((r) => r === 'admin') ||
      null;
    setRole(primary);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        setTimeout(() => fetchProfileAndRole(session.user.id), 0);
      } else {
        setProfile(null);
        setRole(null);
        setRoles([]);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfileAndRole(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRole(null);
    setRoles([]);
  };

  // Admin PRIVILEGES: user has the admin role even if their primary display role is different.
  const isAdmin = roles.includes('admin');
  const isAdministrativa = role === 'administrativa';
  const isComercial = role === 'comercial';
  return (
    <AuthContext.Provider
      value={{
        user, session, profile, role, roles, loading, signIn, signOut,
        isAdmin, isAdministrativa, isComercial,
        canAccessObres: isAdmin || isAdministrativa || isComercial,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
