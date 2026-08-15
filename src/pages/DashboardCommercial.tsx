import { Target, Users, TrendingUp, Coins, Calendar } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import './DashboardDirecteur.css';

export function DashboardCommercial() {
  const { currentUser } = useAuth();
  const { prospects, clients, commissions, prospectFollowUps } = useAppContext();

  const myProspects = prospects.filter(p => p.commercialId === currentUser?.id);
  const myClients = clients.filter(c => c.commercialId === currentUser?.id);
  const myCommissions = commissions.filter(c => c.commercialId === currentUser?.id);

  const totalProspects = myProspects.length;
  const convertedProspects = myProspects.filter(p => p.status === 'Converti').length;
  const conversionRate = totalProspects > 0 ? Math.round((convertedProspects / totalProspects) * 100) : 0;

  const pendingFollowUps = prospectFollowUps.filter(f => 
    f.status === 'En attente' && 
    myProspects.some(p => p.id === f.prospectId)
  ).sort((a, b) => a.date.localeCompare(b.date));

  const totalCommissions = myCommissions.reduce((sum, c) => sum + c.commissionAmount, 0);

  return (
    <div className="dashboard">
      <h2>Tableau de bord - Commercial</h2>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: '24px' }}>Bienvenue, {currentUser?.name}</p>
      
      <div className="widgets-grid">
        <div className="widget-card">
          <div className="widget-icon bg-info">
            <Target size={32} color="white" />
          </div>
          <div className="widget-content">
            <div className="widget-label">PROSPECTS</div>
            <div className="widget-value">{totalProspects}</div>
          </div>
        </div>
        
        <div className="widget-card">
          <div className="widget-icon bg-primary">
            <TrendingUp size={32} color="white" />
          </div>
          <div className="widget-content">
            <div className="widget-label">TAUX CONVERSION</div>
            <div className="widget-value">{conversionRate}%</div>
          </div>
        </div>

        <div className="widget-card">
          <div className="widget-icon bg-success">
            <Users size={32} color="white" />
          </div>
          <div className="widget-content">
            <div className="widget-label">CLIENTS APPORTÉS</div>
            <div className="widget-value">{myClients.length}</div>
          </div>
        </div>

        <div className="widget-card">
          <div className="widget-icon bg-warning">
            <Coins size={32} color="white" />
          </div>
          <div className="widget-content">
            <div className="widget-label">COMMISSIONS</div>
            <div className="widget-value">{totalCommissions.toLocaleString('fr-FR')} FCFA</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', marginTop: '24px' }}>
        <div className="card">
          <h3>Prospects récents</h3>
          <div className="table-responsive">
<table className="data-table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Entreprise</th>
                <th>Service</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {myProspects.slice(0, 5).map(p => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{p.company || '-'}</td>
                  <td>{p.serviceId || '-'}</td>
                  <td><span className="badge-status bg-primary">{p.status}</span></td>
                </tr>
              ))}
              {myProspects.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '24px' }}>Aucun prospect.</td>
                </tr>
              )}
            </tbody>
          </table>
</div>
        </div>

        <div className="card">
          <h3>Relances à venir</h3>
          {pendingFollowUps.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {pendingFollowUps.slice(0, 5).map(f => {
                const prospect = myProspects.find(p => p.id === f.prospectId);
                return (
                  <div key={f.id} style={{ padding: '12px', border: '1px solid var(--color-border)', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <strong>{prospect?.name || 'Inconnu'}</strong>
                      <span className={`badge-status ${f.priority === 'Haute' || f.priority === 'Urgente' ? 'bg-error' : 'bg-warning'}`}>{f.priority}</span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                      <Calendar size={14} style={{ marginRight: '4px' }} />{f.date} {f.time || ''}
                    </div>
                    {f.observation && <div style={{ fontSize: '0.85rem', marginTop: '4px' }}>{f.observation}</div>}
                  </div>
                );
              })}
            </div>
          ) : (
            <p style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-muted)' }}>Aucune relance à venir.</p>
          )}
        </div>
      </div>
    </div>
  );
}
