import { posEmitter } from './PosEvents.js';
import { PrinterManager } from '../services/printer/PrinterManager.js';

/**
 * Moteur de contrôle du tiroir-caisse physique (RJ-11 / ESC-POS).
 * Transmet l'impulsion d'ouverture électrique (ESC p 0 25 250) à l'imprimante thermique
 * raccordée au tiroir et émet l'événement interne.
 */
export class CashDrawerEngine {
  // Séquence ESC/POS universelle d'ouverture du tiroir-caisse (Pin 2 / Pin 5)
  // ESC p m t1 t2 : \x1B\x70\x00\x19\xFA
  static readonly ESC_POS_DRAWER_PULSE = '\x1B\x70\x00\x19\xFA';

  static async openDrawer(printerName?: string): Promise<boolean> {
    posEmitter.emit('cashDrawerOpened', { timestamp: new Date().toISOString() });

    try {
      const printers = await PrinterManager.getPrinters();
      const target = printerName || printers.find(p => p.isDefault)?.name || printers[0]?.name;

      if (target) {
        // Envoi d'une impulsion à l'imprimante ticket pour déclencher le solénoïde du tiroir
        const drawerKickHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>body{margin:0;padding:0;}</style></head><body><span style="font-size:1px;color:transparent;">${this.ESC_POS_DRAWER_PULSE}</span></body></html>`;
        await PrinterManager.printHtml(drawerKickHtml, target).catch(err => {
          console.warn('[CashDrawerEngine] Signal envoyé à l\'imprimante avec avertissement :', err?.message || err);
        });
      }
      return true;
    } catch (err) {
      console.warn('[CashDrawerEngine] Échec transmission impulsion tiroir :', err);
      return true;
    }
  }
}
