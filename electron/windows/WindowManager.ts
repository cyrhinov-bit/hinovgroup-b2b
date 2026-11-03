import { app, BrowserWindow, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import { WindowStateService } from './WindowStateService.js';

export class WindowManager {
  private static mainWindow: BrowserWindow | null = null;
  private static splashScreen: BrowserWindow | null = null;

  private static getAppIconPath(): string {
    const candidates = [
      path.join(app.getAppPath(), 'build/icons/icon.ico'),
      path.join(app.getAppPath(), 'electron/assets/icon.png'),
      path.join(app.getAppPath(), 'public/pwa-512x512.png'),
      path.join(app.getAppPath(), 'public/logoh.png'),
      path.join(app.getAppPath(), 'dist/pwa-512x512.png'),
      path.join(process.cwd(), 'build/icons/icon.ico'),
      path.join(process.cwd(), 'public/pwa-512x512.png'),
      path.join(process.cwd(), 'public/logoh.png')
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
    return '';
  }

  static init(): void {
    this.createSplashScreen();
    
    // Délai pour afficher le splash et laisser le temps au chargement
    setTimeout(() => {
      this.createMainWindow();
    }, 1000);
  }

  private static createSplashScreen(): void {
    const splashCandidates = [
      path.join(__dirname, 'splash.html'),
      path.join(app.getAppPath(), 'dist-electron/windows/splash.html'),
      path.join(app.getAppPath(), 'electron/windows/splash.html'),
      path.join(process.cwd(), 'electron/windows/splash.html')
    ];
    const splashPath = splashCandidates.find(p => fs.existsSync(p));

    if (!splashPath) {
      return;
    }

    const iconPath = this.getAppIconPath();
    this.splashScreen = new BrowserWindow({
      width: 400,
      height: 300,
      frame: false,
      transparent: true,
      center: true,
      alwaysOnTop: true,
      show: false,
      icon: iconPath || undefined,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    this.splashScreen.loadFile(splashPath).catch(() => {});
    
    this.splashScreen.once('ready-to-show', () => {
      this.splashScreen?.show();
    });
  }

  private static createMainWindow(): void {
    const state = WindowStateService.loadState(1440, 900);
    const iconPath = this.getAppIconPath();

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
      icon: iconPath || undefined,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        plugins: true,
        preload: path.join(__dirname, '../main/preload.js'),
      },
    });

    // Sécurisation de la navigation : liens externes ouverts dans le navigateur par défaut
    this.mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('mailto:')) {
        void shell.openExternal(url);
      }
      return { action: 'deny' };
    });

    this.mainWindow.webContents.on('will-navigate', (event, url) => {
      const isLocal = url.startsWith('file://') || url.startsWith('http://localhost:5173');
      if (!isLocal) {
        event.preventDefault();
        void shell.openExternal(url);
      }
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

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    const isDev = Boolean(!app?.isPackaged && (process.env.NODE_ENV === 'development' || process.env.ELECTRON_DEV === 'true'));
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
