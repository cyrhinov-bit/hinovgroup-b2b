import { useState, useEffect, useCallback } from 'react';
import { PosMagasinService } from '../services/PosMagasinService';
import type { PosStockMagasin } from '../../../types/posMagasins';
import type { PosProduct } from '../../../context/AppContext';

/**
 * Hook réactif pour gérer le stock localisé d'un magasin précis.
 *
 * - Au montage (ou changement de magasin), charge le stock local depuis IndexedDB.
 * - Si aucune entrée n'existe encore, initialise automatiquement depuis le stock global.
 * - Expose `getStock(productId)` : stock local avec fallback sur le stock global.
 * - Expose `adjustStock(productId, delta)` : décrémente/incrémente le stock local.
 */
export function useMagasinStock(magasinId: string, posProducts: PosProduct[]) {
  const [stockEntries, setStockEntries] = useState<PosStockMagasin[]>([]);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!magasinId) return;
    let mounted = true;

    const init = async () => {
      // 1. Essayer de charger le stock déjà enregistré pour ce magasin
      let entries = await PosMagasinService.loadStockForMagasin(magasinId);

      // 2. Si pas d'entrées et qu'on a des produits, initialiser depuis le stock global
      if (entries.length === 0 && posProducts.length > 0) {
        entries = await PosMagasinService.initializeStockForMagasin(magasinId, posProducts);
      }

      if (mounted) {
        setStockEntries(entries);
        setInitialized(true);
      }
    };

    setInitialized(false);
    init().catch(err => {
      console.warn('[useMagasinStock] Erreur init stock localisé :', err);
      if (mounted) setInitialized(true);
    });

    return () => {
      mounted = false;
    };
  }, [magasinId]); // Re-charge quand le magasin actif change

  /**
   * Retourne la quantité disponible dans la librairie active.
   * Si pas d'entrée locale → fallback sur le stock global du produit.
   */
  const getStock = useCallback(
    (productId: string): number => {
      const globalProduct = posProducts.find(p => p.id === productId);
      const globalFallback = globalProduct?.quantity ?? 0;
      return PosMagasinService.getLocalStock(magasinId, productId, stockEntries, globalFallback);
    },
    [magasinId, stockEntries, posProducts]
  );

  /**
   * Applique un delta (+/-) au stock local, met à jour l'état React et persiste.
   */
  const adjustStock = useCallback(
    async (productId: string, delta: number) => {
      const globalProduct = posProducts.find(p => p.id === productId);
      const globalFallback = globalProduct?.quantity ?? 0;

      await PosMagasinService.adjustLocalStock(magasinId, productId, delta, globalFallback);

      // Rafraîchit l'état local depuis le cache
      const fresh = await PosMagasinService.loadStockForMagasin(magasinId);
      setStockEntries(fresh);
    },
    [magasinId, posProducts]
  );

  /**
   * Force le rechargement du stock (après transfert ou réception par ex.)
   */
  const refreshStock = useCallback(async () => {
    const fresh = await PosMagasinService.loadStockForMagasin(magasinId);
    setStockEntries(fresh);
  }, [magasinId]);

  return {
    stockEntries,
    initialized,
    getStock,
    adjustStock,
    refreshStock
  };
}
