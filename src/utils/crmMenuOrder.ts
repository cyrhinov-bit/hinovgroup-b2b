/**
 * Utilitaire de gestion de l'ordre personnalisé des onglets du menu CRM.
 * L'ordre est persisté dans le localStorage par utilisateur (clé: crm_menu_order_<userId>).
 * Un CustomEvent 'crm-menu-order-changed' est diffusé pour synchroniser la Sidebar instantanément.
 */

const STORAGE_PREFIX = 'crm_menu_order_';
export const CRM_MENU_ORDER_EVENT = 'crm-menu-order-changed';

/**
 * Récupère l'ordre sauvegardé des chemins pour un utilisateur
 */
export function getSavedCrmMenuOrder(userId?: string): string[] | null {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Sauvegarde l'ordre des chemins pour un utilisateur
 */
export function saveCrmMenuOrder(userId: string, paths: string[]): void {
  if (!userId) return;
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${userId}`, JSON.stringify(paths));
    window.dispatchEvent(new CustomEvent(CRM_MENU_ORDER_EVENT, { detail: { userId, paths } }));
  } catch (e) {
    console.error('Erreur lors de la sauvegarde de l\'ordre du menu CRM :', e);
  }
}

/**
 * Réinitialise l'ordre aux valeurs par défaut pour un utilisateur
 */
export function resetCrmMenuOrder(userId: string): void {
  if (!userId) return;
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}${userId}`);
    window.dispatchEvent(new CustomEvent(CRM_MENU_ORDER_EVENT, { detail: { userId, paths: null } }));
  } catch (e) {
    console.error('Erreur lors de la réinitialisation de l\'ordre du menu CRM :', e);
  }
}
