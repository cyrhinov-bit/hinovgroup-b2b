import { useState } from 'react';
import { Eye, DollarSign, CheckCircle, Clock } from 'lucide-react';
import { useAppContext, type Commission } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { CommissionDetailModal } from '../components/CommissionDetailModal';

export function CommercialCommissions() {
  const { currentUser } = useAuth();
  const { commissions, clients, services, sales, affaires, facturePaiements } = useAppContext();
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedCommission, setSelectedCommission] = useState<Commission | null>(null);

  const myCommissions = commissions.filter(c => c.commercialId === currentUser?.id);

  const filteredCommissions = myCommissions.filter(c => {
    const matchStatus = statusFilter ? c.status === statusFilter : true;
    return matchStatus;
  });

  const getClientName = (id?: string) => clients.find(c => c.id === id)?.name || 'Inconnu';
  const getServiceName = (id?: string) => services.find(s => s.id === id)?.name || 'Général';

  // Helper to compute collection and eligible unlockable commission
  const getCommissionData = (c: Commission) => {
    const sale = sales.find(s => s.id === c.saleId);
    const payments = sale?.id ? facturePaiements.filter(p => p.venteId === sale.id && p.status === 'VALIDE') : [];
    const netReceived = payments.reduce((sum, p) => p.paymentType === 'ENCAISSEMENT' ? sum + p.amount : sum - p.amount, 0);
    const totalTtc = sale?.total || 1;
    const collectionRate = Math.max(0, Math.min(100, Math.round((netReceived / totalTtc) * 100)));
    const eligibleAmount = Math.round((c.commissionAmount * collectionRate) / 100);
    const paidAmount = c.paidAmount || 0;
    const remainingToPay = Math.max(0, c.commissionAmount - paidAmount);

    return {
      sale,
      collectionRate,
      eligibleAmount,
      paidAmount,
      remainingToPay
    };
  };

  const totalCommission = filteredCommissions.reduce((sum, c) => sum + c.commissionAmount, 0);
  const totalEligible = filteredCommissions.reduce((sum, c) => sum + getCommissionData(c).eligibleAmount, 0);
  const totalPaid = filteredCommissions.reduce((sum, c) => sum + (c.paidAmount || 0), 0);
  const pendingCommission = filteredCommissions.filter(c => c.status === 'En attente').reduce((sum, c) => sum + c.commissionAmount, 0);

  const getBadgeColor = (status: string) => {
    switch (status) {
      case 'Payée': return 'bg-success';
      case 'Validée': return 'bg-primary';
      case 'Annulée': return 'bg-danger';
      default: return 'bg-warning';
    }
  };

  const formatMoney = (val: number) => val.toLocaleString('fr-FR') + ' FCFA';

  return (
    <div className="dashboard">
      <div style={{ marginBottom: '24px' }}>
        <h2>Mes Commissions</h2>
        <p style={{ color: 'var(--color-text-muted)', margin: '4px 0 0' }}>
          Suivi de mes rémunérations variables indexées sur les marges réelles et les encaissements
        </p>
      </div>

      <div className="widgets-grid" style={{ marginBottom: '24px' }}>
        <div className="widget-card">
          <div className="widget-icon bg-info">
            <DollarSign size={24} color="white" />
          </div>
          <div className="widget-content">
            <div className="widget-label">TOTAL GÉNÉRÉ</div>
            <div className="widget-value">{formatMoney(totalCommission)}</div>
          </div>
        </div>

        <div className="widget-card">
          <div className="widget-icon bg-primary">
            <CheckCircle size={24} color="white" />
          </div>
          <div className="widget-content">
            <div className="widget-label">DÉBLOCABLES / ÉLIGIBLES</div>
            <div className="widget-value">{formatMoney(totalEligible)}</div>
          </div>
        </div>

        <div className="widget-card">
          <div className="widget-icon bg-success">
            <DollarSign size={24} color="white" />
          </div>
          <div className="widget-content">
            <div className="widget-label">DÉJÀ ENCAISSÉES</div>
            <div className="widget-value">{formatMoney(totalPaid)}</div>
          </div>
        </div>

        <div className="widget-card">
          <div className="widget-icon bg-warning">
            <Clock size={24} color="white" />
          </div>
          <div className="widget-content">
            <div className="widget-label">EN ATTENTE VALIDATION</div>
            <div className="widget-value">{formatMoney(pendingCommission)}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <select 
            className="table-input" 
            style={{ maxWidth: '200px' }}
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="">Tous les statuts</option>
            <option value="En attente">En attente</option>
            <option value="Validée">Validée</option>
            <option value="Payée">Payée</option>
          </select>

          <span style={{ fontSize: '0.85rem', color: '#64748B' }}>
            {filteredCommissions.length} commission(s) trouvée(s)
          </span>
        </div>

        {filteredCommissions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)' }}>
            Aucune commission trouvée.
          </div>
        ) : (
          <div className="mobile-card-grid">
            {filteredCommissions.map(c => {
              const data = getCommissionData(c);
              const aff = affaires.find(a => a.id === c.affaireId);

              return (
                <div key={c.id} className="mobile-card" style={{ border: '1px solid #E2E8F0', borderRadius: '10px' }}>
                  <div className="mobile-card-header">
                    <div>
                      <div className="mobile-card-title" style={{ fontSize: '1rem', fontWeight: 700 }}>
                        {getClientName(c.clientId)}
                      </div>
                      <div className="mobile-card-subtitle" style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '2px' }}>
                        <span>{new Date(c.createdAt).toLocaleDateString('fr-FR')}</span>
                        {aff && <span className="badge-status bg-info" style={{ fontSize: '0.7rem' }}>{aff.reference}</span>}
                      </div>
                    </div>
                    <span className={`badge-status ${getBadgeColor(c.status)}`}>{c.status}</span>
                  </div>
                  
                  <div className="mobile-card-body">
                    <div className="mobile-card-row">
                      <span className="mobile-card-label">Service</span>
                      <span className="mobile-card-value">{getServiceName(c.serviceId)}</span>
                    </div>

                    <div className="mobile-card-row">
                      <span className="mobile-card-label">Marge Réelle</span>
                      <span className="mobile-card-value">{formatMoney(c.marginAmount)} ({c.marginPercent}%)</span>
                    </div>

                    <div className="mobile-card-row">
                      <span className="mobile-card-label">Commission Totale ({c.commissionPercent}%)</span>
                      <span className="mobile-card-value" style={{ fontWeight: 700, color: 'var(--color-primary-strong)' }}>
                        {formatMoney(c.commissionAmount)}
                      </span>
                    </div>

                    {/* Progress of client payment */}
                    <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #F1F5F9' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                        <span style={{ color: '#64748B' }}>Règlement Client ({data.collectionRate}%)</span>
                        <span style={{ fontWeight: 600, color: '#0D9488' }}>Éligible: {formatMoney(data.eligibleAmount)}</span>
                      </div>
                      <div style={{ height: '6px', background: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', background: '#0D9488', width: `${data.collectionRate}%` }} />
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '8px', borderTop: '1px solid #E2E8F0' }}>
                      <div>
                        {c.paidAmount ? (
                          <span style={{ fontSize: '0.8rem', color: '#059669', fontWeight: 600 }}>
                            Reçu: {formatMoney(c.paidAmount)}
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: '#64748B' }}>
                            Non encore versé
                          </span>
                        )}
                      </div>

                      <button
                        className="btn btn-secondary"
                        style={{ padding: '4px 10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                        onClick={() => setSelectedCommission(c)}
                      >
                        <Eye size={14} /> Détails
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Detail Calculation */}
      {selectedCommission && (
        <CommissionDetailModal
          commission={selectedCommission}
          onClose={() => setSelectedCommission(null)}
        />
      )}
    </div>
  );
}
