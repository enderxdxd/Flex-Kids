import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { UnitProvider } from './contexts/UnitContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import CheckInOut from './pages/CheckInOut';
import Customers from './pages/Customers';
import Packages from './pages/Packages';
import Payments from './pages/Payments';
import Settings from './pages/Settings';

function App() {
  return (
    <UnitProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/checkinout" element={<CheckInOut />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/packages" element={<Packages />} />
            <Route path="/payments" element={<Payments />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </Layout>
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
