import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { db } from '../lib/db';
import { queueSyncAction, processSyncQueue } from '../lib/sync';
import { v4 as uuidv4 } from 'uuid';
import toast from 'react-hot-toast';
import { isProductComplete } from '../features/products/services/ProductService';
import type { ProductPersistence } from '../features/products/data/repositories/ProductRepository';
import { productService } from '../features/products/services/ProductService';

const isUuid = (value?: string) => !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

const mergeData = <T extends { id: string }>(oldData: T[] | null | undefined, newData: T[]): T[] => {
  if (!oldData || oldData.length === 0) return newData;
  const map = new Map(oldData.map(item => [item.id, item]));
  for (const item of newData) {
    map.set(item.id, item);
  }
  return Array.from(map.values());
};

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'Directeur' | 'Responsable' | 'Commercial' | 'Caissier' | 'Gerant' | 'SuperAdmin';
  posRole?: 'Directeur' | 'Gerant' | 'Caissier' | null;
  serviceId?: string;
  pin: string;
  lastLogin?: string;
  active?: boolean;
  photo?: string;
  posReturnsEnabled?: boolean;
  posCatalogueEnabled?: boolean;
  posSupplyEnabled?: boolean;
  posInventoryEnabled?: boolean;
  posStockEnabled?: boolean;
}
export interface Client { id: string; name: string; email: string; phone: string; contact: string; company: string; address: string; status?: string; commercialId?: string; createdAt?: string; }
export interface Service { id: string; name: string; description: string; members?: number; }
export interface Category { id: string; serviceId: string; name: string; }
export interface Prestation { id: string; code: string; name: string; description: string; price: number; serviceId: string; unit?: string; costPrice?: number; }
export interface QuoteLine { id: string; prestationId: string; description: string; quantity: number; unitPrice: number; total: number; discountPercent?: number; costPrice?: number; }
export interface Quote { id: string; quoteNumber: string; clientId: string; commercialId: string; serviceId?: string; subject: string; lines: QuoteLine[]; subtotal: number; total: number; status: 'Brouillon' | 'Envoyé' | 'Accepté' | 'Refusé' | 'Révision'; date: string; style?: 'Classique' | 'Moderne' | 'Minimaliste'; accentColor?: string; discountPercent?: number; discountAmount?: number; clientComment?: string; }
export interface SaleLine { id: string; description: string; quantity: number; unitPrice: number; costPrice?: number; total: number; }
export interface Sale { id: string; saleNumber: string; quoteId?: string; clientId: string; serviceId?: string; lines: SaleLine[]; subtotal: number; total: number; status: 'Enregistrée' | 'Payée' | 'Annulée'; date: string; notes?: string; }
export interface Installment { id: string; saleId: string; amount: number; dueDate: string; paidAmount: number; status: 'En attente' | 'Payée'; paidAt?: string; }
export type InstallmentInput = { id?: string; amount: number; dueDate: string };
export interface Commission { id: string; saleId?: string; clientId?: string; commercialId?: string; serviceId?: string; totalHt: number; costTotal: number; marginAmount: number; marginPercent: number; commissionPercent: number; commissionAmount: number; paidAmount?: number; status: 'En attente' | 'Validée' | 'Payée'; createdAt: string; }
export interface Prospect { id: string; prospectNumber: string; commercialId: string; serviceId?: string; categoryId?: string; type: 'Entreprise' | 'Particulier'; name: string; company?: string; phone?: string; email?: string; address?: string; city?: string; source?: string; interestLevel: 'Faible' | 'Moyen' | 'Élevé' | 'Très élevé'; budget: number; need?: string; comments?: string; status: 'Nouveau' | 'Premier contact' | 'Besoin identifié' | 'Rendez-vous' | 'Offre en préparation' | 'Négociation' | 'À convertir' | 'Converti' | 'Perdu'; responsibleId?: string; createdAt: string; updatedAt: string; }
export interface ProspectActivity { id: string; prospectId: string; type: 'Appel' | 'Email' | 'Visite' | 'Réunion' | 'Démonstration' | 'Compte rendu' | 'Autre'; description?: string; date: string; createdBy?: string; }
export interface ProspectFollowUp { id: string; prospectId: string; date: string; time?: string; priority: 'Basse' | 'Moyenne' | 'Haute' | 'Urgente'; observation?: string; status: 'En attente' | 'Terminée' | 'Annulée'; }
export interface AppSettings { companyName: string; companyLogo: string; companyAddress: string; companySiret: string; companyTva: string; defaultTerms: string; headerLogoBase64?: string; defaultValidity?: number; siteUrl?: string; commissionRate?: number; }

export interface ActivityReport { id: string; authorId: string; role: User['role']; type: 'Activité' | 'Prospection'; date: string; realisations: string; difficultes: string; remarques: string; createdAt?: string; updatedAt?: string; }

export interface WeeklyReport { id: string; authorId: string; role: User['role']; weekStart: string; sections: { type: 'Activité' | 'Prospection'; content: string }[]; kpis: Record<string, number>; status: 'Brouillon' | 'Envoyé' | 'Relu'; sentAt?: string; createdAt?: string; }

export interface V2Task { id: string; description: string; status: 'Effectuée' | 'En cours' | 'Restante'; }
export interface V2DailyReport { id: string; authorId: string; date: string; project: string; objectives: string; tasks: V2Task[]; results: string; difficulties: string; observations: string; status: 'Brouillon' | 'Soumis' | 'Validé'; createdAt?: string; updatedAt?: string; }
export interface V2WeeklyReport { id: string; authorId: string; weekStart: string; project: string; dailyReportIds: string[]; weeklyObjectives: string; tasksByDay: Record<string, V2Task[]>; pendingTasks: V2Task[]; summary: string; nextWeekObjectives: string; conclusion: string; status: 'Brouillon' | 'Validé'; createdAt?: string; updatedAt?: string; }
// POS Interfaces
export interface PosCategory { id: string; name: string; family: 'Livre' | 'Fourniture'; }
export interface PosBrand { id: string; name: string; }
export interface PosSupplier { id: string; name: string; contact?: string; phone?: string; email?: string; address?: string; }
export interface PosProduct { id: string; reference: string; barcode?: string; isbn?: string; name: string; family?: 'Livre' | 'Fourniture'; categoryId?: string; brandId?: string; supplierId?: string; purchasePrice: number; sellingPrice: number; quantity: number; minStock: number; imageUrl?: string; description?: string; status?: 'Active' | 'Inactive'; isActive: boolean; unit?: string; createdAt?: string; updatedAt?: string; }
export interface PosStockEntryLine { id: string; productId: string; quantity: number; purchasePrice: number; total: number; }
export interface PosStockEntry { id: string; reference: string; supplierId?: string; date: string; totalAmount: number; status: 'Brouillon' | 'Validé' | 'Annulé'; notes?: string; createdBy?: string; lines: PosStockEntryLine[]; }
export interface PosInventoryLine { id: string; productId: string; expectedQty: number; countedQty: number; difference: number; }
export interface PosInventory { id: string; reference: string; date: string; status: 'En cours' | 'Terminé' | 'Annulé'; notes?: string; createdBy?: string; lines: PosInventoryLine[]; }
export interface PosCashSession { id: string; cashierId?: string; openedAt: string; closedAt?: string; initialFund: number; finalAmount?: number; expectedAmount?: number; difference?: number; status: 'Ouverte' | 'Fermée'; }
export interface PosTransactionLine { id: string; productId?: string; description: string; quantity: number; unitPrice: number; discountPercent: number; discountAmount: number; total: number; }
export interface PosTransaction { id: string; transactionNumber: string; cashierId?: string; sessionId?: string; date: string; subtotal: number; vat: number; discountAmount: number; total: number; status: 'Validée' | 'Annulée' | 'Retournée'; lines: PosTransactionLine[]; payments: PosPayment[]; }
export interface PosPayment { id: string; transactionId?: string; method: 'Espèces' | 'Carte' | 'Mobile Money' | 'Mixte'; amount: number; reference?: string; }
export interface PosDiscount { id: string; name: string; type: 'Pourcentage' | 'Montant'; value: number; maxPercent?: number; maxAmount?: number; active: boolean; }
export interface PosReturnLine { id: string; productId?: string; description: string; quantity: number; unitPrice: number; total: number; reason: string; }
export interface ExchangeLine { id: string; productId: string; description: string; quantity: number; unitPrice: number; total: number; }
export interface PosReturn { id: string; returnNumber: string; transactionId?: string; sessionId?: string; date: string; type: 'Retour simple' | 'Retour avec échange'; totalRefund: number; totalExchange: number; amountToPay: number; status: 'En attente' | 'Traité' | 'Annulé'; lines: PosReturnLine[]; exchangeLines?: ExchangeLine[]; notes?: string; createdBy?: string; }
export interface PosCartItem { id: string; productId: string; name: string; reference: string; unitPrice: number; quantity: number; discountType: 'none' | 'percent' | 'amount'; discountPercent: number; discountAmount: number; total: number; }
export interface SuspendedCart { id: string; reference?: string; date: string; cart: PosCartItem[]; }

// Product Module Interfaces
export interface PosStockMovement { id: string; productId: string; type: 'Vente' | 'Retour' | 'Approvisionnement' | 'Inventaire' | 'Ajustement Manuel'; quantity: number; reference?: string; date: string; createdBy?: string; notes?: string; }
export interface ProductCompletion { id: string; productId: string; missingField: 'family' | 'category' | 'brand' | 'supplier' | 'image' | 'description' | 'minStock'; currentValue: string; suggestedValue: string; createdAt: string; }
export interface ImportSession { id: string; filename: string; status: 'pending' | 'in_progress' | 'completed' | 'failed'; totalRows: number; processedRows: number; successfulCreations: number; successfulUpdates: number; ignoredRows: number; errors: ImportError[]; createdAt: string; completedAt?: string; }
export interface ImportError { row: number; field: string; value: string; error: string; severity: 'error' | 'warning'; sessionId?: string; }
export interface ImportReport { session: ImportSession; productsCreated: number; productsUpdated: number; productsIgnored: number; brandsCreated: number; suppliersCreated: number; totalErrors: number; totalWarnings: number; importDurationMs: number; }
export interface ProductCompletionFilters { noFamily: boolean; noCategory: boolean; noBrand: boolean; noSupplier: boolean; noImage: boolean; noBarcode: boolean; noIsbn: boolean; minStockExceeded: boolean; }

// CRM Documents
export interface CrmFolder {
  id: string;
  name: string;
  ownerId: string;
  parentId?: string;
  createdAt: string;
}

export interface CrmDocument {
  id: string;
  name: string;
  type: string;
  sizeBytes: number;
  filePath: string;
  uploaderId?: string;
  folderId?: string;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  is_read: boolean;
  link?: string;
  created_at: string;
}

export interface PosSettings { libraryName: string; address: string; phone: string; email: string; currency: string; ticketMessage: string; printerType: string; }
export interface PosWorkspace { active: boolean; }

