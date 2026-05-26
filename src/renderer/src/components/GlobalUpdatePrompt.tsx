import React, { useEffect, useRef, useState } from 'react';
import UpdateModal from './modals/UpdateModal';

interface UpdaterStatus {
  status: 'idle' | 'checking' | 'available' | 'up-to-date' | 'downloading' | 'downloaded' | 'error';
  version?: string;
  percent?: number;
  message?: string;
  releaseNotes?: string;
}

const SNOOZE_KEY = 'flex-kids:update-snoozed-until';
const SNOOZE_MS = 24 * 60 * 60 * 1000; // 24h

const isSnoozed = (latestVersion: string): boolean => {
  try {
    const raw = localStorage.getItem(SNOOZE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { version: string; until: number };
    if (parsed.version !== latestVersion) return false;
    return Date.now() < parsed.until;
  } catch {
    return false;
  }
};

const snoozeFor = (latestVersion: string) => {
  try {
    localStorage.setItem(
      SNOOZE_KEY,
      JSON.stringify({ version: latestVersion, until: Date.now() + SNOOZE_MS }),
    );
  } catch {
    // ignore
  }
};

const GlobalUpdatePrompt: React.FC = () => {
  const [status, setStatus] = useState<UpdaterStatus>({ status: 'idle' });
  const [currentVersion, setCurrentVersion] = useState<string>('');
  const [modalOpen, setModalOpen] = useState(false);
  const initialChecked = useRef(false);

  const api = (window as any).electronAPI?.updater;

  useEffect(() => {
    if (!api) return;

    api.getVersion().then((v: string) => setCurrentVersion(v || ''));

    const unsubscribe = api.onStatus((data: UpdaterStatus) => {
      setStatus(data);
      // Sempre que detectar 'available', forçar abrir modal se não estiver soneca
      if (data.status === 'available' && data.version && !isSnoozed(data.version)) {
        setModalOpen(true);
      }
      // 'downloaded' também abre para forçar reiniciar
      if (data.status === 'downloaded') {
        setModalOpen(true);
      }
    });

    // Verificação inicial extra (caso o main já tenha checado e enviado evento antes do listener)
    if (!initialChecked.current) {
      initialChecked.current = true;
      api.check().catch(() => {/* silencioso */});
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [api]);

  if (!api) return null;

  const hasUpdate =
    status.status === 'available' ||
    status.status === 'downloading' ||
    status.status === 'downloaded';

  const handleSnooze = () => {
    if (status.version) snoozeFor(status.version);
    setModalOpen(false);
  };

  return (
    <>
      {hasUpdate && (
        <div
          onClick={() => setModalOpen(true)}
          className="fixed top-2 left-1/2 -translate-x-1/2 z-40 cursor-pointer animate-pulse"
          role="button"
          aria-label="Atualização disponível — clique para abrir"
        >
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold px-4 py-2 rounded-full shadow-xl flex items-center gap-2 border-2 border-white">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            {status.status === 'downloading' && (
              <span>Baixando atualização {status.percent || 0}%…</span>
            )}
            {status.status === 'downloaded' && (
              <span>Atualização pronta — clique para reiniciar</span>
            )}
            {status.status === 'available' && (
              <span>Atualização disponível: v{status.version}</span>
            )}
          </div>
        </div>
      )}

      {modalOpen && status.version && (
        <UpdateModal
          isOpen={modalOpen}
          onClose={handleSnooze}
          currentVersion={currentVersion}
          latestVersion={status.version}
          releaseNotes={status.releaseNotes}
        />
      )}
    </>
  );
};

export default GlobalUpdatePrompt;
