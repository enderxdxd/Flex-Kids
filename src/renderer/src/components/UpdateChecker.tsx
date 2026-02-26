import React, { useEffect, useState } from 'react';

interface UpdateStatus {
  status: 'idle' | 'checking' | 'available' | 'up-to-date' | 'downloading' | 'downloaded' | 'error';
  version?: string;
  percent?: number;
  message?: string;
}

const UpdateChecker: React.FC = () => {
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({ status: 'idle' });
  const [appVersion, setAppVersion] = useState<string>('');

  const api = (window as any).electronAPI?.updater;

  useEffect(() => {
    if (!api) return;

    api.getVersion().then((v: string) => setAppVersion(v || ''));

    const unsubscribe = api.onStatus((data: UpdateStatus) => {
      setUpdateStatus(data);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  if (!api) {
    return (
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
        <h3 className="text-sm font-semibold text-slate-300 mb-2">🔄 Atualizações</h3>
        <p className="text-xs text-slate-500">Disponível apenas na versão instalada.</p>
      </div>
    );
  }

  const handleCheck = () => {
    setUpdateStatus({ status: 'checking' });
    api.check();
  };

  const handleDownload = () => {
    api.download();
  };

  const handleInstall = () => {
    api.install();
  };

  return (
    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-300">🔄 Atualizações</h3>
        {appVersion && (
          <span className="text-[10px] bg-slate-700 text-slate-400 px-2 py-0.5 rounded-full">
            v{appVersion}
          </span>
        )}
      </div>

      {updateStatus.status === 'idle' && (
        <button
          onClick={handleCheck}
          className="w-full text-sm bg-violet-600 hover:bg-violet-500 text-white py-2 px-4 rounded-lg transition-colors"
        >
          Verificar Atualizações
        </button>
      )}

      {updateStatus.status === 'checking' && (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <span className="animate-spin">⏳</span>
          Verificando...
        </div>
      )}

      {updateStatus.status === 'up-to-date' && (
        <div className="space-y-2">
          <p className="text-sm text-green-400">✅ Você já está na versão mais recente!</p>
          <button
            onClick={handleCheck}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            Verificar novamente
          </button>
        </div>
      )}

      {updateStatus.status === 'available' && (
        <div className="space-y-3">
          <p className="text-sm text-amber-400">
            🆕 Nova versão disponível: <strong>v{updateStatus.version}</strong>
          </p>
          <button
            onClick={handleDownload}
            className="w-full text-sm bg-amber-600 hover:bg-amber-500 text-white py-2 px-4 rounded-lg transition-colors"
          >
            Baixar Atualização
          </button>
        </div>
      )}

      {updateStatus.status === 'downloading' && (
        <div className="space-y-2">
          <p className="text-sm text-blue-400">⬇️ Baixando atualização...</p>
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${updateStatus.percent || 0}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 text-right">{updateStatus.percent || 0}%</p>
        </div>
      )}

      {updateStatus.status === 'downloaded' && (
        <div className="space-y-3">
          <p className="text-sm text-green-400">✅ Atualização pronta para instalar!</p>
          <button
            onClick={handleInstall}
            className="w-full text-sm bg-green-600 hover:bg-green-500 text-white py-2 px-4 rounded-lg transition-colors"
          >
            Reiniciar e Instalar
          </button>
        </div>
      )}

      {updateStatus.status === 'error' && (
        <div className="space-y-2">
          <p className="text-sm text-red-400">❌ Erro ao verificar atualizações</p>
          <p className="text-xs text-slate-500">{updateStatus.message}</p>
          <button
            onClick={handleCheck}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      )}
    </div>
  );
};

export default UpdateChecker;
