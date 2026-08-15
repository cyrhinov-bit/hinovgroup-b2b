import { syncEmitter } from './SyncEvents.js';
export class SyncQueue {
  private static queue: any[] = [];
  static addOperation(operation: any) {
    this.queue.push({ ...operation, id: Date.now().toString(), status: 'PENDING' });
    syncEmitter.emit('queueUpdated', { size: this.queue.length });
  }
  static getPending() { return this.queue.filter(op => op.status === 'PENDING'); }
  static markDone(id: string) {
    const op = this.queue.find(o => o.id === id);
    if (op) op.status = 'DONE';
    syncEmitter.emit('queueUpdated', { size: this.getPending().length });
  }
}
