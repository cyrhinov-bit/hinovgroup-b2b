import fs from 'fs';
import path from 'path';

const root = process.cwd();
const distElectron = path.join(root, 'dist-electron');
const windowsDist = path.join(distElectron, 'windows');
const splashSrc = path.join(root, 'electron', 'windows', 'splash.html');
const splashDest = path.join(windowsDist, 'splash.html');

// 1. Dossier dist-electron
if (!fs.existsSync(distElectron)) {
  fs.mkdirSync(distElectron, { recursive: true });
}

// 2. package.json CommonJS dans dist-electron
fs.writeFileSync(
  path.join(distElectron, 'package.json'),
  JSON.stringify({ type: 'commonjs' }, null, 2)
);

// 3. Copie de splash.html
if (fs.existsSync(splashSrc)) {
  if (!fs.existsSync(windowsDist)) {
    fs.mkdirSync(windowsDist, { recursive: true });
  }
  fs.copyFileSync(splashSrc, splashDest);
  console.log('[prepare-electron] splash.html copié dans dist-electron/windows/');
}

console.log('[prepare-electron] Préparation Electron terminée avec succès.');

