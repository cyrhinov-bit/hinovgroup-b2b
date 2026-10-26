import { v4 as uuidv4 } from 'uuid';
import { supabase } from './supabase';
import { db, ensureDbHealth } from './db';
import { queueSyncAction } from './sync';
import type { Quote } from '../context/AppContext';

const DATA_KEY = 'data';
const DELETED_KEY = 'deletedIds';

export interface DeliveryNoteLine {
  id: string;
  prestationId?: string;
  description: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  discountPercent?: number;
  total: number;
}

export type DeliveryNoteStatus = 'Émis' | 'Annulé';

export interface DeliveryNote {
  id: string;
  deliveryNumber: string;
  quoteId: string;
  quoteNumber: string;
  clientId: string;
  clientName?: string;
  commercialId?: string;
  serviceId?: string;
  date: string;
  lines: DeliveryNoteLine[];
  total: number;
  status: DeliveryNoteStatus;
  createdBy?: string;
  createdAt: string;
  updatedAt?: string;
}

const sortNotes = (notes: DeliveryNote[]): DeliveryNote[] =>
  [...notes].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

export async function loadLocalDeliveryNotes(): Promise<DeliveryNote[]> {
  await ensureDbHealth();
  return (await db.deliveryNotes.getItem<DeliveryNote[]>(DATA_KEY)) || [];
}

export async function loadDeletedDeliveryNoteIds(): Promise<string[]> {
  await ensureDbHealth();
  return (await db.deliveryNotes.getItem<string[]>(DELETED_KEY)) || [];
}

async function saveLocalNotes(notes: DeliveryNote[]): Promise<void> {
  await db.deliveryNotes.setItem(DATA_KEY, notes);
}

async function saveDeletedIds(ids: string[]): Promise<void> {
  await db.deliveryNotes.setItem(DELETED_KEY, ids);
}

/** Prochain numéro séquentiel BL-YYYY-XXXX, calculé sur les notes connues. */
export function nextDeliveryNumber(notes: DeliveryNote[], year = new Date().getFullYear()): string {
  const prefix = `BL-${year}-`;
  let max = 0;
  for (const note of notes) {
    const match = /^BL-(\d{4})-(\d+)$/.exec(note.deliveryNumber || '');
    if (match) max = Math.max(max, Number(match[2]) || 0);
  }
  return `${prefix}${String(max + 1).padStart(4, '0')}`;
}

/**
 * Numéro serveur (si la table/RPC est déployée) : évite les doublons entre postes.
 * Retombe sur la numérotation locale en cas d'échec.
 */
async function resolveDeliveryNumber(existing: DeliveryNote[]): Promise<string> {
  const localNext = nextDeliveryNumber(existing);
  try {
    const year = new Date().getFullYear();
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500));
    const response = await Promise.race([
      supabase.rpc('next_delivery_number', { p_year: year }).then((r) => r).catch(() => null),
      timeout,
    ]);
    const data = response?.data;
    if (typeof data !== 'string' || !data.trim()) return localNext;
    const localMatch = /^BL-(\d{4})-(\d+)$/.exec(localNext);
    const serverMatch = /^BL-(\d{4})-(\d+)$/.exec(data.trim());
    if (!localMatch || !serverMatch) return localNext;
    return Number(serverMatch[2]) >= Number(localMatch[2]) ? data.trim() : localNext;
  } catch {
    return localNext;
  }
}

export async function createDeliveryNote(
  input: Omit<DeliveryNote, 'id' | 'deliveryNumber' | 'status' | 'createdAt'>
): Promise<DeliveryNote> {
  const existing = await loadLocalDeliveryNotes();
  const note: DeliveryNote = {
    ...input,
    id: uuidv4(),
    deliveryNumber: await resolveDeliveryNumber(existing),
    status: 'Émis',
    createdAt: new Date().toISOString(),
  };
  await saveLocalNotes(sortNotes([note, ...existing]));
  await queueSyncAction('UPSERT_DELIVERY_NOTE', note);
  return note;
}

export async function deleteDeliveryNote(noteId: string): Promise<void> {
  const existing = await loadLocalDeliveryNotes();
  await saveLocalNotes(existing.filter((n) => n.id !== noteId));
  const deleted = await loadDeletedDeliveryNoteIds();
  if (!deleted.includes(noteId)) await saveDeletedIds([...deleted, noteId]);
  await queueSyncAction('DELETE_DELIVERY_NOTE', { id: noteId });
}

function mapRemoteRow(row: any): DeliveryNote {
  return {
    id: String(row.id),
    deliveryNumber: row.delivery_number || '',
    quoteId: row.quote_id || '',
    quoteNumber: row.quote_number || '',
    clientId: row.client_id || '',
    clientName: row.client_name || undefined,
    commercialId: row.commercial_id || undefined,
    serviceId: row.service_id || undefined,
    date: row.date || '',
    lines: Array.isArray(row.lines) ? row.lines : [],
    total: Number(row.total) || 0,
    status: row.status === 'Annulé' ? 'Annulé' : 'Émis',
    createdBy: row.created_by || undefined,
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || undefined,
  };
}

/** Récupère les BL du serveur (silencieux si la table n'est pas encore déployée). */
export async function fetchRemoteDeliveryNotes(): Promise<DeliveryNote[]> {
  try {
    const { data, error } = await supabase
      .from('delivery_notes')
      .select('*')
      .order('created_at', { ascending: false });
    if (error || !Array.isArray(data)) return [];
    return data.map(mapRemoteRow);
  } catch {
    return [];
  }
}

/**
 * Fusionne cache local + serveur. Le local est prioritaire (écritures en attente),
 * et les suppressions locales (tombstones) masquent les lignes encore présentes
 * côté serveur tant que la synchro de suppression n'est pas passée.
 */
export async function syncDeliveryNotesCache(): Promise<DeliveryNote[]> {
  const [local, deleted, remote] = await Promise.all([
    loadLocalDeliveryNotes(),
    loadDeletedDeliveryNoteIds(),
    fetchRemoteDeliveryNotes(),
  ]);
  const deletedSet = new Set(deleted);
  const byId = new Map<string, DeliveryNote>();
  for (const note of remote) {
    if (!deletedSet.has(note.id)) byId.set(note.id, note);
  }
  for (const note of local) {
    if (!deletedSet.has(note.id)) byId.set(note.id, note);
  }
  const merged = sortNotes([...byId.values()]);
  await saveLocalNotes(merged);
  if (deleted.length > 0) {
    // Purge des tombstones déjà absents du serveur.
    const remoteIds = new Set(remote.map((n) => n.id));
    const remaining = deleted.filter((id) => remoteIds.has(id));
    if (remaining.length !== deleted.length) await saveDeletedIds(remaining);
  }
  return merged;
}

/** Convertit un BL en objet Quote minimal pour réutiliser le générateur PDF. */
export function deliveryNoteToQuote(note: DeliveryNote): Quote {
  return {
    id: note.quoteId,
    quoteNumber: note.quoteNumber,
    clientId: note.clientId,
    commercialId: note.commercialId || '',
    serviceId: note.serviceId,
    subject: '',
    lines: note.lines.map((l) => ({
      id: l.id,
      prestationId: l.prestationId || '',
      description: l.description,
      quantity: l.quantity,
      unit: l.unit,
      unitPrice: l.unitPrice,
      total: l.total,
      discountPercent: l.discountPercent,
    })),
    subtotal: note.total,
    total: note.total,
    status: 'Accepté',
    date: note.date,
  } as Quote;
}
