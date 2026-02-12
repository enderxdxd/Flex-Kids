import { useEffect, useState } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { UnitProvider } from './contexts/UnitContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Dashboard from './pages/DashboardNew';
import CheckInOut from './pages/CheckInOut';
import Customers from './pages/Customers';
import Packages from './pages/Packages';
import SellPackage from './pages/SellPackage';
import Payments from './pages/Payments';
import Settings from './pages/Settings';
import VisitHistory from './pages/VisitHistory';
import CashReport from './pages/CashReport';
import CancellationReport from './pages/CancellationReport';
import LoginPage from './pages/LoginPage';
import { OnlineStatusBadge } from './components/OnlineStatusBadge';
import { syncService } from '../../shared/database/syncService';

function AppRoutes({ initError }: { initError: string | null }) {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <UnitProvider>
      <OnlineStatusBadge />
      {initError && (
        <div className="fixed top-20 right-4 z-50 bg-yellow-500 text-white px-4 py-2 rounded-lg shadow-lg">
          <p className="text-sm">⚠️ Sistema em modo limitado</p>
        </div>
      )}
      <Router>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/checkinout" element={<Layout><CheckInOut /></Layout>} />
          <Route path="/customers" element={<Layout><Customers /></Layout>} />
          <Route path="/packages" element={
            <Layout>
              <ProtectedRoute>
                <Packages />
              </ProtectedRoute>
            </Layout>
          } />
          <Route path="/sell-package" element={<Layout><SellPackage /></Layout>} />
          <Route path="/payments" element={<Layout><Payments /></Layout>} />
          <Route path="/history" element={<Layout><VisitHistory /></Layout>} />
          <Route path="/cash-report" element={<Layout><CashReport /></Layout>} />
          <Route path="/cancellations" element={<Layout><CancellationReport /></Layout>} />
          <Route path="/settings" element={<Layout><Settings /></Layout>} />
        </Routes>
      </Router>
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
    </UnitProvider>
  );
}

function App() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    syncService.init()
      .then(() => {
        setIsInitialized(true);
        console.log('App initialized successfully');
      })
      .catch((error) => {
        console.error('Failed to initialize app:', error);
        setInitError(error.message);
        setIsInitialized(true);
      });
  }, []);

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-500 mx-auto mb-4"></div>
          <p className="text-slate-500 text-sm">Inicializando sistema...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthProvider>
      <AppRoutes initError={initError} />
    </AuthProvider>
  );
}

export default App;
