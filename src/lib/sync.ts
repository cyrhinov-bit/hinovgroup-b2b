import { v4 as uuidv4 } from 'uuid';
import { db } from './db';
import { supabase } from './supabase';

const isUuid = (value?: string) => !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export const LEGACY_SERVICE_ID_MAP: Record<string, string> = {
  'srv-photocopie-nb-recto': '11111111-0000-0000-0000-000000000001',
  'srv-photocopie-nb-rv': '11111111-0000-0000-0000-000000000002',
  'srv-impression-nb': '11111111-0000-0000-0000-000000000003',
  'srv-impression-col': '11111111-0000-0000-0000-000000000004',
  'srv-scan-a4': '11111111-0000-0000-0000-000000000005',
  'srv-plast-a4': '11111111-0000-0000-0000-000000000006',
  'srv-reliure': '11111111-0000-0000-0000-000000000007',
  'SRV-COP-NB-R': '11111111-0000-0000-0000-000000000001',
  'SRV-COP-NB-RV': '11111111-0000-0000-0000-000000000002',
  'SRV-IMP-NB': '11111111-0000-0000-0000-000000000003',
  'SRV-IMP-COL': '11111111-0000-0000-0000-000000000004',
  'SRV-SCAN-A4': '11111111-0000-0000-0000-000000000005',
  'SRV-PLAST-A4': '11111111-0000-0000-0000-000000000006',
  'SRV-RELIURE': '11111111-0000-0000-0000-000000000007',
};

export const resolveProductUuid = (id?: string, reference?: string): string => {
  if (isUuid(id)) return id!;
  if (id && LEGACY_SERVICE_ID_MAP[id]) return LEGACY_SERVICE_ID_MAP[id];
  if (reference && LEGACY_SERVICE_ID_MAP[reference]) return LEGACY_SERVICE_ID_MAP[reference];
  return id || '';
};

export type SyncActionType = 'INSERT_CLIENT' | 'UPDATE_CLIENT' | 'DELETE_CLIENT' | 
                             'INSERT_AFFAIRE' | 'UPDATE_AFFAIRE' | 'DELETE_AFFAIRE' |
                             'INSERT_FACTURE_PAIEMENT' |
                             'INSERT_COUT' | 'UPDATE_COUT' | 'DELETE_COUT' |
                             'INSERT_OBJECTIF' | 'UPDATE_OBJECTIF' | 'DELETE_OBJECTIF' |
                             'INSERT_PRIME' | 'UPDATE_PRIME_STATUS' |
                             'INSERT_PRIME_AUDIT_LOG' |
                             'UPDATE_SCORING_RULE' | 'UPSERT_CLASSEMENT' |
                             'INSERT_QUOTE' | 'UPDATE_QUOTE' | 'DELETE_QUOTE' |
                             'INSERT_SALE' | 'UPDATE_SALE' | 'DELETE_SALE' |
                             'INSERT_COMMISSION' | 'UPDATE_COMMISSION' | 'DELETE_COMMISSION' |
                             'INSERT_INSTALLMENT' | 'UPDATE_INSTALLMENT' | 'DELETE_INSTALLMENT' |
                             'INSERT_PROSPECT' | 'UPDATE_PROSPECT' | 'DELETE_PROSPECT' |
                             'INSERT_PROSPECT_ACTIVITY' | 'DELETE_PROSPECT_ACTIVITY' |
                             'INSERT_PROSPECT_FOLLOW_UP' | 'UPDATE_PROSPECT_FOLLOW_UP' | 'DELETE_PROSPECT_FOLLOW_UP' |
                             'INSERT_ACTIVITY_REPORT' | 'UPDATE_ACTIVITY_REPORT' | 'DELETE_ACTIVITY_REPORT' |
                             'INSERT_WEEKLY_REPORT' | 'UPDATE_WEEKLY_REPORT' |
                             'INSERT_V2_DAILY_REPORT' | 'UPDATE_V2_DAILY_REPORT' |
                             'INSERT_V2_WEEKLY_REPORT' | 'UPDATE_V2_WEEKLY_REPORT' | 'DELETE_V2_WEEKLY_REPORT' |
                             'INSERT_CATEGORY' | 'DELETE_CATEGORY' |
                             'UPDATE_SETTINGS' | 'UPDATE_PROFILE' | 'DELETE_PROFILE' |
                             'INSERT_PRESTATION' | 'UPDATE_PRESTATION' | 'DELETE_PRESTATION' |
                             'INSERT_SERVICE' | 'UPDATE_SERVICE' | 'DELETE_SERVICE' |
                             'INSERT_POS_CATEGORY' | 'UPDATE_POS_CATEGORY' | 'DELETE_POS_CATEGORY' |
                             'INSERT_POS_BRAND' | 'UPDATE_POS_BRAND' | 'DELETE_POS_BRAND' |
                             'INSERT_POS_SUPPLIER' | 'UPDATE_POS_SUPPLIER' | 'DELETE_POS_SUPPLIER' |
                             'INSERT_POS_PRODUCT' | 'UPDATE_POS_PRODUCT' | 'DELETE_POS_PRODUCT' |
                             'INSERT_POS_STOCK_ENTRY' | 'UPDATE_POS_STOCK_ENTRY' | 'DELETE_POS_STOCK_ENTRY' |
                             'INSERT_POS_STOCK_MOVEMENT' |
                             'INSERT_POS_INVENTORY' | 'UPDATE_POS_INVENTORY' | 'DELETE_POS_INVENTORY' |
                             'INSERT_POS_CASH_SESSION' | 'UPDATE_POS_CASH_SESSION' |
                             'INSERT_POS_TRANSACTION' | 'UPDATE_POS_TRANSACTION' | 'CLEAR_POS_SALES_HISTORY' | 'DELETE_POS_MOVEMENTS_BY_RANGE' |
                             'INSERT_POS_PAYMENT' |
                              'INSERT_POS_DISCOUNT' | 'UPDATE_POS_DISCOUNT' | 'DELETE_POS_DISCOUNT' |
                              'UPDATE_POS_SETTINGS' |
                              'INSERT_POS_RETURN' | 'UPDATE_POS_RETURN' |
                              'INSERT_PRODUCT_COMPLETION' | 'UPDATE_PRODUCT_COMPLETION' | 'DELETE_PRODUCT_COMPLETION' |
                              'INSERT_IMPORT_SESSION' | 'UPDATE_IMPORT_SESSION' | 'DELETE_IMPORT_SESSION' |
                              'INSERT_IMPORT_ERROR' |
                              'INSERT_DOCUMENT' | 'UPDATE_DOCUMENT' | 'DELETE_DOCUMENT' |
                              'INSERT_CRM_FOLDER' | 'UPDATE_CRM_FOLDER' | 'DELETE_CRM_FOLDER' |
                              'MARK_NOTIFICATION_READ' | 'MARK_ALL_NOTIFICATIONS_READ';

export interface SyncAction {
  id: string;
  type: SyncActionType;
  payload: any;
  timestamp: number;
  retryCount?: number;
}

export const isNetworkOrTransientError = (err: any): boolean => {
  if (!err) return false;
  const msg = (typeof err === 'string' ? err : err.message || err.error_description || JSON.stringify(err)).toLowerCase();
  const status = err.status || err.code || err.statusCode;
  
  if (
    msg.includes('failed to fetch') ||
    msg.includes('network') ||
    msg.includes('connection') ||
    msg.includes('timeout') ||
    msg.includes('délai') ||
    msg.includes('econnrefused') ||
    msg.includes('err_') ||
    msg.includes('abort') ||
    msg.includes('offline') ||
    msg.includes('gateway') ||
    msg.includes('load failed') ||
    msg.includes('fetch error') ||
    msg.includes('jwt expired') ||
    msg.includes('auth session missing') ||
    msg.includes('invalid claim: exp claim is in the past')
  ) return true;

  if (status === 502 || status === 503 || status === 504 || status === 520 || status === 521 || status === 522 || status === 524 || status === 408 || status === 429) {
    return true;
  }

  return false;
};

export const isForeignKeyError = (err: any): boolean => {
  if (!err) return false;
  const msg = (typeof err === 'string' ? err : err.message || err.details || JSON.stringify(err)).toLowerCase();
  const code = err.code || err.status;
  return code === '23503' || msg.includes('foreign key') || msg.includes('violates foreign key constraint') || msg.includes('clé étrangère');
};

// Vérifie si le retour Supabase est une erreur réseau (lance exception) ou logique (renvoie false)
const checkResult = (error: any): boolean => {
  if (!error) return true;
  if (isNetworkOrTransientError(error)) {
    throw new Error(`[NetworkError] ${error.message || JSON.stringify(error)}`);
  }
  return false;
};

// Ordre de priorité topologique pour respecter les dépendances de clés étrangères
const ACTION_PRIORITY: Record<string, number> = {
  // 1. Paramètres, Catégories, Marques, Fournisseurs, Dossiers CRM, Remises
  'UPDATE_SETTINGS': 1,
  'UPDATE_POS_SETTINGS': 1,
  'INSERT_CATEGORY': 1,
  'INSERT_SERVICE': 1,
  'INSERT_CRM_FOLDER': 1,
  'UPDATE_CRM_FOLDER': 1,
  'INSERT_POS_CATEGORY': 1,
  'UPDATE_POS_CATEGORY': 1,
  'INSERT_POS_BRAND': 1,
  'UPDATE_POS_BRAND': 1,
  'INSERT_POS_SUPPLIER': 1,
  'UPDATE_POS_SUPPLIER': 1,
  'INSERT_POS_DISCOUNT': 1,
  'UPDATE_POS_DISCOUNT': 1,
  // 2. Profils, Clients, Produits, Prestations
  'INSERT_CLIENT': 2,
  'UPDATE_CLIENT': 2,
  'INSERT_POS_PRODUCT': 2,
  'UPDATE_POS_PRODUCT': 2,
  'INSERT_PRESTATION': 2,
  'UPDATE_PRESTATION': 2,
  // 3. Sessions de caisse (indispensable avant les transactions POS)
  'INSERT_POS_CASH_SESSION': 3,
  'UPDATE_POS_CASH_SESSION': 3,
  // 4. Affaires, Devis, Ventes, Transactions, Documents CRM
  'INSERT_AFFAIRE': 4,
  'UPDATE_AFFAIRE': 4,
  'INSERT_QUOTE': 4,
  'UPDATE_QUOTE': 4,
  'INSERT_SALE': 4,
  'UPDATE_SALE': 4,
  'INSERT_POS_TRANSACTION': 4,
  'UPDATE_POS_TRANSACTION': 4,
  'INSERT_DOCUMENT': 4,
  'UPDATE_DOCUMENT': 4,
  // 5. Paiements, Retours, Mouvements de stock, Entrées stock, Inventaires
  'INSERT_POS_PAYMENT': 5,
  'INSERT_FACTURE_PAIEMENT': 5,
  'INSERT_POS_STOCK_ENTRY': 5,
  'UPDATE_POS_STOCK_ENTRY': 5,
  'INSERT_POS_STOCK_MOVEMENT': 5,
  'INSERT_POS_INVENTORY': 5,
  'UPDATE_POS_INVENTORY': 5,
  'INSERT_POS_RETURN': 5,
  'UPDATE_POS_RETURN': 5,
  // 6. Suppressions et purges finales
  'DELETE_POS_DISCOUNT': 6,
  'DELETE_POS_CATEGORY': 6,
  'DELETE_POS_BRAND': 6,
  'DELETE_POS_SUPPLIER': 6,
  'DELETE_POS_PRODUCT': 6,
  'DELETE_POS_STOCK_ENTRY': 6,
  'DELETE_POS_INVENTORY': 6,
  'CLEAR_POS_SALES_HISTORY': 6,
  'DELETE_POS_MOVEMENTS_BY_RANGE': 6,
};

// Helper pour détecter les actions liées au module services/photocopies retiré
export const isRetiredServicePayload = (type: SyncActionType, payload: any): boolean => {
  if (!payload) return false;
  if (type === 'INSERT_POS_PRODUCT' || type === 'UPDATE_POS_PRODUCT' || type === 'DELETE_POS_PRODUCT') {
    const id = payload.id ? String(payload.id).toLowerCase() : '';
    const ref = payload.reference ? String(payload.reference).toUpperCase() : '';
    const fam = payload.family ? String(payload.family).toLowerCase() : '';
    if (fam === 'service' || ref.startsWith('SRV-') || id.startsWith('srv-') || id === '00000000-0000-0000-0000-000000000000') {
      return true;
    }
  }
  if (type === 'INSERT_POS_CATEGORY' || type === 'UPDATE_POS_CATEGORY' || type === 'DELETE_POS_CATEGORY') {
    const fam = payload.family ? String(payload.family).toLowerCase() : '';
    const id = payload.id ? String(payload.id).toLowerCase() : '';
    if (fam === 'service' || id === 'cat-services') {
      return true;
    }
  }
  if (type === 'INSERT_POS_STOCK_MOVEMENT') {
    const pid = payload.productId ? String(payload.productId).toLowerCase() : '';
    const ref = payload.reference ? String(payload.reference).toUpperCase() : '';
    if (ref.startsWith('SRV-') || pid.startsWith('srv-') || pid === '00000000-0000-0000-0000-000000000000' || !pid || !isUuid(resolveProductUuid(payload.productId, payload.reference))) {
      return true;
    }
  }
  return false;
};

// Ajouter une action à la file d'attente
export const queueSyncAction = async (type: SyncActionType, payload: any) => {
  // Ignorer immédiatement les actions portant sur l'ancien module services/photocopies
  if (isRetiredServicePayload(type, payload)) {
    console.log('[Sync] Action ignorée car liée au module de services retiré :', type);
    return;
  }

  const action: SyncAction = {
    id: uuidv4(),
    type,
    payload,
    timestamp: Date.now()
  };
  
  const currentQueue: SyncAction[] = (await db.syncQueue.getItem('queue')) || [];
  currentQueue.push(action);
  await db.syncQueue.setItem('queue', currentQueue);
  
  // Tenter de synchroniser immédiatement si on est en ligne
  if (navigator.onLine) {
    processSyncQueue();
  }
};

// Helper de timeout adaptatif pour éviter qu'une action réseau ne bloque la file en cas de coupure
const withSyncTimeout = async <T,>(promise: Promise<T>, ms: number = 20000): Promise<T> => {
  let timer: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('[NetworkError] Délai réseau dépassé lors de la synchronisation')), ms);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timer);
  }
};

