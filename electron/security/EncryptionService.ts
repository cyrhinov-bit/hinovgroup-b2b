import crypto from 'crypto';
import { safeStorage, app } from 'electron';
import fs from 'fs';
import path from 'path';

export class EncryptionService {
  private static persistentKey: Buffer | null = null;

  private static getFallbackKey(): Buffer {
    if (this.persistentKey) return this.persistentKey;

    try {
      const keyFile = path.join(app.getPath('userData'), '.key_store');
      if (fs.existsSync(keyFile)) {
        this.persistentKey = fs.readFileSync(keyFile);
      } else {
        const newKey = crypto.randomBytes(32);
        fs.writeFileSync(keyFile, newKey, { mode: 0o600 });
        this.persistentKey = newKey;
      }
    } catch {
      this.persistentKey = crypto.createHash('sha256').update('hinov-fallback-key-seed').digest();
    }

    return this.persistentKey;
  }

  static encrypt(text: string): string {
    try {
      if (safeStorage && safeStorage.isEncryptionAvailable()) {
        const buffer = safeStorage.encryptString(text);
        return 'safe:' + buffer.toString('base64');
      }
    } catch {
      // Fallback
    }

    const key = this.getFallbackKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(text, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return 'aes:' + iv.toString('hex') + ':' + encrypted.toString('hex');
  }

  static decrypt(text: string): string {
    if (!text) return '';

    if (text.startsWith('safe:')) {
      const raw = text.slice(5);
      const buffer = Buffer.from(raw, 'base64');
      return safeStorage.decryptString(buffer);
    }

    const payload = text.startsWith('aes:') ? text.slice(4) : text;
    try {
      const parts = payload.split(':');
      const iv = Buffer.from(parts.shift() || '', 'hex');
      const encrypted = Buffer.from(parts.join(':'), 'hex');
      const key = this.getFallbackKey();
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      let decrypted = decipher.update(encrypted);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      return decrypted.toString('utf8');
    } catch {
      throw new Error('Decryption failed');
    }
  }
}
