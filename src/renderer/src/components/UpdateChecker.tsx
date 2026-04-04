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
        <h3 className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-1.5"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.992 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" /></svg> Atualizações</h3>
        <p className="text-xs text-slate-500">Disponível apenas na versão instalada.</p>
      </div>
    );
  }

  const handleCheck = () => {
    setUpdateStatus({ status: 'checking' });
    api.check();
  };

  const handleDownload = async () => {
    try {
      setUpdateStatus(prev => ({ ...prev, status: 'downloading' }));
      // Garante que o electron-updater sabe qual versão baixar (igual ao UpdateModal)
      const checkResult = await api.check();
      console.log('[UpdateChecker] Check result before download:', checkResult);
      if (!checkResult?.success) {
        setUpdateStatus({ status: 'error', message: checkResult?.error || 'Erro ao verificar atualização' });
        return;
      }
      const dlResult = await api.download();
      console.log('[UpdateChecker] Download result:', dlResult);
      if (!dlResult?.success) {
        setUpdateStatus({ status: 'error', message: dlResult?.error || 'Erro ao iniciar download' });
      }
    } catch (err: any) {
      console.error('[UpdateChecker] Download error:', err);
      setUpdateStatus({ status: 'error', message: err?.message || 'Erro inesperado' });
    }
  };

  const handleInstall = () => {
    api.install();
  };

  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/20 shadow-md p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.992 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" /></svg>
          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Atualizações</h3>
        </div>
        {appVersion && (
          <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full">
            v{appVersion}
          </span>
        )}
      </div>

      {updateStatus.status === 'idle' && (
        <button
          onClick={handleCheck}
          className="w-full text-xs font-semibold bg-violet-600 hover:bg-violet-700 text-white py-2.5 px-4 rounded-xl transition-all hover:shadow-md flex items-center justify-center gap-2"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          Verificar Atualizações
        </button>
      )}

      {updateStatus.status === 'checking' && (
        <div className="flex items-center gap-2 text-sm text-slate-500 py-2">
          <svg className="w-4 h-4 animate-spin text-slate-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          Verificando...
        </div>
      )}

      {updateStatus.status === 'up-to-date' && (
        <div className="space-y-2">
          <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
            <p className="text-xs font-semibold text-emerald-700 flex items-center gap-1"><svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg> Você já está na versão mais recente!</p>
          </div>
          <button
            onClick={handleCheck}
            className="text-[11px] text-slate-400 hover:text-violet-600 transition-colors font-medium"
          >
            Verificar novamente
          </button>
        </div>
      )}

      {updateStatus.status === 'available' && (
        <div className="space-y-3">
          <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
            <p className="text-xs font-semibold text-amber-700">
              Nova versão disponível: <strong>v{updateStatus.version}</strong>
            </p>
          </div>
          <button
            onClick={handleDownload}
            className="w-full text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white py-2.5 px-4 rounded-xl transition-all hover:shadow-md flex items-center justify-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Baixar Atualização
          </button>
        </div>
      )}

      {updateStatus.status === 'downloading' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-blue-600 flex items-center gap-1"><svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg> Baixando...</p>
            <span className="text-xs font-bold text-blue-600">{updateStatus.percent || 0}%</span>
          </div>
          <div className="w-full bg-slate-200/60 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${updateStatus.percent || 0}%` }}
            />
          </div>
        </div>
      )}

      {updateStatus.status === 'downloaded' && (
        <div className="space-y-3">
          <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
            <p className="text-xs font-semibold text-emerald-700 flex items-center gap-1"><svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg> Atualização pronta para instalar!</p>
          </div>
          <button
            onClick={handleInstall}
            className="w-full text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 px-4 rounded-xl transition-all hover:shadow-md flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.992 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" /></svg> Reiniciar e Instalar
          </button>
        </div>
      )}

      {updateStatus.status === 'error' && (
        <div className="space-y-2">
          <div className="bg-red-50 rounded-xl p-3 border border-red-100">
            <p className="text-xs font-semibold text-red-700 flex items-center gap-1"><svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg> Erro ao verificar</p>
            <p className="text-[11px] text-red-500 mt-0.5">{updateStatus.message}</p>
          </div>
          <button
            onClick={handleCheck}
            className="text-[11px] text-slate-400 hover:text-violet-600 transition-colors font-medium"
          >
            Tentar novamente
          </button>
        </div>
      )}
    </div>
  );
};

export default UpdateChecker;
