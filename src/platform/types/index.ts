export interface SystemInterface {
  getVersion(): Promise<string>;
  getPlatform(): Promise<string>;
  ping(): Promise<string>;
  getMetrics(): Promise<any>;
}

export interface DialogInterface {
  showMessageBox(options: any): Promise<any>;
  showOpenDialog(options: any): Promise<any>;
}

export interface FileInterface {
  getSystemPaths(): Promise<any>;
  readFile(baseFolder: string, relativePath: string): Promise<string>;
  writeFile(baseFolder: string, relativePath: string, content: string): Promise<boolean>;
  deleteFile(baseFolder: string, relativePath: string): Promise<boolean>;
  exists(baseFolder: string, relativePath: string): Promise<boolean>;
  listDir(baseFolder: string, relativePath?: string): Promise<string[]>;
  createTempFile(prefix: string, content: string): Promise<string>;
  readBinaryFile(baseFolder: string, relativePath: string): Promise<string>;
  writeBinaryFile(baseFolder: string, relativePath: string, content: string): Promise<boolean>;
}

export interface ShellInterface {
  openExternal(url: string): Promise<void>;
  showItemInFolder(path: string): Promise<void>;
}

export interface ClipboardInterface {
  readText(): Promise<string>;
  writeText(text: string): Promise<void>;
  clear(): Promise<void>;
}

export interface NotificationInterface {
  showNotification(title: string, body: string): Promise<void>;
}

export interface NetworkInterface {
  isOnline(): Promise<boolean>;
}

export interface LoggerInterface {
  info(msg: string): Promise<void>;
  warn(msg: string): Promise<void>;
  error(msg: string): Promise<void>;
  getLogs(): Promise<any[]>;
  exportLogs(): Promise<string>;
}

export interface SettingsInterface {
  getSetting(key: string): Promise<any>;
  setSetting(key: string, value: any): Promise<void>;
}

export interface PrintJob {
  id: string;
  date: string;
  type: 'html' | 'pdf' | 'escpos';
  printerName?: string;
  status: 'pending' | 'printing' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  error?: string;
}

export interface Device {
  id: string;
  type: 'scanner' | 'cashdrawer' | 'display' | 'scale' | 'payment' | 'printer' | 'unknown';
  manufacturer?: string;
  model?: string;
  status: 'connected' | 'disconnected' | 'error';
  capabilities: string[];
  driverLoaded: boolean;
}

export interface ScanRecord {
  id: string;
  timestamp: string;
  data: string;
  format: string;
  valid: boolean;
  deviceId?: string;
}

export interface ScannerInterface {
  start(): Promise<void>;
  stop(): Promise<void>;
  getConfig(): Promise<any>;
  setConfig(c: any): Promise<void>;
  getHistory(): Promise<ScanRecord[]>;
  onScan(callback: (record: ScanRecord) => void): void;
}

export interface HardwareInterface {
  getDevices(): Promise<Device[]>;
  discover(): Promise<Device[]>;
}

export interface PrinterInterface {
  getPrinters(): Promise<any[]>;
  printTestPage(printerName: string): Promise<string>;
  getQueue(): Promise<PrintJob[]>;
}

export interface BackupMetadata {
  id: string;
  date: string;
  appVersion: string;
  sizeBytes: number;
  type: 'full' | 'incremental' | 'custom';
  modules: string[];
  checksum: string;
  durationMs: number;
}

export interface BackupProgressEvent {
  step: string;
  percent: number;
}

export interface BackupInterface {
  createBackup(): Promise<string>;
  restoreBackup(path: string): Promise<boolean>;
  getHistory(): Promise<BackupMetadata[]>;
  onProgress(callback: (data: BackupProgressEvent) => void): void;
}

export interface UpdateInfo {
  version: string;
  releaseDate: string;
  releaseNotes: string;
  isMandatory: boolean;
  sizeBytes: number;
}

export interface UpdateProgress {
  percent: number;
  transferredBytes: number;
  totalBytes: number;
  bytesPerSecond: number;
  status: 'checking' | 'available' | 'downloading' | 'downloaded' | 'installing' | 'error';
}

export interface UpdaterInterface {
  checkForUpdates(): Promise<UpdateInfo | null>;
  download(info: UpdateInfo): Promise<void>;
  install(): Promise<void>;
  getConfig(): Promise<any>;
  setConfig(c: any): Promise<void>;
  getHistory(): Promise<any[]>;
  onStatus(callback: (data: UpdateProgress) => void): void;
}

export interface DiagnosticInterface {
  runDiagnostics(): Promise<any>;
  getSystemMetrics(): Promise<any>;
}

export interface MaintenanceInterface {
  getState(): Promise<boolean>;
  setMode(active: boolean): Promise<void>;
  onToggle(callback: (active: boolean) => void): void;
}

export interface SecurityInterface {
  getStatus(): Promise<any>;
  checkPermission(module: string, action: string): Promise<boolean>;
}

export interface PerformanceInterface {
  getMetrics(): Promise<any>;
  clearCache(): Promise<boolean>;
  runBenchmark(): Promise<any>;
}

export interface PosInterface {
  openSale(userId: string): Promise<any>;
  closeSale(): Promise<any>;
  getSession(): Promise<any>;
  pay(amount: number, method: string): Promise<any>;
  openDrawer(): Promise<boolean>;
  printReceipt(data: any): Promise<string>;
  displayMessage(line1: string, line2: string): Promise<boolean>;
  onEvent(callback: (payload: { event: string; data: any }) => void): void;
}

export interface SyncInterface {
  enqueue(op: any): Promise<void>;
  forceSync(): Promise<void>;
  getStatus(): Promise<any>;
  setNetworkStatus(online: boolean): Promise<void>;
  onEvent(callback: (payload: { event: string; data: any }) => void): void;
}

/**
 * Interface unifiée de tous les services de la plateforme.
 */
export interface PlatformBridge {
  isDesktop: boolean;
  system: SystemInterface;
  dialog: DialogInterface;
  files: FileInterface;
  shell: ShellInterface;
  clipboard: ClipboardInterface;
  notifications: NotificationInterface;
  network: NetworkInterface;
  logger: LoggerInterface;
  settings: SettingsInterface;
  printer: PrinterInterface;
  hardware: HardwareInterface;
  scanner: ScannerInterface;
  backup: BackupInterface;
  updater: UpdaterInterface;
  diagnostics: DiagnosticInterface;
  maintenance: MaintenanceInterface;
  security: SecurityInterface;
  performance: PerformanceInterface;
  pos: PosInterface;
  sync: SyncInterface;
}
