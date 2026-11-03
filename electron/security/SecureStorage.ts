import { EncryptionService } from './EncryptionService.js';
import { app } from 'electron';
import fs from 'fs';
import path from 'path';

export class SecureStorage {
  private static store: Record<string, string> | null = null;

  private static getStoragePath(): string {
    return path.join(app.getPath('userData'), 'secure_storage.json');
  }

  private static ensureLoaded(): void {
    if (this.store !== null) return;
    this.store = {};
    try {
      const filePath = this.getStoragePath();
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        this.store = JSON.parse(raw);
      }
    } catch (e) {
      this.store = {};
    }
  }

  private static persist(): void {
    try {
      const filePath = this.getStoragePath();
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(this.store || {}, null, 2), 'utf-8');
    } catch {
      // Ignorer les erreurs d'écriture disque non bloquantes
    }
  }

  static set(key: string, value: string): void {
    this.ensureLoaded();
    if (!this.store) this.store = {};
    this.store[key] = EncryptionService.encrypt(value);
    this.persist();
  }

  static get(key: string): string | null {
    this.ensureLoaded();
    const val = this.store?.[key];
    if (!val) return null;
    try {
      return EncryptionService.decrypt(val);
    } catch {
      return null;
    }
  }

  static remove(key: string): void {
    this.ensureLoaded();
    if (this.store && key in this.store) {
      delete this.store[key];
      this.persist();
    }
  }
}
