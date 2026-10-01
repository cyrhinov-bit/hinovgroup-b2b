import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { db } from '../lib/db';
import { queueSyncAction, processSyncQueue, reconcileLocalPosDataWithCloud, reconcileAllOfflineDataWithCloud, resolveProductUuid, isRetiredServicePayload } from '../lib/sync';
import { v4 as uuidv4 } from 'uuid';
import toast from 'react-hot-toast';
import { isProductComplete } from '../features/products/services/ProductService';
import type { ProductPersistence } from '../features/products/data/repositories/ProductRepository';
import { productService } from '../features/products/services/ProductService';
import { toLocalDayKey } from '../lib/dates';

const isUuid = (value?: string) => !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

const mergeData = <T extends { id: string }>(oldData: T[] | null | undefined, newData: T[]): T[] => {
  if (!oldData || oldData.length === 0) return newData || [];
  if (!newData || newData.length === 0) return oldData;
  const map = new Map(oldData.map(item => [item.id, item]));
  for (const item of newData) {
    const existing = map.get(item.id);
    if (existing) {
      map.set(item.id, { ...existing, ...item });
    } else {
      map.set(item.id, item);
    }
  }
  return Array.from(map.values());
};

import type { 
  ClientFournisseur, AgentCommercial, PrestationCommande, 
  MouvementCaisse, CommissionPrestation, CatalogueArticle, 
  InterventionMaintenance, TechnicienMaintenance, ModeReglement,
  Invoice, InvoiceItem, InvoicePayment, InvoiceStatus
} from '../types/crmModules';
export * from '../types/crmModules';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'Directeur' | 'Directeur adjoint' | 'Responsable' | 'Commercial' | 'Caissier' | 'Gerant' | 'SuperAdmin';
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
  geminiApiKey?: string;
  // CRM Modules Responsables Permissions
  crmPrestationsEnabled?: boolean;
  crmCaisseEnabled?: boolean;
  crmMaintenanceEnabled?: boolean;
  crmStocksEnabled?: boolean;
  crmTiersEnabled?: boolean;
  crmCommerciauxEnabled?: boolean;
  crmCommissionsEnabled?: boolean;
  crmFacturationEnabled?: boolean;
  crmReportsEnabled?: boolean;
}
export type AffaireStatus = 'PROSPECTION' | 'QUALIFIEE' | 'PROPOSITION' | 'NEGOCIATION' | 'GAGNEE' | 'EN_COURS' | 'CLOTUREE' | 'PERDUE' | 'ANNULEE';
export interface Affaire {
  id: string;
  reference: string;
  title: string;
  clientId: string;
  serviceId: string;
  commercialId: string;
  description?: string;
  status: AffaireStatus;
  estimatedAmountHt: number;
  probability: number;
  source?: string;
  startDatePlanned?: string;
  endDatePlanned?: string;
  endDateReal?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}
export interface Client { id: string; name: string; email: string; phone: string; contact: string; company: string; address: string; status?: string; commercialId?: string; serviceId?: string; createdAt?: string; }
export interface Service { id: string; name: string; description: string; members?: number; managerId?: string; commissionRate?: number; }
export interface Category { id: string; serviceId: string; name: string; }
export interface Prestation { id: string; code: string; name: string; description: string; price: number; serviceId: string; unit?: string; costPrice?: number; }
export interface QuoteLine { id: string; prestationId: string; description: string; quantity: number; unit?: string; unitPrice: number; total: number; discountPercent?: number; costPrice?: number; }
export interface Quote { id: string; quoteNumber: string; clientId: string; commercialId: string; serviceId?: string; affaireId?: string; subject: string; lines: QuoteLine[]; subtotal: number; total: number; status: 'Brouillon' | 'Envoyé' | 'Accepté' | 'Refusé' | 'Révision'; date: string; validUntil?: string; paymentTerms?: string; notes?: string; signatoryName?: string; signatoryRole?: string; style?: 'Classique' | 'Moderne' | 'Minimaliste'; accentColor?: string; discountPercent?: number; discountAmount?: number; clientComment?: string; }
export interface SaleLine { id: string; description: string; quantity: number; unitPrice: number; costPrice?: number; total: number; }
export interface Sale { id: string; saleNumber: string; quoteId?: string; affaireId?: string; clientId: string; serviceId?: string; commercialId?: string; dueDate?: string; lines: SaleLine[]; subtotal: number; total: number; status: 'Enregistrée' | 'Payée' | 'Annulée'; date: string; notes?: string; }
export interface Installment { id: string; saleId: string; amount: number; dueDate: string; paidAmount: number; status: 'En attente' | 'Payée'; paidAt?: string; }
export type InstallmentInput = { id?: string; amount: number; dueDate: string };

export type PaymentType = 'ENCAISSEMENT' | 'REMBOURSEMENT';
export type PaymentMethod = 'Virement Bancaire' | 'Chèque' | 'Espèces' | 'Mobile Money' | 'Traite';
export interface FacturePaiement {
  id: string;
  paymentNumber: string;
  paymentType: PaymentType;
  venteId: string;
  echeanceId?: string;
  clientId: string;
  paymentDate: string;
  amount: number;
  paymentMethod: PaymentMethod;
  reference?: string;
  proofDocumentId?: string;
  notes?: string;
  status: 'VALIDE' | 'REJETE' | 'ANNULE';
  recordedBy?: string;
  createdAt?: string;
}

export type CostType = 'DIRECT' | 'INDIRECT';
export type CostCategory = 
  | 'SOUS_TRAITANCE' 
  | 'ACHAT_MATERIEL' 
  | 'TRANSPORT' 
  | 'LOGICIEL_LICENCE' 
  | 'HONORAIRES' 
  | 'LOYER_CHARGES' 
  | 'TELECOM' 
  | 'AUTRE';

export interface Cout {
  id: string;
  reference: string;
  costType: CostType;
  category: CostCategory;
  amountHt: number;
  vatRate: number;
  vatAmount: number;
  amountTtc: number;
  date: string;
  affaireId?: string;
  serviceId: string;
  supplierName?: string;
  invoiceRef?: string;
  description: string;
  proofDocumentId?: string;
  status: 'ENGAGE' | 'VALIDE' | 'PAYE' | 'ANNULE';
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type PeriodType = 'MENSUEL' | 'TRIMESTRIEL' | 'ANNUEL';

export interface ScoringRule {
  id: string;
  serviceId?: string;
  role: string;
  weightMargin: number;
  weightRevenue: number;
  weightVolume: number;
  weightConversion: number;
  isActive: boolean;
}

export interface Objectif {
  id: string;
  profileId: string;
  serviceId: string;
  periodType: PeriodType;
  startDate: string;
  endDate: string;
  targetRevenueHt: number;
  targetMarginHt: number;
  targetDealsCount: number;
  targetNewClients: number;
  status: 'EN_COURS' | 'ATTEINT' | 'NON_ATTEINT' | 'ANNULE';
  createdBy?: string;
  createdAt?: string;
}

export interface Classement {
  id: string;
  profileId: string;
  serviceId: string;
  periodType: PeriodType;
  periodKey: string;
  score: number;
  rank: number;
  revenueAchievedHt: number;
  marginAchievedHt: number;
  dealsWonCount: number;
  conversionRate: number;
  updatedAt?: string;
}

export type PrimeType = 'PERFORMANCE' | 'CHALLENGE' | 'EXCEPTIONNELLE';
export type PrimeStatus = 'PROPOSEE' | 'VALIDEE' | 'PAYEE' | 'REJETEE';

export interface Prime {
  id: string;
  reference: string;
  profileId: string;
  serviceId: string;
  periodKey: string;
  primeType: PrimeType;
  amount: number;
  status: PrimeStatus;
  calculatedBy?: string;
  validatedBy?: string;
  justification?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PrimeAuditLog {
  id: string;
  primeId: string;
  action: 'CREATION' | 'MODIFICATION' | 'VALIDATION' | 'REJET' | 'PAIEMENT';
  actorId: string;
  actorRole: string;
  previousState?: any;
  newState?: any;
  comment?: string;
  createdAt?: string;
}

export interface Commission {
  id: string;
  saleId?: string;
  affaireId?: string;
  clientId?: string;
  commercialId?: string;
  serviceId?: string;
  totalHt: number;
  costTotal: number;
  marginAmount: number;
  marginPercent: number;
  commissionPercent: number;
  commissionAmount: number;
  paidAmount?: number;
  eligibleAmount?: number;
  notes?: string;
  status: 'En attente' | 'Validée' | 'Payée' | 'Annulée';
  createdAt: string;
}
export interface Prospect { id: string; prospectNumber: string; commercialId: string; serviceId?: string; categoryId?: string; type: 'Entreprise' | 'Particulier'; name: string; company?: string; phone?: string; email?: string; address?: string; city?: string; source?: string; interestLevel: 'Faible' | 'Moyen' | 'Élevé' | 'Très élevé'; budget: number; need?: string; comments?: string; status: 'Nouveau' | 'Premier contact' | 'Besoin identifié' | 'Rendez-vous' | 'Offre en préparation' | 'Négociation' | 'À convertir' | 'Converti' | 'Perdu'; responsibleId?: string; createdAt: string; updatedAt: string; }
export interface ProspectActivity { id: string; prospectId: string; type: 'Appel' | 'Email' | 'Visite' | 'Réunion' | 'Démonstration' | 'Compte rendu' | 'Autre'; description?: string; date: string; createdBy?: string; }
export interface ProspectFollowUp { id: string; prospectId: string; date: string; time?: string; priority: 'Basse' | 'Moyenne' | 'Haute' | 'Urgente'; observation?: string; status: 'En attente' | 'Terminée' | 'Annulée'; }
export interface AppSettings { companyName: string; companyLogo: string; companyAddress: string; companySiret: string; companyTva: string; defaultTerms: string; headerLogoBase64?: string; companyStampBase64?: string; defaultValidity?: number; siteUrl?: string; commissionRate?: number; }

export interface ActivityReport { id: string; authorId: string; role: User['role']; type: 'Activité' | 'Prospection'; date: string; realisations: string; difficultes: string; remarques: string; createdAt?: string; updatedAt?: string; }

export interface WeeklyReport { id: string; authorId: string; role: User['role']; weekStart: string; sections: { type: 'Activité' | 'Prospection'; content: string }[]; kpis: Record<string, number>; status: 'Brouillon' | 'Envoyé' | 'Relu'; sentAt?: string; createdAt?: string; }

export interface V2Task {
  id: string;
  description: string;
  status: 'Effectuée' | 'En cours' | 'Restante' | 'Bloquée';
  difficulty?: string;
  affaireId?: string;
  clientId?: string;
  timeSpent?: string;
}
export interface V2DailyReport {
  id: string;
  authorId: string;
  date: string;
  project: string;
  objectives: string;
  tasks: V2Task[];
  results: string;
  difficulties: string;
  observations: string;
  status: 'Brouillon' | 'Soumis' | 'Validé';
  createdAt?: string;
  updatedAt?: string;
}
export interface V2WeeklyReport {
  id: string;
  authorId: string;
  weekStart: string;
  weekEnd?: string;
  project?: string;
  dailyReportIds?: string[];
  weeklyObjectives: string;
  tasksByDay: Record<string, V2Task[]>;
  pendingTasks?: V2Task[];
  aiSummary?: string;
  achievements?: string;
  difficulties?: string;
  summary?: string;
  nextWeekObjectives: string;
  conclusion?: string;
  status: 'Brouillon' | 'Soumis' | 'Validé' | 'Relu';
  directorComment?: string;
  submittedAt?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}
// POS Interfaces
export interface PosCategory { id: string; name: string; family: 'Livre' | 'Fourniture' | 'Service'; }
export interface PosBrand { id: string; name: string; }
export interface PosSupplier { id: string; name: string; contact?: string; phone?: string; email?: string; address?: string; }
export interface PosProduct { id: string; reference: string; barcode?: string; isbn?: string; name: string; family?: 'Livre' | 'Fourniture' | 'Service'; categoryId?: string; brandId?: string; supplierId?: string; purchasePrice: number; sellingPrice: number; quantity: number; minStock: number; imageUrl?: string; description?: string; status?: 'Active' | 'Inactive'; isActive: boolean; unit?: string; createdAt?: string; updatedAt?: string; }
export interface PosStockEntryLine { id: string; productId: string; quantity: number; purchasePrice: number; total: number; }
export interface PosStockEntry { id: string; reference: string; supplierId?: string; date: string; totalAmount: number; status: 'Brouillon' | 'Validé' | 'Annulé'; notes?: string; createdBy?: string; lines: PosStockEntryLine[]; }
export interface PosInventoryLine { id: string; productId: string; expectedQty: number; countedQty: number; difference: number; }
export interface PosInventory { id: string; reference: string; date: string; status: 'En cours' | 'Terminé' | 'Annulé'; notes?: string; createdBy?: string; lines: PosInventoryLine[]; }
export interface PosCashSession { id: string; cashierId?: string; openedAt: string; closedAt?: string; initialFund: number; finalAmount?: number; expectedAmount?: number; difference?: number; status: 'Ouverte' | 'Fermée'; }
export interface PosTransactionLine { id: string; productId?: string; description: string; quantity: number; unitPrice: number; discountPercent: number; discountAmount: number; total: number; }
export interface PosTransaction { id: string; transactionNumber: string; cashierId?: string; sessionId?: string; date: string; subtotal: number; vat: number; discountAmount: number; total: number; receivedAmount?: number; changeAmount?: number; status: 'Validée' | 'Annulée' | 'Retournée'; lines: PosTransactionLine[]; payments: PosPayment[]; }
export interface PosPayment { id: string; transactionId?: string; method: 'Espèces' | 'Mobile Money' | 'Mixte'; amount: number; reference?: string; }
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
  color?: string; // Hex color code e.g. '#0D9488', '#2563EB', '#7C3AED'
  isShared?: boolean;
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
  affaireId?: string;
  clientId?: string;
  category?: 'Contrat / Devis signé' | 'Bon de Commande' | 'BAT / Maquette' | 'Facture / Reçu' | 'Rapport' | 'Autre';
  isShared?: boolean;
  createdAt: string;
  updatedAt?: string;
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

export interface PosSettings { 
  libraryName: string; 
  address: string; 
  phone: string; 
  email: string; 
  currency: string; 
  ticketMessage: string; 
  printerType: string;
  whatsappOrderPhone?: string;
  catalogBannerText?: string;
  themeColor?: string;
}
export interface PosWorkspace { active: boolean; }

interface AppState {
  users: User[]; clients: Client[]; affaires: Affaire[]; quotes: Quote[]; sales: Sale[]; facturePaiements: FacturePaiement[]; couts: Cout[]; commissions: Commission[]; installments: Installment[];
  scoringRules: ScoringRule[]; objectifs: Objectif[]; classements: Classement[]; primes: Prime[]; primeAuditLogs: PrimeAuditLog[];
  prospects: Prospect[]; prospectActivities: ProspectActivity[]; prospectFollowUps: ProspectFollowUp[]; categories: Category[]; settings: AppSettings; services: Service[]; prestations: Prestation[]; loading: boolean; activityReports: ActivityReport[]; weeklyReports: WeeklyReport[]; crmDocuments: CrmDocument[]; crmFolders: CrmFolder[]; v2DailyReports: V2DailyReport[]; v2WeeklyReports: V2WeeklyReport[]; notifications: AppNotification[];
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
  addAffaire: (affaireData: Omit<Affaire, 'id' | 'reference' | 'createdAt' | 'updatedAt'> | Affaire) => Promise<Affaire>;
  updateAffaire: (id: string, data: Partial<Affaire>) => Promise<void>;
  updateAffaireStatus: (id: string, status: AffaireStatus) => Promise<void>;
  deleteAffaire: (id: string) => Promise<void>;
  recordPayment: (paymentData: Omit<FacturePaiement, 'id' | 'paymentNumber' | 'createdAt'> | FacturePaiement) => Promise<FacturePaiement>;
  addCout: (coutData: Omit<Cout, 'id' | 'reference' | 'vatAmount' | 'amountTtc' | 'createdAt' | 'updatedAt'> | Cout) => Promise<Cout>;
  updateCout: (id: string, data: Partial<Cout>) => Promise<void>;
  deleteCout: (id: string) => Promise<void>;
  addObjectif: (obj: Omit<Objectif, 'id' | 'createdAt'> | Objectif) => Promise<Objectif>;
  updateObjectif: (id: string, data: Partial<Objectif>) => Promise<void>;
  deleteObjectif: (id: string) => Promise<void>;
  proposePrime: (primeData: Omit<Prime, 'id' | 'reference' | 'status' | 'createdAt' | 'updatedAt'>, comment?: string) => Promise<Prime>;
  validatePrime: (primeId: string, comment?: string) => Promise<void>;
  rejectPrime: (primeId: string, comment?: string) => Promise<void>;
  payPrime: (primeId: string, comment?: string) => Promise<void>;
  updateScoringRule: (id: string, data: Partial<ScoringRule>) => Promise<void>;
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
  updateCommissionStatus: (id: string, status: Commission['status'], paidAmount?: number, notes?: string) => Promise<void>;
  deleteCommission: (id: string) => Promise<void>;
  addProspect: (prospect: Prospect) => Promise<void>;
  updateProspect: (id: string, data: Partial<Prospect>) => Promise<void>;
  deleteProspect: (id: string) => Promise<void>;
  convertProspect: (prospectId: string, createAffaire?: boolean) => Promise<{ clientId: string; affaireId?: string }>;
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
  submitV2WeeklyReport: (id: string) => Promise<void>;
  sendWeeklyReportReminder: (userIds: string[], weekStart: string) => Promise<void>;
  reviewV2WeeklyReport: (id: string, comment?: string, status?: 'Validé' | 'Relu') => Promise<void>;
  deleteV2WeeklyReport: (id: string) => Promise<void>;
  updateMyProfile: (data: Partial<Pick<User, 'photo' | 'name'>>) => Promise<void>;
  addCrmDocument: (file: File, options?: { uploaderId?: string; folderId?: string; affaireId?: string; clientId?: string; category?: CrmDocument['category']; isShared?: boolean } | string, folderIdParam?: string) => Promise<CrmDocument>;
  updateCrmDocument: (id: string, updates: Partial<CrmDocument>, newFileBlob?: Blob) => Promise<void>;
  deleteCrmDocument: (id: string) => Promise<void>;
  downloadCrmDocument: (doc: CrmDocument) => Promise<void>;
  getCrmDocumentBlob: (doc: CrmDocument) => Promise<Blob | null>;
  addCrmFolder: (name: string, ownerId: string, parentId?: string, color?: string, isShared?: boolean) => Promise<CrmFolder>;
  updateCrmFolder: (id: string, data: Partial<CrmFolder>) => Promise<void>;
  deleteCrmFolder: (id: string) => Promise<void>;
  addCategory: (category: Category) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  updateSettings: (settings: AppSettings) => Promise<void>;
  addUser: (user: User) => Promise<void>;
  updateUser: (id: string, data: Partial<User>) => Promise<void>;
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
  clearPosSalesHistory: () => Promise<void>;
  deletePosMovementsByDateRange: (startDate: string, endDate: string) => Promise<void>;
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
  refreshData: (isBackground?: boolean) => Promise<void>;
  reconcilePosData: () => Promise<any>;
  // CRM Modules Responsables
  crmTiers: ClientFournisseur[];
  crmCommerciaux: AgentCommercial[];
  crmPrestations: PrestationCommande[];
  crmCaisse: MouvementCaisse[];
  crmCommissions: CommissionPrestation[];
  crmArticles: CatalogueArticle[];
  crmMaintenance: InterventionMaintenance[];
  crmTechniciens: TechnicienMaintenance[];
  addCrmTier: (tier: ClientFournisseur) => Promise<void>;
  updateCrmTier: (id: string, tier: Partial<ClientFournisseur>) => Promise<void>;
  deleteCrmTier: (id: string) => Promise<void>;
  addCrmCommercial: (comm: AgentCommercial) => Promise<void>;
  updateCrmCommercial: (id: string, comm: Partial<AgentCommercial>) => Promise<void>;
  deleteCrmCommercial: (id: string) => Promise<void>;
  addCrmPrestation: (prest: PrestationCommande) => Promise<void>;
  updateCrmPrestation: (id: string, prest: Partial<PrestationCommande>) => Promise<void>;
  deleteCrmPrestation: (id: string) => Promise<void>;
  encaisserCrmPrestation: (id: string, modeReglement?: string) => Promise<void>;
  addCrmMouvementCaisse: (mvt: MouvementCaisse) => Promise<void>;
  deleteCrmMouvementCaisse: (id: string) => Promise<void>;
  updateCrmCommissionStatus: (id: string, status: CommissionPrestation['statut']) => Promise<void>;
  payerCrmCommission: (id: string, modeReglement: string) => Promise<void>;
  addCrmArticle: (art: CatalogueArticle) => Promise<void>;
  updateCrmArticle: (id: string, art: Partial<CatalogueArticle>) => Promise<void>;
  deleteCrmArticle: (id: string) => Promise<void>;
  addCrmIntervention: (interv: InterventionMaintenance) => Promise<void>;
  updateCrmIntervention: (id: string, interv: Partial<InterventionMaintenance>) => Promise<void>;
  deleteCrmIntervention: (id: string) => Promise<void>;
  addCrmTechnicien: (tech: TechnicienMaintenance) => Promise<void>;
  updateCrmTechnicien: (id: string, tech: Partial<TechnicienMaintenance>) => Promise<void>;
  deleteCrmTechnicien: (id: string) => Promise<void>;
  // Module Facturation Client
  invoices: Invoice[];
  invoicePayments: InvoicePayment[];
  addInvoice: (invoiceData: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'> | Invoice) => Promise<Invoice>;
  updateInvoice: (id: string, data: Partial<Invoice>) => Promise<void>;
  updateInvoiceStatus: (id: string, status: InvoiceStatus) => Promise<void>;
  deleteInvoice: (id: string) => Promise<void>;
  addInvoicePayment: (paymentData: Omit<InvoicePayment, 'id' | 'createdAt'> | InvoicePayment) => Promise<InvoicePayment>;
  deleteInvoicePayment: (paymentId: string) => Promise<void>;
}

