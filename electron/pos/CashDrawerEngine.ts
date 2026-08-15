import { posEmitter } from './PosEvents.js';
export class CashDrawerEngine {
  static async openDrawer() {
    // Ici, le code d'envoi du signal ESC/POS d'ouverture au port configuré
    posEmitter.emit('cashDrawerOpened', { timestamp: new Date().toISOString() });
    return true;
  }
}
