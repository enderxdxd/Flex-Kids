import React, { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import UnitSelector from './UnitSelector';

interface LayoutProps {
  children: ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: '📊' },
    { path: '/checkinout', label: 'Check-In/Out', icon: '🎯' },
    { path: '/customers', label: 'Clientes', icon: '👥' },
    { path: '/packages', label: 'Pacotes', icon: '📦' },
    { path: '/payments', label: 'Pagamentos', icon: '💰' },
    { path: '/settings', label: 'Configurações', icon: '⚙️' },
  ];

  return (
    <div className="flex h-screen bg-gray-100">
      <aside className="w-64 bg-white shadow-lg">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-primary-600">Flex-Kids</h1>
          <p className="text-sm text-gray-500">Manager</p>
        </div>

        <div className="px-4 mb-4">
          <UnitSelector />
        </div>

        <nav className="px-4">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 mb-2 rounded-lg transition-colors ${
                isActive(item.path)
                  ? 'bg-primary-500 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="font-medium">{item.label}</span>
            </Link>
          ))}
        </nav>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
};

export default Layout;
