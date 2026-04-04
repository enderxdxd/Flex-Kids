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
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 0 1-.657.643 48.39 48.39 0 0 1-4.163-.3c.186 1.613.293 3.25.315 4.907a.656.656 0 0 1-.658.663v0c-.355 0-.676-.186-.959-.401a1.647 1.647 0 0 0-1.003-.349c-1.036 0-1.875 1.007-1.875 2.25s.84 2.25 1.875 2.25c.369 0 .713-.128 1.003-.349.283-.215.604-.401.959-.401v0c.31 0 .555.26.532.57a48.039 48.039 0 0 1-.642 5.056c1.518.19 3.058.309 4.616.354a.64.64 0 0 0 .657-.643v0c0-.355-.186-.676-.401-.959a1.647 1.647 0 0 1-.349-1.003c0-1.035 1.008-1.875 2.25-1.875 1.243 0 2.25.84 2.25 1.875 0 .369-.128.713-.349 1.003-.215.283-.4.604-.4.959v0c0 .333.277.599.61.58a48.1 48.1 0 0 0 5.427-.63 48.05 48.05 0 0 0 .582-4.717.532.532 0 0 0-.533-.57v0c-.355 0-.676.186-.959.401-.29.221-.634.349-1.003.349-1.035 0-1.875-1.007-1.875-2.25s.84-2.25 1.875-2.25c.37 0 .713.128 1.003.349.283.215.604.401.96.401v0a.656.656 0 0 0 .658-.663 48.422 48.422 0 0 0-.37-5.36c-1.886.342-3.81.574-5.766.689a.578.578 0 0 1-.61-.58v0Z" /></svg>
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
