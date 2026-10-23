export interface PosMagasin {
  id: string;
  code?: string;
  nom: string;
  adresse?: string;
  codePostal?: string;
  ville?: string;
  telephone?: string;
  email?: string;
  ticketMessage?: string;
  isDefault?: boolean;
  actif: boolean;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type PosMagasinRole = 'Gérant' | 'Caissier';

export interface PosUserMagasin {
  profileId: string;
  magasinId: string;
  roleOnStore: PosMagasinRole | 'Encaisseur';
  isPrimary: boolean;
  assignedAt: string;
  assignedBy?: string;
}

export interface PosStockMagasin {
  id: string;
  magasinId: string;
  productId: string;
  quantiteStock: number;
  quantiteReserve: number;
  seuilAlerte: number;
  dateDernierInventaire?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PosStockTransferLine {
  id: string;
  productId: string;
  productName: string;
  reference: string;
  quantity: number;
}

export interface PosStockTransfer {
  id: string;
  transferNumber: string;
  magasinSourceId: string;
  magasinDestId: string;
  status: 'Brouillon' | 'Expédié' | 'Réceptionné' | 'Annulé';
  shippedBy?: string;
  receivedBy?: string;
  shippedAt?: string;
  receivedAt?: string;
  notes?: string;
  lines: PosStockTransferLine[];
  createdAt: string;
  updatedAt?: string;
}
