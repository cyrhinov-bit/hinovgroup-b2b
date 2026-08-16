import React from 'react';
import type { PosSettings, AppSettings } from '../../context/AppContext';

export interface ReceiptData {
  transaction: any;
  cart: any[];
  paymentMethod: string;
  cashAmount: number;
  changeAmount: number;
  total: number;
  subtotal: number;
  globalDiscount: number;
}

interface ReceiptTicketProps {
  data: ReceiptData | null;
  settings: PosSettings;
  crmSettings?: AppSettings;
  preview?: boolean;
}

export default function ReceiptTicket({ data, settings, crmSettings, preview = false }: ReceiptTicketProps) {
  if (!data) return null;

  const { transaction, cart, paymentMethod, cashAmount, changeAmount, total, subtotal, globalDiscount } = data;

  const formatDate = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className={preview ? "" : "receipt-print-zone"} style={{ width: '80mm', padding: '10px', fontSize: '12px', fontFamily: 'monospace', color: '#000', margin: '0 auto', background: '#fff' }}>
      {/* En-tête */}
      <div style={{ textAlign: 'center', marginBottom: '16px' }}>
        {(crmSettings?.headerLogoBase64 || crmSettings?.companyLogo) && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
            <img 
              src={crmSettings.headerLogoBase64 || crmSettings.companyLogo} 
              alt="Logo" 
              style={{ maxWidth: '80%', maxHeight: '60px', objectFit: 'contain' }} 
            />
          </div>
        )}
        <h2 style={{ fontSize: '16px', margin: '0 0 4px 0', textTransform: 'uppercase' }}>{settings.libraryName}</h2>
        {settings.address && <div style={{ marginBottom: '2px' }}>{settings.address}</div>}
        {settings.phone && <div style={{ marginBottom: '2px' }}>Tel: {settings.phone}</div>}
        {settings.email && <div style={{ marginBottom: '2px' }}>Email: {settings.email}</div>}
        <div style={{ marginTop: '8px', borderTop: '1px dashed #000', paddingTop: '8px' }}>
          TICKET : {transaction.transactionNumber}
        </div>
        <div>Date : {formatDate(transaction.date)}</div>
      </div>

      {/* Lignes de commande */}
      <div style={{ borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '8px 0', marginBottom: '12px' }}>
        <div className="table-responsive">
<table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', paddingBottom: '4px' }}>Qté</th>
              <th style={{ textAlign: 'left', paddingBottom: '4px' }}>Désignation</th>
              <th style={{ textAlign: 'right', paddingBottom: '4px' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {cart.map((item, i) => (
              <tr key={i}>
                <td style={{ verticalAlign: 'top', paddingTop: '4px', width: '30px' }}>{item.quantity}x</td>
                <td style={{ verticalAlign: 'top', paddingTop: '4px' }}>
                  {item.name}
                  <div style={{ fontSize: '10px' }}>{item.unitPrice.toLocaleString()} {settings.currency}</div>
                </td>
                <td style={{ verticalAlign: 'top', paddingTop: '4px', textAlign: 'right' }}>
                  {item.total.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
</div>
      </div>

      {/* Totaux */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
          <span>Sous-total:</span>
          <span>{subtotal.toLocaleString()} {settings.currency}</span>
        </div>
        {globalDiscount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
            <span>Remise:</span>
            <span>-{globalDiscount.toLocaleString()} {settings.currency}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '16px', fontWeight: 'bold' }}>
          <span>TOTAL:</span>
          <span>{total.toLocaleString()} {settings.currency}</span>
        </div>
      </div>

      {/* Paiement */}
      <div style={{ borderTop: '1px dashed #000', paddingTop: '8px', marginBottom: '16px' }}>
        {transaction.payments && transaction.payments.map((p: any, idx: number) => (
          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
            <span>Payé en ({p.method}):</span>
            <span>{p.amount.toLocaleString()} {settings.currency}</span>
          </div>
        ))}
        {changeAmount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
            <span>Rendu:</span>
            <span>{changeAmount.toLocaleString()} {settings.currency}</span>
          </div>
        )}
      </div>

      {/* Message de fin */}
      <div style={{ textAlign: 'center', marginTop: '16px', borderTop: '1px dashed #000', paddingTop: '16px', whiteSpace: 'pre-wrap' }}>
        {settings.ticketMessage || 'Merci de votre visite !'}
      </div>
    </div>
  );
}
