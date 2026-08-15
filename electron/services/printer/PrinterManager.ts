import { BrowserWindow } from 'electron';
import { PrinterDiscovery } from './PrinterDiscovery.js';
import { PrintQueue } from './PrintQueue.js';
import { PrintJob } from './PrintJob.js';
import { PrinterNotFoundError } from '../../errors/PrinterErrors.js';

const TEST_PAGE_HTML = (printerName: string): string => `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: 'Consolas', 'Courier New', monospace; padding: 16px; color: #000; }
        h1 { font-size: 16px; text-align: center; margin: 0 0 12px 0; }
        .box { border: 1px solid #000; padding: 12px; font-size: 12px; }
        .row { display: flex; justify-content: space-between; margin-bottom: 4px; }
        .footer { text-align: center; margin-top: 16px; font-size: 10px; color: #555; }
      </style>
    </head>
    <body>
      <h1>TEST D'IMPRESSION</h1>
      <div class="box">
        <div class="row"><span>Imprimante</span><span>${printerName}</span></div>
        <div class="row"><span>Date</span><span>${new Date().toLocaleString()}</span></div>
        <div class="row"><span>Format</span><span>80mm</span></div>
        <div class="row"><span>Largeur abcd 01234</span><span>OK</span></div>
        <div class="row"><span>&eacute;&egrave;&ccedil;&agrave;</span><span>UTF-8</span></div>
      </div>
      <div class="footer">If you read this page, the thermal printer works.</div>
    </body>
  </html>
`;

export class PrinterManager {
  static async getPrinters() {
    return PrinterDiscovery.getPrinters();
  }

  static async printTestPage(printerName: string): Promise<string> {
    const printers = await this.getPrinters();
    const printer = printers.find(p => p.name === printerName);

    if (!printer) {
      throw new PrinterNotFoundError(`Imprimante '${printerName}' introuvable.`);
    }

    return this.printHtml(TEST_PAGE_HTML(printerName), printerName);
  }

  static getQueue() {
    return PrintQueue.getQueue();
  }

  /**
   * Imprime du contenu HTML de façon silencieuse (sans dialogue) sur l'imprimante cible.
   * Crée une fenêtre cachée qui charge le HTML puis appelle webContents.print().
   */
  static async printHtml(html: string, printerName?: string): Promise<string> {
    const printers = await this.getPrinters();
    let target = printerName;
    if (!target) {
      const def = printers.find(p => p.isDefault) || printers[0];
      target = def?.name;
    }
    if (!target) {
      const jobIdFailed = `job_${Date.now()}`;
      PrintQueue.addJob(this.createJob(jobIdFailed, 'failed', undefined, "Aucune imprimante disponible."));
      return jobIdFailed;
    }

    const jobId = `job_${Date.now()}`;
    const job: PrintJob = this.createJob(jobId, 'pending', target);
    PrintQueue.addJob(job);
    this.startSilentPrint(job, html);

    return jobId;
  }

  private static createJob(id: string, status: PrintJob['status'], printerName?: string, error?: string): PrintJob {
    const job: PrintJob = {
      id,
      date: new Date().toISOString(),
      type: 'html',
      printerName,
      status,
      progress: status === 'completed' ? 100 : 0
    };
    if (error) job.error = error;
    return job;
  }

  private static startSilentPrint(job: PrintJob, html: string): void {
    const win = new BrowserWindow({
      show: false,
      webPreferences: { sandbox: true, contextIsolation: true }
    });
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

    const finish = (status: PrintJob['status'], error?: string) => {
      PrintQueue.updateStatus(job.id, status, error);
      if (!win.isDestroyed()) win.destroy();
    };

    win.webContents.on('did-fail-load', (_event, _code, desc) => {
      finish('failed', desc || "Échec du chargement de la page.");
    });

    win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
      .then(() => {
        setTimeout(() => {
          win.webContents.print(
            { silent: true, printBackground: true, deviceName: job.printerName },
            (success, failureReason) => {
              if (success) {
                finish('completed');
              } else {
                finish('failed', failureReason || "Échec de l'impression.");
              }
            }
          );
        }, 150);
      })
      .catch(err => finish('failed', String(err)));
  }
}