interface AppState {
  users: User[]; clients: Client[]; quotes: Quote[]; sales: Sale[]; commissions: Commission[]; installments: Installment[]; prospects: Prospect[]; prospectActivities: ProspectActivity[]; prospectFollowUps: ProspectFollowUp[]; categories: Category[]; settings: AppSettings; services: Service[]; prestations: Prestation[]; loading: boolean; activityReports: ActivityReport[]; weeklyReports: WeeklyReport[]; crmDocuments: CrmDocument[]; crmFolders: CrmFolder[]; v2DailyReports: V2DailyReport[]; v2WeeklyReports: V2WeeklyReport[]; notifications: AppNotification[];
  // POS
  posCategories: PosCategory[]; posBrands: PosBrand[]; posSuppliers: PosSupplier[]; posProducts: PosProduct[];
  posStockEntries: PosStockEntry[]; posInventories: PosInventory[]; posCashSessions: PosCashSession[];
  posStockMovements: PosStockMovement[];
  posTransactions: PosTransaction[]; posPayments: PosPayment[];   posDiscounts: PosDiscount[]; posSettings: PosSettings;
  posReturns: PosReturn[]; addPosReturn: (ret: PosReturn) => Promise<void>; updatePosReturn: (id: string, data: Partial<PosReturn>) => Promise<void>; cancelPosReturn: (id: string) => Promise<void>;
  suspendedCarts: SuspendedCart[]; addSuspendedCart: (cart: SuspendedCart) => void; removeSuspendedCart: (id: string) => void;
  // Product Module
  productCompletions: ProductCompletion[]; importSessions: ImportSession[];
  posWorkspace: PosWorkspace; setPosWorkspace: (w: PosWorkspace) => void;
  addClient: (client: Client) => Promise<void>;
  updateClient: (id: string, client: Client) => Promise<void>;
  deleteClient: (id: string) => Promise<void>;
  addQuote: (quote: Quote) => Promise<void>;
  updateQuote: (id: string, quote: Quote) => Promise<void>;
  updateQuoteStatus: (id: string, status: Quote['status'], clientComment?: string) => Promise<void>;
  deleteQuote: (id: string) => Promise<void>;
  addSale: (sale: Sale, installments?: InstallmentInput[]) => Promise<void>;
  updateSaleStatus: (id: string, status: Sale['status']) => Promise<void>;
  updateSale: (id: string, sale: Sale) => Promise<void>;
  deleteSale: (id: string) => Promise<void>;
  recordInstallmentPayment: (installmentId: string, amount: number) => Promise<void>;
  saveInstallmentsForSale: (saleId: string, items: InstallmentInput[]) => Promise<void>;
  addCommission: (commission: Commission) => Promise<void>;
  updateCommissionStatus: (id: string, status: Commission['status']) => Promise<void>;
  deleteCommission: (id: string) => Promise<void>;
  addProspect: (prospect: Prospect) => Promise<void>;
  updateProspect: (id: string, data: Partial<Prospect>) => Promise<void>;
  deleteProspect: (id: string) => Promise<void>;
  convertProspect: (prospectId: string) => Promise<void>;
  addProspectActivity: (activity: ProspectActivity) => Promise<void>;
  deleteProspectActivity: (id: string) => Promise<void>;
  addProspectFollowUp: (followUp: ProspectFollowUp) => Promise<void>;
  updateProspectFollowUp: (id: string, data: Partial<ProspectFollowUp>) => Promise<void>;
  deleteProspectFollowUp: (id: string) => Promise<void>;
  upsertActivityReport: (report: ActivityReport) => Promise<void>;
  deleteActivityReport: (id: string) => Promise<void>;
  saveWeeklyReport: (report: WeeklyReport) => Promise<void>;
  markWeeklyReportSent: (id: string) => Promise<void>;
  markWeeklyReportRead: (id: string) => Promise<void>;
  markNotificationAsRead: (id: string) => Promise<void>;
  markAllNotificationsAsRead: () => Promise<void>;
  saveV2DailyReport: (report: V2DailyReport) => Promise<void>;
  saveV2WeeklyReport: (report: V2WeeklyReport) => Promise<void>;
  updateMyProfile: (data: Partial<Pick<User, 'photo' | 'name'>>) => Promise<void>;
  addCrmDocument: (file: File, uploaderId?: string, folderId?: string) => Promise<void>;
  deleteCrmDocument: (id: string) => Promise<void>;
  downloadCrmDocument: (doc: CrmDocument) => void;
  addCrmFolder: (name: string, ownerId: string, parentId?: string) => Promise<void>;
  updateCrmFolder: (id: string, data: Partial<CrmFolder>) => Promise<void>;
  deleteCrmFolder: (id: string) => Promise<void>;
  addCategory: (category: Category) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  updateSettings: (settings: AppSettings) => Promise<void>;
  addUser: (user: User) => Promise<void>;
  updateUser: (id: string, data: Pick<User, 'name' | 'role' | 'posRole' | 'serviceId' | 'posReturnsEnabled' | 'posCatalogueEnabled' | 'posSupplyEnabled' | 'posInventoryEnabled' | 'posStockEnabled'>) => Promise<void>;
  toggleUserStatus: (id: string) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  addPrestation: (prestation: Prestation) => Promise<void>;
  updatePrestation: (id: string, data: Partial<Prestation>) => Promise<void>;
  deletePrestation: (id: string) => Promise<void>;
  addService: (service: Service) => Promise<void>;
  updateService: (id: string, service: Partial<Service>) => Promise<void>;
  deleteService: (id: string) => Promise<void>;
  // POS CRUD
  addPosCategory: (cat: PosCategory) => Promise<void>;
  updatePosCategory: (id: string, data: Partial<PosCategory>) => Promise<void>;
  deletePosCategory: (id: string) => Promise<void>;
  addPosBrand: (brand: PosBrand) => Promise<void>;
  updatePosBrand: (id: string, data: Partial<PosBrand>) => Promise<void>;
  deletePosBrand: (id: string) => Promise<void>;
  addPosSupplier: (supplier: PosSupplier) => Promise<void>;
  updatePosSupplier: (id: string, data: Partial<PosSupplier>) => Promise<void>;
  deletePosSupplier: (id: string) => Promise<void>;
  addPosProduct: (product: PosProduct) => Promise<void>;
  updatePosProduct: (id: string, data: Partial<PosProduct>) => Promise<void>;
  deletePosProduct: (id: string) => Promise<void>;
  // Catalogue central (mêmes produits que le POS)
  findProductByBarcode: (barcode: string) => PosProduct | undefined;
  findProductByReference: (reference: string) => PosProduct | undefined;
  searchProducts: (query: string) => PosProduct[];
  getIncompleteProducts: () => PosProduct[];
  updateProductBarcode: (id: string, barcode: string | null) => Promise<void>;
  updateProductImage: (id: string, imageUrl: string | null) => Promise<void>;
  importProducts: (products: PosProduct[], duplicates?: 'ignore' | 'update' | 'create') => Promise<{ created: number; updated: number; duplicates: number }>;
  addPosStockEntry: (entry: PosStockEntry) => Promise<void>;
  updatePosStockEntry: (id: string, data: Partial<PosStockEntry>) => Promise<void>;
  deletePosStockEntry: (id: string) => Promise<void>;
  addPosStockMovement: (movement: Omit<PosStockMovement, 'id' | 'date'>) => Promise<void>;
  addPosInventory: (inventory: PosInventory) => Promise<void>;
  updatePosInventory: (id: string, data: Partial<PosInventory>) => Promise<void>;
  deletePosInventory: (id: string) => Promise<void>;
  addPosCashSession: (session: PosCashSession) => Promise<void>;
  updatePosCashSession: (id: string, data: Partial<PosCashSession>) => Promise<void>;
  addPosTransaction: (tx: PosTransaction) => Promise<void>;
  updatePosTransaction: (id: string, data: Partial<PosTransaction>) => Promise<void>;
  voidPosTransaction: (id: string) => Promise<void>;
  addPosDiscount: (discount: PosDiscount) => Promise<void>;
  updatePosDiscount: (id: string, data: Partial<PosDiscount>) => Promise<void>;
  deletePosDiscount: (id: string) => Promise<void>;
  updatePosSettings: (settings: PosSettings) => Promise<void>;
  // Product Module CRUD
  addProductCompletion: (completion: ProductCompletion) => Promise<void>;
  updateProductCompletion: (id: string, data: Partial<ProductCompletion>) => Promise<void>;
  deleteProductCompletion: (id: string) => Promise<void>;
  addImportSession: (session: ImportSession) => Promise<void>;
  updateImportSession: (id: string, data: Partial<ImportSession>) => Promise<void>;
  deleteImportSession: (id: string) => Promise<void>;
  addImportError: (error: ImportError) => Promise<void>;
  completeProduct: (productId: string, updates: Partial<PosProduct>) => Promise<void>;
  refreshData: () => Promise<void>;
}

  const defaultSettings: AppSettings = { companyName: 'Hinov', companyLogo: '', companyAddress: '', companySiret: '', companyTva: '', defaultTerms: '', commissionRate: 10 };

