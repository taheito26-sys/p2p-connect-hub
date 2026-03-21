import { ClerkProvider } from "@clerk/react";
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

function requireClerkPublishableKey() {
  const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

  console.info('[Clerk] VITE_CLERK_PUBLISHABLE_KEY present:', Boolean(publishableKey));

  if (!publishableKey) {
    throw new Error(
      'Missing VITE_CLERK_PUBLISHABLE_KEY. Add a Clerk publishable key (pk_...) to your Vite environment and restart the dev server.'
    );
  }

  if (publishableKey.startsWith('sk_')) {
    throw new Error(
      'Invalid Clerk frontend configuration: VITE_CLERK_PUBLISHABLE_KEY contains a secret key (sk_...). Never expose Clerk secret keys in the frontend.'
    );
  }

  if (!publishableKey.startsWith('pk_')) {
    throw new Error(
      'Invalid VITE_CLERK_PUBLISHABLE_KEY. Clerk frontend auth requires a browser-safe publishable key that starts with pk_.'
    );
  }

  return publishableKey;
}

const clerkPublishableKey = requireClerkPublishableKey();

createRoot(document.getElementById('root')!).render(
  <ClerkProvider publishableKey={clerkPublishableKey}>
    <App />
  </ClerkProvider>
);

