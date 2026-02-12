import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { loginAdmin } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    setTimeout(() => {
      const success = loginAdmin(password);
      if (success) {
        setIsUnlocked(true);
      } else {
        setError('Senha de administrador incorreta');
        setPassword('');
      }
      setIsLoading(false);
    }, 400);
  };

  if (isUnlocked) {
    return <>{children}</>;
  }

  return (
    <div className="flex items-center justify-center py-16">
      <div className="bg-white rounded-xl border border-slate-200 max-w-sm w-full p-6">
        <div className="text-center mb-5">
          <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl">🔒</span>
          </div>
          <h2 className="text-lg font-bold text-slate-800">Área Administrativa</h2>
          <p className="text-xs text-slate-500 mt-1">Digite a senha de administrador</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700 font-medium">
              {error}
            </div>
          )}

          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Senha admin..."
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              required
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {isLoading ? '⏳ Verificando...' : 'Desbloquear'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ProtectedRoute;
