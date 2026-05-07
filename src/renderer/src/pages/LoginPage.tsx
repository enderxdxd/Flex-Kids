import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Card, Button, Input, cn } from '../components/ui';
import { BuildingIcon } from '../components/icons/Icons';

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUnit) {
      setError('Selecione uma unidade');
      return;
    }
    setError('');
    setIsLoading(true);

    const result = await login(selectedUnit, password);
    if (!result.success) {
      setError(result.error || 'Senha incorreta para esta unidade');
      setPassword('');
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm animate-fade-in-up">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-brand-gradient rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-brand">
            <BuildingIcon className="text-white" size={32} />
          </div>
          <h1 className="text-display bg-brand-gradient bg-clip-text text-transparent">Flex-Kids</h1>
          <p className="text-sm text-slate-500 mt-1">Selecione sua unidade para entrar</p>
        </div>

        <Card padding="lg" accent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700 font-medium">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">Unidade</label>
              <div className="grid grid-cols-2 gap-2">
                {UNITS.map(unit => (
                  <button
                    key={unit.id}
                    type="button"
                    onClick={() => { setSelectedUnit(unit.id); setError(''); }}
                    className={cn(
                      'p-3 rounded-lg border text-sm font-semibold transition-all duration-150 active:scale-[0.98]',
                      selectedUnit === unit.id
                        ? 'border-brand-400 bg-brand-gradient-soft text-brand-700 shadow-brand-sm'
                        : 'border-slate-200 text-slate-700 hover:border-brand-300 hover:bg-brand-50',
                    )}
                  >
                    {unit.name}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Senha da Unidade</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite a senha..."
                required
                autoFocus={!!selectedUnit}
              />
            </div>

            <Button
              type="submit"
              fullWidth
              size="lg"
              loading={isLoading}
              disabled={!selectedUnit}
            >
              Entrar
            </Button>
          </form>
        </Card>

        <p className="text-center text-xs text-slate-500 mt-4">
          Cada unidade possui acesso exclusivo ao seu sistema
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
