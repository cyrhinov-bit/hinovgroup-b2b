import { useState } from 'react';
import { Trash2, Edit2, Download, Banknote } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../components/ConfirmModal';
import { SaleModal } from '../components/SaleModal';
import { PaymentModal } from '../components/PaymentModal';
import { generateSalePdf } from '../lib/pdfUtils';
import type { Sale } from '../context/AppContext';

export function Sales() {
  const { currentUser } = useAuth();
  const { sales, clients, services, settings, installments, updateSaleStatus, deleteSale, recordInstallmentPayment } = useAppContext();
  const { confirm } = useConfirm();
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [payingSale, setPayingSale] = useState<Sale | null>(null);

  const getClientName = (id: string) => clients.find(c => c.id === id)?.name || 'Inconnu';
  const getServiceName = (id: string) => services.find(s => s.id === id)?.name || 'Inconnu';
  const getSalePaid = (saleId: string) => installments.filter(i => i.saleId === saleId).reduce((sum, i) => sum + i.paidAmount, 0);
  const getSaleDue = (saleId: string) => installments.filter(i => i.saleId === saleId).reduce((sum, i) => sum + Math.max(0, i.amount - i.paidAmount), 0);

  const allowedSales = currentUser?.role === 'Directeur'
    ? sales
    : sales.filter(s => s.serviceId === currentUser?.serviceId);

  const filteredSales = allowedSales.filter(s => {
    const matchClient = getClientName(s.clientId).toLowerCase().includes(filter.toLowerCase()) || s.saleNumber.toLowerCase().includes(filter.toLowerCase());
    const matchStatus = statusFilter ? s.status === statusFilter : true;
    return matchClient && matchStatus;
  });

  const getBadgeColor = (status: string) => {
    switch (status) {
      case 'Payée': return 'bg-success';
      case 'Annulée': return 'bg-error';
      case 'Enregistrée': return 'bg-primary';
      default: return '';
    }
  };

  return (
    <div className="dashboard">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2>Ventes</h2>
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
            <option value="Enregistrée">Enregistrée</option>
            <option value="Payée">Payée</option>
            <option value="Annulée">Annulée</option>
          </select>
        </div>

        <div className="table-responsive">
<table className="data-table responsive-table">
          <thead>
            <tr>
              <th>N° Vente</th>
              <th>Client</th>
              <th>Service</th>
              <th>Montant</th>
              <th>Paiement</th>
              <th>Statut</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredSales.map(s => (
              <tr key={s.id}>
                <td data-label="N° Vente">{s.saleNumber}</td>
                <td data-label="Client">{getClientName(s.clientId)}</td>
                <td data-label="Service">{s.serviceId ? getServiceName(s.serviceId) : '-'}</td>
                <td data-label="Montant">{s.subtotal.toLocaleString('fr-FR')} FCFA</td>
                <td data-label="Paiement">
                  {s.status === 'Payée' ? (
                    <span className="badge-status bg-success">{s.subtotal.toLocaleString('fr-FR')} FCFA</span>
                  ) : (
                    <span>
                      {getSalePaid(s.id).toLocaleString('fr-FR')} / {s.subtotal.toLocaleString('fr-FR')} FCFA
                      {getSaleDue(s.id) > 0 && <div style={{ fontSize: '0.8rem', color: 'var(--color-warning)' }}>Restant {getSaleDue(s.id).toLocaleString('fr-FR')}</div>}
                    </span>
                  )}
                </td>
                <td data-label="Statut">
                  <span className={`badge-status ${getBadgeColor(s.status)}`}>{s.status}</span>
                </td>
                <td data-label="Date">{s.date}</td>
                <td data-label="Actions">
                  <button className="icon-button" style={{ color: 'var(--color-primary)' }} onClick={() => setEditingSale(s)} title="Modifier coûts de revient">
                    <Edit2 size={18} />
                  </button>
                  <button className="icon-button" style={{ color: 'var(--color-primary)' }} onClick={() => {
                    const client = clients.find(c => c.id === s.clientId);
                    generateSalePdf(s, client, settings);
                  }} title="Télécharger PDF">
                    <Download size={18} />
                  </button>
                  {s.status !== 'Annulée' && s.status !== 'Payée' && (
                    <button className="icon-button" style={{ color: 'var(--color-success)' }} onClick={() => setPayingSale(s)} title="Encaisser une échéance">
                      <Banknote size={18} />
                    </button>
                  )}
                  {s.status !== 'Annulée' && (
                    <button className="icon-button" style={{ color: 'var(--color-error)' }} onClick={() => updateSaleStatus(s.id, 'Annulée')} title="Annuler la vente">
                      <Trash2 size={16} />
                    </button>
                  )}
                  <button
                    className="icon-button text-error"
                    onClick={() => confirm({
                      title: 'Supprimer la vente',
                      message: `Voulez-vous vraiment supprimer la vente "${s.saleNumber}" ? La commission liée sera aussi supprimée.`,
                      confirmLabel: 'Supprimer',
                      variant: 'danger',
                      onConfirm: () => deleteSale(s.id)
                    })}
                    title="Supprimer"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {filteredSales.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '24px' }}>Aucune vente trouvée.</td>
              </tr>
            )}
          </tbody>
        </table>
</div>
      </div>

      {editingSale && (
        <SaleModal
          client={clients.find(c => c.id === editingSale.clientId)}
          sale={editingSale}
          isOpen={!!editingSale}
          onClose={() => setEditingSale(null)}
        />
      )}

      {payingSale && (
        <PaymentModal
          sale={payingSale}
          client={clients.find(c => c.id === payingSale.clientId)}
          installments={installments}
          isOpen={!!payingSale}
          onClose={() => setPayingSale(null)}
          onPay={recordInstallmentPayment}
        />
      )}
    </div>
  );
}