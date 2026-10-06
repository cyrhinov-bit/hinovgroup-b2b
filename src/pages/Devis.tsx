import { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Download,
  MessageCircle,
  Edit2,
  Trash2,
  Check,
  X,
  Eye,
  Filter,
  RotateCcw,
  Search,
  CheckCircle,
  Calendar,
  Receipt
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../components/ConfirmModal';
import { generateQuotePdf, downloadBlob } from '../lib/pdfUtils';
import { ReportPdfPreview, type ReportPdfPreviewData } from '../components/ReportPdfPreview';
import type { Quote } from '../context/AppContext';

type PeriodFilter = 'ALL' | 'TODAY' | '7_DAYS' | 'THIS_MONTH' | 'THIS_QUARTER' | 'THIS_YEAR';
type QuoteStatus = Quote['status'];

// Workflow autorisé : Brouillon -> Envoyé -> Accepté/Refusé/Révision ; Révision -> Envoyé/Accepté/Refusé
const ALLOWED_TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  'Brouillon': ['Envoyé'],
  'Envoyé': ['Accepté', 'Refusé', 'Révision'],
  'Révision': ['Envoyé', 'Accepté', 'Refusé'],
  'Accepté': [],
  'Refusé': [],
};

function isQuoteExpired(q: Quote): boolean {
  if (!q.validUntil) return false;
  if (q.status === 'Accepté' || q.status === 'Refusé') return false;
  const today = new Date().toISOString().split('T')[0];
  return q.validUntil < today;
}

