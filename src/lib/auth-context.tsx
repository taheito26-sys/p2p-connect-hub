import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { merchant, setAuthTokenGetter } from '@/lib/api';
import type { MerchantProfile, AuthSession } from '@/types/domain';

const SESSION_KEY = 'tracker_session';

function loadSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session: AuthSession = JSON.parse(raw);
    if (new Date(session.expires_at) <= new Date()) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

function saveSession(session: AuthSession) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

type AuthState = {
  isLoading: boolean;
  isAuthenticated: boolean;
  userId: string | null;
  email: string | null;
  session: AuthSession | null;
  profile: MerchantProfile | null;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  setSession: (session: AuthSession) => void;
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
  const [session, setSessionState] = useState<AuthSession | null>(() => loadSession());
  const [profile, setProfile] = useState<MerchantProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);

  const isSignedIn = Boolean(session);

  const setSession = useCallback((s: AuthSession) => {
    saveSession(s);
    setSessionState(s);
  }, []);

  const signOut = useCallback(async () => {
    clearSession();
    setSessionState(null);
    setProfile(null);
  }, []);

  // Wire up auth token for API calls
  useEffect(() => {
    if (!session) {
      setAuthTokenGetter(null);
      return () => setAuthTokenGetter(null);
    }

    setAuthTokenGetter(() => Promise.resolve(session.token));
    return () => setAuthTokenGetter(null);
  }, [session]);

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

  // Load profile on sign-in
  useEffect(() => {
    if (!isSignedIn) {
      setProfile(null);
      setInitializing(false);
      return;
    }
    void refreshProfile().finally(() => setInitializing(false));
  }, [isSignedIn, refreshProfile]);

  const value = useMemo<AuthState>(() => ({
    isLoading: initializing || profileLoading,
    isAuthenticated: isSignedIn,
    userId: session?.user_id ?? null,
    email: session?.email ?? null,
    session,
    profile,
    refreshProfile,
    signOut,
    setSession,
  }), [initializing, profileLoading, isSignedIn, session, profile, refreshProfile, signOut, setSession]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
