import React, { useState } from 'react';
import { Download, Check, X, Send, MessageCircle, ArrowLeft, AlertCircle } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../components/ConfirmModal';
import { generateWhatsAppLink } from '../lib/sendUtils';
import { generateQuotePdf } from '../lib/pdfUtils';
import { SendModal } from '../components/SendModal';
import './ClientPortal.css';

export function ClientPortal() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { quotes, clients, settings, updateQuoteStatus } = useAppContext();
  const { currentUser } = useAuth();
  const { confirm } = useConfirm();
  const [showSendModal, setShowSendModal] = useState(false);
  const [feedbackMode, setFeedbackMode] = useState<'Révision' | 'Refusé' | null>(null);
  const [clientComment, setClientComment] = useState('');

  const quote = quotes.find(q => q.id === id);

  if (!quote) {
    return <div className="client-portal" style={{ padding: '40px', textAlign: 'center' }}><h2>Devis introuvable</h2></div>;
  }

  const client = clients.find(c => c.id === quote.clientId);

  const handleStatusChange = (status: 'Accepté' | 'Refusé' | 'Brouillon' | 'Envoyé' | 'Révision') => {
    const isAccept = status === 'Accepté';
    confirm({
      title: isAccept ? 'Accepter le devis' : 'Confirmer l\'action',
      message: isAccept
        ? 'Confirmez-vous l\'acceptation de ce devis ? Cette décision sera transmise immédiatement au prestataire.'
        : 'Êtes-vous sûr ?',
      confirmLabel: isAccept ? 'Accepter le devis' : 'Confirmer',
      variant: isAccept ? 'success' : 'warning',
      onConfirm: async () => {
        await updateQuoteStatus(quote.id, status, clientComment);
        if (currentUser && status !== 'Envoyé') navigate('/devis');
      }
    });
  };

  const handleSend = () => {
    setShowSendModal(true);
  };

  const handleSendWhatsapp = () => {
    const { link, error } = generateWhatsAppLink(quote, client, settings);
    if (error) {
      alert(error);
      return;
    }
    updateQuoteStatus(quote.id, 'Envoyé');
    window.open(link, '_blank');
  };

  return (
    <div 
      className={`client-portal style-${(quote.style || 'classique').toLowerCase()}`}
      style={quote.accentColor ? { '--color-primary': quote.accentColor } as React.CSSProperties : {}}
    >
      {/* Admin Toolbar - Only visible if an employee is logged in */}
      {currentUser && (
        <div className="admin-preview-toolbar">
          <div className="toolbar-left">
            <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.9rem' }} onClick={() => navigate('/devis')}>
              <ArrowLeft size={14} style={{ marginRight: '6px' }} /> Retour aux devis
            </button>
            <span style={{ marginLeft: '16px', fontWeight: 'bold' }}>Mode Prévisualisation</span>
          </div>
          <div className="toolbar-right" style={{ display: 'flex', gap: '8px' }}>
            <button className="btn" style={{ backgroundColor: 'white', color: 'var(--color-primary)', border: '1px solid var(--color-primary)', padding: '6px 12px', fontSize: '0.9rem' }} onClick={handleSend}>
              <Send size={14} style={{ marginRight: '6px' }} /> E-mail
            </button>
            <button className="btn" style={{ backgroundColor: '#25D366', color: 'white', padding: '6px 12px', fontSize: '0.9rem', border: 'none' }} onClick={handleSendWhatsapp}>
              <MessageCircle size={14} style={{ marginRight: '6px' }} /> WhatsApp
            </button>
          </div>
        </div>
      )}

      <header className="portal-header">
        <div className="portal-container header-content">
          <div className="brand-name">
            {settings.headerLogoBase64 ? (
              <img src={settings.headerLogoBase64} alt={settings.companyName} style={{ height: '40px', objectFit: 'contain' }} />
            ) : (
              settings.companyName
            )}
          </div>
          <button className="btn btn-outline" style={{ color: 'white', borderColor: 'white' }} onClick={() => generateQuotePdf(quote, client, settings)}>
            <Download size={16} style={{ marginRight: '8px' }} />
            Télécharger PDF
          </button>
        </div>
      </header>

      <main className="portal-container portal-main">
        <div className="card devis-document">
          <div className="devis-header">
            <div className="company-info" style={{ width: '100%' }}>
              {settings.headerLogoBase64 ? (
                <div style={{ width: '100%', marginBottom: '16px' }}>
                  <img
                    src={settings.headerLogoBase64}
                    alt={settings.companyName}
                    style={{
                      width: '100%',
                      maxHeight: '140px',
                      objectFit: 'contain',
                      objectPosition: 'left center',
                      borderRadius: '4px'
                    }}
                  />
                </div>
              ) : (
                <h2>{settings.companyName}</h2>
              )}
              <p>{settings.companyAddress}</p>
              <p>RCCM: {settings.companySiret}</p>
            </div>
            <div className="client-info">
              <h3>Devis N° {quote.quoteNumber}</h3>
              <p><strong>Pour :</strong> {client?.name || 'Client Inconnu'}</p>
              <p>{client?.contact}</p>
              <p>{client?.email}</p>
              <p>Date : {quote.date}</p>
            </div>
          </div>

          <div className="devis-body">
            <table className="devis-table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Qté</th>
                  <th>Prix Unitaire</th>
                  <th>Remise</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {quote.lines.map((line) => (
                  <tr key={line.id}>
                    <td>
                      <strong>{line.description}</strong>
                    </td>
                    <td>{line.quantity}</td>
                    <td>{line.unitPrice.toLocaleString('fr-FR')} FCFA</td>
                    <td>{line.discountPercent && line.discountPercent > 0 ? `-${line.discountPercent}%` : '-'}</td>
                    <td>{line.total.toLocaleString('fr-FR')} FCFA</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="devis-footer">
            <div className="conditions">
              <h4>Conditions Générales</h4>
              <p className="text-muted" style={{ fontSize: '0.8rem', whiteSpace: 'pre-line' }}>
                Ce devis est valable pour une durée de {settings.defaultValidity} jours.
                {'\n'}{settings.defaultTerms}
              </p>
            </div>
            <div className="totals">
              {quote.discountPercent && quote.discountPercent > 0 ? (
                <>
                  <div className="total-row">
                    <span>Remise ({quote.discountPercent}%)</span>
                    <span>-{quote.discountAmount?.toLocaleString('fr-FR')} FCFA</span>
                  </div>
                  <div className="total-row">
                    <span>Sous-total Net</span>
                    <span>{quote.subtotal.toLocaleString('fr-FR')} FCFA</span>
                  </div>
                </>
              ) : (
                <div className="total-row">
                  <span>Sous-total</span>
                  <span>{quote.subtotal.toLocaleString('fr-FR')} FCFA</span>
                </div>
              )}
              <div className="total-row grand-total">
                <span>Total</span>
                <span>{quote.total.toLocaleString('fr-FR')} FCFA</span>
              </div>
            </div>
          </div>

          <div className="signature-section">
            <div className="signature-box">
              <p>Signature du prestataire</p>
              <div className="signature-placeholder">[Cachet HINOV]</div>
            </div>
            <div className="signature-box client-box">
              <p>Signature du client</p>
              {quote.status === 'Accepté' ? (
                <div className="signature-placeholder" style={{ color: 'var(--color-success)' }}>SIGNÉ</div>
              ) : (
                <div className="signature-input-area">
                  En attente de signature
                </div>
              )}
            </div>
          </div>
        </div>

        {quote.status !== 'Accepté' && quote.status !== 'Refusé' && quote.status !== 'Révision' && (
          <div className="client-actions-section">
            <h3>Votre décision</h3>
            {feedbackMode ? (
              <div className="feedback-form" style={{ marginTop: '16px', padding: '24px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #e9ecef', textAlign: 'left' }}>
                <h4 style={{ marginBottom: '16px', color: '#333' }}>
                  {feedbackMode === 'Révision' ? 'Demander une révision' : 'Refuser le devis'}
                </h4>
                <textarea 
                  value={clientComment}
                  onChange={(e) => setClientComment(e.target.value)}
                  placeholder={feedbackMode === 'Révision' ? "Précisez les modifications souhaitées (ex: retirer l'article 2, changer la quantité...)" : "Motif du refus (optionnel)..."}
                  style={{ width: '100%', minHeight: '120px', padding: '12px', borderRadius: '4px', border: '1px solid #ccc', marginBottom: '16px', fontSize: '1rem', fontFamily: 'inherit' }}
                />
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                  <button className="btn btn-secondary" onClick={() => { setFeedbackMode(null); setClientComment(''); }}>Annuler</button>
                  <button 
                    className={`btn ${feedbackMode === 'Révision' ? 'btn-warning' : 'btn-danger'}`}
                    onClick={() => {
                      updateQuoteStatus(quote.id, feedbackMode, clientComment);
                      setFeedbackMode(null);
                      if (currentUser) navigate('/devis');
                    }}
                  >
                    Confirmer
                  </button>
                </div>
              </div>
            ) : (
              <div className="action-buttons">
                <button className="btn btn-success action-btn" onClick={() => handleStatusChange('Accepté')}>
                  <Check size={20} style={{ marginRight: '8px' }} />
                  Accepter le devis
                </button>
                <button className="btn btn-warning action-btn" onClick={() => setFeedbackMode('Révision')}>
                  <AlertCircle size={20} style={{ marginRight: '8px' }} />
                  Demander une révision
                </button>
                <button className="btn btn-danger action-btn" onClick={() => setFeedbackMode('Refusé')}>
                  <X size={20} style={{ marginRight: '8px' }} />
                  Refuser
                </button>
              </div>
            )}
          </div>
        )}
        
        {(quote.status === 'Refusé' || quote.status === 'Révision') && quote.clientComment && (
          <div className="client-actions-section" style={{ backgroundColor: '#f8f9fa', border: '1px solid #e9ecef', marginTop: '24px' }}>
            <h3 style={{ color: quote.status === 'Refusé' ? 'var(--color-error)' : 'var(--color-warning)' }}>
              {quote.status === 'Refusé' ? 'Devis refusé' : 'Révision demandée'}
            </h3>
            <div style={{ marginTop: '16px', padding: '16px', backgroundColor: 'white', borderRadius: '4px', border: '1px solid #ddd', textAlign: 'left', whiteSpace: 'pre-line' }}>
              <strong>Commentaire du client :</strong><br/><br/>
              {quote.clientComment}
            </div>
          </div>
        )}
      </main>
      {showSendModal && (
        <SendModal
          quote={quote}
          client={client}
          settings={settings}
          isOpen={showSendModal}
          onClose={() => setShowSendModal(false)}
          onSent={() => {
            updateQuoteStatus(quote.id, 'Envoyé');
            setShowSendModal(false);
          }}
        />
      )}
    </div>
  );
}