// Vérifie et rétablit l'authentification Supabase si le token JWT a expiré pendant une coupure
export const ensureSupabaseAuth = async (): Promise<boolean> => {
  if (typeof window === 'undefined' || !navigator.onLine) return false;
  try {
    const { data } = await supabase.auth.getSession();
    if (data?.session && data.session.expires_at && Math.floor(Date.now() / 1000) < (data.session.expires_at - 30)) {
      return true;
    }
    // Si la session est absente ou expirée, tenter de la renouveler via refresh_token
    if (data?.session?.refresh_token) {
      const { data: refData, error: refError } = await supabase.auth.refreshSession();
      if (!refError && refData?.session) {
        return true;
      }
    }
    // Repli : Réauthentification automatique avec le profil connecté en local (auth_last_user)
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('auth_last_user');
      if (stored) {
        const user = JSON.parse(stored);
        if (user?.email && user?.pin) {
          const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: user.email.toLowerCase().trim(),
            password: user.pin.trim()
          });
          if (!authError && authData?.session) {
            console.log('[SyncAuth] Reconnexion automatique Supabase Auth réussie pour :', user.email);
            return true;
          }
        }
      }
    }
  } catch (err) {
    console.warn('[SyncAuth] Échec vérification auth session :', err);
  }
  return false;
};

// Verrou anti-réentrance : empêche deux processSyncQueue simultanés
let syncLock = false;

