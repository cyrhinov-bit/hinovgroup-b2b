import fs from 'fs';
import path from 'path';
import { app } from 'electron';

export class RestoreService {
  static async restoreBackup(backupFilePath: string): Promise<boolean> {
    if (!backupFilePath || !fs.existsSync(backupFilePath)) {
      throw new Error(`Fichier de sauvegarde introuvable : ${backupFilePath}`);
    }

    try {
      const raw = fs.readFileSync(backupFilePath, 'utf-8');
      const data = JSON.parse(raw);

      if (!data || !Array.isArray(data.files)) {
        throw new Error('Format d\'archive de sauvegarde invalide.');
      }

      const userData = app.getPath('userData');
      for (const f of data.files) {
        if (f.name && typeof f.content === 'string') {
          const dest = path.join(userData, f.name);
          fs.writeFileSync(dest, f.content, 'utf-8');
        }
      }

      return true;
    } catch (e: any) {
      throw new Error(`Échec de la restauration : ${e.message}`);
    }
  }
}
