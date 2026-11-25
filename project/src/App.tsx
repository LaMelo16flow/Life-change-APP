import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { ToastProvider } from './contexts/ToastContext';
import { AuthForm } from './components/AuthForm';
import { ResetPasswordForm } from './components/ResetPasswordForm';
import { Dashboard } from './components/Dashboard';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppUpdater } from './components/AppUpdater';
import { LoadingScreen } from './components/LoadingScreen';

function AppContent() {
  const { user, profile, loading, isPasswordRecovery } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (isPasswordRecovery) {
    return <ResetPasswordForm />;
  }

  if (!user || !profile || profile.account_status !== 'approved') {
    return <AuthForm />;
  }

  return <Dashboard />;
}

function App() {
  return (
    <ErrorBoundary>
      <LanguageProvider>
        <ToastProvider>
          <AuthProvider>
            <AppContent />
            <AppUpdater />
          </AuthProvider>
        </ToastProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
}

export default App;
