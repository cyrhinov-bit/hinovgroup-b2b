import { ipcMain, BrowserWindow } from 'electron';
import { POS_CHANNELS } from './pos.channels.js';
import { PosEngine, posEmitter } from '../../pos/index.js';

export function registerPosHandlers(): void {
  const eventsToForward = ['sessionOpened', 'sessionClosed', 'paymentStarted', 'paymentCompleted', 'cashDrawerOpened'];
  eventsToForward.forEach(eventName => {
    posEmitter.on(eventName, (data) => {
      const windows = BrowserWindow.getAllWindows();
      windows.forEach(win => win.webContents.send(POS_CHANNELS.ON_POS_EVENT, { event: eventName, data }));
    });
  });

  ipcMain.handle(POS_CHANNELS.OPEN_SALE, (_, userId) => PosEngine.openSale(userId));
  ipcMain.handle(POS_CHANNELS.CLOSE_SALE, () => PosEngine.closeSale());
  ipcMain.handle(POS_CHANNELS.GET_SESSION, () => PosEngine.getSession());
  ipcMain.handle(POS_CHANNELS.PAY, (_, amount, method) => PosEngine.pay(amount, method));
  ipcMain.handle(POS_CHANNELS.OPEN_DRAWER, () => PosEngine.openDrawer());
  ipcMain.handle(POS_CHANNELS.PRINT_RECEIPT, (_, data) => PosEngine.printReceipt(data));
  ipcMain.handle(POS_CHANNELS.DISPLAY_MESSAGE, (_, line1, line2) => PosEngine.displayMessage(line1, line2));
}
