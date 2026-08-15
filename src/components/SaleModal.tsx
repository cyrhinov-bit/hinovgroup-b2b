import React, { useState } from 'react';
import { CheckCircle2, X, Percent, Plus } from 'lucide-react';
import type { Quote, Client, Sale, SaleLine, InstallmentInput } from '../context/AppContext';
import { useAppContext } from '../context/AppContext';
import './SaleModal.css';

interface SaleModalProps {
  quote?: Quote;
  client?: Client;
  sale?: Sale;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export function SaleModal({ quote, client, sale, isOpen, onClose, onSaved }: SaleModalProps) {
  const { settings, addSale, updateSale, prestations, installments: allInstallments, saveInstallmentsForSale } = useAppContext();

  const isEditing = !!sale;
  const title = isEditing ? `Modifier la vente ${sale!.saleNumber}` : `Conclure une vente - Devis ${quote?.quoteNumber || ''}`;

  const defaultCostPrice = (line: { prestationId?: string }) => {
    const prestation = prestations.find(p => p.id === line.prestationId);
    return prestation?.costPrice || 0;
  };

  const initialLines = sale
    ? sale.lines.map(l => ({ ...l }))
    : (quote?.lines || []).map(l => ({
        id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        costPrice: defaultCostPrice(l),
        total: l.total
      }));

  const [lines, setLines] = useState<SaleLine[]>(initialLines);
  const [notes, setNotes] = useState(sale?.notes || '');
  const [saving, setSaving] = useState(false);

  const initialTotal = initialLines.reduce((acc, l) => acc + l.total, 0);
  const [instRows, setInstRows] = useState<InstallmentInput[]>(() =>
    sale
      ? allInstallments.filter(i => i.saleId === sale.id).map(i => ({ id: i.id, amount: i.amount, dueDate: i.dueDate }))
      : [{ amount: initialTotal, dueDate: new Date().toISOString().split('T')[0] }]
  );

  if (!isOpen) return null;

  const updateCost = (index: number, costPrice: number) => {
    setLines(prev => prev.map((l, i) => i === index ? { ...l, costPrice: Math.max(0, costPrice) } : l));
  };

  const grossSubtotal = lines.reduce((acc, l) => acc + l.total, 0);
  const total = grossSubtotal;

  const costTotal = lines.reduce((sum, l) => sum + (l.costPrice || 0) * l.quantity, 0);
  const marginAmount = grossSubtotal - costTotal;
  const marginPercent = grossSubtotal > 0 ? Math.round((marginAmount / grossSubtotal) * 10000) / 100 : 0;
  const commissionRate = settings.commissionRate !== undefined ? settings.commissionRate : 10;
  const commissionAmount = Math.round(marginAmount * commissionRate / 100);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    const now = new Date();
    const seq = (now.getTime() % 10000).toString().padStart(4, '0');
    const saleData: Sale = {
      id: sale?.id || (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString()),
      saleNumber: sale?.saleNumber || `VTE-${now.getFullYear()}-${seq}`,
      quoteId: sale?.quoteId || quote?.id,
      clientId: sale?.clientId || quote?.clientId || '',
      serviceId: sale?.serviceId || quote?.serviceId,
      lines,
      subtotal: grossSubtotal,
      total,
      status: sale?.status || 'Enregistrée',
      date: sale?.date || now.toISOString().split('T')[0],
      notes: notes || undefined
    };
    if (sale) {
      await updateSale(sale.id, saleData);
      await saveInstallmentsForSale(sale.id, instRows);
    } else {
      await addSale(saleData, instRows);
    }
    setSaving(false);
    onSaved?.();
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="sale-modal card">
        <button className="confirm-modal-close" onClick={onClose}>
          <X size={18} />
        </button>

        <div className="sale-modal-header">
          <div className="sale-modal-icon">
            <CheckCircle2 size={22} color="white" />
          </div>
          <div>
            <h3>{title}</h3>
            <p>Client : <strong>{client?.name || client?.contact || 'Client'}</strong></p>
          </div>
        </div>

        <div className="sale-modal-body">
          <table className="sale-lines-table">
            <thead>
              <tr>
                <th>Description</th>
                <th style={{ width: '70px' }}>Qté</th>
                <th style={{ width: '110px' }}>Prix Unit.</th>
                <th style={{ width: '120px' }}>Coût de revient</th>
                <th style={{ width: '110px' }}>Total HT</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => (
                <tr key={line.id || idx}>
                  <td>{line.description}</td>
                  <td>{line.quantity}</td>
                  <td>{line.unitPrice.toLocaleString('fr-FR')}</td>
                  <td>
                    <input
                      type="number"
                      className="table-input"
                      value={line.costPrice || 0}
                      min="0"
                      step="0.01"
                      onChange={e => updateCost(idx, Number(e.target.value))}
                    />
                  </td>
                  <td>{line.total.toLocaleString('fr-FR')}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="sale-totals">
            <div className="total-row">
              <span>Sous-total HT</span>
              <span>{grossSubtotal.toLocaleString('fr-FR')} FCFA</span>
            </div>
            <div className="total-row">
              <span>Coût de revient total</span>
              <span>{costTotal.toLocaleString('fr-FR')} FCFA</span>
            </div>
            <div className="total-row" style={{ color: marginAmount >= 0 ? 'var(--color-success)' : 'var(--color-error)' }}>
              <span>Marge</span>
              <span>{marginAmount.toLocaleString('fr-FR')} FCFA ({marginPercent}%)</span>
            </div>
            <div className="total-row">
              <span><Percent size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />Commission ({commissionRate}%)</span>
              <span>{commissionAmount.toLocaleString('fr-FR')} FCFA</span>
            </div>
            <div className="total-row grand-total">
              <span>Total</span>
              <span>{total.toLocaleString('fr-FR')} FCFA</span>
            </div>
          </div>

          <div className="form-group">
            <label>Échéancier de paiement</label>
            {instRows.map((row, idx) => (
              <div key={row.id || idx} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                <input
                  type="number"
                  className="table-input"
                  min="0"
                  placeholder="Montant (FCFA)"
                  value={row.amount || ''}
                  onChange={e => setInstRows(prev => prev.map((r, i) => i === idx ? { ...r, amount: Number(e.target.value) } : r))}
                />
                <input
                  type="date"
                  className="table-input"
                  value={row.dueDate}
                  onChange={e => setInstRows(prev => prev.map((r, i) => i === idx ? { ...r, dueDate: e.target.value } : r))}
                />
                {instRows.length > 1 && (
                  <button type="button" className="icon-button text-error" title="Supprimer l'échéance" onClick={() => setInstRows(prev => prev.filter((_, i) => i !== idx))}>
                    <X size={16} />
                  </button>
                )}
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button type="button" className="btn btn-outline" onClick={() => setInstRows(prev => [...prev, { amount: 0, dueDate: new Date().toISOString().split('T')[0] }])}>
                <Plus size={14} style={{ marginRight: '4px' }} /> Ajouter une échéance
              </button>
              <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                Total : {instRows.reduce((s, r) => s + (r.amount || 0), 0).toLocaleString('fr-FR')} FCFA
                {instRows.reduce((s, r) => s + (r.amount || 0), 0) !== total && <span style={{ color: 'var(--color-warning)' }}> — ≠ Vente ({total.toLocaleString('fr-FR')})</span>}
              </span>
            </div>
          </div>

          <div className="form-group">
            <label>Notes</label>
            <textarea
              className="form-control"
              rows={2}
              placeholder="Notes éventuelles..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
        </div>

        <div className="sale-modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            <CheckCircle2 size={16} style={{ marginRight: '8px' }} />
            {sale ? 'Enregistrer' : 'Conclure la vente'}
          </button>
        </div>
      </div>
    </div>
  );
}