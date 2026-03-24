import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { ThemeProvider } from '@/lib/theme-context';
import { AppLayout } from '@/components/layout/AppLayout';

import LoginPage from './pages/LoginPage';
import OnboardingPage from './pages/merchant/OnboardingPage';
import DashboardPage from './pages/merchant/DashboardPage';
import NetworkPage from './pages/merchant/NetworkPage';
import RelationshipWorkspace from './pages/merchant/RelationshipWorkspace';
import MessagesPage from './pages/merchant/MessagesPage';
import DealsPage from './pages/merchant/DealsPage';
import AnalyticsPage from './pages/merchant/AnalyticsPage';
import InvitationsPage from './pages/merchant/InvitationsPage';
import ApprovalsPage from './pages/merchant/ApprovalsPage';
import RelationshipsPage from './pages/merchant/RelationshipsPage';
import SettingsPage from './pages/merchant/SettingsPage';
import CRMPage from './pages/merchant/CRMPage';
import P2PTrackerPage from './pages/trading/P2PTrackerPage';
import VaultPage from './pages/trading/VaultPage';
import OrdersPage from './pages/trading/OrdersPage';
import StockPage from './pages/trading/StockPage';
import CalendarPage from './pages/trading/CalendarPage';
import NotificationsPage from './pages/NotificationsPage';
import NotFound from './pages/NotFound';

const queryClient = new QueryClient();

function LoadingScreen() {
  return <div className="flex h-screen items-center justify-center"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function ProfileGate({ children }: { children: React.ReactNode }) {
  const { profile, isLoading } = useAuth();
  if (isLoading) return <LoadingScreen />;
  if (!profile) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/onboarding" element={<AuthGate><OnboardingPage /></AuthGate>} />

              <Route element={<AuthGate><ProfileGate><AppLayout /></ProfileGate></AuthGate>}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/trading/orders" element={<OrdersPage />} />
                <Route path="/trading/stock" element={<StockPage />} />
                <Route path="/trading/calendar" element={<CalendarPage />} />
                <Route path="/trading/p2p" element={<P2PTrackerPage />} />
                <Route path="/crm" element={<CRMPage />} />
                <Route path="/network" element={<NetworkPage />} />
                <Route path="/network/relationships/:id" element={<RelationshipWorkspace />} />
                <Route path="/messages" element={<MessagesPage />} />
                <Route path="/deals" element={<DealsPage />} />
                <Route path="/invitations" element={<InvitationsPage />} />
                <Route path="/approvals" element={<ApprovalsPage />} />
                <Route path="/relationships" element={<RelationshipsPage />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/vault" element={<VaultPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/notifications" element={<NotificationsPage />} />
              </Route>

              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/auth/*" element={<Navigate to="/dashboard" replace />} />
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
