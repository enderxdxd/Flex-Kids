interface UpdateInfo {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseNotes?: string;
}

const GITHUB_API = 'https://api.github.com/repos/enderxdxd/Flex-Kids/releases/latest';
const CHECK_INTERVAL = 1000 * 60 * 60; // 1 hora

class UpdateChecker {
  private currentVersion: string;
  private checkInterval: NodeJS.Timeout | null = null;
  private listeners: Array<(info: UpdateInfo) => void> = [];

  constructor() {
    // Versão é injetada pelo Vite durante o build
    this.currentVersion = import.meta.env.VITE_APP_VERSION || '0.0.0';
  }

  async checkForUpdates(): Promise<UpdateInfo> {
    try {
      console.log(`[UpdateChecker] Verificando atualizações... (versão atual: ${this.currentVersion})`);
      const response = await fetch(GITHUB_API);
      
      if (!response.ok) {
        console.error(`[UpdateChecker] API retornou status ${response.status}`);
        throw new Error(`Failed to fetch release info: ${response.status}`);
      }

      const data = await response.json();
      const latestVersion = data.tag_name?.replace('v', '') || data.name?.replace('v', '');
      
      console.log(`[UpdateChecker] Versão mais recente no GitHub: ${latestVersion} (draft: ${data.draft})`);
      
      const hasUpdate = this.compareVersions(latestVersion, this.currentVersion) > 0;
      console.log(`[UpdateChecker] Tem atualização: ${hasUpdate}`);

      return {
        hasUpdate,
        currentVersion: this.currentVersion,
        latestVersion,
        releaseNotes: data.body || 'Sem notas de atualização disponíveis.',
      };
    } catch (error) {
      console.error('[UpdateChecker] Erro ao verificar atualizações:', error);
      return {
        hasUpdate: false,
        currentVersion: this.currentVersion,
        latestVersion: this.currentVersion,
      };
    }
  }

  private compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const part1 = parts1[i] || 0;
      const part2 = parts2[i] || 0;

      if (part1 > part2) return 1;
      if (part1 < part2) return -1;
    }

    return 0;
  }

  startAutoCheck(callback: (info: UpdateInfo) => void) {
    this.listeners.push(callback);

    // Verificar imediatamente
    this.checkForUpdates().then(callback);

    // Verificar periodicamente
    this.checkInterval = setInterval(() => {
      this.checkForUpdates().then((info) => {
        this.listeners.forEach(listener => listener(info));
      });
    }, CHECK_INTERVAL);
  }

  stopAutoCheck() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.listeners = [];
  }

  subscribe(callback: (info: UpdateInfo) => void) {
    this.listeners.push(callback);
  }

  unsubscribe(callback: (info: UpdateInfo) => void) {
    this.listeners = this.listeners.filter(listener => listener !== callback);
  }
}

export const updateChecker = new UpdateChecker();
export type { UpdateInfo };
