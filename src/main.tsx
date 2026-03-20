import { ClerkProvider } from '@/shims/clerk-react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || import.meta.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

function MissingClerkKeyScreen() {
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-sm space-y-3">
        <h1 className="text-2xl font-semibold">Clerk is not configured</h1>
        <p className="text-sm text-muted-foreground leading-6">
          Add <code>VITE_CLERK_PUBLISHABLE_KEY</code> or <code>NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code> to your local env file,
          then restart the Vite dev server.
        </p>
        <p className="text-xs text-muted-foreground leading-5">
          The app now fails clearly on missing Clerk config instead of crashing with a blank page.
        </p>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  clerkPublishableKey ? (
    <ClerkProvider publishableKey={clerkPublishableKey}>
      <App />
    </ClerkProvider>
  ) : (
    <MissingClerkKeyScreen />
  )
);
