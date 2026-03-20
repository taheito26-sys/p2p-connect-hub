import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth as useClerkAuth, useUser } from "@clerk/clerk-react";
import { merchant, setAuthTokenGetter } from '@/lib/api';
import type { MerchantProfile } from '@/types/domain';

type AuthState = {
  isLoading: boolean;
  isAuthenticated: boolean;
  userId: string | null;
  email: string | null;
  profile: MerchantProfile | null;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

function withTimeout<T>(promise: Promise<T>, ms: number, label: string) {
  return Promise.race<T>([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms.`)), ms);
    }),
  ]);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, userId, getToken, signOut } = useClerkAuth();
  const { user } = useUser();
  const [profile, setProfile] = useState<MerchantProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    setAuthTokenGetter(isSignedIn ? getToken : null);
    return () => setAuthTokenGetter(null);
  }, [getToken, isSignedIn]);

  const refreshProfile = useCallback(async () => {
    if (!isSignedIn) {
      setProfile(null);
      return;
    }

    setProfileLoading(true);
    try {
      const { profile: nextProfile } = await withTimeout(merchant.getMyProfile(), 10000, 'Loading merchant profile');
      setProfile(nextProfile);
    } catch {
      setProfile(null);
    } finally {
      setProfileLoading(false);
    }
  }, [isSignedIn]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setProfile(null);
      return;
    }
    void refreshProfile();
  }, [isLoaded, isSignedIn, refreshProfile]);

  const value = useMemo<AuthState>(() => ({
    isLoading: !isLoaded || profileLoading,
    isAuthenticated: Boolean(isSignedIn),
    userId: userId ?? null,
    email: user?.primaryEmailAddress?.emailAddress ?? null,
    profile,
    refreshProfile,
    signOut,
  }), [isLoaded, isSignedIn, userId, user, profile, refreshProfile, signOut, profileLoading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