// Vider la file d'attente
export const processSyncQueue = async () => {
  if (syncLock) return;
  syncLock = true;
  try {
    if (navigator.onLine) {
      await ensureSupabaseAuth().catch(() => {});
    }

    const currentQueue: SyncAction[] = (await db.syncQueue.getItem('queue')) || [];
    if (currentQueue.length === 0) return;

    // Purge automatique des anciennes erreurs liées aux services retirés
    try {
      const storedErrors = (await db.syncErrors.getItem<any[]>('errors')) || [];
      const cleanErrors = storedErrors.filter(e => !isRetiredServicePayload(e.action?.type, e.action?.payload));
      if (cleanErrors.length !== storedErrors.length) {
        await db.syncErrors.setItem('errors', cleanErrors);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('sync-errors-updated', { detail: { count: cleanErrors.length } }));
        }
      }
    } catch {}

    // Tri ordonné selon les dépendances (ex: configurations et sessions avant transactions)
    const sortedQueue = [...currentQueue].sort((a, b) => {
      const pA = ACTION_PRIORITY[a.type] || 10;
      const pB = ACTION_PRIORITY[b.type] || 10;
      if (pA !== pB) return pA - pB;
      return (a.timestamp || 0) - (b.timestamp || 0);
    });

    const processedIds = new Set<string>();

    for (const action of sortedQueue) {
      if (isRetiredServicePayload(action.type, action.payload)) {
        processedIds.add(action.id);
        continue;
      }
      try {
        let success = false;
        
        const executeAction = async (): Promise<boolean> => {
        switch (action.type) {
        case 'INSERT_CLIENT': {
          const { error } = await supabase.from('clients').insert([{
            id: action.payload.id,
            name: action.payload.name,
            email: action.payload.email || null,
            phone: action.payload.phone || null,
            contact: action.payload.contact || null,
            company: action.payload.company || null,
            address: action.payload.address || null,
            status: action.payload.status || 'Actif',
            commercial_id: action.payload.commercialId || null,
            created_at: action.payload.createdAt || new Date().toISOString()
          }]);
          if (error) console.error('[Sync] INSERT_CLIENT échoué :', error.message);
          success = checkResult(error);
          break;
        }
        case 'UPDATE_CLIENT': {
          const { id, ...data } = action.payload;
          const mappedData: any = {};
          if (data.name !== undefined) mappedData.name = data.name;
          if (data.email !== undefined) mappedData.email = data.email;
          if (data.phone !== undefined) mappedData.phone = data.phone;
          if (data.contact !== undefined) mappedData.contact = data.contact;
          if (data.company !== undefined) mappedData.company = data.company;
          if (data.address !== undefined) mappedData.address = data.address;
          if (data.status !== undefined) mappedData.status = data.status;
          if (data.commercialId !== undefined) mappedData.commercial_id = data.commercialId;
          const { error } = await supabase.from('clients').update(mappedData).eq('id', id);
          if (error) console.error('[Sync] UPDATE_CLIENT échoué :', error.message);
          success = checkResult(error);
          break;
        }
        case 'DELETE_CLIENT': {
          const { error } = await supabase.from('clients').delete().eq('id', action.payload.id);
          success = checkResult(error);
          break;
        }
        case 'INSERT_AFFAIRE': {
          const affaireData = action.payload;
          const { error } = await supabase.from('affaires').insert([{
            id: affaireData.id,
            reference: affaireData.reference,
            title: affaireData.title,
            client_id: isUuid(affaireData.clientId) ? affaireData.clientId : null,
            service_id: isUuid(affaireData.serviceId) ? affaireData.serviceId : null,
            commercial_id: isUuid(affaireData.commercialId) ? affaireData.commercialId : null,
            description: affaireData.description || null,
            status: affaireData.status || 'QUALIFIEE',
            estimated_amount_ht: affaireData.estimatedAmountHt || 0,
            probability: affaireData.probability !== undefined ? affaireData.probability : 50,
            source: affaireData.source || null,
            start_date_planned: affaireData.startDatePlanned || null,
            end_date_planned: affaireData.endDatePlanned || null,
            end_date_real: affaireData.endDateReal || null,
            notes: affaireData.notes || null,
            created_at: affaireData.createdAt || new Date().toISOString(),
            updated_at: affaireData.updatedAt || new Date().toISOString()
          }]);
          if (error) console.error('[Sync] INSERT_AFFAIRE échoué :', error.message);
          success = checkResult(error);
          break;
        }
        case 'UPDATE_AFFAIRE': {
          const { id, ...data } = action.payload;
          const mappedData: any = {};
          if (data.title !== undefined) mappedData.title = data.title;
          if (data.clientId !== undefined) mappedData.client_id = isUuid(data.clientId) ? data.clientId : null;
          if (data.serviceId !== undefined) mappedData.service_id = isUuid(data.serviceId) ? data.serviceId : null;
          if (data.commercialId !== undefined) mappedData.commercial_id = isUuid(data.commercialId) ? data.commercialId : null;
          if (data.description !== undefined) mappedData.description = data.description;
          if (data.status !== undefined) mappedData.status = data.status;
          if (data.estimatedAmountHt !== undefined) mappedData.estimated_amount_ht = data.estimatedAmountHt;
          if (data.probability !== undefined) mappedData.probability = data.probability;
          if (data.source !== undefined) mappedData.source = data.source;
          if (data.startDatePlanned !== undefined) mappedData.start_date_planned = data.startDatePlanned;
          if (data.endDatePlanned !== undefined) mappedData.end_date_planned = data.endDatePlanned;
          if (data.endDateReal !== undefined) mappedData.end_date_real = data.endDateReal;
          if (data.notes !== undefined) mappedData.notes = data.notes;
          mappedData.updated_at = new Date().toISOString();
          const { error } = await supabase.from('affaires').update(mappedData).eq('id', id);
          if (error) console.error('[Sync] UPDATE_AFFAIRE échoué :', error.message);
          success = checkResult(error);
          break;
        }
        case 'DELETE_AFFAIRE': {
          const { error } = await supabase.from('affaires').delete().eq('id', action.payload.id);
          if (error) console.error('[Sync] DELETE_AFFAIRE échoué :', error.message);
          success = checkResult(error);
          break;
        }
        case 'INSERT_FACTURE_PAIEMENT': {
          const payment = action.payload;
          const { error } = await supabase.from('facture_paiements').insert([{
            id: payment.id,
            payment_number: payment.paymentNumber,
            payment_type: payment.paymentType,
            vente_id: isUuid(payment.venteId) ? payment.venteId : null,
            echeance_id: isUuid(payment.echeanceId) ? payment.echeanceId : null,
            client_id: isUuid(payment.clientId) ? payment.clientId : null,
            payment_date: payment.paymentDate,
            amount: payment.amount,
            payment_method: payment.paymentMethod,
            reference: payment.reference || null,
            proof_document_id: payment.proofDocumentId || null,
            notes: payment.notes || null,
            status: payment.status || 'VALIDE',
            recorded_by: isUuid(payment.recordedBy) ? payment.recordedBy : null,
            created_at: payment.createdAt || new Date().toISOString()
          }]);
          if (error) console.error('[Sync] INSERT_FACTURE_PAIEMENT échoué :', error.message);
          success = checkResult(error);
          break;
        }
        case 'INSERT_COUT': {
          const cout = action.payload;
          const { error } = await supabase.from('couts').insert([{
            id: cout.id,
            reference: cout.reference,
            cost_type: cout.costType,
            category: cout.category,
            amount_ht: cout.amountHt,
            vat_rate: cout.vatRate || 0,
            vat_amount: cout.vatAmount || 0,
            amount_ttc: cout.amountTtc,
            date: cout.date,
            affaire_id: isUuid(cout.affaireId) ? cout.affaireId : null,
            service_id: isUuid(cout.serviceId) ? cout.serviceId : null,
            supplier_name: cout.supplierName || null,
            invoice_ref: cout.invoiceRef || null,
            description: cout.description,
            proof_document_id: cout.proofDocumentId || null,
            status: cout.status || 'VALIDE',
            created_by: isUuid(cout.createdBy) ? cout.createdBy : null,
            created_at: cout.createdAt || new Date().toISOString(),
            updated_at: cout.updatedAt || new Date().toISOString()
          }]);
          if (error) console.error('[Sync] INSERT_COUT échoué :', error.message);
          success = checkResult(error);
          break;
        }
        case 'UPDATE_COUT': {
          const { id, ...cData } = action.payload;
          const mappedCout: any = {};
          if (cData.costType !== undefined) mappedCout.cost_type = cData.costType;
          if (cData.category !== undefined) mappedCout.category = cData.category;
          if (cData.amountHt !== undefined) mappedCout.amount_ht = cData.amountHt;
          if (cData.vatRate !== undefined) mappedCout.vat_rate = cData.vatRate;
          if (cData.vatAmount !== undefined) mappedCout.vat_amount = cData.vatAmount;
          if (cData.amountTtc !== undefined) mappedCout.amount_ttc = cData.amountTtc;
          if (cData.date !== undefined) mappedCout.date = cData.date;
          if (cData.affaireId !== undefined) mappedCout.affaire_id = isUuid(cData.affaireId) ? cData.affaireId : null;
          if (cData.serviceId !== undefined) mappedCout.service_id = isUuid(cData.serviceId) ? cData.serviceId : null;
          if (cData.supplierName !== undefined) mappedCout.supplier_name = cData.supplierName;
          if (cData.invoiceRef !== undefined) mappedCout.invoice_ref = cData.invoiceRef;
          if (cData.description !== undefined) mappedCout.description = cData.description;
          if (cData.status !== undefined) mappedCout.status = cData.status;
          mappedCout.updated_at = new Date().toISOString();
          const { error } = await supabase.from('couts').update(mappedCout).eq('id', id);
          if (error) console.error('[Sync] UPDATE_COUT échoué :', error.message);
          success = checkResult(error);
          break;
        }
        case 'DELETE_COUT': {
          const { error } = await supabase.from('couts').delete().eq('id', action.payload.id);
          if (error) console.error('[Sync] DELETE_COUT échoué :', error.message);
          success = checkResult(error);
          break;
        }
        case 'INSERT_OBJECTIF': {
          const obj = action.payload;
          const { error } = await supabase.from('objectifs').insert([{
            id: obj.id,
            profile_id: isUuid(obj.profileId) ? obj.profileId : null,
            service_id: isUuid(obj.serviceId) ? obj.serviceId : null,
            period_type: obj.periodType,
            start_date: obj.startDate,
            end_date: obj.endDate,
            target_revenue_ht: obj.targetRevenueHt,
            target_margin_ht: obj.targetMarginHt,
            target_deals_count: obj.targetDealsCount || 0,
            target_new_clients: obj.targetNewClients || 0,
            status: obj.status || 'EN_COURS',
            created_by: isUuid(obj.createdBy) ? obj.createdBy : null,
            created_at: obj.createdAt || new Date().toISOString()
          }]);
          if (error) console.error('[Sync] INSERT_OBJECTIF échoué :', error.message);
          success = checkResult(error);
          break;
        }
        case 'UPDATE_OBJECTIF': {
          const { id, ...data } = action.payload;
          const mapped: any = {};
          if (data.targetRevenueHt !== undefined) mapped.target_revenue_ht = data.targetRevenueHt;
          if (data.targetMarginHt !== undefined) mapped.target_margin_ht = data.targetMarginHt;
          if (data.targetDealsCount !== undefined) mapped.target_deals_count = data.targetDealsCount;
          if (data.targetNewClients !== undefined) mapped.target_new_clients = data.targetNewClients;
          if (data.status !== undefined) mapped.status = data.status;
          if (data.startDate !== undefined) mapped.start_date = data.startDate;
          if (data.endDate !== undefined) mapped.end_date = data.endDate;
          const { error } = await supabase.from('objectifs').update(mapped).eq('id', id);
          if (error) console.error('[Sync] UPDATE_OBJECTIF échoué :', error.message);
          success = checkResult(error);
          break;
        }
        case 'DELETE_OBJECTIF': {
          const { error } = await supabase.from('objectifs').delete().eq('id', action.payload.id);
          if (error) console.error('[Sync] DELETE_OBJECTIF échoué :', error.message);
          success = checkResult(error);
          break;
        }
        case 'INSERT_PRIME': {
          const prime = action.payload;
          const { error } = await supabase.from('primes').insert([{
            id: prime.id,
            reference: prime.reference,
            profile_id: isUuid(prime.profileId) ? prime.profileId : null,
            service_id: isUuid(prime.serviceId) ? prime.serviceId : null,
            period_key: prime.periodKey,
            prime_type: prime.primeType,
            amount: prime.amount,
            status: prime.status || 'PROPOSEE',
            calculated_by: isUuid(prime.calculatedBy) ? prime.calculatedBy : null,
            validated_by: isUuid(prime.validatedBy) ? prime.validatedBy : null,
            justification: prime.justification || null,
            created_at: prime.createdAt || new Date().toISOString(),
            updated_at: prime.updatedAt || new Date().toISOString()
          }]);
          if (error) console.error('[Sync] INSERT_PRIME échoué :', error.message);
          success = checkResult(error);
          break;
        }
        case 'UPDATE_PRIME_STATUS': {
          const { id, status, validatedBy, justification } = action.payload;
          const mapped: any = { status, updated_at: new Date().toISOString() };
          if (validatedBy !== undefined) mapped.validated_by = isUuid(validatedBy) ? validatedBy : null;
          if (justification !== undefined) mapped.justification = justification;
          const { error } = await supabase.from('primes').update(mapped).eq('id', id);
          if (error) console.error('[Sync] UPDATE_PRIME_STATUS échoué :', error.message);
          success = checkResult(error);
          break;
        }
        case 'INSERT_PRIME_AUDIT_LOG': {
          const log = action.payload;
          const { error } = await supabase.from('prime_audit_logs').insert([{
            id: log.id,
            prime_id: isUuid(log.primeId) ? log.primeId : null,
            action: log.action,
            actor_id: isUuid(log.actorId) ? log.actorId : null,
            actor_role: log.actorRole,
            previous_state: log.previousState || null,
            new_state: log.newState || null,
            comment: log.comment || null,
            created_at: log.createdAt || new Date().toISOString()
          }]);
          if (error) console.error('[Sync] INSERT_PRIME_AUDIT_LOG échoué :', error.message);
          success = checkResult(error);
          break;
        }
        case 'UPDATE_SCORING_RULE': {
          const { id, ...data } = action.payload;
          const mapped: any = {};
          if (data.weightMargin !== undefined) mapped.weight_margin = data.weightMargin;
          if (data.weightRevenue !== undefined) mapped.weight_revenue = data.weightRevenue;
          if (data.weightVolume !== undefined) mapped.weight_volume = data.weightVolume;
          if (data.weightConversion !== undefined) mapped.weight_conversion = data.weightConversion;
          if (data.isActive !== undefined) mapped.is_active = data.isActive;
          const { error } = await supabase.from('scoring_rules').update(mapped).eq('id', id);
          if (error) console.error('[Sync] UPDATE_SCORING_RULE échoué :', error.message);
          success = checkResult(error);
          break;
        }
        case 'UPSERT_CLASSEMENT': {
          const cl = action.payload;
          const { error } = await supabase.from('classements').upsert([{
            id: cl.id,
            profile_id: isUuid(cl.profileId) ? cl.profileId : null,
            service_id: isUuid(cl.serviceId) ? cl.serviceId : null,
            period_type: cl.periodType,
            period_key: cl.periodKey,
            score: cl.score,
            rank: cl.rank,
            revenue_achieved_ht: cl.revenueAchievedHt,
            margin_achieved_ht: cl.marginAchievedHt,
            deals_won_count: cl.dealsWonCount,
            conversion_rate: cl.conversionRate,
            updated_at: new Date().toISOString()
          }]);
          if (error) console.error('[Sync] UPSERT_CLASSEMENT échoué :', error.message);
          success = checkResult(error);
          break;
        }
        case 'INSERT_QUOTE': {
          const { lines, ...quoteData } = action.payload;
          const { error } = await supabase.from('quotes').upsert([{
            id: quoteData.id,
            quote_number: quoteData.quoteNumber,
            client_id: isUuid(quoteData.clientId) ? quoteData.clientId : null,
            commercial_id: isUuid(quoteData.commercialId) ? quoteData.commercialId : null,
            service_id: isUuid(quoteData.serviceId) ? quoteData.serviceId : null,
            affaire_id: isUuid(quoteData.affaireId) ? quoteData.affaireId : null,
            subject: quoteData.subject,
            subtotal: quoteData.subtotal,
            vat: quoteData.vat ?? 0,
            total: quoteData.total,
            status: quoteData.status,
            date: quoteData.date,
            valid_until: quoteData.validUntil || null,
            payment_terms: quoteData.paymentTerms || null,
            notes: quoteData.notes || null,
            signatory_name: quoteData.signatoryName || null,
            signatory_role: quoteData.signatoryRole || null,
            style: quoteData.style,
            accent_color: quoteData.accentColor,
            discount_percent: quoteData.discountPercent || 0,
            discount_amount: quoteData.discountAmount || 0,
            client_comment: quoteData.clientComment || null
          }], { onConflict: 'id' });
          
          if (!error && lines && lines.length > 0) {
            const linesData = lines.map((l: any) => ({
              id: isUuid(l.id) ? l.id : uuidv4(),
              quote_id: quoteData.id,
              prestation_id: isUuid(l.prestationId) ? l.prestationId : null,
              description: l.description,
              quantity: l.quantity,
              unit: l.unit || null,
              unit_price: l.unitPrice,
              discount_percent: l.discountPercent || 0,
              total: l.total
            }));
            const { error: lineErr } = await supabase.from('quote_lines').upsert(linesData, { onConflict: 'id' });
            if (lineErr && isNetworkOrTransientError(lineErr)) throw new Error(`[NetworkError] ${lineErr.message}`);
          }
          if (error) console.error('[Sync] INSERT_QUOTE échoué :', error.message);
          success = checkResult(error);
          break;
        }
        case 'UPDATE_QUOTE': {
          const { lines, ...quoteData } = action.payload;
          const { error } = await supabase.from('quotes').update({
            quote_number: quoteData.quoteNumber,
            client_id: isUuid(quoteData.clientId) ? quoteData.clientId : null,
            commercial_id: isUuid(quoteData.commercialId) ? quoteData.commercialId : null,
            service_id: isUuid(quoteData.serviceId) ? quoteData.serviceId : null,
            affaire_id: isUuid(quoteData.affaireId) ? quoteData.affaireId : null,
            subject: quoteData.subject,
            subtotal: quoteData.subtotal,
            vat: quoteData.vat ?? 0,
            total: quoteData.total,
            status: quoteData.status,
            date: quoteData.date,
            valid_until: quoteData.validUntil !== undefined ? quoteData.validUntil : null,
            payment_terms: quoteData.paymentTerms !== undefined ? quoteData.paymentTerms : null,
            notes: quoteData.notes !== undefined ? quoteData.notes : null,
            signatory_name: quoteData.signatoryName !== undefined ? quoteData.signatoryName : null,
            signatory_role: quoteData.signatoryRole !== undefined ? quoteData.signatoryRole : null,
            style: quoteData.style,
            accent_color: quoteData.accentColor,
            discount_percent: quoteData.discountPercent || 0,
            discount_amount: quoteData.discountAmount || 0,
            client_comment: quoteData.clientComment !== undefined ? quoteData.clientComment : null
          }).eq('id', quoteData.id);

          if (!error) {
            await supabase.from('quote_lines').delete().eq('quote_id', quoteData.id);
            if (lines && lines.length > 0) {
              const linesData = lines.map((l: any) => ({
                id: isUuid(l.id) ? l.id : uuidv4(),
                quote_id: quoteData.id,
                prestation_id: isUuid(l.prestationId) ? l.prestationId : null,
                description: l.description,
                quantity: l.quantity,
                unit: l.unit || null,
                unit_price: l.unitPrice,
                discount_percent: l.discountPercent || 0,
                total: l.total
              }));
              const { error: insLinesErr } = await supabase.from('quote_lines').insert(linesData);
              if (insLinesErr && isNetworkOrTransientError(insLinesErr)) throw new Error(`[NetworkError] ${insLinesErr.message}`);
            }
          }
          if (error) console.error('[Sync] UPDATE_QUOTE échoué :', error.message);
          success = checkResult(error);
          break;
        }
        case 'DELETE_QUOTE': {
          const { error } = await supabase.from('quotes').delete().eq('id', action.payload.id);
          success = checkResult(error);
          break;
        }
        case 'INSERT_SALE': {
          const { lines, ...saleData } = action.payload;
          const { error } = await supabase.from('ventes').upsert([{
            id: saleData.id,
            sale_number: saleData.saleNumber,
            quote_id: isUuid(saleData.quoteId) ? saleData.quoteId : null,
            affaire_id: isUuid(saleData.affaireId) ? saleData.affaireId : null,
            client_id: isUuid(saleData.clientId) ? saleData.clientId : null,
            service_id: isUuid(saleData.serviceId) ? saleData.serviceId : null,
            commercial_id: isUuid(saleData.commercialId) ? saleData.commercialId : null,
            due_date: saleData.dueDate || null,
            subtotal: saleData.subtotal,
            vat: saleData.vat ?? 0,
            total: saleData.total,
            status: saleData.status,
            date: saleData.date,
            notes: saleData.notes || null
          }], { onConflict: 'id' });
          
          if (!error && lines && lines.length > 0) {
            const linesData = lines.map((l: any) => ({
              id: isUuid(l.id) ? l.id : uuidv4(),
              vente_id: saleData.id,
              description: l.description,
              quantity: l.quantity,
              unit_price: l.unitPrice,
              cost_price: l.costPrice || 0,
              total: l.total
            }));
            const { error: lineErr } = await supabase.from('vente_lines').upsert(linesData, { onConflict: 'id' });
            if (lineErr && isNetworkOrTransientError(lineErr)) throw new Error(`[NetworkError] ${lineErr.message}`);
          }
          if (error) console.error('[Sync] INSERT_SALE échoué :', error.message);
          success = checkResult(error);
          break;
        }
        case 'UPDATE_SALE': {
          const { lines, ...saleData } = action.payload;
          const { error } = await supabase.from('ventes').update({
            sale_number: saleData.saleNumber,
            quote_id: isUuid(saleData.quoteId) ? saleData.quoteId : null,
            affaire_id: isUuid(saleData.affaireId) ? saleData.affaireId : null,
            client_id: isUuid(saleData.clientId) ? saleData.clientId : null,
            service_id: isUuid(saleData.serviceId) ? saleData.serviceId : null,
            commercial_id: isUuid(saleData.commercialId) ? saleData.commercialId : null,
            due_date: saleData.dueDate !== undefined ? saleData.dueDate : null,
            subtotal: saleData.subtotal,
            vat: saleData.vat ?? 0,
            total: saleData.total,
            status: saleData.status,
            date: saleData.date,
            notes: saleData.notes || null
          }).eq('id', saleData.id);

          if (!error) {
            await supabase.from('vente_lines').delete().eq('vente_id', saleData.id);
            if (lines && lines.length > 0) {
              const linesData = lines.map((l: any) => ({
                id: isUuid(l.id) ? l.id : uuidv4(),
                vente_id: saleData.id,
                description: l.description,
                quantity: l.quantity,
                unit_price: l.unitPrice,
                cost_price: l.costPrice || 0,
                total: l.total
              }));
              const { error: insLinesErr } = await supabase.from('vente_lines').insert(linesData);
              if (insLinesErr && isNetworkOrTransientError(insLinesErr)) throw new Error(`[NetworkError] ${insLinesErr.message}`);
            }
          }
          if (error) console.error('[Sync] UPDATE_SALE échoué :', error.message);
          success = checkResult(error);
          break;
        }
        case 'DELETE_SALE': {
          const { error } = await supabase.from('ventes').delete().eq('id', action.payload.id);
          success = checkResult(error);
          break;
        }
        case 'INSERT_COMMISSION': {
          const { error } = await supabase.from('commissions').insert([{
            id: action.payload.id,
            vente_id: isUuid(action.payload.saleId) ? action.payload.saleId : null,
            affaire_id: isUuid(action.payload.affaireId) ? action.payload.affaireId : null,
            client_id: isUuid(action.payload.clientId) ? action.payload.clientId : null,
            commercial_id: isUuid(action.payload.commercialId) ? action.payload.commercialId : null,
            service_id: isUuid(action.payload.serviceId) ? action.payload.serviceId : null,
            total_ht: action.payload.totalHt,
            cost_total: action.payload.costTotal,
            margin_amount: action.payload.marginAmount,
            margin_percent: action.payload.marginPercent,
            commission_percent: action.payload.commissionPercent,
            commission_amount: action.payload.commissionAmount,
            paid_amount: action.payload.paidAmount || 0,
            status: action.payload.status
          }]);
          if (error) console.error('[Sync] INSERT_COMMISSION échoué :', error.message);
          success = checkResult(error);
          break;
        }
        case 'UPDATE_COMMISSION': {
          const { id, ...updateData } = action.payload;
          const mappedData: any = {};
          if (updateData.totalHt !== undefined) mappedData.total_ht = updateData.totalHt;
          if (updateData.costTotal !== undefined) mappedData.cost_total = updateData.costTotal;
          if (updateData.marginAmount !== undefined) mappedData.margin_amount = updateData.marginAmount;
          if (updateData.marginPercent !== undefined) mappedData.margin_percent = updateData.marginPercent;
          if (updateData.commissionPercent !== undefined) mappedData.commission_percent = updateData.commissionPercent;
          if (updateData.commissionAmount !== undefined) mappedData.commission_amount = updateData.commissionAmount;
          if (updateData.status !== undefined) mappedData.status = updateData.status;
          if (updateData.paidAmount !== undefined) mappedData.paid_amount = updateData.paidAmount;
          if (updateData.affaireId !== undefined) mappedData.affaire_id = isUuid(updateData.affaireId) ? updateData.affaireId : null;
          const { error } = await supabase.from('commissions').update(mappedData).eq('id', id);
          if (error) console.error('[Sync] UPDATE_COMMISSION échoué :', error.message);
          success = checkResult(error);
          break;
        }
        case 'DELETE_COMMISSION': {
          const { error } = await supabase.from('commissions').delete().eq('id', action.payload.id);
          success = checkResult(error);
          break;
        }
        case 'INSERT_INSTALLMENT': {
          const { error } = await supabase.from('vente_echeances').insert([{
            id: action.payload.id,
            vente_id: isUuid(action.payload.saleId) ? action.payload.saleId : null,
            amount: action.payload.amount,
            due_date: action.payload.dueDate,
            paid_amount: action.payload.paidAmount || 0,
            status: action.payload.status,
            paid_at: action.payload.paidAt || null
          }]);
          if (error) console.error('[Sync] INSERT_INSTALLMENT échoué :', error.message);
          success = checkResult(error);
          break;
        }
        case 'UPDATE_INSTALLMENT': {
          const { error } = await supabase.from('vente_echeances').update({
            amount: action.payload.amount,
            due_date: action.payload.dueDate,
            paid_amount: action.payload.paidAmount,
            status: action.payload.status,
            paid_at: action.payload.paidAt || null
          }).eq('id', action.payload.id);
          if (error) console.error('[Sync] UPDATE_INSTALLMENT échoué :', error.message);
          success = checkResult(error);
          break;
        }
        case 'DELETE_INSTALLMENT': {
          const { error } = await supabase.from('vente_echeances').delete().eq('id', action.payload.id);
          success = checkResult(error);
          break;
        }
        case 'INSERT_PROSPECT': {
          const { error } = await supabase.from('prospects').insert([{
            id: action.payload.id,
            prospect_number: action.payload.prospectNumber,
            commercial_id: isUuid(action.payload.commercialId) ? action.payload.commercialId : null,
            service_id: isUuid(action.payload.serviceId) ? action.payload.serviceId : null,
            category_id: isUuid(action.payload.categoryId) ? action.payload.categoryId : null,
            type: action.payload.type,
            name: action.payload.name,
            company: action.payload.company || null,
            phone: action.payload.phone || null,
            email: action.payload.email || null,
            address: action.payload.address || null,
            city: action.payload.city || null,
            source: action.payload.source || null,
            interest_level: action.payload.interestLevel,
            budget: action.payload.budget || 0,
            need: action.payload.need || null,
            comments: action.payload.comments || null,
            status: action.payload.status,
            responsible_id: isUuid(action.payload.responsibleId) ? action.payload.responsibleId : null
          }]);
          if (error) console.error('[Sync] INSERT_PROSPECT échoué :', error.message);
          success = checkResult(error);
          break;
        }
        case 'UPDATE_PROSPECT': {
          const { id, ...updateData } = action.payload;
          const mappedData: any = {};
          if (updateData.type !== undefined) mappedData.type = updateData.type;
          if (updateData.name !== undefined) mappedData.name = updateData.name;
          if (updateData.company !== undefined) mappedData.company = updateData.company;
          if (updateData.phone !== undefined) mappedData.phone = updateData.phone;
          if (updateData.email !== undefined) mappedData.email = updateData.email;
          if (updateData.address !== undefined) mappedData.address = updateData.address;
          if (updateData.city !== undefined) mappedData.city = updateData.city;
          if (updateData.source !== undefined) mappedData.source = updateData.source;
          if (updateData.interestLevel !== undefined) mappedData.interest_level = updateData.interestLevel;
          if (updateData.budget !== undefined) mappedData.budget = updateData.budget;
          if (updateData.need !== undefined) mappedData.need = updateData.need;
          if (updateData.comments !== undefined) mappedData.comments = updateData.comments;
          if (updateData.status !== undefined) mappedData.status = updateData.status;
          if (updateData.categoryId !== undefined) mappedData.category_id = isUuid(updateData.categoryId) ? updateData.categoryId : null;
          if (updateData.commercialId !== undefined) mappedData.commercial_id = isUuid(updateData.commercialId) ? updateData.commercialId : null;
          if (updateData.serviceId !== undefined) mappedData.service_id = isUuid(updateData.serviceId) ? updateData.serviceId : null;
          if (updateData.responsibleId !== undefined) mappedData.responsible_id = isUuid(updateData.responsibleId) ? updateData.responsibleId : null;
          if (updateData.updated_at !== undefined) mappedData.updated_at = updateData.updated_at;
          const { error } = await supabase.from('prospects').update(mappedData).eq('id', id);
          if (error) console.error('[Sync] UPDATE_PROSPECT échoué :', error.message);
          success = checkResult(error);
          break;
        }
        case 'DELETE_PROSPECT': {
          const { error } = await supabase.from('prospects').delete().eq('id', action.payload.id);
          success = checkResult(error);
          break;
        }
        case 'INSERT_PROSPECT_ACTIVITY': {
          const { error } = await supabase.from('prospect_activities').insert([{
            id: action.payload.id,
            prospect_id: isUuid(action.payload.prospectId) ? action.payload.prospectId : null,
            type: action.payload.type,
            description: action.payload.description || null,
            date: action.payload.date,
            created_by: isUuid(action.payload.createdBy) ? action.payload.createdBy : null
          }]);
          if (error) console.error('[Sync] INSERT_PROSPECT_ACTIVITY échoué :', error.message);
          success = checkResult(error);
          break;
        }
        case 'DELETE_PROSPECT_ACTIVITY': {
          const { error } = await supabase.from('prospect_activities').delete().eq('id', action.payload.id);
          success = checkResult(error);
          break;
        }
        case 'INSERT_PROSPECT_FOLLOW_UP': {
          const { error } = await supabase.from('prospect_follow_ups').insert([{
            id: action.payload.id,
            prospect_id: isUuid(action.payload.prospectId) ? action.payload.prospectId : null,
            date: action.payload.date,
            time: action.payload.time || null,
            priority: action.payload.priority,
            observation: action.payload.observation || null,
            status: action.payload.status
          }]);
          if (error) console.error('[Sync] INSERT_PROSPECT_FOLLOW_UP échoué :', error.message);
          success = checkResult(error);
          break;
        }
        case 'UPDATE_PROSPECT_FOLLOW_UP': {
          const { id, ...updateData } = action.payload;
          const { error } = await supabase.from('prospect_follow_ups').update({ status: updateData.status }).eq('id', id);
          if (error) console.error('[Sync] UPDATE_PROSPECT_FOLLOW_UP échoué :', error.message);
          success = checkResult(error);
          break;
        }
        case 'DELETE_PROSPECT_FOLLOW_UP': {
          const { error } = await supabase.from('prospect_follow_ups').delete().eq('id', action.payload.id);
          success = checkResult(error);
          break;
        }
        case 'INSERT_CATEGORY': {
          const { error } = await supabase.from('categories').insert([{
            id: action.payload.id,
            service_id: isUuid(action.payload.serviceId) ? action.payload.serviceId : null,
            name: action.payload.name
          }]);
          if (error) console.error('[Sync] INSERT_CATEGORY échoué :', error.message);
          success = checkResult(error);
          break;
        }
        case 'DELETE_CATEGORY': {
          const { error } = await supabase.from('categories').delete().eq('id', action.payload.id);
          success = checkResult(error);
          break;
        }
        case 'UPDATE_SETTINGS': {
          const { error } = await supabase.from('settings').upsert({
            id: 1,
            company_name: action.payload.companyName,
            company_logo: action.payload.companyLogo,
            company_address: action.payload.companyAddress,
            company_siret: action.payload.companySiret,
            company_tva: action.payload.companyTva,
            default_terms: action.payload.defaultTerms,
            header_logo_base64: action.payload.headerLogoBase64 ?? null,
            company_stamp_base64: action.payload.companyStampBase64 ?? null,
            default_validity: action.payload.defaultValidity ?? null,
            site_url: action.payload.siteUrl ?? null,
            commission_rate: action.payload.commissionRate ?? null,
          });
          if (error) console.error('[Sync] UPDATE_SETTINGS échoué :', error.message);
          success = checkResult(error);
          break;
        }
        case 'UPDATE_PROFILE': {
          const { id, ...updateData } = action.payload;
          const { error } = await supabase.from('profiles').update(updateData).eq('id', id);
          if (error) console.error('[Sync] UPDATE_PROFILE échoué :', error.message);
          success = checkResult(error);
          break;
        }
        case 'DELETE_PROFILE': {
          const { error } = await supabase.from('profiles').delete().eq('id', action.payload.id);
          success = checkResult(error);
          break;
        }
        case 'INSERT_ACTIVITY_REPORT': { // @deprecated V1
          const { error } = await supabase.from('activity_reports').insert([{
            id: action.payload.id,
            author_id: action.payload.authorId,
            role: action.payload.role,
            type: action.payload.type,
            date: action.payload.date,
            realisations: action.payload.realisations || null,
            difficultes: action.payload.difficultes || null,
            remarques: action.payload.remarques || null
          }]);
          if (error) console.error('[Sync] INSERT_ACTIVITY_REPORT échoué :', error.message);
          success = checkResult(error);
          break;
        }
        case 'UPDATE_ACTIVITY_REPORT': { // @deprecated V1
          const { error } = await supabase.from('activity_reports').update({
            role: action.payload.role,
            type: action.payload.type,
            date: action.payload.date,
            realisations: action.payload.realisations || null,
            difficultes: action.payload.difficultes || null,
            remarques: action.payload.remarques || null,
            updated_at: action.payload.updatedAt || new Date().toISOString()
          }).eq('id', action.payload.id);
          if (error) console.error('[Sync] UPDATE_ACTIVITY_REPORT échoué :', error.message);
          success = checkResult(error);
          break;
        }
        case 'DELETE_ACTIVITY_REPORT': { // @deprecated V1
          const { error } = await supabase.from('activity_reports').delete().eq('id', action.payload.id);
          success = checkResult(error);
          break;
        }
        case 'INSERT_WEEKLY_REPORT': { // @deprecated V1
          const { error } = await supabase.from('weekly_reports').insert([{
            id: action.payload.id,
            author_id: action.payload.authorId,
            role: action.payload.role,
            week_start: action.payload.weekStart,
            sections: action.payload.sections || [],
            kpis: action.payload.kpis || {},
            status: action.payload.status || 'Brouillon'
          }]);
          if (error) console.error('[Sync] INSERT_WEEKLY_REPORT échoué :', error.message);
          success = checkResult(error);
          break;
        }
        case 'UPDATE_WEEKLY_REPORT': { // @deprecated V1 - Always needed for markWeeklyReportRead by managers on old reports
          const { sent_at, status, ...rest } = action.payload;
          const mapped: any = {};
          if (rest.sections !== undefined) mapped.sections = rest.sections;
          if (rest.kpis !== undefined) mapped.kpis = rest.kpis;
          if (status !== undefined) mapped.status = status;
          if (sent_at !== undefined) mapped.sent_at = sent_at;
          const { error } = await supabase.from('weekly_reports').update(mapped).eq('id', action.payload.id);
          if (error) console.error('[Sync] UPDATE_WEEKLY_REPORT échoué :', error.message);
          success = checkResult(error);
          break;
        }
        case 'INSERT_V2_DAILY_REPORT': {
          const { error } = await supabase.from('v2_daily_reports').insert([{
            id: action.payload.id, author_id: action.payload.authorId, date: action.payload.date, project: action.payload.project,
            objectives: action.payload.objectives, tasks: action.payload.tasks, results: action.payload.results,
            difficulties: action.payload.difficulties, observations: action.payload.observations, status: action.payload.status
          }]);
          if (error) console.error('[Sync] INSERT_V2_DAILY_REPORT échoué :', error.message);
          success = checkResult(error);
          break;
        }
        case 'UPDATE_V2_DAILY_REPORT': {
          const { error } = await supabase.from('v2_daily_reports').update({
            date: action.payload.date, project: action.payload.project,
            objectives: action.payload.objectives, tasks: action.payload.tasks, results: action.payload.results,
            difficulties: action.payload.difficulties, observations: action.payload.observations, status: action.payload.status,
            updated_at: action.payload.updatedAt || new Date().toISOString()
          }).eq('id', action.payload.id);
          if (error) console.error('[Sync] UPDATE_V2_DAILY_REPORT échoué :', error.message);
          success = checkResult(error);
          break;
        }
        case 'INSERT_V2_WEEKLY_REPORT': {
          const r = action.payload;
          const { error } = await supabase.from('v2_weekly_reports').insert([{
            id: r.id,
            author_id: r.authorId,
            week_start: r.weekStart,
            week_end: r.weekEnd || null,
            project: r.project || null,
            daily_report_ids: r.dailyReportIds || [],
            weekly_objectives: r.weeklyObjectives || '',
            tasks_by_day: r.tasksByDay || {},
            pending_tasks: r.pendingTasks || [],
            summary: r.summary || r.aiSummary || '',
            ai_summary: r.aiSummary || r.summary || '',
            achievements: r.achievements || '',
            difficulties: r.difficulties || '',
            next_week_objectives: r.nextWeekObjectives || '',
            conclusion: r.conclusion || '',
            director_comment: r.directorComment || null,
            submitted_at: r.submittedAt || null,
            reviewed_at: r.reviewedAt || null,
            reviewed_by: r.reviewedBy || null,
            status: r.status || 'Brouillon'
          }]);
          if (error) console.error('[Sync] INSERT_V2_WEEKLY_REPORT échoué :', error.message);
          success = checkResult(error);
          break;
        }
        case 'UPDATE_V2_WEEKLY_REPORT': {
          const r = action.payload;
          const mapped: any = { updated_at: r.updatedAt || new Date().toISOString() };
          if (r.project !== undefined) mapped.project = r.project;
          if (r.weekEnd !== undefined) mapped.week_end = r.weekEnd;
          if (r.dailyReportIds !== undefined) mapped.daily_report_ids = r.dailyReportIds;
          if (r.weeklyObjectives !== undefined) mapped.weekly_objectives = r.weeklyObjectives;
          if (r.tasksByDay !== undefined) mapped.tasks_by_day = r.tasksByDay;
          if (r.pendingTasks !== undefined) mapped.pending_tasks = r.pendingTasks;
          if (r.summary !== undefined || r.aiSummary !== undefined) {
            mapped.summary = r.summary || r.aiSummary || '';
            mapped.ai_summary = r.aiSummary || r.summary || '';
          }
          if (r.achievements !== undefined) mapped.achievements = r.achievements;
          if (r.difficulties !== undefined) mapped.difficulties = r.difficulties;
          if (r.nextWeekObjectives !== undefined) mapped.next_week_objectives = r.nextWeekObjectives;
          if (r.conclusion !== undefined) mapped.conclusion = r.conclusion;
          if (r.directorComment !== undefined) mapped.director_comment = r.directorComment;
          if (r.submittedAt !== undefined) mapped.submitted_at = r.submittedAt;
          if (r.reviewedAt !== undefined) mapped.reviewed_at = r.reviewedAt;
          if (r.reviewedBy !== undefined) mapped.reviewed_by = r.reviewedBy;
          if (r.status !== undefined) mapped.status = r.status;

          const { error } = await supabase.from('v2_weekly_reports').update(mapped).eq('id', r.id);
          if (error) console.error('[Sync] UPDATE_V2_WEEKLY_REPORT échoué :', error.message);
          success = checkResult(error);
          break;
        }
        case 'DELETE_V2_WEEKLY_REPORT': {
          const { error } = await supabase.from('v2_weekly_reports').delete().eq('id', action.payload.id);
          success = checkResult(error);
          break;
        }
        case 'INSERT_CRM_FOLDER': {
          const folder = action.payload;
          let { error } = await supabase.from('crm_folders').upsert([{
            id: folder.id,
            name: folder.name,
            owner_id: isUuid(folder.ownerId) ? folder.ownerId : null,
            parent_id: isUuid(folder.parentId) ? folder.parentId : null,
            color: folder.color || '#0D9488',
            is_shared: !!folder.isShared
          }], { onConflict: 'id' });
          if (error && isForeignKeyError(error)) {
            console.warn('[Sync] INSERT_CRM_FOLDER violation FK détectée, auto-réparation avec relations nulles');
            const fallback = await supabase.from('crm_folders').upsert([{
              id: folder.id,
              name: folder.name,
              owner_id: null,
              parent_id: null,
              color: folder.color || '#0D9488',
              is_shared: !!folder.isShared
            }], { onConflict: 'id' });
            error = fallback.error;
          }
          if (error) console.error('[Sync] INSERT_CRM_FOLDER échoué :', error.message);
          success = checkResult(error);
          break;
        }
        case 'UPDATE_CRM_FOLDER': {
          let { error } = await supabase.from('crm_folders').update({
            name: action.payload.name,
            parent_id: isUuid(action.payload.parentId) ? action.payload.parentId : null,
            color: action.payload.color,
            is_shared: action.payload.isShared,
            updated_at: new Date().toISOString()
          }).eq('id', action.payload.id);
          if (error && isForeignKeyError(error)) {
            console.warn('[Sync] UPDATE_CRM_FOLDER violation FK détectée, auto-réparation');
            const fallback = await supabase.from('crm_folders').update({
              name: action.payload.name,
              parent_id: null,
              color: action.payload.color,
              is_shared: action.payload.isShared,
              updated_at: new Date().toISOString()
            }).eq('id', action.payload.id);
            error = fallback.error;
          }
          if (error) console.error('[Sync] UPDATE_CRM_FOLDER échoué :', error.message);
          success = checkResult(error);
          break;
        }
        case 'DELETE_CRM_FOLDER': {
          // Détacher d'abord les documents et sous-dossiers liés pour éviter les erreurs de clé étrangère
          await supabase.from('crm_documents').update({ folder_id: null }).eq('folder_id', action.payload.id);
          await supabase.from('crm_folders').update({ parent_id: null }).eq('parent_id', action.payload.id);
          const { error } = await supabase.from('crm_folders').delete().eq('id', action.payload.id);
          if (error) console.error('[Sync] DELETE_CRM_FOLDER échoué :', error.message);
          success = checkResult(error);
          break;
        }
        case 'INSERT_DOCUMENT': {
          const { id, name, type, sizeBytes, filePath, uploaderId, folderId, affaireId, clientId, category, isShared } = action.payload;
          const fileData: Blob | null = await db.documentFiles.getItem(id);
          
          if (fileData && filePath) {
            try {
              const { error: storageError } = await supabase.storage.from('crm_documents').upload(filePath, fileData, { upsert: true });
              if (storageError) {
                console.error('[Sync] INSERT_DOCUMENT Storage Error:', storageError);
                if (isNetworkOrTransientError(storageError)) {
                  throw new Error(`[NetworkError] Storage upload failed: ${storageError.message}`);
                }
              }
            } catch (err: any) {
              if (isNetworkOrTransientError(err)) throw err;
              console.warn('[Sync] INSERT_DOCUMENT Non-blocking storage warning:', err);
            }
          }

          let { error } = await supabase.from('crm_documents').upsert([{
            id,
            name,
            type,
            size_bytes: sizeBytes,
            file_path: filePath,
            uploader_id: isUuid(uploaderId) ? uploaderId : null,
            folder_id: isUuid(folderId) ? folderId : null,
            affaire_id: isUuid(affaireId) ? affaireId : null,
            client_id: isUuid(clientId) ? clientId : null,
            category: category || 'Autre',
            is_shared: !!isShared
          }], { onConflict: 'id' });

          if (error && isForeignKeyError(error)) {
            console.warn('[Sync] INSERT_DOCUMENT violation FK détectée, auto-réparation avec relations nulles');
            const fallback = await supabase.from('crm_documents').upsert([{
              id,
              name,
              type,
              size_bytes: sizeBytes,
              file_path: filePath,
              uploader_id: null,
              folder_id: null,
              affaire_id: null,
              client_id: null,
              category: category || 'Autre',
              is_shared: !!isShared
            }], { onConflict: 'id' });
            error = fallback.error;
          }

          if (error) console.error('[Sync] INSERT_DOCUMENT DB Error:', error.message);
          success = checkResult(error);
          break;
        }
        case 'UPDATE_DOCUMENT': {
          const { id, updates, hasNewFile } = action.payload;
          if (hasNewFile) {
            const fileData: Blob | null = await db.documentFiles.getItem(id);
            if (fileData && updates.filePath) {
              try {
                const { error: storageError } = await supabase.storage.from('crm_documents').upload(updates.filePath, fileData, { upsert: true });
                if (storageError && isNetworkOrTransientError(storageError)) {
                  throw new Error(`[NetworkError] Storage update failed: ${storageError.message}`);
                }
              } catch (err: any) {
                if (isNetworkOrTransientError(err)) throw err;
                console.warn('[Sync] UPDATE_DOCUMENT Non-blocking storage warning:', err);
              }
            }
          }
          const dbUpdates: any = { updated_at: new Date().toISOString() };
          if (updates.name !== undefined) dbUpdates.name = updates.name;
          if (updates.type !== undefined) dbUpdates.type = updates.type;
          if (updates.sizeBytes !== undefined) dbUpdates.size_bytes = updates.sizeBytes;
          if (updates.folderId !== undefined) dbUpdates.folder_id = isUuid(updates.folderId) ? updates.folderId : null;
          if (updates.affaireId !== undefined) dbUpdates.affaire_id = isUuid(updates.affaireId) ? updates.affaireId : null;
          if (updates.clientId !== undefined) dbUpdates.client_id = isUuid(updates.clientId) ? updates.clientId : null;
          if (updates.category !== undefined) dbUpdates.category = updates.category || 'Autre';
          if (updates.isShared !== undefined) dbUpdates.is_shared = !!updates.isShared;

          let { error } = await supabase.from('crm_documents').update(dbUpdates).eq('id', id);
          if (error && isForeignKeyError(error)) {
            console.warn('[Sync] UPDATE_DOCUMENT violation FK détectée, repli sans les relations');
            const fallback = await supabase.from('crm_documents').update({
              name: updates.name,
              type: updates.type,
              size_bytes: updates.sizeBytes,
              folder_id: null,
              affaire_id: null,
              client_id: null,
              category: updates.category || 'Autre',
              is_shared: !!updates.isShared,
              updated_at: new Date().toISOString()
            }).eq('id', id);
            error = fallback.error;
          }
          if (error) console.error('[Sync] UPDATE_DOCUMENT DB Error:', error.message);
          success = checkResult(error);
          break;
        }
        case 'DELETE_DOCUMENT': {
          const { error } = await supabase.from('crm_documents').delete().eq('id', action.payload.id);
          if (action.payload.filePath) {
            try {
              await supabase.storage.from('crm_documents').remove([action.payload.filePath]);
            } catch (err) {
              console.warn('[Sync] DELETE_DOCUMENT Storage remove warning:', err);
            }
          }
          success = checkResult(error);
          break;
        }
        case 'MARK_NOTIFICATION_READ': {
          const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', action.payload.id);
          if (error) console.error('[Sync] MARK_NOTIFICATION_READ échoué :', error.message);
          success = checkResult(error);
          break;
        }
        case 'MARK_ALL_NOTIFICATIONS_READ': {
          const { error } = await supabase.from('notifications').update({ is_read: true }).eq('user_id', action.payload.user_id).eq('is_read', false);
          if (error) console.error('[Sync] MARK_ALL_NOTIFICATIONS_READ échoué :', error.message);
          success = checkResult(error);
          break;
        }
        case 'INSERT_PRESTATION': {
          const { error } = await supabase.from('prestations').insert([{
            id: action.payload.id, code: action.payload.code, name: action.payload.name, description: action.payload.description, price: action.payload.price, service_id: isUuid(action.payload.serviceId) ? action.payload.serviceId : null, unit: action.payload.unit, cost_price: action.payload.costPrice || 0
          }]);
          if (error) console.error('[Sync] INSERT_PRESTATION échoué :', error.message);
          success = checkResult(error);
          break;
        }
        case 'DELETE_PRESTATION': {
          const { error } = await supabase.from('prestations').delete().eq('id', action.payload.id);
          success = checkResult(error);
          break;
        }
        case 'UPDATE_PRESTATION': {
          const { id, ...updateData } = action.payload;
          const { error } = await supabase.from('prestations').update({
            code: updateData.code, name: updateData.name, description: updateData.description, price: updateData.price, service_id: isUuid(updateData.serviceId) ? updateData.serviceId : null, unit: updateData.unit, cost_price: updateData.costPrice || 0
          }).eq('id', id);
          if (error) console.error('[Sync] UPDATE_PRESTATION échoué :', error.message);
          success = checkResult(error);
          break;
        }
        case 'INSERT_SERVICE': {
          const { error } = await supabase.from('services').insert([{
            id: action.payload.id,
            name: action.payload.name,
            description: action.payload.description,
            members: action.payload.members,
            commission_rate: action.payload.commissionRate !== undefined ? action.payload.commissionRate : null
          }]);
          if (error) console.error('[Sync] INSERT_SERVICE échoué :', error.message);
          success = checkResult(error);
          break;
        }
        case 'UPDATE_SERVICE': {
          const { id, ...updateData } = action.payload;
          const mapped: any = {};
          if (updateData.name !== undefined) mapped.name = updateData.name;
          if (updateData.description !== undefined) mapped.description = updateData.description;
          if (updateData.members !== undefined) mapped.members = updateData.members;
          if (updateData.commissionRate !== undefined) mapped.commission_rate = updateData.commissionRate;
          const { error } = await supabase.from('services').update(mapped).eq('id', id);
          if (error) console.error('[Sync] UPDATE_SERVICE échoué :', error.message);
          success = checkResult(error);
          break;
        }
        case 'DELETE_SERVICE': {
          const { error } = await supabase.from('services').delete().eq('id', action.payload.id);
          success = checkResult(error);
          break;
        }
        // === POS SYNC ===
        case 'INSERT_POS_CATEGORY': {
          const { error } = await supabase.from('pos_categories').upsert([{ id: action.payload.id, name: action.payload.name, family: action.payload.family }], { onConflict: 'id' });
          success = checkResult(error);
          break;
        }
        case 'UPDATE_POS_CATEGORY': {
          const { id, ...data } = action.payload;
          const { error } = await supabase.from('pos_categories').upsert([{ id, ...data }], { onConflict: 'id' });
          success = checkResult(error);
          break;
        }
        case 'DELETE_POS_CATEGORY': {
          const { error } = await supabase.from('pos_categories').delete().eq('id', action.payload.id);
          success = checkResult(error);
          break;
        }
        case 'INSERT_POS_BRAND': {
          const { error } = await supabase.from('pos_brands').upsert([{ id: action.payload.id, name: action.payload.name }], { onConflict: 'id' });
          success = checkResult(error);
          break;
        }
        case 'UPDATE_POS_BRAND': {
          const { id, ...data } = action.payload;
          const { error } = await supabase.from('pos_brands').upsert([{ id, ...data }], { onConflict: 'id' });
          success = checkResult(error);
          break;
        }
        case 'DELETE_POS_BRAND': {
          const { error } = await supabase.from('pos_brands').delete().eq('id', action.payload.id);
          success = checkResult(error);
          break;
        }
        case 'INSERT_POS_SUPPLIER': {
          const { error } = await supabase.from('pos_suppliers').upsert([{ id: action.payload.id, name: action.payload.name, contact: action.payload.contact, phone: action.payload.phone, email: action.payload.email, address: action.payload.address }], { onConflict: 'id' });
          success = checkResult(error);
          break;
        }
        case 'UPDATE_POS_SUPPLIER': {
          const { id, ...data } = action.payload;
          const { error } = await supabase.from('pos_suppliers').upsert([{ id, ...data }], { onConflict: 'id' });
          success = checkResult(error);
          break;
        }
        case 'DELETE_POS_SUPPLIER': {
          const { error } = await supabase.from('pos_suppliers').delete().eq('id', action.payload.id);
          success = checkResult(error);
          break;
        }
        case 'INSERT_POS_PRODUCT': {
          const rawId = action.payload.id;
          const ref = action.payload.reference;
          const fam = action.payload.family;
          if (fam === 'Service' || ref?.startsWith('SRV-') || rawId === '00000000-0000-0000-0000-000000000000') {
            success = true; // Auto-clear retired service products
            break;
          }
          const resolvedId = resolveProductUuid(rawId, ref);
          if (!isUuid(resolvedId)) {
            console.warn('[Sync] INSERT_POS_PRODUCT ignoré pour ID non-UUID :', rawId);
            success = true;
            break;
          }
          const { error } = await supabase.from('pos_products').upsert([{
            id: resolvedId,
            reference: action.payload.reference, 
            barcode: action.payload.barcode ? action.payload.barcode : null,
            isbn: action.payload.isbn ? action.payload.isbn : null, 
            name: action.payload.name,
            family: action.payload.family,
            category_id: isUuid(action.payload.categoryId) ? action.payload.categoryId : null,
            brand_id: isUuid(action.payload.brandId) ? action.payload.brandId : null,
            supplier_id: isUuid(action.payload.supplierId) ? action.payload.supplierId : null,
            purchase_price: action.payload.purchasePrice ?? 0,
            selling_price: action.payload.sellingPrice ?? 0,
            quantity: action.payload.quantity ?? 0,
            min_stock: action.payload.minStock ?? 0,
            image_url: action.payload.imageUrl || null,
            description: action.payload.description || null,
            unit: action.payload.unit || null,
            is_active: action.payload.isActive !== false,
            updated_at: action.payload.updatedAt || new Date().toISOString()
          }], { onConflict: 'id' });
          if (error) console.error('[Sync] INSERT_POS_PRODUCT échoué :', error);
          success = checkResult(error);
          break;
        }
        case 'UPDATE_POS_PRODUCT': {
          const { id, ...data } = action.payload;
          const ref = data.reference;
          const fam = data.family;
          if (fam === 'Service' || ref?.startsWith('SRV-') || id === '00000000-0000-0000-0000-000000000000' || id?.startsWith('srv-')) {
            success = true; // Auto-clear retired service products
            break;
          }
          const resolvedId = resolveProductUuid(id, ref);
          if (!isUuid(resolvedId)) {
            console.warn('[Sync] UPDATE_POS_PRODUCT ignoré pour ID non-UUID :', id);
            success = true;
            break;
          }
          const mapped: any = { id: resolvedId };
          if (data.reference !== undefined) mapped.reference = data.reference;
          if (data.barcode !== undefined) mapped.barcode = data.barcode ? data.barcode : null;
          if (data.isbn !== undefined) mapped.isbn = data.isbn ? data.isbn : null;
          if (data.name !== undefined) mapped.name = data.name;
          if (data.family !== undefined) mapped.family = data.family;
          if (data.categoryId !== undefined) mapped.category_id = isUuid(data.categoryId) ? data.categoryId : null;
          if (data.brandId !== undefined) mapped.brand_id = isUuid(data.brandId) ? data.brandId : null;
          if (data.supplierId !== undefined) mapped.supplier_id = isUuid(data.supplierId) ? data.supplierId : null;
          if (data.purchasePrice !== undefined) mapped.purchase_price = data.purchasePrice;
          if (data.sellingPrice !== undefined) mapped.selling_price = data.sellingPrice;
          if (data.quantity !== undefined) mapped.quantity = Math.max(0, data.quantity);
          if (data.minStock !== undefined) mapped.min_stock = data.minStock;
          if (data.imageUrl !== undefined) mapped.image_url = data.imageUrl || null;
          if (data.description !== undefined) mapped.description = data.description || null;
          if (data.unit !== undefined) mapped.unit = data.unit || null;
          if (data.isActive !== undefined) mapped.is_active = data.isActive;
          mapped.updated_at = new Date().toISOString();
          const { error } = await supabase.from('pos_products').upsert([mapped], { onConflict: 'id' });
          if (error) console.error('[Sync] UPDATE_POS_PRODUCT échoué :', error);
          success = checkResult(error);
          break;
        }
        case 'DELETE_POS_PRODUCT': {
          const resolvedId = resolveProductUuid(action.payload.id);
          if (!isUuid(resolvedId)) {
            success = true;
            break;
          }
          const { error } = await supabase.from('pos_products').delete().eq('id', resolvedId);
          if (error) {
            if (isNetworkOrTransientError(error)) {
              throw new Error(`[NetworkError] ${error.message}`);
            }
            console.warn('[Sync] DELETE_POS_PRODUCT impossible (contrainte FK), passage en is_active=false :', error.message);
            const { error: updateError } = await supabase.from('pos_products').update({ is_active: false }).eq('id', resolvedId);
            success = checkResult(updateError);
          } else {
            success = true;
          }
          break;
        }
        case 'INSERT_POS_STOCK_MOVEMENT': {
          const rawPid = action.payload.productId;
          const ref = action.payload.reference;
          if (ref?.startsWith('SRV-') || rawPid?.startsWith('srv-') || rawPid === '00000000-0000-0000-0000-000000000000') {
            success = true; // Auto-clear retired service movements
            break;
          }
          const resolvedProductId = resolveProductUuid(rawPid, ref);
          if (!isUuid(resolvedProductId)) {
            console.warn('[Sync] INSERT_POS_STOCK_MOVEMENT ignoré pour ID produit non-UUID :', rawPid);
            success = true;
            break;
          }
          const { error } = await supabase.from('pos_stock_movements').upsert([{
            id: action.payload.id || uuidv4(),
            product_id: resolvedProductId,
            type: action.payload.type,
            quantity: action.payload.quantity,
            reference: action.payload.reference || null,
            date: action.payload.date || new Date().toISOString(),
            created_by: action.payload.createdBy ? String(action.payload.createdBy) : null,
            notes: action.payload.notes || null
          }], { onConflict: 'id' });
          if (error) {
            if (isForeignKeyError(error)) {
              console.warn('[Sync] INSERT_POS_STOCK_MOVEMENT ignoré (clé étrangère / produit inexistant) :', error.message);
              success = true;
              break;
            }
            console.error('[Sync] INSERT_POS_STOCK_MOVEMENT échoué :', error);
          }
          success = checkResult(error);
          break;
        }
        case 'INSERT_POS_STOCK_ENTRY': {
          const { lines, ...entryData } = action.payload;
          const { error } = await supabase.from('pos_stock_entries').upsert([{
            id: entryData.id,
            reference: entryData.reference,
            supplier_id: isUuid(entryData.supplierId) ? entryData.supplierId : null,
            date: entryData.date,
            total_amount: entryData.totalAmount ?? 0,
            status: entryData.status,
            notes: entryData.notes || null,
            created_by: isUuid(entryData.createdBy) ? entryData.createdBy : null
          }], { onConflict: 'id' });
          if (!error && lines && lines.length > 0) {
            const linesData = lines.map((l: any) => ({
              id: l.id || uuidv4(), entry_id: entryData.id, product_id: isUuid(l.productId) ? l.productId : null,
              quantity: l.quantity, purchase_price: l.purchasePrice, total: l.total
            }));
            const { error: linesErr } = await supabase.from('pos_stock_entry_lines').upsert(linesData, { onConflict: 'id' });
            if (linesErr && isNetworkOrTransientError(linesErr)) throw new Error(`[NetworkError] ${linesErr.message}`);
          }
          success = checkResult(error);
          break;
        }
        case 'UPDATE_POS_STOCK_ENTRY': {
          const { id, lines, ...data } = action.payload;
          const mapped: any = {};
          if (data.status !== undefined) mapped.status = data.status;
          if (data.totalAmount !== undefined) mapped.total_amount = data.totalAmount;
          const { error } = await supabase.from('pos_stock_entries').update(mapped).eq('id', id);
          if (!error) {
            await supabase.from('pos_stock_entry_lines').delete().eq('entry_id', id);
            if (lines && lines.length > 0) {
              const linesData = lines.map((l: any) => ({
                id: l.id || uuidv4(), entry_id: id, product_id: isUuid(l.productId) ? l.productId : null,
                quantity: l.quantity, purchase_price: l.purchasePrice, total: l.total
              }));
              const { error: insLinesErr } = await supabase.from('pos_stock_entry_lines').upsert(linesData, { onConflict: 'id' });
              if (insLinesErr && isNetworkOrTransientError(insLinesErr)) throw new Error(`[NetworkError] ${insLinesErr.message}`);
            }
          }
          success = checkResult(error);
          break;
        }
        case 'DELETE_POS_STOCK_ENTRY': {
          const { error } = await supabase.from('pos_stock_entries').delete().eq('id', action.payload.id);
          success = checkResult(error);
          break;
        }
        case 'INSERT_POS_INVENTORY': {
          const { lines, ...invData } = action.payload;
          const { error } = await supabase.from('pos_inventories').upsert([{
            id: invData.id, reference: invData.reference, date: invData.date,
            status: invData.status, notes: invData.notes,
            created_by: isUuid(invData.createdBy) ? invData.createdBy : null
          }], { onConflict: 'id' });
          if (!error && lines && lines.length > 0) {
            const linesData = lines.map((l: any) => ({
              id: l.id || uuidv4(), inventory_id: invData.id, product_id: isUuid(l.productId) ? l.productId : null,
              expected_qty: l.expectedQty, counted_qty: l.countedQty, difference: l.difference
            }));
            const { error: linesErr } = await supabase.from('pos_inventory_lines').upsert(linesData, { onConflict: 'id' });
            if (linesErr && isNetworkOrTransientError(linesErr)) throw new Error(`[NetworkError] ${linesErr.message}`);
          }
          success = checkResult(error);
          break;
        }
        case 'UPDATE_POS_INVENTORY': {
          const { id, ...data } = action.payload;
          const mapped: any = {};
          if (data.status !== undefined) mapped.status = data.status;
          const { error } = await supabase.from('pos_inventories').update(mapped).eq('id', id);
          success = checkResult(error);
          break;
        }
        case 'DELETE_POS_INVENTORY': {
          const { error } = await supabase.from('pos_inventories').delete().eq('id', action.payload.id);
          success = checkResult(error);
          break;
        }
        case 'INSERT_POS_CASH_SESSION': {
          const { error } = await supabase.from('pos_cash_sessions').upsert([{
            id: action.payload.id, cashier_id: isUuid(action.payload.cashierId) ? action.payload.cashierId : null,
            opened_at: action.payload.openedAt, initial_fund: action.payload.initialFund,
            status: action.payload.status
          }], { onConflict: 'id' });
          success = checkResult(error);
          break;
        }
        case 'UPDATE_POS_CASH_SESSION': {
          const { id, ...data } = action.payload;
          const mapped: any = {};
          if (data.closedAt !== undefined) mapped.closed_at = data.closedAt;
          if (data.finalAmount !== undefined) mapped.final_amount = data.finalAmount;
          if (data.expectedAmount !== undefined) mapped.expected_amount = data.expectedAmount;
          if (data.difference !== undefined) mapped.difference = data.difference;
          if (data.status !== undefined) mapped.status = data.status;
          const { error } = await supabase.from('pos_cash_sessions').update(mapped).eq('id', id);
          success = checkResult(error);
          break;
        }
        case 'INSERT_POS_TRANSACTION': {
          const { lines, payments, ...txData } = action.payload;
          
          const p_transaction = {
            id: txData.id || uuidv4(),
            transaction_number: txData.transactionNumber,
            cashier_id: isUuid(txData.cashierId) ? txData.cashierId : null,
            session_id: isUuid(txData.sessionId) ? txData.sessionId : null,
            date: txData.date,
            subtotal: txData.subtotal,
            discount_amount: txData.discountAmount || 0,
            total: txData.total,
            status: txData.status
          };

          const p_lines = (lines || []).map((l: any) => ({
            id: l.id || uuidv4(),
            transaction_id: p_transaction.id,
            product_id: isUuid(l.productId || l.product_id) ? (l.productId || l.product_id) : null,
            description: l.description || l.name || l.product_name || 'Article',
            quantity: Number(l.quantity) || 1,
            unit_price: Number(l.unitPrice ?? l.unit_price ?? 0),
            discount_percent: Number(l.discountPercent ?? l.discount_percent ?? 0),
            discount_amount: Number(l.discountAmount ?? l.discount_amount ?? 0),
            total: Number(l.total ?? (Number(l.quantity || 1) * Number(l.unitPrice ?? l.unit_price ?? 0)))
          }));

          const p_payments = (payments || []).map((p: any) => ({
            id: p.id || uuidv4(),
            transaction_id: p_transaction.id,
            method: p.method || 'Espèces',
            amount: Number(p.amount ?? p_transaction.total),
            reference: p.reference || null
          }));

          let p_stock_entry = null;
          let p_stock_entry_lines = null;

          const { error } = await supabase.rpc('process_pos_transaction', {
            p_transaction, p_lines, p_payments, p_stock_entry, p_stock_entry_lines
          });

          if (error) {
            if (isNetworkOrTransientError(error)) {
              throw new Error(`[NetworkError] ${error.message}`);
            }
            console.warn('[Sync] RPC process_pos_transaction échoué, repli sur insertion directe :', error.message);
            const { error: txErr } = await supabase.from('pos_transactions').upsert([p_transaction], { onConflict: 'id' });
            if (!txErr) {
              if (p_lines.length > 0) {
                const { error: linesErr } = await supabase.from('pos_transaction_lines').upsert(p_lines, { onConflict: 'id' });
                if (linesErr) {
                  if (isNetworkOrTransientError(linesErr)) throw new Error(`[NetworkError] ${linesErr.message}`);
                  console.error('[Sync] Erreur insertion pos_transaction_lines :', linesErr.message);
                }
              }
              if (p_payments.length > 0) {
                const { error: payErr } = await supabase.from('pos_payments').upsert(p_payments, { onConflict: 'id' });
                if (payErr) {
                  if (isNetworkOrTransientError(payErr)) throw new Error(`[NetworkError] ${payErr.message}`);
                  console.error('[Sync] Erreur insertion pos_payments :', payErr.message);
                }
              }
              success = true;
            } else {
              if (isNetworkOrTransientError(txErr)) {
                throw new Error(`[NetworkError] ${txErr.message}`);
              }
              console.error('[Sync] Insertion directe pos_transactions échouée :', txErr.message);
              success = false;
            }
          } else {
            success = true;
          }
          break;
        }
        case 'UPDATE_POS_TRANSACTION': {
          const { id, ...data } = action.payload;
          const mapped: any = {};
          if (data.status !== undefined) mapped.status = data.status;
          const { error } = await supabase.from('pos_transactions').update(mapped).eq('id', id);
          success = checkResult(error);
          break;
        }
        case 'CLEAR_POS_SALES_HISTORY': {
          const { error: e1 } = await supabase.from('pos_return_lines').delete().neq('id', '00000000-0000-0000-0000-000000000000');
          if (e1 && isNetworkOrTransientError(e1)) throw new Error(`[NetworkError] ${e1.message}`);
          const { error: e2 } = await supabase.from('pos_returns').delete().neq('id', '00000000-0000-0000-0000-000000000000');
          if (e2 && isNetworkOrTransientError(e2)) throw new Error(`[NetworkError] ${e2.message}`);
          const { error: e3 } = await supabase.from('pos_payments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
          if (e3 && isNetworkOrTransientError(e3)) throw new Error(`[NetworkError] ${e3.message}`);
          const { error: e4 } = await supabase.from('pos_transaction_lines').delete().neq('id', '00000000-0000-0000-0000-000000000000');
          if (e4 && isNetworkOrTransientError(e4)) throw new Error(`[NetworkError] ${e4.message}`);
          const { error: e5 } = await supabase.from('pos_transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
          if (e5 && isNetworkOrTransientError(e5)) throw new Error(`[NetworkError] ${e5.message}`);
          success = true;
          break;
        }
        case 'DELETE_POS_MOVEMENTS_BY_RANGE': {
          const { startDate, endDate } = action.payload;
          const startIso = `${startDate}T00:00:00.000Z`;
          const endIso = `${endDate}T23:59:59.999Z`;

          // 1. Transactions de la plage
          const { data: targetTxs, error: txFetchErr } = await supabase
            .from('pos_transactions')
            .select('id')
            .gte('date', startIso)
            .lte('date', endIso);

          if (txFetchErr && isNetworkOrTransientError(txFetchErr)) throw new Error(`[NetworkError] ${txFetchErr.message}`);

          const txIds = (targetTxs || []).map((t: any) => t.id);

          if (txIds.length > 0) {
            await supabase.from('pos_payments').delete().in('transaction_id', txIds);
            await supabase.from('pos_transaction_lines').delete().in('transaction_id', txIds);
            await supabase.from('pos_transactions').delete().in('id', txIds);
          }

          // 2. Retours de la plage
          const { data: targetReturns, error: retFetchErr } = await supabase
            .from('pos_returns')
            .select('id')
            .gte('date', startIso)
            .lte('date', endIso);

          if (retFetchErr && isNetworkOrTransientError(retFetchErr)) throw new Error(`[NetworkError] ${retFetchErr.message}`);

          const returnIds = (targetReturns || []).map((r: any) => r.id);
          if (returnIds.length > 0) {
            await supabase.from('pos_return_lines').delete().in('return_id', returnIds);
            await supabase.from('pos_returns').delete().in('id', returnIds);
          }

          // 3. Sessions de caisse de la plage
          const { error: sessionDelErr } = await supabase
            .from('pos_cash_sessions')
            .delete()
            .gte('opened_at', startIso)
            .lte('opened_at', endIso);

          if (sessionDelErr && isNetworkOrTransientError(sessionDelErr)) throw new Error(`[NetworkError] ${sessionDelErr.message}`);

          success = true;
          break;
        }
        case 'INSERT_POS_PAYMENT': {
          const { error } = await supabase.from('pos_payments').upsert([{
            id: action.payload.id,
            transaction_id: isUuid(action.payload.transactionId) ? action.payload.transactionId : null,
            method: action.payload.method,
            amount: action.payload.amount,
            reference: action.payload.reference || null
          }], { onConflict: 'id' });
          success = checkResult(error);
          break;
        }
        case 'INSERT_POS_DISCOUNT': {
          const { error } = await supabase.from('pos_discounts').upsert([{
            id: action.payload.id, name: action.payload.name, type: action.payload.type,
            value: action.payload.value, max_percent: action.payload.maxPercent,
            max_amount: action.payload.maxAmount, active: action.payload.active
          }], { onConflict: 'id' });
          success = checkResult(error);
          break;
        }
        case 'UPDATE_POS_DISCOUNT': {
          const { id, ...data } = action.payload;
          const mapped: any = {};
          if (data.name !== undefined) mapped.name = data.name;
          if (data.type !== undefined) mapped.type = data.type;
          if (data.value !== undefined) mapped.value = data.value;
          if (data.maxPercent !== undefined) mapped.max_percent = data.maxPercent;
          if (data.maxAmount !== undefined) mapped.max_amount = data.maxAmount;
          if (data.active !== undefined) mapped.active = data.active;
          const { error } = await supabase.from('pos_discounts').update(mapped).eq('id', id);
          success = checkResult(error);
          break;
        }
        case 'DELETE_POS_DISCOUNT': {
          const { error } = await supabase.from('pos_discounts').delete().eq('id', action.payload.id);
          success = checkResult(error);
          break;
        }
        case 'UPDATE_POS_SETTINGS': {
          const { error } = await supabase.from('pos_settings').upsert([{
            id: 1,
            library_name: action.payload.libraryName || 'Ma Librairie',
            address: action.payload.address || null,
            phone: action.payload.phone || null,
            email: action.payload.email || null,
            currency: action.payload.currency || 'FCFA',
            ticket_message: action.payload.ticketMessage || null,
            printer_type: action.payload.printerType || 'Thermique 80mm',
            updated_at: new Date().toISOString()
          }], { onConflict: 'id' });
          success = checkResult(error);
          break;
        }
        case 'INSERT_POS_RETURN': {
          const { lines, exchangeLines, ...returnData } = action.payload;
          const { error } = await supabase.from('pos_returns').upsert([{
            id: returnData.id, return_number: returnData.returnNumber,
            transaction_id: isUuid(returnData.transactionId) ? returnData.transactionId : null,
            date: returnData.date,
            type: returnData.type, total_refund: returnData.totalRefund ?? 0,
            total_exchange: returnData.totalExchange ?? 0, status: returnData.status,
            notes: returnData.notes || null,
            created_by: isUuid(returnData.createdBy) ? returnData.createdBy : null
          }], { onConflict: 'id' });
          if (!error) {
            const allLinesData: any[] = [];
            if (lines && lines.length > 0) {
              lines.forEach((l: any) => {
                allLinesData.push({
                  id: l.id || uuidv4(),
                  return_id: returnData.id,
                  product_id: isUuid(l.productId) ? l.productId : null,
                  description: l.description,
                  quantity: l.quantity,
                  unit_price: l.unitPrice,
                  total: l.total,
                  reason: l.reason || 'Retour'
                });
              });
            }
            if (exchangeLines && exchangeLines.length > 0) {
              exchangeLines.forEach((l: any) => {
                allLinesData.push({
                  id: l.id || uuidv4(),
                  return_id: returnData.id,
                  product_id: isUuid(l.productId) ? l.productId : null,
                  description: l.description,
                  quantity: l.quantity,
                  unit_price: l.unitPrice,
                  total: l.total,
                  reason: 'Échange'
                });
              });
            }
            if (allLinesData.length > 0) {
              await supabase.from('pos_return_lines').upsert(allLinesData, { onConflict: 'id' });
            }
          }
          success = checkResult(error);
          break;
        }
        case 'UPDATE_POS_RETURN': {
          const { id, ...data } = action.payload;
          const mapped: any = {};
          if (data.status !== undefined) mapped.status = data.status;
          const { error } = await supabase.from('pos_returns').update(mapped).eq('id', id);
          success = checkResult(error);
          break;
        }
        case 'INSERT_PRODUCT_COMPLETION': {
          const { error } = await supabase.from('product_completions').upsert([{
            id: action.payload.id,
            product_id: isUuid(action.payload.productId) ? action.payload.productId : null,
            missing_field: action.payload.missingField,
            current_value: action.payload.currentValue,
            suggested_value: action.payload.suggestedValue,
            created_at: action.payload.createdAt
          }], { onConflict: 'id' });
          success = checkResult(error);
          break;
        }
        case 'UPDATE_PRODUCT_COMPLETION': {
          const { id, ...data } = action.payload;
          const { error } = await supabase.from('product_completions').update(data).eq('id', id);
          success = checkResult(error);
          break;
        }
        case 'DELETE_PRODUCT_COMPLETION': {
          const { error } = await supabase.from('product_completions').delete().eq('id', action.payload.id);
          success = checkResult(error);
          break;
        }
        case 'INSERT_IMPORT_SESSION': {
          const { errors, ...sessionData } = action.payload;
          const { error } = await supabase.from('import_sessions').upsert([{
            id: sessionData.id,
            filename: sessionData.filename,
            status: sessionData.status,
            total_rows: sessionData.totalRows,
            processed_rows: sessionData.processedRows,
            successful_creations: sessionData.successfulCreations,
            successful_updates: sessionData.successfulUpdates,
            ignored_rows: sessionData.ignoredRows,
            created_at: sessionData.createdAt,
            completed_at: sessionData.completedAt || null
          }], { onConflict: 'id' });
          if (!error && errors && errors.length > 0) {
            const errorData = errors.map((e: any) => ({
              id: isUuid(e.id) ? e.id : uuidv4(),
              row_number: e.row, session_id: sessionData.id, field_name: e.field,
              field_value: e.value, error_message: e.error, severity: e.severity
            }));
            await supabase.from('import_errors').upsert(errorData, { onConflict: 'id' });
          }
          success = checkResult(error);
          break;
        }
        case 'UPDATE_IMPORT_SESSION': {
          const { id, ...data } = action.payload;
          const mapped: any = {};
          if (data.status !== undefined) mapped.status = data.status;
          if (data.processedRows !== undefined) mapped.processed_rows = data.processedRows;
          if (data.successfulCreations !== undefined) mapped.successful_creations = data.successfulCreations;
          if (data.successfulUpdates !== undefined) mapped.successful_updates = data.successfulUpdates;
          if (data.ignoredRows !== undefined) mapped.ignored_rows = data.ignoredRows;
          if (data.completedAt !== undefined) mapped.completed_at = data.completedAt;
          const { error } = await supabase.from('import_sessions').update(mapped).eq('id', id);
          success = checkResult(error);
          break;
        }
        case 'DELETE_IMPORT_SESSION': {
          const { error } = await supabase.from('import_sessions').delete().eq('id', action.payload.id);
          success = checkResult(error);
          break;
        }
        case 'INSERT_IMPORT_ERROR': {
          const { error } = await supabase.from('import_errors').insert([{
            id: uuidv4(),
            row_number: action.payload.row,
            session_id: action.payload.sessionId || null,
            field_name: action.payload.field,
            field_value: action.payload.value,
            error_message: action.payload.error,
            severity: action.payload.severity
          }]);
          success = checkResult(error);
          break;
        }
        case 'UPDATE_PROFILE': {
          const { id, ...data } = action.payload;
          const mapped: any = { updated_at: new Date().toISOString() };
          if (data.photo !== undefined) mapped.photo = data.photo || null;
          if (data.name !== undefined) mapped.name = data.name;
          if (data.role !== undefined) mapped.role = data.role;
          if (data.active !== undefined) mapped.active = data.active;
          if (data.serviceId !== undefined) mapped.service_id = data.serviceId || null;
          if (data.posRole !== undefined) mapped.pos_role = data.posRole || null;
          if (data.posReturnsEnabled !== undefined) mapped.pos_returns_enabled = data.posReturnsEnabled;
          if (data.posCatalogueEnabled !== undefined) mapped.pos_catalogue_enabled = data.posCatalogueEnabled;
          if (data.posSupplyEnabled !== undefined) mapped.pos_supply_enabled = data.posSupplyEnabled;
          if (data.posInventoryEnabled !== undefined) mapped.pos_inventory_enabled = data.posInventoryEnabled;
          if (data.posStockEnabled !== undefined) mapped.pos_stock_enabled = data.posStockEnabled;
          const { error } = await supabase.from('profiles').update(mapped).eq('id', id);
          if (error) console.error('[Sync] UPDATE_PROFILE échoué :', error.message);
          success = checkResult(error);
          break;
        }
        case 'DELETE_PROFILE': {
          const { error } = await supabase.from('profiles').delete().eq('id', action.payload.id);
          if (error) console.error('[Sync] DELETE_PROFILE échoué :', error.message);
          success = checkResult(error);
          break;
        }
        default:
          success = true; // Ignore unknown actions
        }
        return success;
      };

      try {
        const actionTimeout = (action.type === 'INSERT_DOCUMENT' || action.type === 'UPDATE_DOCUMENT') ? 90000 : 25000;
        success = await withSyncTimeout(executeAction(), actionTimeout);
      } catch (e: any) {
        if (isNetworkOrTransientError(e) || e?.message?.includes('[NetworkError]')) {
          console.warn(`[Sync] Coupure ou instabilité réseau détectée lors de l'action ${action.type}. L'action reste en file d'attente.`);
          // Arrêter le traitement de la file sans purger l'action
          break;
        }
        console.error('Erreur inattendue pour l\'action', action, e);
        success = false;
      }

      if (success) {
        processedIds.add(action.id);
      } else {
        processedIds.add(action.id);

        // Ne jamais enregistrer en erreur ni notifier les actions des services retirés
        if (isRetiredServicePayload(action.type, action.payload)) {
          continue;
        }

        // En cas de rejet définitif du serveur (ex: violation de schéma PostgreSQL avec données corrompues)
        console.warn(`[Sync] Action ${action.type} rejetée définitivement par la base de données. Sauvegardée dans syncErrors.`);
        let currentErrorsCount = 1;
        try {
          const errors = await db.syncErrors.getItem<any[]>('errors') || [];
          errors.push({ action, failedAt: new Date().toISOString() });
          await db.syncErrors.setItem('errors', errors);
          currentErrorsCount = errors.length;
        } catch(err) {
          console.error('Impossible de sauvegarder dans syncErrors', err);
        }

        const labels: Partial<Record<SyncActionType, string>> = {
          'INSERT_POS_TRANSACTION': '⚠️ Une transaction de caisse n\'a pas pu être synchronisée avec le serveur.',
          'INSERT_POS_CASH_SESSION': '⚠️ L\'ouverture de session caisse n\'a pas pu être synchronisée.',
          'UPDATE_POS_CASH_SESSION': '⚠️ La fermeture de session caisse n\'a pas pu être synchronisée.',
          'INSERT_CRM_FOLDER': '⚠️ Échec de synchronisation d\'un dossier CRM.',
          'DELETE_CRM_FOLDER': '⚠️ Échec de suppression d\'un dossier CRM.',
          'INSERT_DOCUMENT': '⚠️ Échec de synchronisation d\'un document.',
          'UPDATE_DOCUMENT': '⚠️ Échec de mise à jour d\'un document.',
          'INSERT_QUOTE': '⚠️ Échec de synchronisation d\'un devis.',
          'INSERT_SALE': '⚠️ Échec de synchronisation d\'une vente.',
          'INSERT_CLIENT': '⚠️ Échec de synchronisation d\'un client.',
        };
        const message = labels[action.type] || `⚠️ Échec de synchronisation : ${action.type}`;
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('sync-critical-error', { detail: { message, action } }));
          window.dispatchEvent(new CustomEvent('sync-errors-updated', { detail: { count: currentErrorsCount } }));
        }
      }
    } catch (e) {
      console.error('Erreur boucle de synchronisation pour l\'action', action, e);
      break;
    }
  }

  // Sauvegarder la file d'attente restante sans écraser les nouvelles actions
  const latestQueue: SyncAction[] = (await db.syncQueue.getItem('queue')) || [];
  const nextQueue = latestQueue.filter(a => !processedIds.has(a.id));
  await db.syncQueue.setItem('queue', nextQueue);
  } finally {
    syncLock = false;
  }
};

