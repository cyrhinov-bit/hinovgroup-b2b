import { useState, useMemo, useEffect } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Loader2,
  Store,
  Layers,
  ArrowRightLeft,
  DollarSign,
  TrendingUp,
  MapPin
} from 'lucide-react';
import { useAppContext } from '../../../context/AppContext';
import { useAuth } from '../../../context/AuthContext';
import { runFinancialAudit, generateAiAuditDiagnostic } from '../services/DirectorAuditService';
import { PosMagasinService, DEFAULT_MAGASIN } from '../../pos/services/PosMagasinService';
import { PosStoreSelector, POS_SCOPE_STORAGE_KEY } from '../../../components/pos/PosStoreSelector';
import type { PosMagasin, PosStockTransfer } from '../../../types/posMagasins';
import { Button } from '../../../components/ui/Button';
import { toast } from 'react-hot-toast';

export default function DirectorAuditPage() {
  const { currentUser } = useAuth();
  const { posTransactions, posCashSessions, posProducts, posReturns, users } = useAppContext();

  const [magasins, setMagasins] = useState<PosMagasin[]>([DEFAULT_MAGASIN]);
  const [stockTransfers, setStockTransfers] = useState<PosStockTransfer[]>([]);
  const [selectedMagasinId, setSelectedMagasinId] = useState<string>(() => {
    try {
      return localStorage.getItem(POS_SCOPE_STORAGE_KEY) || 'ALL';
    } catch {
      return 'ALL';
    }
  });

  const [activeTab, setActiveTab] = useState<'ALL' | 'CRITICAL' | 'CASH' | 'LOSS' | 'DISCOUNT' | 'NETWORK'>('ALL');
  const [aiDiagnostic, setAiDiagnostic] = useState<string | null>(null);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  // Charger les magasins et transferts
  useEffect(() => {
    let mounted = true;
    Promise.all([
      PosMagasinService.loadMagasins(),
      PosMagasinService.loadStockTransfers()
    ]).then(([mList, tList]) => {
      if (mounted) {
        setMagasins(mList.length > 0 ? mList : [DEFAULT_MAGASIN]);
        setStockTransfers(tList);
      }
    }).catch(err => {
      console.warn('Erreur chargement magasins audit:', err);
    });

    return () => {
      mounted = false;
    };
  }, []);

  // Exécution de l'audit multi-magasins
  const audit = useMemo(() => {
    return runFinancialAudit({
      posTransactions,
      posCashSessions,
      posProducts,
      posReturns,
      users,
      posMagasins: magasins,
      stockTransfers,
      selectedMagasinId
    });
  }, [posTransactions, posCashSessions, posProducts, posReturns, users, magasins, stockTransfers, selectedMagasinId]);

  const filteredAnomalies = useMemo(() => {
    return audit.anomalies.filter(a => {
      if (activeTab === 'CRITICAL') return a.severity === 'CRITICAL';
      if (activeTab === 'CASH') return a.type === 'CASH_DISCREPANCY';
      if (activeTab === 'LOSS') return a.type === 'LOSS_SALE';
      if (activeTab === 'DISCOUNT') return a.type === 'HIGH_DISCOUNT';
      if (activeTab === 'NETWORK') {
        return (
          a.type === 'INTER_STORE_STOCK_IMBALANCE' ||
          a.type === 'STORE_CASH_LEAK_DISPROPORTION' ||
          a.type === 'SUSPICIOUS_TRANSFER_PENDING'
        );
      }
      return true;
    });
  }, [audit.anomalies, activeTab]);

  const handleRunAiDiagnostic = async () => {
    setIsGeneratingAi(true);
    try {
      const diag = await generateAiAuditDiagnostic(audit, currentUser?.id);
      setAiDiagnostic(diag);
      toast.success('Rapport d’audit exécutif multi-magasins généré !');
    } catch (err: any) {
      toast.error('Erreur diagnostic IA : ' + (err.message || err));
    } finally {
      setIsGeneratingAi(false);
    }
  };

  return (
    <div className="dashboard" style={{ padding: '0 20px 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
            <ShieldAlert size={26} color="#EF4444" /> Audit Financier & Bouclier Anti-Fraude (IA)
          </h2>
          <p style={{ color: 'var(--color-text-muted)', margin: '4px 0 0', fontSize: '14px' }}>
            Contrôle d'intégrité financière, détection des fraudes et rééquilibrage de l'ensemble des magasins
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Sélecteur de magasin / réseau */}
          <PosStoreSelector
            value={selectedMagasinId}
            onChange={id => {
              setSelectedMagasinId(id);
              setAiDiagnostic(null);
            }}
            label="Périmètre :"
          />

          <Button
            variant="primary"
            onClick={handleRunAiDiagnostic}
            disabled={isGeneratingAi}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)' }}
          >
            {isGeneratingAi ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Audit IA en cours...
              </>
            ) : (
              <>
                <Sparkles size={16} /> Diagnostic Exécutif IA
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Top Banner Health Score & KPIs */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px',
        marginBottom: '20px'
      }}>
        {/* Health Score Card */}
        <div style={{
          padding: '18px 20px',
          borderRadius: 'var(--radius-lg)',
          background: audit.status === 'OPTIMAL' ? '#f0fdf4' : audit.status === 'ATTENTION' ? '#fffbeb' : '#fef2f2',
          border: `1px solid ${audit.status === 'OPTIMAL' ? '#bbf7d0' : audit.status === 'ATTENTION' ? '#fde68a' : '#fecaca'}`,
          display: 'flex',
          alignItems: 'center',
          gap: '16px'
        }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: audit.status === 'OPTIMAL' ? '#16a34a' : audit.status === 'ATTENTION' ? '#d97706' : '#dc2626',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
            fontWeight: 800
          }}>
            {audit.healthScore}
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Score de Conformité</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: audit.status === 'OPTIMAL' ? '#166534' : audit.status === 'ATTENTION' ? '#b45309' : '#b91c1c' }}>
              {audit.status === 'OPTIMAL' ? 'Situation Saine' : audit.status === 'ATTENTION' ? 'Points de Vigilance' : 'Alerte Requise'}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
              {audit.selectedMagasinNom}
            </div>
          </div>
        </div>

        {/* Chiffre d'Affaires audité */}
        <div className="card" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Chiffre d'Affaires Audité</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#16a34a' }}>
            {audit.totalRevenue.toLocaleString()} FCFA
          </div>
        </div>

        {/* Écarts de caisse */}
        <div className="card" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Écarts Cumulés de Caisse</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: audit.totalCashDiscrepancy > 0 ? '#dc2626' : 'var(--color-text)' }}>
            {audit.totalCashDiscrepancy > 0 ? `-${audit.totalCashDiscrepancy.toLocaleString()} FCFA` : '0 FCFA (Zéro écart)'}
          </div>
        </div>

        {/* Pertes sur ventes */}
        <div className="card" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Pertes sur Ventes Détectées</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: audit.totalLossRisk > 0 ? '#dc2626' : '#16a34a' }}>
            {audit.totalLossRisk > 0 ? `-${audit.totalLossRisk.toLocaleString()} FCFA` : '0 FCFA (Pertes évitées)'}
          </div>
        </div>

        {/* Remises exceptionnelles */}
        <div className="card" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Remises Élevées Accordées</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#d97706' }}>
            {audit.totalHighDiscounts.toLocaleString()} FCFA
          </div>
        </div>
      </div>

      {/* Vue Réseau Multi-Magasins (visible en vue consolidée ou s'il y a plus d'un magasin) */}
      {selectedMagasinId === 'ALL' && audit.storeMetrics.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={18} color="#4f46e5" /> Performance & Conformité par Magasin
            </h3>
            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
              Cliquez sur un magasin pour isoler son audit
            </span>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '14px'
          }}>
            {audit.storeMetrics.map(store => (
              <div
                key={store.magasinId}
                className="card"
                onClick={() => setSelectedMagasinId(store.magasinId)}
                style={{
                  padding: '16px',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  border: '1px solid var(--color-border)',
                  borderTop: `4px solid ${store.status === 'OPTIMAL' ? '#16a34a' : store.status === 'ATTENTION' ? '#d97706' : '#dc2626'}`
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#4f46e5')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--color-text)' }}>{store.magasinNom}</div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                      {store.totalTransactions} vente(s) validée(s)
                    </div>
                  </div>
                  <span style={{
                    padding: '3px 8px',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '11px',
                    fontWeight: 700,
                    background: store.status === 'OPTIMAL' ? '#dcfce7' : store.status === 'ATTENTION' ? '#fef3c7' : '#fee2e2',
                    color: store.status === 'OPTIMAL' ? '#166534' : store.status === 'ATTENTION' ? '#92400e' : '#991b1b'
                  }}>
                    {store.healthScore}/100
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--color-surface-alt)' }}>
                  <div>
                    <span style={{ color: 'var(--color-text-muted)' }}>Chiffre d'Affaires :</span>
                    <div style={{ fontWeight: 700, color: '#16a34a' }}>{store.totalRevenue.toLocaleString()} FCFA</div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--color-text-muted)' }}>Écarts caisse :</span>
                    <div style={{ fontWeight: 700, color: store.totalCashDiscrepancy > 0 ? '#dc2626' : 'var(--color-text)' }}>
                      {store.totalCashDiscrepancy > 0 ? `-${store.totalCashDiscrepancy.toLocaleString()}` : '0'} FCFA
                    </div>
                  </div>
                </div>

                {store.anomalyCount > 0 && (
                  <div style={{ marginTop: '8px', fontSize: '11px', color: '#b91c1c', fontWeight: 600 }}>
                    ⚠️ {store.anomalyCount} anomalie(s) ({store.criticalCount} critique(s))
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Diagnostic Text Box */}
      {aiDiagnostic && (
        <div style={{
          marginBottom: '24px',
          padding: '20px',
          background: 'linear-gradient(180deg, #FAF5FF 0%, #F3E8FF 100%)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid #D8B4FE',
          boxShadow: '0 2px 6px rgba(139, 92, 246, 0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '16px', color: '#6B21A8' }}>
              <Sparkles size={18} /> Diagnostic Exécutif Multi-Magasins de la Direction
            </div>
            <span style={{ fontSize: '12px', background: '#e9d5ff', color: '#581c87', padding: '3px 10px', borderRadius: '12px', fontWeight: 600 }}>
              {audit.selectedMagasinNom}
            </span>
          </div>
          <div style={{ fontSize: '14px', lineHeight: '1.7', whiteSpace: 'pre-line', color: '#3B0764' }}>
            {aiDiagnostic}
          </div>
        </div>
      )}

      {/* Anomaly Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', overflowX: 'auto', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => setActiveTab('ALL')}
          style={{
            padding: '8px 16px',
            borderRadius: 'var(--radius-full)',
            border: '1px solid',
            borderColor: activeTab === 'ALL' ? 'var(--color-primary)' : 'var(--color-border)',
            background: activeTab === 'ALL' ? 'var(--color-primary)' : 'white',
            color: activeTab === 'ALL' ? 'white' : 'var(--color-text)',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          Toutes ({audit.anomalies.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('CRITICAL')}
          style={{
            padding: '8px 16px',
            borderRadius: 'var(--radius-full)',
            border: '1px solid',
            borderColor: activeTab === 'CRITICAL' ? '#dc2626' : 'var(--color-border)',
            background: activeTab === 'CRITICAL' ? '#dc2626' : 'white',
            color: activeTab === 'CRITICAL' ? 'white' : 'var(--color-text)',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          🔴 Critiques ({audit.anomalies.filter(a => a.severity === 'CRITICAL').length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('CASH')}
          style={{
            padding: '8px 16px',
            borderRadius: 'var(--radius-full)',
            border: '1px solid',
            borderColor: activeTab === 'CASH' ? 'var(--color-primary)' : 'var(--color-border)',
            background: activeTab === 'CASH' ? 'var(--color-primary)' : 'white',
            color: activeTab === 'CASH' ? 'white' : 'var(--color-text)',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          💵 Écarts de Caisse ({audit.anomalies.filter(a => a.type === 'CASH_DISCREPANCY').length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('LOSS')}
          style={{
            padding: '8px 16px',
            borderRadius: 'var(--radius-full)',
            border: '1px solid',
            borderColor: activeTab === 'LOSS' ? 'var(--color-primary)' : 'var(--color-border)',
            background: activeTab === 'LOSS' ? 'var(--color-primary)' : 'white',
            color: activeTab === 'LOSS' ? 'white' : 'var(--color-text)',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          📉 Ventes à Perte ({audit.anomalies.filter(a => a.type === 'LOSS_SALE').length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('DISCOUNT')}
          style={{
            padding: '8px 16px',
            borderRadius: 'var(--radius-full)',
            border: '1px solid',
            borderColor: activeTab === 'DISCOUNT' ? 'var(--color-primary)' : 'var(--color-border)',
            background: activeTab === 'DISCOUNT' ? 'var(--color-primary)' : 'white',
            color: activeTab === 'DISCOUNT' ? 'white' : 'var(--color-text)',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          🏷️ Remises Élevées ({audit.anomalies.filter(a => a.type === 'HIGH_DISCOUNT').length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('NETWORK')}
          style={{
            padding: '8px 16px',
            borderRadius: 'var(--radius-full)',
            border: '1px solid',
            borderColor: activeTab === 'NETWORK' ? '#4f46e5' : 'var(--color-border)',
            background: activeTab === 'NETWORK' ? '#4f46e5' : 'white',
            color: activeTab === 'NETWORK' ? 'white' : 'var(--color-text)',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          🔄 Réseau & Transferts ({
            audit.anomalies.filter(a =>
              a.type === 'INTER_STORE_STOCK_IMBALANCE' ||
              a.type === 'STORE_CASH_LEAK_DISPROPORTION' ||
              a.type === 'SUSPICIOUS_TRANSFER_PENDING'
            ).length
          })
        </button>
      </div>

      {/* Anomalies List */}
      {filteredAnomalies.length === 0 ? (
        <div className="card" style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
          <ShieldCheck size={48} color="#16a34a" style={{ margin: '0 auto 12px' }} />
          <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text)' }}>Aucune anomalie détectée dans ce périmètre</div>
          <div style={{ fontSize: '13px', marginTop: '4px' }}>Toutes les opérations analysées respectent scrupuleusement les règles de conformité.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredAnomalies.map(item => (
            <div
              key={item.id}
              className="card"
              style={{
                padding: '16px 20px',
                borderLeft: `5px solid ${item.severity === 'CRITICAL' ? '#dc2626' : '#f59e0b'}`,
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {item.severity === 'CRITICAL' ? (
                    <AlertTriangle size={18} color="#dc2626" />
                  ) : (
                    <AlertTriangle size={18} color="#f59e0b" />
                  )}
                  <span style={{ fontWeight: 700, fontSize: '15px' }}>{item.title}</span>
                  {item.magasinNom && (
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 700,
                      background: '#ede9fe',
                      color: '#6d28d9',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <Store size={12} /> {item.magasinNom}
                    </span>
                  )}
                </div>

                {item.amount !== undefined && item.amount > 0 && (
                  <span style={{ fontWeight: 800, fontSize: '15px', color: item.severity === 'CRITICAL' ? '#dc2626' : '#d97706' }}>
                    {item.amount.toLocaleString()} FCFA
                  </span>
                )}
              </div>

              <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: '1.5' }}>
                {item.description}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', paddingTop: '8px', borderTop: '1px solid var(--color-surface-alt)', fontSize: '12px' }}>
                <div style={{ display: 'flex', gap: '16px', color: 'var(--color-text-muted)', flexWrap: 'wrap' }}>
                  <span>👤 Responsable : <b>{item.responsibleName}</b></span>
                  <span>📅 Date : <b>{new Date(item.date).toLocaleDateString('fr-FR')}</b></span>
                  {item.reference && <span>🔖 Réf : <b>{item.reference}</b></span>}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#4f46e5', fontWeight: 600 }}>
                  <ArrowRight size={14} /> <span>Action : {item.recommendedAction}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
