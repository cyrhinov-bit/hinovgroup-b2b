import { UpdateInfo } from './UpdaterTypes.js';
import { VersionService } from './VersionService.js';
import { ReleaseNotesService } from './ReleaseNotesService.js';

export class UpdateChecker {
  static async checkForUpdates(): Promise<UpdateInfo | null> {
    // Simulation
    const current = VersionService.getCurrentVersion();
    const newVersion = '2.0.0';
    if (VersionService.isNewer(current, newVersion)) {
      return {
        version: newVersion,
        releaseDate: new Date().toISOString(),
        releaseNotes: await ReleaseNotesService.getNotes(newVersion),
        isMandatory: false,
        sizeBytes: 154000000 // ~154 MB
      };
    }
    return null;
  }
}
