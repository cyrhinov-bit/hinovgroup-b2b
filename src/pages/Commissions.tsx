import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../components/ConfirmModal';

export function Commissions() {
  const { currentUser } = useAuth();
  const { commissions, clients, users, services, updateCommissionStatus, deleteCommission } = useAppContext();
  const { confirm } = useConfirm();
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const getClientName = (id: string) => clients.find(c => c.id === id)?.name || 'Inconnu';
  const getUserName = (id: string) => users.find(u => u.id === id)?.name || 'Inconnu';
  const getServiceName = (id: string) => services.find(s => s.id === id)?.name || 'Inconnu';

  const allowedCommissions = currentUser?.role === 'Directeur'
    ? commissions
    : commissions.filter(c => c.serviceId === currentUser?.serviceId);

  const filteredCommissions = allowedCommissions.filter(c => {
    const matchClient = getClientName(c.clientId || '').toLowerCase().includes(filter.toLowerCase());
    const matchCommercial = getUserName(c.commercialId || '').toLowerCase().includes(filter.toLowerCase());
    const matchStatus = statusFilter ? c.status.toLowerCase() === statusFilter.toLowerCase() : true;
    return (matchClient || matchCommercial) && matchStatus;
  });

  const totalCommissions = filteredCommissions.reduce((sum, c) => sum + c.commissionAmount, 0);
  const totalMargin = filteredCommissions.reduce((sum, c) => sum + c.marginAmount, 0);

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2>Commissions</h2>
      </div>

      <div className="widgets-grid" style={{ marginBottom: '24px' }}>
        <div className="widget-card">
          <div className="widget-icon bg-success">
            <span style={{ fontSize: '24px', color: 'white' }}>FCFA</span>
          </div>
          <div className="widget-content">
            <div className="widget-label">COMMISSIONS TOTALES</div>
            <div className="widget-value">{totalCommissions.toLocaleString('fr-FR')} FCFA</div>
          </div>
        </div>
        <div className="widget-card">
          <div className="widget-icon bg-info">
            <span style={{ fontSize: '24px', color: 'white' }}>%</span>
          </div>
          <div className="widget-content">
            <div className="widget-label">MARGE TOTALE</div>
            <div className="widget-value">{totalMargin.toLocaleString('fr-FR')} FCFA</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
          <input 
            type="text" 
            className="table-input" 
            placeholder="Rechercher par client ou commercial..." 
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
              <th>Commercial</th>
              <th>Service</th>
              <th>Total HT</th>
              <th>Coût</th>
              <th>Marge</th>
              <th>Commission</th>
              <th>Statut</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredCommissions.map(c => (
              <tr key={c.id}>
                <td>{getClientName(c.clientId || '')}</td>
                <td>{getUserName(c.commercialId || '')}</td>
                <td>{c.serviceId ? getServiceName(c.serviceId) : '-'}</td>
                <td>{c.totalHt.toLocaleString('fr-FR')} FCFA</td>
                <td>{c.costTotal.toLocaleString('fr-FR')} FCFA</td>
                <td>{c.marginAmount.toLocaleString('fr-FR')} FCFA ({c.marginPercent}%)</td>
                <td><strong>{c.commissionAmount.toLocaleString('fr-FR')} FCFA</strong>
                  {c.paidAmount ? <div style={{ fontSize: '0.8rem', color: 'var(--color-success)' }}>Payé : {c.paidAmount.toLocaleString('fr-FR')} FCFA</div> : null}</td>
                <td>
                  <span className={`badge-status ${getBadgeColor(c.status)}`}>{c.status}</span>
                </td>
                <td>
                  {c.status === 'En attente' && (
                    <button className="icon-button" style={{ color: 'var(--color-primary)' }} onClick={() => updateCommissionStatus(c.id, 'Validée')} title="Valider">
                      Valider
                    </button>
                  )}
                  {c.status === 'Validée' && (
                    <button className="icon-button" style={{ color: 'var(--color-success)' }} onClick={() => updateCommissionStatus(c.id, 'Payée')} title="Marquer payée">
                      Payer
                    </button>
                  )}
                  <button
                    className="icon-button text-error"
                    onClick={() => confirm({
                      title: 'Supprimer la commission',
                      message: 'Voulez-vous vraiment supprimer cette commission ?',
                      confirmLabel: 'Supprimer',
                      onConfirm: () => deleteCommission(c.id)
                    })}
                    title="Supprimer"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {filteredCommissions.length === 0 && (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '24px' }}>Aucune commission trouvée.</td>
              </tr>
            )}
          </tbody>
        </table>
</div>
      </div>
    </div>
  );
}
