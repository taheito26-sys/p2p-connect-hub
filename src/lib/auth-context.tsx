import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { merchant, setCompatCredentials } from '@/lib/api';
import type { MerchantProfile } from '@/types/domain';

// Default user — no login required
const DEFAULT_USER = {
  userId: 'compat:default@tracker.local',
  email: 'default@tracker.local',
};

type AuthState = {
  isLoading: boolean;
  isAuthenticated: true;
  userId: string;
  email: string;
  profile: MerchantProfile | null;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<MerchantProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Always set compat credentials on mount
  useEffect(() => {
    setCompatCredentials({ userId: DEFAULT_USER.userId, email: DEFAULT_USER.email });
  }, []);

  const refreshProfile = useCallback(async () => {
    setLoading(true);
    try {
      const { profile: p } = await merchant.getMyProfile();
      setProfile(p);
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);

  const value = useMemo<AuthState>(() => ({
    isLoading: loading,
    isAuthenticated: true,
    userId: DEFAULT_USER.userId,
    email: DEFAULT_USER.email,
    profile,
    refreshProfile,
  }), [loading, profile, refreshProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
