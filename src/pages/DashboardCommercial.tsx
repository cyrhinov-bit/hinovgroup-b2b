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

      <div className="responsive-form-grid" style={{ marginTop: '24px' }}>
        <div className="card">
          <h3>Prospects récents</h3>
          {myProspects.length > 0 ? (
            <div className="mobile-card-grid">
              {myProspects.slice(0, 5).map(p => (
                <div key={p.id} className="mobile-card">
                  <div className="mobile-card-header">
                    <div className="mobile-card-title">{p.name}</div>
                    <span className="badge-status bg-primary">{p.status}</span>
                  </div>
                  <div className="mobile-card-body">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span className="mobile-card-label">Entreprise</span>
                      <span>{p.company || '-'}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px' }}>
                      <span className="mobile-card-label">Service</span>
                      <span>{p.serviceId || '-'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-muted)' }}>Aucun prospect.</p>
          )}
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
                    <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center' }}>
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
