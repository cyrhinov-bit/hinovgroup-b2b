import { useAppContext } from '../../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { Package, Warehouse, TrendingUp, AlertTriangle, DollarSign, RotateCcw } from 'lucide-react';
import { todayLocalKey, toLocalDayKey } from '../../lib/dates';

export default function DashboardPos() {
  const { posProducts, posTransactions, posCashSessions, posReturns } = useAppContext();
  const navigate = useNavigate();

  const totalProducts = posProducts.length;
  const totalStockValue = posProducts.reduce((sum, p) => sum + p.purchasePrice * p.quantity, 0);
  const lowStockProducts = posProducts.filter(p => p.quantity <= p.minStock && p.minStock > 0);
  const today = todayLocalKey();
  const todayTransactions = posTransactions.filter(t => toLocalDayKey(t.date) === today && t.status === 'Validée');
  const todayRevenue = todayTransactions.reduce((sum, t) => sum + t.total, 0);
  const todayReturns = posReturns.filter(r => toLocalDayKey(r.date) === today && r.status === 'Traité');
  const todayRefunds = todayReturns.reduce((s, r) => s + r.totalRefund, 0);
  const openSession = posCashSessions.find(s => s.status === 'Ouverte');

  return (
    <div style={{ padding: '24px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '24px' }}>Dashboard POS</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: 'white', borderRadius: 'var(--radius-lg)', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: 'var(--color-primary-tint)', borderRadius: 'var(--radius-md)', padding: '10px' }}><Package size={24} color="var(--color-primary)" /></div>
            <div><div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Produits</div><div style={{ fontSize: '24px', fontWeight: 700 }}>{totalProducts}</div></div>
          </div>
        </div>
        <div style={{ background: 'white', borderRadius: 'var(--radius-lg)', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: 'var(--color-success-tint)', borderRadius: 'var(--radius-md)', padding: '10px' }}><TrendingUp size={24} color="var(--color-success)" /></div>
            <div><div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>CA Aujourd'hui</div><div style={{ fontSize: '24px', fontWeight: 700 }}>{todayRevenue.toLocaleString()} FCFA</div></div>
          </div>
        </div>
        <div style={{ background: 'white', borderRadius: 'var(--radius-lg)', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: 'var(--color-warning-tint)', borderRadius: 'var(--radius-md)', padding: '10px' }}><Warehouse size={24} color="var(--color-warning)" /></div>
            <div><div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Valeur Stock</div><div style={{ fontSize: '24px', fontWeight: 700 }}>{totalStockValue.toLocaleString()} FCFA</div></div>
          </div>
        </div>
        <div style={{ background: 'white', borderRadius: 'var(--radius-lg)', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: 'var(--color-error-tint)', borderRadius: 'var(--radius-md)', padding: '10px' }}><AlertTriangle size={24} color="var(--color-error)" /></div>
            <div><div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Alertes Stock</div><div style={{ fontSize: '24px', fontWeight: 700 }}>{lowStockProducts.length}</div></div>
          </div>
        </div>
        <div style={{ background: 'white', borderRadius: 'var(--radius-lg)', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: 'var(--color-warning-tint)', borderRadius: 'var(--radius-md)', padding: '10px' }}><RotateCcw size={24} color="var(--color-warning-strong)" /></div>
            <div><div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Retours Aujourd'hui</div><div style={{ fontSize: '24px', fontWeight: 700 }}>{todayReturns.length} ({todayRefunds.toLocaleString()} FCFA)</div></div>
          </div>
        </div>
      </div>
      <div style={{ background: 'white', borderRadius: 'var(--radius-lg)', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>Session Caisse</h3>
        {openSession ? (
          <div style={{ color: 'var(--color-success)', fontWeight: 500 }}>Session ouverte - Fond: {openSession.initialFund.toLocaleString()} FCFA</div>
        ) : (
          <div style={{ color: 'var(--color-text-muted)' }}>Aucune session ouverte</div>
        )}
      </div>
      <div style={{ background: 'white', borderRadius: 'var(--radius-lg)', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginTop: '16px', cursor: 'pointer' }} onClick={() => navigate('/pos/finance')}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: 'var(--color-success-tint)', borderRadius: 'var(--radius-md)', padding: '10px' }}><DollarSign size={24} color="var(--color-success)" /></div>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 600 }}>Module Finance</div>
            <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Consultez les mouvements financiers, rapprochement caisse et marges</div>
          </div>
          <div style={{ marginLeft: 'auto', color: 'var(--color-success)', fontWeight: 500, fontSize: '14px' }}>→ Voir</div>
        </div>
      </div>
    </div>
  );
}
