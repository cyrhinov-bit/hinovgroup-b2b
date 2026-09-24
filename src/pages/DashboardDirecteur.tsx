import { FileText, DollarSign, CheckCircle, Clock, Users, Building2, TrendingUp, XCircle } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import './DashboardDirecteur.css';

export function DashboardDirecteur() {
  const { quotes, clients, services } = useAppContext();
  const navigate = useNavigate();

  const totalQuotes = quotes.length;
  const acceptedQuotesList = quotes.filter(q => q.status === 'Accepté');
  const acceptedCount = acceptedQuotesList.length;
  const acceptedValue = acceptedQuotesList.reduce((acc, q) => acc + q.total, 0);

  const pendingQuotesList = quotes.filter(q => q.status === 'Envoyé' || q.status === 'Brouillon' || q.status === 'Révision');
  const pendingCount = pendingQuotesList.length;
  const pendingValue = pendingQuotesList.reduce((acc, q) => acc + q.total, 0);

  const refusedCount = quotes.filter(q => q.status === 'Refusé').length;
  const totalValue = quotes.filter(q => q.status !== 'Refusé').reduce((acc, q) => acc + q.total, 0);
  const acceptanceRate = totalQuotes > 0 ? Math.round((acceptedCount / totalQuotes) * 100) : 0;

  const getClientName = (id: string) => clients.find(c => c.id === id)?.name || 'Inconnu';
  const getServiceName = (id?: string) => services.find(s => s.id === id)?.name || 'Général';

  const getBadgeColor = (status: string) => {
    switch (status) {
      case 'Accepté': return 'bg-success';
      case 'Refusé': return 'bg-error';
      case 'Envoyé': return 'bg-primary';
      case 'Brouillon': return 'bg-secondary';
      case 'Révision': return 'bg-warning';
      default: return '';
    }
  };

  const recentQuotes = [...quotes].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 6);

  // Group by service
  const serviceStats = services.map(s => {
    const sQuotes = quotes.filter(q => q.serviceId === s.id);
    const sAccepted = sQuotes.filter(q => q.status === 'Accepté');
    const sTotal = sQuotes.filter(q => q.status !== 'Refusé').reduce((sum, q) => sum + q.total, 0);
    return {
      id: s.id,
      name: s.name,
      count: sQuotes.length,
      acceptedCount: sAccepted.length,
      totalValue: sTotal
    };
  }).filter(s => s.count > 0);

  return (
    <div className="dashboard">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ margin: 0 }}>Tableau de bord - Devis & Pôles</h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', margin: '4px 0 0' }}>
            Suivi en temps réel des propositions commerciales et performances par service.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/devis/nouveau')}>
          + Créer un devis
        </button>
      </div>
      
      <div className="widgets-grid">
        <div className="widget-card">
          <div className="widget-icon bg-info">
            <FileText size={28} color="white" />
          </div>
          <div className="widget-content">
            <div className="widget-label">TOTAL DEVIS ÉMIS</div>
            <div className="widget-value">{totalQuotes}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
              {totalValue.toLocaleString('fr-FR')} FCFA cumulés
            </div>
          </div>
        </div>
        
        <div className="widget-card">
          <div className="widget-icon bg-success">
            <CheckCircle size={28} color="white" />
          </div>
          <div className="widget-content">
            <div className="widget-label">DEVIS ACCEPTÉS</div>
            <div className="widget-value" style={{ color: 'var(--color-success)' }}>{acceptedCount}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-success)', marginTop: '2px', fontWeight: 600 }}>
              {acceptedValue.toLocaleString('fr-FR')} FCFA ({acceptanceRate}%)
            </div>
          </div>
        </div>

        <div className="widget-card">
          <div className="widget-icon bg-warning">
            <Clock size={28} color="white" />
          </div>
          <div className="widget-content">
            <div className="widget-label">EN ATTENTE / RÉVISION</div>
            <div className="widget-value">{pendingCount}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
              {pendingValue.toLocaleString('fr-FR')} FCFA en négociation
            </div>
          </div>
        </div>

        <div className="widget-card">
          <div className="widget-icon bg-primary">
            <Users size={28} color="white" />
          </div>
          <div className="widget-content">
            <div className="widget-label">PORTEFEUILLE CLIENTS</div>
            <div className="widget-value">{clients.length}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
              Clients actifs enregistrés
            </div>
          </div>
        </div>
      </div>

      {/* Services breakdown */}
      {serviceStats.length > 0 && (
        <div className="card" style={{ marginBottom: '24px' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 16px' }}>
            <Building2 size={18} color="var(--color-primary)" />
            Répartition des devis par Pôle de Service
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            {serviceStats.map(s => (
              <div key={s.id} style={{ background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '14px' }}>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '6px' }}>{s.name}</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-primary)' }}>
                  {s.totalValue.toLocaleString('fr-FR')} FCFA
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '6px' }}>
                  <span>{s.count} devis émis</span>
                  <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>{s.acceptedCount} acceptés</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent quotes */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0 }}>Derniers devis émis</h3>
          <button className="btn btn-outline" style={{ fontSize: '0.8rem', padding: '4px 12px' }} onClick={() => navigate('/devis')}>
            Voir tous les devis →
          </button>
        </div>
        <div className="table-responsive">
          <table className="data-table responsive-table">
            <thead>
              <tr>
                <th>N° Devis</th>
                <th>Client</th>
                <th>Service</th>
                <th>Sujet</th>
                <th style={{ textAlign: 'right' }}>Montant Total</th>
                <th>Statut</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {recentQuotes.map(q => (
                <tr key={q.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/devis/nouveau?editId=${q.id}`)}>
                  <td data-label="N° Devis"><strong>{q.quoteNumber}</strong></td>
                  <td data-label="Client">{getClientName(q.clientId)}</td>
                  <td data-label="Service" style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>{getServiceName(q.serviceId)}</td>
                  <td data-label="Sujet">{q.subject}</td>
                  <td data-label="Montant Total" style={{ textAlign: 'right', fontWeight: 700 }}>{q.total.toLocaleString('fr-FR')} FCFA</td>
                  <td data-label="Statut"><span className={`badge-status ${getBadgeColor(q.status)}`}>{q.status}</span></td>
                  <td data-label="Date">{q.date}</td>
                </tr>
              ))}
              {recentQuotes.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-muted)' }}>Aucun devis créé pour l'instant.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
