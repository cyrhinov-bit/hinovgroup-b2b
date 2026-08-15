import { app } from 'electron';
import { registerIpcHandlers } from '../ipc/index.js';
import { ErrorManager } from '../errors/ErrorManager.js';
import { MenuManager } from '../menu/MenuManager.js';
import { WindowManager } from '../windows/WindowManager.js';

// Initialisation de la capture globale des erreurs
ErrorManager.init();

app.whenReady().then(() => {
  // Enregistrement des Handlers IPC
  registerIpcHandlers();

  // Configuration du Menu Applicatif
  MenuManager.init();

  // Création du Splash Screen et de la Fenêtre Principale
  WindowManager.init();

  // Gestion spécifique macOS
  app.on('activate', () => {
    if (!WindowManager.getMainWindow()) {
      WindowManager.init();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
