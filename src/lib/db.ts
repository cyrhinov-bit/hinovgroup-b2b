import localforage from 'localforage';

// Configuration avec fallback automatique (IndexedDB -> WebSQL -> LocalStorage) pour éviter les blocages de Quota Chromium / Electron
const drivers = [localforage.INDEXEDDB, localforage.WEBSQL, localforage.LOCALSTORAGE];

const createStore = (storeName: string) => {
  return localforage.createInstance({
    name: 'hinov',
    storeName,
    driver: drivers
  });
};

export const db = {
  profiles: createStore('profiles'),
  clients: createStore('clients'),
  quotes: createStore('quotes'),
  sales: createStore('sales'),
  commissions: createStore('commissions'),
  installments: createStore('installments'),
  affaires: createStore('affaires'),
  facturePaiements: createStore('facturePaiements'),
  couts: createStore('couts'),
  scoringRules: createStore('scoringRules'),
  objectifs: createStore('objectifs'),
  classements: createStore('classements'),
  primes: createStore('primes'),
  primeAuditLogs: createStore('primeAuditLogs'),
  prospects: createStore('prospects'),
  prospectActivities: createStore('prospectActivities'),
  prospectFollowUps: createStore('prospectFollowUps'),
  activityReports: createStore('activityReports'),
  weeklyReports: createStore('weeklyReports'),
  v2DailyReports: createStore('v2DailyReports'),
  v2WeeklyReports: createStore('v2WeeklyReports'),
  categories: createStore('categories'),
  services: createStore('services'),
  prestations: createStore('prestations'),
  settings: createStore('settings'),
  syncQueue: createStore('syncQueue'),
  syncErrors: createStore('syncErrors'),
  syncMetadata: createStore('syncMetadata'),
  // POS
  posCategories: createStore('posCategories'),
  posBrands: createStore('posBrands'),
  posSuppliers: createStore('posSuppliers'),
  posProducts: createStore('posProducts'),
  posStockEntries: createStore('posStockEntries'),
  posInventories: createStore('posInventories'),
  posCashSessions: createStore('posCashSessions'),
  posTransactions: createStore('posTransactions'),
  posPayments: createStore('posPayments'),
  posDiscounts: createStore('posDiscounts'),
  posSettings: createStore('posSettings'),
  posReturns: createStore('posReturns'),
  posStockMovements: createStore('posStockMovements'),
  productCompletions: createStore('productCompletions'),
  importSessions: createStore('importSessions'),
  importErrors: createStore('importErrors'),
  productImages: createStore('productImages'),
  // CRM Documents
  documents: createStore('documents'),
  documentFiles: createStore('documentFiles'),
  crmFolders: createStore('crmFolders'),
  notifications: createStore('notifications'),
};

