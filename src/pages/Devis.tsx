import { useState, useEffect } from 'react';
import { Plus, Download, Send, MessageCircle, Edit2, Trash2, Check, X, Clock, Eye, User } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../components/ConfirmModal';
import { generateQuotePdf, downloadBlob } from '../lib/pdfUtils';
import { SendModal } from '../components/SendModal';
import { ReportPdfPreview, type ReportPdfPreviewData } from '../components/ReportPdfPreview';
import type { Quote } from '../context/AppContext';

export function Devis() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentUser } = useAuth();
  const { quotes, clients, settings, updateQuoteStatus, deleteQuote, services, users } = useAppContext();
  const { confirm } = useConfirm();
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [serviceFilter, setServiceFilter] = useState('');
  const [authorFilter, setAuthorFilter] = useState<string>(searchParams.get('authorId') || '');
  const [activeSendQuote, setActiveSendQuote] = useState<Quote | null>(null);
  const [preview, setPreview] = useState<ReportPdfPreviewData | null>(null);

  useEffect(() => {
    const authorParam = searchParams.get('authorId');
    if (authorParam) {
      setAuthorFilter(authorParam);
    }
  }, [searchParams]);

  const getClientName = (id: string) => clients.find(c => c.id === id)?.name || 'Inconnu';
  const getServiceName = (id?: string) => services.find(s => s.id === id)?.name || '-';
  const getUserName = (id?: string) => users.find(u => u.id === id)?.name || 'Non assigné';

  const isDirector = currentUser?.role === 'Directeur' || currentUser?.role === 'SuperAdmin' || currentUser?.role === 'Directeur adjoint';

  const allowedQuotes = isDirector
    ? quotes
    : quotes.filter(q => q.serviceId === currentUser?.serviceId || q.commercialId === currentUser?.id);

  const filteredQuotes = allowedQuotes.filter(q => {
    const matchClient = getClientName(q.clientId).toLowerCase().includes(filter.toLowerCase()) || 
      q.quoteNumber.toLowerCase().includes(filter.toLowerCase()) || 
      q.subject.toLowerCase().includes(filter.toLowerCase()) ||
      getUserName(q.commercialId).toLowerCase().includes(filter.toLowerCase());
    const matchStatus = statusFilter ? q.status.toLowerCase() === statusFilter.toLowerCase() : true;
    const matchService = serviceFilter ? q.serviceId === serviceFilter : true;
    const matchAuthor = authorFilter ? q.commercialId === authorFilter : true;
    return matchClient && matchStatus && matchService && matchAuthor;
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

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

  const handleSend = (q: Quote) => {
    setActiveSendQuote(q);
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

  const handleStatusChange = (q: Quote, newStatus: Quote['status']) => {
    updateQuoteStatus(q.id, newStatus);
  };

  return (
    <div className="dashboard">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ margin: 0 }}>Gestion des Devis</h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', margin: '4px 0 0' }}>
            Créez, personnalisez et suivez l'état de vos propositions commerciales.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/devis/nouveau')} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Plus size={16} /> Créer un devis
        </button>
      </div>

      <div className="card">
        <div className="responsive-flex-actions" style={{ marginBottom: '24px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <input 
            type="text" 
            className="table-input" 
            placeholder="Rechercher par client, numéro, sujet..." 
            style={{ maxWidth: '300px', flex: 1 }} 
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />
          <select 
            className="table-input" 
            style={{ maxWidth: '180px' }}
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="">Tous les statuts</option>
            <option value="Brouillon">Brouillon</option>
            <option value="Envoyé">Envoyé</option>
            <option value="Accepté">Accepté</option>
            <option value="Révision">Révision</option>
            <option value="Refusé">Refusé</option>
          </select>

          {isDirector && (
            <>
              <select 
                className="table-input" 
                style={{ maxWidth: '200px' }}
                value={serviceFilter}
                onChange={e => setServiceFilter(e.target.value)}
              >
                <option value="">Tous les services</option>
                {services.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>

              <select 
                className="table-input" 
                style={{ maxWidth: '220px' }}
                value={authorFilter}
                onChange={e => setAuthorFilter(e.target.value)}
              >
                <option value="">Tous les responsables</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                ))}
              </select>
            </>
          )}
        </div>

        <div className="table-responsive">
          <table className="data-table responsive-table">
            <thead>
              <tr>
                <th>N° Devis</th>
                <th>Client</th>
                {isDirector && <th>Auteur / Responsable</th>}
                <th>Service</th>
                <th>Sujet</th>
                <th style={{ textAlign: 'right' }}>Montant Total</th>
                <th>Statut</th>
                <th>Date d'émission</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredQuotes.map(q => (
                <tr key={q.id}>
                  <td data-label="N° Devis">
                    <div style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{q.quoteNumber}</div>
                  </td>
                  <td data-label="Client">
                    <strong>{getClientName(q.clientId)}</strong>
                  </td>
                  {isDirector && (
                    <td data-label="Auteur">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <User size={14} style={{ color: 'var(--color-text-muted)' }} />
                        <span style={{ fontWeight: 500 }}>{getUserName(q.commercialId)}</span>
                      </div>
                    </td>
                  )}
                  <td data-label="Service" style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                    {getServiceName(q.serviceId)}
                  </td>
                  <td data-label="Sujet">{q.subject}</td>
                  <td data-label="Montant Total" style={{ textAlign: 'right', fontWeight: 700 }}>
                    {q.total.toLocaleString('fr-FR')} FCFA
                  </td>
                  <td data-label="Statut">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className={`badge-status ${getBadgeColor(q.status)}`}>{q.status}</span>
                      {q.clientComment && (
                        <span title={`Commentaire client : ${q.clientComment}`}>
                          <MessageCircle size={14} style={{ color: 'var(--color-primary)' }} />
                        </span>
                      )}
                    </div>
                  </td>
                  <td data-label="Date d'émission">{q.date}</td>
                  <td data-label="Actions">
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', justifyContent: 'center' }}>
                      {/* Changement rapide de statut */}
                      {q.status !== 'Accepté' && (
                        <button 
                          className="icon-button" 
                          style={{ color: '#16a34a', background: '#f0fdf4', padding: '6px', borderRadius: '4px' }} 
                          onClick={() => handleStatusChange(q, 'Accepté')} 
                          title="Marquer comme Accepté"
                        >
                          <Check size={16} />
                        </button>
                      )}
                      {q.status !== 'Refusé' && q.status !== 'Accepté' && (
                        <button 
                          className="icon-button" 
                          style={{ color: '#dc2626', background: '#fef2f2', padding: '6px', borderRadius: '4px' }} 
                          onClick={() => handleStatusChange(q, 'Refusé')} 
                          title="Marquer comme Refusé"
                        >
                          <X size={16} />
                        </button>
                      )}

                      <button className="icon-button" style={{ color: 'var(--color-primary)' }} onClick={() => navigate(`/devis/nouveau?editId=${q.id}`)} title="Modifier le devis">
                        <Edit2 size={16} />
                      </button>
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
                      <button className="icon-button" style={{ color: '#2563eb' }} onClick={() => handleSend(q)} title="Envoyer par Email / WhatsApp">
                        <Send size={16} />
                      </button>
                      
                      <button className="icon-button" style={{ color: 'var(--color-error)' }} onClick={() => {
                        confirm({
                          title: 'Supprimer le devis',
                          message: `Voulez-vous vraiment supprimer le devis "${q.quoteNumber}" ? Cette action est irréversible.`,
                          confirmLabel: 'Supprimer',
                          variant: 'danger',
                          onConfirm: () => deleteQuote(q.id)
                        });
                      }} title="Supprimer">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredQuotes.length === 0 && (
                <tr>
                  <td colSpan={isDirector ? 9 : 8} style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)' }}>
                    Aucun devis trouvé.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {activeSendQuote && (
        <SendModal
          quote={activeSendQuote}
          client={clients.find(c => c.id === activeSendQuote.clientId)}
          settings={settings}
          isOpen={!!activeSendQuote}
          onClose={() => setActiveSendQuote(null)}
          onSent={() => {
            updateQuoteStatus(activeSendQuote.id, 'Envoyé');
            setActiveSendQuote(null);
          }}
        />
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
