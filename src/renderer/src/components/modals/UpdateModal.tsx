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

  const handleDownload = () => {
    if (api) {
      setDownloadState('downloading');
      setDownloadPercent(0);
      api.download();
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
                ✅ Download concluído! Clique em "Reiniciar e Instalar" para aplicar.
              </p>
            </div>
          )}

          {/* Error */}
          {downloadState === 'error' && (
            <div className="bg-red-50 border border-red-200/50 rounded-2xl p-4">
              <p className="text-sm text-red-700 font-semibold">❌ Erro no download</p>
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
                💡 <strong>Dica:</strong> O download será feito automaticamente. Após concluído, o app será reiniciado para instalar.
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
              🔄 Reiniciar e Instalar
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
