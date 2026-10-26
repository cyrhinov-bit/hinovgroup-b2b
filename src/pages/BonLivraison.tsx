import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Download,
  Eye,
  Mail,
  Receipt,
  Save,
  Search,
  Trash2,
} from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { canViewAll, visibleTo } from '../lib/scope';
import {
  generateBonLivraisonPdf,
  downloadBlob,
  ensureDevisPdfAssets,
} from '../lib/pdfUtils';
import {
  createDeliveryNote,
  deleteDeliveryNote,
  deliveryNoteToQuote,
  loadLocalDeliveryNotes,
  syncDeliveryNotesCache,
  type DeliveryNote,
} from '../lib/deliveryNotes';
import { sendDeliveryNoteByMail } from '../lib/mailUtils';
import { ReportPdfPreview, type ReportPdfPreviewData } from '../components/ReportPdfPreview';
import { useConfirm } from '../components/ConfirmModal';

export function BonLivraison() {
  const navigate = useNavigate();
  const { quoteId: routeQuoteId } = useParams<{ quoteId?: string }>();
  const [searchParams] = useSearchParams();
  const { confirm } = useConfirm();

  const { currentUser: authUser } = useAuth();
  const {
    quotes,
    clients,
    settings,
    users,
    prestations,
    crmArticles,
    crmStockMouvements,
    updateCrmArticle,
    addCrmStockMouvement,
  } = useAppContext();

  const currentUser = users.find((u) => u.id === authUser?.id) || authUser;

  const [notes, setNotes] = useState<DeliveryNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState<ReportPdfPreviewData | null>(null);
  const [search, setSearch] = useState('');

  const quoteId = routeQuoteId || searchParams.get('quoteId') || '';

  const getClientName = (id: string) => {
    const c = clients.find((cl) => cl.id === id);
    return c?.company || c?.name || 'Client inconnu';
  };
  const getNoteClientName = (note: DeliveryNote) => {
    const c = clients.find((cl) => cl.id === note.clientId);
    return c?.company || c?.name || note.clientName || '—';
  };
  const getUserName = (id?: string) => users.find((u) => u.id === id)?.name || 'Non assigné';

  // ---- Chargement du cache local + fusion serveur ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const local = await loadLocalDeliveryNotes();
      if (!cancelled) {
        setNotes(local);
        setNotesLoading(false);
      }
      const merged = await syncDeliveryNotesCache();
      if (!cancelled) setNotes(merged);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ---- Périmètre : mêmes règles que les devis (direction = tout, sinon propriétaire) ----
  const allowedQuotes = useMemo(
    () => visibleTo(quotes, currentUser?.role, currentUser?.id, (q) => [q.commercialId]),
    [quotes, currentUser?.role, currentUser?.id],
  );

  const visibleNotes = useMemo(
    () => visibleTo(notes, currentUser?.role, currentUser?.id, (n) => [n.commercialId, n.createdBy]),
    [notes, currentUser?.role, currentUser?.id],
  );

  const sourceQuote = quoteId ? allowedQuotes.find((q) => q.id === quoteId) || null : null;

  const acceptedQuotes = useMemo(() => {
    const term = search.trim().toLowerCase();
    const accepted = allowedQuotes
      .filter((q) => q.status === 'Accepté')
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    if (!term) return accepted;
    return accepted.filter(
      (q) =>
        q.quoteNumber?.toLowerCase().includes(term) ||
        getClientName(q.clientId).toLowerCase().includes(term) ||
        (q.subject || '').toLowerCase().includes(term),
    );
  }, [allowedQuotes, clients, search]);

  const existingNote = quoteId
    ? notes.find((n) => n.quoteId === quoteId && n.status === 'Émis') || null
    : null;

  const isDirector = canViewAll(currentUser?.role);

  const previewNote = async (note: DeliveryNote) => {
    try {
      await ensureDevisPdfAssets().catch(() => {});
      const client = clients.find((c) => c.id === note.clientId);
      const blob = generateBonLivraisonPdf(deliveryNoteToQuote(note), client, settings, note.deliveryNumber);
      const blobUrl = URL.createObjectURL(blob);
      const filename = `BonLivraison_${note.deliveryNumber}.pdf`;
      setPreview({
        blobUrl,
        filename,
        title: `Bon de Livraison N° ${note.deliveryNumber}`,
        onDownload: () => downloadBlob(blob, filename),
        onSendByMail: () => sendDeliveryNoteByMail(note, client, settings),
      });
    } catch (err: any) {
      toast.error(err?.message || 'Impossible de générer le PDF du bon de livraison.');
    }
  };

  /**
   * Met à jour le stock du module CRM « Stocks Métier » lorsque le code d'une
   * prestation correspond exactement au code d'un article du catalogue CRM.
   * Aucune écriture dans le stock POS : les deux modules restent séparés.
   * direction = -1 : sortie (création du BL) ; +1 : réintégration (suppression).
   */
  const applyCrmStockMovements = async (note: DeliveryNote, direction: 1 | -1 = -1): Promise<number> => {
    const totals = new Map<string, { article: (typeof crmArticles)[number]; qty: number }>();
    for (const line of note.lines) {
      const prestation = prestations.find((p) => p.id === line.prestationId);
      const code = (prestation?.code || '').trim().toLowerCase();
      if (!code) continue;
      const article = crmArticles.find((a) => (a.code_article || '').trim().toLowerCase() === code);
      if (!article) continue;
      const qty = Math.max(0, Math.round(Number(line.quantity) || 0));
      if (qty <= 0) continue;
      const current = totals.get(article.id) || { article, qty: 0 };
      current.qty += qty;
      totals.set(article.id, current);
    }

    let moved = 0;
    for (const { article, qty } of totals.values()) {
      const before = Math.max(0, Number(article.quantite_stock) || 0);
      const after = Math.max(0, before + direction * qty);
      try {
        await updateCrmArticle(article.id, { quantite_stock: after });
        await addCrmStockMouvement({
          article_id: article.id,
          article_code: article.code_article,
          type: direction < 0 ? 'SORTIE' : 'ENTREE',
          quantite: qty,
          stock_avant: before,
          stock_apres: after,
          motif: direction < 0
            ? `Bon de livraison ${note.deliveryNumber}`
            : `Annulation bon de livraison ${note.deliveryNumber}`,
        });
        moved += 1;
      } catch (err) {
        console.error('[BL] Mouvement de stock CRM échoué :', err);
      }
    }
    return moved;
  };

  const handleGenerate = async () => {
    if (!sourceQuote || generating || notesLoading) return;
    if (sourceQuote.status !== 'Accepté') {
      toast.error('Le bon de livraison ne peut être généré que depuis un devis accepté.');
      return;
    }

    setGenerating(true);
    try {
      let note: DeliveryNote | null = existingNote;
      if (!note) {
        let created: DeliveryNote;
        try {
          created = await createDeliveryNote({
            quoteId: sourceQuote.id,
            quoteNumber: sourceQuote.quoteNumber,
            clientId: sourceQuote.clientId,
            clientName: getClientName(sourceQuote.clientId),
            commercialId: sourceQuote.commercialId,
            serviceId: sourceQuote.serviceId,
            date: new Date().toISOString().slice(0, 10),
            lines: (sourceQuote.lines || []).map((l) => ({
              id: l.id,
              prestationId: l.prestationId,
              description: l.description,
              quantity: Number(l.quantity) || 0,
              unit: l.unit,
              unitPrice: Number(l.unitPrice) || 0,
              discountPercent: l.discountPercent,
              total: Number(l.total) || 0,
            })),
            total: (sourceQuote.lines || []).reduce((sum, l) => sum + (Number(l.total) || 0), 0),
            createdBy: currentUser?.id,
          });
        } catch (err: any) {
          toast.error(err?.message || "Impossible d'enregistrer le bon de livraison.");
          return;
        }
        note = created;
        setNotes((prev) => [created, ...prev.filter((n) => n.id !== created.id)]);
        const moved = await applyCrmStockMovements(created);
        if (moved > 0) {
          toast.success(`${moved} article(s) décrémenté(s) dans le stock métier CRM.`);
        }
      }

      if (note) await previewNote(note);
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = (note: DeliveryNote) => {
    confirm({
      title: 'Supprimer le bon de livraison',
      message: `Supprimer définitivement le BL ${note.deliveryNumber} ? Cette action est irréversible.`,
      variant: 'danger',
      confirmLabel: 'Supprimer',
      onConfirm: async () => {
        const wasStockApplied = crmStockMouvements.some(
          (m) => m.motif === `Bon de livraison ${note.deliveryNumber}`,
        );
        const restored = wasStockApplied ? await applyCrmStockMovements(note, 1) : 0;
        await deleteDeliveryNote(note.id);
        setNotes((prev) => prev.filter((n) => n.id !== note.id));
        toast.success(
          restored > 0
            ? `Bon de livraison supprimé. Stock CRM réintégré (${restored} article(s)).`
            : 'Bon de livraison supprimé.',
        );
      },
    });
  };

  const canGenerate = !!sourceQuote && sourceQuote.status === 'Accepté';

  return (
    <div className="dashboard">
      {/* En-tête */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Receipt size={22} /> Bons de Livraison
          </h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', margin: '4px 0 0' }}>
            Documents générés depuis les devis acceptés (module CRM, séparé du POS).
          </p>
        </div>
        <button
          className="btn btn-outline"
          onClick={() => navigate('/devis')}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <ArrowLeft size={16} /> Retour aux devis
        </button>
      </div>

      {!sourceQuote && (
        <>
          {quoteId && (
            <div className="card" style={{ marginBottom: '16px', borderLeft: '4px solid #F59E0B' }}>
              <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>
                Le devis demandé est introuvable ou ne fait pas partie de votre périmètre.
              </p>
            </div>
          )}

          <div className="card" style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <Search size={16} />
              <input
                className="input"
                type="text"
                placeholder="Rechercher un devis accepté (numéro, client, objet)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ flex: 1 }}
              />
            </div>

            <div className="table-responsive">
              <table className="data-table responsive-table">
                <thead>
                  <tr>
                    <th>N° Devis</th>
                    <th>Client</th>
                    <th>Objet</th>
                    <th>Date</th>
                    <th style={{ textAlign: 'right' }}>Total (FCFA)</th>
                    <th style={{ textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {acceptedQuotes.map((q) => (
                    <tr key={q.id}>
                      <td style={{ fontWeight: 600 }}>{q.quoteNumber}</td>
                      <td>{getClientName(q.clientId)}</td>
                      <td style={{ fontSize: '0.85rem' }}>{q.subject || '—'}</td>
                      <td style={{ fontSize: '0.85rem' }}>
                        {q.date ? new Date(q.date).toLocaleDateString('fr-FR') : '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>
                        {(Number(q.total) || 0).toLocaleString('fr-FR')}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          className="icon-button"
                          title="Générer le Bon de Livraison"
                          style={{ color: '#F59E0B' }}
                          onClick={() => navigate(`/bon-livraison?quoteId=${q.id}`)}
                        >
                          <Receipt size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {acceptedQuotes.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-muted)' }}>
                        Aucun devis accepté disponible. Acceptez d'abord un devis pour générer un bon de livraison.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {sourceQuote && (
        <>
          {sourceQuote.status !== 'Accepté' && (
            <div
              className="card"
              style={{ marginBottom: '16px', borderLeft: '4px solid #EF4444', display: 'flex', gap: '10px', alignItems: 'flex-start' }}
            >
              <AlertTriangle size={20} color="#EF4444" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>Devis non accepté</strong>
                <p style={{ margin: '4px 0 0', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                  Ce devis est au statut « {sourceQuote.status} ». Seuls les devis acceptés peuvent générer un bon de livraison.
                </p>
              </div>
            </div>
          )}

          {/* Barre d'actions */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
            <button
              className="btn btn-primary"
              onClick={handleGenerate}
              disabled={!canGenerate || notesLoading || generating}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              {existingNote ? <Eye size={16} /> : <Save size={16} />}
              {existingNote ? `Aperçu du BL ${existingNote.deliveryNumber}` : 'Générer le bon de livraison'}
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => preview?.onDownload?.()}
              disabled={!preview}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Download size={16} /> Télécharger
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => {
                if (preview?.onSendByMail) void preview.onSendByMail();
              }}
              disabled={!preview?.onSendByMail}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Mail size={16} /> Envoyer par mail
            </button>
            <button
              className="btn btn-outline"
              onClick={() => navigate('/bon-livraison')}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <ArrowLeft size={16} /> Autres devis
            </button>
          </div>

          {/* Résumé */}
          <div className="card" style={{ marginBottom: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              <div className="card" style={{ padding: '14px 18px', borderLeft: '4px solid #3B82F6' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>N° Devis</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)' }}>{sourceQuote.quoteNumber}</div>
              </div>

              <div className="card" style={{ padding: '14px 18px', borderLeft: '4px solid #10B981' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Client</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)' }}>{getClientName(sourceQuote.clientId)}</div>
              </div>

              {isDirector && (
                <div className="card" style={{ padding: '14px 18px', borderLeft: '4px solid #F59E0B' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Auteur</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)' }}>{getUserName(sourceQuote.commercialId)}</div>
                </div>
              )}

              <div className="card" style={{ padding: '14px 18px', borderLeft: '4px solid #D97706' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Total HT</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)' }}>
                  {(Number(sourceQuote.total) || 0).toLocaleString('fr-FR')} FCFA
                </div>
              </div>
            </div>
          </div>

          {/* Articles à livrer */}
          <div className="card">
            <div className="table-responsive">
              <table className="data-table responsive-table">
                <thead>
                  <tr>
                    <th>Réf.</th>
                    <th>Désignation</th>
                    <th style={{ textAlign: 'center' }}>Qté</th>
                    <th style={{ width: '110px' }}>Unité</th>
                    <th style={{ width: '130px', textAlign: 'right' }}>P. Unité (FCFA)</th>
                    <th style={{ width: '130px', textAlign: 'right' }}>Montant (FCFA)</th>
                  </tr>
                </thead>
                <tbody>
                  {(sourceQuote.lines || []).map((line, idx) => {
                    const unitPrice = Number(line.unitPrice) || 0;
                    const lineTotal = Number(line.total) || 0;
                    return (
                      <tr key={line.id || idx}>
                        <td>{idx + 1}</td>
                        <td style={{ fontSize: '0.85rem' }}>{line.description || 'Non spécifié'}</td>
                        <td style={{ textAlign: 'center', fontSize: '0.85rem' }}>{Number(line.quantity) || 1}</td>
                        <td style={{ fontSize: '0.85rem' }}>{line.unit || 'Forfait'}</td>
                        <td style={{ textAlign: 'right', fontSize: '0.85rem' }}>{unitPrice.toLocaleString('fr-FR')} FCFA</td>
                        <td style={{ textAlign: 'right', fontSize: '0.85rem', fontWeight: 600 }}>{lineTotal.toLocaleString('fr-FR')} FCFA</td>
                      </tr>
                    );
                  })}
                  {(sourceQuote.lines || []).length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '20px', color: 'var(--color-text-muted)' }}>
                        Aucune ligne de prestation dans ce devis.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Signatures */}
          <div style={{ marginTop: '30px', paddingTop: '20px', borderTop: '1px solid var(--color-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div>
                <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Livré le : </span>
                <span>________________________</span>
              </div>
              <div>
                <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Reçu par : </span>
                <span>________________________</span>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Signature destinataire</span>
                <div style={{ marginTop: '8px' }}>________________________</div>
              </div>
              <div>
                <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Signature responsable</span>
                <div style={{ marginTop: '8px' }}>________________________</div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Bons de livraison émis */}
      <div className="card" style={{ marginTop: '30px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>Bons de livraison émis</h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
            {visibleNotes.length} document(s)
          </span>
        </div>

        <div className="table-responsive">
          <table className="data-table responsive-table">
            <thead>
              <tr>
                <th>N° BL</th>
                <th>Devis</th>
                <th>Client</th>
                <th>Date</th>
                <th style={{ textAlign: 'right' }}>Total (FCFA)</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleNotes.map((note) => (
                <tr key={note.id}>
                  <td style={{ fontWeight: 700, color: '#B45309' }}>{note.deliveryNumber}</td>
                  <td>{note.quoteNumber}</td>
                  <td>{getNoteClientName(note)}</td>
                  <td style={{ fontSize: '0.85rem' }}>
                    {note.date ? new Date(note.date).toLocaleDateString('fr-FR') : '—'}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>
                    {(Number(note.total) || 0).toLocaleString('fr-FR')}
                  </td>
                  <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                    <button
                      className="icon-button"
                      title="Aperçu / Télécharger"
                      style={{ color: '#2563EB', marginRight: '6px' }}
                      onClick={() => void previewNote(note)}
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      className="icon-button"
                      title="Envoyer par mail"
                      style={{ color: '#0D9488', marginRight: '6px' }}
                      onClick={() => {
                        const client = clients.find((c) => c.id === note.clientId);
                        void sendDeliveryNoteByMail(note, client, settings);
                      }}
                    >
                      <Mail size={16} />
                    </button>
                    <button
                      className="icon-button"
                      title="Supprimer"
                      style={{ color: '#EF4444' }}
                      onClick={() => handleDelete(note)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {!notesLoading && visibleNotes.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-muted)' }}>
                    Aucun bon de livraison émis.
                  </td>
                </tr>
              )}
              {notesLoading && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-muted)' }}>
                    Chargement des bons de livraison...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ReportPdfPreview preview={preview} onClose={() => setPreview(null)} />
    </div>
  );
}
