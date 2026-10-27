import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import { Spinner } from './components/ui';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { CustomersPage } from './pages/CustomersPage';
import { CustomerDetailPage } from './pages/CustomerDetailPage';
import { KycQueuePage } from './pages/KycQueuePage';
import { KycReviewPage } from './pages/KycReviewPage';
import { ReferralsPage } from './pages/ReferralsPage';
import { ActivityLogsPage } from './pages/ActivityLogsPage';
import { SettingsPage } from './pages/SettingsPage';
import { PaymentsPage } from './pages/PaymentsPage';
import { InvestmentPlansPage } from './pages/InvestmentPlansPage';
import { InvestmentsPage } from './pages/InvestmentsPage';
import { WithdrawalsPage } from './pages/WithdrawalsPage';
import { WalletLedgerPage } from './pages/WalletLedgerPage';
import { ReportsPage } from './pages/ReportsPage';
import { AnnouncementsPage } from './pages/AnnouncementsPage';
import { SupportPage } from './pages/SupportPage';
import { BankChangesPage } from './pages/BankChangesPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { LoginLocationState } from './types';

const FullScreenLoader: React.FC = () => (
  <div className="min-h-screen bg-slate-50 dark:bg-[#000000] flex items-center justify-center">
    <Spinner className="w-8 h-8" />
  </div>
);

// Staff-only area. Unauthenticated visitors are sent to /login and returned to the deep link after signing in.
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <FullScreenLoader />;

  if (!isAuthenticated) {
    const state: LoginLocationState = { from: { pathname: location.pathname, search: location.search } };
    return <Navigate to="/login" replace state={state} />;
  }

  return <>{children}</>;
};

// Manager-only area (SUPER_ADMIN / ADMIN). Editors are view-only staff and are sent back to the dashboard.
const ManagerRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAdmin, isLoading } = useAuth();
  if (isLoading) return <FullScreenLoader />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

// Keeps signed-in staff away from the login screen
const PublicOnlyRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <FullScreenLoader />;

  if (isAuthenticated) {
    const from = (location.state as LoginLocationState | null)?.from;
    const target = from && from.pathname !== '/login' ? `${from.pathname}${from.search || ''}` : '/dashboard';
    return <Navigate to={target} replace />;
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            <PublicOnlyRoute>
              <LoginPage />
            </PublicOnlyRoute>
          }
        />

        {/* Protected admin routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="payments" element={<PaymentsPage />} />
          <Route path="investment-plans" element={<InvestmentPlansPage />} />
          <Route path="investments" element={<InvestmentsPage />} />
          <Route path="withdrawals" element={<WithdrawalsPage />} />
          <Route path="wallet-transactions" element={<WalletLedgerPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="announcements" element={<AnnouncementsPage />} />
          <Route path="support" element={<SupportPage />} />
          <Route path="customers" element={<CustomersPage />} />
          <Route path="customers/:id" element={<CustomerDetailPage />} />
          <Route path="kyc" element={<KycQueuePage />} />
          <Route path="kyc/:id" element={<KycReviewPage />} />
          <Route path="bank-changes" element={<BankChangesPage />} />
          <Route path="referrals" element={<ReferralsPage />} />
          <Route path="activity-logs" element={<ActivityLogsPage />} />
          <Route
            path="settings"
            element={
              <ManagerRoute>
                <SettingsPage />
              </ManagerRoute>
            }
          />
          {/* Unknown paths render a 404 inside the admin layout */}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};
