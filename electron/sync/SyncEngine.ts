import { SyncQueue } from './SyncQueue.js';
import { SyncWorker } from './SyncWorker.js';
import { ConnectivityMonitor } from './ConnectivityMonitor.js';

export class SyncEngine {
  static enqueue(operation: any) {
    SyncQueue.addOperation(operation);
    if (ConnectivityMonitor.isOnline) SyncWorker.processQueue();
  }
  static forceSync() { return SyncWorker.processQueue(); }
  static getStatus() {
    return {
      isOnline: ConnectivityMonitor.isOnline,
      pendingCount: SyncQueue.getPending().length
    };
  }
  static setNetworkStatus(online: boolean) {
    ConnectivityMonitor.setStatus(online);
    if (online) SyncWorker.processQueue();
  }
}
