import { posEmitter } from './PosEvents.js';
export class PaymentEngine {
  static async processPayment(amount: number, method: string) {
    posEmitter.emit('paymentStarted', { amount, method });
    await new Promise(r => setTimeout(r, 500)); // Simule un traitement de paiement
    posEmitter.emit('paymentCompleted', { amount, method, status: 'SUCCESS' });
    return { success: true, amount, method, transactionId: 'TXN-' + Date.now() };
  }
}
