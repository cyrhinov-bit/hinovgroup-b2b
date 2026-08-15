import { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';

export function CommercialCommissions() {
  const { currentUser } = useAuth();
  const { commissions, clients, services } = useAppContext();
  const [statusFilter, setStatusFilter] = useState('');

  const myCommissions = commissions.filter(c => c.commercialId === currentUser?.id);

  const filteredCommissions = myCommissions.filter(c => {
    const matchStatus = statusFilter ? c.status === statusFilter : true;
    return matchStatus;
  });

  const getClientName = (id: string) => clients.find(c => c.id === id)?.name || 'Inconnu';
  const getServiceName = (id: string) => services.find(s => s.id === id)?.name || 'Inconnu';

  const totalCommission = filteredCommissions.reduce((sum, c) => sum + c.commissionAmount, 0);
  const validatedCommission = filteredCommissions.filter(c => c.status === 'Validée' || c.status === 'Payée').reduce((sum, c) => sum + c.commissionAmount, 0);
  const pendingCommission = filteredCommissions.filter(c => c.status === 'En attente').reduce((sum, c) => sum + c.commissionAmount, 0);

  const getBadgeColor = (status: string) => {
    switch (status) {
      case 'Payée': return 'bg-success';
      case 'Validée': return 'bg-primary';
      case 'En attente': return 'bg-warning';
      default: return '';
    }
  };

  return (
    <div className="dashboard">
      <h2>Mes Commissions</h2>

      <div className="widgets-grid" style={{ marginBottom: '24px' }}>
        <div className="widget-card">
          <div className="widget-icon bg-success">
            <span style={{ fontSize: '20px', color: 'white' }}>FCFA</span>
          </div>
          <div className="widget-content">
            <div className="widget-label">TOTAL COMMISSIONS</div>
            <div className="widget-value">{totalCommission.toLocaleString('fr-FR')} FCFA</div>
          </div>
        </div>
        <div className="widget-card">
          <div className="widget-icon bg-primary">
            <span style={{ fontSize: '20px', color: 'white' }}>✓</span>
          </div>
          <div className="widget-content">
            <div className="widget-label">VALIDÉES / PAYÉES</div>
            <div className="widget-value">{validatedCommission.toLocaleString('fr-FR')} FCFA</div>
          </div>
        </div>
        <div className="widget-card">
          <div className="widget-icon bg-warning">
            <span style={{ fontSize: '20px', color: 'white' }}>⏳</span>
          </div>
          <div className="widget-content">
            <div className="widget-label">EN ATTENTE</div>
            <div className="widget-value">{pendingCommission.toLocaleString('fr-FR')} FCFA</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div style={{ marginBottom: '24px' }}>
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
        </div>

        <div className="table-responsive">
<table className="data-table">
          <thead>
            <tr>
              <th>Client</th>
              <th>Service</th>
              <th>Total HT</th>
              <th>Marge</th>
              <th>Commission</th>
              <th>Statut</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {filteredCommissions.map(c => (
              <tr key={c.id}>
                <td>{getClientName(c.clientId || '')}</td>
                <td>{c.serviceId ? getServiceName(c.serviceId) : '-'}</td>
                <td>{c.totalHt.toLocaleString('fr-FR')} FCFA</td>
                <td>{c.marginAmount.toLocaleString('fr-FR')} FCFA ({c.marginPercent}%)</td>
                <td><strong>{c.commissionAmount.toLocaleString('fr-FR')} FCFA</strong>
                  {c.paidAmount ? <div style={{ fontSize: '0.8rem', color: 'var(--color-success)' }}>Payé : {c.paidAmount.toLocaleString('fr-FR')} FCFA</div> : null}
                </td>
                <td><span className={`badge-status ${getBadgeColor(c.status)}`}>{c.status}</span></td>
                <td>{new Date(c.createdAt).toLocaleDateString('fr-FR')}</td>
              </tr>
            ))}
            {filteredCommissions.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '24px' }}>Aucune commission trouvée.</td>
              </tr>
            )}
          </tbody>
        </table>
</div>
      </div>
    </div>
  );
}
