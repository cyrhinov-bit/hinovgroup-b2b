import type { PosTransaction, PosCashSession, PosReturn, PosProduct } from '../../../context/AppContext';
import type { PosStockMagasin } from '../../../types/posMagasins';
import { DEFAULT_MAGASIN } from '../services/PosMagasinService';

/**
 * Résout le magasinId effectif d'une transaction.
 * Si non renseigné sur la transaction, vérifie la session liée, sinon retombe sur le magasin par défaut.
 */
export function resolveTransactionMagasinId(
  tx: PosTransaction,
  sessions?: PosCashSession[]
): string {
  if (tx.magasinId) return tx.magasinId;
  if (tx.sessionId && sessions && sessions.length > 0) {
    const s = sessions.find(sess => sess.id === tx.sessionId);
    if (s?.magasinId) return s.magasinId;
  }
  return DEFAULT_MAGASIN.id;
}

/**
 * Résout le magasinId effectif d'une session de caisse.
 */
export function resolveSessionMagasinId(session: PosCashSession): string {
  return session.magasinId || DEFAULT_MAGASIN.id;
}

/**
 * Résout le magasinId effectif d'un retour.
 */
export function resolveReturnMagasinId(
  ret: PosReturn,
  transactions?: PosTransaction[]
): string {
  if (ret.magasinId) return ret.magasinId;
  if (ret.transactionId && transactions && transactions.length > 0) {
    const t = transactions.find(tx => tx.id === ret.transactionId);
    if (t?.magasinId) return t.magasinId;
  }
  return DEFAULT_MAGASIN.id;
}

/**
 * Filtre une liste de transactions selon le périmètre magasin sélectionné.
 * Si scopeMagasinId === 'ALL', toutes les transactions sont retournées.
 */
export function filterTransactionsByMagasin(
  transactions: PosTransaction[],
  scopeMagasinId: string,
  sessions?: PosCashSession[]
): PosTransaction[] {
  if (!scopeMagasinId || scopeMagasinId === 'ALL') {
    return transactions;
  }
  return transactions.filter(tx => resolveTransactionMagasinId(tx, sessions) === scopeMagasinId);
}

/**
 * Filtre une liste de sessions de caisse selon le périmètre magasin sélectionné.
 */
export function filterSessionsByMagasin(
  sessions: PosCashSession[],
  scopeMagasinId: string
): PosCashSession[] {
  if (!scopeMagasinId || scopeMagasinId === 'ALL') {
    return sessions;
  }
  return sessions.filter(s => resolveSessionMagasinId(s) === scopeMagasinId);
}

/**
 * Filtre une liste de retours selon le périmètre magasin sélectionné.
 */
export function filterReturnsByMagasin(
  returns: PosReturn[],
  scopeMagasinId: string,
  transactions?: PosTransaction[]
): PosReturn[] {
  if (!scopeMagasinId || scopeMagasinId === 'ALL') {
    return returns;
  }
  return returns.filter(r => resolveReturnMagasinId(r, transactions) === scopeMagasinId);
}

/**
 * Calcule les stocks effectifs pour une boutique donnée à partir des entrées localisées
 * ou du stock global si réseau complet ou pas d'entrée spécifique.
 */
export function getScopedProductStock(
  productId: string,
  globalQuantity: number,
  scopeMagasinId: string,
  stockEntries: PosStockMagasin[]
): number {
  if (!scopeMagasinId || scopeMagasinId === 'ALL') {
    // Si réseau complet : si des entrées existent par boutique, on peut sommer,
    // sinon on utilise le stock global
    const entries = stockEntries.filter(s => s.productId === productId);
    if (entries.length > 0) {
      return entries.reduce((sum, e) => sum + (e.quantiteStock || 0), 0);
    }
    return Math.max(0, globalQuantity || 0);
  }

  const entry = stockEntries.find(s => s.magasinId === scopeMagasinId && s.productId === productId);
  if (entry) {
    return Math.max(0, entry.quantiteStock || 0);
  }
  // Fallback si pas encore d'entrée spécifique
  return Math.max(0, globalQuantity || 0);
}
