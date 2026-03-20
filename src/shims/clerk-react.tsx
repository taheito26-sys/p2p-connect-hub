import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

type ClerkLike = any;

type ClerkContextValue = {
  clerk: ClerkLike | null;
  isLoaded: boolean;
  isSignedIn: boolean;
  userId: string | null;
  user: any | null;
  session: any | null;
};

const ClerkContext = createContext<ClerkContextValue | null>(null);

async function loadClerkBrowserSdk() {
  return import(/* @vite-ignore */ 'https://esm.sh/@clerk/clerk-js?target=es2020');
}

function useClerkContext() {
  const ctx = useContext(ClerkContext);
  if (!ctx) throw new Error('Clerk hooks must be used within ClerkProvider');
  return ctx;
}

export function ClerkProvider({ publishableKey, children }: { publishableKey: string; children: React.ReactNode }) {
  const [state, setState] = useState<ClerkContextValue>({
    clerk: null,
    isLoaded: false,
    isSignedIn: false,
    userId: null,
    user: null,
    session: null,
  });

  useEffect(() => {
    let active = true;

    const boot = async () => {
      const { Clerk } = await loadClerkBrowserSdk();
      const clerk = new Clerk(publishableKey);
      await clerk.load();
      if (!active) return;

      const sync = () => {
        setState({
          clerk,
          isLoaded: true,
          isSignedIn: Boolean(clerk.user),
          userId: clerk.user?.id ?? null,
          user: clerk.user ?? null,
          session: clerk.session ?? null,
        });
      };

      sync();
      clerk.addListener(sync);
    };

    boot().catch((error) => {
      console.error('Failed to initialize Clerk', error);
      if (active) {
        setState((current) => ({ ...current, isLoaded: true }));
      }
    });

    return () => {
      active = false;
    };
  }, [publishableKey]);

  return <ClerkContext.Provider value={state}>{children}</ClerkContext.Provider>;
}

export function useAuth() {
  const { isLoaded, isSignedIn, userId, session } = useClerkContext();

  return {
    isLoaded,
    isSignedIn,
    userId,
    sessionId: session?.id ?? null,
    getToken: async () => session?.getToken?.() ?? null,
    signOut: async () => session?.remove?.() ?? undefined,
  };
}

export function useUser() {
  const { isLoaded, isSignedIn, user } = useClerkContext();
  return { isLoaded, isSignedIn, user };
}

function MountableClerkComponent({
  mount,
  fallback,
  options,
}: {
  mount: (clerk: ClerkLike, node: HTMLDivElement, options?: Record<string, unknown>) => void;
  fallback?: React.ReactNode;
  options?: Record<string, unknown>;
}) {
  const { clerk, isLoaded } = useClerkContext();
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isLoaded || !clerk || !ref.current) return;
    const node = ref.current;
    mount(clerk, node, options);
    return () => {
      node.replaceChildren();
    };
  }, [clerk, isLoaded, mount, options]);

  return <div ref={ref}>{fallback}</div>;
}

export function SignIn(props: Record<string, unknown>) {
  return <MountableClerkComponent mount={(clerk, node, options) => clerk.mountSignIn(node, options)} options={props} />;
}

export function SignUp(props: Record<string, unknown>) {
  return <MountableClerkComponent mount={(clerk, node, options) => clerk.mountSignUp(node, options)} options={props} />;
}

export function UserButton(props: Record<string, unknown>) {
  return <MountableClerkComponent mount={(clerk, node, options) => clerk.mountUserButton(node, options)} options={props} />;
}

export function RedirectToSignIn({ redirectUrl }: { redirectUrl?: string }) {
  const location = useLocation();
  const target = redirectUrl ?? `/auth/login?redirect_url=${encodeURIComponent(`${location.pathname}${location.search}`)}`;
  return <Navigate to={target} replace />;
}
