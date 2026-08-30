import { useState } from 'react';
import { Trash2, Edit2, Download, Banknote, Briefcase } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../components/ConfirmModal';
import { SaleModal } from '../components/SaleModal';
import { PaymentModal } from '../components/PaymentModal';
import { generateSalePdf } from '../lib/pdfUtils';
import type { Sale } from '../context/AppContext';

export function Sales() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { sales, clients, services, settings, installments, facturePaiements, affaires, updateSaleStatus, deleteSale } = useAppContext();
  const { confirm } = useConfirm();
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [payingSale, setPayingSale] = useState<Sale | null>(null);

  const getClientName = (id: string) => clients.find(c => c.id === id)?.name || 'Inconnu';
  const getServiceName = (id: string) => services.find(s => s.id === id)?.name || 'Inconnu';
  
  const getSaleNetPaid = (saleId: string) => {
    const payments = facturePaiements.filter(p => p.venteId === saleId && p.status === 'VALIDE');
    if (payments.length > 0) {
      return payments.reduce((sum, p) => p.paymentType === 'ENCAISSEMENT' ? sum + p.amount : sum - p.amount, 0);
    }
    // Fallback on legacy installments
    return installments.filter(i => i.saleId === saleId).reduce((sum, i) => sum + i.paidAmount, 0);
  };

  const getSaleDue = (sale: Sale) => {
    const netPaid = getSaleNetPaid(sale.id);
    return Math.max(0, sale.total - netPaid);
  };

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
            {filteredSales.map(s => {
              const netPaid = getSaleNetPaid(s.id);
              const due = getSaleDue(s);
              const isSettled = due === 0 && s.total > 0;
              const linkedAffaire = s.affaireId ? affaires.find(a => a.id === s.affaireId) : null;

              return (
                <tr key={s.id}>
                  <td data-label="N° Vente">
                    <div style={{ fontWeight: 700 }}>{s.saleNumber}</div>
                    {linkedAffaire && (
                      <div
                        onClick={() => navigate(`/affaires/${linkedAffaire.id}`)}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          fontSize: '0.72rem', color: '#0D9488', background: '#F0FDFA',
                          border: '1px solid #CCFBF1', padding: '1px 6px', borderRadius: '4px',
                          marginTop: '2px', cursor: 'pointer'
                        }}
                        title="Voir l'affaire rattachée"
                      >
                        <Briefcase size={11} />
                        <span>{linkedAffaire.reference}</span>
                      </div>
                    )}
                  </td>
                  <td data-label="Client">{getClientName(s.clientId)}</td>
                  <td data-label="Service">{s.serviceId ? getServiceName(s.serviceId) : '-'}</td>
                  <td data-label="Montant TTC" style={{ fontWeight: 600 }}>{s.total.toLocaleString('fr-FR')} FCFA</td>
                  <td data-label="Paiement">
                    {isSettled ? (
                      <span className="badge-status bg-success">Soldée ({netPaid.toLocaleString('fr-FR')} F)</span>
                    ) : netPaid > 0 ? (
                      <div>
                        <span style={{ fontWeight: 600, color: '#0D9488' }}>{netPaid.toLocaleString('fr-FR')} F</span>
                        <div style={{ fontSize: '0.75rem', color: '#DC2626' }}>Reste {due.toLocaleString('fr-FR')} F</div>
                      </div>
                    ) : (
                      <span style={{ fontSize: '0.8rem', color: '#DC2626', fontWeight: 600 }}>
                        Impayée ({due.toLocaleString('fr-FR')} F)
                      </span>
                    )}
                  </td>
                  <td data-label="Statut">
                    <span className={`badge-status ${getBadgeColor(s.status)}`}>{s.status}</span>
                  </td>
                  <td data-label="Date">{s.date}</td>
                  <td data-label="Actions">
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <button className="icon-button" style={{ color: 'var(--color-primary)' }} onClick={() => setEditingSale(s)} title="Modifier">
                        <Edit2 size={18} />
                      </button>
                      <button className="icon-button" style={{ color: 'var(--color-primary)' }} onClick={() => {
                        const client = clients.find(c => c.id === s.clientId);
                        generateSalePdf(s, client, settings);
                      }} title="Télécharger Facture PDF">
                        <Download size={18} />
                      </button>
                      {s.status !== 'Annulée' && (
                        <button 
                          className="icon-button" 
                          style={{ color: '#0D9488' }} 
                          onClick={() => setPayingSale(s)} 
                          title="Enregistrer un règlement / remboursement"
                        >
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
                    </div>
                  </td>
                </tr>
              );
            })}
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
          clientName={getClientName(payingSale.clientId)}
          isOpen={!!payingSale}
          onClose={() => setPayingSale(null)}
        />
      )}
    </div>
  );
}