export function Devis() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentUser: authUser } = useAuth();
  const { quotes, clients, settings, updateQuoteStatus, deleteQuote, services, users, invoices } = useAppContext();
  const currentUser = users.find(u => u.id === authUser?.id) || authUser;
  const { confirm } = useConfirm();

  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [serviceFilter, setServiceFilter] = useState('');
  const [authorFilter, setAuthorFilter] = useState<string>(searchParams.get('authorId') || '');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('ALL');
  const [preview, setPreview] = useState<ReportPdfPreviewData | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;

  useEffect(() => {
    const authorParam = searchParams.get('authorId');
    if (authorParam) {
      setAuthorFilter(authorParam);
    }
  }, [searchParams]);

  const isDirector = currentUser?.role === 'Directeur' || currentUser?.role === 'SuperAdmin' || currentUser?.role === 'Directeur adjoint';
  const isResponsable = currentUser?.role === 'Responsable';

  const getClientName = (id: string) => clients.find(c => c.id === id)?.name || 'Inconnu';
  const getServiceName = (id?: string) => services.find(s => s.id === id)?.name || '-';
  const getUserName = (id?: string) => users.find(u => u.id === id)?.name || 'Non assigné';

  // Helper date filtering — une date absente/invalide n'est incluse que pour "ALL"
  const isDateInPeriod = (dateStr?: string, period: PeriodFilter = periodFilter): boolean => {
    if (period === 'ALL') return true;
    if (!dateStr) return false;
    
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    const now = new Date();
    
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (period) {
      case 'TODAY':
        return d >= startOfToday;
      case '7_DAYS': {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return d >= weekAgo;
      }
      case 'THIS_MONTH':
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      case 'THIS_QUARTER': {
        const currentQuarter = Math.floor(now.getMonth() / 3);
        const itemQuarter = Math.floor(d.getMonth() / 3);
        return itemQuarter === currentQuarter && d.getFullYear() === now.getFullYear();
      }
      case 'THIS_YEAR':
        return d.getFullYear() === now.getFullYear();
      default:
        return true;
    }
  };

  const allowedQuotes = useMemo(() => {
    if (isDirector) return quotes;
    if (isResponsable) {
      return quotes.filter(q => q.serviceId === currentUser?.serviceId || q.commercialId === currentUser?.id);
    }
    return quotes.filter(q => q.commercialId === currentUser?.id);
  }, [quotes, isDirector, isResponsable, currentUser]);

  const filteredQuotes = useMemo(() => {
    return allowedQuotes.filter(q => {
      // 1. Période
      if (!isDateInPeriod(q.date)) return false;

      // 2. Recherche
      if (filter.trim()) {
        const qText = filter.toLowerCase();
        const clientName = getClientName(q.clientId).toLowerCase();
        const authorName = getUserName(q.commercialId).toLowerCase();
        const subject = (q.subject || '').toLowerCase();
        const num = (q.quoteNumber || '').toLowerCase();
        if (!clientName.includes(qText) && !authorName.includes(qText) && !subject.includes(qText) && !num.includes(qText)) {
          return false;
        }
      }

      // 3. Statut
      if (statusFilter && q.status.toLowerCase() !== statusFilter.toLowerCase()) {
        return false;
      }

      // 4. Service
      if (serviceFilter && q.serviceId !== serviceFilter) {
        return false;
      }

      // 5. Utilisateur / Auteur
      if (authorFilter) {
        const matchAuthor = q.commercialId === authorFilter || 
          (!q.commercialId && users.find(u => u.id === authorFilter)?.serviceId === q.serviceId);
        if (!matchAuthor) return false;
      }

      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [allowedQuotes, filter, statusFilter, serviceFilter, authorFilter, periodFilter, clients, users]);

  // KPIs pour la sélection filtrée
  const totalFilteredCount = filteredQuotes.length;
  const totalFilteredAmount = filteredQuotes.filter(q => q.status !== 'Refusé').reduce((sum, q) => sum + (Number(q.total) || 0), 0);
  const acceptedFiltered = filteredQuotes.filter(q => q.status === 'Accepté');
  const acceptedFilteredAmount = acceptedFiltered.reduce((sum, q) => sum + (Number(q.total) || 0), 0);
  const conversionRate = totalFilteredCount > 0 ? Math.round((acceptedFiltered.length / totalFilteredCount) * 100) : 0;

  // Pagination (20 / page) — évite le rendu de milliers de lignes
  const totalPages = Math.max(1, Math.ceil(filteredQuotes.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedQuotes = filteredQuotes.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Reset page à chaque changement de filtre
  useEffect(() => { setCurrentPage(1); }, [filter, statusFilter, serviceFilter, authorFilter, periodFilter]);

  // Liste des utilisateurs éligibles pour le filtre + compteur pré-calculé (O(N))
  const quoteCountByAuthor = useMemo(() => {
    const m = new Map<string, number>();
    for (const q of quotes) m.set(q.commercialId, (m.get(q.commercialId) || 0) + 1);
    return m;
  }, [quotes]);
  const filterableUsers = useMemo(() => {
    if (isDirector) return users;
    if (isResponsable) return users.filter(u => u.serviceId === currentUser?.serviceId);
    return [];
  }, [users, isDirector, isResponsable, currentUser]);

  const hasActiveFilters = filter !== '' || statusFilter !== '' || serviceFilter !== '' || authorFilter !== '' || periodFilter !== 'ALL';

  const resetFilters = () => {
    setFilter('');
    setStatusFilter('');
    setServiceFilter('');
    setAuthorFilter('');
    setPeriodFilter('ALL');
    setCurrentPage(1);
    setSearchParams({});
  };

  const getBadgeColor = (status: string) => {
    switch (status) {
      case 'Accepté': return 'bg-success';
      case 'Refusé': return 'bg-error';
      case 'Révision': return 'bg-warning';
      case 'Envoyé': return 'bg-primary';
      case 'Brouillon': return 'bg-secondary';
      default: return '';
    }
  };

  const handlePreview = (q: Quote) => {
    const client = clients.find(c => c.id === q.clientId);
    const blob = generateQuotePdf(q, client, settings);
    const blobUrl = URL.createObjectURL(blob);
    setPreview({
      blobUrl,
      filename: `Devis_${q.quoteNumber}.pdf`,
      title: `Aperçu du Devis N° ${q.quoteNumber}`,
      onDownload: () => downloadBlob(blob, `Devis_${q.quoteNumber}.pdf`)
    });
  };

  // Qui peut changer le statut ? Propriétaire commercial, responsable du service, direction.
  const canManageQuote = (q: Quote): boolean => {
    if (isDirector) return true;
    if (q.commercialId === currentUser?.id) return true;
    if (isResponsable && q.serviceId && q.serviceId === currentUser?.serviceId) return true;
    return false;
  };

  const canTransition = (q: Quote, next: QuoteStatus): boolean => {
    if (!canManageQuote(q)) return false;
    // La direction peut rouvrir un devis Accepté/Refusé vers Révision (correction)
    if ((q.status === 'Accepté' || q.status === 'Refusé') && isDirector && next === 'Révision') return true;
    return (ALLOWED_TRANSITIONS[q.status] || []).includes(next);
  };

  const handleStatusChange = (q: Quote, newStatus: Quote['status']) => {
    if (!canTransition(q, newStatus)) return;
    updateQuoteStatus(q.id, newStatus);
  };

  const handleDelete = (q: Quote) => {
    const existingInvoice = invoices.find(inv => inv.quoteId === q.id);
    if (existingInvoice) {
      alert(`Suppression impossible : une facture (${existingInvoice.invoiceNumber}) est liée à ce devis.`);
      return;
    }
    confirm({
      title: 'Supprimer le devis',
      message: `Voulez-vous vraiment supprimer le devis "${q.quoteNumber}" ? Cette action est irréversible.`,
      confirmLabel: 'Supprimer',
      variant: 'danger',
      onConfirm: () => {
        try {
          const res: any = deleteQuote(q.id);
          if (res && typeof res.catch === 'function') {
            res.catch((e: any) => alert(e?.message || 'Suppression impossible.'));
          }
        } catch (e: any) {
          alert(e?.message || 'Suppression impossible.');
        }
      }
    });
  };

  return (
    <div className="dashboard">
      {/* Entête */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>Gestion & Suivi des Devis</h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', margin: '4px 0 0' }}>
            Consultez, filtrez par collaborateur et suivez l'avancement des devis commerciaux.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/devis/nouveau')} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Plus size={16} /> Créer un devis
        </button>
      </div>

      {/* ─── BANDEAU DE FILTRES AVANCÉS ───────────────────────── */}
      <div className="card" style={{ marginBottom: '20px', padding: '16px 20px', border: hasActiveFilters ? '1.5px solid rgba(37, 99, 235, 0.4)' : '1px solid var(--color-border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', fontWeight: 700 }}>
            <Filter size={16} color="var(--color-primary)" />
            <span>Filtres de recherche</span>
            {authorFilter && (
              <span className="badge-status" style={{ background: 'rgba(37, 99, 235, 0.12)', color: '#2563EB', fontSize: '11px', fontWeight: 600 }}>
                👤 {getUserName(authorFilter)}
              </span>
            )}
            {hasActiveFilters && (
              <span className="badge-status" style={{ background: 'var(--color-surface-alt)', color: 'var(--color-text-muted)', fontSize: '11px' }}>
                {totalFilteredCount} devis trouvé(s)
              </span>
            )}
          </div>

          {hasActiveFilters && (
            <button 
              className="btn btn-secondary" 
              onClick={resetFilters}
              style={{ fontSize: '0.8rem', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <RotateCcw size={12} />
              <span>Réinitialiser les filtres</span>
            </button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', alignItems: 'center' }}>
          {/* Recherche */}
          <div style={{ position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
            <input 
              type="text" 
              className="table-input" 
              placeholder="Client, N° devis, sujet..." 
              style={{ paddingLeft: '32px', width: '100%', fontSize: '0.85rem' }} 
              value={filter}
              onChange={e => setFilter(e.target.value)}
            />
          </div>

          {/* Filtre par Utilisateur / Auteur (Pour Admin et Responsables) */}
          {(isDirector || isResponsable) && (
            <div>
              <select 
                className="table-input" 
                style={{ width: '100%', fontSize: '0.85rem', fontWeight: authorFilter ? 700 : 400, borderColor: authorFilter ? '#2563EB' : undefined }}
                value={authorFilter}
                onChange={e => {
                  setAuthorFilter(e.target.value);
                  if (e.target.value) {
                    setSearchParams({ authorId: e.target.value });
                  } else {
                    setSearchParams({});
                  }
                }}
              >
                <option value="">👤 Tous les utilisateurs / auteurs</option>
                {filterableUsers.map(u => {
                  const userQuoteCount = quoteCountByAuthor.get(u.id) || 0;
                  return (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role}) — {userQuoteCount} devis
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {/* Période */}
          <div>
            <select
              className="table-input"
              style={{ width: '100%', fontSize: '0.85rem' }}
              value={periodFilter}
              onChange={e => setPeriodFilter(e.target.value as PeriodFilter)}
            >
              <option value="ALL">📅 Toute la période</option>
              <option value="TODAY">Aujourd'hui</option>
              <option value="7_DAYS">7 derniers jours</option>
              <option value="THIS_MONTH">Ce mois-ci</option>
              <option value="THIS_QUARTER">Ce trimestre</option>
              <option value="THIS_YEAR">Cette année</option>
            </select>
          </div>

          {/* Statut */}
          <div>
            <select 
              className="table-input" 
              style={{ width: '100%', fontSize: '0.85rem' }}
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="">🏷️ Tous les statuts</option>
              <option value="Brouillon">Brouillon</option>
              <option value="Envoyé">Envoyé</option>
              <option value="Accepté">Accepté</option>
              <option value="Révision">Révision</option>
              <option value="Refusé">Refusé</option>
            </select>
          </div>

          {/* Service (Direction) */}
          {isDirector && (
            <div>
              <select 
                className="table-input" 
                style={{ width: '100%', fontSize: '0.85rem' }}
                value={serviceFilter}
                onChange={e => setServiceFilter(e.target.value)}
              >
                <option value="">🏢 Tous les services</option>
                {services.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* ─── MINI KPIS DE LA SÉLECTION FILTRÉE ─────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        <div className="card" style={{ padding: '14px 18px', borderLeft: '4px solid #3B82F6' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Devis Sélectionnés</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)', marginTop: '2px' }}>
            {totalFilteredCount}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#2563EB', fontWeight: 600, marginTop: '2px' }}>
            {totalFilteredAmount.toLocaleString('fr-FR')} FCFA émis
          </div>
        </div>

        <div className="card" style={{ padding: '14px 18px', borderLeft: '4px solid #10B981' }}>
          <div style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 600, textTransform: 'uppercase' }}>Devis Acceptés</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#059669', marginTop: '2px' }}>
            {acceptedFiltered.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 600, marginTop: '2px' }}>
            {acceptedFilteredAmount.toLocaleString('fr-FR')} FCFA ({conversionRate}%)
          </div>
        </div>

        <div className="card" style={{ padding: '14px 18px', borderLeft: '4px solid #F59E0B' }}>
          <div style={{ fontSize: '0.72rem', color: '#D97706', fontWeight: 600, textTransform: 'uppercase' }}>En Négociation / Attente</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#D97706', marginTop: '2px' }}>
            {filteredQuotes.filter(q => q.status === 'Envoyé' || q.status === 'Brouillon' || q.status === 'Révision').length}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
            Pipeline commercial actif
          </div>
        </div>
      </div>

      {/* ─── TABLEAU DES DEVIS ────────────────────────────────── */}
      <div className="card">
        <div className="table-responsive">
          <table className="data-table responsive-table">
            <thead>
              <tr>
                <th>N° Devis</th>
                <th>Client</th>
                {(isDirector || isResponsable) && <th>Auteur / Utilisateur</th>}
                <th>Service</th>
                <th>Sujet</th>
                <th style={{ textAlign: 'right' }}>Montant Total</th>
                <th>Statut</th>
                <th>Date d'émission</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedQuotes.map(q => {
                const expired = isQuoteExpired(q);
                const existingInvoice = invoices.find(inv => inv.quoteId === q.id);
                return (
                <tr key={q.id}>
                  <td data-label="N° Devis">
                    <div style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{q.quoteNumber}</div>
                  </td>
                  <td data-label="Client">
                    <strong>{getClientName(q.clientId)}</strong>
                  </td>
                  {(isDirector || isResponsable) && (
                    <td data-label="Auteur">
                      <div 
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                        title="Filtrer uniquement sur ce collaborateur"
                        onClick={() => {
                          if (q.commercialId) {
                            setAuthorFilter(q.commercialId);
                            setSearchParams({ authorId: q.commercialId });
                          }
                        }}
                      >
                        <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'var(--color-primary-tint)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700 }}>
                          {getUserName(q.commercialId).substring(0, 2).toUpperCase()}
                        </div>
                        <span style={{ fontWeight: 600, color: authorFilter === q.commercialId ? '#2563EB' : 'var(--color-text)' }}>
                          {getUserName(q.commercialId)}
                        </span>
                      </div>
                    </td>
                  )}
                  <td data-label="Service" style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                    {getServiceName(q.serviceId)}
                  </td>
                  <td data-label="Sujet">{q.subject}</td>
                  <td data-label="Montant Total" style={{ textAlign: 'right', fontWeight: 700 }}>
                    {(Number(q.total) || 0).toLocaleString('fr-FR')} FCFA
                  </td>
                  <td data-label="Statut">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span className={`badge-status ${getBadgeColor(q.status)}`}>{q.status}</span>
                        {expired && (
                          <span className="badge-status" style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', fontSize: '11px' }} title={`Validité dépassée depuis le ${q.validUntil}`}>
                            <Calendar size={11} style={{ verticalAlign: '-1px', marginRight: '3px' }} />Expiré
                          </span>
                        )}
                        {q.clientComment && (
                          <span title={`Commentaire client : ${q.clientComment}`}>
                            <MessageCircle size={14} style={{ color: 'var(--color-primary)' }} />
                          </span>
                        )}
                      </div>
                      {existingInvoice && (isDirector || !!currentUser?.crmFacturationEnabled) && (
                        <span
                          style={{ cursor: 'pointer', background: '#E0F2FE', color: '#0284C7', padding: '2px 6px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700, width: 'fit-content' }}
                          onClick={() => navigate(`/factures?search=${existingInvoice.invoiceNumber}`)}
                          title="Voir la facture associée"
                        >
                          📄 Facturé ({existingInvoice.invoiceNumber})
                        </span>
                      )}
                    </div>
                  </td>
                  <td data-label="Date d'émission">{q.date}</td>
                  <td data-label="Actions">
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', justifyContent: 'center' }}>
                      {/* Action Créer une facture pour devis Accepté */}
                      {q.status === 'Accepté' && (isDirector || !!currentUser?.crmFacturationEnabled) && (
                        <button
                          className="icon-button"
                          style={{ color: '#0284C7', background: '#E0F2FE', padding: '6px', borderRadius: '4px' }}
                          onClick={() => navigate(`/factures?createFromQuoteId=${q.id}`)}
                          title="Créer une facture pour ce devis"
                        >
                          <Receipt size={16} />
                        </button>
                      )}

                      {/* Transitions de statut — uniquement les transitions autorisées */}
                      {canTransition(q, 'Envoyé') && (
                        <button
                          className="icon-button"
                          style={{ color: '#2563eb', background: '#EFF6FF', padding: '6px', borderRadius: '4px' }}
                          onClick={() => handleStatusChange(q, 'Envoyé')}
                          title="Marquer comme Envoyé"
                        >
                          <CheckCircle size={16} />
                        </button>
                      )}
                      {canTransition(q, 'Accepté') && (
                        <button
                          className="icon-button"
                          style={{ color: '#16a34a', background: '#f0fdf4', padding: '6px', borderRadius: '4px' }}
                          onClick={() => handleStatusChange(q, 'Accepté')}
                          title="Marquer comme Accepté"
                        >
                          <Check size={16} />
                        </button>
                      )}
                      {canTransition(q, 'Refusé') && (
                        <button
                          className="icon-button"
                          style={{ color: '#dc2626', background: '#fef2f2', padding: '6px', borderRadius: '4px' }}
                          onClick={() => handleStatusChange(q, 'Refusé')}
                          title="Marquer comme Refusé"
                        >
                          <X size={16} />
                        </button>
                      )}

                      {canManageQuote(q) && (
                        <button className="icon-button" style={{ color: 'var(--color-primary)' }} onClick={() => navigate(`/devis/nouveau?editId=${q.id}`)} title="Modifier le devis">
                          <Edit2 size={16} />
                        </button>
                      )}
                      <button className="icon-button" style={{ color: '#0D9488' }} onClick={() => handlePreview(q)} title="Aperçu PDF direct">
                        <Eye size={16} />
                      </button>
                      <button className="icon-button" style={{ color: 'var(--color-primary)' }} onClick={() => {
                        const client = clients.find(c => c.id === q.clientId);
                        const blob = generateQuotePdf(q, client, settings);
                        downloadBlob(blob, `Devis_${q.quoteNumber}.pdf`);
                      }} title="Télécharger PDF">
                        <Download size={16} />
                      </button>
                      <button className="icon-button" style={{ color: 'var(--color-error)' }} onClick={() => handleDelete(q)} title={existingInvoice ? 'Suppression bloquée : facture liée' : 'Supprimer'}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })}
              {filteredQuotes.length === 0 && (
                <tr>
                  <td colSpan={(isDirector || isResponsable) ? 9 : 8} style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)' }}>
                    Aucun devis trouvé pour les critères de filtre sélectionnés.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {filteredQuotes.length > PAGE_SIZE && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginTop: '16px' }}>
          <button className="btn btn-secondary" disabled={safePage <= 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))}>
            ← Précédent
          </button>
          <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
            Page {safePage} / {totalPages} — {paginatedQuotes.length} / {filteredQuotes.length} devis
          </span>
          <button className="btn btn-secondary" disabled={safePage >= totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}>
            Suivant →
          </button>
        </div>
      )}

      <ReportPdfPreview 
        preview={preview} 
        onClose={() => {
          if (preview?.blobUrl) URL.revokeObjectURL(preview.blobUrl);
          setPreview(null);
        }} 
      />
    </div>
  );
}
