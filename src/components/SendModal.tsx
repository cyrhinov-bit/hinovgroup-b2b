import React, { useState } from 'react';
import { Send, Mail, Copy, Check, ExternalLink, X, MessageCircle } from 'lucide-react';
import type { Quote, Client, AppSettings } from '../context/AppContext';
import { generateEmailContent, generateWhatsAppLink } from '../lib/sendUtils';
import './SendModal.css';

interface SendModalProps {
  quote: Quote;
  client?: Client;
  settings?: AppSettings;
  isOpen: boolean;
  onClose: () => void;
  onSent: () => void;
}

export function SendModal({ quote, client, settings, isOpen, onClose, onSent }: SendModalProps) {
  const [copied, setCopied] = useState(false);
  if (!isOpen) return null;

  const emailInfo = generateEmailContent(quote, client, settings);

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(emailInfo.body);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onSent();
  };

  const handleOpenMailClient = () => {
    window.open(emailInfo.mailto, '_blank');
    onSent();
  };

  const handleSendWhatsapp = () => {
    const { link, error } = generateWhatsAppLink(quote, client, settings);
    if (error) {
      alert(error);
      return;
    }
    window.open(link, '_blank');
    onSent();
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="send-modal card">
        <button className="confirm-modal-close" onClick={onClose}>
          <X size={18} />
        </button>

        <div className="send-modal-header">
          <div className="send-modal-icon">
            <Send size={22} color="white" />
          </div>
          <div>
            <h3>Transmission du Devis N° {quote.quoteNumber}</h3>
            <p>Destinataire : <strong>{client?.name || client?.contact || 'Client'}</strong> ({client?.email || "Pas d'email"})</p>
          </div>
        </div>

        <div className="send-modal-body">
          <div className="send-option-card">
            <div className="option-title">
              <MessageCircle size={18} color="#25D366" />
              <div>
                <strong>Envoyer par WhatsApp</strong>
                <p>Ouvrir WhatsApp avec un message pré-rempli contenant le lien du devis.</p>
              </div>
            </div>
            <button className="btn btn-outline" style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '6px', borderColor: '#25D366', color: '#25D366' }} onClick={handleSendWhatsapp}>
              <ExternalLink size={16} /> WhatsApp
            </button>
          </div>

          <div className="send-option-card">
            <div className="option-title">
              <Mail size={18} color="var(--color-primary)" />
              <div>
                <strong>Envoyer via logiciel e-mail local</strong>
                <p>Ouvre votre logiciel de messagerie (Outlook, Mail, Gmail...) avec le texte pré-rempli.</p>
              </div>
            </div>
            <button className="btn btn-primary" style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '6px' }} onClick={handleOpenMailClient}>
              <ExternalLink size={16} /> Ouvrir Messagerie
            </button>
          </div>

          <div className="send-option-card">
            <div className="option-title">
              <Copy size={18} color="var(--color-secondary)" />
              <div>
                <strong>Copier le message</strong>
                <p>Copiez le texte du message pour le coller dans n'importe quelle application de messagerie.</p>
              </div>
            </div>
            <button className={`btn ${copied ? 'btn-success' : 'btn-outline'}`} style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '6px' }} onClick={handleCopyMessage}>
              {copied ? <><Check size={16} /> Copié !</> : <><Copy size={16} /> Copier</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
