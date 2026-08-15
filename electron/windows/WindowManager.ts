import { app, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { WindowStateService } from './WindowStateService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isDev = !app.isPackaged && process.env.NODE_ENV === 'development';

export class WindowManager {
  private static mainWindow: BrowserWindow | null = null;
  private static splashScreen: BrowserWindow | null = null;

  static init(): void {
    this.createSplashScreen();
    
    // Délai pour simuler le splash et laisser le temps à Vite
    setTimeout(() => {
      this.createMainWindow();
    }, 1000);
  }

  private static createSplashScreen(): void {
    this.splashScreen = new BrowserWindow({
      width: 400,
      height: 300,
      frame: false,
      transparent: true,
      center: true,
      alwaysOnTop: true,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    const splashPath = path.join(app.getAppPath(), 'electron/windows/splash.html');
    this.splashScreen.loadFile(splashPath);
    
    this.splashScreen.once('ready-to-show', () => {
      this.splashScreen?.show();
    });
  }

  private static createMainWindow(): void {
    const state = WindowStateService.loadState(1440, 900);

    this.mainWindow = new BrowserWindow({
      title: 'Hinov Business Suite Desktop',
      x: state.x,
      y: state.y,
      width: state.width,
      height: state.height,
      minWidth: 1280,
      minHeight: 720,
      show: false,
      autoHideMenuBar: true,
      backgroundColor: '#ffffff',
      icon: path.join(app.getAppPath(), 'electron/assets/icons/icon.png'),
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        preload: path.join(__dirname, '../main/preload.js'),
      },
    });

    if (state.isMaximized) {
      this.mainWindow.maximize();
    }
    
    if (state.x === undefined || state.y === undefined) {
      this.mainWindow.center();
    }

    WindowStateService.manage(this.mainWindow);

    this.mainWindow.once('ready-to-show', () => {
      if (this.splashScreen && !this.splashScreen.isDestroyed()) {
        this.splashScreen.close();
        this.splashScreen = null;
      }
      this.mainWindow?.show();
    });

    this.mainWindow.on('close', (_e) => {
      // Emplacement pour de futures actions de vérification (ex: confirmation avant fermeture)
    });

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    if (isDev) {
      this.mainWindow.loadURL('http://localhost:5173');
    } else {
      this.mainWindow.loadFile(path.join(app.getAppPath(), 'dist/index.html'));
    }
  }

  static getMainWindow(): BrowserWindow | null {
    return this.mainWindow;
  }
}
