import React, { useState, useEffect } from 'react';
import { DownloadCloudIcon } from '../icons/Icons';

interface UpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentVersion: string;
  latestVersion: string;
  releaseNotes?: string;
}

type DownloadState = 'idle' | 'downloading' | 'downloaded' | 'error';

const UpdateModal: React.FC<UpdateModalProps> = ({
  isOpen,
  onClose,
  currentVersion,
  latestVersion,
  releaseNotes,
}) => {
  const [downloadState, setDownloadState] = useState<DownloadState>('idle');
  const [downloadPercent, setDownloadPercent] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  const api = (window as any).electronAPI?.updater;

  useEffect(() => {
    if (!api || !isOpen) return;

    const unsubscribe = api.onStatus((data: any) => {
      switch (data.status) {
        case 'downloading':
          setDownloadState('downloading');
          setDownloadPercent(data.percent || 0);
          break;
        case 'downloaded':
          setDownloadState('downloaded');
          setDownloadPercent(100);
          break;
        case 'error':
          setDownloadState('error');
          setErrorMsg(data.message || 'Erro desconhecido');
          break;
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [api, isOpen]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setDownloadState('idle');
      setDownloadPercent(0);
      setErrorMsg('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDownload = async () => {
    if (api) {
      try {
        setDownloadState('downloading');
        setDownloadPercent(0);

        // Garante que o electron-updater sabe qual versão baixar
        const checkResult = await api.check();
        console.log('[UpdateModal] Check result:', checkResult);

        if (!checkResult?.success) {
          setDownloadState('error');
          setErrorMsg(checkResult?.error || 'Erro ao verificar atualização');
          return;
        }

        const dlResult = await api.download();
        console.log('[UpdateModal] Download result:', dlResult);

        if (!dlResult?.success) {
          setDownloadState('error');
          setErrorMsg(dlResult?.error || 'Erro ao iniciar download');
        }
      } catch (err: any) {
        console.error('[UpdateModal] Download error:', err);
        setDownloadState('error');
        setErrorMsg(err?.message || 'Erro inesperado no download');
      }
    } else {
      // Fallback: open GitHub releases page
      window.open('https://github.com/enderxdxd/Flex-Kids/releases/latest', '_blank');
    }
  };

  const handleInstall = () => {
    if (api) {
      api.install();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 max-w-lg w-full animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="p-6 border-b border-slate-200/50">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-violet-100 to-purple-200 rounded-2xl flex items-center justify-center">
              <DownloadCloudIcon className="text-violet-600" size={32} />
            </div>
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
                {downloadState === 'downloaded' ? 'Atualização Pronta!' : 'Nova Atualização Disponível'}
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                {downloadState === 'downloaded'
                  ? 'Reinicie o app para aplicar a atualização'
                  : `Versão ${latestVersion} está pronta para download`}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Version Info */}
          <div className="flex items-center justify-between p-4 bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-2xl border border-slate-200/50">
            <div>
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Versão Atual</p>
              <p className="text-lg font-bold text-slate-700 mt-1">{currentVersion}</p>
            </div>
            <div className="text-slate-400 text-2xl">→</div>
            <div>
              <p className="text-xs text-violet-600 font-semibold uppercase tracking-wide">Nova Versão</p>
              <p className="text-lg font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent mt-1">
                {latestVersion}
              </p>
            </div>
          </div>

          {/* Download Progress */}
          {downloadState === 'downloading' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-blue-600">⬇️ Baixando atualização...</p>
                <span className="text-sm font-bold text-blue-600">{downloadPercent}%</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-violet-500 to-purple-500 h-3 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${downloadPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Downloaded */}
          {downloadState === 'downloaded' && (
            <div className="bg-green-50 border border-green-200/50 rounded-2xl p-4">
              <p className="text-sm text-green-700 font-semibold">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 inline-block align-text-bottom mr-1"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Download concluído! Clique em "Reiniciar e Instalar" para aplicar.
              </p>
            </div>
          )}

          {/* Error */}
          {downloadState === 'error' && (
            <div className="bg-red-50 border border-red-200/50 rounded-2xl p-4">
              <p className="text-sm text-red-700 font-semibold flex items-center gap-1"><svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg> Erro no download</p>
              <p className="text-xs text-red-600 mt-1">{errorMsg}</p>
            </div>
          )}

          {/* Release Notes */}
          {releaseNotes && downloadState === 'idle' && (
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-slate-700">Novidades:</h3>
              <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-200/50 max-h-48 overflow-y-auto">
                <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">
                  {releaseNotes}
                </p>
              </div>
            </div>
          )}

          {/* Info */}
          {downloadState === 'idle' && (
            <div className="bg-blue-50/50 border border-blue-200/50 rounded-2xl p-4">
              <p className="text-xs text-blue-700 leading-relaxed">
                <svg className="w-4 h-4 text-blue-500 inline-block align-text-bottom mr-1 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" /></svg> <strong>Dica:</strong> O download será feito automaticamente. Após concluído, o app será reiniciado para instalar.
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-slate-200/50 flex gap-3">
          {downloadState === 'idle' && (
            <>
              <button
                onClick={onClose}
                className="flex-1 py-3 rounded-xl border border-slate-300 text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:border-slate-400 transition-all duration-200"
              >
                Mais Tarde
              </button>
              <button
                onClick={handleDownload}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white text-sm font-bold transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
              >
                <DownloadCloudIcon size={18} />
                Baixar Agora
              </button>
            </>
          )}

          {downloadState === 'downloading' && (
            <button
              disabled
              className="flex-1 py-3 rounded-xl bg-slate-200 text-slate-500 text-sm font-semibold cursor-not-allowed"
            >
              Baixando... {downloadPercent}%
            </button>
          )}

          {downloadState === 'downloaded' && (
            <button
              onClick={handleInstall}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white text-sm font-bold transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.992 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" /></svg> Reiniciar e Instalar
            </button>
          )}

          {downloadState === 'error' && (
            <>
              <button
                onClick={onClose}
                className="flex-1 py-3 rounded-xl border border-slate-300 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all duration-200"
              >
                Fechar
              </button>
              <button
                onClick={handleDownload}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white text-sm font-bold transition-all duration-200 shadow-lg flex items-center justify-center gap-2"
              >
                Tentar Novamente
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default UpdateModal;
