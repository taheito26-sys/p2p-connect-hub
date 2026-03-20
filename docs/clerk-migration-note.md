# Clerk frontend auth migration

## Files changed
- `src/main.tsx`
- `src/App.tsx`
- `src/lib/auth-context.tsx`
- `src/lib/api.ts`
- `src/pages/auth/LoginPage.tsx`
- `src/pages/auth/SignupPage.tsx`
- `src/components/layout/TrackerTopbar.tsx`
- `src/components/layout/AppSidebar.tsx`
- `src/shims/clerk-react.tsx`
- `vite.config.ts`
- `tsconfig.json`
- `tsconfig.app.json`
- `.env.example`

## Old frontend auth pieces removed or bypassed
- Removed the legacy email/password login and signup form handlers from the frontend routes.
- Removed frontend use of `/api/auth/login`, `/api/auth/signup`, `/api/auth/logout`, `/api/auth/reset-password`, and `/api/auth/session`.
- Removed the old frontend session bootstrap logic that previously made the custom auth context authoritative.
- Deleted the legacy verify-email and reset-password pages from the frontend path.

## Backend dependency still expected later
- The backend should verify the Clerk bearer token attached by the frontend API helper and map the Clerk user/session to the app's merchant identity before protected API routes authorize business actions.


## Environment note
- The frontend now accepts `VITE_CLERK_PUBLISHABLE_KEY` or `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` for the publishable key. If your backend expects a custom Clerk JWT template instead of the default session token, set `VITE_CLERK_JWT_TEMPLATE` (or `NEXT_PUBLIC_CLERK_JWT_TEMPLATE`) so frontend API calls request the matching token shape. `CLERK_SECRET_KEY` remains a backend/server-only secret for token verification and server-side Clerk operations. Use placeholders in committed env examples and keep real Clerk credentials only in deployment secrets or untracked local env files.
