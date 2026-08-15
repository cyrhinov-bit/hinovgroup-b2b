import { useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { TrendingUp, ShoppingCart, RotateCcw, Wallet, CreditCard, Smartphone, Layers, ChevronDown, ChevronRight, DollarSign } from 'lucide-react';
import { todayLocalKey, toLocalDayKey } from '../../lib/dates';

type Period = 'today' | '7days' | '30days' | 'custom';

export default function PosFinance() {
  const { posTransactions, posCashSessions, posPayments, posProducts, posReturns } = useAppContext();
  const [period, setPeriod] = useState<Period>('today');
  const [startDate, setStartDate] = useState(todayLocalKey());
  const [endDate, setEndDate] = useState(todayLocalKey());
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  const getDateRange = (): { start: string; end: string } => {
    const today = new Date();
    switch (period) {
      case 'today': return { start: todayLocalKey(), end: todayLocalKey() };
      case '7days': {
        const d = new Date(today); d.setDate(d.getDate() - 6);
        return { start: toLocalDayKey(d), end: todayLocalKey() };
      }
      case '30days': {
        const d = new Date(today); d.setDate(d.getDate() - 29);
        return { start: toLocalDayKey(d), end: todayLocalKey() };
      }
      case 'custom': return { start: startDate, end: endDate };
    }
  };

  const { start, end } = getDateRange();

  const validTx = posTransactions.filter(t => t.status === 'Validée');
  const activeReturns = posReturns.filter(r => r.status === 'Traité');

  const inRange = (dateStr: string) => toLocalDayKey(dateStr) >= start && toLocalDayKey(dateStr) <= end;

  const rangeValidTx = validTx.filter(t => inRange(t.date));
  const rangeReturns = activeReturns.filter(r => inRange(r.date));

  const totalRevenue = rangeValidTx.reduce((s, t) => s + t.total, 0);
  const totalReturns = rangeReturns.reduce((s, r) => s + r.totalRefund, 0);
  const totalReturnCount = rangeReturns.length;
  const netRevenue = totalRevenue - totalReturns;
  const totalTxCount = rangeValidTx.length;
  const avgBasket = totalTxCount > 0 ? Math.round(totalRevenue / totalTxCount) : 0;

  const rangePayments = posPayments.filter(p => rangeValidTx.some(t => t.id === p.transactionId));
  const paymentTotals = { 'Espèces': 0, 'Carte': 0, 'Mobile Money': 0, 'Mixte': 0 };
  rangePayments.forEach(p => { paymentTotals[p.method] += p.amount; });

  const rangeSessions = posCashSessions.filter(s => inRange(s.openedAt));
  const closedSessions = rangeSessions.filter(s => s.status === 'Fermée');

  const productMargins: Record<string, { name: string; qtySold: number; totalRevenue: number; totalCost: number; purchasePrice: number; sellingPrice: number }> = {};
  // Retours de la période : à déduire des marges (quantités et revenus rendus)
  rangeReturns.forEach(r => {
    r.lines.forEach(l => {
      if (!l.productId) return;
      const prod = posProducts.find(p => p.id === l.productId);
      if (!productMargins[l.productId]) {
        productMargins[l.productId] = {
          name: prod?.name || l.description,
          qtySold: 0, totalRevenue: 0, totalCost: 0,
          purchasePrice: prod?.purchasePrice || 0,
          sellingPrice: prod?.sellingPrice || l.unitPrice,
        };
      }
      productMargins[l.productId].qtySold -= l.quantity;
      productMargins[l.productId].totalRevenue -= l.total;
      productMargins[l.productId].totalCost -= (prod?.purchasePrice || 0) * l.quantity;
    });
  });
  rangeValidTx.forEach(t => {
    t.lines.forEach(l => {
      if (l.productId) {
        const prod = posProducts.find(p => p.id === l.productId);
        if (!productMargins[l.productId]) {
          productMargins[l.productId] = {
            name: prod?.name || l.description,
            qtySold: 0, totalRevenue: 0, totalCost: 0,
            purchasePrice: prod?.purchasePrice || 0,
            sellingPrice: prod?.sellingPrice || l.unitPrice,
          };
        }
        productMargins[l.productId].qtySold += l.quantity;
        productMargins[l.productId].totalRevenue += l.total;
        productMargins[l.productId].totalCost += (prod?.purchasePrice || 0) * l.quantity;
      }
    });
  });
  const margins = Object.values(productMargins).sort((a, b) => (b.totalRevenue - b.totalCost) - (a.totalRevenue - a.totalCost));
  const totalMargin = margins.reduce((s, m) => s + (m.totalRevenue - m.totalCost), 0);

  // Daily movements
  const dailyMap = new Map<string, { ventes: number; retours: number; nbVentes: number; nbRetours: number; payments: Record<string, number> }>();
  const dStart = new Date(`${start}T00:00:00`);
  const dEnd = new Date(`${end}T00:00:00`);
  for (let d = new Date(dStart); d <= dEnd; d.setDate(d.getDate() + 1)) {
    const key = toLocalDayKey(d);
    dailyMap.set(key, { ventes: 0, retours: 0, nbVentes: 0, nbRetours: 0, payments: { 'Espèces': 0, 'Carte': 0, 'Mobile Money': 0, 'Mixte': 0 } });
  }
  rangeValidTx.forEach(t => {
    const key = toLocalDayKey(t.date);
    const entry = dailyMap.get(key);
    if (entry) { entry.ventes += t.total; entry.nbVentes++; }
  });
  rangeReturns.forEach(r => {
    const key = toLocalDayKey(r.date);
    const entry = dailyMap.get(key);
    if (entry) { entry.retours += r.totalRefund; entry.nbRetours++; }
  });
  rangePayments.forEach(p => {
    const tx = rangeValidTx.find(t => t.id === p.transactionId);
    if (tx) {
      const key = toLocalDayKey(tx.date);
      const entry = dailyMap.get(key);
      if (entry) entry.payments[p.method] += p.amount;
    }
  });

  const dailyEntries = Array.from(dailyMap.entries()).sort((a, b) => b[0].localeCompare(a[0]));

  const cardStyle: React.CSSProperties = { background: 'white', borderRadius: 'var(--radius-lg)', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' });

  return (
    <div style={{ padding: '24px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '24px' }}>Finance POS</h1>

      {/* Period filter */}
      <div style={{ ...cardStyle, marginBottom: '24px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 600, fontSize: '14px' }}>Période :</span>
        {(['today', '7days', '30days', 'custom'] as Period[]).map(p => (
          <button key={p} onClick={() => setPeriod(p)} style={{
            padding: '6px 16px', borderRadius: 'var(--radius-md)', border: '1px solid', cursor: 'pointer', fontSize: '13px', fontWeight: 500,
            borderColor: period === p ? 'var(--color-primary)' : 'var(--color-border)',
            backgroundColor: period === p ? 'var(--color-primary)' : 'white',
            color: period === p ? 'white' : 'var(--color-text)',
          }}>
            {p === 'today' ? "Aujourd'hui" : p === '7days' ? '7 jours' : p === '30days' ? '30 jours' : 'Personnalisé'}
          </button>
        ))}
        {period === 'custom' && (
          <>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ padding: '6px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: '13px' }} />
            <span style={{ color: 'var(--color-text-muted)' }}>à</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ padding: '6px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: '13px' }} />
          </>
        )}
        <span style={{ marginLeft: 'auto', color: 'var(--color-text-muted)', fontSize: '13px' }}>{start} → {end}</span>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: 'var(--color-success-tint)', borderRadius: 'var(--radius-md)', padding: '10px' }}><TrendingUp size={22} color="var(--color-success)" /></div>
            <div><div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>CA Net</div><div style={{ fontSize: '22px', fontWeight: 700 }}>{netRevenue.toLocaleString()} FCFA</div></div>
          </div>
        </div>
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: 'var(--color-primary-tint)', borderRadius: 'var(--radius-md)', padding: '10px' }}><ShoppingCart size={22} color="var(--color-primary)" /></div>
            <div><div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Transactions</div><div style={{ fontSize: '22px', fontWeight: 700 }}>{totalTxCount}</div><div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Panier moyen: {avgBasket.toLocaleString()} FCFA</div></div>
          </div>
        </div>
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: 'var(--color-warning-tint)', borderRadius: 'var(--radius-md)', padding: '10px' }}><RotateCcw size={22} color="var(--color-warning)" /></div>
            <div><div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Retours</div><div style={{ fontSize: '22px', fontWeight: 700 }}>{totalReturnCount}</div><div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>-{totalReturns.toLocaleString()} FCFA</div></div>
          </div>
        </div>
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: 'var(--color-success-tint)', borderRadius: 'var(--radius-md)', padding: '10px' }}><DollarSign size={22} color="var(--color-success)" /></div>
            <div><div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Marge brute</div><div style={{ fontSize: '22px', fontWeight: 700 }}>{totalMargin.toLocaleString()} FCFA</div></div>
          </div>
        </div>
      </div>

      {/* Payment methods */}
      <div style={{ ...cardStyle, marginBottom: '24px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Répartition par mode de paiement</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
          {[
            { label: 'Espèces', value: paymentTotals['Espèces'], icon: <Wallet size={18} />, color: 'var(--color-success)', bg: 'var(--color-success-tint)' },
            { label: 'Carte', value: paymentTotals['Carte'], icon: <CreditCard size={18} />, color: 'var(--color-primary)', bg: 'var(--color-primary-tint)' },
            { label: 'Mobile Money', value: paymentTotals['Mobile Money'], icon: <Smartphone size={18} />, color: 'var(--color-warning)', bg: 'var(--color-warning-tint)' },
            { label: 'Mixte', value: paymentTotals['Mixte'], icon: <Layers size={18} />, color: 'var(--color-secondary)', bg: 'var(--color-secondary-tint)' },
          ].map(p => (
            <div key={p.label} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', borderRadius: 'var(--radius-md)', background: p.bg }}>
              <span style={{ color: p.color }}>{p.icon}</span>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{p.label}</div>
                <div style={{ fontSize: '16px', fontWeight: 600 }}>{p.value.toLocaleString()} FCFA</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Daily movements */}
      <div style={{ ...cardStyle, marginBottom: '24px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Mouvements journaliers</h3>
        <div className="table-responsive">
<table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
              <th style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Date</th>
              <th style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', textAlign: 'right' }}>Ventes</th>
              <th style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', textAlign: 'right' }}>Retours</th>
              <th style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', textAlign: 'right' }}>CA Net</th>
              <th style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Espèces</th>
              <th style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Carte</th>
              <th style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Mobile</th>
              <th style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)' }}></th>
            </tr>
          </thead>
          <tbody>
            {dailyEntries.map(([date, data]) => {
              const daySessions = rangeSessions.filter(s => toLocalDayKey(s.openedAt) === date);
              const isExpanded = expandedDay === date;
              return (
                <>
                  <tr key={date} style={{ borderBottom: '1px solid var(--color-surface-alt)', cursor: 'pointer' }} onClick={() => setExpandedDay(isExpanded ? null : date)}>
                    <td style={{ padding: '10px 12px', fontSize: '14px', fontWeight: 500 }}>{formatDate(date)}</td>
                    <td style={{ padding: '10px 12px', fontSize: '14px', textAlign: 'right', color: 'var(--color-success)' }}>{data.ventes.toLocaleString()} FCFA</td>
                    <td style={{ padding: '10px 12px', fontSize: '14px', textAlign: 'right', color: data.retours > 0 ? 'var(--color-error)' : 'var(--color-text-muted)' }}>{data.retours > 0 ? `-${data.retours.toLocaleString()} FCFA` : '—'}</td>
                    <td style={{ padding: '10px 12px', fontSize: '14px', textAlign: 'right', fontWeight: 600 }}>{(data.ventes - data.retours).toLocaleString()} FCFA</td>
                    <td style={{ padding: '10px 12px', fontSize: '13px', color: 'var(--color-text-muted)' }}>{data.payments['Espèces'].toLocaleString()}</td>
                    <td style={{ padding: '10px 12px', fontSize: '13px', color: 'var(--color-text-muted)' }}>{data.payments['Carte'].toLocaleString()}</td>
                    <td style={{ padding: '10px 12px', fontSize: '13px', color: 'var(--color-text-muted)' }}>{data.payments['Mobile Money'].toLocaleString()}</td>
                    <td style={{ padding: '10px 12px' }}>{isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</td>
                  </tr>
                  {isExpanded && (
                    <tr key={`${date}-detail`}>
                      <td colSpan={8} style={{ padding: '0 12px 12px 12px', background: 'var(--color-surface-alt)' }}>
                        <div style={{ padding: '12px', borderRadius: 'var(--radius-md)', background: 'white', border: '1px solid var(--color-border)' }}>
                          <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Transactions du jour ({data.nbVentes} vente{data.nbVentes > 1 ? 's' : ''})</div>
                          {daySessions.length > 0 && (
                            <div style={{ marginBottom: '8px' }}>
                              {daySessions.map(s => (
                                <div key={s.id} style={{ display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                                  <span>Session: fond {s.initialFund.toLocaleString()} FCFA</span>
                                  {s.status === 'Fermée' && (
                                    <>
                                      <span>Clôturé: {s.finalAmount?.toLocaleString()} FCFA</span>
                                      <span style={{ color: (s.difference || 0) === 0 ? 'var(--color-success)' : 'var(--color-error)', fontWeight: 600 }}>
                                        Écart: {s.difference?.toLocaleString() || 0} FCFA
                                      </span>
                                    </>
                                  )}
                                  {s.status === 'Ouverte' && <span style={{ color: 'var(--color-warning)' }}>En cours</span>}
                                </div>
                              ))}
                            </div>
                          )}
                          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                            Espèces: {data.payments['Espèces'].toLocaleString()} | Carte: {data.payments['Carte'].toLocaleString()} | Mobile: {data.payments['Mobile Money'].toLocaleString()}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
            {dailyEntries.length === 0 && (
              <tr><td colSpan={8} style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)' }}>Aucune donnée pour cette période</td></tr>
            )}
          </tbody>
        </table>
</div>
      </div>

      {/* Rapprochement caisse */}
      {closedSessions.length > 0 && (
        <div style={{ ...cardStyle, marginBottom: '24px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Rapprochement caisse</h3>
          <div className="table-responsive">
<table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                <th style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Session</th>
                <th style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Ouverture</th>
                <th style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Fond initial</th>
                <th style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', textAlign: 'right' }}>Ventes</th>
                <th style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', textAlign: 'right' }}>Attendu</th>
                <th style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', textAlign: 'right' }}>Réel</th>
                <th style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', textAlign: 'right' }}>Écart</th>
              </tr>
            </thead>
            <tbody>
              {closedSessions.map(s => {
                const sessionTx = validTx.filter(t => t.sessionId === s.id);
                const sessionReturns = activeReturns.filter(r => r.transactionId && posTransactions.find(t => t.id === r.transactionId)?.sessionId === s.id);
                const sessionVentes = sessionTx.reduce((sum, t) => sum + t.total, 0);
                const sessionRetours = sessionReturns.reduce((sum, r) => sum + r.totalRefund, 0);
                const expected = s.expectedAmount ?? (s.initialFund + sessionVentes - sessionRetours);
                const diff = s.difference ?? ((s.finalAmount || 0) - expected);
                return (
                  <tr key={s.id} style={{ borderBottom: '1px solid var(--color-surface-alt)' }}>
                    <td style={{ padding: '10px 12px', fontSize: '14px', fontFamily: 'monospace' }}>{s.id.slice(0, 8)}</td>
                    <td style={{ padding: '10px 12px', fontSize: '13px', color: 'var(--color-text-muted)' }}>{new Date(s.openedAt).toLocaleString('fr-FR')}</td>
                    <td style={{ padding: '10px 12px', fontSize: '14px' }}>{s.initialFund.toLocaleString()} FCFA</td>
                    <td style={{ padding: '10px 12px', fontSize: '14px', textAlign: 'right', color: 'var(--color-success)' }}>+{sessionVentes.toLocaleString()} FCFA</td>
                    <td style={{ padding: '10px 12px', fontSize: '14px', textAlign: 'right', fontWeight: 600 }}>{expected.toLocaleString()} FCFA</td>
                    <td style={{ padding: '10px 12px', fontSize: '14px', textAlign: 'right', fontWeight: 600 }}>{(s.finalAmount || 0).toLocaleString()} FCFA</td>
                    <td style={{ padding: '10px 12px', fontSize: '14px', textAlign: 'right', fontWeight: 600, color: diff === 0 ? 'var(--color-success)' : 'var(--color-error)' }}>
                      {diff === 0 ? 'Équilibré' : `${diff > 0 ? '+' : ''}${diff.toLocaleString()} FCFA`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
</div>
        </div>
      )}

      {/* Marges */}
      {margins.length > 0 && (
        <div style={cardStyle}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Analyse des marges</h3>
          <div className="table-responsive">
<table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                <th style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Produit</th>
                <th style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', textAlign: 'right' }}>Qté</th>
                <th style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', textAlign: 'right' }}>Revenu</th>
                <th style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', textAlign: 'right' }}>Coût</th>
                <th style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', textAlign: 'right' }}>Marge</th>
                <th style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', textAlign: 'right' }}>% Marge</th>
              </tr>
            </thead>
            <tbody>
              {margins.map((m, i) => {
                const margin = m.totalRevenue - m.totalCost;
                const marginPct = m.totalRevenue > 0 ? Math.round((margin / m.totalRevenue) * 100) : 0;
                return (
                  <tr key={i} style={{ borderBottom: '1px solid var(--color-surface-alt)' }}>
                    <td style={{ padding: '10px 12px', fontSize: '14px' }}>{m.name}</td>
                    <td style={{ padding: '10px 12px', fontSize: '14px', textAlign: 'right' }}>{m.qtySold}</td>
                    <td style={{ padding: '10px 12px', fontSize: '14px', textAlign: 'right' }}>{m.totalRevenue.toLocaleString()} FCFA</td>
                    <td style={{ padding: '10px 12px', fontSize: '14px', textAlign: 'right', color: 'var(--color-text-muted)' }}>{m.totalCost.toLocaleString()} FCFA</td>
                    <td style={{ padding: '10px 12px', fontSize: '14px', textAlign: 'right', fontWeight: 600, color: margin >= 0 ? 'var(--color-success)' : 'var(--color-error)' }}>
                      {margin.toLocaleString()} FCFA
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: '14px', textAlign: 'right', fontWeight: 500 }}>{marginPct}%</td>
                  </tr>
                );
              })}
              <tr style={{ borderTop: '2px solid var(--color-border)', fontWeight: 700 }}>
                <td style={{ padding: '10px 12px', fontSize: '14px' }}>TOTAL</td>
                <td></td>
                <td style={{ padding: '10px 12px', fontSize: '14px', textAlign: 'right' }}>{margins.reduce((s, m) => s + m.totalRevenue, 0).toLocaleString()} FCFA</td>
                <td style={{ padding: '10px 12px', fontSize: '14px', textAlign: 'right' }}>{margins.reduce((s, m) => s + m.totalCost, 0).toLocaleString()} FCFA</td>
                <td style={{ padding: '10px 12px', fontSize: '14px', textAlign: 'right', color: totalMargin >= 0 ? 'var(--color-success)' : 'var(--color-error)' }}>{totalMargin.toLocaleString()} FCFA</td>
                <td></td>
              </tr>
            </tbody>
          </table>
</div>
        </div>
      )}
    </div>
  );
}