const AppContext = createContext<AppState | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [prospectActivities, setProspectActivities] = useState<ProspectActivity[]>([]);
  const [prospectFollowUps, setProspectFollowUps] = useState<ProspectFollowUp[]>([]);
  const [activityReports, setActivityReports] = useState<ActivityReport[]>([]);
  const [weeklyReports, setWeeklyReports] = useState<WeeklyReport[]>([]);
  const [v2DailyReports, setV2DailyReports] = useState<V2DailyReport[]>([]);
  const [v2WeeklyReports, setV2WeeklyReports] = useState<V2WeeklyReport[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [crmDocuments, setCrmDocuments] = useState<CrmDocument[]>([]);
  const [crmFolders, setCrmFolders] = useState<CrmFolder[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [prestations, setPrestations] = useState<Prestation[]>([]);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  // POS state
  const [posCategories, setPosCategories] = useState<PosCategory[]>([]);
  const [posBrands, setPosBrands] = useState<PosBrand[]>([]);
  const [posSuppliers, setPosSuppliers] = useState<PosSupplier[]>([]);
  const [posProducts, setPosProducts] = useState<PosProduct[]>([]);
  const [posStockEntries, setPosStockEntries] = useState<PosStockEntry[]>([]);
  const [posStockMovements, setPosStockMovements] = useState<PosStockMovement[]>([]);
  const [posInventories, setPosInventories] = useState<PosInventory[]>([]);
  const [posCashSessions, setPosCashSessions] = useState<PosCashSession[]>([]);
  const [posTransactions, setPosTransactions] = useState<PosTransaction[]>([]);
  const [posPayments, setPosPayments] = useState<PosPayment[]>([]);
  const [posDiscounts, setPosDiscounts] = useState<PosDiscount[]>([]);
  const [posReturns, setPosReturns] = useState<PosReturn[]>([]);
  const [suspendedCarts, setSuspendedCarts] = useState<SuspendedCart[]>([]);
  const [productCompletions, setProductCompletions] = useState<ProductCompletion[]>([]);
  const [importSessions, setImportSessions] = useState<ImportSession[]>([]);
  const [posSettings, setPosSettingsState] = useState<PosSettings>({ libraryName: 'Ma Librairie', address: '', phone: '', email: '', currency: 'FCFA', ticketMessage: 'Merci pour votre achat !', printerType: 'Thermique 80mm' });
  const [posWorkspace, setPosWorkspace] = useState<PosWorkspace>({ active: false });

  // Load from offline cache first, then fetch from Supabase if online
  const refreshData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Load from IndexedDB (Offline Cache)
      const cachedUsers = await db.profiles.getItem<User[]>('data');
      const cachedClients = await db.clients.getItem<Client[]>('data');
      const cachedQuotes = await db.quotes.getItem<Quote[]>('data');
      const cachedSales = await db.sales.getItem<Sale[]>('data');
      const cachedCommissions = await db.commissions.getItem<Commission[]>('data');
      const cachedInstallments = await db.installments.getItem<Installment[]>('data');
      const cachedProspects = await db.prospects.getItem<Prospect[]>('data');
      const cachedProspectActivities = await db.prospectActivities.getItem<ProspectActivity[]>('data');
      const cachedProspectFollowUps = await db.prospectFollowUps.getItem<ProspectFollowUp[]>('data');
      const cachedActivityReports = await db.activityReports.getItem<ActivityReport[]>('data');
      const cachedWeeklyReports = await db.weeklyReports.getItem<WeeklyReport[]>('data');
      const cachedV2DailyReports = await db.v2DailyReports.getItem<V2DailyReport[]>('data');
      const cachedV2WeeklyReports = await db.v2WeeklyReports.getItem<V2WeeklyReport[]>('data');
      const cachedCrmDocuments = await db.documents.getItem<CrmDocument[]>('data');
      const cachedCrmFolders = await db.crmFolders.getItem<CrmFolder[]>('data');
      const cachedNotifications = await db.notifications.getItem<AppNotification[]>('data');
      const cachedCategories = await db.categories.getItem<Category[]>('data');
      const cachedServices = await db.services.getItem<Service[]>('data');
      const cachedPrestations = await db.prestations.getItem<Prestation[]>('data');
      const cachedSettings = await db.settings.getItem<AppSettings>('data');
      const cachedPosCategories = await db.posCategories.getItem<PosCategory[]>('data');
      const cachedPosBrands = await db.posBrands.getItem<PosBrand[]>('data');
      const cachedPosSuppliers = await db.posSuppliers.getItem<PosSupplier[]>('data');
      const cachedPosProducts = await db.posProducts.getItem<PosProduct[]>('data');
      const cachedPosStockEntries = await db.posStockEntries.getItem<PosStockEntry[]>('data');
      const cachedPosStockMovements = await db.posStockMovements.getItem<PosStockMovement[]>('data');
      const cachedPosInventories = await db.posInventories.getItem<PosInventory[]>('data');
      const cachedPosCashSessions = await db.posCashSessions.getItem<PosCashSession[]>('data');
      const cachedPosTransactions = await db.posTransactions.getItem<PosTransaction[]>('data');
      const cachedPosPayments = await db.posPayments.getItem<PosPayment[]>('data');
      const cachedPosDiscounts = await db.posDiscounts.getItem<PosDiscount[]>('data');
      const cachedPosSettings = await db.posSettings.getItem<PosSettings>('data');
      const cachedPosReturns = await db.posReturns ? await db.posReturns.getItem<PosReturn[]>('data') : null;
      const cachedProductCompletions = await db.productCompletions ? await db.productCompletions.getItem<ProductCompletion[]>('data') : null;
      const cachedImportSessions = await db.importSessions ? await db.importSessions.getItem<ImportSession[]>('data') : null;

      if (cachedUsers) setUsers(cachedUsers);
      if (cachedClients) setClients(cachedClients);
      if (cachedQuotes) setQuotes(cachedQuotes);
      if (cachedSales) setSales(cachedSales);
      if (cachedCommissions) setCommissions(cachedCommissions);
      if (cachedInstallments) setInstallments(cachedInstallments);
      if (cachedProspects) setProspects(cachedProspects);
      if (cachedProspectActivities) setProspectActivities(cachedProspectActivities);
      if (cachedProspectFollowUps) setProspectFollowUps(cachedProspectFollowUps);
      if (cachedActivityReports) setActivityReports(cachedActivityReports);
      if (cachedWeeklyReports) setWeeklyReports(cachedWeeklyReports);
      if (cachedV2DailyReports) setV2DailyReports(cachedV2DailyReports);
      if (cachedV2WeeklyReports) setV2WeeklyReports(cachedV2WeeklyReports);
      if (cachedCrmDocuments) setCrmDocuments(cachedCrmDocuments);
      if (cachedCrmFolders) setCrmFolders(cachedCrmFolders);
      if (cachedNotifications) setNotifications(cachedNotifications);
      if (cachedCategories) setCategories(cachedCategories);
      if (cachedServices) setServices(cachedServices);
      if (cachedPrestations) setPrestations(cachedPrestations);
      if (cachedSettings) setSettings(cachedSettings);
      if (cachedPosCategories) setPosCategories(cachedPosCategories);
      if (cachedPosBrands) setPosBrands(cachedPosBrands);
      if (cachedPosSuppliers) setPosSuppliers(cachedPosSuppliers);
      if (cachedPosProducts) setPosProducts(prev => prev.length > 0 ? prev : cachedPosProducts);
      if (cachedPosStockEntries) setPosStockEntries(cachedPosStockEntries.filter(e => e.notes !== 'VENTE' && !e.reference?.startsWith('VENTE-')));
      if (cachedPosStockMovements) setPosStockMovements(cachedPosStockMovements);
      if (cachedPosInventories) setPosInventories(cachedPosInventories);
      if (cachedPosCashSessions) setPosCashSessions(cachedPosCashSessions);
      if (cachedPosTransactions) setPosTransactions(cachedPosTransactions);
      if (cachedPosPayments) setPosPayments(cachedPosPayments);
      if (cachedPosDiscounts) setPosDiscounts(cachedPosDiscounts);
      if (cachedPosSettings) setPosSettingsState(cachedPosSettings);
      if (cachedPosReturns) setPosReturns(cachedPosReturns);
      if (cachedProductCompletions) setProductCompletions(cachedProductCompletions);
      if (cachedImportSessions) setImportSessions(cachedImportSessions);

      // Initialize default data if first launch
      if (!cachedPosCategories || cachedPosCategories.length === 0) {
        const defaultCategories = [
          { id: uuidv4(), name: 'Livres', family: 'Livre' as const },
          { id: uuidv4(), name: 'Fournitures scolaires', family: 'Fourniture' as const },
          { id: uuidv4(), name: 'Divers', family: 'Fourniture' as const },
        ];
        setPosCategories(defaultCategories);
        await db.posCategories.setItem('data', defaultCategories);
      }

      // 2. Fetch from Supabase (if online) and update Cache
      if (navigator.onLine && currentUser) {
        // Process any pending offline mutations before fetching to avoid overwriting local changes with stale data
        await processSyncQueue();

        const lastSyncTime = await db.syncMetadata.getItem<string>('lastSyncTime');
        const syncTimestamp = new Date().toISOString();

        // Chaque table est récupérée isolément : l'échec d'une table ne bloque plus le reste du refresh
        const safeFetch = async (queryFn: () => any): Promise<any> => {
          try {
            let query = queryFn();
            if (lastSyncTime) {
               // Only apply delta if lastSyncTime exists
               query = query.gt('updated_at', lastSyncTime);
            }
            const { data, error } = await query;
            if (error) {
              console.error('[refreshData] Table ignorée :', error.message);
              return null;
            }
            return data;
          } catch (e) {
            console.error('[refreshData] Table ignorée :', e);
            return null;
          }
        };
        const [
          profilesData, clientsData, servicesData,
          prestationsData, settingsData, quotesData,
          salesData, commissionsData, installmentsData,
          prospectsData, prospectActivitiesData,
          prospectFollowUpsData, categoriesData,
          activityReportsData, weeklyReportsData,
          v2DailyReportsData, v2WeeklyReportsData,
          posCategoriesData, posBrandsData, posSuppliersData,
          posProductsData, posStockEntriesData, posStockMovementsData, posInventoriesData,
          posCashSessionsData, posTransactionsData, posPaymentsData,
          posDiscountsData, posSettingsData, crmDocumentsData, crmFoldersData, notificationsData,
          posReturnsData
        ] = await Promise.all([
          safeFetch(() => supabase.from('profiles').select('*')),
          safeFetch(() => supabase.from('clients').select('*')),
          safeFetch(() => supabase.from('services').select('*')),
          safeFetch(() => supabase.from('prestations').select('*')),
          safeFetch(() => supabase.from('settings').select('*').single()),
          safeFetch(() => supabase.from('quotes').select('*, quote_lines(*)')),
          safeFetch(() => supabase.from('ventes').select('*, vente_lines(*)')),
          safeFetch(() => supabase.from('commissions').select('*')),
          safeFetch(() => supabase.from('vente_echeances').select('*')),
          safeFetch(() => supabase.from('prospects').select('*')),
          safeFetch(() => supabase.from('prospect_activities').select('*')),
          safeFetch(() => supabase.from('prospect_follow_ups').select('*')),
          safeFetch(() => supabase.from('categories').select('*')),
          safeFetch(() => supabase.from('activity_reports').select('*')),
          safeFetch(() => supabase.from('weekly_reports').select('*')),
          safeFetch(() => supabase.from('v2_daily_reports').select('*')),
          safeFetch(() => supabase.from('v2_weekly_reports').select('*')),
          safeFetch(() => supabase.from('pos_categories').select('*')),
          safeFetch(() => supabase.from('pos_brands').select('*')),
          safeFetch(() => supabase.from('pos_suppliers').select('*')),
          safeFetch(() => supabase.from('pos_products').select('*')),
          safeFetch(() => supabase.from('pos_stock_entries').select('*, pos_stock_entry_lines(*)')),
          safeFetch(() => supabase.from('pos_stock_movements').select('*')),
          safeFetch(() => supabase.from('pos_inventories').select('*, pos_inventory_lines(*)')),
          safeFetch(() => supabase.from('pos_cash_sessions').select('*')),
          safeFetch(() => supabase.from('pos_transactions').select('*, pos_transaction_lines(*), pos_payments(*)')),
          safeFetch(() => supabase.from('pos_payments').select('*')),
          safeFetch(() => supabase.from('pos_discounts').select('*')),
          safeFetch(() => supabase.from('pos_settings').select('*').single()),
          safeFetch(() => supabase.from('crm_documents').select('*')),
          safeFetch(() => supabase.from('crm_folders').select('*')),
          safeFetch(() => supabase.from('notifications').select('*')),
          safeFetch(() => supabase.from('pos_returns').select('*, pos_return_lines(*)')),
        ]);

        if (profilesData && profilesData.length > 0) {
          const parsedUsers = profilesData.map((p: any) => ({
            id: p.id,
            name: p.name,
            email: p.email,
            role: p.role as User['role'],
            serviceId: p.service_id,
            pin: p.pin,
            lastLogin: p.last_login,
            active: p.active !== false, // true par défaut si null
            photo: p.photo || undefined,
            posReturnsEnabled: p.pos_returns_enabled === true,
            posCatalogueEnabled: p.pos_catalogue_enabled === true,
            posSupplyEnabled: p.pos_supply_enabled === true,
            posInventoryEnabled: p.pos_inventory_enabled === true,
            posStockEnabled: p.pos_stock_enabled === true,
            posRole: p.pos_role || null
          }));
          const mergedUsers = mergeData(cachedUsers, parsedUsers);
          setUsers(mergedUsers); await db.profiles.setItem('data', mergedUsers);
        }
        
        if (crmDocumentsData && crmDocumentsData.length > 0) {
          const parsedCrmDocuments = crmDocumentsData.map((d: any) => ({
            id: d.id,
            name: d.name,
            type: d.type,
            sizeBytes: d.size_bytes,
            filePath: d.file_path,
            uploaderId: d.uploader_id,
            folderId: d.folder_id,
            createdAt: d.created_at
          }));
          const mergedCrmDocuments = mergeData(cachedCrmDocuments, parsedCrmDocuments);
          setCrmDocuments(mergedCrmDocuments); await db.documents.setItem('data', mergedCrmDocuments);
        }

        if (crmFoldersData && crmFoldersData.length > 0) {
          const mergedFolders = mergeData(cachedCrmFolders, crmFoldersData);
          setCrmFolders(mergedFolders); await db.crmFolders.setItem('data', mergedFolders);
        }

        if (notificationsData && notificationsData.length > 0) {
          const mergedNotifications = mergeData(cachedNotifications, notificationsData);
          setNotifications(mergedNotifications); await db.notifications.setItem('data', mergedNotifications);
        }

        if (clientsData && clientsData.length > 0) {
          const parsedClients = clientsData.map((c: any) => ({
            id: c.id, name: c.name, email: c.email, phone: c.phone, contact: c.contact, company: c.company, address: c.address, status: c.status || 'Actif', commercialId: c.commercial_id, createdAt: c.created_at
          }));
          const merged = mergeData(cachedClients, parsedClients);
          setClients(merged); await db.clients.setItem('data', merged);
        }
        if (servicesData && servicesData.length > 0) {
          const merged = mergeData(cachedServices, (servicesData as Service[]));
          setServices(merged); await db.services.setItem('data', merged);
        }
        if (prestationsData && prestationsData.length > 0) {
          const parsedPrestations = prestationsData.map((p: any) => ({...p, serviceId: p.service_id, costPrice: p.cost_price ?? 0})) as Prestation[];
          const merged = mergeData(cachedPrestations, parsedPrestations);
          setPrestations(merged); await db.prestations.setItem('data', merged);
        }
        if (settingsData) {
          const parsedSettings: AppSettings = {
            companyName: settingsData.company_name,
            companyLogo: settingsData.company_logo,
            companyAddress: settingsData.company_address,
            companySiret: settingsData.company_siret,
            companyTva: settingsData.company_tva,
            defaultTerms: settingsData.default_terms,
            headerLogoBase64: settingsData.header_logo_base64 ?? undefined,
            defaultValidity: settingsData.default_validity ?? undefined,
            siteUrl: settingsData.site_url ?? undefined,
            commissionRate: settingsData.commission_rate ?? undefined,
          };
          setSettings(parsedSettings); await db.settings.setItem('data', parsedSettings);
        }
        if (quotesData && quotesData.length > 0) {
          const parsedQuotes = quotesData.map((q: any) => ({
            id: q.id, quoteNumber: q.quote_number, clientId: q.client_id, commercialId: q.commercial_id, serviceId: q.service_id, subject: q.subject, subtotal: q.subtotal, total: q.total, status: q.status, date: q.date, style: q.style, accentColor: q.accent_color,
            discountPercent: q.discount_percent || 0, discountAmount: q.discount_amount || 0, clientComment: q.client_comment,
            lines: q.quote_lines.map((l: any) => ({ id: l.id, prestationId: l.prestation_id, description: l.description, quantity: l.quantity, unitPrice: l.unit_price, total: l.total, discountPercent: l.discount_percent || 0 }))
          }));
          const merged = mergeData(cachedQuotes, parsedQuotes);
          setQuotes(merged); await db.quotes.setItem('data', merged);
        }
        if (salesData && salesData.length > 0) {
          const parsedSales = salesData.map((s: any) => ({
            id: s.id, saleNumber: s.sale_number, quoteId: s.quote_id, clientId: s.client_id, serviceId: s.service_id,
            subtotal: s.subtotal, total: s.total, status: s.status, date: s.date, notes: s.notes,
            lines: (s.vente_lines || []).map((l: any) => ({ id: l.id, description: l.description, quantity: l.quantity, unitPrice: l.unit_price, costPrice: l.cost_price || 0, total: l.total }))
          }));
          const merged = mergeData(cachedSales, parsedSales);
          setSales(merged); await db.sales.setItem('data', merged);
        }
        if (commissionsData && commissionsData.length > 0) {
          const parsedCommissions = commissionsData.map((c: any) => ({
            id: c.id, saleId: c.vente_id, clientId: c.client_id, commercialId: c.commercial_id, serviceId: c.service_id,
            totalHt: c.total_ht, costTotal: c.cost_total, marginAmount: c.margin_amount, marginPercent: c.margin_percent,
            commissionPercent: c.commission_percent, commissionAmount: c.commission_amount, paidAmount: c.paid_amount || 0, status: c.status, createdAt: c.created_at
          }));
          const merged = mergeData(cachedCommissions, parsedCommissions);
          setCommissions(merged); await db.commissions.setItem('data', merged);
        }
        if (installmentsData && installmentsData.length > 0) {
          const parsedInstallments = installmentsData.map((i: any) => ({
            id: i.id, saleId: i.vente_id, amount: i.amount, dueDate: i.due_date, paidAmount: i.paid_amount || 0, status: i.status, paidAt: i.paid_at || undefined
          }));
          const merged = mergeData(cachedInstallments, parsedInstallments);
          setInstallments(merged); await db.installments.setItem('data', merged);
        }
        if (prospectsData && prospectsData.length > 0) {
          const parsedProspects = prospectsData.map((p: any) => ({
            id: p.id, prospectNumber: p.prospect_number, commercialId: p.commercial_id, serviceId: p.service_id, categoryId: p.category_id,
            type: p.type, name: p.name, company: p.company, phone: p.phone, email: p.email, address: p.address, city: p.city,
            source: p.source, interestLevel: p.interest_level, budget: p.budget, need: p.need, comments: p.comments,
            status: p.status, responsibleId: p.responsible_id, createdAt: p.created_at, updatedAt: p.updated_at
          }));
          const merged = mergeData(cachedProspects, parsedProspects);
          setProspects(merged); await db.prospects.setItem('data', merged);
        }
        if (prospectActivitiesData && prospectActivitiesData.length > 0) {
          const parsedActivities = prospectActivitiesData.map((a: any) => ({
            id: a.id, prospectId: a.prospect_id, type: a.type, description: a.description, date: a.date, createdBy: a.created_by
          }));
          const merged = mergeData(cachedProspectActivities, parsedActivities);
          setProspectActivities(merged); await db.prospectActivities.setItem('data', merged);
        }
        if (prospectFollowUpsData && prospectFollowUpsData.length > 0) {
          const parsedFollowUps = prospectFollowUpsData.map((f: any) => ({
            id: f.id, prospectId: f.prospect_id, date: f.date, time: f.time, priority: f.priority, observation: f.observation, status: f.status
          }));
          const merged = mergeData(cachedProspectFollowUps, parsedFollowUps);
          setProspectFollowUps(merged); await db.prospectFollowUps.setItem('data', merged);
        }
        if (categoriesData && categoriesData.length > 0) {
          const parsedCategories = categoriesData.map((c: any) => ({ id: c.id, serviceId: c.service_id, name: c.name }));
          const merged = mergeData(cachedCategories, parsedCategories);
          setCategories(merged); await db.categories.setItem('data', merged);
        }
        if (activityReportsData && activityReportsData.length > 0) {
          const parsedReports = activityReportsData.map((r: any) => ({
            id: r.id, authorId: r.author_id, role: r.role, type: r.type, date: r.date,
            realisations: r.realisations || '', difficultes: r.difficultes || '', remarques: r.remarques || '',
            createdAt: r.created_at, updatedAt: r.updated_at
          }));
          const merged = mergeData(cachedActivityReports, parsedReports);
          setActivityReports(merged); await db.activityReports.setItem('data', merged);
        }
        if (weeklyReportsData && weeklyReportsData.length > 0) {
          const parsedReports = weeklyReportsData.map((r: any) => ({
            id: r.id, authorId: r.author_id, role: r.role, weekStart: r.week_start,
            sections: r.sections || [], kpis: r.kpis || {}, status: r.status,
            sentAt: r.sent_at || undefined, createdAt: r.created_at
          }));
          const merged = mergeData(cachedWeeklyReports, parsedReports);
          setWeeklyReports(merged); await db.weeklyReports.setItem('data', merged);
        }
        if (v2DailyReportsData && v2DailyReportsData.length > 0) {
          const parsed = v2DailyReportsData.map((r: any) => ({
            id: r.id, authorId: r.author_id, date: r.date, project: r.project,
            objectives: r.objectives || '', tasks: r.tasks || [], results: r.results || '',
            difficulties: r.difficulties || '', observations: r.observations || '',
            status: r.status || 'Brouillon',
            createdAt: r.created_at, updatedAt: r.updated_at
          }));
          const merged = mergeData(cachedV2DailyReports, parsed);
          setV2DailyReports(merged); await db.v2DailyReports.setItem('data', merged);
        }
        if (v2WeeklyReportsData && v2WeeklyReportsData.length > 0) {
          const parsed = v2WeeklyReportsData.map((r: any) => ({
            id: r.id, authorId: r.author_id, weekStart: r.week_start, project: r.project,
            dailyReportIds: r.daily_report_ids || [], weeklyObjectives: r.weekly_objectives || '',
            tasksByDay: r.tasks_by_day || {}, pendingTasks: r.pending_tasks || [], summary: r.summary || '',
            nextWeekObjectives: r.next_week_objectives || '', conclusion: r.conclusion || '', status: r.status,
            createdAt: r.created_at, updatedAt: r.updated_at
          }));
          const merged = mergeData(cachedV2WeeklyReports, parsed);
          setV2WeeklyReports(merged); await db.v2WeeklyReports.setItem('data', merged);
        }
        if (posCategoriesData && posCategoriesData.length > 0) {
          const parsed = posCategoriesData.map((c: any) => ({ id: c.id, name: c.name, family: c.family }));
          const merged = mergeData(cachedPosCategories, parsed);
          setPosCategories(merged); await db.posCategories.setItem('data', merged);
        }
        if (posBrandsData && posBrandsData.length > 0) {
          const parsed = posBrandsData.map((b: any) => ({ id: b.id, name: b.name }));
          const merged = mergeData(cachedPosBrands, parsed);
          setPosBrands(merged); await db.posBrands.setItem('data', merged);
        }
        if (posSuppliersData && posSuppliersData.length > 0) {
          const parsed = posSuppliersData.map((s: any) => ({ id: s.id, name: s.name, contact: s.contact, phone: s.phone, email: s.email, address: s.address }));
          const merged = mergeData(cachedPosSuppliers, parsed);
          setPosSuppliers(merged); await db.posSuppliers.setItem('data', merged);
        }
        if (posProductsData && posProductsData.length > 0) {
          const parsed = posProductsData.map((p: any) => ({
            id: p.id, reference: p.reference, barcode: p.barcode, isbn: p.isbn, name: p.name,
            family: p.family, categoryId: p.category_id, brandId: p.brand_id, supplierId: p.supplier_id,
            purchasePrice: p.purchase_price, sellingPrice: p.selling_price, quantity: p.quantity,
            minStock: p.min_stock, imageUrl: p.image_url, description: p.description,
            status: p.status || 'Active', isActive: p.is_active !== false, unit: p.unit, createdAt: p.created_at, updatedAt: p.updated_at
          }));
          setPosProducts(prev => {
            const merged = mergeData(prev, parsed);
            void db.posProducts.setItem('data', merged);
            return merged;
          });
        }
        if (posStockEntriesData && posStockEntriesData.length > 0) {
          const parsed = posStockEntriesData
            .filter((e: any) => e.notes !== 'VENTE' && !e.reference?.startsWith('VENTE-'))
            .map((e: any) => ({
              id: e.id, reference: e.reference, supplierId: e.supplier_id, date: e.date,
              totalAmount: e.total_amount, status: e.status, notes: e.notes, createdBy: e.created_by,
              lines: (e.pos_stock_entry_lines || []).map((l: any) => ({
                id: l.id, productId: l.product_id, quantity: l.quantity, purchasePrice: l.purchase_price, total: l.total
              }))
            }));
          const filteredCached = (cachedPosStockEntries || []).filter(e => e.notes !== 'VENTE' && !e.reference?.startsWith('VENTE-'));
          const merged = mergeData(filteredCached, parsed);
          setPosStockEntries(merged); await db.posStockEntries.setItem('data', merged);
        }
        if (posStockMovementsData && posStockMovementsData.length > 0) {
          const parsed = posStockMovementsData.map((m: any) => ({
            id: m.id, productId: m.product_id, type: m.type, quantity: m.quantity,
            reference: m.reference, date: m.date, createdBy: m.created_by, notes: m.notes
          }));
          const merged = mergeData(cachedPosStockMovements, parsed);
          setPosStockMovements(merged); await db.posStockMovements.setItem('data', merged);
        }
        if (posInventoriesData && posInventoriesData.length > 0) {
          const parsed = posInventoriesData.map((i: any) => ({
            id: i.id, reference: i.reference, date: i.date, status: i.status, notes: i.notes, createdBy: i.created_by,
            lines: (i.pos_inventory_lines || []).map((l: any) => ({
              id: l.id, productId: l.product_id, expectedQty: l.expected_qty, countedQty: l.counted_qty, difference: l.difference
            }))
          }));
          const merged = mergeData(cachedPosInventories, parsed);
          setPosInventories(merged); await db.posInventories.setItem('data', merged);
        }
        if (posCashSessionsData && posCashSessionsData.length > 0) {
          const parsed = posCashSessionsData.map((s: any) => ({
            id: s.id, cashierId: s.cashier_id, openedAt: s.opened_at, closedAt: s.closed_at,
            initialFund: s.initial_fund, finalAmount: s.final_amount, expectedAmount: s.expected_amount,
            difference: s.difference, status: s.status
          }));
          const merged = mergeData(cachedPosCashSessions, parsed);
          setPosCashSessions(merged); await db.posCashSessions.setItem('data', merged);
        }
        if (posTransactionsData && posTransactionsData.length > 0) {
          const parsed = posTransactionsData.map((t: any) => ({
            id: t.id, transactionNumber: t.transaction_number, cashierId: t.cashier_id,
            sessionId: t.session_id, date: t.date, subtotal: t.subtotal, vat: t.vat ?? 0,
            discountAmount: t.discount_amount, total: t.total, status: t.status,
            lines: (t.pos_transaction_lines || []).map((l: any) => ({
              id: l.id, productId: l.product_id, description: l.description, quantity: l.quantity,
              unitPrice: l.unit_price, discountPercent: l.discount_percent, discountAmount: l.discount_amount, total: l.total
            })),
            payments: (t.pos_payments || []).map((p: any) => ({
              id: p.id, transactionId: p.transaction_id, method: p.method, amount: p.amount, reference: p.reference
            }))
          }));
          const merged = mergeData(cachedPosTransactions, parsed);
          setPosTransactions(merged); await db.posTransactions.setItem('data', merged);
        }
        if (posPaymentsData && posPaymentsData.length > 0) {
          const parsed = posPaymentsData.map((p: any) => ({ id: p.id, transactionId: p.transaction_id, method: p.method, amount: p.amount, reference: p.reference }));
          const merged = mergeData(cachedPosPayments, parsed);
          setPosPayments(merged); await db.posPayments.setItem('data', merged);
        }
        if (posDiscountsData && posDiscountsData.length > 0) {
          const parsed = posDiscountsData.map((d: any) => ({ id: d.id, name: d.name, type: d.type, value: d.value, maxPercent: d.max_percent, maxAmount: d.max_amount, active: d.active }));
          const merged = mergeData(cachedPosDiscounts, parsed);
          setPosDiscounts(merged); await db.posDiscounts.setItem('data', merged);
        }
        if (posSettingsData) {
          const parsed: PosSettings = { libraryName: posSettingsData.library_name, address: posSettingsData.address, phone: posSettingsData.phone, email: posSettingsData.email, currency: posSettingsData.currency, ticketMessage: posSettingsData.ticket_message, printerType: posSettingsData.printer_type };
          setPosSettingsState(parsed); await db.posSettings.setItem('data', parsed);
        }
        
        if (posReturnsData && posReturnsData.length > 0) {
          const parsed: PosReturn[] = posReturnsData.map((r: any) => ({
            id: r.id,
            returnNumber: r.return_number,
            transactionId: r.transaction_id || undefined,
            date: r.date,
            type: r.type,
            totalRefund: r.total_refund,
            totalExchange: r.total_exchange || 0,
            status: r.status,
            notes: r.notes || '',
            createdBy: r.created_by || undefined,
            lines: (r.pos_return_lines || []).map((l: any) => ({
              id: l.id,
              productId: l.product_id || undefined,
              description: l.description,
              quantity: l.quantity,
              unitPrice: l.unit_price,
              total: l.total,
              reason: l.reason || ''
            })),
            exchangeLines: []
          }));
          const merged = mergeData(cachedPosReturns || [], parsed);
          setPosReturns(merged); await db.posReturns.setItem('data', merged);
        }

        // Update last sync time for next delta fetch
        await db.syncMetadata.setItem('lastSyncTime', syncTimestamp);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => { refreshData(); }, [refreshData]);

  // Realtime delta sync
  useEffect(() => {
    if (!currentUser) return;
    const channel = supabase.channel('public-all')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => {
        // Trigger a delta refresh whenever any table changes remotely
        refreshData();
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser, refreshData]);

  // Auto-retry: relance la sync queue toutes les 5 minutes si des actions sont en attente
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!navigator.onLine) return;
      const queue = await db.syncQueue.getItem<any[]>('queue');
      if (queue && queue.length > 0) {
        console.log(`[AutoSync] ${queue.length} action(s) en attente. Tentative de synchronisation...`);
        processSyncQueue();
      }
    }, 5 * 60 * 1000); // toutes les 5 minutes
    return () => clearInterval(interval);
  }, []);

  // Écoute les erreurs critiques de synchronisation et les affiche comme toast
  useEffect(() => {
    const handleSyncCriticalError = (e: Event) => {
      const detail = (e as CustomEvent).detail as { message: string };
      toast.error(detail.message, {
        duration: 8000,
        style: {
          background: '#FEF2F2',
          color: '#991B1B',
          border: '1px solid #FCA5A5',
          fontSize: '13px',
          maxWidth: '420px'
        }
      });
    };
    window.addEventListener('sync-critical-error', handleSyncCriticalError);
    return () => window.removeEventListener('sync-critical-error', handleSyncCriticalError);
  }, []);

  // MUTATIONS (Offline First)
  const addClient = async (client: Client) => {
    // Generate UUID if it's not a valid UUID (e.g. if it was Date.now())
    const newClient = { ...client, id: client.id.length > 20 ? client.id : uuidv4(), createdAt: client.createdAt || new Date().toISOString() };
    const newClients = [...clients, newClient];
    setClients(newClients);
    await db.clients.setItem('data', newClients);
    await queueSyncAction('INSERT_CLIENT', newClient);
  };

  const updateClient = async (id: string, client: Client) => {
    const newClients = clients.map(c => c.id === id ? { ...client, id } : c);
    setClients(newClients);
    await db.clients.setItem('data', newClients);
    await queueSyncAction('UPDATE_CLIENT', { ...client, id });
  };

  const deleteClient = async (id: string) => {
    const newClients = clients.filter(c => c.id !== id);
    setClients(newClients);
    await db.clients.setItem('data', newClients);
    await queueSyncAction('DELETE_CLIENT', { id });

    const newQuotes = quotes.filter(q => q.clientId !== id);
    if (newQuotes.length !== quotes.length) {
      setQuotes(newQuotes);
      await db.quotes.setItem('data', newQuotes);
    }

    const newSales = sales.filter(s => s.clientId !== id);
    if (newSales.length !== sales.length) {
      setSales(newSales);
      await db.sales.setItem('data', newSales);
      
      const saleIds = sales.filter(s => s.clientId === id).map(s => s.id);
      const newInstallments = installments.filter(i => !saleIds.includes(i.saleId));
      if (newInstallments.length !== installments.length) {
        setInstallments(newInstallments);
        await db.installments.setItem('data', newInstallments);
      }
    }

    const newCommissions = commissions.filter(c => c.clientId !== id);
    if (newCommissions.length !== commissions.length) {
      setCommissions(newCommissions);
      await db.commissions.setItem('data', newCommissions);
    }
  };

  const addQuote = async (quote: Quote) => {
    // Generate true UUIDs for DB compatibility if they used Date.now()
    const quoteId = quote.id.length > 20 ? quote.id : uuidv4();
    const newQuote = { 
      ...quote, 
      id: quoteId, 
      lines: quote.lines.map(l => ({ ...l, id: l.id.length > 20 ? l.id : uuidv4() }))
    };
    
    const newQuotes = [...quotes, newQuote];
    setQuotes(newQuotes);
    await db.quotes.setItem('data', newQuotes);
    await queueSyncAction('INSERT_QUOTE', newQuote);
  };

  const updateQuote = async (id: string, quote: Quote) => {
    const newQuote = {
      ...quote,
      lines: quote.lines.map(l => ({ ...l, id: l.id.length > 20 ? l.id : uuidv4() }))
    };
    const newQuotes = quotes.map(q => q.id === id ? newQuote : q);
    setQuotes(newQuotes);
    await db.quotes.setItem('data', newQuotes);
    await queueSyncAction('UPDATE_QUOTE', newQuote);
  };

  const updateQuoteStatus = async (id: string, status: Quote['status'], clientComment?: string) => {
    const quote = quotes.find(q => q.id === id);
    if (!quote) return;
    const newQuote = { ...quote, status, ...(clientComment !== undefined && { clientComment }) };
    const newQuotes = quotes.map(q => q.id === id ? newQuote : q);
    setQuotes(newQuotes);
    await db.quotes.setItem('data', newQuotes);
    await queueSyncAction('UPDATE_QUOTE', newQuote);
  };

  const deleteQuote = async (id: string) => {
    const newQuotes = quotes.filter(q => q.id !== id);
    setQuotes(newQuotes);
    await db.quotes.setItem('data', newQuotes);
    await queueSyncAction('DELETE_QUOTE', { id });
  };

  const buildCommission = (sale: Sale): Commission => {
    const costTotal = sale.lines.reduce((sum, l) => sum + (l.costPrice || 0) * l.quantity, 0);
    const totalHt = sale.subtotal;
    const marginAmount = totalHt - costTotal;
    const marginPercent = totalHt > 0 ? Math.round((marginAmount / totalHt) * 10000) / 100 : 0;
    const commissionPercent = settings.commissionRate !== undefined ? settings.commissionRate : 10;
    const commissionAmount = Math.round(marginAmount * commissionPercent / 100);
    const clientCommercial = clients.find(c => c.id === sale.clientId)?.commercialId;
    const quoteCommercial = sale.quoteId ? quotes.find(q => q.id === sale.quoteId)?.commercialId : undefined;
    return {
      id: uuidv4(),
      saleId: sale.id,
      clientId: sale.clientId,
      commercialId: clientCommercial || quoteCommercial || '',
      serviceId: sale.serviceId,
      totalHt,
      costTotal,
      marginAmount,
      marginPercent,
      commissionPercent,
      commissionAmount,
      paidAmount: 0,
      status: 'En attente',
      createdAt: new Date().toISOString()
    };
  };

  const commissionPaidAmount = (saleId: string, total: number, commissionAmount: number, instList: Installment[]): number => {
    const insts = instList.filter(i => i.saleId === saleId);
    if (total <= 0 || insts.length === 0 || commissionAmount <= 0) return 0;
    const received = Math.min(total, insts.reduce((sum, i) => sum + i.paidAmount, 0));
    return Math.min(commissionAmount, Math.round(received * (commissionAmount / total)));
  };

  const addSale = async (sale: Sale, installmentsInput?: InstallmentInput[]) => {
    const saleId = sale.id.length > 20 ? sale.id : uuidv4();
    const newSale = {
      ...sale,
      id: saleId,
      lines: sale.lines.map(l => ({ ...l, id: l.id.length > 20 ? l.id : uuidv4() }))
    };
    const newSales = [...sales, newSale];
    setSales(newSales);
    await db.sales.setItem('data', newSales);
    await queueSyncAction('INSERT_SALE', newSale);

    // Auto-create commission from sale margin
    const newCommission = buildCommission(newSale);
    await addCommission(newCommission);

    // Installments plan (default: one installment = full amount due today)
    const today = new Date();
    const todayLocal = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const items = installmentsInput && installmentsInput.length > 0
      ? installmentsInput
      : [{ amount: newSale.total, dueDate: todayLocal }];
    const newInstallmentObjs: Installment[] = items.map(it => ({
      id: it.id && it.id.length > 20 ? it.id : uuidv4(),
      saleId,
      amount: it.amount,
      dueDate: it.dueDate,
      paidAmount: 0,
      status: 'En attente'
    }));
    const allInstallments = [...installments, ...newInstallmentObjs];
    setInstallments(allInstallments);
    await db.installments.setItem('data', allInstallments);
    for (const inst of newInstallmentObjs) {
      await queueSyncAction('INSERT_INSTALLMENT', inst);
    }
  };

  const saveInstallmentsForSale = async (saleId: string, items: InstallmentInput[]) => {
    const existing = installments.filter(i => i.saleId === saleId);
    const keptIds = items.map(it => it.id).filter(Boolean) as string[];
    const toDelete = existing.filter(i => !keptIds.includes(i.id));

    const updated: (Installment & { wasNew?: boolean })[] = items.map(it => {
      const found = existing.find(e => e.id === it.id);
      if (found) {
        const paidAmount = Math.min(found.paidAmount, it.amount);
        return { ...found, wasNew: false, amount: it.amount, dueDate: it.dueDate, paidAmount, status: paidAmount >= it.amount ? 'Payée' as const : 'En attente' as const };
      }
      return { id: uuidv4(), saleId, wasNew: true, amount: it.amount, dueDate: it.dueDate, paidAmount: 0, status: 'En attente' as const };
    });

    const storedUpdated = updated.map(({ wasNew: _wasNew, ...clean }) => clean);
    const nextInstallments = [
      ...installments.filter(i => i.saleId !== saleId),
      ...storedUpdated,
    ];
    setInstallments(nextInstallments);
    await db.installments.setItem('data', nextInstallments);
    for (const inst of toDelete) await queueSyncAction('DELETE_INSTALLMENT', { id: inst.id });
    for (const inst of updated) {
      if (inst.wasNew) {
        await queueSyncAction('INSERT_INSTALLMENT', { id: inst.id, saleId, amount: inst.amount, dueDate: inst.dueDate, paidAmount: inst.paidAmount, status: inst.status });
      } else {
        await queueSyncAction('UPDATE_INSTALLMENT', inst);
      }
    }

    // Recompute sale status + commission paid amounts
    const sale = sales.find(s => s.id === saleId);
    if (sale) {
      const allPaid = updated.length > 0 && updated.every(i => i.status === 'Payée');
      if (sale.status === 'Enregistrée' && allPaid) {
        await updateSaleStatus(saleId, 'Payée');
      }
      const linkedCommission = commissions.find(c => c.saleId === saleId);
      if (linkedCommission) {
        const paidAmount = commissionPaidAmount(saleId, sale.total, linkedCommission.commissionAmount, nextInstallments);
        const status = paidAmount >= linkedCommission.commissionAmount && linkedCommission.status === 'Validée' ? 'Payée' : linkedCommission.status;
        if (paidAmount !== linkedCommission.paidAmount) {
          const updatedComm = { ...linkedCommission, paidAmount, status };
          const newCommissions = commissions.map(c => c.id === linkedCommission.id ? updatedComm : c);
          setCommissions(newCommissions);
          await db.commissions.setItem('data', newCommissions);
          await queueSyncAction('UPDATE_COMMISSION', { id: updatedComm.id, status: updatedComm.status, paidAmount });
        }
      }
    }
  };

  const updateSaleStatus = async (id: string, status: Sale['status']) => {
    const sale = sales.find(s => s.id === id);
    if (!sale) return;
    const newSale = { ...sale, status };
    const newSales = sales.map(s => s.id === id ? newSale : s);
    setSales(newSales);
    await db.sales.setItem('data', newSales);
    await queueSyncAction('UPDATE_SALE', newSale);
  };

  const updateSale = async (id: string, saleData: Sale) => {
    const newSales = sales.map(s => s.id === id ? saleData : s);
    setSales(newSales);
    await db.sales.setItem('data', newSales);
    await queueSyncAction('UPDATE_SALE', saleData);

    // Recompute linked commission when costs change (preserve paid progress)
    const linkedCommission = commissions.find(c => c.saleId === id);
    if (linkedCommission) {
      const rebuilt = buildCommission(saleData);
      const paidAmount = Math.min(rebuilt.commissionAmount, commissionPaidAmount(id, saleData.total, rebuilt.commissionAmount, installments));
      const updatedCommission = {
        ...rebuilt,
        id: linkedCommission.id,
        paidAmount,
        status: paidAmount >= rebuilt.commissionAmount && linkedCommission.status === 'Validée' ? 'Payée' : linkedCommission.status,
        createdAt: linkedCommission.createdAt
      };
      const newCommissions = commissions.map(c => c.id === linkedCommission.id ? updatedCommission : c);
      setCommissions(newCommissions);
      await db.commissions.setItem('data', newCommissions);
      await queueSyncAction('UPDATE_COMMISSION', updatedCommission);
    }
  };

  const deleteSale = async (id: string) => {
    const newSales = sales.filter(s => s.id !== id);
    setSales(newSales);
    await db.sales.setItem('data', newSales);
    await queueSyncAction('DELETE_SALE', { id });

    const linkedInstallments = installments.filter(i => i.saleId === id);
    if (linkedInstallments.length > 0) {
      const newInstallments = installments.filter(i => i.saleId !== id);
      setInstallments(newInstallments);
      await db.installments.setItem('data', newInstallments);
      for (const inst of linkedInstallments) await queueSyncAction('DELETE_INSTALLMENT', { id: inst.id });
    }

    const linkedCommission = commissions.find(c => c.saleId === id);
    if (linkedCommission) {
      const newCommissions = commissions.filter(c => c.id !== linkedCommission.id);
      setCommissions(newCommissions);
      await db.commissions.setItem('data', newCommissions);
      await queueSyncAction('DELETE_COMMISSION', { id: linkedCommission.id });
    }
  };

  const recordInstallmentPayment = async (installmentId: string, amount: number) => {
    const inst = installments.find(i => i.id === installmentId);
    if (!inst || inst.status === 'Payée' || amount <= 0) return;
    const receivedAmount = Math.min(amount, Math.max(0, inst.amount - inst.paidAmount));
    if (receivedAmount <= 0) return;
    const newPaid = inst.paidAmount + receivedAmount;
    const newInst: Installment = {
      ...inst,
      paidAmount: newPaid,
      status: newPaid >= inst.amount ? 'Payée' : 'En attente',
      paidAt: newPaid >= inst.amount ? new Date().toISOString() : inst.paidAt
    };
    const nextInstallments = installments.map(i => i.id === installmentId ? newInst : i);
    setInstallments(nextInstallments);
    await db.installments.setItem('data', nextInstallments);
    await queueSyncAction('UPDATE_INSTALLMENT', newInst);

    const sale = sales.find(s => s.id === inst.saleId);
    if (!sale) return;
    const saleInsts = nextInstallments.filter(i => i.saleId === sale.id);
    const allPaid = saleInsts.length > 0 && saleInsts.every(i => i.status === 'Payée');
    if (sale.status === 'Enregistrée' && allPaid) {
      await updateSaleStatus(sale.id, 'Payée');
    }

    const linkedCommission = commissions.find(c => c.saleId === sale.id);
    if (linkedCommission) {
      const paidAmount = commissionPaidAmount(sale.id, sale.total, linkedCommission.commissionAmount, nextInstallments);
      const status = paidAmount >= linkedCommission.commissionAmount && linkedCommission.status === 'Validée' ? 'Payée' : linkedCommission.status;
      if (paidAmount !== linkedCommission.paidAmount) {
        const updatedComm = { ...linkedCommission, paidAmount, status };
        const newCommissions = commissions.map(c => c.id === linkedCommission.id ? updatedComm : c);
        setCommissions(newCommissions);
        await db.commissions.setItem('data', newCommissions);
        await queueSyncAction('UPDATE_COMMISSION', { id: updatedComm.id, status: updatedComm.status, paidAmount });
      }
    }
  };

  const addCommission = async (commission: Commission) => {
    const commissionId = commission.id.length > 20 ? commission.id : uuidv4();
    const newCommission = { ...commission, id: commissionId };
    const newCommissions = [...commissions, newCommission];
    setCommissions(newCommissions);
    await db.commissions.setItem('data', newCommissions);
    await queueSyncAction('INSERT_COMMISSION', newCommission);
  };

  const updateCommissionStatus = async (id: string, status: Commission['status']) => {
    const commission = commissions.find(c => c.id === id);
    if (!commission) return;
    const newCommission = { ...commission, status };
    const newCommissions = commissions.map(c => c.id === id ? newCommission : c);
    setCommissions(newCommissions);
    await db.commissions.setItem('data', newCommissions);
    await queueSyncAction('UPDATE_COMMISSION', newCommission);
  };

  const deleteCommission = async (id: string) => {
    const newCommissions = commissions.filter(c => c.id !== id);
    setCommissions(newCommissions);
    await db.commissions.setItem('data', newCommissions);
    await queueSyncAction('DELETE_COMMISSION', { id });
  };

  // === COMMERCIAL MODULE ===
  const addProspect = async (prospect: Prospect) => {
    const prospectId = prospect.id.length > 20 ? prospect.id : uuidv4();
    const newProspect = { ...prospect, id: prospectId };
    const newProspects = [...prospects, newProspect];
    setProspects(newProspects);
    await db.prospects.setItem('data', newProspects);
    await queueSyncAction('INSERT_PROSPECT', newProspect);
  };

  const updateProspect = async (id: string, data: Partial<Prospect>) => {
    const newProspects = prospects.map(p => p.id === id ? { ...p, ...data, updatedAt: new Date().toISOString() } : p);
    setProspects(newProspects);
    await db.prospects.setItem('data', newProspects);
    await queueSyncAction('UPDATE_PROSPECT', { id, ...data, updated_at: new Date().toISOString() });
  };

  const deleteProspect = async (id: string) => {
    const newProspects = prospects.filter(p => p.id !== id);
    setProspects(newProspects);
    await db.prospects.setItem('data', newProspects);
    await queueSyncAction('DELETE_PROSPECT', { id });

    const newActivities = prospectActivities.filter(a => a.prospectId !== id);
    if (newActivities.length !== prospectActivities.length) {
      setProspectActivities(newActivities);
      await db.prospectActivities.setItem('data', newActivities);
    }

    const newFollowUps = prospectFollowUps.filter(f => f.prospectId !== id);
    if (newFollowUps.length !== prospectFollowUps.length) {
      setProspectFollowUps(newFollowUps);
      await db.prospectFollowUps.setItem('data', newFollowUps);
    }
  };

  const convertProspect = async (prospectId: string) => {
    const prospect = prospects.find(p => p.id === prospectId);
    if (!prospect) return;
    const newClient: Client = {
      id: uuidv4(),
      name: prospect.name,
      email: prospect.email || '',
      phone: prospect.phone || '',
      contact: prospect.name,
      company: prospect.company || '',
      address: prospect.address || '',
      status: 'Actif',
      commercialId: prospect.commercialId
    };
    await addClient(newClient);
    await updateProspect(prospectId, { status: 'Converti' });
  };

  const addProspectActivity = async (activity: ProspectActivity) => {
    const activityId = activity.id.length > 20 ? activity.id : uuidv4();
    const newActivity = { ...activity, id: activityId };
    const newActivities = [...prospectActivities, newActivity];
    setProspectActivities(newActivities);
    await db.prospectActivities.setItem('data', newActivities);
    await queueSyncAction('INSERT_PROSPECT_ACTIVITY', newActivity);
  };

  const deleteProspectActivity = async (id: string) => {
    const newActivities = prospectActivities.filter(a => a.id !== id);
    setProspectActivities(newActivities);
    await db.prospectActivities.setItem('data', newActivities);
    await queueSyncAction('DELETE_PROSPECT_ACTIVITY', { id });
  };

  const addProspectFollowUp = async (followUp: ProspectFollowUp) => {
    const followUpId = followUp.id.length > 20 ? followUp.id : uuidv4();
    const newFollowUp = { ...followUp, id: followUpId };
    const newFollowUps = [...prospectFollowUps, newFollowUp];
    setProspectFollowUps(newFollowUps);
    await db.prospectFollowUps.setItem('data', newFollowUps);
    await queueSyncAction('INSERT_PROSPECT_FOLLOW_UP', newFollowUp);
  };

  const updateProspectFollowUp = async (id: string, data: Partial<ProspectFollowUp>) => {
    const newFollowUps = prospectFollowUps.map(f => f.id === id ? { ...f, ...data } : f);
    setProspectFollowUps(newFollowUps);
    await db.prospectFollowUps.setItem('data', newFollowUps);
    await queueSyncAction('UPDATE_PROSPECT_FOLLOW_UP', { id, ...data });
  };

  const deleteProspectFollowUp = async (id: string) => {
    const newFollowUps = prospectFollowUps.filter(f => f.id !== id);
    setProspectFollowUps(newFollowUps);
    await db.prospectFollowUps.setItem('data', newFollowUps);
    await queueSyncAction('DELETE_PROSPECT_FOLLOW_UP', { id });
  };

  const upsertActivityReport = async (report: ActivityReport) => {
    const reportId = isUuid(report.id) ? report.id : uuidv4();
    const existing = activityReports.find(r => r.id === reportId);
    const newReport = { ...report, id: reportId, updatedAt: new Date().toISOString() };
    const newReports = existing
      ? activityReports.map(r => r.id === reportId ? newReport : r)
      : [...activityReports, newReport];
    setActivityReports(newReports);
    await db.activityReports.setItem('data', newReports);
    await queueSyncAction(existing ? 'UPDATE_ACTIVITY_REPORT' : 'INSERT_ACTIVITY_REPORT', newReport);
  };

  const deleteActivityReport = async (id: string) => {
    const newReports = activityReports.filter(r => r.id !== id);
    setActivityReports(newReports);
    await db.activityReports.setItem('data', newReports);
    await queueSyncAction('DELETE_ACTIVITY_REPORT', { id });
  };

  const saveWeeklyReport = async (report: WeeklyReport) => {
    const reportId = isUuid(report.id) ? report.id : uuidv4();
    const existing = weeklyReports.find(r => r.id === reportId);
    const newReport = { ...report, id: reportId };
    const newReports = existing
      ? weeklyReports.map(r => r.id === reportId ? newReport : r)
      : [...weeklyReports, newReport];
    setWeeklyReports(newReports);
    await db.weeklyReports.setItem('data', newReports);
    await queueSyncAction(existing ? 'UPDATE_WEEKLY_REPORT' : 'INSERT_WEEKLY_REPORT', newReport);
  };

  const markWeeklyReportSent = async (id: string) => {
    const newReports = weeklyReports.map(r => r.id === id ? { ...r, status: 'Envoyé' as const, sentAt: new Date().toISOString() } : r);
    const target = newReports.find(r => r.id === id);
    setWeeklyReports(newReports);
    await db.weeklyReports.setItem('data', newReports);
    if (target) await queueSyncAction('UPDATE_WEEKLY_REPORT', { id, status: 'Envoyé', sent_at: target.sentAt });
  };

  const markWeeklyReportRead = async (id: string) => {
    const newReports = weeklyReports.map(r => r.id === id ? { ...r, status: 'Relu' as const } : r);
    const target = newReports.find(r => r.id === id);
    setWeeklyReports(newReports);
    await db.weeklyReports.setItem('data', newReports);
    if (target) await queueSyncAction('UPDATE_WEEKLY_REPORT', { id, status: 'Relu' });
  };

  const saveV2DailyReport = async (report: V2DailyReport) => {
    const reportId = isUuid(report.id) ? report.id : uuidv4();
    const existing = v2DailyReports.find(r => r.id === reportId);
    const newReport = { ...report, id: reportId, updatedAt: new Date().toISOString() };
    const newReports = existing
      ? v2DailyReports.map(r => r.id === reportId ? newReport : r)
      : [...v2DailyReports, newReport];
    setV2DailyReports(newReports);
    await db.v2DailyReports.setItem('data', newReports);
    await queueSyncAction(existing ? 'UPDATE_V2_DAILY_REPORT' : 'INSERT_V2_DAILY_REPORT', newReport);
  };

  const saveV2WeeklyReport = async (report: V2WeeklyReport) => {
    const reportId = isUuid(report.id) ? report.id : uuidv4();
    const existing = v2WeeklyReports.find(r => r.id === reportId);
    const newReport = { ...report, id: reportId, updatedAt: new Date().toISOString() };
    const newReports = existing
      ? v2WeeklyReports.map(r => r.id === reportId ? newReport : r)
      : [...v2WeeklyReports, newReport];
    setV2WeeklyReports(newReports);
    await db.v2WeeklyReports.setItem('data', newReports);
    await queueSyncAction(existing ? 'UPDATE_V2_WEEKLY_REPORT' : 'INSERT_V2_WEEKLY_REPORT', newReport);
  };

  const addCategory = async (category: Category) => {
    const categoryId = category.id.length > 20 ? category.id : uuidv4();
    const newCategory = { ...category, id: categoryId };
    const newCategories = [...categories, newCategory];
    setCategories(newCategories);
    await db.categories.setItem('data', newCategories);
    await queueSyncAction('INSERT_CATEGORY', newCategory);
  };

  const deleteCategory = async (id: string) => {
    const newCategories = categories.filter(c => c.id !== id);
    setCategories(newCategories);
    await db.categories.setItem('data', newCategories);
    await queueSyncAction('DELETE_CATEGORY', { id });
  };

  const updateSettings = async (newSettings: AppSettings) => {
    setSettings(newSettings);
    await db.settings.setItem('data', newSettings);
    await queueSyncAction('UPDATE_SETTINGS', newSettings);
  };

  const addPrestation = async (prestation: Prestation) => {
    const newPrestations = [...prestations, { ...prestation, id: prestation.id.length > 20 ? prestation.id : uuidv4() }];
    setPrestations(newPrestations);
    await db.prestations.setItem('data', newPrestations);
    await queueSyncAction('INSERT_PRESTATION', newPrestations[newPrestations.length - 1]);
  };

  const updatePrestation = async (id: string, data: Partial<Prestation>) => {
    const newPrestations = prestations.map(p => p.id === id ? { ...p, ...data } : p);
    setPrestations(newPrestations);
    await db.prestations.setItem('data', newPrestations);
    await queueSyncAction('UPDATE_PRESTATION', { id, ...data });
  };

  const deletePrestation = async (id: string) => {
    const newPrestations = prestations.filter(p => p.id !== id);
    setPrestations(newPrestations);
    await db.prestations.setItem('data', newPrestations);
    await queueSyncAction('DELETE_PRESTATION', { id });
  };

  const addService = async (service: Service) => {
    const newServices = [...services, { ...service, id: service.id.length > 20 ? service.id : uuidv4() }];
    setServices(newServices);
    await db.services.setItem('data', newServices);
    await queueSyncAction('INSERT_SERVICE', newServices[newServices.length - 1]);
  };

  const updateService = async (id: string, service: Partial<Service>) => {
    const newServices = services.map(s => s.id === id ? { ...s, ...service } : s);
    setServices(newServices);
    await db.services.setItem('data', newServices);
    await queueSyncAction('UPDATE_SERVICE', { id, name: service.name, description: service.description, members: service.members });
  };

  const deleteService = async (id: string) => {
    const newServices = services.filter(s => s.id !== id);
    setServices(newServices);
    await db.services.setItem('data', newServices);
    await queueSyncAction('DELETE_SERVICE', { id });
  };

  // === POS CRUD ===
  const addPosCategory = async (cat: PosCategory) => {
    const newCat = { ...cat, id: cat.id || uuidv4() };
    const newList = [...posCategories, newCat];
    setPosCategories(newList);
    await db.posCategories.setItem('data', newList);
    await queueSyncAction('INSERT_POS_CATEGORY', newCat);
  };
  const updatePosCategory = async (id: string, data: Partial<PosCategory>) => {
    const newList = posCategories.map(c => c.id === id ? { ...c, ...data } : c);
    setPosCategories(newList);
    await db.posCategories.setItem('data', newList);
    await queueSyncAction('UPDATE_POS_CATEGORY', { id, ...data });
  };
  const deletePosCategory = async (id: string) => {
    const newList = posCategories.filter(c => c.id !== id);
    setPosCategories(newList);
    await db.posCategories.setItem('data', newList);
    await queueSyncAction('DELETE_POS_CATEGORY', { id });
  };

  const addPosBrand = async (brand: PosBrand) => {
    const newBrand = { ...brand, id: brand.id || uuidv4() };
    const newList = [...posBrands, newBrand];
    setPosBrands(newList);
    await db.posBrands.setItem('data', newList);
    await queueSyncAction('INSERT_POS_BRAND', newBrand);
  };
  const updatePosBrand = async (id: string, data: Partial<PosBrand>) => {
    const newList = posBrands.map(b => b.id === id ? { ...b, ...data } : b);
    setPosBrands(newList);
    await db.posBrands.setItem('data', newList);
    await queueSyncAction('UPDATE_POS_BRAND', { id, ...data });
  };
  const deletePosBrand = async (id: string) => {
    const newList = posBrands.filter(b => b.id !== id);
    setPosBrands(newList);
    await db.posBrands.setItem('data', newList);
    await queueSyncAction('DELETE_POS_BRAND', { id });
  };

  const addPosSupplier = async (supplier: PosSupplier) => {
    const newSupplier = { ...supplier, id: supplier.id || uuidv4() };
    const newList = [...posSuppliers, newSupplier];
    setPosSuppliers(newList);
    await db.posSuppliers.setItem('data', newList);
    await queueSyncAction('INSERT_POS_SUPPLIER', newSupplier);
  };
  const updatePosSupplier = async (id: string, data: Partial<PosSupplier>) => {
    const newList = posSuppliers.map(s => s.id === id ? { ...s, ...data } : s);
    setPosSuppliers(newList);
    await db.posSuppliers.setItem('data', newList);
    await queueSyncAction('UPDATE_POS_SUPPLIER', { id, ...data });
  };
  const deletePosSupplier = async (id: string) => {
    const newList = posSuppliers.filter(s => s.id !== id);
    setPosSuppliers(newList);
    await db.posSuppliers.setItem('data', newList);
    await queueSyncAction('DELETE_POS_SUPPLIER', { id });
  };

  const addPosProduct = async (product: PosProduct) => {
    const newProduct = { ...product, id: product.id || uuidv4() };
    setPosProducts(prev => {
      const next = [...prev, newProduct];
      void db.posProducts.setItem('data', next);
      return next;
    });
    await queueSyncAction('INSERT_POS_PRODUCT', newProduct);
  };
  const updatePosProduct = async (id: string, data: Partial<PosProduct>) => {
    const oldProduct = posProducts.find(p => p.id === id);
    if (oldProduct && data.quantity !== undefined && data.quantity !== oldProduct.quantity) {
      await addPosStockMovement({
        productId: id,
        type: 'Ajustement Manuel',
        quantity: data.quantity - oldProduct.quantity,
        createdBy: currentUser?.name,
        notes: 'Modification manuelle'
      });
    }
    setPosProducts(prev => {
      const next = prev.map(p => p.id === id ? { ...p, ...data } : p);
      void db.posProducts.setItem('data', next);
      return next;
    });
    await queueSyncAction('UPDATE_POS_PRODUCT', { id, ...data });
  };
  const deletePosProduct = async (id: string) => {
    const newList = posProducts.filter(p => p.id !== id);
    setPosProducts(newList);
    await db.posProducts.setItem('data', newList);
    await queueSyncAction('DELETE_POS_PRODUCT', { id });
  };

  // === Catalogue central : mêmes produits que le POS ===
  const findProductByBarcode = (barcode: string) =>
    posProducts.find(p => !!p.barcode && p.barcode === barcode);

  const findProductByReference = (reference: string) =>
    posProducts.find(p => p.reference === reference);

  const searchProducts = (query: string) => {
    const q = (query || '').toLowerCase();
    if (!q) return posProducts;
    return posProducts.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.reference.toLowerCase().includes(q) ||
      (p.barcode || '').includes(q) ||
      (p.isbn || '').includes(q)
    );
  };

  const getIncompleteProducts = () =>
    posProducts.filter(p => !isProductComplete(p));

  const updateProductBarcode = async (id: string, barcode: string | null) => {
    await updatePosProduct(id, { barcode: barcode || undefined });
  };

  const updateProductImage = async (id: string, imageUrl: string | null) => {
    await updatePosProduct(id, { imageUrl: imageUrl || undefined });
  };

  const importProducts = async (products: PosProduct[], duplicates: 'ignore' | 'update' | 'create' = 'update') => {
    productService.setProducts(posProducts);
    const persistence: ProductPersistence = {
      create: async (product) => { await addPosProduct(product); },
      update: async (id, data) => { await updatePosProduct(id, data); },
      remove: async (id) => { await deletePosProduct(id); },
    };
    const entries = products.map(p => ({
      name: p.name,
      reference: p.reference,
      barcode: p.barcode || undefined,
      isbn: p.isbn || undefined,
      family: p.family,
      purchasePrice: p.purchasePrice,
      sellingPrice: p.sellingPrice,
      quantity: p.quantity,
      categoryId: p.categoryId || undefined,
      brandId: p.brandId || undefined,
      supplierId: p.supplierId || undefined,
      imageUrl: p.imageUrl || undefined,
      minStock: p.minStock,
    }));
    const result = await productService.importProducts(entries, persistence, () => duplicates);
    productService.setProducts(posProducts);
    return result;
  };

  const addPosStockEntry = async (entry: PosStockEntry) => {
    const newEntry = { ...entry, id: entry.id || uuidv4(), lines: entry.lines.map(l => ({ ...l, id: l.id || uuidv4() })) };
    const newList = [...posStockEntries, newEntry];
    setPosStockEntries(newList);
    await db.posStockEntries.setItem('data', newList);
    await queueSyncAction('INSERT_POS_STOCK_ENTRY', newEntry);

    if (newEntry.status === 'Validé') {
      await adjustProductStock(newEntry.lines.map(l => ({ productId: l.productId, quantity: l.quantity })), false, { type: 'Approvisionnement', reference: newEntry.reference, createdBy: newEntry.createdBy });
    }
  };

  const updatePosStockEntry = async (id: string, data: Partial<PosStockEntry>) => {
    const oldEntry = posStockEntries.find(e => e.id === id);
    const newList = posStockEntries.map(e => e.id === id ? { ...e, ...data } : e);
    setPosStockEntries(newList);
    await db.posStockEntries.setItem('data', newList);
    await queueSyncAction('UPDATE_POS_STOCK_ENTRY', { id, ...data });

    if (oldEntry && oldEntry.status !== 'Validé' && data.status === 'Validé') {
      const entryLines = data.lines || oldEntry.lines;
      await adjustProductStock(entryLines.map(l => ({ productId: l.productId, quantity: l.quantity })), false, { type: 'Approvisionnement', reference: oldEntry.reference, createdBy: currentUser?.name });
    } else if (oldEntry && oldEntry.status === 'Validé' && data.status === 'Annulé') {
      const entryLines = data.lines || oldEntry.lines;
      await adjustProductStock(entryLines.map(l => ({ productId: l.productId, quantity: -l.quantity })), false, { type: 'Approvisionnement', reference: oldEntry.reference, createdBy: currentUser?.name, notes: 'Annulation' });
    }
  };
  const deletePosStockEntry = async (id: string) => {
    const newList = posStockEntries.filter(e => e.id !== id);
    setPosStockEntries(newList);
    await db.posStockEntries.setItem('data', newList);
    await queueSyncAction('DELETE_POS_STOCK_ENTRY', { id });
  };

  const addPosInventory = async (inventory: PosInventory) => {
    const newInv = { ...inventory, id: inventory.id || uuidv4(), lines: inventory.lines.map(l => ({ ...l, id: l.id || uuidv4() })) };
    const newList = [...posInventories, newInv];
    setPosInventories(newList);
    await db.posInventories.setItem('data', newList);
    await queueSyncAction('INSERT_POS_INVENTORY', newInv);

    if (newInv.status === 'Terminé') {
      await adjustProductStock(newInv.lines.map(l => ({ productId: l.productId, quantity: l.difference })), true, { type: 'Inventaire', reference: newInv.reference, createdBy: newInv.createdBy });
    }
  };

  const updatePosInventory = async (id: string, data: Partial<PosInventory>) => {
    const oldInv = posInventories.find(i => i.id === id);
    const newList = posInventories.map(i => i.id === id ? { ...i, ...data } : i);
    setPosInventories(newList);
    await db.posInventories.setItem('data', newList);
    await queueSyncAction('UPDATE_POS_INVENTORY', { id, ...data });

    if (oldInv && oldInv.status !== 'Terminé' && data.status === 'Terminé') {
      const invLines = data.lines || oldInv.lines;
      await adjustProductStock(invLines.map(l => ({ productId: l.productId, quantity: l.difference })), true, { type: 'Inventaire', reference: oldInv.reference, createdBy: currentUser?.name });
    }
  };
  const deletePosInventory = async (id: string) => {
    const newList = posInventories.filter(i => i.id !== id);
    setPosInventories(newList);
    await db.posInventories.setItem('data', newList);
    await queueSyncAction('DELETE_POS_INVENTORY', { id });
  };

  const addPosCashSession = async (session: PosCashSession) => {
    if (session.status === 'Ouverte' && posCashSessions.some(s => s.status === 'Ouverte')) {
      alert('Une session de caisse est déjà ouverte. Fermez-la avant d\'en ouvrir une nouvelle.');
      return;
    }
    const newSession = { ...session, id: session.id || uuidv4() };
    const newList = [...posCashSessions, newSession];
    setPosCashSessions(newList);
    await db.posCashSessions.setItem('data', newList);
    await queueSyncAction('INSERT_POS_CASH_SESSION', newSession);
  };
  const updatePosCashSession = async (id: string, data: Partial<PosCashSession>) => {
    const newList = posCashSessions.map(s => s.id === id ? { ...s, ...data } : s);
    setPosCashSessions(newList);
    await db.posCashSessions.setItem('data', newList);
    await queueSyncAction('UPDATE_POS_CASH_SESSION', { id, ...data });
  };

  const addPosStockMovement = async (movement: Omit<PosStockMovement, 'id' | 'date'>) => {
    const newMovement: PosStockMovement = {
      ...movement,
      id: uuidv4(),
      date: new Date().toISOString()
    };
    const newList = [...posStockMovements, newMovement];
    setPosStockMovements(newList);
    await db.posStockMovements.setItem('data', newList);
    await queueSyncAction('INSERT_POS_STOCK_MOVEMENT', newMovement);
  };

  // Applique des variations de stock (delta +/- par produit) sur l'état local et le cache.
  // Cumule correctement les lignes d'un même produit (pas de relecture d'un état stale).
  // Si pushSync est vrai, synchronise aussi le stock serveur via UPDATE_POS_PRODUCT.
  // Si movementParams est fourni, génère un mouvement de stock pour chaque delta.
  const adjustProductStock = async (
    deltas: { productId?: string; quantity: number }[],
    pushSync: boolean,
    movementParams?: { type: PosStockMovement['type']; reference?: string; createdBy?: string; notes?: string }
  ) => {
    const map = new Map<string, number>();
    for (const d of deltas) {
      if (!d.productId) continue;
      map.set(d.productId, (map.get(d.productId) || 0) + d.quantity);
    }
    if (map.size === 0) return;
    
    if (movementParams) {
      for (const [pid, delta] of map) {
        await addPosStockMovement({
          productId: pid,
          type: movementParams.type,
          quantity: delta,
          reference: movementParams.reference,
          createdBy: movementParams.createdBy,
          notes: movementParams.notes
        });
      }
    }

    const updatedProducts = posProducts.map(p => {
      const delta = map.get(p.id);
      return delta ? { ...p, quantity: Math.max(0, p.quantity + delta) } : p;
    });
    setPosProducts(updatedProducts);
    await db.posProducts.setItem('data', updatedProducts);
    if (pushSync) {
      for (const [pid] of map) {
        const product = updatedProducts.find(p => p.id === pid);
        if (product) {
          await queueSyncAction('UPDATE_POS_PRODUCT', { id: pid, quantity: product.quantity });
        }
      }
    }
  };

  // Recalcule le statut d'une transaction selon ses retours actifs (non annulés).
  // Retournée uniquement si toutes les quantités ont été retournées, sinon Validée.
  const recomputeTransactionStatus = async (transactionId: string) => {
    const tx = posTransactions.find(t => t.id === transactionId);
    if (!tx || tx.status === 'Annulée') return;
    const activeReturns = posReturns.filter(r => r.transactionId === transactionId && r.status !== 'Annulé');
    if (activeReturns.length === 0) {
      if (tx.status !== 'Validée') await updatePosTransaction(transactionId, { status: 'Validée' });
      return;
    }
    const returnedQty = new Map<string, number>();
    for (const r of activeReturns) {
      for (const line of r.lines) {
        if (line.productId) {
          returnedQty.set(line.productId, (returnedQty.get(line.productId) || 0) + line.quantity);
        }
      }
    }
    const fullyReturned = tx.lines.every(l => {
      if (!l.productId) return true;
      return (returnedQty.get(l.productId) || 0) >= l.quantity;
    });
    const newStatus: PosTransaction['status'] = fullyReturned ? 'Retournée' : 'Validée';
    if (tx.status !== newStatus) await updatePosTransaction(transactionId, { status: newStatus });
  };

  const addPosTransaction = async (tx: PosTransaction) => {
    const newTx = { ...tx, id: tx.id || uuidv4(), lines: tx.lines.map(l => ({ ...l, id: l.id || uuidv4() })), payments: tx.payments.map(p => ({ ...p, id: p.id || uuidv4() })) };
    const newList = [...posTransactions, newTx];
    setPosTransactions(newList);
    await db.posTransactions.setItem('data', newList);
    await queueSyncAction('INSERT_POS_TRANSACTION', newTx);
    // Alimenter le registre local des paiements (répartition Finance à jour immédiatement)
    const newPayments = [...posPayments, ...newTx.payments.map(p => ({ ...p, transactionId: newTx.id }))];
    setPosPayments(newPayments);
    await db.posPayments.setItem('data', newPayments);
    // Update local product quantities (le serveur est décrémenté par INSERT_POS_TRANSACTION)
    await adjustProductStock(newTx.lines.map(l => ({ productId: l.productId, quantity: -l.quantity })), false, { type: 'Vente', reference: newTx.transactionNumber, createdBy: currentUser?.name });
  };
  const updatePosTransaction = async (id: string, data: Partial<PosTransaction>) => {
    const newList = posTransactions.map(t => t.id === id ? { ...t, ...data } : t);
    setPosTransactions(newList);
    await db.posTransactions.setItem('data', newList);
    await queueSyncAction('UPDATE_POS_TRANSACTION', { id, ...data });
  };

  // Annulation d'une vente validée (void) : passe en 'Annulée', restaure le stock local + serveur.
  // Ne restaure que la quantité non déjà retournée (évite la double restauration après un retour partiel).
  const voidPosTransaction = async (id: string) => {
    const tx = posTransactions.find(t => t.id === id);
    if (!tx || tx.status !== 'Validée') return;
    const returnedQty = new Map<string, number>();
    for (const r of posReturns) {
      if (r.transactionId === id && r.status !== 'Annulé') {
        for (const line of r.lines) {
          if (line.productId) returnedQty.set(line.productId, (returnedQty.get(line.productId) || 0) + line.quantity);
        }
      }
    }
    await updatePosTransaction(id, { status: 'Annulée' });
    const deltas = tx.lines
      .map(l => ({ productId: l.productId, quantity: Math.max(0, l.quantity - (l.productId ? (returnedQty.get(l.productId) || 0) : 0)) }))
      .filter(d => d.productId && d.quantity > 0);
    await adjustProductStock(deltas, true, { type: 'Retour', reference: tx.transactionNumber, createdBy: currentUser?.name, notes: 'Annulation' });
  };

  const addPosDiscount = async (discount: PosDiscount) => {
    const newDiscount = { ...discount, id: discount.id || uuidv4() };
    const newList = [...posDiscounts, newDiscount];
    setPosDiscounts(newList);
    await db.posDiscounts.setItem('data', newList);
    await queueSyncAction('INSERT_POS_DISCOUNT', newDiscount);
  };
  const updatePosDiscount = async (id: string, data: Partial<PosDiscount>) => {
    const newList = posDiscounts.map(d => d.id === id ? { ...d, ...data } : d);
    setPosDiscounts(newList);
    await db.posDiscounts.setItem('data', newList);
    await queueSyncAction('UPDATE_POS_DISCOUNT', { id, ...data });
  };
  const deletePosDiscount = async (id: string) => {
    const newList = posDiscounts.filter(d => d.id !== id);
    setPosDiscounts(newList);
    await db.posDiscounts.setItem('data', newList);
    await queueSyncAction('DELETE_POS_DISCOUNT', { id });
  };

  const updatePosSettings = async (newSettings: PosSettings) => {
    setPosSettingsState(newSettings);
    await db.posSettings.setItem('data', newSettings);
    await queueSyncAction('UPDATE_POS_SETTINGS', newSettings);
  };

  const addPosReturn = async (ret: PosReturn) => {
    const newReturn = { 
      ...ret, 
      id: ret.id || uuidv4(), 
      lines: ret.lines.map(l => ({ ...l, id: l.id || uuidv4() })),
      exchangeLines: ret.exchangeLines?.map(l => ({ ...l, id: l.id || uuidv4() }))
    };
    const newList = [...posReturns, newReturn];
    setPosReturns(newList);
    await db.posReturns.setItem('data', newList);
    await queueSyncAction('INSERT_POS_RETURN', newReturn);
    
    // Restore product quantities for returned items (stock + qty)
    await adjustProductStock(newReturn.lines.map(l => ({ productId: l.productId, quantity: l.quantity })), false);
    
    // Deduct product quantities for exchanged items (stock - qty)
    if (newReturn.exchangeLines && newReturn.exchangeLines.length > 0) {
      await adjustProductStock(newReturn.exchangeLines.map(l => ({ productId: l.productId, quantity: -l.quantity })), false);
    }

    // Marquer la transaction 'Retournée' ou 'Retour partiel'
    if (newReturn.transactionId) {
      await recomputeTransactionStatus(newReturn.transactionId);
    }
  };
  const updatePosReturn = async (id: string, data: Partial<PosReturn>) => {
    const newList = posReturns.map(r => r.id === id ? { ...r, ...data } : r);
    setPosReturns(newList);
    await db.posReturns.setItem('data', newList);
    await queueSyncAction('UPDATE_POS_RETURN', { id, ...data });
  };

  // Annulation d'un retour : statut 'Annulé', ré-injecte le stock (local + serveur), recalcule la transaction
  const cancelPosReturn = async (id: string) => {
    const ret = posReturns.find(r => r.id === id);
    if (!ret || ret.status === 'Annulé') return;
    
    await updatePosReturn(id, { status: 'Annulé' });
    const tx = ret.transactionId ? posTransactions.find(t => t.id === ret.transactionId) : undefined;
    
    // Inverser les stocks si la transaction n'est pas complètement annulée par ailleurs
    if (!tx || tx.status !== 'Annulée') {
      // Les articles retournés repartent (stock -)
      await adjustProductStock(ret.lines.map(l => ({ productId: l.productId, quantity: -l.quantity })), false);
      
      // Les articles échangés reviennent (stock +)
      if (ret.exchangeLines && ret.exchangeLines.length > 0) {
        await adjustProductStock(ret.exchangeLines.map(l => ({ productId: l.productId, quantity: l.quantity })), false);
      }
    }

    if (ret.transactionId) {
      await recomputeTransactionStatus(ret.transactionId);
    }
  };

  // Product Module CRUD
  const addProductCompletion = async (completion: ProductCompletion) => {
    const newCompletion = { ...completion, id: completion.id || uuidv4() };
    const newList = [...productCompletions, newCompletion];
    setProductCompletions(newList);
    await db.productCompletions.setItem('data', newList);
    await queueSyncAction('INSERT_PRODUCT_COMPLETION', newCompletion);
  };
  const updateProductCompletion = async (id: string, data: Partial<ProductCompletion>) => {
    const newList = productCompletions.map(c => c.id === id ? { ...c, ...data } : c);
    setProductCompletions(newList);
    await db.productCompletions.setItem('data', newList);
    await queueSyncAction('UPDATE_PRODUCT_COMPLETION', { id, ...data });
  };
  const deleteProductCompletion = async (id: string) => {
    const newList = productCompletions.filter(c => c.id !== id);
    setProductCompletions(newList);
    await db.productCompletions.setItem('data', newList);
    await queueSyncAction('DELETE_PRODUCT_COMPLETION', { id });
  };

  const addImportSession = async (session: ImportSession) => {
    setImportSessions(prev => {
      const next = [...prev, session];
      void db.importSessions.setItem('data', next);
      return next;
    });
    await queueSyncAction('INSERT_IMPORT_SESSION', session);
  };
  const updateImportSession = async (id: string, data: Partial<ImportSession>) => {
    setImportSessions(prev => {
      const next = prev.map(s => s.id === id ? { ...s, ...data } : s);
      void db.importSessions.setItem('data', next);
      return next;
    });
    await queueSyncAction('UPDATE_IMPORT_SESSION', { id, ...data });
  };
  const deleteImportSession = async (id: string) => {
    const newList = importSessions.filter(s => s.id !== id);
    setImportSessions(newList);
    await db.importSessions.setItem('data', newList);
    await queueSyncAction('DELETE_IMPORT_SESSION', { id });
  };

  const addImportError = async (error: ImportError) => {
    const existing = await db.importErrors.getItem<ImportError[]>('data');
    const next = existing ? [...existing, error] : [error];
    await db.importErrors.setItem('data', next);
    await queueSyncAction('INSERT_IMPORT_ERROR', error);
  };

  const completeProduct = async (productId: string, updates: Partial<PosProduct>) => {
    const updatedProducts = posProducts.map(p => p.id === productId ? { ...p, ...updates } : p);
    setPosProducts(updatedProducts);
    await db.posProducts.setItem('data', updatedProducts);
    await queueSyncAction('UPDATE_POS_PRODUCT', { id: productId, ...updates });
    // Remove related product completions (local + serveur)
    const removedCompletions = productCompletions.filter(c => c.productId === productId);
    const remainingCompletions = productCompletions.filter(c => c.productId !== productId);
    setProductCompletions(remainingCompletions);
    await db.productCompletions.setItem('data', remainingCompletions);
    for (const c of removedCompletions) {
      await queueSyncAction('DELETE_PRODUCT_COMPLETION', { id: c.id });
    }
  };

  // Création d'utilisateur via Edge Function (service_role) pour ne pas écraser la session du Directeur
  const addUser = async (user: User) => {
    if (!navigator.onLine) { alert("Vous devez être en ligne pour créer un utilisateur."); return; }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { alert('Session expirée. Veuillez vous reconnecter.'); return; }

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          email: user.email,
          pin: user.pin,
          name: user.name,
          role: user.role,
          posRole: user.posRole || null,
          serviceId: user.serviceId || null,
          posReturnsEnabled: user.posReturnsEnabled,
          posCatalogueEnabled: user.posCatalogueEnabled
        }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      alert(`Erreur : ${result.error || 'Impossible de créer l\'utilisateur.'}`);
      return;
    }

    // Ajouter le nouvel utilisateur à l'état local et au cache
    const newUser: User = {
      id: result.id,
      name: result.name,
      email: result.email,
      role: result.role,
      serviceId: result.serviceId,
      pin: user.pin,
      lastLogin: 'Jamais',
      active: true,
      posReturnsEnabled: user.posReturnsEnabled,
      posCatalogueEnabled: user.posCatalogueEnabled,
      posRole: user.posRole || null
    };
    const newUsers = [...users, newUser];
    setUsers(newUsers);
    await db.profiles.setItem('data', newUsers);
  };

  const updateUser = async (id: string, data: Pick<User, 'name' | 'role' | 'posRole' | 'serviceId' | 'posReturnsEnabled' | 'posCatalogueEnabled' | 'posSupplyEnabled' | 'posInventoryEnabled' | 'posStockEnabled'>) => {
    const newUsers = users.map(u => u.id === id ? { ...u, ...data } : u);
    setUsers(newUsers);
    await db.profiles.setItem('data', newUsers);
    await queueSyncAction('UPDATE_PROFILE', { 
      id, 
      name: data.name, 
      role: data.role, 
      pos_role: data.posRole || null,
      service_id: data.serviceId || null,
      pos_returns_enabled: data.posReturnsEnabled,
      pos_catalogue_enabled: data.posCatalogueEnabled,
      pos_supply_enabled: data.posSupplyEnabled,
      pos_inventory_enabled: data.posInventoryEnabled,
      pos_stock_enabled: data.posStockEnabled
    });
  };

  const updateMyProfile = async (data: Partial<Pick<User, 'photo' | 'name'>>) => {
    if (!currentUser) return;
    const newUsers = users.map(u => u.id === currentUser.id ? { ...u, ...data } : u);
    setUsers(newUsers);
    await db.profiles.setItem('data', newUsers);
    await queueSyncAction('UPDATE_PROFILE', { id: currentUser.id, ...(data.photo !== undefined ? { photo: data.photo } : {}), ...(data.name !== undefined ? { name: data.name } : {}) });
  };

  const toggleUserStatus = async (id: string) => {
    const targetUser = users.find(u => u.id === id);
    if (!targetUser) return;
    const updatedActive = !targetUser.active;
    const newUsers = users.map(u => u.id === id ? { ...u, active: updatedActive } : u);
    setUsers(newUsers);
    await db.profiles.setItem('data', newUsers);
    await queueSyncAction('UPDATE_PROFILE', { id, active: updatedActive });
  };

  const deleteUser = async (id: string, callback?: () => void) => {
    const newUsers = users.filter(u => u.id !== id);
    setUsers(newUsers);
    await db.profiles.setItem('data', newUsers);
    await queueSyncAction('DELETE_PROFILE', { id });
    if (typeof callback === 'function') callback();
  };

  const addSuspendedCart = useCallback((cart: SuspendedCart) => {
    setSuspendedCarts(prev => [...prev, cart]);
  }, []);

  const addCrmDocument = async (file: File, uploaderId?: string, folderId?: string) => {
    const id = uuidv4();
    const newDoc: CrmDocument = {
      id,
      name: file.name,
      type: file.type || 'Inconnu',
      sizeBytes: file.size,
      filePath: `local-fake-path/${file.name}`,
      uploaderId,
      folderId,
      createdAt: new Date().toISOString()
    };
    const newDocs = [newDoc, ...crmDocuments];
    setCrmDocuments(newDocs);
    await db.documents.setItem('data', newDocs);
    await db.documentFiles.setItem(id, file);
    await queueSyncAction('INSERT_DOCUMENT', newDoc);
  };

  const deleteCrmDocument = async (id: string) => {
    const doc = crmDocuments.find(d => d.id === id);
    if (!doc) return;
    const newDocs = crmDocuments.filter(d => d.id !== id);
    setCrmDocuments(newDocs);
    await db.documents.setItem('data', newDocs);
    await db.documentFiles.removeItem(id);
    await queueSyncAction('DELETE_DOCUMENT', { id, filePath: doc.filePath });
  };

  const addCrmFolder = async (name: string, ownerId: string, parentId?: string) => {
    const newFolder: CrmFolder = {
      id: uuidv4(),
      name,
      ownerId,
      parentId,
      createdAt: new Date().toISOString()
    };
    const newFolders = [...crmFolders, newFolder];
    setCrmFolders(newFolders);
    await db.crmFolders.setItem('data', newFolders);
  };

  const updateCrmFolder = async (id: string, data: Partial<CrmFolder>) => {
    const newFolders = crmFolders.map(f => f.id === id ? { ...f, ...data } : f);
    setCrmFolders(newFolders);
    await db.crmFolders.setItem('data', newFolders);
  };

  const deleteCrmFolder = async (id: string) => {
    const newFolders = crmFolders.filter(f => f.id !== id);
    setCrmFolders(newFolders);
    await db.crmFolders.setItem('data', newFolders);
    
    const updatedDocs = crmDocuments.map(d => d.folderId === id ? { ...d, folderId: undefined } : d);
    setCrmDocuments(updatedDocs);
    await db.documents.setItem('data', updatedDocs);
  };

  const markNotificationAsRead = async (id: string) => {
    const target = notifications.find(n => n.id === id);
    if (!target || target.is_read) return;
    const newNotifications = notifications.map(n => n.id === id ? { ...n, is_read: true } : n);
    setNotifications(newNotifications);
    await db.notifications.setItem('data', newNotifications);
    await queueSyncAction('MARK_NOTIFICATION_READ', { id });
  };

  const markAllNotificationsAsRead = async () => {
    if (!currentUser) return;
    let changed = false;
    const newNotifications = notifications.map(n => {
      if (n.user_id === currentUser.id && !n.is_read) {
        changed = true;
        return { ...n, is_read: true };
      }
      return n;
    });
    if (!changed) return;
    setNotifications(newNotifications);
    await db.notifications.setItem('data', newNotifications);
    await queueSyncAction('MARK_ALL_NOTIFICATIONS_READ', { user_id: currentUser.id });
  };

  const downloadCrmDocument = async (doc: CrmDocument) => {
    let blob = await db.documentFiles.getItem<Blob>(doc.id);
    if (!blob) {
      const { data, error } = await supabase.storage.from('crm_documents').download(doc.filePath);
      if (error || !data) {
        console.error('Download error:', error);
        alert('Impossible de télécharger ce document.');
        return;
      }
      blob = data;
      await db.documentFiles.setItem(doc.id, blob);
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const removeSuspendedCart = useCallback((id: string) => {
    setSuspendedCarts(prev => prev.filter(c => c.id !== id));
  }, []);

  return (
    <AppContext.Provider value={{ users, clients, quotes, sales, commissions, installments, prospects, prospectActivities, prospectFollowUps, categories, settings, services, prestations, loading, activityReports, weeklyReports, v2DailyReports, v2WeeklyReports, notifications, crmDocuments, crmFolders, posCategories, posBrands, posSuppliers, posProducts, posStockEntries, posStockMovements, posInventories, posCashSessions, posTransactions, posPayments, posDiscounts, posSettings, posReturns, posWorkspace, setPosWorkspace, suspendedCarts, addSuspendedCart, removeSuspendedCart, addClient, updateClient, deleteClient, addQuote, updateQuote, updateQuoteStatus, deleteQuote, addSale, updateSaleStatus, updateSale, deleteSale, recordInstallmentPayment, saveInstallmentsForSale, addCommission, updateCommissionStatus, deleteCommission, addProspect, updateProspect, deleteProspect, convertProspect, addProspectActivity, deleteProspectActivity, addProspectFollowUp, updateProspectFollowUp, deleteProspectFollowUp, upsertActivityReport, deleteActivityReport, saveWeeklyReport, markWeeklyReportSent, markWeeklyReportRead, markNotificationAsRead, markAllNotificationsAsRead, saveV2DailyReport, saveV2WeeklyReport, updateMyProfile, addCrmDocument, deleteCrmDocument, downloadCrmDocument, addCrmFolder, updateCrmFolder, deleteCrmFolder, addCategory, deleteCategory, updateSettings, addUser, updateUser, toggleUserStatus, deleteUser, addPrestation, updatePrestation, deletePrestation, addService, updateService, deleteService, addPosCategory, updatePosCategory, deletePosCategory, addPosBrand, updatePosBrand, deletePosBrand, addPosSupplier, updatePosSupplier, deletePosSupplier, addPosProduct, updatePosProduct, deletePosProduct, findProductByBarcode, findProductByReference, searchProducts, getIncompleteProducts, updateProductBarcode, updateProductImage, importProducts, addPosStockEntry, updatePosStockEntry, deletePosStockEntry, addPosStockMovement, addPosInventory, updatePosInventory, deletePosInventory, addPosCashSession, updatePosCashSession, addPosTransaction, updatePosTransaction, voidPosTransaction, addPosDiscount, updatePosDiscount, deletePosDiscount, updatePosSettings, addPosReturn, updatePosReturn, cancelPosReturn, productCompletions, importSessions, addProductCompletion, updateProductCompletion, deleteProductCompletion, addImportSession, updateImportSession, deleteImportSession, addImportError, completeProduct, refreshData }}>
      {children}
    </AppContext.Provider>
  );
}

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext must be used within an AppProvider');
  return context;
};
