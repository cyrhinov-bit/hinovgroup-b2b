import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { 
  Package, Warehouse, TrendingUp, AlertTriangle, DollarSign, RotateCcw, 
  ShoppingBag, RefreshCw, CloudUpload, Calendar, ArrowUpRight, ArrowDownRight, 
  BarChart2, Activity, Zap
} from 'lucide-react';
import { todayLocalKey, toLocalDayKey } from '../../lib/dates';
import { Button } from '../../components/ui/Button';
import { PosEvolutionChart, type DataPoint } from '../../components/pos/PosEvolutionChart';
import { PosHourlyChart, type HourlyDataPoint } from '../../components/pos/PosHourlyChart';
import { PosFamilyDistributionChart, type FamilyBreakdown, type PaymentBreakdown } from '../../components/pos/PosFamilyDistributionChart';
import { toast } from 'react-hot-toast';

type PeriodType = 'today' | '7d' | '30d' | '12m';

export default function DashboardPos() {
  const { posProducts, posTransactions, posCashSessions, posReturns, posPayments, refreshData, reconcilePosData } = useAppContext();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isReconciling, setIsReconciling] = useState(false);
  const [period, setPeriod] = useState<PeriodType>('7d');
  const navigate = useNavigate();

  useEffect(() => {
    refreshData().catch(() => {});
  }, [refreshData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshData();
      toast.success('Données synchronisées avec succès');
    } catch {
      toast.error('Erreur lors de la synchronisation');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleReconcile = async () => {
    setIsReconciling(true);
    const toastId = toast.loading('Réconciliation globale avec le serveur Cloud...');
    try {
      const res = await reconcilePosData();
      await refreshData(true);
      if (res?.success) {
        toast.success(res.message || 'Synchronisation d\'urgence réussie !', { id: toastId, duration: 6000 });
      } else {
        toast.error(res?.message || 'Erreur lors de la synchronisation', { id: toastId, duration: 6000 });
      }
    } catch (e: any) {
      toast.error('Erreur : ' + (e?.message || e), { id: toastId });
    } finally {
      setIsReconciling(false);
    }
  };

  // 1. Stock global & alertes
  const totalProducts = posProducts.length;
  const physicalProducts = posProducts.filter(p => p.family !== 'Service');
  const totalPurchaseStockValue = physicalProducts.reduce((sum, p) => sum + (p.purchasePrice || 0) * (p.quantity || 0), 0);
  const totalSellingStockValue = physicalProducts.reduce((sum, p) => sum + (p.sellingPrice || 0) * (p.quantity || 0), 0);
  const globalStockMargin = totalSellingStockValue - totalPurchaseStockValue;
  const globalStockMarginRate = totalSellingStockValue > 0 ? ((globalStockMargin / totalSellingStockValue) * 100).toFixed(1) : '0';
  const lowStockProducts = physicalProducts.filter(p => p.quantity <= p.minStock && p.minStock > 0);

  // 2. Session caisse du jour
  const today = todayLocalKey();
  const openSession = posCashSessions.find(s => s.status === 'Ouverte' && toLocalDayKey(s.openedAt) === today);
  const staleOpenSession = posCashSessions.find(s => s.status === 'Ouverte' && toLocalDayKey(s.openedAt) < today);

  // Map rapide des prix d'achat par produit pour calculer la marge exacte
  const productPurchasePriceMap = useMemo(() => {
    const map = new Map<string, number>();
    posProducts.forEach(p => {
      map.set(p.id, p.purchasePrice || 0);
    });
    return map;
  }, [posProducts]);

  // 3. Calculs d'évolution selon la période sélectionnée
  const { evolutionData, currentTotalRevenue, currentTotalMargin, currentTicketCount, avgBasket, growthRate, previousRevenue } = useMemo(() => {
    const validTransactions = posTransactions.filter(t => t.status === 'Validée');
    const now = new Date();

    const calculateMarginForTx = (tx: typeof posTransactions[0]) => {
      let margin = 0;
      tx.lines.forEach(l => {
        const purchasePrice = l.productId ? (productPurchasePriceMap.get(l.productId) || 0) : 0;
        const lineCost = purchasePrice * l.quantity;
        margin += (l.total - lineCost);
      });
      return margin;
    };

    let dataPoints: DataPoint[] = [];
    let curRev = 0;
    let curMargin = 0;
    let curTickets = 0;
    let prevRev = 0;

    if (period === 'today') {
      // Tranche horaire (8h à 20h)
      for (let hour = 8; hour <= 20; hour++) {
        const hourLabel = `${hour.toString().padStart(2, '0')}h`;
        const txsInHour = validTransactions.filter(t => {
          if (toLocalDayKey(t.date) !== today) return false;
          const txDate = new Date(t.date);
          return txDate.getHours() === hour;
        });

        const rev = txsInHour.reduce((s, t) => s + t.total, 0);
        const margin = txsInHour.reduce((s, t) => s + calculateMarginForTx(t), 0);
        const count = txsInHour.length;

        curRev += rev;
        curMargin += margin;
        curTickets += count;

        dataPoints.push({
          label: hourLabel,
          subLabel: `Aujourd'hui à ${hourLabel}`,
          value1: rev,
          value2: margin,
          secondary: count
        });
      }

      // Comparaison avec hier
      const yesterdayDate = new Date();
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);
      const yesterdayKey = yesterdayDate.toISOString().split('T')[0];
      prevRev = validTransactions
        .filter(t => toLocalDayKey(t.date) === yesterdayKey)
        .reduce((s, t) => s + t.total, 0);

    } else if (period === '7d') {
      // 7 derniers jours
      const days: string[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        days.push(d.toISOString().split('T')[0]);
      }

      dataPoints = days.map(dayKey => {
        const dObj = new Date(dayKey);
        const dayLabel = dObj.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' });
        const txs = validTransactions.filter(t => toLocalDayKey(t.date) === dayKey);
        const rev = txs.reduce((s, t) => s + t.total, 0);
        const margin = txs.reduce((s, t) => s + calculateMarginForTx(t), 0);
        const count = txs.length;

        curRev += rev;
        curMargin += margin;
        curTickets += count;

        return {
          label: dayLabel,
          subLabel: dObj.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }),
          dateKey: dayKey,
          value1: rev,
          value2: margin,
          secondary: count
        };
      });

      // 7 jours précédents pour la comparaison
      const prevDays: string[] = [];
      for (let i = 13; i >= 7; i--) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        prevDays.push(d.toISOString().split('T')[0]);
      }
      prevRev = validTransactions
        .filter(t => prevDays.includes(toLocalDayKey(t.date)))
        .reduce((s, t) => s + t.total, 0);

    } else if (period === '30d') {
      // 30 derniers jours
      const days: string[] = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        days.push(d.toISOString().split('T')[0]);
      }

      dataPoints = days.map(dayKey => {
        const dObj = new Date(dayKey);
        const dayLabel = `${dObj.getDate()}/${dObj.getMonth() + 1}`;
        const txs = validTransactions.filter(t => toLocalDayKey(t.date) === dayKey);
        const rev = txs.reduce((s, t) => s + t.total, 0);
        const margin = txs.reduce((s, t) => s + calculateMarginForTx(t), 0);
        const count = txs.length;

        curRev += rev;
        curMargin += margin;
        curTickets += count;

        return {
          label: dayLabel,
          subLabel: dObj.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
          dateKey: dayKey,
          value1: rev,
          value2: margin,
          secondary: count
        };
      });

      // 30 jours précédents
      const prevDays: string[] = [];
      for (let i = 59; i >= 30; i--) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        prevDays.push(d.toISOString().split('T')[0]);
      }
      prevRev = validTransactions
        .filter(t => prevDays.includes(toLocalDayKey(t.date)))
        .reduce((s, t) => s + t.total, 0);

    } else if (period === '12m') {
      // 12 derniers mois
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthYear = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
        const monthLabel = d.toLocaleDateString('fr-FR', { month: 'short' });

        const txs = validTransactions.filter(t => {
          const tMonth = t.date.substring(0, 7);
          return tMonth === monthYear;
        });

        const rev = txs.reduce((s, t) => s + t.total, 0);
        const margin = txs.reduce((s, t) => s + calculateMarginForTx(t), 0);
        const count = txs.length;

        curRev += rev;
        curMargin += margin;
        curTickets += count;

        dataPoints.push({
          label: monthLabel,
          subLabel: d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
          dateKey: monthYear,
          value1: rev,
          value2: margin,
          secondary: count
        });
      }

      // Année précédente
      const prevYearMonth = `${now.getFullYear() - 1}`;
      prevRev = validTransactions
        .filter(t => t.date.startsWith(prevYearMonth))
        .reduce((s, t) => s + t.total, 0);
    }

    const growth = prevRev > 0 ? (((curRev - prevRev) / prevRev) * 100).toFixed(1) : curRev > 0 ? '+100' : '0';
    const basket = curTickets > 0 ? Math.round(curRev / curTickets) : 0;

    return {
      evolutionData: dataPoints,
      currentTotalRevenue: curRev,
      currentTotalMargin: curMargin,
      currentTicketCount: curTickets,
      avgBasket: basket,
      growthRate: growth,
      previousRevenue: prevRev
    };
  }, [posTransactions, period, today, productPurchasePriceMap]);

  // 4. Distribution horaire pour la journée en cours
  const hourlyData: HourlyDataPoint[] = useMemo(() => {
    const validTransactions = posTransactions.filter(t => t.status === 'Validée');
    const result: HourlyDataPoint[] = [];

    for (let h = 8; h <= 20; h++) {
      const label = `${h.toString().padStart(2, '0')}h`;
      const txs = validTransactions.filter(t => {
        if (toLocalDayKey(t.date) !== today) return false;
        const txDate = new Date(t.date);
        return txDate.getHours() === h;
      });

      const rev = txs.reduce((s, t) => s + t.total, 0);
      result.push({
        hour: h,
        label,
        revenue: rev,
        count: txs.length
      });
    }
    return result;
  }, [posTransactions, today]);

  // 5. Répartition des familles et modes de paiement sur la période filtrée
  const { familyBreakdown, paymentBreakdown } = useMemo(() => {
    const validTransactions = posTransactions.filter(t => t.status === 'Validée');
    const selectedDateKeys = new Set(evolutionData.map(d => d.dateKey).filter(Boolean));

    const filteredTxs = period === 'today'
      ? validTransactions.filter(t => toLocalDayKey(t.date) === today)
      : validTransactions.filter(t => {
          if (period === '12m') {
            return selectedDateKeys.has(t.date.substring(0, 7));
          }
          return selectedDateKeys.has(toLocalDayKey(t.date));
        });

    // Familles
    let revLivres = 0;
    let qtyLivres = 0;
    let revFournitures = 0;
    let qtyFournitures = 0;
    let revServices = 0;
    let qtyServices = 0;

    filteredTxs.forEach(t => {
      t.lines.forEach(l => {
        const p = l.productId ? posProducts.find(prod => prod.id === l.productId) : undefined;
        const isServ = (p && (p.family === 'Service' || (p.reference && p.reference.startsWith('SRV-')))) ||
                       (l.description && (l.description.toLowerCase().includes('photocopie') || l.description.toLowerCase().includes('impression') || l.description.toLowerCase().includes('scan') || l.description.toLowerCase().includes('reliure')));
        const isLiv = p && !isServ && ((p.family && p.family.toLowerCase().startsWith('livre')) || !!(p.isbn && p.isbn.trim()));

        if (isServ) {
          revServices += l.total;
          qtyServices += l.quantity;
        } else if (isLiv) {
          revLivres += l.total;
          qtyLivres += l.quantity;
        } else {
          revFournitures += l.total;
          qtyFournitures += l.quantity;
        }
      });
    });

    const families: FamilyBreakdown[] = [
      { name: 'Fournitures & Papeterie', revenue: revFournitures, quantity: qtyFournitures, color: '#0D9488' },
      { name: 'Livres & Manuels', revenue: revLivres, quantity: qtyLivres, color: '#3B82F6' },
      { name: 'Services & Reprographie', revenue: revServices, quantity: qtyServices, color: '#8B5CF6' },
    ];

    // Modes de paiement
    const paymentMap: Record<string, { amount: number; count: number; color: string }> = {
      'Espèces': { amount: 0, count: 0, color: '#10B981' },
      'Wave / Mobile Money': { amount: 0, count: 0, color: '#06B6D4' },
      'Carte Bancaire': { amount: 0, count: 0, color: '#6366F1' },
      'Autre': { amount: 0, count: 0, color: '#94A3B8' }
    };

    filteredTxs.forEach(t => {
      if (t.payments && t.payments.length > 0) {
        t.payments.forEach(p => {
          const method = p.method || 'Espèces';
          let key = 'Autre';
          if (method.toLowerCase().includes('esp')) key = 'Espèces';
          else if (method.toLowerCase().includes('wave') || method.toLowerCase().includes('orange') || method.toLowerCase().includes('moov') || method.toLowerCase().includes('mtn') || method.toLowerCase().includes('mobile')) key = 'Wave / Mobile Money';
          else if (method.toLowerCase().includes('carte') || method.toLowerCase().includes('visa') || method.toLowerCase().includes('cb')) key = 'Carte Bancaire';

          if (!paymentMap[key]) {
            paymentMap[key] = { amount: 0, count: 0, color: '#64748B' };
          }
          paymentMap[key].amount += p.amount;
          paymentMap[key].count += 1;
        });
      } else {
        paymentMap['Espèces'].amount += t.total;
        paymentMap['Espèces'].count += 1;
      }
    });

    const payments: PaymentBreakdown[] = Object.entries(paymentMap)
      .filter(([_, v]) => v.amount > 0 || v.count > 0)
      .map(([method, v]) => ({
        method,
        amount: v.amount,
        count: v.count,
        color: v.color
      }));

    return { familyBreakdown: families, paymentBreakdown: payments };
  }, [posTransactions, posProducts, evolutionData, period, today]);

  const periodLabels: Record<PeriodType, string> = {
    'today': "Aujourd'hui",
    '7d': '7 Derniers Jours',
    '30d': '30 Derniers Jours',
    '12m': '12 Derniers Mois'
  };

  const isPositiveGrowth = Number(growthRate) >= 0;

  return (
    <div className="pos-page" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Barre supérieure : Titre, Synchronisation et Sélecteur de Période */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0, color: '#0F172A' }}>Tableau de Bord Administrateur POS</h1>
          <p style={{ fontSize: '13px', color: 'var(--color-text-muted, #64748B)', margin: '4px 0 0' }}>
            Suivi des ventes, marges, affluence horaire et diagrammes d'évolution en temps réel.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Sélecteur de période interactif */}
          <div style={{ display: 'inline-flex', background: '#F1F5F9', padding: '4px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
            {(['today', '7d', '30d', '12m'] as PeriodType[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: '7px',
                  cursor: 'pointer',
                  background: period === p ? 'white' : 'transparent',
                  color: period === p ? 'var(--color-primary, #0D9488)' : '#64748B',
                  boxShadow: period === p ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                {periodLabels[p]}
              </button>
            ))}
          </div>

          <Button 
            variant="primary" 
            icon={<CloudUpload size={16} className={isReconciling ? "animate-pulse" : ""} />}
            onClick={handleReconcile}
            disabled={isReconciling}
          >
            {isReconciling ? 'Rapprochement...' : 'Forcer Réconciliation Cloud'}
          </Button>
          <Button 
            variant="secondary" 
            icon={<RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />}
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            {isRefreshing ? 'Actualisation...' : 'Actualiser'}
          </Button>
        </div>
      </div>

      {/* Cartes de synthèse dynamique selon la période choisie */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        {/* CA Période */}
        <div style={{ background: 'white', borderRadius: 'var(--radius-lg, 12px)', padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid var(--color-border, #E2E8F0)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted, #64748B)' }}>
                CA RÉALISÉ ({periodLabels[period].toUpperCase()})
              </div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A', marginTop: '4px' }}>
                {currentTotalRevenue.toLocaleString('fr-FR')} FCFA
              </div>
            </div>
            <div style={{ background: 'var(--color-success-tint, #ECFDF5)', borderRadius: '8px', padding: '8px' }}>
              <TrendingUp size={22} color="var(--color-success, #10B981)" />
            </div>
          </div>
          <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600 }}>
            <span style={{ 
              color: isPositiveGrowth ? '#059669' : '#DC2626', 
              display: 'inline-flex', 
              alignItems: 'center',
              backgroundColor: isPositiveGrowth ? '#ECFDF5' : '#FEF2F2',
              padding: '2px 6px',
              borderRadius: '4px'
            }}>
              {isPositiveGrowth ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
              {isPositiveGrowth ? `+${growthRate}%` : `${growthRate}%`}
            </span>
            <span style={{ color: '#94A3B8' }}>vs période précédente</span>
          </div>
        </div>

        {/* Marge Brute Période */}
        <div style={{ background: 'white', borderRadius: 'var(--radius-lg, 12px)', padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid var(--color-border, #E2E8F0)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted, #64748B)' }}>
                MARGE BRUTE ESTIMÉE
              </div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--color-primary, #0D9488)', marginTop: '4px' }}>
                {currentTotalMargin.toLocaleString('fr-FR')} FCFA
              </div>
            </div>
            <div style={{ background: '#F0FDFA', borderRadius: '8px', padding: '8px' }}>
              <DollarSign size={22} color="#0D9488" />
            </div>
          </div>
          <div style={{ marginTop: '8px', fontSize: '11px', color: '#64748B' }}>
            Taux de marge moyen : <strong style={{ color: '#0F172A' }}>{currentTotalRevenue > 0 ? ((currentTotalMargin / currentTotalRevenue) * 100).toFixed(1) : 0}%</strong>
          </div>
        </div>

        {/* Volume Tickets */}
        <div style={{ background: 'white', borderRadius: 'var(--radius-lg, 12px)', padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid var(--color-border, #E2E8F0)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted, #64748B)' }}>
                TRANSACTIONS / TICKETS
              </div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A', marginTop: '4px' }}>
                {currentTicketCount}
              </div>
            </div>
            <div style={{ background: '#EFF6FF', borderRadius: '8px', padding: '8px' }}>
              <Activity size={22} color="#3B82F6" />
            </div>
          </div>
          <div style={{ marginTop: '8px', fontSize: '11px', color: '#64748B' }}>
            Passages en caisse enregistrés
          </div>
        </div>

        {/* Panier Moyen */}
        <div style={{ background: 'white', borderRadius: 'var(--radius-lg, 12px)', padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid var(--color-border, #E2E8F0)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted, #64748B)' }}>
                PANIER MOYEN
              </div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#8B5CF6', marginTop: '4px' }}>
                {avgBasket.toLocaleString('fr-FR')} FCFA
              </div>
            </div>
            <div style={{ background: '#F5F3FF', borderRadius: '8px', padding: '8px' }}>
              <Zap size={22} color="#8B5CF6" />
            </div>
          </div>
          <div style={{ marginTop: '8px', fontSize: '11px', color: '#64748B' }}>
            Moyenne dépensée par client
          </div>
        </div>
      </div>

      {/* 📊 GRAPHIQUE ÉVOLUTIF PRINCIPAL : CA & MARGE */}
      <PosEvolutionChart
        data={evolutionData}
        title={`📈 Diagramme d'Évolution des Ventes & Marges (${periodLabels[period]})`}
        subtitle="Courbe de progression temporelle du Chiffre d'Affaires et de la Marge Brute générée"
        series1Name="Chiffre d'Affaires"
        series2Name="Marge Brute"
        color1="#0D9488"
        color2="#3B82F6"
        height={300}
      />

      {/* ⏰ GRAPHIQUES D'AFFLUENCE ET RÉPARTITIONS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px' }}>
        <PosHourlyChart data={hourlyData} />
      </div>

      {/* 🍩 RÉPARTITION PAR FAMILLE ET MIX DE PAIEMENT */}
      <PosFamilyDistributionChart
        families={familyBreakdown}
        payments={paymentBreakdown}
        totalRevenue={currentTotalRevenue}
      />

      {/* BLOC ÉTAT SESSION DE CAISSE */}
      <div style={{ background: 'white', borderRadius: 'var(--radius-lg, 12px)', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid var(--color-border, #E2E8F0)' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', color: '#0F172A' }}>Session Caisse du Jour</h3>
        {openSession ? (
          <div style={{ color: 'var(--color-success)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#10B981' }} />
            Session ouverte aujourd'hui — Fond initial : {openSession.initialFund.toLocaleString('fr-FR')} FCFA
          </div>
        ) : staleOpenSession ? (
          <div>
            <div style={{ color: 'var(--color-warning-strong)', fontWeight: 600 }}>⚠️ Session antérieure du {new Date(staleOpenSession.openedAt).toLocaleDateString('fr-FR')} non clôturée</div>
            <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '4px' }}>Rendez-vous dans la Gestion de caisse pour la clôturer et ouvrir la caisse d'aujourd'hui.</div>
          </div>
        ) : (
          <div style={{ color: 'var(--color-text-muted)' }}>Aucune session ouverte pour aujourd'hui</div>
        )}
      </div>

      {/* LIEN VERS LE MODULE FINANCE */}
      <div 
        style={{ 
          background: 'white', 
          borderRadius: 'var(--radius-lg, 12px)', 
          padding: '20px', 
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)', 
          border: '1px solid var(--color-border, #E2E8F0)', 
          cursor: 'pointer',
          transition: 'all 0.2s ease'
        }} 
        onClick={() => navigate('/pos/finance')}
        onMouseOver={e => e.currentTarget.style.borderColor = 'var(--color-primary, #0D9488)'}
        onMouseOut={e => e.currentTarget.style.borderColor = 'var(--color-border, #E2E8F0)'}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ background: 'var(--color-success-tint, #ECFDF5)', borderRadius: '10px', padding: '12px' }}>
            <DollarSign size={24} color="var(--color-success, #10B981)" />
          </div>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>Module Finance Avancé</div>
            <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Consultez les mouvements financiers, le rapprochement de caisse et l'analyse de rentabilité détaillée.</div>
          </div>
          <div style={{ marginLeft: 'auto', color: 'var(--color-primary, #0D9488)', fontWeight: 700, fontSize: '14px' }}>
            Accéder →
          </div>
        </div>
      </div>
    </div>
  );
}
