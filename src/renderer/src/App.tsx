import { useEffect, useState } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { UnitProvider } from './contexts/UnitContext';
import Layout from './components/Layout';
import Dashboard from './pages/DashboardNew';
import CheckInOut from './pages/CheckInOut';
import Customers from './pages/Customers';
import Packages from './pages/Packages';
import Payments from './pages/Payments';
import Settings from './pages/Settings';
import { OnlineStatusBadge } from './components/OnlineStatusBadge';
import { syncService } from '../../shared/database/syncService';

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
        // Mesmo com erro, permite usar o app (modo degradado)
        setIsInitialized(true);
      });
  }, []);

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Inicializando sistema...</p>
        </div>
      </div>
    );
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
          <Route path="/packages" element={<Layout><Packages /></Layout>} />
          <Route path="/payments" element={<Layout><Payments /></Layout>} />
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

export default App;
