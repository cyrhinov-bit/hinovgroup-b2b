export class VersionService {
  static getCurrentVersion(): string { return '1.0.0'; }
  static isNewer(current: string, target: string): boolean {
    return target > current; // Simplifié
  }
}
