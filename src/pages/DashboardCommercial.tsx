import { FileText, Users, CheckCircle, Clock, Plus } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import './DashboardDirecteur.css';

export function DashboardCommercial() {
  const { currentUser } = useAuth();
  const { quotes, clients } = useAppContext();
  const navigate = useNavigate();

  const myQuotes = quotes.filter(q => q.commercialId === currentUser?.id || q.serviceId === currentUser?.serviceId);
  const myClients = clients.filter(c => c.commercialId === currentUser?.id);

  const totalQuotes = myQuotes.length;
  const acceptedQuotes = myQuotes.filter(q => q.status === 'Accepté');
  const acceptedCount = acceptedQuotes.length;
  const acceptedValue = acceptedQuotes.reduce((sum, q) => sum + q.total, 0);

  const pendingQuotes = myQuotes.filter(q => q.status === 'Envoyé' || q.status === 'Brouillon' || q.status === 'Révision');
  const pendingCount = pendingQuotes.length;
  const pendingValue = pendingQuotes.reduce((sum, q) => sum + q.total, 0);

  const totalValue = myQuotes.filter(q => q.status !== 'Refusé').reduce((sum, q) => sum + q.total, 0);
  const conversionRate = totalQuotes > 0 ? Math.round((acceptedCount / totalQuotes) * 100) : 0;

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

  const recentQuotes = [...myQuotes].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 6);

  return (
    <div className="dashboard">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ margin: 0 }}>Espace Commercial - Mes Devis</h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', margin: '4px 0 0' }}>
            Bienvenue {currentUser?.name}. Gérez vos devis et propositions clients.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/devis/nouveau')} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Plus size={16} /> Créer un devis
        </button>
      </div>
      
      <div className="widgets-grid">
        <div className="widget-card">
          <div className="widget-icon bg-info">
            <FileText size={28} color="white" />
          </div>
          <div className="widget-content">
            <div className="widget-label">MES DEVIS CRÉÉS</div>
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
              {acceptedValue.toLocaleString('fr-FR')} FCFA ({conversionRate}%)
            </div>
          </div>
        </div>

        <div className="widget-card">
          <div className="widget-icon bg-warning">
            <Clock size={28} color="white" />
          </div>
          <div className="widget-content">
            <div className="widget-label">DEVIS EN NÉGOCIATION</div>
            <div className="widget-value">{pendingCount}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
              {pendingValue.toLocaleString('fr-FR')} FCFA en cours
            </div>
          </div>
        </div>

        <div className="widget-card">
          <div className="widget-icon bg-primary">
            <Users size={28} color="white" />
          </div>
          <div className="widget-content">
            <div className="widget-label">CLIENTS APPORTÉS</div>
            <div className="widget-value">{myClients.length}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
              Portefeuille personnel
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0 }}>Mes derniers devis</h3>
          <button className="btn btn-outline" style={{ fontSize: '0.8rem', padding: '4px 12px' }} onClick={() => navigate('/devis')}>
            Consulter la liste complète →
          </button>
        </div>
        <div className="table-responsive">
          <table className="data-table responsive-table">
            <thead>
              <tr>
                <th>N° Devis</th>
                <th>Client</th>
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
                  <td data-label="Sujet">{q.subject}</td>
                  <td data-label="Montant Total" style={{ textAlign: 'right', fontWeight: 700 }}>{q.total.toLocaleString('fr-FR')} FCFA</td>
                  <td data-label="Statut"><span className={`badge-status ${getBadgeColor(q.status)}`}>{q.status}</span></td>
                  <td data-label="Date">{q.date}</td>
                </tr>
              ))}
              {recentQuotes.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-muted)' }}>
                    Aucun devis créé pour l'instant.
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
