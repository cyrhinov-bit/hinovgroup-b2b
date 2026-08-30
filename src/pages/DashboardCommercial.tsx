import { Target, Users, TrendingUp, Coins, Calendar, Trophy, Award, ArrowUpRight } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import './DashboardDirecteur.css';

export function DashboardCommercial() {
  const { currentUser } = useAuth();
  const { prospects, clients, commissions, prospectFollowUps, sales, objectifs, primes } = useAppContext();

  const myProspects = prospects.filter(p => p.commercialId === currentUser?.id);
  const myClients = clients.filter(c => c.commercialId === currentUser?.id);
  const myCommissions = commissions.filter(c => c.commercialId === currentUser?.id);
  const myPrimes = primes.filter(p => p.profileId === currentUser?.id);

  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  // My current objective
  const currentGoal = objectifs.find(o => {
    if (o.profileId !== currentUser?.id) return false;
    const gStart = new Date(o.startDate);
    const gEnd = new Date(o.endDate);
    return gStart <= currentMonthEnd && gEnd >= currentMonthStart;
  });

  // Sales in current month
  const myMonthSales = sales.filter(s => {
    if (s.commercialId !== currentUser?.id) return false;
    const sDate = new Date(s.date);
    return sDate >= currentMonthStart && sDate <= currentMonthEnd;
  });

  const monthRevenueHt = myMonthSales.reduce((sum, s) => sum + (s.subtotal || 0), 0);
  const monthMarginHt = myMonthSales.reduce((sum, s) => {
    const sCost = (s.lines || []).reduce((lSum, l) => lSum + ((l.costPrice || 0) * (l.quantity || 0)), 0);
    return sum + (s.subtotal - sCost);
  }, 0);

  const revGoal = currentGoal?.targetRevenueHt || 0;
  const revPct = revGoal > 0 ? Math.min(100, Math.round((monthRevenueHt / revGoal) * 100)) : 0;

  const totalProspects = myProspects.length;
  const convertedProspects = myProspects.filter(p => p.status === 'Converti').length;
  const conversionRate = totalProspects > 0 ? Math.round((convertedProspects / totalProspects) * 100) : 0;

  const pendingFollowUps = prospectFollowUps.filter(f => 
    f.status === 'En attente' && 
    myProspects.some(p => p.id === f.prospectId)
  ).sort((a, b) => a.date.localeCompare(b.date));

  const totalCommissions = myCommissions.reduce((sum, c) => sum + c.commissionAmount, 0);
  const totalPrimesValidees = myPrimes
    .filter(p => ['VALIDEE', 'PAYEE'].includes(p.status))
    .reduce((sum, p) => sum + p.amount, 0);

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

      {/* Ma Performance & Objectifs */}
      <div className="card" style={{ marginTop: '24px', padding: '1.25rem', background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Trophy size={20} color="#0D9488" />
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>Ma Performance du Mois</h3>
          </div>
          <Link to="/performance" style={{ fontSize: '0.82rem', color: '#0D9488', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}>
            Voir le classement complet <ArrowUpRight size={14} />
          </Link>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
          {/* Objectif CA */}
          <div style={{ background: '#ffffff', padding: '1rem', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#64748B', marginBottom: '4px' }}>
              <span>Objectif CA HT ({revPct}%)</span>
              <span className="font-bold text-teal-700">{monthRevenueHt.toLocaleString('fr-FR')} / {revGoal > 0 ? revGoal.toLocaleString('fr-FR') : 'Non défini'} F</span>
            </div>
            <div style={{ height: '8px', background: '#E2E8F0', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ height: '100%', background: '#0D9488', width: `${revPct}%`, borderRadius: '4px' }} />
            </div>
          </div>

          {/* Marge réalisée */}
          <div style={{ background: '#ffffff', padding: '1rem', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: '0.8rem', color: '#64748B', marginBottom: '4px' }}>Marge Brute HT Réalisée</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#059669' }}>
              {monthMarginHt.toLocaleString('fr-FR')} FCFA
            </div>
          </div>

          {/* Primes validées */}
          <div style={{ background: '#ffffff', padding: '1rem', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: '0.8rem', color: '#64748B', marginBottom: '4px' }}>Primes & Bonus Accordés</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#4F46E5' }}>
              {totalPrimesValidees.toLocaleString('fr-FR')} FCFA
            </div>
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