  const defaultSettings: AppSettings = { companyName: 'Hinov', companyLogo: '', companyAddress: '', companySiret: '', companyTva: '', defaultTerms: '', commissionRate: 10 };

// Helper pour éviter tout blocage réseau infini sur les requêtes asynchrones (7.5s max)
const withTimeout = async <T,>(promiseOrThenable: any, ms: number = 7500): Promise<T> => {
  let timer: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Délai dépassé')), ms);
  });
  try {
    return await Promise.race([
      Promise.resolve(promiseOrThenable),
      timeoutPromise
    ]);
  } finally {
    clearTimeout(timer);
  }
};

// Helper pour exécuter des requêtes par lots contrôlés (évite de saturer le pool de 6 connexions HTTP du navigateur)
const fetchInBatches = async <T,>(tasks: (() => Promise<T>)[], batchSize = 6): Promise<T[]> => {
  const results: T[] = [];
  for (let i = 0; i < tasks.length; i += batchSize) {
    const chunk = tasks.slice(i, i + batchSize);
    const chunkResults = await Promise.all(chunk.map(fn => fn()));
    results.push(...chunkResults);
  }
  return results;
};

// Safe reading from LocalForage
const safeGet = async <T,>(store: any): Promise<T | null> => {
  try {
    if (!store || typeof store.getItem !== 'function') return null;
    return await withTimeout<T | null>(store.getItem('data'), 2000);
  } catch (e) {
    console.warn('[Cache] Erreur lecture store :', e);
    return null;
  }
};

// Anti-Data Loss Cache Guard : empêche d'écraser un cache non-vide par un tableau vide
const safeSet = async <T,>(store: any, data: T): Promise<void> => {
  try {
    if (!store || typeof store.setItem !== 'function') return;
    if (Array.isArray(data) && data.length === 0) {
      const existing = await safeGet<any[]>(store);
      if (existing && existing.length > 0) {
        console.warn('[CacheGuard] Refus d\'écraser un store existant avec un tableau vide');
        return;
      }
    }
    await withTimeout(store.setItem('data', data), 3000);
  } catch (e) {
    console.warn('[Cache] Erreur écriture store :', e);
  }
};

const AppContext = createContext<AppState | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const { currentUser, updateCurrentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [affaires, setAffaires] = useState<Affaire[]>([]);
  const [facturePaiements, setFacturePaiements] = useState<FacturePaiement[]>([]);
  const [couts, setCouts] = useState<Cout[]>([]);
  const [scoringRules, setScoringRules] = useState<ScoringRule[]>([]);
  const [objectifs, setObjectifs] = useState<Objectif[]>([]);
  const [classements, setClassements] = useState<Classement[]>([]);
  const [primes, setPrimes] = useState<Prime[]>([]);
  const [primeAuditLogs, setPrimeAuditLogs] = useState<PrimeAuditLog[]>([]);
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

  // CRM Modules Responsables
  const [crmTiers, setCrmTiers] = useState<ClientFournisseur[]>([]);
  const [crmCommerciaux, setCrmCommerciaux] = useState<AgentCommercial[]>([]);
  const [crmPrestations, setCrmPrestations] = useState<PrestationCommande[]>([]);
  const [crmCaisse, setCrmCaisse] = useState<MouvementCaisse[]>([]);
  const [crmCommissions, setCrmCommissions] = useState<CommissionPrestation[]>([]);
  const [crmArticles, setCrmArticles] = useState<CatalogueArticle[]>([]);
  const [crmMaintenance, setCrmMaintenance] = useState<InterventionMaintenance[]>([]);
  const [crmTechniciens, setCrmTechniciens] = useState<TechnicienMaintenance[]>([]);
  // Facturation
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoicePayments, setInvoicePayments] = useState<InvoicePayment[]>([]);

  const inFlightRefreshRef = useRef<Promise<void> | null>(null);
  const lastRefreshTimeRef = useRef<number>(0);

