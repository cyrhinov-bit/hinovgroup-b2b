import { ipcMain } from 'electron';
import { SYSTEM_CHANNELS } from './system.channels.js';
import { SystemService } from '../../services/system/system.service.js';

export function registerSystemHandlers(): void {
  ipcMain.handle(SYSTEM_CHANNELS.GET_VERSION, () => SystemService.getVersion());
  ipcMain.handle(SYSTEM_CHANNELS.GET_PLATFORM, () => SystemService.getPlatform());
  ipcMain.handle(SYSTEM_CHANNELS.PING, () => SystemService.ping());
  ipcMain.handle(SYSTEM_CHANNELS.GET_METRICS, () => SystemService.getMetrics());
}
