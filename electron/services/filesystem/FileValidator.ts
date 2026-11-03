import path from 'path';
import { PathTraversalSecurityError, InvalidFileNameError } from '../../errors/FileSystemErrors.js';
import { PathService } from './PathService.js';

export class FileValidator {
  static validateSafePath(baseFolder: string, targetPath: string): string {
    const paths = PathService.getBasePaths();
    const base = (paths as any)[baseFolder];
    if (!base) throw new Error(`Base folder '${baseFolder}' inconnu.`);
    
    const resolvedBase = path.resolve(base);
    const resolvedPath = path.resolve(resolvedBase, targetPath || '');
    const baseWithSep = resolvedBase.endsWith(path.sep) ? resolvedBase : resolvedBase + path.sep;
    
    if (resolvedPath !== resolvedBase && !resolvedPath.startsWith(baseWithSep)) {
      throw new PathTraversalSecurityError(`Accès refusé : Tentative de Path Traversal détectée (${targetPath})`);
    }
    
    return resolvedPath;
  }

  static validateFileName(fileName: string): void {
    const invalidChars = /[<>:"/\\|?*]/;
    if (invalidChars.test(fileName)) {
      throw new InvalidFileNameError(`Le nom du fichier contient des caractères interdits : ${fileName}`);
    }
  }
}
