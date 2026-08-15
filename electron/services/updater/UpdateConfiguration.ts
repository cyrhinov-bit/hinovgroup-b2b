import { UpdaterConfig } from './UpdaterTypes.js';

export class UpdateConfiguration {
  private static config: UpdaterConfig = {
    autoCheck: true,
    autoDownload: false,
    channel: 'stable'
  };

  static getConfig(): UpdaterConfig { return { ...this.config }; }
  static setConfig(c: Partial<UpdaterConfig>): void { this.config = { ...this.config, ...c }; }
}
