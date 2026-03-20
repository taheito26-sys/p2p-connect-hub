import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

type ClerkLike = any;

type ClerkContextValue = {
  clerk: ClerkLike | null;
  isLoaded: boolean;
  isSignedIn: boolean;
  userId: string | null;
  user: any | null;
  session: any | null;
  error: string | null;
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

function withTimeout<T>(promise: Promise<T>, ms: number, label: string) {
  return Promise.race<T>([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms.`)), ms);
    }),
  ]);
}

function AuthFallback({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/80 px-4 py-5 text-sm text-muted-foreground shadow-sm">
      <p className="font-medium text-foreground">{title}</p>
      <p className="mt-2 leading-6">{message}</p>
    </div>
  );
}

export function ClerkProvider({ publishableKey, children }: { publishableKey: string; children: React.ReactNode }) {
  const [state, setState] = useState<ClerkContextValue>({
    clerk: null,
    isLoaded: false,
    isSignedIn: false,
    userId: null,
    user: null,
    session: null,
    error: null,
  });

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;

    const boot = async () => {
      const { Clerk } = await withTimeout(loadClerkBrowserSdk(), 10000, 'Loading Clerk SDK');
      const clerk = new Clerk(publishableKey);
      await withTimeout(clerk.load(), 10000, 'Initializing Clerk');
      if (!active) return;

      const sync = () => {
        setState({
          clerk,
          isLoaded: true,
          isSignedIn: Boolean(clerk.user),
          userId: clerk.user?.id ?? null,
          user: clerk.user ?? null,
          session: clerk.session ?? null,
          error: null,
        });
      };

      sync();
      unsubscribe = clerk.addListener?.(sync);
    };

    boot().catch((error) => {
      console.error('Failed to initialize Clerk', error);
      if (active) {
        setState({
          clerk: null,
          isLoaded: true,
          isSignedIn: false,
          userId: null,
          user: null,
          session: null,
          error: error instanceof Error ? error.message : 'Unable to load Clerk authentication.',
        });
      }
    });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [publishableKey]);

  return <ClerkContext.Provider value={state}>{children}</ClerkContext.Provider>;
}

export function useAuth() {
  const { clerk, isLoaded, isSignedIn, userId, session } = useClerkContext();

  return {
    isLoaded,
    isSignedIn,
    userId,
    sessionId: session?.id ?? null,
    getToken: async () => session?.getToken?.() ?? null,
    signOut: async () => clerk?.signOut?.(),
  };
}

export function useUser() {
  const { isLoaded, isSignedIn, user } = useClerkContext();
  return { isLoaded, isSignedIn, user };
}

function MountableClerkComponent({
  mount,
  loadingTitle,
  loadingMessage,
  errorTitle,
  errorMessage,
  options,
}: {
  mount: (clerk: ClerkLike, node: HTMLDivElement, options?: Record<string, unknown>) => void;
  loadingTitle: string;
  loadingMessage: string;
  errorTitle: string;
  errorMessage: string;
  options?: Record<string, unknown>;
}) {
  const { clerk, isLoaded, error } = useClerkContext();
  const ref = useRef<HTMLDivElement | null>(null);
  const [mountError, setMountError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !clerk || !ref.current) return;
    const node = ref.current;

    try {
      mount(clerk, node, options);
      setMountError(null);
    } catch (err) {
      console.error('Failed to mount Clerk UI', err);
      setMountError(err instanceof Error ? err.message : 'Unable to render Clerk authentication.');
    }

    return () => {
      node.replaceChildren();
    };
  }, [clerk, isLoaded, mount, options]);

  if (!isLoaded) {
    return <AuthFallback title={loadingTitle} message={loadingMessage} />;
  }

  if (error || mountError) {
    return <AuthFallback title={errorTitle} message={error || mountError || errorMessage} />;
  }

  return <div ref={ref} />;
}

export function SignIn(props: Record<string, unknown>) {
  return (
    <MountableClerkComponent
      mount={(clerk, node, options) => clerk.mountSignIn(node, options)}
      loadingTitle="Loading sign in"
      loadingMessage="Please wait while authentication loads."
      errorTitle="Sign in is unavailable"
      errorMessage="Clerk could not be loaded for sign in. Check your auth environment settings and network access, then refresh the page."
      options={props}
    />
  );
}

export function SignUp(props: Record<string, unknown>) {
  return (
    <MountableClerkComponent
      mount={(clerk, node, options) => clerk.mountSignUp(node, options)}
      loadingTitle="Loading sign up"
      loadingMessage="Please wait while account creation loads."
      errorTitle="Sign up is unavailable"
      errorMessage="Clerk could not be loaded for sign up. Check your auth environment settings and network access, then refresh the page."
      options={props}
    />
  );
}

export function UserButton(props: Record<string, unknown>) {
  return (
    <MountableClerkComponent
      mount={(clerk, node, options) => clerk.mountUserButton(node, options)}
      loadingTitle="Loading account"
      loadingMessage="Please wait while your user menu loads."
      errorTitle="Account menu unavailable"
      errorMessage="Clerk could not render the user menu. You can refresh the page after authentication finishes loading."
      options={props}
    />
  );
}

export function RedirectToSignIn({ redirectUrl }: { redirectUrl?: string }) {
  const location = useLocation();
  const target = redirectUrl ?? `/auth/login?redirect_url=${encodeURIComponent(`${location.pathname}${location.search}`)}`;
  return <Navigate to={target} replace />;
}
