import React from 'react';
import { useUnit } from '../contexts/UnitContext';
import { useAuth } from '../contexts/AuthContext';

interface NavbarProps {
  onRefresh?: () => void;
  loading?: boolean;
}

const Navbar: React.FC<NavbarProps> = ({ onRefresh, loading }) => {
  const { currentUnit, units, setCurrentUnit } = useUnit();
  const { isAuthenticated, logout } = useAuth();

  return (
    <div className="bg-white shadow-lg border-b-4 border-indigo-500">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo e Título */}
          <div className="flex items-center gap-4">
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-3 rounded-xl shadow-lg">
              <span className="text-3xl">🎮</span>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Flex-Kids</h1>
              <p className="text-sm text-gray-500">Sistema de Gestão Integrado</p>
            </div>
          </div>

          {/* Navegação Central */}
          <nav className="hidden md:flex items-center gap-2">
            <a
              href="#/dashboard"
              className="px-4 py-2 rounded-lg font-medium text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 transition-all"
            >
              📊 Dashboard
            </a>
            <a
              href="#/customers"
              className="px-4 py-2 rounded-lg font-medium text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 transition-all"
            >
              👥 Clientes
            </a>
            <a
              href="#/sell-package"
              className="px-4 py-2 rounded-lg font-medium text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 transition-all"
            >
              � Vender
            </a>
            <a
              href="#/packages"
              className="px-4 py-2 rounded-lg font-medium text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 transition-all"
            >
              📦 Gestão
            </a>
            <a
              href="#/payments"
              className="px-4 py-2 rounded-lg font-medium text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 transition-all"
            >
              💰 Pagamentos
            </a>
            <a
              href="#/history"
              className="px-4 py-2 rounded-lg font-medium text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 transition-all"
            >
              📋 Historico
            </a>
            <a
              href="#/cash-report"
              className="px-4 py-2 rounded-lg font-medium text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 transition-all"
            >
              📊 Caixa
            </a>
            <a
              href="#/settings"
              className="px-4 py-2 rounded-lg font-medium text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 transition-all"
            >
              ⚙️ Config
            </a>
          </nav>

          {/* Seletor de Unidade, Logout e Atualizar */}
          <div className="flex items-center gap-4">
            {isAuthenticated && (
              <button
                onClick={logout}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium flex items-center gap-2"
                title="Sair da área administrativa"
              >
                🔓 Sair
              </button>
            )}
            <div className="text-right">
              <p className="text-xs text-gray-500">Unidade Atual</p>
              <select
                value={currentUnit}
                onChange={(e) => setCurrentUnit(e.target.value)}
                className="text-lg font-bold text-indigo-600 bg-transparent border-2 border-indigo-200 rounded-lg px-4 py-2 focus:outline-none focus:border-indigo-500 cursor-pointer hover:bg-indigo-50 transition-all"
              >
                {units.map(unit => (
                  <option key={unit.id} value={unit.id}>{unit.name}</option>
                ))}
              </select>
            </div>

            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={loading}
                className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-6 py-3 rounded-xl hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg font-medium"
              >
                <span className={loading ? 'animate-spin' : ''}>{loading ? '⏳' : '🔄'}</span>
                Atualizar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Navbar;