// Démon de surveillance automatique et résilience en tâche de fond (Watchdog)
if (typeof window !== 'undefined') {
  // 1. Déclencheur au retour réseau
  window.addEventListener('online', () => {
    console.log('[SyncWatchdog] Connexion rétablie. Lancement immédiat de la synchronisation...');
    processSyncQueue();
  });

  // 2. Déclencheur au focus de la fenêtre (reprise d'activité de l'utilisateur)
  window.addEventListener('focus', () => {
    if (navigator.onLine) {
      processSyncQueue();
    }
  });

  // 3. Déclencheur au changement de visibilité de l'onglet
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && navigator.onLine) {
      processSyncQueue();
    }
  });

  // 4. Heartbeat récurrent toutes les 20 secondes pour vider la file et auto-réparer
  setInterval(async () => {
    if (navigator.onLine && !syncLock) {
      try {
        const queue = (await db.syncQueue.getItem<SyncAction[]>('queue')) || [];
        if (queue.length > 0) {
          processSyncQueue();
        }
      } catch (err) {
        console.warn('[SyncWatchdog] Erreur vérification périodique :', err);
      }
    }
  }, 20000);
}

export interface ReconciliationResult {
  success: boolean;
  sessionsSynced: number;
  transactionsSynced: number;
  movementsSynced: number;
  returnsSynced: number;
  errorsReplayed: number;
  message: string;
}

