import { PrinterManager } from '../services/printer/PrinterManager.js';

export class ReceiptEngine {
  static async printReceipt(data: any): Promise<string> {
    const html = ReceiptEngine.buildReceiptHtml(data);
    if (!html) {
      return 'receipt_failed';
    }
    try {
      await PrinterManager.printHtml(html, data?.printerName);
      return 'receipt_printed';
    } catch (err: any) {
      return `receipt_failed:${String(err?.message || err)}`;
    }
  }

  private static esc(s: any): string {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private static fmt(n: any): string {
    const num = Number(n) || 0;
    return num.toLocaleString('fr-FR');
  }

  private static buildReceiptHtml(data: any): string {
    const tx = data?.transaction || data;
    const cart = Array.isArray(data?.cart) ? data.cart : (tx?.lines || []);
    const total = data?.total ?? tx?.total ?? 0;
    const subtotal = data?.subtotal ?? tx?.subtotal ?? total;
    const currency = data?.currency ?? 'FCFA';
    const paymentMethod = data?.paymentMethod ?? 'Espèces';
    const cashAmount = data?.cashAmount ?? total;
    const changeAmount = data?.changeAmount ?? 0;
    const date = tx?.date ? new Date(tx.date).toLocaleString('fr-FR') : new Date().toLocaleString('fr-FR');

    const header = data?.settings?.libraryName || 'LIBRAIRIE';
    const lines = cart.map((item: any) => `
      <tr>
        <td>${ReceiptEngine.esc(item.quantity ?? 1)}x</td>
        <td>${ReceiptEngine.esc(item.name || item.description || item.productName || 'Article')}</td>
        <td style="text-align:right">${ReceiptEngine.fmt(item.total ?? (item.quantity ?? 1) * (item.unitPrice ?? 0))}</td>
      </tr>`).join('');

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  body { font-family: 'Consolas', 'Courier New', monospace; font-size: 12px; color: #000; margin: 0; padding: 8px; width: 72mm; }
  .center { text-align: center; }
  h2 { font-size: 15px; margin: 0 0 4px 0; text-transform: uppercase; }
  .dash { border-top: 1px dashed #000; margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { vertical-align: top; }
</style>
</head>
<body>
  <div class="center">
    <h2>${ReceiptEngine.esc(header)}</h2>
    ${data?.settings?.address ? `<div>${ReceiptEngine.esc(data.settings.address)}</div>` : ''}
    ${data?.settings?.phone ? `<div>Tel: ${ReceiptEngine.esc(data.settings.phone)}</div>` : ''}
    <div>TICKET : ${ReceiptEngine.esc(tx?.transactionNumber || tx?.id || '')}</div>
    <div>Date : ${ReceiptEngine.esc(date)}</div>
  </div>
  <div class="dash"></div>
  <table>
    <thead><tr><th style="text-align:left">Qté</th><th style="text-align:left">Désignation</th><th style="text-align:right">Total</th></tr></thead>
    <tbody>${lines}</tbody>
  </table>
  <div class="dash"></div>
  <table>
    <tr><td>Sous-total</td><td style="text-align:right">${ReceiptEngine.fmt(subtotal)} ${ReceiptEngine.esc(currency)}</td></tr>
    ${data?.globalDiscount ? `<tr><td>Remise</td><td style="text-align:right">-${ReceiptEngine.fmt(data.globalDiscount)} ${ReceiptEngine.esc(currency)}</td></tr>` : ''}
    <tr><td style="font-weight:bold">TOTAL</td><td style="text-align:right;font-weight:bold">${ReceiptEngine.fmt(total)} ${ReceiptEngine.esc(currency)}</td></tr>
  </table>
  <div class="dash"></div>
  <table>
    <tr><td>Payé en (${ReceiptEngine.esc(paymentMethod)})</td><td style="text-align:right">${ReceiptEngine.fmt(cashAmount)} ${ReceiptEngine.esc(currency)}</td></tr>
    ${changeAmount > 0 ? `<tr><td>Rendu</td><td style="text-align:right">${ReceiptEngine.fmt(changeAmount)} ${ReceiptEngine.esc(currency)}</td></tr>` : ''}
  </table>
  <div class="center" style="margin-top:8px">${ReceiptEngine.esc(data?.settings?.ticketMessage || 'Merci de votre visite !')}</div>
</body>
</html>`;
  }
}