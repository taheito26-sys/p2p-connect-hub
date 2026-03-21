import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

type ClerkLike = any;

type GetTokenOptions = {
  template?: string;
  skipCache?: boolean;
};

type ClerkContextValue = {
  clerk: ClerkLike | null;
  isLoaded: boolean;
  isSignedIn: boolean;
  userId: string | null;
  user: any | null;
  session: any | null;
  error: string | null;
};

declare global {
  interface Window {
    Clerk?: ClerkLike;
    __clerk_publishable_key?: string;
    __clerk_frontend_api?: string;
  }
}

const ClerkContext = createContext<ClerkContextValue | null>(null);
const CLERK_JS_URL = 'https://cdn.jsdelivr.net/npm/@clerk/clerk-js@5/dist/clerk.browser.js';

function decodeFrontendApi(publishableKey: string) {
  const encoded = publishableKey.split('_').pop();
  if (!encoded) throw new Error('Invalid Clerk publishable key format.');
  const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const decoded = window.atob(normalized);
  return decoded.endsWith('$') ? decoded.slice(0, -1) : decoded;
}

function loadClerkBrowserSdk(publishableKey: string) {
  if (window.Clerk?.load) {
    return Promise.resolve(window.Clerk);
  }

  const frontendApi = decodeFrontendApi(publishableKey);
  const existing = document.querySelector<HTMLScriptElement>('script[data-clerk-script="true"]');

  if (existing && existing.src !== CLERK_JS_URL) {
    existing.remove();
  }

  const script = existing && existing.src === CLERK_JS_URL ? existing : document.createElement('script');

  window.__clerk_publishable_key = publishableKey;
  window.__clerk_frontend_api = frontendApi;

  return new Promise<ClerkLike>((resolve, reject) => {
    const checkForClerk = (attempts = 0) => {
      if (window.Clerk) {
        resolve(window.Clerk);
        return;
      }

      if (attempts >= 20) {
        reject(new Error('Clerk script loaded but window.Clerk was not found.'));
        return;
      }

      window.setTimeout(() => checkForClerk(attempts + 1), 100);
    };

    const handleLoad = () => checkForClerk();
    const handleError = () => reject(new Error('Failed to load Clerk browser SDK.'));

    script.addEventListener('load', handleLoad, { once: true });
    script.addEventListener('error', handleError, { once: true });

    if (script !== existing) {
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.dataset.clerkScript = 'true';
      script.dataset.clerkPublishableKey = publishableKey;
      script.src = CLERK_JS_URL;
      document.head.appendChild(script);
      return;
    }

    if (window.Clerk) {
      handleLoad();
    }
  });
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
      const clerk = await withTimeout(loadClerkBrowserSdk(publishableKey), 15000, 'Loading Clerk SDK');
      await withTimeout(
        clerk.load({
          publishableKey,
          frontendApi: decodeFrontendApi(publishableKey),
        }),
        30000,
        'Initializing Clerk'
      );
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
    getToken: async (options?: GetTokenOptions) => session?.getToken?.(options) ?? null,
    signOut: async () => clerk?.signOut?.(),
  };
}

export function useUser() {
  const { isLoaded, isSignedIn, user } = useClerkContext();
  return { isLoaded, isSignedIn, user };
}

function MountableClerkComponent({
  mount,
  unmount,
  loadingTitle,
  loadingMessage,
  errorTitle,
  errorMessage,
  options,
}: {
  mount: (clerk: ClerkLike, node: HTMLDivElement, options?: Record<string, unknown>) => void;
  unmount: (clerk: ClerkLike, node: HTMLDivElement) => void;
  loadingTitle: string;
  loadingMessage: string;
  errorTitle: string;
  errorMessage: string;
  options?: Record<string, unknown>;
}) {
  const { clerk, isLoaded, error } = useClerkContext();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mountNodeRef = useRef<HTMLDivElement | null>(null);
  const [mountError, setMountError] = useState<string | null>(null);
  const hasError = Boolean(error || mountError);

  useEffect(() => {
    const container = containerRef.current;
    if (!isLoaded || !clerk || !container || hasError) return;

    // Create an imperatively-managed div so React never tracks Clerk's DOM children
    const mountNode = document.createElement('div');
    mountNodeRef.current = mountNode;
    container.appendChild(mountNode);

    try {
      mount(clerk, mountNode, options);
      setMountError(null);
    } catch (err) {
      console.error('Failed to mount Clerk UI', err);
      setMountError(err instanceof Error ? err.message : 'Unable to render Clerk authentication.');
    }

    return () => {
      try {
        unmount(clerk, mountNode);
      } catch {
        // Clerk may have already cleaned up
      }
      try {
        container.removeChild(mountNode);
      } catch {
        // Node may already be removed
      }
      mountNodeRef.current = null;
    };
  }, [clerk, hasError, isLoaded, mount, options, unmount]);

  return (
    <div>
      {!isLoaded ? <AuthFallback title={loadingTitle} message={loadingMessage} /> : null}
      {isLoaded && hasError ? <AuthFallback title={errorTitle} message={error || mountError || errorMessage} /> : null}
      <div ref={containerRef} className={!isLoaded || hasError ? 'hidden' : undefined} />
    </div>
  );
}

export function SignIn(props: Record<string, unknown>) {
  return (
    <MountableClerkComponent
      mount={(clerk, node, options) => clerk.mountSignIn(node, options)}
      unmount={(clerk, node) => clerk.unmountSignIn?.(node)}
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
      unmount={(clerk, node) => clerk.unmountSignUp?.(node)}
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
      unmount={(clerk, node) => clerk.unmountUserButton?.(node)}
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
