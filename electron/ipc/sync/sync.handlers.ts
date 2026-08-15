import { ipcMain, BrowserWindow } from 'electron';
import { SYNC_CHANNELS } from './sync.channels.js';
import { SyncEngine, syncEmitter } from '../../sync/index.js';

export function registerSyncHandlers(): void {
  const eventsToForward = ['syncStarted', 'syncProgress', 'syncCompleted', 'queueUpdated', 'networkStatusChanged'];
  eventsToForward.forEach(eventName => {
    syncEmitter.on(eventName, (data) => {
      const windows = BrowserWindow.getAllWindows();
      windows.forEach(win => win.webContents.send(SYNC_CHANNELS.ON_EVENT, { event: eventName, data }));
    });
  });

  ipcMain.handle(SYNC_CHANNELS.ENQUEUE, (_, op) => SyncEngine.enqueue(op));
  ipcMain.handle(SYNC_CHANNELS.FORCE_SYNC, () => SyncEngine.forceSync());
  ipcMain.handle(SYNC_CHANNELS.GET_STATUS, () => SyncEngine.getStatus());
  ipcMain.handle(SYNC_CHANNELS.SET_NETWORK, (_, online) => SyncEngine.setNetworkStatus(online));
}
