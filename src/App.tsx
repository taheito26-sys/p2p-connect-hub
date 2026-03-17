import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme-context";
import { AppLayout } from "@/components/layout/AppLayout";

import LoginPage from "./pages/auth/LoginPage";
import SignupPage from "./pages/auth/SignupPage";
import VerifyEmailPage from "./pages/auth/VerifyEmailPage";
import ResetPasswordPage from "./pages/auth/ResetPasswordPage";
import OnboardingPage from "./pages/merchant/OnboardingPage";
import DashboardPage from "./pages/merchant/DashboardPage";
import NetworkPage from "./pages/merchant/NetworkPage";
import RelationshipWorkspace from "./pages/merchant/RelationshipWorkspace";
import MessagesPage from "./pages/merchant/MessagesPage";
import DealsPage from "./pages/merchant/DealsPage";
import AnalyticsPage from "./pages/merchant/AnalyticsPage";
import AuditPage from "./pages/merchant/AuditPage";
import SettingsPage from "./pages/merchant/SettingsPage";
import CRMPage from "./pages/merchant/CRMPage";
import P2PTrackerPage from "./pages/trading/P2PTrackerPage";
import VaultPage from "./pages/trading/VaultPage";
import OrdersPage from "./pages/trading/OrdersPage";
import StockPage from "./pages/trading/StockPage";
import CalendarPage from "./pages/trading/CalendarPage";
import NotificationsPage from "./pages/NotificationsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated } = useAuth();
  if (isLoading) return <div className="flex h-screen items-center justify-center"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  if (!isAuthenticated) return <Navigate to="/auth/login" replace />;
  return <>{children}</>;
}

function ProfileGuard({ children }: { children: React.ReactNode }) {
  const { profile, isLoading } = useAuth();
  if (isLoading) return null;
  if (!profile) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Auth */}
            <Route path="/auth/login" element={<LoginPage />} />
            <Route path="/auth/signup" element={<SignupPage />} />
            <Route path="/auth/verify-email" element={<VerifyEmailPage />} />
            <Route path="/auth/reset-password" element={<ResetPasswordPage />} />

            {/* Onboarding */}
            <Route path="/onboarding" element={<AuthGuard><OnboardingPage /></AuthGuard>} />

            {/* App Shell */}
            <Route element={<AuthGuard><ProfileGuard><AppLayout /></ProfileGuard></AuthGuard>}>
              {/* Trading */}
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/trading/orders" element={<OrdersPage />} />
              <Route path="/trading/stock" element={<StockPage />} />
              <Route path="/trading/calendar" element={<CalendarPage />} />
              <Route path="/trading/p2p" element={<P2PTrackerPage />} />
              <Route path="/crm" element={<CRMPage />} />

              {/* Network (combined: Directory + Invitations + Relationships + Approvals) */}
              <Route path="/network" element={<NetworkPage />} />
              <Route path="/network/relationships/:id" element={<RelationshipWorkspace />} />

              {/* Supporting */}
              <Route path="/messages" element={<MessagesPage />} />
              <Route path="/deals" element={<DealsPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/vault" element={<VaultPage />} />
              <Route path="/audit" element={<AuditPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
            </Route>

            {/* Root redirect */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            {/* Legacy redirects */}
            <Route path="/merchant" element={<Navigate to="/dashboard" replace />} />
            <Route path="/merchant/*" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
