import { FileText, Briefcase, Clock, Percent, Building2, Users, CheckCircle, Eye } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import './DashboardDirecteur.css'; 

export function DashboardResponsable() {
  const { quotes, prestations, clients, services, users } = useAppContext();
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const currentService = services.find(s => s.id === currentUser?.serviceId);
  const serviceName = currentService?.name || 'Mon Service';

  const serviceQuotes = quotes.filter(q => q.serviceId === currentUser?.serviceId);
  const servicePrestations = prestations.filter(p => p.serviceId === currentUser?.serviceId);
  const serviceCommercials = users.filter(u => u.serviceId === currentUser?.serviceId && (u.role === 'Commercial' || u.role === 'Responsable'));

  const totalQuotes = serviceQuotes.length;
  const toReviewQuotes = serviceQuotes.filter(q => q.status === 'Brouillon' || q.status === 'Envoyé' || q.status === 'Révision').length;
  const acceptedQuotes = serviceQuotes.filter(q => q.status === 'Accepté').length;
  const acceptanceRate = totalQuotes > 0 ? Math.round((acceptedQuotes / totalQuotes) * 100) : 0;
  const totalPrestations = servicePrestations.length;
  const totalValue = serviceQuotes.filter(q => q.status !== 'Refusé').reduce((sum, q) => sum + q.total, 0);

  const getClientName = (id: string) => clients.find(c => c.id === id)?.name || 'Inconnu';

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

  const recentServiceQuotes = [...serviceQuotes].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 6);

  return (
    <div className="dashboard">
      {/* Hero Banner du Service */}
      <div className="responsable-hero-banner">
        <div className="hero-badge">
          <Building2 size={15} />
          <span>PÔLE D'ACTIVITÉ & GESTION DES DEVIS</span>
        </div>
        <h1 className="hero-title">{serviceName}</h1>
        <p className="hero-subtitle">
          {currentService?.description || 'Vue globale des devis et prestations de votre pôle.'}
        </p>
        <div className="hero-meta-tags">
          <span className="hero-tag">
            <Users size={14} color="var(--color-primary)" />
            <strong>{serviceCommercials.length}</strong> Collaborateur(s)
          </span>
          <span className="hero-tag">
            <Briefcase size={14} color="var(--color-primary)" />
            <strong>{totalPrestations}</strong> Prestation(s) active(s)
          </span>
          <span className="hero-tag">
            <FileText size={14} color="var(--color-primary)" />
            <strong>{totalQuotes}</strong> Devis émis
          </span>
        </div>
      </div>
      
      <div className="widgets-grid">
        <div className="widget-card">
          <div className="widget-icon bg-info">
            <FileText size={28} color="white" />
          </div>
          <div className="widget-content">
            <div className="widget-label">DEVIS DU PÔLE</div>
            <div className="widget-value">{totalQuotes}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
              {totalValue.toLocaleString('fr-FR')} FCFA
            </div>
          </div>
        </div>
        
        <div className="widget-card">
          <div className="widget-icon bg-success">
            <CheckCircle size={28} color="white" />
          </div>
          <div className="widget-content">
            <div className="widget-label">DEVIS ACCEPTÉS</div>
            <div className="widget-value" style={{ color: 'var(--color-success)' }}>{acceptedQuotes}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-success)', marginTop: '2px', fontWeight: 600 }}>
              {acceptanceRate}% de conversion
            </div>
          </div>
        </div>

        <div className="widget-card">
          <div className="widget-icon bg-warning">
            <Clock size={28} color="white" />
          </div>
          <div className="widget-content">
            <div className="widget-label">DEVIS EN COURS</div>
            <div className="widget-value">{toReviewQuotes}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
              En attente ou révision
            </div>
          </div>
        </div>

        <div className="widget-card">
          <div className="widget-icon bg-primary">
            <Briefcase size={28} color="white" />
          </div>
          <div className="widget-content">
            <div className="widget-label">CATALOGUE PRESTATIONS</div>
            <div className="widget-value">{totalPrestations}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
              Prestations tarifées
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0 }}>Derniers devis du pôle {serviceName}</h3>
          <button className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '6px 14px' }} onClick={() => navigate(`/devis/nouveau?serviceId=${currentUser?.serviceId}`)}>
            + Créer un devis
          </button>
        </div>
        <div className="table-responsive">
          <table className="data-table responsive-table">
            <thead>
              <tr>
                <th>N° Devis</th>
                <th>Client</th>
                <th>Sujet</th>
                <th style={{ textAlign: 'right' }}>Montant</th>
                <th>Statut</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {recentServiceQuotes.map(q => (
                <tr key={q.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/devis/nouveau?editId=${q.id}`)}>
                  <td data-label="N° Devis"><strong>{q.quoteNumber}</strong></td>
                  <td data-label="Client">{getClientName(q.clientId)}</td>
                  <td data-label="Sujet">{q.subject}</td>
                  <td data-label="Montant" style={{ textAlign: 'right', fontWeight: 700 }}>{q.total.toLocaleString('fr-FR')} FCFA</td>
                  <td data-label="Statut"><span className={`badge-status ${getBadgeColor(q.status)}`}>{q.status}</span></td>
                  <td data-label="Date">{q.date}</td>
                </tr>
              ))}
              {recentServiceQuotes.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-muted)' }}>
                    Aucun devis émis pour ce pôle.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
