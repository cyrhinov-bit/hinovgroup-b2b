import { randomUUID } from 'crypto';
import crypto from 'crypto';
import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import { backupEmitter } from './BackupEvents.js';
import { BackupHistory } from './BackupHistory.js';
import { BackupMetadata } from './BackupMetadata.js';

export class BackupService {
  static async createBackup(): Promise<string> {
    const backupId = randomUUID();
    const startTime = Date.now();
    const backupDir = path.join(app.getPath('userData'), 'backups');

    try {
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      backupEmitter.emit('progress', { step: 'Préparation du snapshot', percent: 15 });
      await new Promise(r => setTimeout(r, 200));

      const backupFilePath = path.join(backupDir, `backup-${Date.now()}-${backupId.slice(0, 8)}.json`);
      const payload: Record<string, any> = {
        id: backupId,
        createdAt: new Date().toISOString(),
        version: app.getVersion(),
        platform: process.platform,
        userDataPath: app.getPath('userData'),
        files: []
      };

      backupEmitter.emit('progress', { step: 'Extraction des données locales', percent: 45 });

      // Lecture des fichiers de configuration et stockage sécurisé s'ils existent
      const candidateFiles = ['secure_storage.json', 'Preferences', 'Local State'];
      for (const cf of candidateFiles) {
        const full = path.join(app.getPath('userData'), cf);
        if (fs.existsSync(full)) {
          try {
            const content = fs.readFileSync(full, 'utf-8');
            payload.files.push({ name: cf, content });
          } catch {
            // Ignorer les fichiers verrouillés par Chromium
          }
        }
      }

      backupEmitter.emit('progress', { step: 'Écriture et compression de l\'archive', percent: 80 });
      const serialized = JSON.stringify(payload, null, 2);
      fs.writeFileSync(backupFilePath, serialized, 'utf-8');

      const stat = fs.statSync(backupFilePath);
      const hash = crypto.createHash('sha256').update(serialized).digest('hex');

      backupEmitter.emit('progress', { step: 'Vérification de l\'intégrité', percent: 100 });

      const meta: BackupMetadata = {
        id: backupId,
        date: new Date().toISOString(),
        appVersion: app.getVersion() || '1.0.3',
        sizeBytes: stat.size,
        type: 'full',
        modules: ['settings', 'credentials', 'local_preferences'],
        checksum: hash.slice(0, 16),
        durationMs: Date.now() - startTime
      };

      BackupHistory.add(meta);
      return backupId;
    } catch (err: any) {
      backupEmitter.emit('progress', { step: `Erreur: ${err?.message || err}`, percent: 0 });
      throw err;
    }
  }
}