  // Load from offline cache first, then fetch from Supabase if online
  const refreshData = useCallback(async (isBackground: boolean = false) => {
    // Si une synchronisation d'arrière-plan est demandée mais qu'un rafraîchissement a eu lieu il y a moins de 5 secondes, ignorer
    if (isBackground && Date.now() - lastRefreshTimeRef.current < 5000) {
      return;
    }

    // Si un rafraîchissement est déjà en cours, réutiliser la promesse existante pour éviter de doubler les requêtes
    if (inFlightRefreshRef.current) {
      return inFlightRefreshRef.current;
    }

    const executeRefresh = async () => {
      if (!isBackground) {
        setLoading(true);
      }
      try {
        const [
        cachedUsers, cachedClients, cachedAffaires, cachedFacturePaiements, cachedCouts,
        cachedScoringRules, cachedObjectifs, cachedClassements, cachedPrimes, cachedPrimeAuditLogs,
        cachedQuotes, cachedSales, cachedCommissions, cachedInstallments, cachedProspects,
        cachedProspectActivities, cachedProspectFollowUps, cachedActivityReports, cachedWeeklyReports,
        cachedV2DailyReports, cachedV2WeeklyReports, cachedCrmDocuments, cachedCrmFolders,
        cachedNotifications, cachedCategories, cachedServices, cachedPrestations, cachedSettings,
        cachedPosCategories, cachedPosBrands, cachedPosSuppliers, cachedPosProducts,
        cachedPosStockEntries, cachedPosStockMovements, cachedPosInventories, cachedPosCashSessions,
        cachedPosTransactions, cachedPosPayments, cachedPosDiscounts, cachedPosSettings,
        cachedPosReturns, cachedProductCompletions, cachedImportSessions,
        cachedCrmTiers, cachedCrmCommerciaux, cachedCrmPrestations, cachedCrmCaisse,
        cachedCrmCommissions, cachedCrmArticles, cachedCrmMaintenance, cachedCrmTechniciens,
        cachedInvoices, cachedInvoicePayments
      ] = await Promise.all([
        safeGet<User[]>(db.profiles),
        safeGet<Client[]>(db.clients),
        safeGet<Affaire[]>(db.affaires),
        safeGet<FacturePaiement[]>(db.facturePaiements),
        safeGet<Cout[]>(db.couts),
        safeGet<ScoringRule[]>(db.scoringRules),
        safeGet<Objectif[]>(db.objectifs),
        safeGet<Classement[]>(db.classements),
        safeGet<Prime[]>(db.primes),
        safeGet<PrimeAuditLog[]>(db.primeAuditLogs),
        safeGet<Quote[]>(db.quotes),
        safeGet<Sale[]>(db.sales),
        safeGet<Commission[]>(db.commissions),
        safeGet<Installment[]>(db.installments),
        safeGet<Prospect[]>(db.prospects),
        safeGet<ProspectActivity[]>(db.prospectActivities),
        safeGet<ProspectFollowUp[]>(db.prospectFollowUps),
        safeGet<ActivityReport[]>(db.activityReports),
        safeGet<WeeklyReport[]>(db.weeklyReports),
        safeGet<V2DailyReport[]>(db.v2DailyReports),
        safeGet<V2WeeklyReport[]>(db.v2WeeklyReports),
        safeGet<CrmDocument[]>(db.documents),
        safeGet<CrmFolder[]>(db.crmFolders),
        safeGet<AppNotification[]>(db.notifications),
        safeGet<Category[]>(db.categories),
        safeGet<Service[]>(db.services),
        safeGet<Prestation[]>(db.prestations),
        safeGet<AppSettings>(db.settings),
        safeGet<PosCategory[]>(db.posCategories),
        safeGet<PosBrand[]>(db.posBrands),
        safeGet<PosSupplier[]>(db.posSuppliers),
        safeGet<PosProduct[]>(db.posProducts),
        safeGet<PosStockEntry[]>(db.posStockEntries),
        safeGet<PosStockMovement[]>(db.posStockMovements),
        safeGet<PosInventory[]>(db.posInventories),
        safeGet<PosCashSession[]>(db.posCashSessions),
        safeGet<PosTransaction[]>(db.posTransactions),
        safeGet<PosPayment[]>(db.posPayments),
        safeGet<PosDiscount[]>(db.posDiscounts),
        safeGet<PosSettings>(db.posSettings),
        safeGet<PosReturn[]>(db.posReturns),
        safeGet<ProductCompletion[]>(db.productCompletions),
        safeGet<ImportSession[]>(db.importSessions),
        safeGet<ClientFournisseur[]>(db.crmTiers),
        safeGet<AgentCommercial[]>(db.crmCommerciaux),
        safeGet<PrestationCommande[]>(db.crmPrestations),
        safeGet<MouvementCaisse[]>(db.crmCaisse),
        safeGet<CommissionPrestation[]>(db.crmCommissions),
        safeGet<CatalogueArticle[]>(db.crmArticles),
        safeGet<InterventionMaintenance[]>(db.crmMaintenance),
        safeGet<TechnicienMaintenance[]>(db.crmTechniciens),
        safeGet<Invoice[]>(db.invoices),
        safeGet<InvoicePayment[]>(db.invoicePayments),
      ]);

      if (cachedUsers) setUsers(cachedUsers);
      if (cachedClients) setClients(cachedClients);
      if (cachedAffaires) setAffaires(cachedAffaires);
      if (cachedFacturePaiements) setFacturePaiements(cachedFacturePaiements);
      if (cachedCouts) setCouts(cachedCouts);
      if (cachedInvoices) setInvoices(cachedInvoices);
      if (cachedInvoicePayments) setInvoicePayments(cachedInvoicePayments);
      if (cachedScoringRules) setScoringRules(cachedScoringRules);
      if (cachedObjectifs) setObjectifs(cachedObjectifs);
      if (cachedClassements) setClassements(cachedClassements);
      if (cachedPrimes) setPrimes(cachedPrimes);
      if (cachedPrimeAuditLogs) setPrimeAuditLogs(cachedPrimeAuditLogs);
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
      let categoriesToSet = (cachedPosCategories || []).filter(c => (c as any).family !== 'Service');
      if (categoriesToSet.length === 0) {
        categoriesToSet = [
          { id: uuidv4(), name: 'Livres', family: 'Livre' as const },
          { id: uuidv4(), name: 'Fournitures scolaires', family: 'Fourniture' as const },
          { id: uuidv4(), name: 'Divers', family: 'Fourniture' as const }
        ];
      }
      setPosCategories(categoriesToSet);
      if (!cachedPosCategories || cachedPosCategories.length === 0) {
        await db.posCategories.setItem('data', categoriesToSet);
      }

      if (cachedPosBrands) setPosBrands(cachedPosBrands);
      if (cachedPosSuppliers) setPosSuppliers(cachedPosSuppliers);
      if (cachedPosStockEntries) setPosStockEntries(cachedPosStockEntries);
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
      if (cachedCrmTiers) setCrmTiers(cachedCrmTiers);
      if (cachedCrmCommerciaux) setCrmCommerciaux(cachedCrmCommerciaux);
      if (cachedCrmPrestations) setCrmPrestations(cachedCrmPrestations);
      if (cachedCrmCaisse) setCrmCaisse(cachedCrmCaisse);
      if (cachedCrmCommissions) setCrmCommissions(cachedCrmCommissions);
      if (cachedCrmArticles) setCrmArticles(cachedCrmArticles);
      if (cachedCrmMaintenance) setCrmMaintenance(cachedCrmMaintenance);
      if (cachedCrmTechniciens) setCrmTechniciens(cachedCrmTechniciens);

      const rawCachedProducts = (cachedPosProducts || []).filter((p: any) => {
        return p.family !== 'Service' && !p.reference?.startsWith('SRV-') && p.id !== '00000000-0000-0000-0000-000000000000';
      });
      const cachedProducts = rawCachedProducts.map((p: any) => ({
        ...p,
        id: resolveProductUuid(p.id, p.reference)
      }));

      setPosProducts(cachedProducts);
      setLoading(false);

      if (rawCachedProducts.length !== (cachedPosProducts || []).length) {
        db.posProducts.setItem('data', cachedProducts).catch(() => {});
      }

      // 2. Nettoyage proactif immédiat des reliquats de services retirés dans la file et les erreurs
      try {
        const currentQueue = (await db.syncQueue.getItem<any[]>('queue')) || [];
        const cleanQueue = currentQueue.filter(a => !isRetiredServicePayload(a.type, a.payload));
        if (cleanQueue.length !== currentQueue.length) {
          await db.syncQueue.setItem('queue', cleanQueue);
        }
        const currentErrors = (await db.syncErrors.getItem<any[]>('errors')) || [];
        const cleanErrors = currentErrors.filter(e => !isRetiredServicePayload(e.action?.type, e.action?.payload));
        if (cleanErrors.length !== currentErrors.length) {
          await db.syncErrors.setItem('errors', cleanErrors);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('sync-errors-updated', { detail: { count: cleanErrors.length } }));
          }
        }
      } catch {}

      // 3. Fetch from Supabase (if online) and update Cache
      if (navigator.onLine) {
        if (currentUser) {
          // Process any pending offline mutations with a timeout so it doesn't block refreshData
          try {
            await Promise.race([
              processSyncQueue(),
              new Promise(res => setTimeout(res, 3000))
            ]);
          } catch (err) {
            console.warn('[refreshData] Sync queue non bloquante :', err);
          }
        }

        const lastSyncTime = await db.syncMetadata.getItem<string>('lastSyncTime');
        const syncTimestamp = new Date().toISOString();

        // Chaque table est récupérée isolément avec timeout sécurisé (7.5s)
        const safeFetch = async (queryFn: () => any, allowDelta: boolean = false): Promise<any> => {
          try {
            let query = queryFn();
            if (allowDelta && lastSyncTime) {
               query = query.gt('updated_at', lastSyncTime);
            }
            const res = await withTimeout<any>(query, 7500);
            if (res && res.error) {
              return null;
            }
            return res ? res.data : null;
          } catch {
            return null;
          }
        };

        const fetchTasks = [
          () => safeFetch(() => supabase.from('profiles').select('*')),
          () => currentUser ? safeFetch(() => supabase.from('clients').select('*')) : Promise.resolve(null),
          () => safeFetch(() => supabase.from('services').select('*')),
          () => safeFetch(() => supabase.from('prestations').select('*')),
          () => safeFetch(() => supabase.from('settings').select('*').single()),
          () => currentUser ? safeFetch(() => supabase.from('quotes').select('*, quote_lines(*)')) : Promise.resolve(null),
          () => currentUser ? safeFetch(() => supabase.from('ventes').select('*, vente_lines(*)')) : Promise.resolve(null),
          () => currentUser ? safeFetch(() => supabase.from('commissions').select('*')) : Promise.resolve(null),
          () => currentUser ? safeFetch(() => supabase.from('vente_echeances').select('*')) : Promise.resolve(null),
          () => currentUser ? safeFetch(() => supabase.from('affaires').select('*')) : Promise.resolve(null),
          () => currentUser ? safeFetch(() => supabase.from('facture_paiements').select('*')) : Promise.resolve(null),
          () => currentUser ? safeFetch(() => supabase.from('couts').select('*')) : Promise.resolve(null),
          () => currentUser ? safeFetch(() => supabase.from('scoring_rules').select('*')) : Promise.resolve(null),
          () => currentUser ? safeFetch(() => supabase.from('objectifs').select('*')) : Promise.resolve(null),
          () => currentUser ? safeFetch(() => supabase.from('classements').select('*')) : Promise.resolve(null),
          () => currentUser ? safeFetch(() => supabase.from('primes').select('*')) : Promise.resolve(null),
          () => currentUser ? safeFetch(() => supabase.from('prime_audit_logs').select('*')) : Promise.resolve(null),
          () => currentUser ? safeFetch(() => supabase.from('prospects').select('*')) : Promise.resolve(null),
          () => currentUser ? safeFetch(() => supabase.from('prospect_activities').select('*')) : Promise.resolve(null),
          () => currentUser ? safeFetch(() => supabase.from('prospect_follow_ups').select('*')) : Promise.resolve(null),
          () => safeFetch(() => supabase.from('categories').select('*')),
          () => currentUser ? safeFetch(() => supabase.from('activity_reports').select('*')) : Promise.resolve(null),
          () => currentUser ? safeFetch(() => supabase.from('weekly_reports').select('*')) : Promise.resolve(null),
          () => currentUser ? safeFetch(() => supabase.from('v2_daily_reports').select('*')) : Promise.resolve(null),
          () => currentUser ? safeFetch(() => supabase.from('v2_weekly_reports').select('*')) : Promise.resolve(null),
          () => safeFetch(() => supabase.from('pos_categories').select('*')),
          () => safeFetch(() => supabase.from('pos_brands').select('*')),
          () => safeFetch(() => supabase.from('pos_suppliers').select('*')),
          () => safeFetch(() => supabase.from('pos_products').select('*')),
          () => safeFetch(() => supabase.from('pos_stock_entries').select('*, pos_stock_entry_lines(*)')),
          () => safeFetch(() => supabase.from('pos_stock_movements').select('*')),
          () => safeFetch(() => supabase.from('pos_inventories').select('*, pos_inventory_lines(*)')),
          () => safeFetch(() => supabase.from('pos_cash_sessions').select('*')),
          () => safeFetch(() => supabase.from('pos_transactions').select('*, pos_transaction_lines(*), pos_payments(*)')),
          () => safeFetch(() => supabase.from('pos_payments').select('*')),
          () => safeFetch(() => supabase.from('pos_discounts').select('*')),
          () => safeFetch(() => supabase.from('pos_settings').select('*').single()),
          () => currentUser ? safeFetch(() => supabase.from('crm_documents').select('*')) : Promise.resolve(null),
          () => currentUser ? safeFetch(() => supabase.from('crm_folders').select('*')) : Promise.resolve(null),
          () => currentUser ? safeFetch(() => supabase.from('notifications').select('*')) : Promise.resolve(null),
          () => safeFetch(() => supabase.from('pos_returns').select('*, pos_return_lines(*)')),
          () => currentUser ? safeFetch(() => supabase.from('clients_fournisseurs').select('*')) : Promise.resolve(null),
          () => currentUser ? safeFetch(() => supabase.from('agents_commerciaux').select('*')) : Promise.resolve(null),
          () => currentUser ? safeFetch(() => supabase.from('prestations_commandes').select('*')) : Promise.resolve(null),
          () => currentUser ? safeFetch(() => supabase.from('mouvements_caisse').select('*')) : Promise.resolve(null),
          () => currentUser ? safeFetch(() => supabase.from('commissions_prestations').select('*')) : Promise.resolve(null),
          () => currentUser ? safeFetch(() => supabase.from('catalogue_articles').select('*')) : Promise.resolve(null),
          () => currentUser ? safeFetch(() => supabase.from('interventions_maintenance').select('*')) : Promise.resolve(null),
          () => currentUser ? safeFetch(() => supabase.from('techniciens_maintenance').select('*')) : Promise.resolve(null),
          () => currentUser ? safeFetch(() => supabase.from('invoices').select('*, invoice_items(*)')) : Promise.resolve(null),
          () => currentUser ? safeFetch(() => supabase.from('invoice_payments').select('*')) : Promise.resolve(null)
        ];

        const [
          profilesData, clientsData, servicesData,
          prestationsData, settingsData, quotesData,
          salesData, commissionsData, installmentsData,
          affairesData, facturePaiementsData, coutsData,
          scoringRulesData, objectifsData, classementsData, primesData, primeAuditLogsData,
          prospectsData, prospectActivitiesData,
          prospectFollowUpsData, categoriesData,
          activityReportsData, weeklyReportsData,
          v2DailyReportsData, v2WeeklyReportsData,
          posCategoriesData, posBrandsData, posSuppliersData,
          posProductsData, posStockEntriesData, posStockMovementsData, posInventoriesData,
          posCashSessionsData, posTransactionsData, posPaymentsData,
          posDiscountsData, posSettingsData, crmDocumentsData, crmFoldersData, notificationsData,
          posReturnsData,
          crmTiersData, crmCommerciauxData, crmPrestationsData, crmCaisseData,
          crmCommissionsData, crmArticlesData, crmMaintenanceData, crmTechniciensData,
          invoicesData, invoicePaymentsData
        ] = await fetchInBatches(fetchTasks, 6);

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
            posRole: p.pos_role || null,
            geminiApiKey: p.gemini_api_key || undefined,
            crmPrestationsEnabled: p.crm_prestations_enabled === true,
            crmCaisseEnabled: p.crm_caisse_enabled === true,
            crmMaintenanceEnabled: p.crm_maintenance_enabled === true,
            crmStocksEnabled: p.crm_stocks_enabled === true,
            crmTiersEnabled: p.crm_tiers_enabled === true,
            crmCommerciauxEnabled: p.crm_commerciaux_enabled === true,
            crmCommissionsEnabled: p.crm_commissions_enabled === true,
            crmFacturationEnabled: p.crm_facturation_enabled === true,
            crmReportsEnabled: p.crm_reports_enabled !== false
          }));
          const mergedUsers = mergeData(cachedUsers, parsedUsers);
          setUsers(mergedUsers); await db.profiles.setItem('data', mergedUsers);
          if (currentUser) {
            const freshMe = mergedUsers.find((u: User) => u.id === currentUser.id);
            if (freshMe) {
              updateCurrentUser(freshMe);
            }
          }
        }
        
        if (crmDocumentsData && crmDocumentsData.length > 0) {
          const parsedCrmDocuments = crmDocumentsData.map((d: any) => ({
            id: d.id,
            name: d.name,
            type: d.type,
            sizeBytes: d.size_bytes ?? d.sizeBytes ?? 0,
            filePath: d.file_path || d.filePath,
            uploaderId: d.uploader_id || d.uploaderId,
            folderId: d.folder_id || d.folderId || undefined,
            affaireId: d.affaire_id || d.affaireId || undefined,
            clientId: d.client_id || d.clientId || undefined,
            category: d.category || 'Autre',
            isShared: d.is_shared !== undefined ? !!d.is_shared : !!d.isShared,
            createdAt: d.created_at || d.createdAt,
            updatedAt: d.updated_at || d.updatedAt
          }));
          const mergedCrmDocuments = mergeData(cachedCrmDocuments, parsedCrmDocuments);
          setCrmDocuments(mergedCrmDocuments); await db.documents.setItem('data', mergedCrmDocuments);
        }

        if (crmFoldersData && crmFoldersData.length > 0) {
          const parsedFolders = crmFoldersData.map((f: any) => ({
            id: f.id,
            name: f.name,
            ownerId: f.owner_id || f.ownerId,
            parentId: f.parent_id || f.parentId || undefined,
            color: f.color || '#0D9488',
            isShared: f.is_shared !== undefined ? !!f.is_shared : !!f.isShared,
            createdAt: f.created_at || f.createdAt
          }));
          const mergedFolders = mergeData(cachedCrmFolders, parsedFolders);
          setCrmFolders(mergedFolders); await db.crmFolders.setItem('data', mergedFolders);
        }

        if (notificationsData && notificationsData.length > 0) {
          const mergedNotifications = mergeData(cachedNotifications, notificationsData);
          setNotifications(mergedNotifications); await db.notifications.setItem('data', mergedNotifications);
        }

        if (clientsData && clientsData.length > 0) {
          const parsedClients = clientsData.map((c: any) => ({
            id: c.id, name: c.name, email: c.email, phone: c.phone, contact: c.contact, company: c.company, address: c.address, status: c.status || 'Actif', commercialId: c.commercial_id, serviceId: c.service_id || undefined, createdAt: c.created_at
          }));
          const merged = mergeData(cachedClients, parsedClients);
          setClients(merged); await db.clients.setItem('data', merged);
        }
        if (affairesData && affairesData.length > 0) {
          const parsedAffaires = affairesData.map((a: any) => ({
            id: a.id,
            reference: a.reference,
            title: a.title,
            clientId: a.client_id,
            serviceId: a.service_id,
            commercialId: a.commercial_id,
            description: a.description || undefined,
            status: (a.status as AffaireStatus) || 'QUALIFIEE',
            estimatedAmountHt: Number(a.estimated_amount_ht) || 0,
            probability: a.probability !== undefined ? Number(a.probability) : 50,
            source: a.source || undefined,
            startDatePlanned: a.start_date_planned || undefined,
            endDatePlanned: a.end_date_planned || undefined,
            endDateReal: a.end_date_real || undefined,
            notes: a.notes || undefined,
            createdAt: a.created_at,
            updatedAt: a.updated_at
          }));
          const merged = mergeData(cachedAffaires, parsedAffaires);
          setAffaires(merged); await db.affaires.setItem('data', merged);
        }
        if (facturePaiementsData && facturePaiementsData.length > 0) {
          const parsedPaiements = facturePaiementsData.map((p: any) => ({
            id: p.id,
            paymentNumber: p.payment_number,
            paymentType: p.payment_type as PaymentType,
            venteId: p.vente_id,
            echeanceId: p.echeance_id || undefined,
            clientId: p.client_id,
            paymentDate: p.payment_date,
            amount: Number(p.amount) || 0,
            paymentMethod: p.payment_method as PaymentMethod,
            reference: p.reference || undefined,
            proofDocumentId: p.proof_document_id || undefined,
            notes: p.notes || undefined,
            status: p.status || 'VALIDE',
            recordedBy: p.recorded_by || undefined,
            createdAt: p.created_at
          }));
          const merged = mergeData(cachedFacturePaiements, parsedPaiements);
          setFacturePaiements(merged); await db.facturePaiements.setItem('data', merged);
        }
        if (coutsData && coutsData.length > 0) {
          const parsedCouts = coutsData.map((c: any) => ({
            id: c.id,
            reference: c.reference,
            costType: c.cost_type as CostType,
            category: c.category as CostCategory,
            amountHt: Number(c.amount_ht) || 0,
            vatRate: Number(c.vat_rate) || 0,
            vatAmount: Number(c.vat_amount) || 0,
            amountTtc: Number(c.amount_ttc) || 0,
            date: c.date,
            affaireId: c.affaire_id || undefined,
            serviceId: c.service_id,
            supplierName: c.supplier_name || undefined,
            invoiceRef: c.invoice_ref || undefined,
            description: c.description,
            proofDocumentId: c.proof_document_id || undefined,
            status: c.status || 'VALIDE',
            createdBy: c.created_by || undefined,
            createdAt: c.created_at,
            updatedAt: c.updated_at
          }));
          const merged = mergeData(cachedCouts, parsedCouts);
          setCouts(merged); await db.couts.setItem('data', merged);
        }
        if (scoringRulesData && scoringRulesData.length > 0) {
          const parsedRules = scoringRulesData.map((r: any) => ({
            id: r.id,
            serviceId: r.service_id || undefined,
            role: r.role,
            weightMargin: Number(r.weight_margin) || 40,
            weightRevenue: Number(r.weight_revenue) || 30,
            weightVolume: Number(r.weight_volume) || 15,
            weightConversion: Number(r.weight_conversion) || 15,
            isActive: r.is_active !== false
          }));
          const merged = mergeData(cachedScoringRules, parsedRules);
          setScoringRules(merged); await db.scoringRules.setItem('data', merged);
        }
        if (objectifsData && objectifsData.length > 0) {
          const parsedObj = objectifsData.map((o: any) => ({
            id: o.id,
            profileId: o.profile_id,
            serviceId: o.service_id,
            periodType: o.period_type as PeriodType,
            startDate: o.start_date,
            endDate: o.end_date,
            targetRevenueHt: Number(o.target_revenue_ht) || 0,
            targetMarginHt: Number(o.target_margin_ht) || 0,
            targetDealsCount: Number(o.target_deals_count) || 0,
            targetNewClients: Number(o.target_new_clients) || 0,
            status: o.status || 'EN_COURS',
            createdBy: o.created_by || undefined,
            createdAt: o.created_at
          }));
          const merged = mergeData(cachedObjectifs, parsedObj);
          setObjectifs(merged); await db.objectifs.setItem('data', merged);
        }
        if (classementsData && classementsData.length > 0) {
          const parsedCl = classementsData.map((c: any) => ({
            id: c.id,
            profileId: c.profile_id,
            serviceId: c.service_id,
            periodType: c.period_type as PeriodType,
            periodKey: c.period_key,
            score: Number(c.score) || 0,
            rank: Number(c.rank) || 0,
            revenueAchievedHt: Number(c.revenue_achieved_ht) || 0,
            marginAchievedHt: Number(c.margin_achieved_ht) || 0,
            dealsWonCount: Number(c.deals_won_count) || 0,
            conversionRate: Number(c.conversion_rate) || 0,
            updatedAt: c.updated_at
          }));
          const merged = mergeData(cachedClassements, parsedCl);
          setClassements(merged); await db.classements.setItem('data', merged);
        }
        if (primesData && primesData.length > 0) {
          const parsedPrimes = primesData.map((p: any) => ({
            id: p.id,
            reference: p.reference,
            profileId: p.profile_id,
            serviceId: p.service_id,
            periodKey: p.period_key,
            primeType: p.prime_type as PrimeType,
            amount: Number(p.amount) || 0,
            status: p.status as PrimeStatus,
            calculatedBy: p.calculated_by || undefined,
            validatedBy: p.validated_by || undefined,
            justification: p.justification || undefined,
            createdAt: p.created_at,
            updatedAt: p.updated_at
          }));
          const merged = mergeData(cachedPrimes, parsedPrimes);
          setPrimes(merged); await db.primes.setItem('data', merged);
        }
        if (primeAuditLogsData && primeAuditLogsData.length > 0) {
          const parsedLogs = primeAuditLogsData.map((l: any) => ({
            id: l.id,
            primeId: l.prime_id,
            action: l.action,
            actorId: l.actor_id,
            actorRole: l.actor_role,
            previousState: l.previous_state,
            newState: l.new_state,
            comment: l.comment || undefined,
            createdAt: l.created_at
          }));
          const merged = mergeData(cachedPrimeAuditLogs, parsedLogs);
          setPrimeAuditLogs(merged); await db.primeAuditLogs.setItem('data', merged);
        }
        if (servicesData && servicesData.length > 0) {
          const parsedServices = servicesData.map((s: any) => ({
            id: s.id,
            name: s.name,
            description: s.description,
            members: s.members,
            managerId: s.manager_id || s.managerId,
            commissionRate: s.commission_rate !== undefined && s.commission_rate !== null ? Number(s.commission_rate) : undefined
          }));
          const merged = mergeData(cachedServices, parsedServices);
          setServices(merged); await db.services.setItem('data', merged);
        }
        if (prestationsData && prestationsData.length > 0) {
          const parsedPrestations = prestationsData.map((p: any) => ({...p, serviceId: p.service_id, costPrice: p.cost_price ?? 0})) as Prestation[];
          const merged = mergeData(cachedPrestations, parsedPrestations);
          setPrestations(merged); await db.prestations.setItem('data', merged);
        }
        if (settingsData) {
          const parsedSettings: AppSettings = {
            companyName: settingsData.company_name || cachedSettings?.companyName || 'Hinov',
            companyLogo: settingsData.company_logo || cachedSettings?.companyLogo || '',
            companyAddress: settingsData.company_address ?? cachedSettings?.companyAddress ?? '',
            companySiret: settingsData.company_siret ?? cachedSettings?.companySiret ?? '',
            companyTva: settingsData.company_tva ?? cachedSettings?.companyTva ?? '',
            defaultTerms: settingsData.default_terms ?? cachedSettings?.defaultTerms ?? '',
            headerLogoBase64: settingsData.header_logo_base64 ?? cachedSettings?.headerLogoBase64 ?? undefined,
            companyStampBase64: settingsData.company_stamp_base64 ?? cachedSettings?.companyStampBase64 ?? undefined,
            defaultValidity: settingsData.default_validity ?? cachedSettings?.defaultValidity ?? undefined,
            siteUrl: settingsData.site_url ?? cachedSettings?.siteUrl ?? undefined,
            commissionRate: settingsData.commission_rate ?? cachedSettings?.commissionRate ?? undefined,
          };
          setSettings(parsedSettings); await db.settings.setItem('data', parsedSettings);
        }
        if (quotesData && quotesData.length > 0) {
          const parsedQuotes = quotesData.map((q: any) => ({
            id: q.id, quoteNumber: q.quote_number, clientId: q.client_id, commercialId: q.commercial_id, serviceId: q.service_id, affaireId: q.affaire_id || undefined, subject: q.subject, subtotal: q.subtotal, total: q.total, status: q.status, date: q.date,
            validUntil: q.valid_until || undefined, paymentTerms: q.payment_terms || undefined, notes: q.notes || undefined, signatoryName: q.signatory_name || undefined, signatoryRole: q.signatory_role || undefined,
            style: q.style, accentColor: q.accent_color,
            discountPercent: q.discount_percent || 0, discountAmount: q.discount_amount || 0, clientComment: q.client_comment,
            lines: (q.quote_lines || []).map((l: any) => ({ id: l.id, prestationId: l.prestation_id, description: l.description, quantity: l.quantity, unit: l.unit || undefined, unitPrice: l.unit_price, total: l.total, discountPercent: l.discount_percent || 0 }))
          }));
          const merged = mergeData(cachedQuotes, parsedQuotes);
          setQuotes(merged); await db.quotes.setItem('data', merged);
        }
        if (salesData && salesData.length > 0) {
          const parsedSales = salesData.map((s: any) => ({
            id: s.id, saleNumber: s.sale_number, quoteId: s.quote_id, affaireId: s.affaire_id || undefined, clientId: s.client_id, serviceId: s.service_id, commercialId: s.commercial_id || undefined, dueDate: s.due_date || undefined,
            subtotal: s.subtotal, total: s.total, status: s.status, date: s.date, notes: s.notes,
            lines: (s.vente_lines || []).map((l: any) => ({ id: l.id, description: l.description, quantity: l.quantity, unitPrice: l.unit_price, costPrice: l.cost_price || 0, total: l.total }))
          }));
          const merged = mergeData(cachedSales, parsedSales);
          setSales(merged); await db.sales.setItem('data', merged);
        }
        if (commissionsData && commissionsData.length > 0) {
          const parsedCommissions = commissionsData.map((c: any) => ({
            id: c.id,
            saleId: c.vente_id || c.sale_id,
            affaireId: c.affaire_id || undefined,
            clientId: c.client_id,
            commercialId: c.commercial_id,
            serviceId: c.service_id,
            totalHt: Number(c.total_ht) || 0,
            costTotal: Number(c.cost_total) || 0,
            marginAmount: Number(c.margin_amount) || 0,
            marginPercent: Number(c.margin_percent) || 0,
            commissionPercent: Number(c.commission_percent) || 0,
            commissionAmount: Number(c.commission_amount) || 0,
            paidAmount: Number(c.paid_amount) || 0,
            eligibleAmount: c.eligible_amount !== undefined ? Number(c.eligible_amount) : undefined,
            notes: c.notes || undefined,
            status: c.status || 'En attente',
            createdAt: c.created_at
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
            id: r.id, 
            authorId: r.author_id, 
            weekStart: r.week_start,
            weekEnd: r.week_end || undefined,
            project: r.project,
            dailyReportIds: r.daily_report_ids || [], 
            weeklyObjectives: r.weekly_objectives || '',
            tasksByDay: r.tasks_by_day || {}, 
            pendingTasks: r.pending_tasks || [], 
            summary: r.summary || r.ai_summary || '',
            aiSummary: r.ai_summary || r.summary || '',
            achievements: r.achievements || '',
            difficulties: r.difficulties || '',
            nextWeekObjectives: r.next_week_objectives || '', 
            conclusion: r.conclusion || '', 
            directorComment: r.director_comment || undefined,
            submittedAt: r.submitted_at || undefined,
            reviewedAt: r.reviewed_at || undefined,
            reviewedBy: r.reviewed_by || undefined,
            status: r.status,
            createdAt: r.created_at, 
            updatedAt: r.updated_at
          }));
          const merged = mergeData(cachedV2WeeklyReports, parsed);
          setV2WeeklyReports(merged); await db.v2WeeklyReports.setItem('data', merged);
        }
        if (posCategoriesData && posCategoriesData.length > 0) {
          const parsed = posCategoriesData.map((c: any) => ({ id: c.id, name: c.name, family: c.family }));
          const merged = mergeData(cachedPosCategories, parsed);
          setPosCategories(merged); await safeSet(db.posCategories, merged);
        }
        if (posBrandsData && posBrandsData.length > 0) {
          const parsed = posBrandsData.map((b: any) => ({ id: b.id, name: b.name }));
          const merged = mergeData(cachedPosBrands, parsed);
          setPosBrands(merged); await safeSet(db.posBrands, merged);
        }
        if (posSuppliersData && posSuppliersData.length > 0) {
          const parsed = posSuppliersData.map((s: any) => ({ id: s.id, name: s.name, contact: s.contact, phone: s.phone, email: s.email, address: s.address }));
          const merged = mergeData(cachedPosSuppliers, parsed);
          setPosSuppliers(merged); await safeSet(db.posSuppliers, merged);
        }
        if (posProductsData && posProductsData.length > 0) {
          const parsed = posProductsData
            .filter((p: any) => p.family !== 'Service' && !p.reference?.startsWith('SRV-') && p.id !== '00000000-0000-0000-0000-000000000000')
            .map((p: any) => {
              let purchasePrice = p.purchase_price;
              if (p.family === 'Livre' && (!purchasePrice || purchasePrice === 0) && p.selling_price > 0) {
                purchasePrice = Math.round(p.selling_price * 0.75);
              }
              return {
                id: resolveProductUuid(p.id, p.reference), reference: p.reference, barcode: p.barcode, isbn: p.isbn, name: p.name,
                family: p.family, categoryId: p.category_id, brandId: p.brand_id, supplierId: p.supplier_id,
                purchasePrice: purchasePrice ?? 0, sellingPrice: p.selling_price ?? 0, quantity: p.quantity ?? 0,
                minStock: (p.min_stock !== null && p.min_stock !== undefined && p.min_stock > 0) ? p.min_stock : 10, imageUrl: p.image_url, description: p.description,
                status: p.status || 'Active', isActive: p.is_active !== false, unit: p.unit, createdAt: p.created_at, updatedAt: p.updated_at
              };
            });
          const cleanCached = (cachedPosProducts || []).filter((p: any) => p.family !== 'Service' && !p.reference?.startsWith('SRV-'));
          const merged = mergeData(cleanCached, parsed);
          setPosProducts(merged);
          await safeSet(db.posProducts, merged);
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
          const latestLocalSessions = (await safeGet<PosCashSession[]>(db.posCashSessions)) || cachedPosCashSessions;
          const merged = mergeData(latestLocalSessions, parsed);
          setPosCashSessions(merged); await safeSet(db.posCashSessions, merged);
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
          const latestLocalTxs = (await safeGet<PosTransaction[]>(db.posTransactions)) || cachedPosTransactions;
          const merged = mergeData(latestLocalTxs, parsed);
          setPosTransactions(merged); await safeSet(db.posTransactions, merged);
        }
        if (posPaymentsData && posPaymentsData.length > 0) {
          const parsed = posPaymentsData.map((p: any) => ({ id: p.id, transactionId: p.transaction_id, method: p.method, amount: p.amount, reference: p.reference }));
          const latestLocalPayments = (await safeGet<PosPayment[]>(db.posPayments)) || cachedPosPayments;
          const merged = mergeData(latestLocalPayments, parsed);
          setPosPayments(merged); await safeSet(db.posPayments, merged);
        }
        if (posDiscountsData && posDiscountsData.length > 0) {
          const parsed = posDiscountsData.map((d: any) => ({ id: d.id, name: d.name, type: d.type, value: d.value, maxPercent: d.max_percent, maxAmount: d.max_amount, active: d.active }));
          const latestLocalDiscounts = (await safeGet<PosDiscount[]>(db.posDiscounts)) || cachedPosDiscounts;
          const merged = mergeData(latestLocalDiscounts, parsed);
          setPosDiscounts(merged); await safeSet(db.posDiscounts, merged);
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
          const latestLocalReturns = (await safeGet<PosReturn[]>(db.posReturns)) || cachedPosReturns;
          const merged = mergeData(latestLocalReturns, parsed);
          setPosReturns(merged); await safeSet(db.posReturns, merged);
        }

        if (crmTiersData && crmTiersData.length > 0) {
          const parsed: ClientFournisseur[] = crmTiersData.map((t: any) => ({
            id: t.id,
            type: t.type,
            nom: t.nom,
            telephone: t.telephone || undefined,
            email: t.email || undefined,
            adresse: t.adresse || undefined,
            ville: t.ville || undefined,
            cree_par: t.cree_par || undefined,
            cree_par_nom: t.cree_par_nom || undefined,
            created_at: t.created_at
          }));
          const merged = mergeData(cachedCrmTiers, parsed);
          setCrmTiers(merged); await db.crmTiers.setItem('data', merged);
        }

        if (crmCommerciauxData && crmCommerciauxData.length > 0) {
          const parsed: AgentCommercial[] = crmCommerciauxData.map((c: any) => ({
            id: c.id,
            nom: c.nom,
            telephone: c.telephone || undefined,
            email: c.email || undefined,
            taux_commission_defaut: Number(c.taux_commission_defaut) || 0,
            total_ventes: Number(c.total_ventes) || 0,
            contrats_clos_count: Number(c.contrats_clos_count) || 0,
            cree_par: c.cree_par || undefined,
            cree_par_nom: c.cree_par_nom || undefined,
            created_at: c.created_at
          }));
          const merged = mergeData(cachedCrmCommerciaux, parsed);
          setCrmCommerciaux(merged); await db.crmCommerciaux.setItem('data', merged);
        }

        if (crmPrestationsData && crmPrestationsData.length > 0) {
          const parsed: PrestationCommande[] = crmPrestationsData.map((p: any) => ({
            id: p.id,
            reference: p.reference,
            client_id: p.client_id,
            client_nom: p.client_nom,
            commercial_id: p.commercial_id || undefined,
            commercial_nom: p.commercial_nom || undefined,
            apporteur_id: p.apporteur_id || undefined,
            apporteur_nom: p.apporteur_nom || undefined,
            resp_service_id: p.resp_service_id || undefined,
            resp_service_nom: p.resp_service_nom || undefined,
            designation: p.designation,
            quantite: Number(p.quantite) || 1,
            cout_unitaire_achat: Number(p.cout_unitaire_achat) || 0,
            cout_final_achat: Number(p.cout_final_achat) || 0,
            prix_vente_unitaire: Number(p.prix_vente_unitaire) || 0,
            prix_client_final: Number(p.prix_client_final) || 0,
            marge_interne: Number(p.marge_interne) || 0,
            taux_commission_app: Number(p.taux_commission_app) || 0,
            commission_apporteur: Number(p.commission_apporteur) || 0,
            commission_resp_service: Number(p.commission_resp_service) || 0,
            commission_agent: Number(p.commission_agent) || 0,
            benefice_net: Number(p.benefice_net) || 0,
            statut: p.statut || 'BROUILLON',
            cree_par: p.cree_par,
            cree_par_nom: p.cree_par_nom || undefined,
            date_creation: p.date_creation || p.created_at,
            date_validation: p.date_validation || undefined,
            notes: p.notes || undefined
          }));
          const merged = mergeData(cachedCrmPrestations, parsed);
          setCrmPrestations(merged); await db.crmPrestations.setItem('data', merged);
        }

        if (crmCaisseData && crmCaisseData.length > 0) {
          const parsed: MouvementCaisse[] = crmCaisseData.map((m: any) => ({
            id: m.id,
            type: m.type,
            categorie: m.categorie,
            montant: Number(m.montant) || 0,
            date_mouvement: m.date_mouvement,
            mode_reglement: m.mode_reglement,
            motif: m.motif,
            module_code: m.module_code || undefined,
            cree_par: m.cree_par,
            cree_par_nom: m.cree_par_nom || undefined,
            reference_piece: m.reference_piece || undefined,
            created_at: m.created_at
          }));
          const merged = mergeData(cachedCrmCaisse, parsed);
          setCrmCaisse(merged); await db.crmCaisse.setItem('data', merged);
        }

        if (crmCommissionsData && crmCommissionsData.length > 0) {
          const parsed: CommissionPrestation[] = crmCommissionsData.map((c: any) => ({
            id: c.id,
            prestation_id: c.prestation_id,
            type_beneficiaire: c.type_beneficiaire,
            beneficiaire_id: c.beneficiaire_id || undefined,
            beneficiaire_nom: c.beneficiaire_nom,
            montant: Number(c.montant) || 0,
            statut: c.statut || 'EN_ATTENTE',
            date_reglement: c.date_reglement || undefined,
            mode_reglement: c.mode_reglement || undefined,
            cree_par: c.cree_par || undefined,
            created_at: c.created_at
          }));
          const merged = mergeData(cachedCrmCommissions, parsed);
          setCrmCommissions(merged); await db.crmCommissions.setItem('data', merged);
        }

        if (crmArticlesData && crmArticlesData.length > 0) {
          const parsed: CatalogueArticle[] = crmArticlesData.map((a: any) => ({
            id: a.id,
            code_article: a.code_article,
            designation: a.designation,
            categorie: a.categorie || 'Général',
            quantite_stock: Number(a.quantite_stock) || 0,
            seuil_alerte: Number(a.seuil_alerte) || 5,
            cout_unitaire_achat: Number(a.cout_unitaire_achat) || 0,
            prix_unitaire_vente: Number(a.prix_unitaire_vente) || 0,
            cree_par: a.cree_par || undefined,
            cree_par_nom: a.cree_par_nom || undefined,
            created_at: a.created_at,
            updated_at: a.updated_at
          }));
          const merged = mergeData(cachedCrmArticles, parsed);
          setCrmArticles(merged); await db.crmArticles.setItem('data', merged);
        }

        if (crmMaintenanceData && crmMaintenanceData.length > 0) {
          const parsed: InterventionMaintenance[] = crmMaintenanceData.map((m: any) => ({
            id: m.id,
            reference: m.reference,
            client_id: m.client_id || undefined,
            client_nom: m.client_nom || undefined,
            site_agence: m.site_agence,
            utilisateur_concerne: m.utilisateur_concerne,
            equipement: m.equipement,
            priorite: m.priorite || 'MOYENNE',
            observation: m.observation,
            travaux: m.travaux,
            quantite: Number(m.quantite) || 1,
            prix_unitaire: Number(m.prix_unitaire) || 0,
            prix_total: Number(m.prix_total) || 0,
            technicien_assigne: m.technicien_assigne,
            statut: m.statut || 'NOUVEAU',
            date_intervention: m.date_intervention || m.created_at,
            cree_par: m.cree_par,
            cree_par_nom: m.cree_par_nom || undefined,
            created_at: m.created_at,
            updated_at: m.updated_at
          }));
          const merged = mergeData(cachedCrmMaintenance, parsed);
          setCrmMaintenance(merged); await db.crmMaintenance.setItem('data', merged);
        }

        if (crmTechniciensData && crmTechniciensData.length > 0) {
          const parsed: TechnicienMaintenance[] = crmTechniciensData.map((t: any) => ({
            id: t.id,
            nom: t.nom,
            telephone: t.telephone || undefined,
            email: t.email || undefined,
            specialite: t.specialite || undefined,
            statut: t.statut || 'DISPONIBLE',
            cree_par: t.cree_par || undefined,
            cree_par_nom: t.cree_par_nom || undefined,
            created_at: t.created_at,
            updated_at: t.updated_at
          }));
          const merged = mergeData(cachedCrmTechniciens, parsed);
          setCrmTechniciens(merged); await db.crmTechniciens.setItem('data', merged);
        }

        if (invoicesData && invoicesData.length > 0) {
          const parsed: Invoice[] = invoicesData.map((inv: any) => {
            const d = inv.delivery_date || inv.issue_date || inv.created_at;
            const fallbackDate = d ? new Date(d) : new Date();
            const year = inv.period_year ? Number(inv.period_year) : (isNaN(fallbackDate.getFullYear()) ? new Date().getFullYear() : fallbackDate.getFullYear());
            const month = inv.period_month ? Number(inv.period_month) : (isNaN(fallbackDate.getMonth()) ? new Date().getMonth() + 1 : fallbackDate.getMonth() + 1);

            return {
              id: inv.id,
              invoiceNumber: inv.invoice_number,
              quoteId: inv.quote_id || undefined,
              clientId: inv.client_id,
              clientName: inv.client_nom || undefined,
              commercialId: inv.commercial_id || undefined,
              commercialName: inv.commercial_nom || undefined,
              serviceId: inv.service_id || undefined,
              serviceName: inv.service_nom || undefined,
              category: inv.category || undefined,
              periodYear: year,
              periodMonth: month,
              issueDate: inv.issue_date,
              deliveryDate: inv.delivery_date || undefined,
              paymentDate: inv.payment_date || undefined,
              paymentTerms: inv.payment_terms || '30 jours',
              dueDate: inv.due_date,
              subtotal: Number(inv.subtotal) || 0,
              taxAmount: Number(inv.tax_amount) || 0,
              discountAmount: Number(inv.discount_amount) || 0,
              totalAmount: Number(inv.total_amount) || 0,
              costAmount: Number(inv.cost_amount) || 0,
              commissionRate: Number(inv.commission_rate) || 10,
              commissionAmount: Number(inv.commission_amount) || 0,
              grossMargin: Number(inv.gross_margin) || 0,
              hinovMargin: Number(inv.hinov_margin) || 0,
              amountPaid: Number(inv.amount_paid) || 0,
              remainingAmount: Number(inv.remaining_amount) || 0,
              status: (inv.status as InvoiceStatus) || 'ÉMISE',
              notes: inv.notes || undefined,
              createdBy: inv.created_by || undefined,
              createdAt: inv.created_at,
              updatedAt: inv.updated_at,
              items: (inv.invoice_items || []).map((it: any) => ({
                id: it.id,
                invoiceId: it.invoice_id,
                prestationId: it.prestation_id || undefined,
                description: it.description,
                quantity: Number(it.quantity) || 1,
                unitPrice: Number(it.unit_price) || 0,
                costPrice: Number(it.cost_price) || 0,
                discountPercent: Number(it.discount_percent) || 0,
                taxRate: Number(it.tax_rate) || 0,
                total: Number(it.total) || 0,
                createdAt: it.created_at
              }))
            };
          });
          const merged = mergeData(cachedInvoices, parsed);
          setInvoices(merged);
          await db.invoices.setItem('data', merged);
        }

        if (invoicePaymentsData && invoicePaymentsData.length > 0) {
          const parsed: InvoicePayment[] = invoicePaymentsData.map((p: any) => ({
            id: p.id,
            invoiceId: p.invoice_id,
            paymentNumber: p.payment_number || undefined,
            paymentDate: p.payment_date,
            amount: Number(p.amount) || 0,
            paymentMethod: p.payment_method || 'Espèces',
            reference: p.reference || undefined,
            notes: p.notes || undefined,
            createdBy: p.created_by || undefined,
            createdAt: p.created_at
          }));
          const merged = mergeData(cachedInvoicePayments, parsed);
          setInvoicePayments(merged);
          await db.invoicePayments.setItem('data', merged);
        }

        // Update last sync time for next delta fetch
        await db.syncMetadata.setItem('lastSyncTime', syncTimestamp);
        lastRefreshTimeRef.current = Date.now();
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
      inFlightRefreshRef.current = null;
    }
  };

    inFlightRefreshRef.current = executeRefresh();
    return inFlightRefreshRef.current;
  }, [currentUser]);

  useEffect(() => { refreshData(); }, [refreshData]);

  // Realtime delta sync & live POS subscriptions
  useEffect(() => {
    if (!currentUser) return;

    let refreshTimeout: any = null;
    const debouncedRefresh = () => {
      if (refreshTimeout) clearTimeout(refreshTimeout);
      refreshTimeout = setTimeout(() => {
        refreshData(true);
      }, 1200);
    };

    const channel = supabase.channel('pos-realtime-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pos_transactions' }, debouncedRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pos_cash_sessions' }, debouncedRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pos_payments' }, debouncedRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pos_returns' }, debouncedRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pos_products' }, debouncedRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pos_stock_entries' }, debouncedRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pos_stock_movements' }, debouncedRefresh)
      .on('postgres_changes', { event: '*', schema: 'public' }, debouncedRefresh)
      .subscribe();

    // Heartbeat polling (toutes les 45s) en tâche de fond transparente
    const heartbeatInterval = setInterval(() => {
      if (navigator.onLine && document.visibilityState === 'visible') {
        refreshData(true);
      }
    }, 45000);
      
    return () => {
      if (refreshTimeout) clearTimeout(refreshTimeout);
      clearInterval(heartbeatInterval);
      supabase.removeChannel(channel);
    };
  }, [currentUser, refreshData]);

  // Auto-retry & Auto-réconciliation : relance la sync queue et résout les anomalies en arrière-plan
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!navigator.onLine) return;
      const queue = await db.syncQueue.getItem<any[]>('queue');
      if (queue && queue.length > 0) {
        console.log(`[AutoSync] ${queue.length} action(s) en attente. Tentative de synchronisation...`);
        await processSyncQueue();
      }
      // Rapprochement automatique silencieux si des erreurs ou des données non envoyées subsistent
      const errors = await db.syncErrors.getItem<any[]>('errors');
      if (errors && errors.length > 0) {
        await reconcileAllOfflineDataWithCloud().catch(() => {});
      }
    }, 60 * 1000); // vérification toutes les 60s
    return () => clearInterval(interval);
  }, []);

  // Écouteurs de réveil automatique : reconnexion réseau, focus de fenêtre et visibilité d'onglet
  useEffect(() => {
    if (!currentUser) return;

    const handleWakeup = async () => {
      if (navigator.onLine) {
        await processSyncQueue();
        await reconcileAllOfflineDataWithCloud().catch(() => {});
        refreshData(true);
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        refreshData(true);
      }
    };

    window.addEventListener('online', handleWakeup);
    window.addEventListener('focus', handleWakeup);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('online', handleWakeup);
      window.removeEventListener('focus', handleWakeup);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [currentUser, refreshData]);

  // Écoute les erreurs critiques de synchronisation et les affiche comme toast
  useEffect(() => {
    const handleSyncCriticalError = (e: Event) => {
      const detail = (e as CustomEvent).detail as { message: string };
      toast((t) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ fontWeight: 600, color: '#991B1B', fontSize: '13px' }}>
            {detail.message}
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={() => {
                toast.dismiss(t.id);
                window.location.hash = '#/pos/sync-errors';
                if (window.location.pathname !== '/pos/sync-errors') {
                  window.location.href = '/pos/sync-errors';
                }
              }}
              style={{
                background: '#DC2626',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                padding: '4px 10px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Voir les erreurs
            </button>
            <button
              onClick={() => toast.dismiss(t.id)}
              style={{
                background: 'transparent',
                color: '#6B7280',
                border: 'none',
                fontSize: '11px',
                cursor: 'pointer'
              }}
            >
              Fermer
            </button>
          </div>
        </div>
      ), {
        duration: 9000,
        style: {
          background: '#FEF2F2',
          border: '1px solid #FCA5A5',
          padding: '12px',
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

    const newAffaires = affaires.filter(a => a.clientId !== id);
    if (newAffaires.length !== affaires.length) {
      setAffaires(newAffaires);
      await db.affaires.setItem('data', newAffaires);
    }

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

  const addAffaire = async (affaireData: Omit<Affaire, 'id' | 'reference' | 'createdAt' | 'updatedAt'> | Affaire): Promise<Affaire> => {
    const now = new Date();
    const year = now.getFullYear();
    const seq = (affaires.length + 1).toString().padStart(4, '0');
    const reference = 'reference' in affaireData && (affaireData as any).reference ? (affaireData as any).reference : `AFF-${year}-${seq}`;
    const id = 'id' in affaireData && (affaireData as any).id ? (affaireData as any).id : uuidv4();
    const newAffaire: Affaire = {
      ...affaireData,
      id,
      reference,
      createdAt: ('createdAt' in affaireData && (affaireData as any).createdAt) || now.toISOString(),
      updatedAt: ('updatedAt' in affaireData && (affaireData as any).updatedAt) || now.toISOString()
    };
    const newAffaires = [...affaires, newAffaire];
    setAffaires(newAffaires);
    await db.affaires.setItem('data', newAffaires);
    await queueSyncAction('INSERT_AFFAIRE', newAffaire);
    return newAffaire;
  };

  const updateAffaire = async (id: string, data: Partial<Affaire>) => {
    const now = new Date().toISOString();
    const newAffaires = affaires.map(a => a.id === id ? { ...a, ...data, updatedAt: now } : a);
    setAffaires(newAffaires);
    await db.affaires.setItem('data', newAffaires);
    await queueSyncAction('UPDATE_AFFAIRE', { id, ...data, updatedAt: now });
  };

  const updateAffaireStatus = async (id: string, status: AffaireStatus) => {
    await updateAffaire(id, { status });
  };

  const deleteAffaire = async (id: string) => {
    const newAffaires = affaires.filter(a => a.id !== id);
    setAffaires(newAffaires);
    await db.affaires.setItem('data', newAffaires);
    await queueSyncAction('DELETE_AFFAIRE', { id });
  };

  const recordPayment = async (paymentData: Omit<FacturePaiement, 'id' | 'paymentNumber' | 'createdAt'> | FacturePaiement): Promise<FacturePaiement> => {
    const now = new Date();
    const year = now.getFullYear();
    const seq = (facturePaiements.length + 1).toString().padStart(4, '0');
    const paymentNumber = ('paymentNumber' in paymentData && paymentData.paymentNumber) ? paymentData.paymentNumber : `PAY-${year}-${seq}`;
    const id = ('id' in paymentData && paymentData.id) ? paymentData.id : uuidv4();
    const createdAt = ('createdAt' in paymentData && paymentData.createdAt) ? paymentData.createdAt : now.toISOString();

    const newPayment: FacturePaiement = {
      ...paymentData,
      id,
      paymentNumber,
      createdAt
    };

    const updatedPaiements = [newPayment, ...facturePaiements];
    setFacturePaiements(updatedPaiements);
    await db.facturePaiements.setItem('data', updatedPaiements);
    await queueSyncAction('INSERT_FACTURE_PAIEMENT', newPayment);

    // Calcul du statut de la vente associée en fonction des paiements réels
    const sale = sales.find(s => s.id === newPayment.venteId);
    if (sale) {
      const salePayments = updatedPaiements.filter(p => p.venteId === sale.id && p.status === 'VALIDE');
      const netPaid = salePayments.reduce((sum, p) => p.paymentType === 'ENCAISSEMENT' ? sum + p.amount : sum - p.amount, 0);
      let newSaleStatus: Sale['status'] = sale.status;
      if (netPaid >= sale.total) {
        newSaleStatus = 'Payée';
      } else if (netPaid > 0) {
        newSaleStatus = 'Enregistrée';
      }
      if (newSaleStatus !== sale.status) {
        await updateSaleStatus(sale.id, newSaleStatus);
      }

      // Synchroniser le montant déblocable de la commission liée
      const linkedCommission = commissions.find(c => c.saleId === sale.id);
      if (linkedCommission) {
        const totalTtc = sale.total || 1;
        const collectionRate = Math.max(0, Math.min(1, netPaid / totalTtc));
        const eligibleAmount = Math.round(linkedCommission.commissionAmount * collectionRate);
        if (eligibleAmount !== linkedCommission.eligibleAmount) {
          const updatedComm = { ...linkedCommission, eligibleAmount };
          const newCommissions = commissions.map(c => c.id === linkedCommission.id ? updatedComm : c);
          setCommissions(newCommissions);
          await db.commissions.setItem('data', newCommissions);
          await queueSyncAction('UPDATE_COMMISSION', { id: updatedComm.id, eligibleAmount });
        }
      }
    }

    return newPayment;
  };

  const addCout = async (coutData: Omit<Cout, 'id' | 'reference' | 'vatAmount' | 'amountTtc' | 'createdAt' | 'updatedAt'> | Cout): Promise<Cout> => {
    const now = new Date();
    const year = now.getFullYear();
    const seq = (couts.length + 1).toString().padStart(4, '0');
    const reference = ('reference' in coutData && coutData.reference) ? coutData.reference : `CST-${year}-${seq}`;
    const id = ('id' in coutData && coutData.id) ? coutData.id : uuidv4();
    const createdAt = ('createdAt' in coutData && coutData.createdAt) ? coutData.createdAt : now.toISOString();
    const updatedAt = ('updatedAt' in coutData && coutData.updatedAt) ? coutData.updatedAt : now.toISOString();

    const amountHt = coutData.amountHt;
    const vatRate = coutData.vatRate || 0;
    const vatAmount = ('vatAmount' in coutData && coutData.vatAmount !== undefined) ? coutData.vatAmount : Math.round(amountHt * (vatRate / 100));
    const amountTtc = ('amountTtc' in coutData && coutData.amountTtc !== undefined) ? coutData.amountTtc : amountHt + vatAmount;

    const newCout: Cout = {
      ...coutData,
      id,
      reference,
      vatRate,
      vatAmount,
      amountTtc,
      createdAt,
      updatedAt
    };

    const updatedCouts = [newCout, ...couts];
    setCouts(updatedCouts);
    await db.couts.setItem('data', updatedCouts);
    await queueSyncAction('INSERT_COUT', newCout);
    return newCout;
  };

  const updateCout = async (id: string, data: Partial<Cout>) => {
    const existing = couts.find(c => c.id === id);
    if (!existing) return;
    const amountHt = data.amountHt !== undefined ? data.amountHt : existing.amountHt;
    const vatRate = data.vatRate !== undefined ? data.vatRate : existing.vatRate;
    const vatAmount = data.vatAmount !== undefined ? data.vatAmount : Math.round(amountHt * (vatRate / 100));
    const amountTtc = data.amountTtc !== undefined ? data.amountTtc : amountHt + vatAmount;

    const updated: Cout = {
      ...existing,
      ...data,
      id,
      amountHt,
      vatRate,
      vatAmount,
      amountTtc,
      updatedAt: new Date().toISOString()
    };
    const updatedCouts = couts.map(c => c.id === id ? updated : c);
    setCouts(updatedCouts);
    await db.couts.setItem('data', updatedCouts);
    await queueSyncAction('UPDATE_COUT', { ...updated, id });
  };

  const deleteCout = async (id: string) => {
    const updatedCouts = couts.filter(c => c.id !== id);
    setCouts(updatedCouts);
    await db.couts.setItem('data', updatedCouts);
    await queueSyncAction('DELETE_COUT', { id });
  };

  const addObjectif = async (objData: Omit<Objectif, 'id' | 'createdAt'> | Objectif): Promise<Objectif> => {
    const id = ('id' in objData && objData.id) ? objData.id : uuidv4();
    const createdAt = ('createdAt' in objData && objData.createdAt) ? objData.createdAt : new Date().toISOString();
    const newObj: Objectif = {
      ...objData,
      id,
      createdAt
    };
    const updated = [newObj, ...objectifs];
    setObjectifs(updated);
    await db.objectifs.setItem('data', updated);
    await queueSyncAction('INSERT_OBJECTIF', newObj);
    return newObj;
  };

  const updateObjectif = async (id: string, data: Partial<Objectif>) => {
    const updated = objectifs.map(o => o.id === id ? { ...o, ...data } : o);
    setObjectifs(updated);
    await db.objectifs.setItem('data', updated);
    await queueSyncAction('UPDATE_OBJECTIF', { ...data, id });
  };

  const deleteObjectif = async (id: string) => {
    const updated = objectifs.filter(o => o.id !== id);
    setObjectifs(updated);
    await db.objectifs.setItem('data', updated);
    await queueSyncAction('DELETE_OBJECTIF', { id });
  };

  const proposePrime = async (primeData: Omit<Prime, 'id' | 'reference' | 'status' | 'createdAt' | 'updatedAt'>, comment?: string): Promise<Prime> => {
    const now = new Date();
    const year = now.getFullYear();
    const seq = (primes.length + 1).toString().padStart(4, '0');
    const reference = `PRM-${year}-${seq}`;
    const id = uuidv4();
    const createdAt = now.toISOString();
    const updatedAt = createdAt;

    const newPrime: Prime = {
      ...primeData,
      id,
      reference,
      status: 'PROPOSEE',
      createdAt,
      updatedAt
    };

    const updatedPrimes = [newPrime, ...primes];
    setPrimes(updatedPrimes);
    await db.primes.setItem('data', updatedPrimes);
    await queueSyncAction('INSERT_PRIME', newPrime);

    // Immutable Audit log
    const log: PrimeAuditLog = {
      id: uuidv4(),
      primeId: id,
      action: 'CREATION',
      actorId: currentUser?.id || 'system',
      actorRole: currentUser?.role || 'Directeur',
      previousState: null,
      newState: newPrime,
      comment: comment || primeData.justification || 'Proposition initiale de prime',
      createdAt
    };
    const updatedLogs = [log, ...primeAuditLogs];
    setPrimeAuditLogs(updatedLogs);
    await db.primeAuditLogs.setItem('data', updatedLogs);
    await queueSyncAction('INSERT_PRIME_AUDIT_LOG', log);

    return newPrime;
  };

  const validatePrime = async (primeId: string, comment?: string) => {
    const prime = primes.find(p => p.id === primeId);
    if (!prime) return;
    const previousState = { ...prime };
    const validatedBy = currentUser?.id;
    const updatedAt = new Date().toISOString();
    const updated: Prime = { ...prime, status: 'VALIDEE', validatedBy, updatedAt };

    const updatedPrimes = primes.map(p => p.id === primeId ? updated : p);
    setPrimes(updatedPrimes);
    await db.primes.setItem('data', updatedPrimes);
    await queueSyncAction('UPDATE_PRIME_STATUS', { id: primeId, status: 'VALIDEE', validatedBy });

    // Immutable Audit log
    const log: PrimeAuditLog = {
      id: uuidv4(),
      primeId,
      action: 'VALIDATION',
      actorId: currentUser?.id || 'system',
      actorRole: currentUser?.role || 'Directeur',
      previousState,
      newState: updated,
      comment: comment || 'Validation de la prime par la Direction',
      createdAt: updatedAt
    };
    const updatedLogs = [log, ...primeAuditLogs];
    setPrimeAuditLogs(updatedLogs);
    await db.primeAuditLogs.setItem('data', updatedLogs);
    await queueSyncAction('INSERT_PRIME_AUDIT_LOG', log);
  };

  const rejectPrime = async (primeId: string, comment?: string) => {
    const prime = primes.find(p => p.id === primeId);
    if (!prime) return;
    const previousState = { ...prime };
    const updatedAt = new Date().toISOString();
    const updated: Prime = { ...prime, status: 'REJETEE', updatedAt };

    const updatedPrimes = primes.map(p => p.id === primeId ? updated : p);
    setPrimes(updatedPrimes);
    await db.primes.setItem('data', updatedPrimes);
    await queueSyncAction('UPDATE_PRIME_STATUS', { id: primeId, status: 'REJETEE' });

    // Immutable Audit log
    const log: PrimeAuditLog = {
      id: uuidv4(),
      primeId,
      action: 'REJET',
      actorId: currentUser?.id || 'system',
      actorRole: currentUser?.role || 'Directeur',
      previousState,
      newState: updated,
      comment: comment || 'Rejet de la prime',
      createdAt: updatedAt
    };
    const updatedLogs = [log, ...primeAuditLogs];
    setPrimeAuditLogs(updatedLogs);
    await db.primeAuditLogs.setItem('data', updatedLogs);
    await queueSyncAction('INSERT_PRIME_AUDIT_LOG', log);
  };

  const payPrime = async (primeId: string, comment?: string) => {
    const prime = primes.find(p => p.id === primeId);
    if (!prime) return;
    const previousState = { ...prime };
    const updatedAt = new Date().toISOString();
    const updated: Prime = { ...prime, status: 'PAYEE', updatedAt };

    const updatedPrimes = primes.map(p => p.id === primeId ? updated : p);
    setPrimes(updatedPrimes);
    await db.primes.setItem('data', updatedPrimes);
    await queueSyncAction('UPDATE_PRIME_STATUS', { id: primeId, status: 'PAYEE' });

    // Immutable Audit log
    const log: PrimeAuditLog = {
      id: uuidv4(),
      primeId,
      action: 'PAIEMENT',
      actorId: currentUser?.id || 'system',
      actorRole: currentUser?.role || 'Directeur',
      previousState,
      newState: updated,
      comment: comment || 'Paiement effectif de la prime',
      createdAt: updatedAt
    };
    const updatedLogs = [log, ...primeAuditLogs];
    setPrimeAuditLogs(updatedLogs);
    await db.primeAuditLogs.setItem('data', updatedLogs);
    await queueSyncAction('INSERT_PRIME_AUDIT_LOG', log);
  };

  const updateScoringRule = async (id: string, data: Partial<ScoringRule>) => {
    const updated = scoringRules.map(r => r.id === id ? { ...r, ...data } : r);
    setScoringRules(updated);
    await db.scoringRules.setItem('data', updated);
    await queueSyncAction('UPDATE_SCORING_RULE', { ...data, id });
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
    // 1. Direct costs: Check table couts first if linked to affaire, otherwise sum of lines
    const affaireCouts = sale.affaireId
      ? couts.filter(c => c.affaireId === sale.affaireId && c.status !== 'ANNULE')
      : [];
    const directCostsFromTable = affaireCouts.reduce((sum, c) => sum + (c.amountHt || 0), 0);
    const linesCost = (sale.lines || []).reduce((sum, l) => sum + (l.costPrice || 0) * (l.quantity || 0), 0);
    const costTotal = directCostsFromTable > 0 ? directCostsFromTable : linesCost;

    const totalHt = sale.subtotal || 0;
    const marginAmount = Math.max(0, totalHt - costTotal);
    const marginPercent = totalHt > 0 ? Math.round((marginAmount / totalHt) * 10000) / 100 : 0;

    // 2. Commission Rate: Check service first, then global settings, fallback 10%
    const saleService = services.find(s => s.id === sale.serviceId);
    const commissionPercent = (saleService?.commissionRate !== undefined && saleService?.commissionRate !== null)
      ? saleService.commissionRate
      : (settings.commissionRate !== undefined ? settings.commissionRate : 10);

    const commissionAmount = Math.round(marginAmount * commissionPercent / 100);

    // 3. Commercial
    const clientCommercial = clients.find(c => c.id === sale.clientId)?.commercialId;
    const quoteCommercial = sale.quoteId ? quotes.find(q => q.id === sale.quoteId)?.commercialId : undefined;
    const affaireCommercial = sale.affaireId ? affaires.find(a => a.id === sale.affaireId)?.commercialId : undefined;
    const commercialId = sale.commercialId || clientCommercial || quoteCommercial || affaireCommercial || '';

    // 4. Initial eligible amount based on payments
    const payments = facturePaiements.filter(p => p.venteId === sale.id && p.status === 'VALIDE');
    const netReceived = payments.reduce((sum, p) => p.paymentType === 'ENCAISSEMENT' ? sum + p.amount : sum - p.amount, 0);
    const totalTtc = sale.total || 1;
    const collectionRate = Math.max(0, Math.min(1, netReceived / totalTtc));
    const eligibleAmount = Math.round(commissionAmount * collectionRate);

    return {
      id: uuidv4(),
      saleId: sale.id,
      affaireId: sale.affaireId,
      clientId: sale.clientId,
      commercialId,
      serviceId: sale.serviceId,
      totalHt,
      costTotal,
      marginAmount,
      marginPercent,
      commissionPercent,
      commissionAmount,
      paidAmount: 0,
      eligibleAmount,
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

  const updateCommissionStatus = async (id: string, status: Commission['status'], paidAmount?: number, notes?: string) => {
    const commission = commissions.find(c => c.id === id);
    if (!commission) return;
    const newPaidAmount = paidAmount !== undefined ? paidAmount : (status === 'Payée' ? commission.commissionAmount : (commission.paidAmount || 0));
    const newCommission: Commission = {
      ...commission,
      status,
      paidAmount: newPaidAmount,
      ...(notes !== undefined && { notes })
    };
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

  const convertProspect = async (prospectId: string, createAffaire: boolean = true): Promise<{ clientId: string; affaireId?: string }> => {
    const prospect = prospects.find(p => p.id === prospectId);
    if (!prospect) return { clientId: '' };
    const clientId = uuidv4();
    const newClient: Client = {
      id: clientId,
      name: prospect.name,
      email: prospect.email || '',
      phone: prospect.phone || '',
      contact: prospect.name,
      company: prospect.company || '',
      address: prospect.address || '',
      status: 'Actif',
      commercialId: prospect.commercialId,
      serviceId: prospect.serviceId
    };
    await addClient(newClient);
    await updateProspect(prospectId, { status: 'Converti' });

    let affaireId: string | undefined;
    if (createAffaire) {
      const initialAffaire = await addAffaire({
        title: prospect.need ? `Projet : ${prospect.need.slice(0, 60)}` : `Affaire - ${prospect.name}`,
        clientId: clientId,
        serviceId: prospect.serviceId || (services[0]?.id || ''),
        commercialId: prospect.commercialId,
        description: prospect.comments || prospect.need || '',
        status: 'QUALIFIEE',
        estimatedAmountHt: prospect.budget || 0,
        probability: prospect.interestLevel === 'Très élevé' ? 80 : prospect.interestLevel === 'Élevé' ? 60 : 40,
        source: prospect.source || 'Prospection'
      });
      affaireId = initialAffaire.id;
    }

    return { clientId, affaireId };
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

  const submitV2WeeklyReport = async (id: string) => {
    const report = v2WeeklyReports.find(r => r.id === id);
    if (!report) return;
    const now = new Date().toISOString();
    const updated: V2WeeklyReport = {
      ...report,
      status: 'Soumis',
      submittedAt: now,
      updatedAt: now
    };
    const newReports = v2WeeklyReports.map(r => r.id === id ? updated : r);
    setV2WeeklyReports(newReports);
    await db.v2WeeklyReports.setItem('data', newReports);
    await queueSyncAction('UPDATE_V2_WEEKLY_REPORT', updated);

    // Lock all daily reports of this week for the author
    const startDate = new Date(report.weekStart + 'T00:00:00');
    const authorDailyReports = v2DailyReports.filter(d => {
      if (d.authorId !== report.authorId) return false;
      const dDate = new Date(d.date + 'T00:00:00');
      const diffDays = Math.round((dDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays <= 6;
    });

    if (authorDailyReports.length > 0) {
      const lockedDaily = v2DailyReports.map(d => {
        if (authorDailyReports.some(ad => ad.id === d.id)) {
          return { ...d, status: 'Soumis' as const, updatedAt: now };
        }
        return d;
      });
      setV2DailyReports(lockedDaily);
      await db.v2DailyReports.setItem('data', lockedDaily);
    }

    // Seule la Direction reçoit les rapports soumis
    const author = users.find(u => u.id === report.authorId);
    const authorName = author?.name || 'Un collaborateur';
    const directionUsers = users.filter(u => 
      ['Directeur', 'Directeur adjoint', 'SuperAdmin'].includes(u.role)
    );
    if (directionUsers.length > 0) {
      const newNotifs: AppNotification[] = directionUsers.map(d => ({
        id: uuidv4(),
        user_id: d.id,
        title: 'Nouveau rapport hebdomadaire soumis',
        message: `${authorName} a soumis son rapport pour la semaine du ${new Date(report.weekStart + 'T00:00:00').toLocaleDateString('fr-FR')}.`,
        type: 'info',
        is_read: false,
        link: `/crm/rapports?tab=supervision&week=${report.weekStart}`,
        created_at: now
      }));
      const updatedNotifs = [...notifications, ...newNotifs];
      setNotifications(updatedNotifs);
      await db.notifications.setItem('data', updatedNotifs);
      for (const notif of newNotifs) {
        await queueSyncAction('INSERT_NOTIFICATION', notif);
      }
    }
  };

  const sendWeeklyReportReminder = async (userIds: string[], weekStart: string) => {
    if (!userIds || userIds.length === 0) return;
    const now = new Date().toISOString();
    const weekDateStr = new Date(weekStart + 'T00:00:00').toLocaleDateString('fr-FR');
    const newNotifs: AppNotification[] = userIds.map(uid => ({
      id: uuidv4(),
      user_id: uid,
      title: 'Rappel Direction : Rapport Hebdo en attente',
      message: `La Direction vous invite à compléter et soumettre votre rapport d'activité pour la semaine du ${weekDateStr}.`,
      type: 'warning',
      is_read: false,
      link: `/crm/rapports?week=${weekStart}&tab=report`,
      created_at: now
    }));
    const updatedNotifs = [...notifications, ...newNotifs];
    setNotifications(updatedNotifs);
    await db.notifications.setItem('data', updatedNotifs);
    for (const notif of newNotifs) {
      await queueSyncAction('INSERT_NOTIFICATION', notif);
    }
  };

  const reviewV2WeeklyReport = async (id: string, comment?: string, status: 'Validé' | 'Relu' = 'Validé') => {
    const report = v2WeeklyReports.find(r => r.id === id);
    if (!report) return;
    const now = new Date().toISOString();
    const updated: V2WeeklyReport = {
      ...report,
      status,
      directorComment: comment !== undefined ? comment : report.directorComment,
      reviewedAt: now,
      reviewedBy: currentUser?.id,
      updatedAt: now
    };
    const newReports = v2WeeklyReports.map(r => r.id === id ? updated : r);
    setV2WeeklyReports(newReports);
    await db.v2WeeklyReports.setItem('data', newReports);
    await queueSyncAction('UPDATE_V2_WEEKLY_REPORT', updated);

    // Notify the author
    if (report.authorId && report.authorId !== currentUser?.id) {
      const authorNotif: AppNotification = {
        id: uuidv4(),
        user_id: report.authorId,
        title: `Rapport hebdomadaire ${status === 'Validé' ? 'validé' : 'relu'}`,
        message: `Votre rapport pour la semaine du ${new Date(report.weekStart + 'T00:00:00').toLocaleDateString('fr-FR')} a été ${status === 'Validé' ? 'validé par la Direction' : 'relu'}.`,
        type: 'success',
        is_read: false,
        link: '/mon-rapport-hebdo',
        created_at: now
      };
      const updatedNotifs = [...notifications, authorNotif];
      setNotifications(updatedNotifs);
      await db.notifications.setItem('data', updatedNotifs);
    }
  };

  const deleteV2WeeklyReport = async (id: string) => {
    const newReports = v2WeeklyReports.filter(r => r.id !== id);
    setV2WeeklyReports(newReports);
    await db.v2WeeklyReports.setItem('data', newReports);
    await queueSyncAction('DELETE_V2_WEEKLY_REPORT', { id });
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
    const serviceId = service.id && service.id.length > 20 ? service.id : uuidv4();
    const cleanService = { ...service, id: serviceId, name: service.name.trim() };
    const newServices = [...services.filter(s => s.id !== cleanService.id), cleanService];
    setServices(newServices);
    await db.services.setItem('data', newServices);
    await queueSyncAction('INSERT_SERVICE', cleanService);
  };

  const updateService = async (id: string, service: Partial<Service>) => {
    const updatedName = service.name !== undefined ? service.name.trim() : undefined;
    const newServices = services.map(s => s.id === id ? { ...s, ...service, ...(updatedName ? { name: updatedName } : {}) } : s);
    setServices(newServices);
    await db.services.setItem('data', newServices);
    await queueSyncAction('UPDATE_SERVICE', { id, name: updatedName, description: service.description, members: service.members, commissionRate: service.commissionRate });
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
    setPosCategories(prev => {
      const next = [...prev, newCat];
      void db.posCategories.setItem('data', next);
      return next;
    });
    await queueSyncAction('INSERT_POS_CATEGORY', newCat);
  };
  const updatePosCategory = async (id: string, data: Partial<PosCategory>) => {
    setPosCategories(prev => {
      const next = prev.map(c => c.id === id ? { ...c, ...data } : c);
      void db.posCategories.setItem('data', next);
      return next;
    });
    await queueSyncAction('UPDATE_POS_CATEGORY', { id, ...data });
  };
  const deletePosCategory = async (id: string) => {
    setPosCategories(prev => {
      const next = prev.filter(c => c.id !== id);
      void db.posCategories.setItem('data', next);
      return next;
    });
    await queueSyncAction('DELETE_POS_CATEGORY', { id });
  };

  const addPosBrand = async (brand: PosBrand) => {
    const newBrand = { ...brand, id: brand.id || uuidv4() };
    setPosBrands(prev => {
      const next = [...prev, newBrand];
      void db.posBrands.setItem('data', next);
      return next;
    });
    await queueSyncAction('INSERT_POS_BRAND', newBrand);
  };
  const updatePosBrand = async (id: string, data: Partial<PosBrand>) => {
    setPosBrands(prev => {
      const next = prev.map(b => b.id === id ? { ...b, ...data } : b);
      void db.posBrands.setItem('data', next);
      return next;
    });
    await queueSyncAction('UPDATE_POS_BRAND', { id, ...data });
  };
  const deletePosBrand = async (id: string) => {
    setPosBrands(prev => {
      const next = prev.filter(b => b.id !== id);
      void db.posBrands.setItem('data', next);
      return next;
    });
    await queueSyncAction('DELETE_POS_BRAND', { id });
  };

  const addPosSupplier = async (supplier: PosSupplier) => {
    const newSupplier = { ...supplier, id: supplier.id || uuidv4() };
    setPosSuppliers(prev => {
      const next = [...prev, newSupplier];
      void db.posSuppliers.setItem('data', next);
      return next;
    });
    await queueSyncAction('INSERT_POS_SUPPLIER', newSupplier);
  };
  const updatePosSupplier = async (id: string, data: Partial<PosSupplier>) => {
    setPosSuppliers(prev => {
      const next = prev.map(s => s.id === id ? { ...s, ...data } : s);
      void db.posSuppliers.setItem('data', next);
      return next;
    });
    await queueSyncAction('UPDATE_POS_SUPPLIER', { id, ...data });
  };
  const deletePosSupplier = async (id: string) => {
    setPosSuppliers(prev => {
      const next = prev.filter(s => s.id !== id);
      void db.posSuppliers.setItem('data', next);
      return next;
    });
    await queueSyncAction('DELETE_POS_SUPPLIER', { id });
  };

  const addPosProduct = async (product: PosProduct) => {
    const safeProduct = { ...product };
    if (safeProduct.quantity !== undefined) {
      safeProduct.quantity = Math.max(0, safeProduct.quantity);
    }
    const newProduct = { ...safeProduct, id: safeProduct.id || uuidv4() };
    setPosProducts(prev => {
      const next = [...prev, newProduct];
      void db.posProducts.setItem('data', next);
      return next;
    });
    await queueSyncAction('INSERT_POS_PRODUCT', newProduct);
  };
  const updatePosProduct = async (id: string, data: Partial<PosProduct>) => {
    if (data.quantity !== undefined) {
      data.quantity = Math.max(0, data.quantity);
    }
    const oldProduct = posProducts.find(p => p.id === id);
    if (oldProduct && data.quantity !== undefined && data.quantity !== oldProduct.quantity && oldProduct.family !== 'Service') {
      try {
        await addPosStockMovement({
          productId: id,
          type: 'Ajustement Manuel',
          quantity: data.quantity - oldProduct.quantity,
          createdBy: currentUser?.name,
          notes: 'Modification manuelle'
        });
      } catch (err) {
        console.warn('Ajustement de stock ignoré pour ce produit :', err);
      }
    }
    setPosProducts(prev => {
      const next = prev.map(p => p.id === id ? { ...p, ...data } : p);
      void db.posProducts.setItem('data', next);
      return next;
    });
    const mergedProd = oldProduct ? { ...oldProduct, ...data, id } : { id, ...data };
    await queueSyncAction('UPDATE_POS_PRODUCT', mergedProd);
  };
  const deletePosProduct = async (id: string) => {
    setPosProducts(prev => {
      const next = prev.filter(p => p.id !== id);
      void db.posProducts.setItem('data', next);
      return next;
    });
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
    setPosStockEntries(prev => {
      const next = [...prev, newEntry];
      void db.posStockEntries.setItem('data', next);
      return next;
    });
    await queueSyncAction('INSERT_POS_STOCK_ENTRY', newEntry);

    if (newEntry.status === 'Validé') {
      await adjustProductStock(newEntry.lines.map(l => ({ productId: l.productId, quantity: l.quantity })), true, { type: 'Approvisionnement', reference: newEntry.reference, createdBy: newEntry.createdBy });
    }
  };

  const updatePosStockEntry = async (id: string, data: Partial<PosStockEntry>) => {
    const oldEntry = posStockEntries.find(e => e.id === id);
    setPosStockEntries(prev => {
      const next = prev.map(e => e.id === id ? { ...e, ...data } : e);
      void db.posStockEntries.setItem('data', next);
      return next;
    });
    await queueSyncAction('UPDATE_POS_STOCK_ENTRY', { id, ...data });

    if (oldEntry && oldEntry.status !== 'Validé' && data.status === 'Validé') {
      const entryLines = data.lines || oldEntry.lines;
      await adjustProductStock(entryLines.map(l => ({ productId: l.productId, quantity: l.quantity })), true, { type: 'Approvisionnement', reference: oldEntry.reference, createdBy: currentUser?.name });
    } else if (oldEntry && oldEntry.status === 'Validé' && data.status === 'Annulé') {
      const entryLines = data.lines || oldEntry.lines;
      await adjustProductStock(entryLines.map(l => ({ productId: l.productId, quantity: -l.quantity })), true, { type: 'Approvisionnement', reference: oldEntry.reference, createdBy: currentUser?.name, notes: 'Annulation' });
    }
  };
  const deletePosStockEntry = async (id: string) => {
    setPosStockEntries(prev => {
      const next = prev.filter(e => e.id !== id);
      void db.posStockEntries.setItem('data', next);
      return next;
    });
    await queueSyncAction('DELETE_POS_STOCK_ENTRY', { id });
  };

  const addPosInventory = async (inventory: PosInventory) => {
    const newInv = { ...inventory, id: inventory.id || uuidv4(), lines: inventory.lines.map(l => ({ ...l, id: l.id || uuidv4() })) };
    setPosInventories(prev => {
      const next = [...prev, newInv];
      void db.posInventories.setItem('data', next);
      return next;
    });
    await queueSyncAction('INSERT_POS_INVENTORY', newInv);

    if (newInv.status === 'Terminé') {
      await adjustProductStock(newInv.lines.map(l => ({ productId: l.productId, quantity: l.difference })), true, { type: 'Inventaire', reference: newInv.reference, createdBy: newInv.createdBy });
    }
  };

  const updatePosInventory = async (id: string, data: Partial<PosInventory>) => {
    const oldInv = posInventories.find(i => i.id === id);
    setPosInventories(prev => {
      const next = prev.map(i => i.id === id ? { ...i, ...data } : i);
      void db.posInventories.setItem('data', next);
      return next;
    });
    await queueSyncAction('UPDATE_POS_INVENTORY', { id, ...data });

    if (oldInv && oldInv.status !== 'Terminé' && data.status === 'Terminé') {
      const invLines = data.lines || oldInv.lines;
      await adjustProductStock(invLines.map(l => ({ productId: l.productId, quantity: l.difference })), true, { type: 'Inventaire', reference: oldInv.reference, createdBy: currentUser?.name });
    }
  };
  const deletePosInventory = async (id: string) => {
    setPosInventories(prev => {
      const next = prev.filter(i => i.id !== id);
      void db.posInventories.setItem('data', next);
      return next;
    });
    await queueSyncAction('DELETE_POS_INVENTORY', { id });
  };

  const addPosCashSession = async (session: PosCashSession) => {
    if (session.status === 'Ouverte' && posCashSessions.some(s => s.status === 'Ouverte')) {
      alert('Une session de caisse est déjà ouverte. Fermez-la avant d\'en ouvrir une nouvelle.');
      return;
    }
    const newSession = { ...session, id: session.id || uuidv4() };
    const nextSessions = [...posCashSessions, newSession];
    setPosCashSessions(nextSessions);
    await safeSet(db.posCashSessions, nextSessions);
    await queueSyncAction('INSERT_POS_CASH_SESSION', newSession);
  };
  const updatePosCashSession = async (id: string, data: Partial<PosCashSession>) => {
    const nextSessions = posCashSessions.map(s => s.id === id ? { ...s, ...data } : s);
    setPosCashSessions(nextSessions);
    await safeSet(db.posCashSessions, nextSessions);
    await queueSyncAction('UPDATE_POS_CASH_SESSION', { id, ...data });
  };

  const addPosStockMovement = async (movement: Omit<PosStockMovement, 'id' | 'date'>) => {
    const rawPid = movement.productId;
    if (!rawPid || rawPid.startsWith('srv-') || rawPid === '00000000-0000-0000-0000-000000000000' || movement.reference?.startsWith('SRV-')) {
      return; // Ne jamais créer de mouvement de stock pour les services retirés
    }
    const resolvedPid = resolveProductUuid(rawPid, movement.reference);
    if (!isUuid(resolvedPid)) {
      return;
    }
    const newMovement: PosStockMovement = {
      ...movement,
      productId: resolvedPid,
      id: uuidv4(),
      date: new Date().toISOString()
    };
    setPosStockMovements(prev => {
      const next = [...prev, newMovement];
      void db.posStockMovements.setItem('data', next);
      return next;
    });
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
      if (!d.productId || d.productId.startsWith('srv-') || d.productId === '00000000-0000-0000-0000-000000000000') continue;
      const product = posProducts.find(p => p.id === d.productId);
      if (product && (product.family === 'Service' || (product.reference && product.reference.startsWith('SRV-')))) continue; // Les services (photocopies, scans...) ne sont pas stockés
      const resolvedPid = resolveProductUuid(d.productId, product?.reference);
      if (!isUuid(resolvedPid)) continue;
      map.set(resolvedPid, (map.get(resolvedPid) || 0) + d.quantity);
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

    const updatedQtyMap = new Map<string, number>();
    setPosProducts(prev => {
      const next = prev.map(p => {
        const delta = map.get(p.id);
        if (delta !== undefined) {
          const newQty = Math.max(0, p.quantity + delta);
          updatedQtyMap.set(p.id, newQty);
          return { ...p, quantity: newQty };
        }
        return p;
      });
      void db.posProducts.setItem('data', next);
      return next;
    });

    if (pushSync) {
      for (const [pid, delta] of map) {
        const currentProd = posProducts.find(p => p.id === pid);
        const fallbackQty = currentProd ? Math.max(0, currentProd.quantity + delta) : undefined;
        const newQty = updatedQtyMap.get(pid) ?? fallbackQty;
        if (newQty !== undefined) {
          await queueSyncAction('UPDATE_POS_PRODUCT', { id: pid, quantity: newQty });
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
    const nextTxs = [newTx, ...posTransactions.filter(t => t.id !== newTx.id)];
    setPosTransactions(nextTxs);
    await safeSet(db.posTransactions, nextTxs);

    // Alimenter le registre local des paiements (répartition Finance à jour immédiatement)
    const newPayments = [...posPayments, ...newTx.payments.map(p => ({ ...p, transactionId: newTx.id }))];
    setPosPayments(newPayments);
    await safeSet(db.posPayments, newPayments);

    await queueSyncAction('INSERT_POS_TRANSACTION', newTx);
    // Update local product quantities (le serveur est décrémenté par INSERT_POS_TRANSACTION)
    await adjustProductStock(newTx.lines.map(l => ({ productId: l.productId, quantity: -l.quantity })), false, { type: 'Vente', reference: newTx.transactionNumber, createdBy: currentUser?.name });
  };
  const updatePosTransaction = async (id: string, data: Partial<PosTransaction>) => {
    const nextTxs = posTransactions.map(t => t.id === id ? { ...t, ...data } : t);
    setPosTransactions(nextTxs);
    await safeSet(db.posTransactions, nextTxs);
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

  const clearPosSalesHistory = async () => {
    setPosTransactions([]);
    setPosPayments([]);
    setPosReturns([]);
    await db.posTransactions.clear();
    await db.posPayments.clear();
    await db.posReturns.clear();
    await queueSyncAction('CLEAR_POS_SALES_HISTORY', {});
  };

  const deletePosMovementsByDateRange = async (startDate: string, endDate: string) => {
    // 1. Identifier et filtrer les transactions & paiements dans la plage
    const txsToDelete = posTransactions.filter(t => {
      const day = toLocalDayKey(t.date);
      return day >= startDate && day <= endDate;
    });
    const txIdsToDelete = new Set(txsToDelete.map(t => t.id));

    const nextTxs = posTransactions.filter(t => !txIdsToDelete.has(t.id));
    const nextPayments = posPayments.filter(p => !p.transactionId || !txIdsToDelete.has(p.transactionId));

    // 2. Filtrer les retours
    const nextReturns = posReturns.filter(r => {
      const day = toLocalDayKey(r.date);
      return !(day >= startDate && day <= endDate) && !txIdsToDelete.has(r.transactionId || '');
    });

    // 3. Filtrer les sessions de caisse
    const nextSessions = posCashSessions.filter(s => {
      const day = toLocalDayKey(s.openedAt);
      return !(day >= startDate && day <= endDate);
    });

    setPosTransactions(nextTxs);
    setPosPayments(nextPayments);
    setPosReturns(nextReturns);
    setPosCashSessions(nextSessions);

    await db.posTransactions.setItem('data', nextTxs);
    await db.posPayments.setItem('data', nextPayments);
    await db.posReturns.setItem('data', nextReturns);
    await db.posCashSessions.setItem('data', nextSessions);

    await queueSyncAction('DELETE_POS_MOVEMENTS_BY_RANGE', { startDate, endDate });
  };

  const addPosDiscount = async (discount: PosDiscount) => {
    const newDiscount = { ...discount, id: discount.id || uuidv4() };
    setPosDiscounts(prev => {
      const next = [...prev, newDiscount];
      void db.posDiscounts.setItem('data', next);
      return next;
    });
    await queueSyncAction('INSERT_POS_DISCOUNT', newDiscount);
  };
  const updatePosDiscount = async (id: string, data: Partial<PosDiscount>) => {
    setPosDiscounts(prev => {
      const next = prev.map(d => d.id === id ? { ...d, ...data } : d);
      void db.posDiscounts.setItem('data', next);
      return next;
    });
    await queueSyncAction('UPDATE_POS_DISCOUNT', { id, ...data });
  };
  const deletePosDiscount = async (id: string) => {
    setPosDiscounts(prev => {
      const next = prev.filter(d => d.id !== id);
      void db.posDiscounts.setItem('data', next);
      return next;
    });
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
    const nextReturns = [...posReturns, newReturn];
    setPosReturns(nextReturns);
    await safeSet(db.posReturns, nextReturns);
    await queueSyncAction('INSERT_POS_RETURN', newReturn);
    
    // Restore product quantities for returned items (stock + qty) with movement tracking
    await adjustProductStock(
      newReturn.lines.map(l => ({ productId: l.productId, quantity: l.quantity })), 
      true, 
      { type: 'Retour', reference: newReturn.returnNumber, createdBy: currentUser?.name || newReturn.createdBy, notes: 'Retour marchandise' }
    );
    
    // Deduct product quantities for exchanged items (stock - qty) with movement tracking
    if (newReturn.exchangeLines && newReturn.exchangeLines.length > 0) {
      await adjustProductStock(
        newReturn.exchangeLines.map(l => ({ productId: l.productId, quantity: -l.quantity })), 
        true, 
        { type: 'Vente', reference: newReturn.returnNumber, createdBy: currentUser?.name || newReturn.createdBy, notes: 'Échange marchandise' }
      );
    }

    // Marquer la transaction 'Retournée' ou 'Retour partiel'
    if (newReturn.transactionId) {
      await recomputeTransactionStatus(newReturn.transactionId);
    }
  };
  const updatePosReturn = async (id: string, data: Partial<PosReturn>) => {
    const nextReturns = posReturns.map(r => r.id === id ? { ...r, ...data } : r);
    setPosReturns(nextReturns);
    await safeSet(db.posReturns, nextReturns);
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
      await adjustProductStock(
        ret.lines.map(l => ({ productId: l.productId, quantity: -l.quantity })), 
        true,
        { type: 'Ajustement Manuel', reference: ret.returnNumber, createdBy: currentUser?.name, notes: 'Annulation retour (déduction)' }
      );
      
      // Les articles échangés reviennent (stock +)
      if (ret.exchangeLines && ret.exchangeLines.length > 0) {
        await adjustProductStock(
          ret.exchangeLines.map(l => ({ productId: l.productId, quantity: l.quantity })), 
          true,
          { type: 'Ajustement Manuel', reference: ret.returnNumber, createdBy: currentUser?.name, notes: 'Annulation retour (réintégration échange)' }
        );
      }
    }

    if (ret.transactionId) {
      await recomputeTransactionStatus(ret.transactionId);
    }
  };

  // Product Module CRUD
  const addProductCompletion = async (completion: ProductCompletion) => {
    const newCompletion = { ...completion, id: completion.id || uuidv4() };
    setProductCompletions(prev => {
      const next = [...prev, newCompletion];
      void db.productCompletions.setItem('data', next);
      return next;
    });
    await queueSyncAction('INSERT_PRODUCT_COMPLETION', newCompletion);
  };
  const updateProductCompletion = async (id: string, data: Partial<ProductCompletion>) => {
    setProductCompletions(prev => {
      const next = prev.map(c => c.id === id ? { ...c, ...data } : c);
      void db.productCompletions.setItem('data', next);
      return next;
    });
    await queueSyncAction('UPDATE_PRODUCT_COMPLETION', { id, ...data });
  };
  const deleteProductCompletion = async (id: string) => {
    setProductCompletions(prev => {
      const next = prev.filter(c => c.id !== id);
      void db.productCompletions.setItem('data', next);
      return next;
    });
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
    setImportSessions(prev => {
      const next = prev.filter(s => s.id !== id);
      void db.importSessions.setItem('data', next);
      return next;
    });
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
          posCatalogueEnabled: user.posCatalogueEnabled,
          crmPrestationsEnabled: user.crmPrestationsEnabled ?? true,
          crmCaisseEnabled: user.crmCaisseEnabled ?? true,
          crmMaintenanceEnabled: user.crmMaintenanceEnabled ?? true,
          crmStocksEnabled: user.crmStocksEnabled ?? true,
          crmTiersEnabled: user.crmTiersEnabled ?? true,
          crmCommerciauxEnabled: user.crmCommerciauxEnabled ?? true,
          crmCommissionsEnabled: user.crmCommissionsEnabled ?? true,
          crmFacturationEnabled: user.crmFacturationEnabled ?? true
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
      posRole: user.posRole || null,
      crmPrestationsEnabled: user.crmPrestationsEnabled ?? true,
      crmCaisseEnabled: user.crmCaisseEnabled ?? true,
      crmMaintenanceEnabled: user.crmMaintenanceEnabled ?? true,
      crmStocksEnabled: user.crmStocksEnabled ?? true,
      crmTiersEnabled: user.crmTiersEnabled ?? true,
      crmCommerciauxEnabled: user.crmCommerciauxEnabled ?? true,
      crmCommissionsEnabled: user.crmCommissionsEnabled ?? true,
      crmFacturationEnabled: user.crmFacturationEnabled ?? true
    };
    const newUsers = [...users, newUser];
    setUsers(newUsers);
    await db.profiles.setItem('data', newUsers);
  };

  const updateUser = async (id: string, data: Partial<User>) => {
    const newUsers = users.map(u => u.id === id ? { ...u, ...data } : u);
    setUsers(newUsers);
    await db.profiles.setItem('data', newUsers);
    const payload: any = { id };
    if (data.name !== undefined) payload.name = data.name;
    if (data.role !== undefined) payload.role = data.role;
    if (data.posRole !== undefined) payload.pos_role = data.posRole || null;
    if (data.serviceId !== undefined) payload.service_id = data.serviceId || null;
    if (data.posReturnsEnabled !== undefined) payload.pos_returns_enabled = data.posReturnsEnabled;
    if (data.posCatalogueEnabled !== undefined) payload.pos_catalogue_enabled = data.posCatalogueEnabled;
    if (data.posSupplyEnabled !== undefined) payload.pos_supply_enabled = data.posSupplyEnabled;
    if (data.posInventoryEnabled !== undefined) payload.pos_inventory_enabled = data.posInventoryEnabled;
    if (data.posStockEnabled !== undefined) payload.pos_stock_enabled = data.posStockEnabled;
    if (data.crmPrestationsEnabled !== undefined) payload.crm_prestations_enabled = data.crmPrestationsEnabled;
    if (data.crmCaisseEnabled !== undefined) payload.crm_caisse_enabled = data.crmCaisseEnabled;
    if (data.crmMaintenanceEnabled !== undefined) payload.crm_maintenance_enabled = data.crmMaintenanceEnabled;
    if (data.crmStocksEnabled !== undefined) payload.crm_stocks_enabled = data.crmStocksEnabled;
    if (data.crmTiersEnabled !== undefined) payload.crm_tiers_enabled = data.crmTiersEnabled;
    if (data.crmCommerciauxEnabled !== undefined) payload.crm_commerciaux_enabled = data.crmCommerciauxEnabled;
    if (data.crmCommissionsEnabled !== undefined) payload.crm_commissions_enabled = data.crmCommissionsEnabled;
    if (data.crmFacturationEnabled !== undefined) payload.crm_facturation_enabled = data.crmFacturationEnabled;
    if (currentUser && currentUser.id === id) {
      updateCurrentUser(data);
    }

    await queueSyncAction('UPDATE_PROFILE', payload);
    try {
      if (navigator.onLine) {
        const { id: _, ...fieldsToUpdate } = payload;
        await supabase.from('profiles').update(fieldsToUpdate).eq('id', id);
      }
    } catch (e) {
      console.warn('Erreur direct profile update:', e);
    }
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

  const addCrmDocument = async (
    file: File,
    optionsOrUploaderId?: { uploaderId?: string; folderId?: string; affaireId?: string; clientId?: string; category?: CrmDocument['category']; isShared?: boolean } | string,
    folderIdParam?: string
  ): Promise<CrmDocument> => {
    const id = uuidv4();
    let uploaderId: string | undefined = currentUser?.id;
    let folderId: string | undefined = undefined;
    let affaireId: string | undefined = undefined;
    let clientId: string | undefined = undefined;
    let category: CrmDocument['category'] = 'Autre';
    let isShared: boolean = false;

    if (typeof optionsOrUploaderId === 'string') {
      uploaderId = optionsOrUploaderId;
      folderId = folderIdParam;
    } else if (optionsOrUploaderId && typeof optionsOrUploaderId === 'object') {
      uploaderId = optionsOrUploaderId.uploaderId || currentUser?.id;
      folderId = optionsOrUploaderId.folderId;
      affaireId = optionsOrUploaderId.affaireId;
      clientId = optionsOrUploaderId.clientId;
      category = optionsOrUploaderId.category || 'Autre';
      isShared = !!optionsOrUploaderId.isShared;
    }

    const newDoc: CrmDocument = {
      id,
      name: file.name,
      type: file.type || 'application/octet-stream',
      sizeBytes: file.size,
      filePath: `${uploaderId || 'shared'}/${id}_${file.name}`,
      uploaderId,
      folderId,
      affaireId,
      clientId,
      category,
      isShared,
      createdAt: new Date().toISOString()
    };

    const newDocs = [newDoc, ...crmDocuments];
    setCrmDocuments(newDocs);
    await db.documents.setItem('data', newDocs);
    await db.documentFiles.setItem(id, file);
    await queueSyncAction('INSERT_DOCUMENT', newDoc);
    return newDoc;
  };

  const updateCrmDocument = async (id: string, updates: Partial<CrmDocument>, newFileBlob?: Blob) => {
    const doc = crmDocuments.find(d => d.id === id);
    if (!doc) return;

    let updatedSize = updates.sizeBytes ?? doc.sizeBytes;
    let updatedType = updates.type ?? doc.type;

    if (newFileBlob) {
      updatedSize = newFileBlob.size;
      if (newFileBlob.type) {
        updatedType = newFileBlob.type;
      }
      await db.documentFiles.setItem(id, newFileBlob);
    }

    const updatedDoc: CrmDocument = {
      ...doc,
      ...updates,
      type: updatedType,
      sizeBytes: updatedSize,
      updatedAt: new Date().toISOString()
    };

    const newDocs = crmDocuments.map(d => d.id === id ? updatedDoc : d);
    setCrmDocuments(newDocs);
    await db.documents.setItem('data', newDocs);

    await queueSyncAction('UPDATE_DOCUMENT', {
      id,
      updates: updatedDoc,
      hasNewFile: Boolean(newFileBlob)
    });
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

  const getCrmDocumentBlob = async (doc: CrmDocument): Promise<Blob | null> => {
    let blob = await db.documentFiles.getItem<Blob>(doc.id);
    if (!blob) {
      try {
        const { data, error } = await supabase.storage.from('crm_documents').download(doc.filePath);
        if (!error && data) {
          blob = data;
          await db.documentFiles.setItem(doc.id, blob);
        } else {
          // Fallback: try signed URL if direct download had an issue
          const { data: signedData } = await supabase.storage.from('crm_documents').createSignedUrl(doc.filePath, 3600);
          if (signedData?.signedUrl) {
            const resp = await fetch(signedData.signedUrl);
            if (resp.ok) {
              blob = await resp.blob();
              await db.documentFiles.setItem(doc.id, blob);
            }
          }
        }
      } catch (err) {
        console.error('[GED] Erreur récupération document blob:', err);
      }
    }
    return blob || null;
  };

  const downloadCrmDocument = async (doc: CrmDocument) => {
    const blob = await getCrmDocumentBlob(doc);
    if (!blob) {
      alert('Impossible de charger ce document depuis le stockage.');
      return;
    }
    const isMobileDevice = typeof navigator !== 'undefined' && (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
    const url = URL.createObjectURL(blob);
    if (isMobileDevice) {
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.name;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
        window.open(url, '_blank');
      }
    } else {
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  const addCrmFolder = async (
    name: string,
    ownerId: string,
    parentId?: string,
    color: string = '#0D9488',
    isShared: boolean = false
  ): Promise<CrmFolder> => {
    const newFolder: CrmFolder = {
      id: uuidv4(),
      name,
      ownerId,
      parentId,
      color: color || '#0D9488',
      isShared,
      createdAt: new Date().toISOString()
    };
    const newFolders = [...crmFolders, newFolder];
    setCrmFolders(newFolders);
    await db.crmFolders.setItem('data', newFolders);
    await queueSyncAction('INSERT_CRM_FOLDER', newFolder);
    return newFolder;
  };

  const updateCrmFolder = async (id: string, data: Partial<CrmFolder>) => {
    const newFolders = crmFolders.map(f => f.id === id ? { ...f, ...data } : f);
    setCrmFolders(newFolders);
    await db.crmFolders.setItem('data', newFolders);
    await queueSyncAction('UPDATE_CRM_FOLDER', { id, ...data });
  };

  const deleteCrmFolder = async (id: string) => {
    const newFolders = crmFolders.filter(f => f.id !== id);
    setCrmFolders(newFolders);
    await db.crmFolders.setItem('data', newFolders);
    await queueSyncAction('DELETE_CRM_FOLDER', { id });
    
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

  const removeSuspendedCart = useCallback((id: string) => {
    setSuspendedCarts(prev => prev.filter(c => c.id !== id));
  }, []);

  // ==========================================
  // CRM MODULES RESPONSABLES CRUD
  // ==========================================

  // Module 5: Tiers (Clients, Fournisseurs, Partenaires)
  const addCrmTier = async (tier: ClientFournisseur) => {
    const id = tier.id || uuidv4();
    const item: ClientFournisseur = {
      ...tier,
      id,
      cree_par: tier.cree_par || currentUser?.id,
      cree_par_nom: tier.cree_par_nom || currentUser?.name,
      created_at: tier.created_at || new Date().toISOString()
    };
    const next = [item, ...crmTiers.filter(t => t.id !== id)];
    setCrmTiers(next);
    await db.crmTiers.setItem('data', next);
    try {
      if (navigator.onLine) {
        await supabase.from('clients_fournisseurs').upsert(item);
      }
    } catch (e) {
      console.warn('Erreur synchro tier CRM:', e);
    }
  };

  const updateCrmTier = async (id: string, tier: Partial<ClientFournisseur>) => {
    const next = crmTiers.map(t => t.id === id ? { ...t, ...tier } : t);
    setCrmTiers(next);
    await db.crmTiers.setItem('data', next);
    try {
      if (navigator.onLine) {
        await supabase.from('clients_fournisseurs').update(tier).eq('id', id);
      }
    } catch (e) {
      console.warn('Erreur synchro tier CRM:', e);
    }
  };

  const deleteCrmTier = async (id: string) => {
    const next = crmTiers.filter(t => t.id !== id);
    setCrmTiers(next);
    await db.crmTiers.setItem('data', next);
    try {
      if (navigator.onLine) {
        await supabase.from('clients_fournisseurs').delete().eq('id', id);
      }
    } catch (e) {
      console.warn('Erreur suppression tier CRM:', e);
    }
  };

  // Module 6: Agents Commerciaux
  const addCrmCommercial = async (comm: AgentCommercial) => {
    const id = comm.id || uuidv4();
    const item: AgentCommercial = {
      ...comm,
      id,
      taux_commission_defaut: comm.taux_commission_defaut ?? 0,
      total_ventes: comm.total_ventes ?? 0,
      contrats_clos_count: comm.contrats_clos_count ?? 0,
      cree_par: comm.cree_par || currentUser?.id,
      cree_par_nom: comm.cree_par_nom || currentUser?.name,
      created_at: comm.created_at || new Date().toISOString()
    };
    const next = [item, ...crmCommerciaux.filter(c => c.id !== id)];
    setCrmCommerciaux(next);
    await db.crmCommerciaux.setItem('data', next);
    try {
      if (navigator.onLine) {
        await supabase.from('agents_commerciaux').upsert(item);
      }
    } catch (e) {
      console.warn('Erreur synchro commercial CRM:', e);
    }
  };

  const updateCrmCommercial = async (id: string, comm: Partial<AgentCommercial>) => {
    const next = crmCommerciaux.map(c => c.id === id ? { ...c, ...comm } : c);
    setCrmCommerciaux(next);
    await db.crmCommerciaux.setItem('data', next);
    try {
      if (navigator.onLine) {
        await supabase.from('agents_commerciaux').update(comm).eq('id', id);
      }
    } catch (e) {
      console.warn('Erreur synchro commercial CRM:', e);
    }
  };

  const deleteCrmCommercial = async (id: string) => {
    const next = crmCommerciaux.filter(c => c.id !== id);
    setCrmCommerciaux(next);
    await db.crmCommerciaux.setItem('data', next);
    try {
      if (navigator.onLine) {
        await supabase.from('agents_commerciaux').delete().eq('id', id);
      }
    } catch (e) {
      console.warn('Erreur suppression commercial CRM:', e);
    }
  };

  // Helper pour synchroniser les fiches de commissions pour une prestation
  const syncCommissionsForPrestation = async (prest: PrestationCommande) => {
    const newCommissionsToSave: CommissionPrestation[] = [];

    // Commission Apporteur (si montant > 0)
    if ((prest.commission_apporteur || 0) > 0 && (prest.apporteur_id || prest.apporteur_nom)) {
      const existing = crmCommissions.find(c => c.prestation_id === prest.id && c.type_beneficiaire === 'APPORTEUR');
      const comm: CommissionPrestation = {
        id: existing?.id || uuidv4(),
        prestation_id: prest.id,
        type_beneficiaire: 'APPORTEUR',
        beneficiaire_id: prest.apporteur_id || undefined,
        beneficiaire_nom: prest.apporteur_nom || 'Apporteur',
        montant: prest.commission_apporteur || 0,
        statut: existing?.statut || 'EN_ATTENTE',
        date_reglement: existing?.date_reglement,
        mode_reglement: existing?.mode_reglement,
        cree_par: prest.cree_par,
        created_at: existing?.created_at || new Date().toISOString()
      };
      newCommissionsToSave.push(comm);
    }

    // Commission Agent Commercial (si montant > 0)
    if ((prest.commission_agent || 0) > 0 && (prest.commercial_id || prest.commercial_nom)) {
      const existing = crmCommissions.find(c => c.prestation_id === prest.id && c.type_beneficiaire === 'AGENT_COMMERCIAL');
      const comm: CommissionPrestation = {
        id: existing?.id || uuidv4(),
        prestation_id: prest.id,
        type_beneficiaire: 'AGENT_COMMERCIAL',
        beneficiaire_id: prest.commercial_id || undefined,
        beneficiaire_nom: prest.commercial_nom || 'Commercial',
        montant: prest.commission_agent || 0,
        statut: existing?.statut || 'EN_ATTENTE',
        date_reglement: existing?.date_reglement,
        mode_reglement: existing?.mode_reglement,
        cree_par: prest.cree_par,
        created_at: existing?.created_at || new Date().toISOString()
      };
      newCommissionsToSave.push(comm);
    }

    // Commission Responsable de Service (si montant > 0)
    if ((prest.commission_resp_service || 0) > 0 && (prest.resp_service_id || prest.resp_service_nom)) {
      const existing = crmCommissions.find(c => c.prestation_id === prest.id && c.type_beneficiaire === 'RESPONSABLE');
      const comm: CommissionPrestation = {
        id: existing?.id || uuidv4(),
        prestation_id: prest.id,
        type_beneficiaire: 'RESPONSABLE',
        beneficiaire_id: prest.resp_service_id || undefined,
        beneficiaire_nom: prest.resp_service_nom || 'Responsable de Service',
        montant: prest.commission_resp_service || 0,
        statut: existing?.statut || 'EN_ATTENTE',
        date_reglement: existing?.date_reglement,
        mode_reglement: existing?.mode_reglement,
        cree_par: prest.cree_par,
        created_at: existing?.created_at || new Date().toISOString()
      };
      newCommissionsToSave.push(comm);
    }

    if (newCommissionsToSave.length > 0) {
      const remaining = crmCommissions.filter(c => c.prestation_id !== prest.id);
      const updatedComms = [...newCommissionsToSave, ...remaining];
      setCrmCommissions(updatedComms);
      await db.crmCommissions.setItem('data', updatedComms);
      try {
        if (navigator.onLine) {
          for (const comm of newCommissionsToSave) {
            await supabase.from('commissions_prestations').upsert(comm);
          }
        }
      } catch (e) {
        console.warn('Erreur synchro commissions auto:', e);
      }
    }
  };

  // Module 1: Prestations & Commandes
  const addCrmPrestation = async (prest: PrestationCommande) => {
    const id = prest.id || uuidv4();
    const now = new Date();
    const year = now.getFullYear();
    const seq = (crmPrestations.length + 1).toString().padStart(4, '0');
    const reference = prest.reference || `CMD-${year}-${seq}`;

    // 11-column financial formulas
    const quantite = Number(prest.quantite) || 1;
    const cout_unitaire_achat = Number(prest.cout_unitaire_achat) || 0;
    const cout_final_achat = quantite * cout_unitaire_achat;
    const prix_vente_unitaire = Number(prest.prix_vente_unitaire) || 0;
    const prix_client_final = quantite * prix_vente_unitaire;
    const marge_interne = prix_client_final - cout_final_achat;
    const taux_commission_app = Number(prest.taux_commission_app) || 0;
    const commission_apporteur = prest.commission_apporteur !== undefined ? Number(prest.commission_apporteur) : (taux_commission_app > 0 ? (prix_client_final * taux_commission_app) / 100 : 0);
    const commission_resp_service = Number(prest.commission_resp_service) || 0;
    const commission_agent = Number(prest.commission_agent) || 0;
    const benefice_net = marge_interne - (commission_apporteur + commission_resp_service + commission_agent);

    const item: PrestationCommande = {
      ...prest,
      id,
      reference,
      quantite,
      cout_unitaire_achat,
      cout_final_achat,
      prix_vente_unitaire,
      prix_client_final,
      marge_interne,
      taux_commission_app,
      commission_apporteur,
      commission_resp_service,
      commission_agent,
      benefice_net,
      statut: prest.statut || 'BROUILLON',
      cree_par: prest.cree_par || currentUser?.id || '',
      cree_par_nom: prest.cree_par_nom || currentUser?.name,
      date_creation: prest.date_creation || now.toISOString().split('T')[0]
    };

    const next = [item, ...crmPrestations.filter(p => p.id !== id)];
    setCrmPrestations(next);
    await db.crmPrestations.setItem('data', next);
    try {
      if (navigator.onLine) {
        await supabase.from('prestations_commandes').upsert(item);
      }
    } catch (e) {
      console.warn('Erreur synchro prestation CRM:', e);
    }

    // Auto-generate commissions if > 0
    await syncCommissionsForPrestation(item);

    // Update commercial metrics if assigned
    if (item.commercial_id) {
      const comm = crmCommerciaux.find(c => c.id === item.commercial_id);
      if (comm) {
        const total_ventes = (comm.total_ventes || 0) + item.prix_client_final;
        const contrats_clos_count = (comm.contrats_clos_count || 0) + 1;
        await updateCrmCommercial(comm.id, { total_ventes, contrats_clos_count });
      }
    }
  };

  const updateCrmPrestation = async (id: string, prest: Partial<PrestationCommande>) => {
    const current = crmPrestations.find(p => p.id === id);
    if (!current) return;
    const quantite = prest.quantite !== undefined ? Number(prest.quantite) : current.quantite;
    const cout_unitaire_achat = prest.cout_unitaire_achat !== undefined ? Number(prest.cout_unitaire_achat) : current.cout_unitaire_achat;
    const cout_final_achat = quantite * cout_unitaire_achat;
    const prix_vente_unitaire = prest.prix_vente_unitaire !== undefined ? Number(prest.prix_vente_unitaire) : current.prix_vente_unitaire;
    const prix_client_final = quantite * prix_vente_unitaire;
    const marge_interne = prix_client_final - cout_final_achat;
    const taux_commission_app = prest.taux_commission_app !== undefined ? Number(prest.taux_commission_app) : (current.taux_commission_app || 0);
    const commission_apporteur = prest.commission_apporteur !== undefined ? Number(prest.commission_apporteur) : (current.commission_apporteur || 0);
    const commission_resp_service = prest.commission_resp_service !== undefined ? Number(prest.commission_resp_service) : (current.commission_resp_service || 0);
    const commission_agent = prest.commission_agent !== undefined ? Number(prest.commission_agent) : (current.commission_agent || 0);
    const benefice_net = marge_interne - (commission_apporteur + commission_resp_service + commission_agent);

    const updated: PrestationCommande = {
      ...current,
      ...prest,
      quantite,
      cout_unitaire_achat,
      cout_final_achat,
      prix_vente_unitaire,
      prix_client_final,
      marge_interne,
      taux_commission_app,
      commission_apporteur,
      commission_resp_service,
      commission_agent,
      benefice_net
    };

    const next = crmPrestations.map(p => p.id === id ? updated : p);
    setCrmPrestations(next);
    await db.crmPrestations.setItem('data', next);
    try {
      if (navigator.onLine) {
        await supabase.from('prestations_commandes').update(updated).eq('id', id);
      }
    } catch (e) {
      console.warn('Erreur synchro prestation CRM:', e);
    }

    await syncCommissionsForPrestation(updated);
  };

  const deleteCrmPrestation = async (id: string) => {
    const next = crmPrestations.filter(p => p.id !== id);
    setCrmPrestations(next);
    await db.crmPrestations.setItem('data', next);
    try {
      if (navigator.onLine) {
        await supabase.from('prestations_commandes').delete().eq('id', id);
      }
    } catch (e) {
      console.warn('Erreur suppression prestation CRM:', e);
    }
  };

  const encaisserCrmPrestation = async (id: string, modeReglement: string = 'ESPECES') => {
    const prest = crmPrestations.find(p => p.id === id);
    if (!prest) return;
    const now = new Date().toISOString();
    const today = now.split('T')[0];

    // 1. Marquer la prestation PAYEE
    await updateCrmPrestation(id, {
      statut: 'PAYEE',
      date_validation: today
    });

    // 2. Générer l'encaissement dans le journal de caisse (ENTREE)
    const mvtCaisse: MouvementCaisse = {
      id: uuidv4(),
      type: 'ENTREE',
      categorie: 'PRESTATION',
      montant: prest.prix_client_final,
      date_mouvement: today,
      mode_reglement: (modeReglement as ModeReglement) || 'ESPECES',
      motif: `Encaissement commande ${prest.reference} - ${prest.designation} (${prest.client_nom})`,
      module_code: 'PRESTATIONS',
      cree_par: currentUser?.id || prest.cree_par,
      cree_par_nom: currentUser?.name || prest.cree_par_nom,
      reference_piece: prest.reference,
      created_at: now
    };
    await addCrmMouvementCaisse(mvtCaisse);
  };

  // Module 2: Dépenses & Journal de Caisse
  const addCrmMouvementCaisse = async (mvt: MouvementCaisse) => {
    const id = mvt.id || uuidv4();
    const item: MouvementCaisse = {
      ...mvt,
      id,
      montant: Number(mvt.montant) || 0,
      cree_par: mvt.cree_par || currentUser?.id || '',
      cree_par_nom: mvt.cree_par_nom || currentUser?.name,
      created_at: mvt.created_at || new Date().toISOString()
    };
    const next = [item, ...crmCaisse.filter(c => c.id !== id)];
    setCrmCaisse(next);
    await db.crmCaisse.setItem('data', next);
    try {
      if (navigator.onLine) {
        await supabase.from('mouvements_caisse').upsert(item);
      }
    } catch (e) {
      console.warn('Erreur synchro caisse CRM:', e);
    }
  };

  const deleteCrmMouvementCaisse = async (id: string) => {
    const next = crmCaisse.filter(c => c.id !== id);
    setCrmCaisse(next);
    await db.crmCaisse.setItem('data', next);
    try {
      if (navigator.onLine) {
        await supabase.from('mouvements_caisse').delete().eq('id', id);
      }
    } catch (e) {
      console.warn('Erreur suppression caisse CRM:', e);
    }
  };

  // Module 7: Commissions
  const updateCrmCommissionStatus = async (id: string, status: CommissionPrestation['statut']) => {
    const next = crmCommissions.map(c => c.id === id ? { ...c, statut: status } : c);
    setCrmCommissions(next);
    await db.crmCommissions.setItem('data', next);
    try {
      if (navigator.onLine) {
        await supabase.from('commissions_prestations').update({ statut: status }).eq('id', id);
      }
    } catch (e) {
      console.warn('Erreur synchro statut commission:', e);
    }
  };

  const payerCrmCommission = async (id: string, modeReglement: string = 'ESPECES') => {
    const comm = crmCommissions.find(c => c.id === id);
    if (!comm) return;
    const now = new Date().toISOString();
    const today = now.split('T')[0];

    const updatedComm: CommissionPrestation = {
      ...comm,
      statut: 'PAYEE',
      date_reglement: today,
      mode_reglement: modeReglement
    };
    const nextComms = crmCommissions.map(c => c.id === id ? updatedComm : c);
    setCrmCommissions(nextComms);
    await db.crmCommissions.setItem('data', nextComms);
    try {
      if (navigator.onLine) {
        await supabase.from('commissions_prestations').update({
          statut: 'PAYEE',
          date_reglement: today,
          mode_reglement: modeReglement
        }).eq('id', id);
      }
    } catch (e) {
      console.warn('Erreur synchro paiement commission:', e);
    }

    // Auto-create cash expense (SORTIE)
    const prest = crmPrestations.find(p => p.id === comm.prestation_id);
    const ref = prest ? prest.reference : 'COMM';
    const mvtCaisse: MouvementCaisse = {
      id: uuidv4(),
      type: 'SORTIE',
      categorie: 'COMMISSION',
      montant: comm.montant,
      date_mouvement: today,
      mode_reglement: (modeReglement as ModeReglement) || 'ESPECES',
      motif: `Règlement commission ${comm.type_beneficiaire} - ${ref} (${comm.beneficiaire_nom})`,
      module_code: 'COMMISSIONS',
      cree_par: currentUser?.id || '',
      cree_par_nom: currentUser?.name,
      reference_piece: ref,
      created_at: now
    };
    await addCrmMouvementCaisse(mvtCaisse);
  };

  // Module 4: Stocks & Consommables
  const addCrmArticle = async (art: CatalogueArticle) => {
    const id = art.id || uuidv4();
    const item: CatalogueArticle = {
      ...art,
      id,
      quantite_stock: Number(art.quantite_stock) || 0,
      seuil_alerte: Number(art.seuil_alerte) || 5,
      cout_unitaire_achat: Number(art.cout_unitaire_achat) || 0,
      prix_unitaire_vente: Number(art.prix_unitaire_vente) || 0,
      cree_par: art.cree_par || currentUser?.id,
      cree_par_nom: art.cree_par_nom || currentUser?.name,
      created_at: art.created_at || new Date().toISOString(),
      updated_at: art.updated_at || new Date().toISOString()
    };
    const next = [item, ...crmArticles.filter(a => a.id !== id)];
    setCrmArticles(next);
    await db.crmArticles.setItem('data', next);
    try {
      if (navigator.onLine) {
        await supabase.from('catalogue_articles').upsert(item);
      }
    } catch (e) {
      console.warn('Erreur synchro article CRM:', e);
    }
  };

  const updateCrmArticle = async (id: string, art: Partial<CatalogueArticle>) => {
    const now = new Date().toISOString();
    const next = crmArticles.map(a => a.id === id ? { ...a, ...art, updated_at: now } : a);
    setCrmArticles(next);
    await db.crmArticles.setItem('data', next);
    try {
      if (navigator.onLine) {
        await supabase.from('catalogue_articles').update({ ...art, updated_at: now }).eq('id', id);
      }
    } catch (e) {
      console.warn('Erreur synchro article CRM:', e);
    }
  };

  const deleteCrmArticle = async (id: string) => {
    const next = crmArticles.filter(a => a.id !== id);
    setCrmArticles(next);
    await db.crmArticles.setItem('data', next);
    try {
      if (navigator.onLine) {
        await supabase.from('catalogue_articles').delete().eq('id', id);
      }
    } catch (e) {
      console.warn('Erreur suppression article CRM:', e);
    }
  };

  // Module 3: Maintenance & Interventions
  const addCrmIntervention = async (interv: InterventionMaintenance) => {
    const id = interv.id || uuidv4();
    const now = new Date();
    const year = now.getFullYear();
    const seq = (crmMaintenance.length + 1).toString().padStart(4, '0');
    const reference = interv.reference || `MNT-${year}-${seq}`;
    const quantite = Number(interv.quantite) || 1;
    const prix_unitaire = Number(interv.prix_unitaire) || 0;
    const prix_total = quantite * prix_unitaire;

    const item: InterventionMaintenance = {
      ...interv,
      id,
      reference,
      quantite,
      prix_unitaire,
      prix_total,
      priorite: interv.priorite || 'MOYENNE',
      statut: interv.statut || 'NOUVEAU',
      cree_par: interv.cree_par || currentUser?.id || '',
      cree_par_nom: interv.cree_par_nom || currentUser?.name,
      created_at: interv.created_at || now.toISOString(),
      updated_at: interv.updated_at || now.toISOString()
    };
    const next = [item, ...crmMaintenance.filter(m => m.id !== id)];
    setCrmMaintenance(next);
    await db.crmMaintenance.setItem('data', next);
    try {
      if (navigator.onLine) {
        await supabase.from('interventions_maintenance').upsert(item);
      }
    } catch (e) {
      console.warn('Erreur synchro intervention CRM:', e);
    }
  };

  const updateCrmIntervention = async (id: string, interv: Partial<InterventionMaintenance>) => {
    const now = new Date().toISOString();
    const current = crmMaintenance.find(m => m.id === id);
    const quantite = interv.quantite !== undefined ? Number(interv.quantite) : (current?.quantite || 1);
    const prix_unitaire = interv.prix_unitaire !== undefined ? Number(interv.prix_unitaire) : (current?.prix_unitaire || 0);
    const prix_total = quantite * prix_unitaire;

    const next = crmMaintenance.map(m => m.id === id ? { ...m, ...interv, quantite, prix_unitaire, prix_total, updated_at: now } : m);
    setCrmMaintenance(next);
    await db.crmMaintenance.setItem('data', next);
    try {
      if (navigator.onLine) {
        await supabase.from('interventions_maintenance').update({ ...interv, quantite, prix_unitaire, prix_total, updated_at: now }).eq('id', id);
      }
    } catch (e) {
      console.warn('Erreur synchro intervention CRM:', e);
    }
  };

  const deleteCrmIntervention = async (id: string) => {
    const next = crmMaintenance.filter(m => m.id !== id);
    setCrmMaintenance(next);
    await db.crmMaintenance.setItem('data', next);
    try {
      if (navigator.onLine) {
        await supabase.from('interventions_maintenance').delete().eq('id', id);
      }
    } catch (e) {
      console.warn('Erreur suppression intervention CRM:', e);
    }
  };

  const addCrmTechnicien = async (tech: TechnicienMaintenance) => {
    const id = tech.id || uuidv4();
    const item: TechnicienMaintenance = {
      ...tech,
      id,
      statut: tech.statut || 'DISPONIBLE',
      cree_par: tech.cree_par || currentUser?.id || '',
      cree_par_nom: tech.cree_par_nom || currentUser?.name,
      created_at: tech.created_at || new Date().toISOString(),
      updated_at: tech.updated_at || new Date().toISOString()
    };
    const next = [item, ...crmTechniciens.filter(t => t.id !== id)];
    setCrmTechniciens(next);
    await db.crmTechniciens.setItem('data', next);
    try {
      if (navigator.onLine) {
        await supabase.from('techniciens_maintenance').upsert(item);
      }
    } catch (e) {
      console.warn('Erreur synchro technicien CRM:', e);
    }
  };

  const updateCrmTechnicien = async (id: string, tech: Partial<TechnicienMaintenance>) => {
    const now = new Date().toISOString();
    const next = crmTechniciens.map(t => t.id === id ? { ...t, ...tech, updated_at: now } : t);
    setCrmTechniciens(next);
    await db.crmTechniciens.setItem('data', next);
    try {
      if (navigator.onLine) {
        await supabase.from('techniciens_maintenance').update({ ...tech, updated_at: now }).eq('id', id);
      }
    } catch (e) {
      console.warn('Erreur synchro technicien CRM:', e);
    }
  };

  const deleteCrmTechnicien = async (id: string) => {
    const next = crmTechniciens.filter(t => t.id !== id);
    setCrmTechniciens(next);
    await db.crmTechniciens.setItem('data', next);
    try {
      if (navigator.onLine) {
        await supabase.from('techniciens_maintenance').delete().eq('id', id);
      }
    } catch (e) {
      console.warn('Erreur suppression technicien CRM:', e);
    }
  };

  // Helper statut facture
  const computeInvoiceStatus = (totalAmount: number, paidAmount: number, dueDate: string, currentStatus?: InvoiceStatus): InvoiceStatus => {
    if (currentStatus === 'ANNULÉE') return 'ANNULÉE';
    if (currentStatus === 'BROUILLON') return 'BROUILLON';
    if (paidAmount >= totalAmount && totalAmount > 0) return 'PAYÉE';
    if (paidAmount > 0) return 'PARTIELLEMENT_PAYÉE';
    if (dueDate) {
      const today = new Date().toISOString().split('T')[0];
      if (today > dueDate) return 'EN_RETARD';
    }
    return 'ÉMISE';
  };

  const addInvoice = async (invoiceData: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'> | Invoice): Promise<Invoice> => {
    const id = ('id' in invoiceData && invoiceData.id) ? invoiceData.id : uuidv4();
    const now = new Date().toISOString();
    
    // Calculs de rentabilité et suivi
    const totalAmount = Number(invoiceData.totalAmount) || 0;
    const costAmount = Number(invoiceData.costAmount) || 0;
    const grossMargin = totalAmount - costAmount;
    const commissionRate = invoiceData.commissionRate !== undefined ? Number(invoiceData.commissionRate) : 10;
    const commissionAmount = grossMargin > 0 ? Math.round(grossMargin * (commissionRate / 100)) : 0;
    const hinovMargin = grossMargin - commissionAmount;

    // Détermination de la période
    const d = invoiceData.deliveryDate || invoiceData.issueDate || now;
    const dateObj = new Date(d);
    const periodYear = invoiceData.periodYear || (isNaN(dateObj.getFullYear()) ? new Date().getFullYear() : dateObj.getFullYear());
    const periodMonth = invoiceData.periodMonth || (isNaN(dateObj.getMonth()) ? new Date().getMonth() + 1 : dateObj.getMonth() + 1);

    const amountPaid = invoiceData.amountPaid !== undefined ? Number(invoiceData.amountPaid) : 0;
    const remainingAmount = invoiceData.remainingAmount !== undefined ? Number(invoiceData.remainingAmount) : Math.max(0, totalAmount - amountPaid);

    const newInvoice: Invoice = {
      ...invoiceData,
      id,
      periodYear,
      periodMonth,
      totalAmount,
      costAmount,
      grossMargin,
      commissionRate,
      commissionAmount,
      hinovMargin,
      amountPaid,
      remainingAmount,
      status: invoiceData.status || (remainingAmount === 0 && totalAmount > 0 ? 'PAYÉE' : (amountPaid > 0 ? 'PARTIELLEMENT_PAYÉE' : 'ÉMISE')),
      createdBy: invoiceData.createdBy || currentUser?.id,
      createdAt: now,
      updatedAt: now,
      items: (invoiceData.items || []).map(item => ({
        ...item,
        id: item.id || uuidv4(),
        invoiceId: id
      }))
    };

    const next = [newInvoice, ...invoices.filter(i => i.id !== id)];
    setInvoices(next);
    await db.invoices.setItem('data', next);

    try {
      if (navigator.onLine) {
        const dbInvoice: any = {
          id: newInvoice.id,
          invoice_number: newInvoice.invoiceNumber,
          quote_id: newInvoice.quoteId || null,
          client_id: newInvoice.clientId || null,
          client_nom: newInvoice.clientName || null,
          commercial_id: newInvoice.commercialId || null,
          commercial_nom: newInvoice.commercialName || null,
          service_id: newInvoice.serviceId || null,
          service_nom: newInvoice.serviceName || null,
          category: newInvoice.category || null,
          period_year: newInvoice.periodYear,
          period_month: newInvoice.periodMonth,
          issue_date: newInvoice.issueDate,
          delivery_date: newInvoice.deliveryDate || null,
          payment_date: newInvoice.paymentDate || null,
          payment_terms: newInvoice.paymentTerms || '30 jours',
          due_date: newInvoice.dueDate,
          subtotal: newInvoice.subtotal,
          tax_amount: newInvoice.taxAmount || 0,
          discount_amount: newInvoice.discountAmount || 0,
          total_amount: newInvoice.totalAmount,
          cost_amount: newInvoice.costAmount || 0,
          commission_rate: newInvoice.commissionRate || 10,
          commission_amount: newInvoice.commissionAmount || 0,
          gross_margin: newInvoice.grossMargin || 0,
          hinov_margin: newInvoice.hinovMargin || 0,
          amount_paid: newInvoice.amountPaid || 0,
          remaining_amount: newInvoice.remainingAmount,
          status: newInvoice.status,
          notes: newInvoice.notes || null,
          created_by: newInvoice.createdBy || null,
          created_at: newInvoice.createdAt,
          updated_at: newInvoice.updatedAt
        };
        await supabase.from('invoices').upsert(dbInvoice);

        if (newInvoice.items && newInvoice.items.length > 0) {
          const dbItems = newInvoice.items.map(it => ({
            id: it.id,
            invoice_id: id,
            prestation_id: it.prestationId || null,
            description: it.description,
            quantity: it.quantity,
            unit_price: it.unitPrice,
            cost_price: it.costPrice || 0,
            discount_percent: it.discountPercent || 0,
            tax_rate: it.taxRate || 0,
            total: it.total,
            created_at: it.createdAt || now
          }));
          await supabase.from('invoice_items').upsert(dbItems);
        }
      }
    } catch (e) {
      console.warn('Erreur synchro création facture:', e);
    }

    return newInvoice;
  };

  const updateInvoice = async (id: string, data: Partial<Invoice>) => {
    const existing = invoices.find(i => i.id === id);
    if (!existing) return;
    const now = new Date().toISOString();

    const totalAmount = data.totalAmount !== undefined ? Number(data.totalAmount) : (existing.totalAmount || 0);
    const costAmount = data.costAmount !== undefined ? Number(data.costAmount) : (existing.costAmount || 0);
    const grossMargin = totalAmount - costAmount;
    const commissionRate = data.commissionRate !== undefined ? Number(data.commissionRate) : (existing.commissionRate || 10);
    const commissionAmount = grossMargin > 0 ? Math.round(grossMargin * (commissionRate / 100)) : 0;
    const hinovMargin = grossMargin - commissionAmount;
    const amountPaid = data.amountPaid !== undefined ? Number(data.amountPaid) : (existing.amountPaid || 0);
    const remainingAmount = data.remainingAmount !== undefined ? Number(data.remainingAmount) : Math.max(0, totalAmount - amountPaid);

    const updated: Invoice = {
      ...existing,
      ...data,
      id,
      totalAmount,
      costAmount,
      grossMargin,
      commissionRate,
      commissionAmount,
      hinovMargin,
      amountPaid,
      remainingAmount,
      updatedAt: now
    };

    const next = invoices.map(i => i.id === id ? updated : i);
    setInvoices(next);
    await db.invoices.setItem('data', next);

    try {
      if (navigator.onLine) {
        const dbUpdate: any = {
          updated_at: now
        };
        if (data.invoiceNumber !== undefined) dbUpdate.invoice_number = data.invoiceNumber;
        if (data.quoteId !== undefined) dbUpdate.quote_id = data.quoteId || null;
        if (data.clientId !== undefined) dbUpdate.client_id = data.clientId || null;
        if (data.clientName !== undefined) dbUpdate.client_nom = data.clientName || null;
        if (data.commercialId !== undefined) dbUpdate.commercial_id = data.commercialId || null;
        if (data.commercialName !== undefined) dbUpdate.commercial_nom = data.commercialName || null;
        if (data.serviceId !== undefined) dbUpdate.service_id = data.serviceId || null;
        if (data.serviceName !== undefined) dbUpdate.service_nom = data.serviceName || null;
        if (data.category !== undefined) dbUpdate.category = data.category || null;
        if (data.periodYear !== undefined) dbUpdate.period_year = data.periodYear;
        if (data.periodMonth !== undefined) dbUpdate.period_month = data.periodMonth;
        if (data.issueDate !== undefined) dbUpdate.issue_date = data.issueDate;
        if (data.deliveryDate !== undefined) dbUpdate.delivery_date = data.deliveryDate || null;
        if (data.paymentDate !== undefined) dbUpdate.payment_date = data.paymentDate || null;
        if (data.paymentTerms !== undefined) dbUpdate.payment_terms = data.paymentTerms;
        if (data.dueDate !== undefined) dbUpdate.due_date = data.dueDate;
        if (data.subtotal !== undefined) dbUpdate.subtotal = data.subtotal;
        if (data.taxAmount !== undefined) dbUpdate.tax_amount = data.taxAmount;
        if (data.discountAmount !== undefined) dbUpdate.discount_amount = data.discountAmount;
        dbUpdate.total_amount = totalAmount;
        dbUpdate.cost_amount = costAmount;
        dbUpdate.gross_margin = grossMargin;
        dbUpdate.commission_rate = commissionRate;
        dbUpdate.commission_amount = commissionAmount;
        dbUpdate.hinov_margin = hinovMargin;
        dbUpdate.amount_paid = amountPaid;
        dbUpdate.remaining_amount = remainingAmount;
        if (data.status !== undefined) dbUpdate.status = data.status;
        if (data.notes !== undefined) dbUpdate.notes = data.notes;

        await supabase.from('invoices').update(dbUpdate).eq('id', id);

        if (data.items) {
          await supabase.from('invoice_items').delete().eq('invoice_id', id);
          if (data.items.length > 0) {
            const dbItems = data.items.map(it => ({
              id: it.id || uuidv4(),
              invoice_id: id,
              prestation_id: it.prestationId || null,
              description: it.description,
              quantity: it.quantity,
              unit_price: it.unitPrice,
              cost_price: it.costPrice || 0,
              discount_percent: it.discountPercent || 0,
              tax_rate: it.taxRate || 0,
              total: it.total,
              created_at: it.createdAt || now
            }));
            await supabase.from('invoice_items').upsert(dbItems);
          }
        }
      }
    } catch (e) {
      console.warn('Erreur synchro update facture:', e);
    }
  };

  const updateInvoiceStatus = async (id: string, status: InvoiceStatus) => {
    const now = new Date().toISOString();
    const next = invoices.map(i => i.id === id ? { ...i, status, updatedAt: now } : i);
    setInvoices(next);
    await db.invoices.setItem('data', next);

    try {
      if (navigator.onLine) {
        await supabase.from('invoices').update({ status, updated_at: now }).eq('id', id);
      }
    } catch (e) {
      console.warn('Erreur mise à jour statut facture:', e);
    }
  };

  const deleteInvoice = async (id: string) => {
    const nextInvoices = invoices.filter(i => i.id !== id);
    const nextPayments = invoicePayments.filter(p => p.invoiceId !== id);
    setInvoices(nextInvoices);
    setInvoicePayments(nextPayments);
    await db.invoices.setItem('data', nextInvoices);
    await db.invoicePayments.setItem('data', nextPayments);

    try {
      if (navigator.onLine) {
        await supabase.from('invoice_payments').delete().eq('invoice_id', id);
        await supabase.from('invoice_items').delete().eq('invoice_id', id);
        await supabase.from('invoices').delete().eq('id', id);
      }
    } catch (e) {
      console.warn('Erreur suppression facture:', e);
    }
  };

  const addInvoicePayment = async (paymentData: Omit<InvoicePayment, 'id' | 'createdAt'> | InvoicePayment): Promise<InvoicePayment> => {
    const id = ('id' in paymentData && paymentData.id) ? paymentData.id : uuidv4();
    const now = new Date().toISOString();
    
    const targetInvoice = invoices.find(i => i.id === paymentData.invoiceId);
    const existingPaymentsForInvoice = invoicePayments.filter(p => p.invoiceId === paymentData.invoiceId);
    const totalPaidBefore = existingPaymentsForInvoice.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const newTotalPaid = totalPaidBefore + (Number(paymentData.amount) || 0);

    const seq = (invoicePayments.length + 1).toString().padStart(4, '0');
    const paymentNumber = paymentData.paymentNumber || `PAY-${new Date().getFullYear()}-${seq}`;

    const newPayment: InvoicePayment = {
      ...paymentData,
      id,
      paymentNumber,
      amount: Number(paymentData.amount) || 0,
      paymentDate: paymentData.paymentDate || now.split('T')[0],
      paymentMethod: paymentData.paymentMethod || 'Espèces',
      createdBy: paymentData.createdBy || currentUser?.id,
      createdAt: now
    };

    const nextPayments = [newPayment, ...invoicePayments];
    setInvoicePayments(nextPayments);
    await db.invoicePayments.setItem('data', nextPayments);

    // Mise à jour automatique du statut de la facture
    if (targetInvoice) {
      const newStatus = computeInvoiceStatus(targetInvoice.totalAmount, newTotalPaid, targetInvoice.dueDate, targetInvoice.status);
      const updatedInvoice: Invoice = {
        ...targetInvoice,
        status: newStatus,
        updatedAt: now
      };
      const nextInvoices = invoices.map(i => i.id === targetInvoice.id ? updatedInvoice : i);
      setInvoices(nextInvoices);
      await db.invoices.setItem('data', nextInvoices);

      try {
        if (navigator.onLine) {
          await supabase.from('invoices').update({ status: newStatus, updated_at: now }).eq('id', targetInvoice.id);
        }
      } catch (e) {
        console.warn('Erreur mise à jour statut facture après paiement:', e);
      }
    }

    try {
      if (navigator.onLine) {
        const dbPayment = {
          id: newPayment.id,
          invoice_id: newPayment.invoiceId,
          payment_number: newPayment.paymentNumber,
          payment_date: newPayment.paymentDate,
          amount: newPayment.amount,
          payment_method: newPayment.paymentMethod,
          reference: newPayment.reference || null,
          notes: newPayment.notes || null,
          created_by: newPayment.createdBy || null,
          created_at: newPayment.createdAt
        };
        await supabase.from('invoice_payments').upsert(dbPayment);
      }
    } catch (e) {
      console.warn('Erreur synchro paiement facture:', e);
    }

    return newPayment;
  };

  const deleteInvoicePayment = async (paymentId: string) => {
    const payment = invoicePayments.find(p => p.id === paymentId);
    const nextPayments = invoicePayments.filter(p => p.id !== paymentId);
    setInvoicePayments(nextPayments);
    await db.invoicePayments.setItem('data', nextPayments);

    if (payment) {
      const targetInvoice = invoices.find(i => i.id === payment.invoiceId);
      if (targetInvoice) {
        const remainingPayments = nextPayments.filter(p => p.invoiceId === targetInvoice.id);
        const totalPaid = remainingPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        const newStatus = computeInvoiceStatus(targetInvoice.totalAmount, totalPaid, targetInvoice.dueDate, targetInvoice.status);
        const now = new Date().toISOString();
        const updatedInvoice: Invoice = {
          ...targetInvoice,
          status: newStatus,
          updatedAt: now
        };
        const nextInvoices = invoices.map(i => i.id === targetInvoice.id ? updatedInvoice : i);
        setInvoices(nextInvoices);
        await db.invoices.setItem('data', nextInvoices);

        try {
          if (navigator.onLine) {
            await supabase.from('invoices').update({ status: newStatus, updated_at: now }).eq('id', targetInvoice.id);
          }
        } catch {}
      }

      try {
        if (navigator.onLine) {
          await supabase.from('invoice_payments').delete().eq('id', paymentId);
        }
      } catch (e) {
        console.warn('Erreur suppression paiement facture:', e);
      }
    }
  };

  return (
    <AppContext.Provider value={{
      users, clients, affaires, quotes, sales, facturePaiements, couts, commissions, installments, scoringRules, objectifs, classements, primes, primeAuditLogs, prospects, prospectActivities, prospectFollowUps, categories, settings, services, prestations, loading, activityReports, weeklyReports, v2DailyReports, v2WeeklyReports, notifications, crmDocuments, crmFolders, posCategories, posBrands, posSuppliers, posProducts, posStockEntries, posStockMovements, posInventories, posCashSessions, posTransactions, posPayments, posDiscounts, posSettings, posReturns, posWorkspace, setPosWorkspace, suspendedCarts, addSuspendedCart, removeSuspendedCart, addClient, updateClient, deleteClient, addAffaire, updateAffaire, updateAffaireStatus, deleteAffaire, recordPayment, addCout, updateCout, deleteCout, addObjectif, updateObjectif, deleteObjectif, proposePrime, validatePrime, rejectPrime, payPrime, updateScoringRule, addQuote, updateQuote, updateQuoteStatus, deleteQuote, addSale, updateSaleStatus, updateSale, deleteSale, recordInstallmentPayment, saveInstallmentsForSale, addCommission, updateCommissionStatus, deleteCommission, addProspect, updateProspect, deleteProspect, convertProspect, addProspectActivity, deleteProspectActivity, addProspectFollowUp, updateProspectFollowUp, deleteProspectFollowUp, upsertActivityReport, deleteActivityReport, saveWeeklyReport, markWeeklyReportSent, markWeeklyReportRead, markNotificationAsRead, markAllNotificationsAsRead, saveV2DailyReport, saveV2WeeklyReport, submitV2WeeklyReport, sendWeeklyReportReminder, reviewV2WeeklyReport, deleteV2WeeklyReport, updateMyProfile, addCrmDocument, updateCrmDocument, deleteCrmDocument, downloadCrmDocument, getCrmDocumentBlob, addCrmFolder, updateCrmFolder, deleteCrmFolder, addCategory, deleteCategory, updateSettings, addUser, updateUser, toggleUserStatus, deleteUser, addPrestation, updatePrestation, deletePrestation, addService, updateService, deleteService, addPosCategory, updatePosCategory, deletePosCategory, addPosBrand, updatePosBrand, deletePosBrand, addPosSupplier, updatePosSupplier, deletePosSupplier, addPosProduct, updatePosProduct, deletePosProduct, findProductByBarcode, findProductByReference, searchProducts, getIncompleteProducts, updateProductBarcode, updateProductImage, importProducts, addPosStockEntry, updatePosStockEntry, deletePosStockEntry, addPosStockMovement, addPosInventory, updatePosInventory, deletePosInventory, addPosCashSession, updatePosCashSession, addPosTransaction, updatePosTransaction, voidPosTransaction, clearPosSalesHistory, deletePosMovementsByDateRange, addPosDiscount, updatePosDiscount, deletePosDiscount, updatePosSettings, addPosReturn, updatePosReturn, cancelPosReturn, productCompletions, importSessions, addProductCompletion, updateProductCompletion, deleteProductCompletion, addImportSession, updateImportSession, deleteImportSession, addImportError, completeProduct, refreshData, reconcilePosData: reconcileLocalPosDataWithCloud,
      // CRM Modules Responsables
      crmTiers, crmCommerciaux, crmPrestations, crmCaisse, crmCommissions, crmArticles, crmMaintenance, crmTechniciens,
      addCrmTier, updateCrmTier, deleteCrmTier,
      addCrmCommercial, updateCrmCommercial, deleteCrmCommercial,
      addCrmPrestation, updateCrmPrestation, deleteCrmPrestation, encaisserCrmPrestation,
      addCrmMouvementCaisse, deleteCrmMouvementCaisse,
      updateCrmCommissionStatus, payerCrmCommission,
      addCrmArticle, updateCrmArticle, deleteCrmArticle,
      addCrmIntervention, updateCrmIntervention, deleteCrmIntervention,
      addCrmTechnicien, updateCrmTechnicien, deleteCrmTechnicien,
      // Module Facturation Client
      invoices, invoicePayments,
      addInvoice, updateInvoice, updateInvoiceStatus, deleteInvoice,
      addInvoicePayment, deleteInvoicePayment
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext must be used within an AppProvider');
  return context;
};

