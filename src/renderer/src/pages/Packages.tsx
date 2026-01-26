import React, { useEffect, useState } from 'react';
import { Package } from '@shared/types';
import { packagesService } from '@shared/firebase/services';
import { format } from 'date-fns';

const Packages: React.FC = () => {
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(false);
  const [showActiveOnly, setShowActiveOnly] = useState(true);

  useEffect(() => {
    loadPackages();
  }, [showActiveOnly]);

  const loadPackages = async () => {
    try {
      setLoading(true);
      const allPackages = await packagesService.getActivePackages();
      setPackages(allPackages);
    } catch (error) {
      console.error('Error loading packages:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPackageProgress = (pkg: Package) => {
    return (pkg.usedHours / pkg.hours) * 100;
  };

  const getRemainingHours = (pkg: Package) => {
    return pkg.hours - pkg.usedHours;
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Pacotes</h1>
        <p className="text-gray-500 mt-2">Gerenciar pacotes de horas</p>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={showActiveOnly}
                onChange={(e) => setShowActiveOnly(e.target.checked)}
                className="w-4 h-4 text-primary-500 rounded focus:ring-primary-500"
              />
              <span className="text-sm font-medium text-gray-700">Apenas ativos</span>
            </label>
          </div>
          <button className="bg-primary-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-primary-600 transition-colors">
            + Novo Pacote
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold mb-4">Lista de Pacotes ({packages.length})</h2>

        {loading ? (
          <div className="text-center py-8 text-gray-500">Carregando...</div>
        ) : packages.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Nenhum pacote encontrado
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {packages.map((pkg) => (
              <div
                key={pkg.id}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-bold text-lg">{pkg.type}</h3>
                    <p className="text-sm text-gray-500">
                      R$ {pkg.price.toFixed(2)}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded ${
                      pkg.active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {pkg.active ? 'Ativo' : 'Inativo'}
                  </span>
                </div>

                <div className="mb-3">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Horas utilizadas</span>
                    <span className="font-medium">
                      {pkg.usedHours}h / {pkg.hours}h
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-primary-500 h-2 rounded-full transition-all"
                      style={{ width: `${getPackageProgress(pkg)}%` }}
                    />
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    Restam {getRemainingHours(pkg).toFixed(1)} horas
                  </p>
                </div>

                {pkg.expiresAt && (
                  <p className="text-sm text-gray-500 mb-3">
                    Expira em: {format(new Date(pkg.expiresAt), 'dd/MM/yyyy')}
                  </p>
                )}

                <div className="flex gap-2">
                  <button className="flex-1 text-sm bg-gray-100 text-gray-700 py-2 rounded hover:bg-gray-200 transition-colors">
                    Detalhes
                  </button>
                  <button className="flex-1 text-sm bg-primary-100 text-primary-700 py-2 rounded hover:bg-primary-200 transition-colors">
                    Editar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Packages;
