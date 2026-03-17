import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { auth as authApi, merchant, setAuthToken } from '@/lib/api';
import { isDemoMode, getDemoMode, DEMO_USER, DEMO_PROFILE } from '@/lib/demo-mode';
import type { MerchantProfile } from '@/types/domain';

interface AuthState {
  isLoading: boolean;
  isAuthenticated: boolean;
  userId: string | null;
  email: string | null;
  profile: MerchantProfile | null;
  isDemoMode: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<MerchantProfile | null>(null);
  const [demo, setDemo] = useState(false);

  const refreshProfile = useCallback(async () => {
    if (getDemoMode()) {
      setProfile(DEMO_PROFILE);
      return;
    }
    try {
      const { profile: p } = await merchant.getMyProfile();
      setProfile(p);
    } catch {
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const demoActive = await isDemoMode();
      setDemo(demoActive);

      if (demoActive) {
        // Auto-login in demo mode
        setUserId(DEMO_USER.user_id);
        setEmail(DEMO_USER.email);
        setProfile(DEMO_PROFILE);
        setIsLoading(false);
        return;
      }

      try {
        const session = await authApi.session();
        if (session) {
          setUserId(session.user_id);
          setEmail(session.email);
          await refreshProfile();
        }
      } catch {
        // Not authenticated
      } finally {
        setIsLoading(false);
      }
    })();
  }, [refreshProfile]);

  const login = useCallback(async (email: string, password: string) => {
    if (getDemoMode()) {
      setUserId(DEMO_USER.user_id);
      setEmail(DEMO_USER.email);
      setProfile(DEMO_PROFILE);
      return;
    }
    const result = await authApi.login(email, password);
    setAuthToken(result.token);
    setUserId(result.user_id);
    setEmail(email);
    await refreshProfile();
  }, [refreshProfile]);

  const signup = useCallback(async (email: string, password: string) => {
    if (getDemoMode()) {
      // In demo mode, just succeed
      return;
    }
    await authApi.signup(email, password);
    const result = await authApi.login(email, password);
    setAuthToken(result.token);
    setUserId(result.user_id);
    setEmail(email);
    await refreshProfile();
  }, [refreshProfile]);

  const logout = useCallback(async () => {
    if (!getDemoMode()) {
      try { await authApi.logout(); } catch {
        // Ignore logout transport failures while clearing local state.
      }
    }
    setAuthToken(null);
    setUserId(null);
    setEmail(null);
    setProfile(null);
  }, []);

  return (
    <AuthContext.Provider value={{
      isLoading,
      isAuthenticated: !!userId,
      userId,
      email,
      profile,
      isDemoMode: demo,
      login,
      signup,
      logout,
      refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
