import { UpdateChecker } from './UpdateChecker.js';
import { DownloadManager } from './DownloadManager.js';
import { InstallManager } from './InstallManager.js';
import { UpdateConfiguration } from './UpdateConfiguration.js';
import { UpdateHistory } from './UpdateHistory.js';
import { updaterEmitter } from './UpdateEvents.js';

export class UpdaterManager {
  static async check() {
    updaterEmitter.emit('status', { status: 'checking', percent: 0, transferredBytes: 0, totalBytes: 0, bytesPerSecond: 0 });
    await new Promise(r => setTimeout(r, 1000));
    const info = await UpdateChecker.checkForUpdates();
    if (info) {
      updaterEmitter.emit('status', { status: 'available', percent: 0, transferredBytes: 0, totalBytes: info.sizeBytes, bytesPerSecond: 0 });
    } else {
      updaterEmitter.emit('status', { status: 'error', percent: 0, transferredBytes: 0, totalBytes: 0, bytesPerSecond: 0 });
    }
    return info;
  }
  
  static async download(info: any) {
    return await DownloadManager.downloadUpdate(info);
  }
  
  static async install() {
    updaterEmitter.emit('status', { status: 'installing', percent: 100, transferredBytes: 0, totalBytes: 0, bytesPerSecond: 0 });
    await InstallManager.install();
    UpdateHistory.add({ version: '2.0.0', date: new Date().toISOString(), status: 'success' });
  }

  static getConfig() { return UpdateConfiguration.getConfig(); }
  static setConfig(c: any) { UpdateConfiguration.setConfig(c); }
  static getHistory() { return UpdateHistory.getHistory(); }
}
