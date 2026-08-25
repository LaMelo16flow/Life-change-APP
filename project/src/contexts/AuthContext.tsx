import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, Profile, ManagerPermission, PermissionType } from '../lib/supabase';
import { sendAccountApprovalRequestNotification } from '../utils/notifications';
import { checkRateLimit, formatRetryTime } from '../utils/rateLimiter';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  permissions: ManagerPermission[];
  hasPermission: (permission: PermissionType) => boolean;
  isMaster: boolean;
  isAdminOrManager: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string, countryCode: string, referredBy?: string) => Promise<{ requiresApproval: boolean }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  isPasswordRecovery: boolean;
  sendPasswordResetEmail: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  cancelPasswordRecovery: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState<ManagerPermission[]>([]);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const isSigningInRef = useRef(false);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
    return data;
  }, []);

  const fetchPermissions = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('manager_permissions')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching permissions:', error);
      return [];
    }
    return data || [];
  }, []);

  const isMaster = profile?.is_master === true;
  const isAdminOrManager = profile?.role === 'admin' || profile?.role === 'manager';

  const hasPermission = (permission: PermissionType): boolean => {
    if (!profile) return false;
    if (profile.is_master || profile.role === 'admin') return true;
    if (profile.role === 'manager') {
      return permissions.some(p => p.permission === permission);
    }
    return false;
  };

  const loadProfile = useCallback(async (userId: string) => {
    const profileData = await fetchProfile(userId);
    setProfile(profileData);
    if (profileData && (profileData.role === 'admin' || profileData.role === 'manager')) {
      const perms = await fetchPermissions(userId);
      setPermissions(perms);
    } else {
      setPermissions([]);
    }
  }, [fetchProfile, fetchPermissions]);

  const refreshProfile = useCallback(async () => {
    if (user) {
      await loadProfile(user.id);
    }
  }, [user, loadProfile]);

  useEffect(() => {
    let mounted = true;

    // The Supabase client is constructed at module load (src/lib/supabase.ts),
    // before this effect ever runs - with detectSessionInUrl on, it can already
    // have parsed a `#type=recovery` link and fired the one-time PASSWORD_RECOVERY
    // event before the onAuthStateChange listener below is attached, which would
    // silently drop straight into the normal dashboard instead of the reset
    // screen. Checking the URL directly here is not timing-dependent.
    if (typeof window !== 'undefined' && window.location.hash.includes('type=recovery')) {
      setIsPasswordRecovery(true);
    }

    const initialize = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;

      if (session?.user) {
        setSession(session);
        setUser(session.user);
        await loadProfile(session.user.id);
      }

      if (mounted) setLoading(false);
    };

    initialize();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mounted) return;

      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
      }

      if (!newSession?.user) {
        setSession(null);
        setUser(null);
        setProfile(null);
        setPermissions([]);
        return;
      }

      setSession(newSession);
      setUser(newSession.user);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  useEffect(() => {
    // Skip while signIn() is already fetching the profile itself (it needs
    // the result synchronously to check account_status) - otherwise this
    // fires concurrently with it the moment onAuthStateChange sets `user`,
    // doubling every profile/permissions request on each login.
    if (!loading && user && !profile && !isSigningInRef.current) {
      loadProfile(user.id);
    }
  }, [user, profile, loading, loadProfile]);

  const signIn = async (email: string, password: string) => {
    const { allowed, retryAfterMs } = checkRateLimit('signIn', 5, 60_000);
    if (!allowed) {
      throw new Error(`Trop de tentatives. Reessayez dans ${formatRetryTime(retryAfterMs)}.`);
    }

    isSigningInRef.current = true;
    try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      if (error.message === 'Email not confirmed') {
        throw new Error('Votre courriel n\'est pas encore confirme. Veuillez contacter l\'administrateur.');
      }
      throw error;
    }

    if (data.user) {
      const profileData = await fetchProfile(data.user.id);

      if (profileData) {
        if (profileData.account_status === 'pending') {
          await supabase.auth.signOut();
          throw new Error('Your account is pending admin approval. Please check back later.');
        }
        if (profileData.account_status === 'rejected') {
          await supabase.auth.signOut();
          const reason = profileData.rejection_reason ? ` Reason: ${profileData.rejection_reason}` : '';
          throw new Error(`Your account registration was not approved.${reason}`);
        }

        setProfile(profileData);
        if (profileData.role === 'admin' || profileData.role === 'manager') {
          const perms = await fetchPermissions(data.user.id);
          setPermissions(perms);
        }
      }
    }
    } finally {
      isSigningInRef.current = false;
    }
  };

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    countryCode: string,
    referredBy?: string
  ) => {
    const { allowed, retryAfterMs } = checkRateLimit('signUp', 3, 120_000);
    if (!allowed) {
      throw new Error(`Trop de tentatives d'inscription. Reessayez dans ${formatRetryTime(retryAfterMs)}.`);
    }

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          country_code: countryCode,
        },
      },
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('User creation failed');

    const { error: profileUpdateError } = await supabase
      .from('profiles')
      .update({
        full_name: fullName,
        country_code: countryCode,
      })
      .eq('id', authData.user.id);

    if (profileUpdateError) {
      console.error('Error updating profile after signup:', profileUpdateError);
    }

    if (referredBy) {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ referred_by: referredBy })
        .eq('id', authData.user.id);

      if (updateError) {
        console.error('Error setting referral:', updateError);
      }

      await supabase
        .from('branches')
        .insert({
          parent_id: referredBy,
          child_id: authData.user.id,
        });
    }

    const { data: approvalSetting } = await supabase
      .from('admin_settings')
      .select('value')
      .eq('key', 'require_account_approval')
      .maybeSingle();

    const requiresApproval = approvalSetting?.value?.enabled !== false;

    if (requiresApproval) {
      sendAccountApprovalRequestNotification({
        fullName,
        email,
        countryCode,
      }).catch((err) => console.error('Error sending approval notification:', err));
    }

    await supabase.auth.signOut();

    return { requiresApproval };
  };

  const sendPasswordResetEmail = async (email: string) => {
    const { allowed, retryAfterMs } = checkRateLimit('resetPassword', 3, 120_000);
    if (!allowed) {
      throw new Error(`Trop de tentatives. Reessayez dans ${formatRetryTime(retryAfterMs)}.`);
    }

    const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL}`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;

    setIsPasswordRecovery(false);

    const { data: { session: refreshedSession } } = await supabase.auth.getSession();
    if (refreshedSession?.user) {
      setSession(refreshedSession);
      setUser(refreshedSession.user);
      await loadProfile(refreshedSession.user.id);
    }
  };

  const cancelPasswordRecovery = async () => {
    setIsPasswordRecovery(false);
    await signOut();
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error && error.message !== 'Auth session missing!' && !error.message.includes('session_not_found')) {
      throw error;
    }
    setSession(null);
    setUser(null);
    setProfile(null);
    setPermissions([]);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        loading,
        permissions,
        hasPermission,
        isMaster,
        isAdminOrManager,
        signIn,
        signUp,
        signOut,
        refreshProfile,
        isPasswordRecovery,
        sendPasswordResetEmail,
        updatePassword,
        cancelPasswordRecovery,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
