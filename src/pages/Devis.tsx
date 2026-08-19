import { useState, useEffect } from 'react';
import { Plus, Download, Send, MessageCircle, CheckCircle2, Edit2, Trash2, MoreVertical } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../components/ConfirmModal';
import { generateQuotePdf, downloadBlob } from '../lib/pdfUtils';
import { SendModal } from '../components/SendModal';
import { SaleModal } from '../components/SaleModal';
import type { Quote } from '../context/AppContext';

export function Devis() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { quotes, clients, settings, updateQuoteStatus, deleteQuote, sales } = useAppContext();
  const { confirm } = useConfirm();
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [activeSendQuote, setActiveSendQuote] = useState<Quote | null>(null);
  const [activeSaleQuote, setActiveSaleQuote] = useState<Quote | null>(null);

  const getClientName = (id: string) => clients.find(c => c.id === id)?.name || 'Inconnu';

  const allowedQuotes = currentUser?.role === 'Directeur'
    ? quotes
    : quotes.filter(q => q.serviceId === currentUser?.serviceId);

  const filteredQuotes = allowedQuotes.filter(q => {
    const matchClient = getClientName(q.clientId).toLowerCase().includes(filter.toLowerCase()) || q.quoteNumber.toLowerCase().includes(filter.toLowerCase());
    const matchStatus = statusFilter ? q.status.toLowerCase() === statusFilter.toLowerCase() : true;
    return matchClient && matchStatus;
  });

  const hasSale = (quoteId: string) => sales.some(s => s.quoteId === quoteId);

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

  return (
    <div className="dashboard">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2>Tous les devis</h2>
        <button className="btn btn-primary" onClick={() => navigate('/devis/nouveau')}>
          <Plus size={16} style={{ marginRight: '8px' }} /> Créer un devis
        </button>
      </div>

      <div className="card">
        <div className="responsive-flex-actions" style={{ marginBottom: '24px' }}>
          <input 
            type="text" 
            className="table-input" 
            placeholder="Rechercher par client ou numéro..." 
            style={{ maxWidth: '300px' }} 
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />
          <select 
            className="table-input" 
            style={{ maxWidth: '200px' }}
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
        </div>

        <div className="table-responsive">
<table className="data-table responsive-table">
          <thead>
            <tr>
              <th>N° Devis</th>
              <th>Client</th>
              <th>Sujet</th>
              <th>Montant HT</th>
              <th>Statut</th>
              <th>Date d'émission</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredQuotes.map(q => (
              <tr key={q.id}>
                <td data-label="N° Devis">{q.quoteNumber}</td>
                <td data-label="Client">{getClientName(q.clientId)}</td>
                <td data-label="Sujet">{q.subject}</td>
                <td data-label="Montant HT">{q.subtotal.toLocaleString('fr-FR')} FCFA</td>
                <td data-label="Statut">
                  <span className={`badge-status ${getBadgeColor(q.status)}`}>{q.status}</span>
                  {q.clientComment && (
                    <span title={`Commentaire : ${q.clientComment}`}>
                      <MessageCircle size={14} style={{ marginLeft: '6px', color: 'var(--color-primary)', verticalAlign: 'middle' }} />
                    </span>
                  )}
                </td>
                <td data-label="Date d'émission">{q.date}</td>
                <td data-label="Actions">
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button className="icon-button" style={{ color: 'var(--color-primary)' }} onClick={() => navigate(`/devis/nouveau?editId=${q.id}`)} title="Modifier">
                      <Edit2 size={18} />
                    </button>
                    <button className="icon-button" style={{ color: 'var(--color-primary)' }} onClick={() => {
                      const client = clients.find(c => c.id === q.clientId);
                      const blob = generateQuotePdf(q, client, settings);
                      downloadBlob(blob, `Devis_${q.quoteNumber}.pdf`);
                    }} title="Télécharger PDF">
                      <Download size={18} />
                    </button>
                    <button className="icon-button" style={{ color: 'var(--color-primary)' }} onClick={() => handleSend(q)} title="Envoyer le devis">
                      <Send size={18} />
                    </button>
                    
                    {hasSale(q.id) ? (
                      <div title="Vente conclue" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', color: 'var(--color-success)' }}>
                        <CheckCircle2 size={18} />
                      </div>
                    ) : (
                      <button className="icon-button" style={{ color: 'var(--color-success)' }} onClick={() => setActiveSaleQuote(q)} title="Conclure la vente">
                        <CheckCircle2 size={18} />
                      </button>
                    )}

                    <button className="icon-button" style={{ color: 'var(--color-error)' }} onClick={() => {
                      confirm({
                        title: 'Supprimer le devis',
                        message: `Voulez-vous vraiment supprimer le devis "${q.quoteNumber}" ? Cette action est irréversible.`,
                        confirmLabel: 'Supprimer',
                        variant: 'danger',
                        onConfirm: () => deleteQuote(q.id)
                      });
                    }} title="Supprimer">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredQuotes.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '24px' }}>Aucun devis trouvé.</td>
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
      {activeSaleQuote && (
        <SaleModal
          quote={activeSaleQuote}
          client={clients.find(c => c.id === activeSaleQuote.clientId)}
          isOpen={!!activeSaleQuote}
          onClose={() => setActiveSaleQuote(null)}
        />
      )}
    </div>
  );
}
