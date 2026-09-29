import { useState, useMemo } from 'react';
import { 
  FileText, 
  CheckCircle, 
  Clock, 
  Users, 
  UserCheck, 
  ArrowUpRight, 
  Search, 
  Filter, 
  RotateCcw,
  Calendar,
  Building2,
  TrendingUp,
  BarChart3,
  PieChart as PieIcon,
  Layers,
  ChevronDown
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { 
  DonutChart, 
  BarComparisonChart, 
  TrendBarsChart, 
  UserAnalyticsCard,
  type DonutDataPoint,
  type BarComparisonItem,
  type TrendPeriodItem
} from '../components/analytics/DashboardCharts';
import './DashboardDirecteur.css';

type PeriodFilter = 'ALL' | 'TODAY' | '7_DAYS' | 'THIS_MONTH' | 'THIS_QUARTER' | 'THIS_YEAR';

export function DashboardDirecteur() {
  const { quotes, clients, services, users } = useAppContext();
  const navigate = useNavigate();

  // Filtres
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodFilter>('ALL');
  const [selectedUserFilter, setSelectedUserFilter] = useState<string>('ALL');
  const [selectedServiceFilter, setSelectedServiceFilter] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'USERS_ANALYTICS' | 'QUOTES_LIST'>('OVERVIEW');
  const [inspectedUserId, setInspectedUserId] = useState<string | null>(null);

  // Helper date parsing
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

  // Filtrage principal des devis
  const filteredQuotes = useMemo(() => {
    return quotes.filter(q => {
      // 1. Période
      if (!isDateInPeriod(q.date, selectedPeriod)) return false;

      // 2. Responsable / Commercial
      if (selectedUserFilter !== 'ALL') {
        const matchUser = q.commercialId === selectedUserFilter || 
          (!q.commercialId && users.find(u => u.id === selectedUserFilter)?.serviceId === q.serviceId);
        if (!matchUser) return false;
      }

      // 3. Service / Pôle
      if (selectedServiceFilter !== 'ALL' && q.serviceId !== selectedServiceFilter) {
        return false;
      }

      // 4. Statut
      if (selectedStatusFilter !== 'ALL') {
        if (selectedStatusFilter === 'EN_COURS') {
          if (q.status !== 'Envoyé' && q.status !== 'Brouillon' && q.status !== 'Révision') return false;
        } else if (q.status !== selectedStatusFilter) {
          return false;
        }
      }

      // 5. Recherche textuelle
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
  }, [quotes, selectedPeriod, selectedUserFilter, selectedServiceFilter, selectedStatusFilter, searchQuery, clients, users]);

  // Global KPIs calculés sur les données filtrées
  const totalQuotes = filteredQuotes.length;
  const acceptedQuotesList = filteredQuotes.filter(q => q.status === 'Accepté');
  const acceptedCount = acceptedQuotesList.length;
  const acceptedValue = acceptedQuotesList.reduce((acc, q) => acc + q.total, 0);

  const pendingQuotesList = filteredQuotes.filter(q => q.status === 'Envoyé' || q.status === 'Brouillon' || q.status === 'Révision');
  const pendingCount = pendingQuotesList.length;
  const pendingValue = pendingQuotesList.reduce((acc, q) => acc + q.total, 0);

  const refusedQuotesList = filteredQuotes.filter(q => q.status === 'Refusé');
  const refusedCount = refusedQuotesList.length;
  const refusedValue = refusedQuotesList.reduce((acc, q) => acc + q.total, 0);

  const totalValue = filteredQuotes.filter(q => q.status !== 'Refusé').reduce((acc, q) => acc + q.total, 0);
  const acceptanceRate = totalQuotes > 0 ? Math.round((acceptedCount / totalQuotes) * 100) : 0;
  const averageQuoteValue = totalQuotes > 0 ? Math.round(totalValue / totalQuotes) : 0;

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

  // Statistiques calculées par collaborateur (selon les filtres actuels ou globaux)
  const userStats = useMemo(() => {
    return users.map(u => {
      const uQuotes = filteredQuotes.filter(q => q.commercialId === u.id || (q.serviceId === u.serviceId && !q.commercialId));
      const uAccepted = uQuotes.filter(q => q.status === 'Accepté');
      const uPending = uQuotes.filter(q => q.status === 'Envoyé' || q.status === 'Brouillon' || q.status === 'Révision');
      const uRefused = uQuotes.filter(q => q.status === 'Refusé');
      const uTotalValue = uQuotes.filter(q => q.status !== 'Refusé').reduce((sum, q) => sum + q.total, 0);
      const uAcceptedValue = uAccepted.reduce((sum, q) => sum + q.total, 0);
      const uPendingValue = uPending.reduce((sum, q) => sum + q.total, 0);
      const uRefusedValue = uRefused.reduce((sum, q) => sum + q.total, 0);
      const uAcceptanceRate = uQuotes.length > 0 ? Math.round((uAccepted.length / uQuotes.length) * 100) : 0;
      const uAverageValue = uQuotes.length > 0 ? Math.round(uTotalValue / uQuotes.length) : 0;
      const uService = services.find(s => s.id === u.serviceId);

      return {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        serviceName: uService?.name || 'Direction / Tous services',
        quoteCount: uQuotes.length,
        acceptedCount: uAccepted.length,
        pendingCount: uPending.length,
        refusedCount: uRefused.length,
        totalValue: uTotalValue,
        acceptedValue: uAcceptedValue,
        pendingValue: uPendingValue,
        refusedValue: uRefusedValue,
        acceptanceRate: uAcceptanceRate,
        averageQuoteValue: uAverageValue
      };
    }).filter(u => u.quoteCount > 0 || u.role === 'Responsable' || u.role === 'Commercial' || u.role === 'Directeur')
      .sort((a, b) => b.totalValue - a.totalValue);
  }, [users, filteredQuotes, services]);

  // Donut chart data pour la répartition par statut
  const statusDonutData: DonutDataPoint[] = [
    { label: 'Acceptés', value: acceptedCount, color: '#10B981' },
    { label: 'En cours / Négoc.', value: pendingCount, color: '#F59E0B' },
    { label: 'Refusés', value: refusedCount, color: '#EF4444' },
    { label: 'Brouillons', value: filteredQuotes.filter(q => q.status === 'Brouillon').length, color: '#94A3B8' }
  ];

  // Bar Comparison Data par Responsable
  const barComparisonItems: BarComparisonItem[] = userStats.map(u => ({
    id: u.id,
    name: u.name,
    role: u.role,
    serviceName: u.serviceName,
    totalValue: u.totalValue,
    acceptedValue: u.acceptedValue,
    pendingValue: u.pendingValue,
    quoteCount: u.quoteCount,
    acceptedCount: u.acceptedCount,
    rate: u.acceptanceRate
  }));

  // Trend Data sur 6 derniers mois
  const trendData: TrendPeriodItem[] = useMemo(() => {
    const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
    const now = new Date();
    const result: TrendPeriodItem[] = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mIdx = d.getMonth();
      const yr = d.getFullYear();
      const label = `${months[mIdx]}`;

      const mQuotes = quotes.filter(q => {
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
  }, [quotes]);

  const resetFilters = () => {
    setSelectedPeriod('ALL');
    setSelectedUserFilter('ALL');
    setSelectedServiceFilter('ALL');
    setSelectedStatusFilter('ALL');
    setSearchQuery('');
    setInspectedUserId(null);
  };

  const hasActiveFilters = selectedPeriod !== 'ALL' || selectedUserFilter !== 'ALL' || selectedServiceFilter !== 'ALL' || selectedStatusFilter !== 'ALL' || searchQuery !== '';

  const inspectedUser = userStats.find(u => u.id === inspectedUserId);

  return (
    <div className="dashboard">
      {/* Header avec action de création */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(37, 99, 235, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563EB' }}>
              <TrendingUp size={24} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>Supervision Devis & Responsables</h2>
              <p style={{ margin: '4px 0 0', color: 'var(--color-text-muted)', fontSize: '0.88rem' }}>
                Pilotage analytique complet des devis, montants par pôle et performances individuelles.
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button 
            className="btn btn-primary" 
            onClick={() => navigate('/devis/nouveau')} 
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', fontWeight: 600 }}
          >
            + Nouveau Devis
          </button>
        </div>
      </div>

      {/* ─── FILTRES AVANCÉS & ÉLÉGANTS ────────────────────────── */}
      <div className="card" style={{ marginBottom: '24px', padding: '18px 20px', border: hasActiveFilters ? '1.5px solid rgba(37, 99, 235, 0.4)' : '1px solid var(--color-border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', fontWeight: 700 }}>
            <Filter size={16} color="var(--color-primary)" />
            <span>Filtres analytiques & Période</span>
            {hasActiveFilters && (
              <span className="badge-status" style={{ background: 'rgba(37, 99, 235, 0.12)', color: '#2563EB', fontSize: '11px' }}>
                Filtres actifs ({filteredQuotes.length} devis)
              </span>
            )}
          </div>

          {hasActiveFilters && (
            <button 
              className="btn btn-secondary" 
              onClick={resetFilters}
              style={{ fontSize: '0.8rem', padding: '5px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <RotateCcw size={13} />
              <span>Réinitialiser les filtres</span>
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
              placeholder="N° devis, client, sujet..."
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

          {/* Responsable / Collaborateur */}
          <div>
            <select
              className="table-input"
              style={{ width: '100%', fontSize: '0.85rem' }}
              value={selectedUserFilter}
              onChange={e => {
                setSelectedUserFilter(e.target.value);
                if (e.target.value !== 'ALL') {
                  setInspectedUserId(e.target.value);
                }
              }}
            >
              <option value="ALL">👤 Tous les responsables ({users.length})</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
              ))}
            </select>
          </div>

          {/* Service / Pôle */}
          <div>
            <select
              className="table-input"
              style={{ width: '100%', fontSize: '0.85rem' }}
              value={selectedServiceFilter}
              onChange={e => setSelectedServiceFilter(e.target.value)}
            >
              <option value="ALL">🏢 Tous les services / pôles</option>
              {services.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Statut Devis */}
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
              <option value="Brouillon">Brouillons uniquement</option>
            </select>
          </div>
        </div>
      </div>

      {/* ─── TOP KPI CARDS ÉLÉGANTES ─────────────────────────── */}
      <div className="widgets-grid" style={{ marginBottom: '24px' }}>
        <div className="widget-card" style={{ borderLeft: '4px solid #3B82F6' }}>
          <div className="widget-icon" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#2563EB' }}>
            <FileText size={26} />
          </div>
          <div className="widget-content">
            <div className="widget-label">DEVIS ÉMIS</div>
            <div className="widget-value">{totalQuotes}</div>
            <div style={{ fontSize: '0.8rem', color: '#2563EB', fontWeight: 700, marginTop: '2px' }}>
              {totalValue.toLocaleString('fr-FR')} FCFA
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
              Panier moyen : {averageQuoteValue.toLocaleString('fr-FR')} F
            </div>
          </div>
        </div>
        
        <div className="widget-card" style={{ borderLeft: '4px solid #10B981' }}>
          <div className="widget-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#059669' }}>
            <CheckCircle size={26} />
          </div>
          <div className="widget-content">
            <div className="widget-label">DEVIS ACCEPTÉS</div>
            <div className="widget-value" style={{ color: '#059669' }}>{acceptedCount}</div>
            <div style={{ fontSize: '0.8rem', color: '#059669', fontWeight: 700, marginTop: '2px' }}>
              {acceptedValue.toLocaleString('fr-FR')} FCFA
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
              Taux de conversion : <strong>{acceptanceRate}%</strong>
            </div>
          </div>
        </div>

        <div className="widget-card" style={{ borderLeft: '4px solid #F59E0B' }}>
          <div className="widget-icon" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#D97706' }}>
            <Clock size={26} />
          </div>
          <div className="widget-content">
            <div className="widget-label">EN NÉGOCIATION</div>
            <div className="widget-value" style={{ color: '#D97706' }}>{pendingCount}</div>
            <div style={{ fontSize: '0.8rem', color: '#D97706', fontWeight: 700, marginTop: '2px' }}>
              {pendingValue.toLocaleString('fr-FR')} FCFA
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
              Potentiel à convertir
            </div>
          </div>
        </div>

        <div className="widget-card" style={{ borderLeft: '4px solid #8B5CF6' }}>
          <div className="widget-icon" style={{ background: 'rgba(139, 92, 246, 0.1)', color: '#7C3AED' }}>
            <Users size={26} />
          </div>
          <div className="widget-content">
            <div className="widget-label">COLLABORATEURS</div>
            <div className="widget-value">{userStats.length}</div>
            <div style={{ fontSize: '0.8rem', color: '#7C3AED', fontWeight: 700, marginTop: '2px' }}>
              {services.length} Pôles d'activité
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
              Actifs sur les devis
            </div>
          </div>
        </div>
      </div>

      {/* ─── ONGLET DE NAVIGATION ENTRE VUES ─────────────────────── */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid var(--color-border)', paddingBottom: '10px', flexWrap: 'wrap' }}>
        <button
          className={`btn ${activeTab === 'OVERVIEW' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('OVERVIEW')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', padding: '8px 16px' }}
        >
          <BarChart3 size={16} />
          <span>Vue Globale & Diagrammes</span>
        </button>

        <button
          className={`btn ${activeTab === 'USERS_ANALYTICS' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('USERS_ANALYTICS')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', padding: '8px 16px' }}
        >
          <PieIcon size={16} />
          <span>Graphiques par Utilisateur ({userStats.length})</span>
        </button>

        <button
          className={`btn ${activeTab === 'QUOTES_LIST' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('QUOTES_LIST')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', padding: '8px 16px' }}
        >
          <FileText size={16} />
          <span>Liste détaillée des Devis ({filteredQuotes.length})</span>
        </button>
      </div>

      {/* ─── FOCUS COLLABORATEUR SÉLECTIONNÉ ────────────────────── */}
      {inspectedUser && (
        <div style={{ marginBottom: '24px' }}>
          <UserAnalyticsCard
            user={inspectedUser}
            stats={inspectedUser}
            onClose={() => setInspectedUserId(null)}
            onViewQuotes={() => {
              setSelectedUserFilter(inspectedUser.id);
              setActiveTab('QUOTES_LIST');
            }}
          />
        </div>
      )}

      {/* ─── CONTENU SELON L'ONGLET SÉLECTIONNÉ ─────────────────── */}
      {activeTab === 'OVERVIEW' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Grille des 2 premiers graphiques : Barres de performance et Donut de statut */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
            {/* Graphique 1 : Comparaison des montants par Responsable */}
            <div className="card" style={{ padding: '20px' }}>
              <BarComparisonChart
                items={barComparisonItems}
                title="Montants par Responsable / Auteur"
                subTitle="Comparatif volume émis vs volume validé (cliquez pour inspecter)"
                selectedUserId={inspectedUserId || undefined}
                onSelectUser={(uid) => setInspectedUserId(uid === inspectedUserId ? null : uid)}
              />
            </div>

            {/* Graphique 2 : Répartition des devis par Statut */}
            <div className="card" style={{ padding: '20px' }}>
              <DonutChart
                data={statusDonutData}
                title="Distribution des Devis par Statut"
                subTitle="Répartition globale des états commerciaux"
                centerLabel="Total devis"
                centerValue={totalQuotes}
                size={180}
                strokeWidth={24}
              />
            </div>
          </div>

          {/* Graphique 3 : Tendance temporelle & Tableau synthétique */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
            <div className="card" style={{ padding: '20px' }}>
              <TrendBarsChart
                data={trendData}
                title="Tendance d'activité (6 derniers mois)"
                subTitle="Évolution des volumes émis et encaissés"
              />
            </div>

            {/* Top Responsables Table */}
            <div className="card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>Classement & Taux de Succès</h4>
                  <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>Performances des responsables classées par montant</p>
                </div>
              </div>

              <div className="table-responsive">
                <table className="data-table responsive-table">
                  <thead>
                    <tr>
                      <th>Collaborateur</th>
                      <th style={{ textAlign: 'center' }}>Devis</th>
                      <th style={{ textAlign: 'right' }}>Montant Accepté</th>
                      <th style={{ textAlign: 'center' }}>Taux</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userStats.slice(0, 5).map(u => (
                      <tr 
                        key={u.id} 
                        style={{ cursor: 'pointer', background: inspectedUserId === u.id ? 'rgba(37, 99, 235, 0.05)' : undefined }}
                        onClick={() => setInspectedUserId(u.id === inspectedUserId ? null : u.id)}
                      >
                        <td>
                          <strong>{u.name}</strong>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{u.serviceName}</div>
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 600 }}>{u.quoteCount}</td>
                        <td style={{ textAlign: 'right', color: '#059669', fontWeight: 700 }}>
                          {u.acceptedValue.toLocaleString('fr-FR')} F
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className="badge-status" style={{ background: u.acceptanceRate >= 50 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)', color: u.acceptanceRate >= 50 ? '#059669' : '#D97706', fontSize: '11px', fontWeight: 700 }}>
                            {u.acceptanceRate}%
                          </span>
                        </td>
                      </tr>
                    ))}
                    {userStats.length === 0 && (
                      <tr><td colSpan={4} style={{ textAlign: 'center', padding: '16px', color: 'var(--color-text-muted)' }}>Aucune donnée.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── VUE ANALYTIQUE DÉTAILLÉE PAR UTILISATEUR ────────────── */}
      {activeTab === 'USERS_ANALYTICS' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
          {userStats.map(u => {
            const userDonut: DonutDataPoint[] = [
              { label: 'Acceptés', value: u.acceptedCount, color: '#10B981' },
              { label: 'En cours', value: u.pendingCount, color: '#F59E0B' },
              { label: 'Refusés', value: u.refusedCount, color: '#EF4444' }
            ];

            return (
              <div 
                key={u.id} 
                className="card" 
                style={{ 
                  padding: '20px', 
                  borderLeft: `4px solid ${u.acceptanceRate >= 50 ? '#10B981' : '#3B82F6'}`,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '16px'
                }}
              >
                <div>
                  {/* Entête collaborateur */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'var(--color-primary-tint)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '14px' }}>
                        {u.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700 }}>{u.name}</h4>
                        <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>{u.serviceName}</span>
                      </div>
                    </div>
                    <span className="badge-status bg-secondary" style={{ fontSize: '11px' }}>{u.role}</span>
                  </div>

                  {/* KPIs chiffrés */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px' }}>
                    <div style={{ padding: '8px 10px', background: 'var(--color-surface-alt)', borderRadius: '6px' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Total Émis</div>
                      <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)' }}>{u.totalValue.toLocaleString('fr-FR')} F</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{u.quoteCount} devis</div>
                    </div>

                    <div style={{ padding: '8px 10px', background: 'rgba(16, 185, 129, 0.08)', borderRadius: '6px' }}>
                      <div style={{ fontSize: '0.7rem', color: '#059669', textTransform: 'uppercase' }}>Total Accepté</div>
                      <div style={{ fontSize: '1rem', fontWeight: 700, color: '#059669' }}>{u.acceptedValue.toLocaleString('fr-FR')} F</div>
                      <div style={{ fontSize: '0.7rem', color: '#059669' }}>{u.acceptedCount} acceptés</div>
                    </div>
                  </div>

                  {/* Diagramme circulaire individuel */}
                  <div style={{ background: 'var(--color-surface)', padding: '10px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                    <DonutChart 
                      data={userDonut}
                      centerLabel="Succès"
                      centerValue={`${u.acceptanceRate}%`}
                      size={110}
                      strokeWidth={16}
                    />
                  </div>
                </div>

                {/* Bouton d'action */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '8px', borderTop: '1px solid var(--color-border)' }}>
                  <button 
                    className="btn btn-outline" 
                    style={{ fontSize: '0.8rem', padding: '5px 12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    onClick={() => {
                      setSelectedUserFilter(u.id);
                      setActiveTab('QUOTES_LIST');
                    }}
                  >
                    <span>Consulter ses devis</span>
                    <ArrowUpRight size={14} />
                  </button>
                </div>
              </div>
            );
          })}

          {userStats.length === 0 && (
            <div className="card" style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              Aucun collaborateur ne correspond aux critères de filtre.
            </div>
          )}
        </div>
      )}

      {/* ─── VUE LISTE COMPLÈTE DES DEVIS FILTRÉS ─────────────────── */}
      {activeTab === 'QUOTES_LIST' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ margin: 0 }}>Devis filtrés ({filteredQuotes.length})</h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', margin: '2px 0 0' }}>
                Cliquez sur un devis pour le consulter ou le modifier.
              </p>
            </div>
            
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '6px 12px' }} onClick={() => navigate('/devis/nouveau')}>
                + Nouveau devis
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
                {filteredQuotes.map(q => (
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
                {filteredQuotes.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)' }}>Aucun devis trouvé pour ces critères de filtre.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
