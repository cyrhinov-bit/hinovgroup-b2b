import { useState } from 'react';
import { FileText, DollarSign, CheckCircle, Clock, Users, Building2, TrendingUp, UserCheck, ArrowUpRight, Search } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import './DashboardDirecteur.css';

export function DashboardDirecteur() {
  const { quotes, clients, services, users } = useAppContext();
  const navigate = useNavigate();
  const [selectedUserFilter, setSelectedUserFilter] = useState<string>('all');

  const totalQuotes = quotes.length;
  const acceptedQuotesList = quotes.filter(q => q.status === 'Accepté');
  const acceptedCount = acceptedQuotesList.length;
  const acceptedValue = acceptedQuotesList.reduce((acc, q) => acc + q.total, 0);

  const pendingQuotesList = quotes.filter(q => q.status === 'Envoyé' || q.status === 'Brouillon' || q.status === 'Révision');
  const pendingCount = pendingQuotesList.length;
  const pendingValue = pendingQuotesList.reduce((acc, q) => acc + q.total, 0);

  const totalValue = quotes.filter(q => q.status !== 'Refusé').reduce((acc, q) => acc + q.total, 0);
  const acceptanceRate = totalQuotes > 0 ? Math.round((acceptedCount / totalQuotes) * 100) : 0;

  const getClientName = (id: string) => clients.find(c => c.id === id)?.name || 'Inconnu';
  const getServiceName = (id?: string) => services.find(s => s.id === id)?.name || 'Général';
  const getUserName = (id?: string) => users.find(u => u.id === id)?.name || 'Non assigné';

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

  // Group stats by User / Responsable / Collaborator
  const userStats = users.map(u => {
    const userQuotes = quotes.filter(q => q.commercialId === u.id || (q.serviceId === u.serviceId && !q.commercialId));
    const userAccepted = userQuotes.filter(q => q.status === 'Accepté');
    const userPending = userQuotes.filter(q => q.status === 'Envoyé' || q.status === 'Brouillon' || q.status === 'Révision');
    const userTotalValue = userQuotes.filter(q => q.status !== 'Refusé').reduce((sum, q) => sum + q.total, 0);
    const userAcceptedValue = userAccepted.reduce((sum, q) => sum + q.total, 0);
    const userPendingValue = userPending.reduce((sum, q) => sum + q.total, 0);
    const userAcceptanceRate = userQuotes.length > 0 ? Math.round((userAccepted.length / userQuotes.length) * 100) : 0;
    const userService = services.find(s => s.id === u.serviceId);

    return {
      id: u.id,
      name: u.name,
      role: u.role,
      serviceName: userService?.name || 'Direction / Tous services',
      quoteCount: userQuotes.length,
      acceptedCount: userAccepted.length,
      pendingCount: userPending.length,
      totalValue: userTotalValue,
      acceptedValue: userAcceptedValue,
      pendingValue: userPendingValue,
      acceptanceRate: userAcceptanceRate
    };
  }).filter(u => u.quoteCount > 0 || u.role === 'Responsable' || u.role === 'Commercial')
    .sort((a, b) => b.totalValue - a.totalValue);

  // Filtered recent quotes based on selected manager
  const displayedRecentQuotes = quotes.filter(q => {
    if (selectedUserFilter === 'all') return true;
    return q.commercialId === selectedUserFilter;
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 8);

  return (
    <div className="dashboard">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ margin: 0 }}>Supervision Direction — Devis & Responsables</h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', margin: '4px 0 0' }}>
            Consultez les devis et les montants générés par chaque responsable et pôle d'activité.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/devis/nouveau')} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          + Créer un devis
        </button>
      </div>
      
      {/* Top Global KPIs */}
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
            <div className="widget-label">EN COURS / NÉGOCIATION</div>
            <div className="widget-value">{pendingCount}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
              {pendingValue.toLocaleString('fr-FR')} FCFA en attente
            </div>
          </div>
        </div>

        <div className="widget-card">
          <div className="widget-icon bg-primary">
            <Users size={28} color="white" />
          </div>
          <div className="widget-content">
            <div className="widget-label">RESPONSABLES & COMMERCIAUX</div>
            <div className="widget-value">{userStats.length}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
              Collaborateurs actifs
            </div>
          </div>
        </div>
      </div>

      {/* Tableau détaillé : Devis & Montants par Responsable */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              <UserCheck size={20} color="var(--color-primary)" />
              Suivi des Devis & Montants par Responsable
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', margin: '4px 0 0' }}>
              Détail des volumes émis, montants acceptés et taux de réussite par collaborateur.
            </p>
          </div>
        </div>

        <div className="table-responsive">
          <table className="data-table responsive-table">
            <thead>
              <tr>
                <th>Responsable / Auteur</th>
                <th>Rôle & Pôle</th>
                <th style={{ textAlign: 'center' }}>Devis Émis</th>
                <th style={{ textAlign: 'right' }}>Montant Total Émis</th>
                <th style={{ textAlign: 'center' }}>Acceptés</th>
                <th style={{ textAlign: 'right' }}>Montant Accepté</th>
                <th style={{ textAlign: 'center' }}>Taux Succès</th>
                <th style={{ textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {userStats.map(u => (
                <tr key={u.id}>
                  <td data-label="Responsable">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--color-primary-tint)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '13px' }}>
                        {u.name.substring(0, 2).toUpperCase()}
                      </div>
                      <strong>{u.name}</strong>
                    </div>
                  </td>
                  <td data-label="Pôle">
                    <div><span className="badge-status bg-secondary" style={{ fontSize: '0.75rem' }}>{u.role}</span></div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>{u.serviceName}</div>
                  </td>
                  <td data-label="Devis Émis" style={{ textAlign: 'center', fontWeight: 600 }}>
                    {u.quoteCount}
                  </td>
                  <td data-label="Montant Total Émis" style={{ textAlign: 'right', fontWeight: 700 }}>
                    {u.totalValue.toLocaleString('fr-FR')} FCFA
                  </td>
                  <td data-label="Acceptés" style={{ textAlign: 'center', color: 'var(--color-success)', fontWeight: 700 }}>
                    {u.acceptedCount}
                  </td>
                  <td data-label="Montant Accepté" style={{ textAlign: 'right', color: 'var(--color-success)', fontWeight: 700 }}>
                    {u.acceptedValue.toLocaleString('fr-FR')} FCFA
                  </td>
                  <td data-label="Taux Succès" style={{ textAlign: 'center' }}>
                    <span className="badge-status bg-success" style={{ fontWeight: 600 }}>{u.acceptanceRate}%</span>
                  </td>
                  <td data-label="Action" style={{ textAlign: 'center' }}>
                    <button 
                      className="btn btn-outline" 
                      style={{ fontSize: '0.78rem', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      onClick={() => navigate(`/devis?authorId=${u.id}`)}
                      title={`Consulter tous les devis de ${u.name}`}
                    >
                      <span>Voir devis</span>
                      <ArrowUpRight size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {userStats.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-muted)' }}>
                    Aucun responsable ou commercial n'a encore émis de devis.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Derniers devis émis avec sélecteur de responsable */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ margin: 0 }}>Derniers devis enregistrés</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', margin: '2px 0 0' }}>
              {selectedUserFilter === 'all' ? 'Affichage de tous les collaborateurs' : `Filtré sur : ${getUserName(selectedUserFilter)}`}
            </p>
          </div>
          
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select 
              className="table-input" 
              style={{ fontSize: '0.85rem', padding: '6px 10px' }}
              value={selectedUserFilter}
              onChange={e => setSelectedUserFilter(e.target.value)}
            >
              <option value="all">Tous les responsables</option>
              {userStats.map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.quoteCount} devis)</option>
              ))}
            </select>
            <button className="btn btn-outline" style={{ fontSize: '0.8rem', padding: '6px 12px' }} onClick={() => navigate('/devis')}>
              Liste complète →
            </button>
          </div>
        </div>

        <div className="table-responsive">
          <table className="data-table responsive-table">
            <thead>
              <tr>
                <th>N° Devis</th>
                <th>Client</th>
                <th>Auteur / Responsable</th>
                <th>Service</th>
                <th>Sujet</th>
                <th style={{ textAlign: 'right' }}>Montant Total</th>
                <th>Statut</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {displayedRecentQuotes.map(q => (
                <tr key={q.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/devis/nouveau?editId=${q.id}`)}>
                  <td data-label="N° Devis"><strong style={{ color: 'var(--color-primary)' }}>{q.quoteNumber}</strong></td>
                  <td data-label="Client">{getClientName(q.clientId)}</td>
                  <td data-label="Auteur">
                    <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{getUserName(q.commercialId)}</span>
                  </td>
                  <td data-label="Service" style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>{getServiceName(q.serviceId)}</td>
                  <td data-label="Sujet">{q.subject}</td>
                  <td data-label="Montant Total" style={{ textAlign: 'right', fontWeight: 700 }}>{q.total.toLocaleString('fr-FR')} FCFA</td>
                  <td data-label="Statut"><span className={`badge-status ${getBadgeColor(q.status)}`}>{q.status}</span></td>
                  <td data-label="Date">{q.date}</td>
                </tr>
              ))}
              {displayedRecentQuotes.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-muted)' }}>Aucun devis trouvé.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
