import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const UNITS = [
  { id: 'alphaville', name: 'Alphaville' },
  { id: 'marista', name: 'Marista' },
  { id: 'palmas', name: 'Palmas' },
  { id: 'buenavista', name: 'Buenavista' },
];

const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const [selectedUnit, setSelectedUnit] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUnit) {
      setError('Selecione uma unidade');
      return;
    }
    setError('');
    setIsLoading(true);

    setTimeout(() => {
      const success = login(selectedUnit, password);
      if (!success) {
        setError('Senha incorreta para esta unidade');
        setPassword('');
      }
      setIsLoading(false);
    }, 400);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-violet-500/25">
            <span className="text-3xl">🎮</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Flex-Kids</h1>
          <p className="text-sm text-slate-500 mt-1">Selecione sua unidade para entrar</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700 font-medium">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-2">Unidade</label>
              <div className="grid grid-cols-2 gap-2">
                {UNITS.map(unit => (
                  <button
                    key={unit.id}
                    type="button"
                    onClick={() => { setSelectedUnit(unit.id); setError(''); }}
                    className={`p-3 rounded-lg border text-sm font-semibold transition-all ${
                      selectedUnit === unit.id
                        ? 'border-violet-500 bg-violet-50 text-violet-700'
                        : 'border-slate-200 text-slate-600 hover:border-violet-300 hover:bg-slate-50'
                    }`}
                  >
                    {unit.name}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Senha da Unidade</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite a senha..."
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                required
                autoFocus={!!selectedUnit}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !selectedUnit}
              className="w-full py-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {isLoading ? '⏳ Verificando...' : 'Entrar'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400 mt-4">
          Cada unidade possui acesso exclusivo ao seu sistema
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
