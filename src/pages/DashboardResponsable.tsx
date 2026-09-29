import { useState, useMemo } from 'react';
import { 
  FileText, 
  Briefcase, 
  Clock, 
  Building2, 
  Users, 
  CheckCircle, 
  Filter, 
  RotateCcw, 
  Search,
  ArrowUpRight,
  TrendingUp,
  BarChart3
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  DonutChart, 
  BarComparisonChart, 
  TrendBarsChart,
  type DonutDataPoint,
  type BarComparisonItem,
  type TrendPeriodItem
} from '../components/analytics/DashboardCharts';
import './DashboardDirecteur.css'; 

type PeriodFilter = 'ALL' | 'TODAY' | '7_DAYS' | 'THIS_MONTH' | 'THIS_QUARTER' | 'THIS_YEAR';

export function DashboardResponsable() {
  const { quotes, prestations, clients, services, users } = useAppContext();
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [selectedPeriod, setSelectedPeriod] = useState<PeriodFilter>('ALL');
  const [selectedCommercialFilter, setSelectedCommercialFilter] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const currentService = services.find(s => s.id === currentUser?.serviceId);
  const serviceName = currentService?.name || 'Mon Service';

  const isDateInPeriod = (dateStr: string, period: PeriodFilter): boolean => {
    if (period === 'ALL') return true;
    if (!dateStr) return false;
    
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return true;
    const now = new Date();
    
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (period) {
      case 'TODAY':
        return d >= startOfToday;
      case '7_DAYS': {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return d >= weekAgo;
      }
      case 'THIS_MONTH':
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      case 'THIS_QUARTER': {
        const currentQuarter = Math.floor(now.getMonth() / 3);
        const itemQuarter = Math.floor(d.getMonth() / 3);
        return itemQuarter === currentQuarter && d.getFullYear() === now.getFullYear();
      }
      case 'THIS_YEAR':
        return d.getFullYear() === now.getFullYear();
      default:
        return true;
    }
  };

  const rawServiceQuotes = useMemo(() => {
    return quotes.filter(q => q.serviceId === currentUser?.serviceId);
  }, [quotes, currentUser?.serviceId]);

  const filteredServiceQuotes = useMemo(() => {
    return rawServiceQuotes.filter(q => {
      if (!isDateInPeriod(q.date, selectedPeriod)) return false;

      if (selectedCommercialFilter !== 'ALL' && q.commercialId !== selectedCommercialFilter) {
        return false;
      }

      if (selectedStatusFilter !== 'ALL') {
        if (selectedStatusFilter === 'EN_COURS') {
          if (q.status !== 'Envoyé' && q.status !== 'Brouillon' && q.status !== 'Révision') return false;
        } else if (q.status !== selectedStatusFilter) {
          return false;
        }
      }

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const clientName = (clients.find(c => c.id === q.clientId)?.name || '').toLowerCase();
        const authorName = (users.find(u => u.id === q.commercialId)?.name || '').toLowerCase();
        const subject = (q.subject || '').toLowerCase();
        const qNum = (q.quoteNumber || '').toLowerCase();

        if (!clientName.includes(query) && !authorName.includes(query) && !subject.includes(query) && !qNum.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [rawServiceQuotes, selectedPeriod, selectedCommercialFilter, selectedStatusFilter, searchQuery, clients, users]);

  const servicePrestations = prestations.filter(p => p.serviceId === currentUser?.serviceId);
  const serviceCommercials = users.filter(u => u.serviceId === currentUser?.serviceId && (u.role === 'Commercial' || u.role === 'Responsable'));

  const totalQuotes = filteredServiceQuotes.length;
  const acceptedQuotes = filteredServiceQuotes.filter(q => q.status === 'Accepté').length;
  const acceptedValue = filteredServiceQuotes.filter(q => q.status === 'Accepté').reduce((sum, q) => sum + q.total, 0);
  const toReviewQuotes = filteredServiceQuotes.filter(q => q.status === 'Brouillon' || q.status === 'Envoyé' || q.status === 'Révision').length;
  const toReviewValue = filteredServiceQuotes.filter(q => q.status === 'Brouillon' || q.status === 'Envoyé' || q.status === 'Révision').reduce((sum, q) => sum + q.total, 0);
  const refusedCount = filteredServiceQuotes.filter(q => q.status === 'Refusé').length;
  const totalValue = filteredServiceQuotes.filter(q => q.status !== 'Refusé').reduce((sum, q) => sum + q.total, 0);
  const acceptanceRate = totalQuotes > 0 ? Math.round((acceptedQuotes / totalQuotes) * 100) : 0;
  const totalPrestations = servicePrestations.length;

  const getClientName = (id: string) => clients.find(c => c.id === id)?.name || 'Inconnu';
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

  // Donut data
  const statusDonutData: DonutDataPoint[] = [
    { label: 'Acceptés', value: acceptedQuotes, color: '#10B981' },
    { label: 'En cours', value: toReviewQuotes, color: '#F59E0B' },
    { label: 'Refusés', value: refusedCount, color: '#EF4444' }
  ];

  // Collaborators in this service
  const serviceMemberStats: BarComparisonItem[] = serviceCommercials.map(u => {
    const uQuotes = filteredServiceQuotes.filter(q => q.commercialId === u.id);
    const uAccepted = uQuotes.filter(q => q.status === 'Accepté');
    const uPending = uQuotes.filter(q => q.status === 'Envoyé' || q.status === 'Brouillon' || q.status === 'Révision');
    const uTotalValue = uQuotes.filter(q => q.status !== 'Refusé').reduce((sum, q) => sum + q.total, 0);
    const uAcceptedValue = uAccepted.reduce((sum, q) => sum + q.total, 0);
    const uPendingValue = uPending.reduce((sum, q) => sum + q.total, 0);
    const uRate = uQuotes.length > 0 ? Math.round((uAccepted.length / uQuotes.length) * 100) : 0;

    return {
      id: u.id,
      name: u.name,
      role: u.role,
      serviceName: serviceName,
      totalValue: uTotalValue,
      acceptedValue: uAcceptedValue,
      pendingValue: uPendingValue,
      quoteCount: uQuotes.length,
      acceptedCount: uAccepted.length,
      rate: uRate
    };
  }).filter(u => u.quoteCount > 0 || u.role === 'Commercial' || u.role === 'Responsable')
    .sort((a, b) => b.totalValue - a.totalValue);

  // 6 months trend for this service
  const trendData: TrendPeriodItem[] = useMemo(() => {
    const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
    const now = new Date();
    const result: TrendPeriodItem[] = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mIdx = d.getMonth();
      const yr = d.getFullYear();
      const label = `${months[mIdx]}`;

      const mQuotes = rawServiceQuotes.filter(q => {
        if (!q.date) return false;
        const qd = new Date(q.date);
        return qd.getMonth() === mIdx && qd.getFullYear() === yr;
      });

      const mTotal = mQuotes.reduce((sum, q) => sum + q.total, 0);
      const mAccepted = mQuotes.filter(q => q.status === 'Accepté').reduce((sum, q) => sum + q.total, 0);

      result.push({
        period: label,
        total: mTotal,
        accepted: mAccepted,
        count: mQuotes.length
      });
    }

    return result;
  }, [rawServiceQuotes]);

  const hasActiveFilters = selectedPeriod !== 'ALL' || selectedCommercialFilter !== 'ALL' || selectedStatusFilter !== 'ALL' || searchQuery !== '';

  const resetFilters = () => {
    setSelectedPeriod('ALL');
    setSelectedCommercialFilter('ALL');
    setSelectedStatusFilter('ALL');
    setSearchQuery('');
  };

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
          {currentService?.description || 'Vue globale des devis et prestations de votre pôle d\'activité.'}
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
            <strong>{rawServiceQuotes.length}</strong> Devis enregistrés
          </span>
        </div>
      </div>

      {/* ─── FILTRES RESPONSABLE ─────────────────────────────── */}
      <div className="card" style={{ marginBottom: '24px', padding: '16px 20px', border: hasActiveFilters ? '1.5px solid rgba(37, 99, 235, 0.4)' : '1px solid var(--color-border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', fontWeight: 700 }}>
            <Filter size={16} color="var(--color-primary)" />
            <span>Filtres de supervision du pôle</span>
            {hasActiveFilters && (
              <span className="badge-status" style={{ background: 'rgba(37, 99, 235, 0.12)', color: '#2563EB', fontSize: '11px' }}>
                {filteredServiceQuotes.length} devis affichés
              </span>
            )}
          </div>

          {hasActiveFilters && (
            <button 
              className="btn btn-secondary" 
              onClick={resetFilters}
              style={{ fontSize: '0.8rem', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <RotateCcw size={12} />
              <span>Réinitialiser</span>
            </button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', alignItems: 'center' }}>
          {/* Recherche */}
          <div style={{ position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
            <input
              type="text"
              className="table-input"
              style={{ paddingLeft: '32px', width: '100%', fontSize: '0.85rem' }}
              placeholder="Rechercher client, sujet, N°..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Période */}
          <div>
            <select
              className="table-input"
              style={{ width: '100%', fontSize: '0.85rem' }}
              value={selectedPeriod}
              onChange={e => setSelectedPeriod(e.target.value as PeriodFilter)}
            >
              <option value="ALL">📅 Toute la période</option>
              <option value="TODAY">Aujourd'hui</option>
              <option value="7_DAYS">7 derniers jours</option>
              <option value="THIS_MONTH">Ce mois-ci</option>
              <option value="THIS_QUARTER">Ce trimestre</option>
              <option value="THIS_YEAR">Cette année</option>
            </select>
          </div>

          {/* Collaborateur du service */}
          <div>
            <select
              className="table-input"
              style={{ width: '100%', fontSize: '0.85rem' }}
              value={selectedCommercialFilter}
              onChange={e => setSelectedCommercialFilter(e.target.value)}
            >
              <option value="ALL">👤 Tous les collaborateurs du pôle</option>
              {serviceCommercials.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>

          {/* Statut */}
          <div>
            <select
              className="table-input"
              style={{ width: '100%', fontSize: '0.85rem' }}
              value={selectedStatusFilter}
              onChange={e => setSelectedStatusFilter(e.target.value)}
            >
              <option value="ALL">🏷️ Tous les statuts</option>
              <option value="Accepté">Acceptés</option>
              <option value="EN_COURS">En cours (Envoyé/Brouillon)</option>
              <option value="Révision">En Révision</option>
              <option value="Refusé">Refusés</option>
            </select>
          </div>
        </div>
      </div>
      
      {/* ─── TOP KPI CARDS ───────────────────────────────────── */}
      <div className="widgets-grid" style={{ marginBottom: '24px' }}>
        <div className="widget-card" style={{ borderLeft: '4px solid #3B82F6' }}>
          <div className="widget-icon" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#2563EB' }}>
            <FileText size={26} />
          </div>
          <div className="widget-content">
            <div className="widget-label">DEVIS DU PÔLE</div>
            <div className="widget-value">{totalQuotes}</div>
            <div style={{ fontSize: '0.8rem', color: '#2563EB', fontWeight: 700, marginTop: '2px' }}>
              {totalValue.toLocaleString('fr-FR')} FCFA
            </div>
          </div>
        </div>
        
        <div className="widget-card" style={{ borderLeft: '4px solid #10B981' }}>
          <div className="widget-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#059669' }}>
            <CheckCircle size={26} />
          </div>
          <div className="widget-content">
            <div className="widget-label">DEVIS ACCEPTÉS</div>
            <div className="widget-value" style={{ color: '#059669' }}>{acceptedQuotes}</div>
            <div style={{ fontSize: '0.8rem', color: '#059669', fontWeight: 700, marginTop: '2px' }}>
              {acceptedValue.toLocaleString('fr-FR')} FCFA ({acceptanceRate}%)
            </div>
          </div>
        </div>

        <div className="widget-card" style={{ borderLeft: '4px solid #F59E0B' }}>
          <div className="widget-icon" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#D97706' }}>
            <Clock size={26} />
          </div>
          <div className="widget-content">
            <div className="widget-label">DEVIS EN COURS</div>
            <div className="widget-value" style={{ color: '#D97706' }}>{toReviewQuotes}</div>
            <div style={{ fontSize: '0.8rem', color: '#D97706', fontWeight: 700, marginTop: '2px' }}>
              {toReviewValue.toLocaleString('fr-FR')} FCFA
            </div>
          </div>
        </div>

        <div className="widget-card" style={{ borderLeft: '4px solid #6366F1' }}>
          <div className="widget-icon" style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#4F46E5' }}>
            <Briefcase size={26} />
          </div>
          <div className="widget-content">
            <div className="widget-label">PRESTATIONS DU PÔLE</div>
            <div className="widget-value">{totalPrestations}</div>
            <div style={{ fontSize: '0.8rem', color: '#4F46E5', fontWeight: 700, marginTop: '2px' }}>
              Tarifées au catalogue
            </div>
          </div>
        </div>
      </div>

      {/* ─── GRAPHIQUES ANALYTIQUES DU PÔLE ──────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        {/* Graphique 1 : Répartition par Statut */}
        <div className="card" style={{ padding: '20px' }}>
          <DonutChart 
            data={statusDonutData}
            title="Distribution des Devis du Pôle"
            subTitle="Répartition par statut de validation"
            centerLabel="Devis émis"
            centerValue={totalQuotes}
            size={160}
            strokeWidth={22}
          />
        </div>

        {/* Graphique 2 : Tendance mensuelle */}
        <div className="card" style={{ padding: '20px' }}>
          <TrendBarsChart
            data={trendData}
            title="Évolution de l'activité du Pôle"
            subTitle="Volumes émis et validés sur les 6 derniers mois"
          />
        </div>
      </div>

      {/* Graphique 3 : Performance des membres du service */}
      {serviceMemberStats.length > 0 && (
        <div className="card" style={{ padding: '20px', marginBottom: '24px' }}>
          <BarComparisonChart
            items={serviceMemberStats}
            title="Performances des Collaborateurs du Pôle"
            subTitle="Montants émis vs montants acceptés par membre de l'équipe"
          />
        </div>
      )}

      {/* ─── TABLEAU DES DEVIS DU SERVICE ─────────────────────── */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ margin: 0 }}>Devis du pôle {serviceName} ({filteredServiceQuotes.length})</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', margin: '2px 0 0' }}>
              Consultez et suivez l'état d'avancement des devis émis.
            </p>
          </div>
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
                <th>Auteur</th>
                <th>Sujet</th>
                <th style={{ textAlign: 'right' }}>Montant</th>
                <th>Statut</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {filteredServiceQuotes.map(q => (
                <tr key={q.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/devis/nouveau?editId=${q.id}`)}>
                  <td data-label="N° Devis"><strong style={{ color: 'var(--color-primary)' }}>{q.quoteNumber}</strong></td>
                  <td data-label="Client">{getClientName(q.clientId)}</td>
                  <td data-label="Auteur">
                    <span style={{ fontWeight: 600 }}>{getUserName(q.commercialId)}</span>
                  </td>
                  <td data-label="Sujet">{q.subject}</td>
                  <td data-label="Montant" style={{ textAlign: 'right', fontWeight: 700 }}>{q.total.toLocaleString('fr-FR')} FCFA</td>
                  <td data-label="Statut"><span className={`badge-status ${getBadgeColor(q.status)}`}>{q.status}</span></td>
                  <td data-label="Date">{q.date}</td>
                </tr>
              ))}
              {filteredServiceQuotes.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-muted)' }}>
                    Aucun devis trouvé pour ces critères de filtre.
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
