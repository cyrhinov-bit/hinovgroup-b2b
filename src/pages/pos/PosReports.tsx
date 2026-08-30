import { useAppContext } from '../../context/AppContext';
import { BarChart3, TrendingUp, ShoppingCart } from 'lucide-react';

export default function PosReports() {
  const { posTransactions, posProducts } = useAppContext();

  const validTransactions = posTransactions.filter(t => t.status === 'Validée');
  const totalRevenue = validTransactions.reduce((sum, t) => sum + t.total, 0);
  const totalTransactions = validTransactions.length;
  const avgBasket = totalTransactions > 0 ? Math.round(totalRevenue / totalTransactions) : 0;

  // Top 10 products by quantity sold
  const productSales: Record<string, { name: string; quantity: number; revenue: number }> = {};
  validTransactions.forEach(t => {
    t.lines.forEach(l => {
      if (l.productId) {
        if (!productSales[l.productId]) {
          const product = posProducts.find(p => p.id === l.productId);
          productSales[l.productId] = { name: product?.name || l.description, quantity: 0, revenue: 0 };
        }
        productSales[l.productId].quantity += l.quantity;
        productSales[l.productId].revenue += l.total;
      }
    });
  });
  const topProducts = Object.values(productSales).sort((a, b) => b.quantity - a.quantity).slice(0, 10);

  const cardStyle: React.CSSProperties = { background: 'white', borderRadius: 'var(--radius-lg)', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' };

  return (
    <div className="pos-page">
      <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '20px' }}>Rapports POS</h1>
      <div className="pos-kpi-grid">
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: 'var(--color-success-tint)', borderRadius: 'var(--radius-md)', padding: '10px' }}><TrendingUp size={24} color="var(--color-success)" /></div>
            <div><div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Chiffre d'affaires</div><div style={{ fontSize: '24px', fontWeight: 700 }}>{totalRevenue.toLocaleString()} FCFA</div></div>
          </div>
        </div>
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: 'var(--color-primary-tint)', borderRadius: 'var(--radius-md)', padding: '10px' }}><ShoppingCart size={24} color="var(--color-primary)" /></div>
            <div><div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Transactions</div><div style={{ fontSize: '24px', fontWeight: 700 }}>{totalTransactions}</div></div>
          </div>
        </div>
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: 'var(--color-warning-tint)', borderRadius: 'var(--radius-md)', padding: '10px' }}><BarChart3 size={24} color="var(--color-warning)" /></div>
            <div><div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Panier moyen</div><div style={{ fontSize: '24px', fontWeight: 700 }}>{avgBasket.toLocaleString()} FCFA</div></div>
          </div>
        </div>
      </div>
      <div style={cardStyle}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Top 10 Produits</h3>
        <div className="table-responsive">
<table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}><th style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)' }}>#</th><th style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Produit</th><th style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', textAlign: 'right' }}>Qté vendue</th><th style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', textAlign: 'right' }}>Revenu</th></tr></thead>
          <tbody>
            {topProducts.map((p, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--color-surface-alt)' }}>
                <td style={{ padding: '10px 12px', fontSize: '14px', color: 'var(--color-text-muted)' }}>{i + 1}</td>
                <td style={{ padding: '10px 12px', fontSize: '14px' }}>{p.name}</td>
                <td style={{ padding: '10px 12px', fontSize: '14px', textAlign: 'right' }}>{p.quantity}</td>
                <td style={{ padding: '10px 12px', fontSize: '14px', textAlign: 'right', fontWeight: 500 }}>{p.revenue.toLocaleString()} FCFA</td>
              </tr>
            ))}
            {topProducts.length === 0 && <tr><td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)' }}>Aucune donnée</td></tr>}
          </tbody>
        </table>
</div>
      </div>
    </div>
  );
}
