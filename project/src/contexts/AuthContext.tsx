import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, Profile, ManagerPermission, PermissionType, SITE_URL, initialAuthRedirect } from '../lib/supabase';
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
  signUp: (email: string, password: string, fullName: string, countryCode: string) => Promise<{ requiresApproval: boolean }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  isPasswordRecovery: boolean;
  sendPasswordResetEmail: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  cancelPasswordRecovery: () => Promise<void>;
  authNotice: AuthNotice | null;
  clearAuthNotice: () => void;
}

export interface AuthNotice {
  type: 'success' | 'error';
  message: string;
  /** Open the "forgot password" form so the user can ask for a new link. */
  openForgotPassword?: boolean;
}

// Survives a page reload while the user is on the "new password" screen, so
// refreshing does not drop them into the dashboard without changing it.
const RECOVERY_FLAG = 'lc_password_recovery';
const readRecoveryFlag = () => {
  try { return sessionStorage.getItem(RECOVERY_FLAG) === '1'; } catch { return false; }
};
const writeRecoveryFlag = (on: boolean) => {
  try {
    if (on) sessionStorage.setItem(RECOVERY_FLAG, '1');
    else sessionStorage.removeItem(RECOVERY_FLAG);
  } catch { /* storage unavailable */ }
};

const EXPIRED_LINK_MESSAGE =
  'Ce lien de reinitialisation est invalide ou a expire. Entrez votre courriel pour recevoir un nouveau lien.';

function clearAuthParamsFromUrl() {
  try {
    const url = new URL(window.location.href);
    ['token_hash', 'type', 'error', 'error_code', 'error_description', 'code'].forEach((k) => url.searchParams.delete(k));
    url.hash = '';
    window.history.replaceState(window.history.state, '', url.toString());
  } catch { /* ignore */ }
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState<ManagerPermission[]>([]);
  const [isPasswordRecovery, setIsPasswordRecoveryState] = useState(
    () => initialAuthRedirect.isRecovery || readRecoveryFlag()
  );
  const [authNotice, setAuthNotice] = useState<AuthNotice | null>(null);
  const setIsPasswordRecovery = useCallback((on: boolean) => {
    writeRecoveryFlag(on);
    setIsPasswordRecoveryState(on);
  }, []);
  const clearAuthNotice = useCallback(() => setAuthNotice(null), []);
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

    // Recovery intent is read from the URL in src/lib/supabase.ts before the
    // client consumes it (see initialAuthRedirect), so it is not timing-dependent.
    if (initialAuthRedirect.isRecovery) {
      writeRecoveryFlag(true);
    }

    const initialize = async () => {
      // Expired / already-used link: Supabase redirects back with an error.
      if (initialAuthRedirect.errorCode) {
        setIsPasswordRecovery(false);
        setAuthNotice({ type: 'error', message: EXPIRED_LINK_MESSAGE, openForgotPassword: true });
        clearAuthParamsFromUrl();
      }

      // Custom email template using {{ .TokenHash }}: verify it ourselves.
      if (initialAuthRedirect.isRecovery && initialAuthRedirect.tokenHash) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: initialAuthRedirect.tokenHash,
          type: 'recovery',
        });
        clearAuthParamsFromUrl();
        if (error) {
          console.error('Recovery link verification failed:', error);
          setIsPasswordRecovery(false);
          setAuthNotice({ type: 'error', message: EXPIRED_LINK_MESSAGE, openForgotPassword: true });
        }
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;

      // In recovery mode but no session means the link did not log us in
      // (expired, already used, or opened on another device): ask again.
      if (!session?.user && (initialAuthRedirect.isRecovery || readRecoveryFlag())) {
        setIsPasswordRecovery(false);
        setAuthNotice({ type: 'error', message: EXPIRED_LINK_MESSAGE, openForgotPassword: true });
      }

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
  }, [loadProfile, setIsPasswordRecovery]);

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
      if (error.message === 'Invalid login credentials') {
        throw new Error('Courriel ou mot de passe incorrect.');
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
      } else {
        // Auth account without a profile row: the app cannot work, and
        // leaving the session open would show the login form forever.
        await supabase.auth.signOut();
        throw new Error('Profil introuvable pour ce compte. Veuillez contacter l\'administrateur.');
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
    countryCode: string
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

    // Always send the user back to the live site, whatever URL they asked from.
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: SITE_URL });
    if (error) throw error;
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      if (error.message?.toLowerCase().includes('session')) {
        throw new Error(EXPIRED_LINK_MESSAGE);
      }
      if (error.message?.toLowerCase().includes('different from the old')) {
        throw new Error('Le nouveau mot de passe doit etre different de l\'ancien.');
      }
      throw error;
    }

    // The recovery link only grants a temporary session for changing the
    // password: end it and make the user log in with the new password.
    clearAuthParamsFromUrl();
    await signOut().catch(() => undefined);
    setIsPasswordRecovery(false);
    setAuthNotice({
      type: 'success',
      message: 'Mot de passe mis a jour avec succes. Connectez-vous avec votre nouveau mot de passe.',
    });
  };

  const cancelPasswordRecovery = async () => {
    clearAuthParamsFromUrl();
    setIsPasswordRecovery(false);
    await signOut().catch(() => undefined);
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
        authNotice,
        clearAuthNotice,
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
