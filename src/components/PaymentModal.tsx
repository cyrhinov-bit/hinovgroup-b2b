import { useState } from 'react';
import { X, Banknote, CheckCircle2 } from 'lucide-react';
import type { Sale, Client, Installment } from '../context/AppContext';
import './SaleModal.css';

interface PaymentModalProps {
  sale: Sale;
  client?: Client;
  installments: Installment[];
  isOpen: boolean;
  onClose: () => void;
  onPay: (installmentId: string, amount: number) => Promise<void>;
}

export function PaymentModal({ sale, client, installments, isOpen, onClose, onPay }: PaymentModalProps) {
  const saleInstallments = installments.filter(i => i.saleId === sale.id);
  const unpaid = saleInstallments.filter(i => i.status !== 'Payée');
  const firstUnpaid = unpaid[0];
  const [selectedId, setSelectedId] = useState<string>(firstUnpaid?.id || '');
  const [amount, setAmount] = useState<number>(firstUnpaid ? firstUnpaid.amount - firstUnpaid.paidAmount : 0);
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const selected = saleInstallments.find(i => i.id === (selectedId || firstUnpaid?.id));
  const remaining = selected ? Math.max(0, selected.amount - selected.paidAmount) : 0;

  const handlePay = async () => {
    if (!selected || amount <= 0 || saving) return;
    const received = Math.min(amount, remaining);
    const isFullPayment = received >= remaining;
    setSaving(true);
    await onPay(selected.id, received);
    setSaving(false);
    if (isFullPayment) {
      const next = saleInstallments.filter(i => i.id !== selected.id && i.status !== 'Payée');
      if (next.length > 0) {
        const n = next[0];
        setSelectedId(n.id);
        setAmount(n.amount - n.paidAmount);
      } else {
        onClose();
      }
    } else {
      setAmount(0);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="sale-modal card">
        <button className="confirm-modal-close" onClick={onClose}>
          <X size={18} />
        </button>

        <div className="sale-modal-header">
          <div className="sale-modal-icon">
            <Banknote size={22} color="white" />
          </div>
          <div>
            <h3>Encaisser - {sale.saleNumber}</h3>
            <p>Client : <strong>{client?.name || client?.contact || 'Client'}</strong> — Total {sale.total.toLocaleString('fr-FR')} FCFA</p>
          </div>
        </div>

        <div className="sale-modal-body">
          <table className="sale-lines-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Montant</th>
                <th>Déjà payé</th>
                <th>Restant</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {saleInstallments.map(i => (
                <tr key={i.id} style={{ backgroundColor: i.id === selectedId ? 'var(--color-primary-tint, #eef2ff)' : undefined }}>
                  <td>{new Date(i.dueDate).toLocaleDateString('fr-FR')}</td>
                  <td>{i.amount.toLocaleString('fr-FR')} FCFA</td>
                  <td>{i.paidAmount.toLocaleString('fr-FR')} FCFA</td>
                  <td>{Math.max(0, i.amount - i.paidAmount).toLocaleString('fr-FR')} FCFA</td>
                  <td><span className={`badge-status ${i.status === 'Payée' ? 'bg-success' : 'bg-warning'}`}>{i.status}</span></td>
                </tr>
              ))}
              {saleInstallments.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '16px' }}>Aucune échéance.</td></tr>
              )}
            </tbody>
          </table>

          {unpaid.length > 0 ? (
            <div className="form-group">
              <label>Échéance à encaisser</label>
              <select
                className="table-input"
                value={selected?.id || ''}
                onChange={e => {
                  const inst = saleInstallments.find(i => i.id === e.target.value);
                  setSelectedId(e.target.value);
                  setAmount(inst ? Math.max(0, inst.amount - inst.paidAmount) : 0);
                }}
              >
                {unpaid.map(i => (
                  <option key={i.id} value={i.id}>
                    {new Date(i.dueDate).toLocaleDateString('fr-FR')} — Restant {Math.max(0, i.amount - i.paidAmount).toLocaleString('fr-FR')} FCFA
                  </option>
                ))}
              </select>
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center' }}>
                <input
                  type="number"
                  className="table-input"
                  min="0"
                  max={remaining}
                  value={amount || ''}
                  placeholder="Montant reçu (FCFA)"
                  onChange={e => setAmount(Number(e.target.value))}
                />
                <button className="btn btn-primary" onClick={handlePay} disabled={saving || amount <= 0 || amount > remaining}>
                  <CheckCircle2 size={16} style={{ marginRight: '6px' }} />Encaisser
                </button>
              </div>
            </div>
          ) : (
            <div style={{ padding: '12px', backgroundColor: 'var(--color-success-tint)', borderRadius: 'var(--radius)', color: 'var(--color-success)', fontWeight: 500 }}>
              Vente entièrement payée.
            </div>
          )}
        </div>

        <div className="sale-modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Fermer</button>
        </div>
      </div>
    </div>
  );
}