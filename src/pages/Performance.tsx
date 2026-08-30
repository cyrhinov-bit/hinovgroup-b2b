import React, { useState, useMemo } from 'react';
import { 
  Trophy, Target, Award, Sliders, Plus, Filter, 
  TrendingUp, CheckCircle, XCircle, Clock, AlertTriangle, 
  History, DollarSign, Users, Briefcase, Eye, ArrowUpRight
} from 'lucide-react';
import { useAppContext, type PeriodType, type Prime, type Objectif } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../components/ConfirmModal';
import { ObjectifModal } from '../components/ObjectifModal';
import { PrimeModal } from '../components/PrimeModal';
import { PrimeAuditModal } from '../components/PrimeAuditModal';
import { ScoringRuleModal } from '../components/ScoringRuleModal';
import './Performance.css';

export function Performance() {
  const { 
    users, services, sales, affaires, prospects, quotes,
    scoringRules, objectifs, primes, deleteObjectif, 
    validatePrime, rejectPrime, payPrime 
  } = useAppContext();
  const { currentUser } = useAuth();
  const { confirm } = useConfirm();

  const [activeTab, setActiveTab] = useState<'classement' | 'objectifs' | 'primes'>('classement');
  const [selectedServiceId, setSelectedServiceId] = useState<string>('ALL');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('CURRENT_MONTH');

  // Modals state
  const [isObjectifModalOpen, setIsObjectifModalOpen] = useState(false);
  const [selectedObjectifToEdit, setSelectedObjectifToEdit] = useState<Objectif | null>(null);
  const [isPrimeModalOpen, setIsPrimeModalOpen] = useState(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [selectedPrimeForAudit, setSelectedPrimeForAudit] = useState<Prime | null>(null);
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);

  // Compute current date intervals
  const dateInterval = useMemo(() => {
    const now = new Date();
    if (selectedPeriod === 'CURRENT_MONTH') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      return { start, end, label: `Mois en cours (${now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })})` };
    } else if (selectedPeriod === 'CURRENT_QUARTER') {
      const q = Math.floor(now.getMonth() / 3);
      const start = new Date(now.getFullYear(), q * 3, 1);
      const end = new Date(now.getFullYear(), (q + 1) * 3, 0, 23, 59, 59);
      return { start, end, label: `T${q + 1} ${now.getFullYear()}` };
    } else if (selectedPeriod === 'CURRENT_YEAR') {
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
      return { start, end, label: `Année ${now.getFullYear()}` };
    }
    return { start: new Date(2020, 0, 1), end: new Date(2030, 11, 31), label: 'Historique Complet' };
  }, [selectedPeriod]);

  // Commercials list
  const commercials = useMemo(() => {
    return users.filter(u => {
      const isCommRole = ['Commercial', 'Responsable', 'Directeur'].includes(u.role);
      const matchService = selectedServiceId === 'ALL' || u.serviceId === selectedServiceId;
      return isCommRole && matchService && u.active !== false;
    });
  }, [users, selectedServiceId]);

  // Active scoring rule
  const scoringRule = useMemo(() => {
    return scoringRules.find(r => (!r.serviceId && r.isActive)) || {
      weightMargin: 40,
      weightRevenue: 30,
      weightVolume: 15,
      weightConversion: 15
    };
  }, [scoringRules]);

  // Compute performance metrics for each commercial
  const performanceList = useMemo(() => {
    return commercials.map(comm => {
      // 1. Sales in period
      const commSales = sales.filter(s => {
        if (s.commercialId !== comm.id) return false;
        const sDate = new Date(s.date);
        return sDate >= dateInterval.start && sDate <= dateInterval.end;
      });

      const revenueAchievedHt = commSales.reduce((sum, s) => sum + (s.subtotal || 0), 0);
      const revenueAchievedTtc = commSales.reduce((sum, s) => sum + (s.total || 0), 0);

      // Cost & Margin from sales
      const totalCosts = commSales.reduce((sum, s) => {
        const saleCost = (s.lines || []).reduce((lSum, l) => lSum + ((l.costPrice || 0) * (l.quantity || 0)), 0);
        return sum + saleCost;
      }, 0);
      const marginAchievedHt = revenueAchievedHt - totalCosts;
      const marginRate = revenueAchievedHt > 0 ? Math.round((marginAchievedHt / revenueAchievedHt) * 100) : 0;

      // 2. Deals won in period
      const wonAffaires = affaires.filter(a => {
        if (a.commercialId !== comm.id) return false;
        if (!['GAGNEE', 'CLOTUREE'].includes(a.status)) return false;
        const aDate = new Date(a.updatedAt || a.createdAt || '');
        return aDate >= dateInterval.start && aDate <= dateInterval.end;
      });
      const dealsWonCount = wonAffaires.length;

      // 3. Prospects & conversion rate
      const commProspects = prospects.filter(p => {
        if (p.commercialId !== comm.id && p.responsibleId !== comm.id) return false;
        const pDate = new Date(p.createdAt);
        return pDate >= dateInterval.start && pDate <= dateInterval.end;
      });
      const convertedCount = commProspects.filter(p => p.status === 'Converti').length;
      const conversionRate = commProspects.length > 0 ? Math.round((convertedCount / commProspects.length) * 100) : 0;

      // 4. Goal comparison if exists
      const commGoal = objectifs.find(o => {
        if (o.profileId !== comm.id) return false;
        const gStart = new Date(o.startDate);
        const gEnd = new Date(o.endDate);
        return gStart <= dateInterval.end && gEnd >= dateInterval.start;
      });

      // Compute Normalized Score (/100)
      // Reference target or standard benchmark
      const refRevenue = commGoal?.targetRevenueHt || 5000000;
      const refMargin = commGoal?.targetMarginHt || 1500000;
      const refDeals = commGoal?.targetDealsCount || 5;

      const pctRevenue = Math.min(1.5, revenueAchievedHt / (refRevenue || 1));
      const pctMargin = Math.min(1.5, marginAchievedHt / (refMargin || 1));
      const pctDeals = Math.min(1.5, dealsWonCount / (refDeals || 1));
      const pctConv = conversionRate / 100;

      const score = Math.round(
        (scoringRule.weightMargin * pctMargin) +
        (scoringRule.weightRevenue * pctRevenue) +
        (scoringRule.weightVolume * pctDeals) +
        (scoringRule.weightConversion * pctConv)
      );

      const commService = services.find(s => s.id === comm.serviceId);

      return {
        user: comm,
        service: commService,
        goal: commGoal,
        revenueAchievedHt,
        revenueAchievedTtc,
        marginAchievedHt,
        marginRate,
        dealsWonCount,
        convertedCount,
        totalProspects: commProspects.length,
        conversionRate,
        score
      };
    }).sort((a, b) => b.score - a.score);
  }, [commercials, sales, affaires, prospects, dateInterval, objectifs, scoringRule, services]);

  const top3 = performanceList.slice(0, 3);

  // Filtered Primes
  const filteredPrimes = useMemo(() => {
    return primes.filter(p => {
      const matchService = selectedServiceId === 'ALL' || p.serviceId === selectedServiceId;
      return matchService;
    });
  }, [primes, selectedServiceId]);

  const formatMoney = (val: number) => val.toLocaleString('fr-FR') + ' F';

  return (
    <div className="perf-page">
      {/* Header */}
      <div className="perf-header">
        <div className="perf-header-titles">
          <h1>Performance Commerciale & Primes</h1>
          <p>Tableau de bord de pilotage, classement multicritère et gestion des primes</p>
        </div>

        <div className="perf-header-actions">
          {['Directeur', 'Directeur adjoint', 'SuperAdmin'].includes(currentUser?.role || '') && (
            <button
              className="btn btn-outline"
              onClick={() => setIsRuleModalOpen(true)}
            >
              <Sliders size={16} style={{ marginRight: '6px' }} />
              Règles de Scoring
            </button>
          )}

          <button
            className="btn btn-outline"
            onClick={() => {
              setSelectedObjectifToEdit(null);
              setIsObjectifModalOpen(true);
            }}
          >
            <Target size={16} style={{ marginRight: '6px' }} />
            Définir un Objectif
          </button>

          <button
            className="btn btn-primary"
            onClick={() => setIsPrimeModalOpen(true)}
          >
            <Award size={16} style={{ marginRight: '6px' }} />
            Attribuer une Prime
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="perf-filters-bar">
        <div className="perf-filter-group">
          <Filter size={18} color="#64748B" />
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>Période :</span>
          <select
            className="perf-filter-select"
            value={selectedPeriod}
            onChange={e => setSelectedPeriod(e.target.value)}
          >
            <option value="CURRENT_MONTH">Mois en cours</option>
            <option value="CURRENT_QUARTER">Trimestre en cours</option>
            <option value="CURRENT_YEAR">Année en cours</option>
            <option value="ALL">Tout l'historique</option>
          </select>

          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginLeft: '1rem' }}>Département :</span>
          <select
            className="perf-filter-select"
            value={selectedServiceId}
            onChange={e => setSelectedServiceId(e.target.value)}
          >
            <option value="ALL">Tous les services</option>
            {services.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <div style={{ fontSize: '0.82rem', color: '#64748B' }}>
          Période analysée : <strong>{dateInterval.label}</strong>
        </div>
      </div>

      {/* Tabs */}
      <div className="perf-tabs-bar">
        <button
          className={`perf-tab-btn ${activeTab === 'classement' ? 'active' : ''}`}
          onClick={() => setActiveTab('classement')}
        >
          <Trophy size={18} />
          <span>Classement & Scoring ({performanceList.length})</span>
        </button>

        <button
          className={`perf-tab-btn ${activeTab === 'objectifs' ? 'active' : ''}`}
          onClick={() => setActiveTab('objectifs')}
        >
          <Target size={18} />
          <span>Objectifs Commerciaux ({objectifs.length})</span>
        </button>

        <button
          className={`perf-tab-btn ${activeTab === 'primes' ? 'active' : ''}`}
          onClick={() => setActiveTab('primes')}
        >
          <Award size={18} />
          <span>Primes & Bonus ({filteredPrimes.length})</span>
        </button>
      </div>

      {/* Tab 1: Leaderboard */}
      {activeTab === 'classement' && (
        <div>
          {/* Podium Top 3 */}
          {top3.length > 0 && (
            <div className="podium-container">
              {top3.map((item, idx) => {
                const rank = idx + 1;
                return (
                  <div key={item.user.id} className={`podium-card podium-${rank}`}>
                    <div className={`podium-rank-badge podium-rank-${rank}`}>
                      {rank}
                    </div>
                    <div className="podium-avatar">
                      {item.user.name.charAt(0)}
                    </div>
                    <h3 className="podium-name">{item.user.name}</h3>
                    <div className="podium-service">{item.service?.name || 'Général'}</div>
                    <div className="podium-score-pill">
                      Score : {item.score} pts
                    </div>

                    <div className="podium-stats-grid">
                      <div>
                        <div className="podium-stat-label">CA Facturé HT</div>
                        <div className="podium-stat-val text-teal-700">{formatMoney(item.revenueAchievedHt)}</div>
                      </div>
                      <div>
                        <div className="podium-stat-label">Marge Nette HT</div>
                        <div className="podium-stat-val text-emerald-700">{formatMoney(item.marginAchievedHt)}</div>
                      </div>
                      <div>
                        <div className="podium-stat-label">Affaires Gagnées</div>
                        <div className="podium-stat-val">{item.dealsWonCount}</div>
                      </div>
                      <div>
                        <div className="podium-stat-label">Taux Conversion</div>
                        <div className="podium-stat-val">{item.conversionRate}%</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Full Commercials Ranking Table */}
          <div className="perf-table-wrapper">
            <table className="perf-table">
              <thead>
                <tr>
                  <th style={{ width: '60px' }}>RANG</th>
                  <th>COMMERCIAL</th>
                  <th>SERVICE</th>
                  <th className="text-center">SCORE GLOBAL</th>
                  <th className="text-right">CA FACTURÉ HT</th>
                  <th className="text-right">MARGE BRUTE HT</th>
                  <th className="text-center">TX MARGE</th>
                  <th className="text-center">AFFAIRES GAGNÉES</th>
                  <th className="text-center">CONVERSION</th>
                  <th className="text-center">ACTION</th>
                </tr>
              </thead>
              <tbody>
                {performanceList.map((item, idx) => (
                  <tr key={item.user.id}>
                    <td>
                      <span style={{ 
                        fontWeight: 800, 
                        fontSize: '0.9rem',
                        color: idx === 0 ? '#D97706' : idx === 1 ? '#64748B' : idx === 2 ? '#B45309' : '#0F172A'
                      }}>
                        #{idx + 1}
                      </span>
                    </td>
                    <td>
                      <div className="font-bold text-slate-800">{item.user.name}</div>
                      <div style={{ fontSize: '0.72rem', color: '#64748B' }}>{item.user.email}</div>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.8rem', color: '#475569' }}>
                        {item.service?.name || '-'}
                      </span>
                    </td>
                    <td className="text-center">
                      <span style={{
                        background: '#0D9488',
                        color: '#ffffff',
                        padding: '3px 8px',
                        borderRadius: '12px',
                        fontWeight: 800,
                        fontSize: '0.82rem'
                      }}>
                        {item.score} pts
                      </span>
                    </td>
                    <td className="text-right font-bold text-teal-800">
                      {formatMoney(item.revenueAchievedHt)}
                    </td>
                    <td className="text-right font-bold text-emerald-800">
                      {formatMoney(item.marginAchievedHt)}
                    </td>
                    <td className="text-center font-semibold">
                      {item.marginRate}%
                    </td>
                    <td className="text-center font-bold">
                      {item.dealsWonCount}
                    </td>
                    <td className="text-center">
                      <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                        {item.conversionRate}% ({item.convertedCount}/{item.totalProspects})
                      </span>
                    </td>
                    <td className="text-center">
                      <button
                        className="btn-icon"
                        onClick={() => {
                          setSelectedObjectifToEdit(item.goal || null);
                          setIsObjectifModalOpen(true);
                        }}
                        title={item.goal ? "Modifier l'objectif" : "Définir un objectif"}
                      >
                        <Target size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Goals */}
      {activeTab === 'objectifs' && (
        <div>
          {objectifs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', background: '#ffffff', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
              <Target size={48} color="#94A3B8" style={{ margin: '0 auto 1rem auto' }} />
              <h3>Aucun objectif défini pour le moment</h3>
              <p style={{ color: '#64748B', maxWidth: '400px', margin: '0 auto 1.5rem auto' }}>
                Fixez des cibles de chiffre d'affaires, marge et volume d'affaires pour stimuler la performance de vos commerciaux.
              </p>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setSelectedObjectifToEdit(null);
                  setIsObjectifModalOpen(true);
                }}
              >
                <Plus size={16} style={{ marginRight: '6px' }} />
                Créer le premier objectif
              </button>
            </div>
          ) : (
            <div className="goals-grid">
              {objectifs.map(goal => {
                const user = users.find(u => u.id === goal.profileId);
                const service = services.find(s => s.id === goal.serviceId);

                // Compute progress
                const gStart = new Date(goal.startDate);
                const gEnd = new Date(goal.endDate);
                const userSales = sales.filter(s => {
                  if (s.commercialId !== goal.profileId) return false;
                  const sDate = new Date(s.date);
                  return sDate >= gStart && sDate <= gEnd;
                });
                const achievedRevenue = userSales.reduce((sum, s) => sum + (s.subtotal || 0), 0);
                const revProgress = goal.targetRevenueHt > 0 ? Math.min(100, Math.round((achievedRevenue / goal.targetRevenueHt) * 100)) : 0;

                const achievedMargin = userSales.reduce((sum, s) => {
                  const sCost = (s.lines || []).reduce((lSum, l) => lSum + ((l.costPrice || 0) * (l.quantity || 0)), 0);
                  return sum + (s.subtotal - sCost);
                }, 0);
                const marginProgress = goal.targetMarginHt > 0 ? Math.min(100, Math.round((achievedMargin / goal.targetMarginHt) * 100)) : 0;

                return (
                  <div key={goal.id} className="goal-card">
                    <div className="goal-card-header">
                      <div>
                        <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0F172A' }}>
                          {user?.name || 'Commercial'}
                        </h4>
                        <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
                          {service?.name || 'Général'} — {goal.periodType}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          className="btn-icon"
                          onClick={() => {
                            setSelectedObjectifToEdit(goal);
                            setIsObjectifModalOpen(true);
                          }}
                          title="Modifier"
                        >
                          <Target size={15} />
                        </button>
                        <button
                          className="btn-icon text-red-600"
                          onClick={() => {
                            confirm({
                              title: "Supprimer l'objectif",
                              message: `Supprimer l'objectif de ${user?.name} ?`,
                              confirmLabel: 'Supprimer',
                              variant: 'danger',
                              onConfirm: () => deleteObjectif(goal.id)
                            });
                          }}
                          title="Supprimer"
                        >
                          <XCircle size={15} />
                        </button>
                      </div>
                    </div>

                    <div style={{ fontSize: '0.75rem', color: '#64748B', background: '#F8FAFC', padding: '6px 10px', borderRadius: '6px' }}>
                      Échéance : {new Date(goal.startDate).toLocaleDateString('fr-FR')} → {new Date(goal.endDate).toLocaleDateString('fr-FR')}
                    </div>

                    {/* Gauge 1: Revenue */}
                    <div className="goal-gauge-item">
                      <div className="goal-gauge-labels">
                        <span className="text-slate-600">Chiffre d'Affaires HT</span>
                        <span className="text-teal-700">{formatMoney(achievedRevenue)} / {formatMoney(goal.targetRevenueHt)} ({revProgress}%)</span>
                      </div>
                      <div className="goal-progress-track">
                        <div className="goal-progress-fill teal" style={{ width: `${revProgress}%` }} />
                      </div>
                    </div>

                    {/* Gauge 2: Margin */}
                    <div className="goal-gauge-item">
                      <div className="goal-gauge-labels">
                        <span className="text-slate-600">Marge Brute HT</span>
                        <span className="text-emerald-700">{formatMoney(achievedMargin)} / {formatMoney(goal.targetMarginHt)} ({marginProgress}%)</span>
                      </div>
                      <div className="goal-progress-track">
                        <div className="goal-progress-fill emerald" style={{ width: `${marginProgress}%` }} />
                      </div>
                    </div>

                    {/* Stats pills */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #F1F5F9', paddingTop: '0.75rem', fontSize: '0.78rem' }}>
                      <span>Affaires cibles : <strong>{goal.targetDealsCount}</strong></span>
                      <span>Nouveaux clients : <strong>{goal.targetNewClients}</strong></span>
                      <span className={`status-badge status-${goal.status.toLowerCase()}`}>{goal.status}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Primes */}
      {activeTab === 'primes' && (
        <div>
          {filteredPrimes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', background: '#ffffff', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
              <Award size={48} color="#94A3B8" style={{ margin: '0 auto 1rem auto' }} />
              <h3>Aucune prime enregistrée</h3>
              <p style={{ color: '#64748B', maxWidth: '400px', margin: '0 auto 1.5rem auto' }}>
                Attribuez des primes de performance ou de challenge pour récompenser les meilleurs résultats.
              </p>
              <button
                className="btn btn-primary"
                onClick={() => setIsPrimeModalOpen(true)}
              >
                <Plus size={16} style={{ marginRight: '6px' }} />
                Attribuer une prime
              </button>
            </div>
          ) : (
            <div className="perf-table-wrapper">
              <table className="perf-table">
                <thead>
                  <tr>
                    <th>RÉFÉRENCE</th>
                    <th>BÉNÉFICIAIRE</th>
                    <th>SERVICE</th>
                    <th>PÉRIODE</th>
                    <th>NATURE</th>
                    <th className="text-right">MONTANT</th>
                    <th>STATUT</th>
                    <th>MOTIF & JUSTIFICATION</th>
                    <th className="text-center">ACTIONS & AUDIT</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPrimes.map(prime => {
                    const beneficiary = users.find(u => u.id === prime.profileId);
                    const service = services.find(s => s.id === prime.serviceId);
                    const isDirection = ['Directeur', 'Directeur adjoint', 'SuperAdmin'].includes(currentUser?.role || '');

                    return (
                      <tr key={prime.id}>
                        <td className="font-mono font-bold text-teal-700">{prime.reference}</td>
                        <td>
                          <div className="font-bold text-slate-800">{beneficiary?.name || 'Inconnu'}</div>
                          <div style={{ fontSize: '0.72rem', color: '#64748B' }}>{beneficiary?.role}</div>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.8rem', color: '#475569' }}>
                            {service?.name || '-'}
                          </span>
                        </td>
                        <td>
                          <span className="font-mono text-xs">{prime.periodKey}</span>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155' }}>
                            {prime.primeType}
                          </span>
                        </td>
                        <td className="text-right font-bold text-teal-800" style={{ fontSize: '0.95rem' }}>
                          {formatMoney(prime.amount)}
                        </td>
                        <td>
                          <span className={`status-badge prime-status-${prime.status}`}>
                            {prime.status}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontSize: '0.8rem', color: '#475569', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {prime.justification || '-'}
                          </div>
                        </td>
                        <td className="text-center">
                          <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                            {/* Validation / Rejet actions for Direction */}
                            {prime.status === 'PROPOSEE' && isDirection && (
                              <>
                                  <button
                                  className="btn-icon text-green-600"
                                  onClick={() => {
                                    confirm({
                                      title: 'Valider la prime',
                                      message: `Valider la prime de ${formatMoney(prime.amount)} pour ${beneficiary?.name} ?`,
                                      confirmLabel: 'Valider',
                                      variant: 'success',
                                      onConfirm: () => validatePrime(prime.id, 'Validation accordée par la Direction')
                                    });
                                  }}
                                  title="Valider la prime"
                                >
                                  <CheckCircle size={16} />
                                </button>
                                <button
                                  className="btn-icon text-red-600"
                                  onClick={() => {
                                    confirm({
                                      title: 'Rejeter la prime',
                                      message: `Rejeter la prime de ${beneficiary?.name} ?`,
                                      confirmLabel: 'Rejeter',
                                      variant: 'danger',
                                      onConfirm: () => rejectPrime(prime.id, 'Rejet motivé par la Direction')
                                    });
                                  }}
                                  title="Rejeter la prime"
                                >
                                  <XCircle size={16} />
                                </button>
                              </>
                            )}

                            {prime.status === 'VALIDEE' && isDirection && (
                              <button
                                className="btn-icon text-indigo-600"
                                onClick={() => {
                                  confirm({
                                    title: 'Confirmer le paiement',
                                    message: `Confirmer le paiement effectif de ${formatMoney(prime.amount)} à ${beneficiary?.name} ?`,
                                    confirmLabel: 'Confirmer Paiement',
                                    variant: 'info',
                                    onConfirm: () => payPrime(prime.id, 'Paiement effectué')
                                  });
                                }}
                                title="Marquer Payée"
                              >
                                <DollarSign size={16} />
                              </button>
                            )}

                            {/* Audit Log Button */}
                            <button
                              className="btn-icon"
                              onClick={() => {
                                setSelectedPrimeForAudit(prime);
                                setIsAuditModalOpen(true);
                              }}
                              title="Journal d'audit"
                            >
                              <History size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <ObjectifModal
        isOpen={isObjectifModalOpen}
        onClose={() => {
          setIsObjectifModalOpen(false);
          setSelectedObjectifToEdit(null);
        }}
        objectifToEdit={selectedObjectifToEdit}
      />

      <PrimeModal
        isOpen={isPrimeModalOpen}
        onClose={() => setIsPrimeModalOpen(false)}
      />

      <PrimeAuditModal
        isOpen={isAuditModalOpen}
        onClose={() => {
          setIsAuditModalOpen(false);
          setSelectedPrimeForAudit(null);
        }}
        prime={selectedPrimeForAudit}
      />

      <ScoringRuleModal
        isOpen={isRuleModalOpen}
        onClose={() => setIsRuleModalOpen(false)}
      />
    </div>
  );
}
