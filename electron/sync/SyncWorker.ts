import { SyncQueue } from './SyncQueue.js';
import { ConnectivityMonitor } from './ConnectivityMonitor.js';
import { syncEmitter } from './SyncEvents.js';
export class SyncWorker {
  static async processQueue() {
    if (!ConnectivityMonitor.isOnline) return;
    const pending = SyncQueue.getPending();
    if (pending.length === 0) return;

    syncEmitter.emit('syncStarted', { operationsCount: pending.length });
    for (const op of pending) {
      await new Promise(r => setTimeout(r, 300)); // Simulate sync
      SyncQueue.markDone(op.id);
      syncEmitter.emit('syncProgress', { opId: op.id });
    }
    syncEmitter.emit('syncCompleted', { successCount: pending.length });
  }
}
