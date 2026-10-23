import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../../../lib/supabase';
import { db } from '../../../lib/db';
import type { PosMagasin, PosStockMagasin, PosStockTransfer, PosStockTransferLine } from '../../../types/posMagasins';
import type { PosProduct } from '../../../context/AppContext';

const CURRENT_MAGASIN_KEY = 'hinov_current_pos_magasin_id';

export const DEFAULT_MAGASIN: PosMagasin = {
  id: '00000000-0000-0000-0000-000000000001',
  code: 'MAG-PRINCIPAL',
  nom: 'Librairie Principale',
  isDefault: true,
  actif: true,
  adresse: 'Plateau',
  ville: 'Abidjan',
};

export const PosMagasinService = {
  /**
   * Récupère l'ID du magasin actif mémorisé en local
   */
  getActiveMagasinId(): string {
    try {
      const saved = localStorage.getItem(CURRENT_MAGASIN_KEY);
      return saved || DEFAULT_MAGASIN.id;
    } catch {
      return DEFAULT_MAGASIN.id;
    }
  },

  /**
   * Définit le magasin actif
   */
  setActiveMagasinId(magasinId: string): void {
    try {
      localStorage.setItem(CURRENT_MAGASIN_KEY, magasinId);
      window.dispatchEvent(new CustomEvent('pos-magasin-changed', { detail: { magasinId } }));
    } catch (e) {
      console.error('[PosMagasinService] Erreur sauvegarde magasin actif :', e);
    }
  },

  /**
   * Charge tous les magasins depuis le cache local (IndexedDB) ou Supabase
   */
  async loadMagasins(): Promise<PosMagasin[]> {
    let local: PosMagasin[] = [];
    try {
      local = (await db.posMagasins.getItem<PosMagasin[]>('list')) || [];
    } catch {
      local = [];
    }

    if (navigator.onLine) {
      try {
        const { data, error } = await supabase
          .from('pos_magasins')
          .select('*')
          .order('nom', { ascending: true });

        if (!error && Array.isArray(data) && data.length > 0) {
          const mapped: PosMagasin[] = data.map((d: any) => ({
            id: d.id,
            code: d.code,
            nom: d.nom,
            adresse: d.adresse,
            codePostal: d.code_postal,
            ville: d.ville,
            telephone: d.telephone,
            email: d.email,
            ticketMessage: d.ticket_message,
            isDefault: d.is_default,
            actif: d.actif,
            createdBy: d.created_by,
            createdAt: d.created_at,
            updatedAt: d.updated_at,
          }));

          await db.posMagasins.setItem('list', mapped);
          return mapped;
        }
      } catch (err) {
        console.warn('[PosMagasinService] Échec chargement distant, repli local :', err);
      }
    }

    return local.length > 0 ? local : [DEFAULT_MAGASIN];
  },

  /**
   * Crée un nouveau magasin / librairie
   */
  async createMagasin(magasin: Omit<PosMagasin, 'id' | 'createdAt' | 'updatedAt'>): Promise<PosMagasin> {
    const newMag: PosMagasin = {
      ...magasin,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Sauvegarde locale immédiate
    const currentList = await this.loadMagasins();
    const updatedList = [...currentList, newMag];
    await db.posMagasins.setItem('list', updatedList);

    // Envoi serveur si connecté
    if (navigator.onLine) {
      try {
        await supabase.from('pos_magasins').upsert([{
          id: newMag.id,
          code: newMag.code || null,
          nom: newMag.nom,
          adresse: newMag.adresse || null,
          code_postal: newMag.codePostal || null,
          ville: newMag.ville || null,
          telephone: newMag.telephone || null,
          email: newMag.email || null,
          ticket_message: newMag.ticketMessage || null,
          is_default: !!newMag.isDefault,
          actif: newMag.actif !== false,
        }]);
      } catch (e) {
        console.warn('[PosMagasinService] Sauvegarde serveur différée :', e);
      }
    }

    return newMag;
  },

  /**
   * Met à jour une librairie
   */
  async updateMagasin(id: string, updates: Partial<PosMagasin>): Promise<void> {
    const currentList = await this.loadMagasins();
    const updatedList = currentList.map(m => m.id === id ? { ...m, ...updates, updatedAt: new Date().toISOString() } : m);
    await db.posMagasins.setItem('list', updatedList);

    if (navigator.onLine) {
      try {
        const payload: any = {};
        if (updates.nom !== undefined) payload.nom = updates.nom;
        if (updates.code !== undefined) payload.code = updates.code;
        if (updates.adresse !== undefined) payload.adresse = updates.adresse;
        if (updates.ville !== undefined) payload.ville = updates.ville;
        if (updates.telephone !== undefined) payload.telephone = updates.telephone;
        if (updates.email !== undefined) payload.email = updates.email;
        if (updates.ticketMessage !== undefined) payload.ticket_message = updates.ticketMessage;
        if (updates.actif !== undefined) payload.actif = updates.actif;
        payload.updated_at = new Date().toISOString();

        await supabase.from('pos_magasins').update(payload).eq('id', id);
      } catch (e) {
        console.warn('[PosMagasinService] Mise à jour distante différée :', e);
      }
    }
  },

  /**
   * Charge les transferts de stock
   */
  async loadStockTransfers(): Promise<PosStockTransfer[]> {
    try {
      const local = (await db.posStockTransfers.getItem<PosStockTransfer[]>('list')) || [];
      if (navigator.onLine) {
        const { data, error } = await supabase
          .from('pos_stock_transfers')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && Array.isArray(data)) {
          const mapped: PosStockTransfer[] = data.map((d: any) => ({
            id: d.id,
            transferNumber: d.transfer_number,
            magasinSourceId: d.magasin_source_id,
            magasinDestId: d.magasin_dest_id,
            status: d.status,
            shippedBy: d.shipped_by,
            receivedBy: d.received_by,
            shippedAt: d.shipped_at,
            receivedAt: d.received_at,
            notes: d.notes,
            lines: d.lines || [],
            createdAt: d.created_at,
            updatedAt: d.updated_at,
          }));
          await db.posStockTransfers.setItem('list', mapped);
          return mapped;
        }
      }
      return local;
    } catch {
      return [];
    }
  },

  /**
   * Crée un bon de transfert entre librairies
   */
  async createStockTransfer(
    sourceId: string,
    destId: string,
    lines: PosStockTransferLine[],
    userId?: string,
    notes?: string
  ): Promise<PosStockTransfer> {
    const transfer: PosStockTransfer = {
      id: uuidv4(),
      transferNumber: `TRF-${Date.now().toString().slice(-6)}`,
      magasinSourceId: sourceId,
      magasinDestId: destId,
      status: 'Expédié',
      shippedBy: userId,
      shippedAt: new Date().toISOString(),
      notes,
      lines,
      createdAt: new Date().toISOString(),
    };

    const current = await this.loadStockTransfers();
    const nextList = [transfer, ...current];
    await db.posStockTransfers.setItem('list', nextList);

    if (navigator.onLine) {
      try {
        await supabase.from('pos_stock_transfers').insert([{
          id: transfer.id,
          transfer_number: transfer.transferNumber,
          magasin_source_id: transfer.magasinSourceId,
          magasin_dest_id: transfer.magasinDestId,
          status: transfer.status,
          shipped_by: transfer.shippedBy || null,
          shipped_at: transfer.shippedAt,
          notes: transfer.notes || null,
          lines: transfer.lines,
        }]);
      } catch (err) {
        console.warn('[PosMagasinService] Sauvegarde transfert différée :', err);
      }
    }

    return transfer;
  },

  /**
   * Valide la réception d'un transfert par la librairie destinataire
   */
  async confirmTransferReceipt(transferId: string, userId?: string): Promise<void> {
    const current = await this.loadStockTransfers();
    const updated = current.map(t => {
      if (t.id === transferId) {
        return {
          ...t,
          status: 'Réceptionné' as const,
          receivedBy: userId,
          receivedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }
      return t;
    });

    await db.posStockTransfers.setItem('list', updated);

    if (navigator.onLine) {
      try {
        await supabase.from('pos_stock_transfers').update({
          status: 'Réceptionné',
          received_by: userId || null,
          received_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('id', transferId);
      } catch (err) {
        console.warn('[PosMagasinService] Validation réception distante différée :', err);
      }
    }
  },

  // ────────────────────────────────────────────────────────────────────────────
  // STOCK LOCALISÉ PAR MAGASIN
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * Charge la liste complète des stocks par magasin depuis l'IndexedDB (cache local)
   */
  async loadAllStockEntries(): Promise<PosStockMagasin[]> {
    try {
      return (await db.posStockMagasin.getItem<PosStockMagasin[]>('all')) || [];
    } catch {
      return [];
    }
  },

  /**
   * Charge le stock localisé d'un magasin spécifique
   */
  async loadStockForMagasin(magasinId: string): Promise<PosStockMagasin[]> {
    const all = await this.loadAllStockEntries();
    return all.filter(s => s.magasinId === magasinId);
  },

  /**
   * Persiste toute la liste de stock localisé
   */
  async _saveAllStockEntries(entries: PosStockMagasin[]): Promise<void> {
    await db.posStockMagasin.setItem('all', entries);
  },

  /**
   * Retourne la quantité en stock local pour un produit dans un magasin.
   * Fallback : retourne le stock global du produit si aucune entrée locale n'existe.
   */
  getLocalStock(
    magasinId: string,
    productId: string,
    stockEntries: PosStockMagasin[],
    globalFallback?: number
  ): number {
    const entry = stockEntries.find(s => s.magasinId === magasinId && s.productId === productId);
    if (entry) return Math.max(0, entry.quantiteStock);
    return globalFallback !== undefined ? Math.max(0, globalFallback) : 0;
  },

  /**
   * Ajuste (incrémente ou décrémente) le stock local d'un produit dans un magasin.
   * Crée l'entrée si elle n'existe pas encore (initialise depuis globalFallback).
   */
  async adjustLocalStock(
    magasinId: string,
    productId: string,
    delta: number,
    globalFallback: number = 0
  ): Promise<void> {
    const all = await this.loadAllStockEntries();
    const idx = all.findIndex(s => s.magasinId === magasinId && s.productId === productId);

    if (idx >= 0) {
      const updated = [...all];
      updated[idx] = {
        ...updated[idx],
        quantiteStock: Math.max(0, updated[idx].quantiteStock + delta),
        updatedAt: new Date().toISOString(),
      };
      await this._saveAllStockEntries(updated);
    } else {
      // Crée l'entrée à partir du stock global et applique le delta
      const newEntry: PosStockMagasin = {
        id: uuidv4(),
        magasinId,
        productId,
        quantiteStock: Math.max(0, globalFallback + delta),
        quantiteReserve: 0,
        seuilAlerte: 5,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await this._saveAllStockEntries([...all, newEntry]);
    }

    // Synchronisation serveur asynchrone
    if (navigator.onLine) {
      try {
        const freshAll = await this.loadAllStockEntries();
        const entry = freshAll.find(s => s.magasinId === magasinId && s.productId === productId);
        if (entry) {
          await supabase.from('pos_stock_magasin').upsert([
            {
              id: entry.id,
              magasin_id: entry.magasinId,
              product_id: entry.productId,
              quantite_stock: entry.quantiteStock,
              quantite_reserve: entry.quantiteReserve,
              seuil_alerte: entry.seuilAlerte,
              updated_at: entry.updatedAt,
            }
          ]);
        }
      } catch (err) {
        console.warn('[PosMagasinService] Sync stock localisé différée :', err);
      }
    }
  },

  /**
   * Initialise le stock localisé d'un magasin à partir des quantités globales.
   * À appeler une seule fois (guard : skip si le magasin a déjà des entrées).
   */
  async initializeStockForMagasin(
    magasinId: string,
    products: PosProduct[]
  ): Promise<PosStockMagasin[]> {
    const all = await this.loadAllStockEntries();
    const existing = all.filter(s => s.magasinId === magasinId);

    // Déjà initialisé — ne pas écraser
    if (existing.length > 0) return existing;

    const newEntries: PosStockMagasin[] = products
      .filter(p => p.isActive !== false && p.status !== 'Inactive' && p.family !== 'Service')
      .map(p => ({
        id: uuidv4(),
        magasinId,
        productId: p.id,
        quantiteStock: Math.max(0, p.quantity || 0),
        quantiteReserve: 0,
        seuilAlerte: p.minStock || 5,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

    await this._saveAllStockEntries([...all, ...newEntries]);
    console.info(`[PosMagasinService] Stock localisé initialisé pour magasin ${magasinId} : ${newEntries.length} produit(s).`);
    return newEntries;
  },
};