/**
 * Fonction de réconciliation et de synchronisation d'urgence
 * Compare toutes les sessions, ventes et mouvements enregistrés localement dans IndexedDB
 * avec la base Supabase et pousse tout ce qui est manquant.
 */
export const reconcileLocalPosDataWithCloud = async (): Promise<ReconciliationResult> => {
  let sessionsSynced = 0;
  let transactionsSynced = 0;
  let movementsSynced = 0;
  let returnsSynced = 0;
  let errorsReplayed = 0;

  try {
    if (navigator.onLine) {
      await ensureSupabaseAuth().catch(() => {});
    }

    // 1. Rejouer d'abord les erreurs présentes dans syncErrors avec auto-réparation UUID
    const syncErrors = (await db.syncErrors.getItem<any[]>('errors')) || [];
    if (syncErrors.length > 0) {
      for (const errItem of syncErrors) {
        if (errItem?.action) {
          const action = errItem.action;
          if (action.type === 'UPDATE_POS_PRODUCT' || action.type === 'INSERT_POS_PRODUCT' || action.type === 'DELETE_POS_PRODUCT') {
            const resolvedId = resolveProductUuid(action.payload.id, action.payload.reference);
            if (!isUuid(resolvedId)) {
              console.warn('[SyncReconcile] Action produit obsolète nettoyée :', action.payload.id);
              continue;
            }
            action.payload.id = resolvedId;
          }
          if (action.type === 'INSERT_POS_STOCK_MOVEMENT') {
            if (isRetiredServicePayload(action.type, action.payload)) {
              console.warn('[SyncReconcile] Mouvement stock lié à un service retiré nettoyé :', action.payload.productId);
              continue;
            }
            const resolvedPid = resolveProductUuid(action.payload.productId, action.payload.reference);
            if (!isUuid(resolvedPid)) {
              console.warn('[SyncReconcile] Mouvement stock avec ID produit non-UUID nettoyé :', action.payload.productId);
              continue;
            }
            action.payload.productId = resolvedPid;
          }
          await queueSyncAction(action.type, action.payload);
          errorsReplayed++;
        }
      }
      // Vider le store d'erreurs une fois remises dans la file
      await db.syncErrors.setItem('errors', []);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('sync-errors-updated', { detail: { count: 0 } }));
      }
    }

    // 2. Synchroniser les sessions de caisse locales manquantes
    const localSessions = (await db.posCashSessions.getItem<any[]>('data')) || [];
    if (localSessions.length > 0) {
      const { data: remoteSessions } = await supabase.from('pos_cash_sessions').select('id');
      const remoteSessionIds = new Set((remoteSessions || []).map((s: any) => s.id));
      const missingSessions = localSessions.filter(s => !remoteSessionIds.has(s.id));

      for (const s of missingSessions) {
        const { error } = await supabase.from('pos_cash_sessions').upsert([{
          id: s.id,
          cashier_id: isUuid(s.cashierId) ? s.cashierId : null,
          opened_at: s.openedAt,
          closed_at: s.closedAt || null,
          initial_fund: s.initialFund || 0,
          final_amount: s.finalAmount || null,
          expected_amount: s.expectedAmount || null,
          difference: s.difference || null,
          status: s.status || 'Ouverte'
        }], { onConflict: 'id' });
        if (!error) sessionsSynced++;
      }
    }

    // 3. Synchroniser les transactions locales manquantes
    const localTxs = (await db.posTransactions.getItem<any[]>('data')) || [];
    if (localTxs.length > 0) {
      const { data: remoteTxs } = await supabase.from('pos_transactions').select('id');
      const remoteTxIds = new Set((remoteTxs || []).map((t: any) => t.id));
      const missingTxs = localTxs.filter(t => !remoteTxIds.has(t.id));

      for (const tx of missingTxs) {
        const p_transaction = {
          id: tx.id,
          transaction_number: tx.transactionNumber,
          cashier_id: isUuid(tx.cashierId) ? tx.cashierId : null,
          session_id: isUuid(tx.sessionId) ? tx.sessionId : null,
          date: tx.date,
          subtotal: tx.subtotal,
          discount_amount: tx.discountAmount || 0,
          total: tx.total,
          status: tx.status || 'Validée'
        };
        const p_lines = (tx.lines || []).map((l: any) => ({
          id: l.id || uuidv4(),
          transaction_id: tx.id,
          product_id: isUuid(l.productId) ? l.productId : null,
          description: l.description,
          quantity: l.quantity,
          unit_price: l.unitPrice,
          discount_percent: l.discountPercent || 0,
          discount_amount: l.discountAmount || 0,
          total: l.total
        }));
        const p_payments = (tx.payments || []).map((p: any) => ({
          id: p.id || uuidv4(),
          transaction_id: tx.id,
          method: p.method,
          amount: p.amount,
          reference: p.reference || null
        }));

        const { error: rpcErr } = await supabase.rpc('process_pos_transaction', {
          p_transaction, p_lines, p_payments, p_stock_entry: null, p_stock_entry_lines: null
        });

        if (rpcErr) {
          const { error: insErr } = await supabase.from('pos_transactions').upsert([p_transaction], { onConflict: 'id' });
          if (!insErr) {
            if (p_lines.length > 0) await supabase.from('pos_transaction_lines').upsert(p_lines, { onConflict: 'id' });
            if (p_payments.length > 0) await supabase.from('pos_payments').upsert(p_payments, { onConflict: 'id' });
            transactionsSynced++;
          }
        } else {
          transactionsSynced++;
        }
      }
    }

    // 4. Synchroniser les mouvements de stock manquants
    const localMovements = (await db.posStockMovements.getItem<any[]>('data')) || [];
    if (localMovements.length > 0) {
      const { data: remoteMovements } = await supabase.from('pos_stock_movements').select('id');
      const remoteMovIds = new Set((remoteMovements || []).map((m: any) => m.id));
      const missingMovements = localMovements.filter(m => {
        if (remoteMovIds.has(m.id)) return false;
        if (isRetiredServicePayload('INSERT_POS_STOCK_MOVEMENT', m)) return false;
        const resolvedPid = resolveProductUuid(m.productId, m.reference);
        return isUuid(resolvedPid);
      });

      if (missingMovements.length > 0) {
        const payload = missingMovements.map(m => ({
          id: m.id,
          product_id: resolveProductUuid(m.productId, m.reference),
          type: m.type,
          quantity: m.quantity,
          reference: m.reference || null,
          date: m.date || new Date().toISOString(),
          created_by: m.createdBy ? String(m.createdBy) : null,
          notes: m.notes || null
        }));
        const { error: movErr } = await supabase.from('pos_stock_movements').upsert(payload, { onConflict: 'id' });
        if (!movErr) movementsSynced = missingMovements.length;
      }
    }

    // 5. Synchroniser les retours manquants
    const localReturns = (await db.posReturns.getItem<any[]>('data')) || [];
    if (localReturns.length > 0) {
      const { data: remoteReturns } = await supabase.from('pos_returns').select('id');
      const remoteRetIds = new Set((remoteReturns || []).map((r: any) => r.id));
      const missingReturns = localReturns.filter(r => !remoteRetIds.has(r.id));

      for (const ret of missingReturns) {
        const { error: retErr } = await supabase.from('pos_returns').upsert([{
          id: ret.id,
          return_number: ret.returnNumber,
          transaction_id: isUuid(ret.transactionId) ? ret.transactionId : null,
          date: ret.date,
          type: ret.type,
          total_refund: ret.totalRefund ?? 0,
          total_exchange: ret.totalExchange ?? 0,
          status: ret.status,
          notes: ret.notes || null,
          created_by: isUuid(ret.createdBy) ? ret.createdBy : null
        }], { onConflict: 'id' });
        
        if (!retErr) {
          const allLinesData: any[] = [];
          if (ret.lines && ret.lines.length > 0) {
            ret.lines.forEach((l: any) => {
              allLinesData.push({
                id: l.id || uuidv4(),
                return_id: ret.id,
                product_id: isUuid(l.productId) ? l.productId : null,
                description: l.description,
                quantity: l.quantity,
                unit_price: l.unitPrice,
                total: l.total,
                reason: l.reason || 'Retour'
              });
            });
          }
          if (ret.exchangeLines && ret.exchangeLines.length > 0) {
            ret.exchangeLines.forEach((l: any) => {
              allLinesData.push({
                id: l.id || uuidv4(),
                return_id: ret.id,
                product_id: isUuid(l.productId) ? l.productId : null,
                description: l.description,
                quantity: l.quantity,
                unit_price: l.unitPrice,
                total: l.total,
                reason: 'Échange'
              });
            });
          }
          if (allLinesData.length > 0) {
            await supabase.from('pos_return_lines').upsert(allLinesData, { onConflict: 'id' });
          }
          returnsSynced++;
        }
      }
    }

    // 6. Synchroniser les entrées de stock manquantes
    const localEntries = (await db.posStockEntries.getItem<any[]>('data')) || [];
    if (localEntries.length > 0) {
      const { data: remoteEntries } = await supabase.from('pos_stock_entries').select('id');
      const remoteEntryIds = new Set((remoteEntries || []).map((e: any) => e.id));
      const missingEntries = localEntries.filter(e => !remoteEntryIds.has(e.id));

      for (const entry of missingEntries) {
        const { error: entErr } = await supabase.from('pos_stock_entries').upsert([{
          id: entry.id,
          reference: entry.reference,
          supplier_id: isUuid(entry.supplierId) ? entry.supplierId : null,
          date: entry.date,
          total_amount: entry.totalAmount ?? 0,
          status: entry.status,
          notes: entry.notes || null,
          created_by: isUuid(entry.createdBy) ? entry.createdBy : null
        }], { onConflict: 'id' });

        if (!entErr && entry.lines && entry.lines.length > 0) {
          const linesData = entry.lines.map((l: any) => ({
            id: l.id || uuidv4(),
            entry_id: entry.id,
            product_id: isUuid(l.productId) ? l.productId : null,
            quantity: l.quantity,
            purchase_price: l.purchasePrice,
            total: l.total
          }));
          await supabase.from('pos_stock_entry_lines').upsert(linesData, { onConflict: 'id' });
        }
      }
    }

    // 7. Synchroniser les inventaires manquants
    const localInventories = (await db.posInventories.getItem<any[]>('data')) || [];
    if (localInventories.length > 0) {
      const { data: remoteInvs } = await supabase.from('pos_inventories').select('id');
      const remoteInvIds = new Set((remoteInvs || []).map((i: any) => i.id));
      const missingInvs = localInventories.filter(i => !remoteInvIds.has(i.id));

      for (const inv of missingInvs) {
        const { error: invErr } = await supabase.from('pos_inventories').upsert([{
          id: inv.id,
          reference: inv.reference,
          date: inv.date,
          status: inv.status,
          notes: inv.notes || null,
          created_by: isUuid(inv.createdBy) ? inv.createdBy : null
        }], { onConflict: 'id' });

        if (!invErr && inv.lines && inv.lines.length > 0) {
          const linesData = inv.lines.map((l: any) => ({
            id: l.id || uuidv4(),
            inventory_id: inv.id,
            product_id: isUuid(l.productId) ? l.productId : null,
            expected_qty: l.expectedQty,
            counted_qty: l.countedQty,
            difference: l.difference
          }));
          await supabase.from('pos_inventory_lines').upsert(linesData, { onConflict: 'id' });
        }
      }
    }

    // 8. Traiter toute file d'attente restante
    await processSyncQueue();

    return {
      success: true,
      sessionsSynced,
      transactionsSynced,
      movementsSynced,
      returnsSynced,
      errorsReplayed,
      message: `Rapprochement réussi : ${sessionsSynced} session(s), ${transactionsSynced} transaction(s), ${movementsSynced} mouvement(s), ${returnsSynced} retour(s) et ${errorsReplayed} action(s) rejouée(s) vers le serveur.`
    };
  } catch (err: any) {
    console.error('Erreur réconciliation :', err);
    return {
      success: false,
      sessionsSynced,
      transactionsSynced,
      movementsSynced,
      returnsSynced,
      errorsReplayed,
      message: `Erreur lors de la réconciliation : ${err.message || err}`
    };
  }
};

/**
 * Rapprochement complet de TOUT le système (POS + CRM + Factures + Devis + Rapports)
 */
export const reconcileAllOfflineDataWithCloud = async () => {
  const posResult = await reconcileLocalPosDataWithCloud();
  
  // CRM Sales / Couts / FacturePaiements auto-reconciliation
  try {
    if (navigator.onLine) {
      await processSyncQueue();
    }
  } catch (e) {
    console.warn('[SyncAll] Erreur vidage file CRM :', e);
  }

  return posResult;
};

