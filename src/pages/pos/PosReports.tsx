import { useAppContext } from '../../context/AppContext';
import { BarChart3, TrendingUp, ShoppingCart, Printer, BookOpen, PenTool } from 'lucide-react';

export default function PosReports() {
  const { posTransactions, posProducts } = useAppContext();

  const validTransactions = posTransactions.filter(t => t.status === 'Validée');
  const totalRevenue = validTransactions.reduce((sum, t) => sum + t.total, 0);
  const totalTransactions = validTransactions.length;
  const avgBasket = totalTransactions > 0 ? Math.round(totalRevenue / totalTransactions) : 0;

  const isServiceProd = (p?: typeof posProducts[0], desc?: string) => 
    (p && (p.family === 'Service' || (p.reference && p.reference.startsWith('SRV-')))) ||
    (desc && (desc.toLowerCase().includes('photocopie') || desc.toLowerCase().includes('impression') || desc.toLowerCase().includes('scan') || desc.toLowerCase().includes('reliure') || desc.toLowerCase().includes('plastification')));

  const isLivreProd = (p?: typeof posProducts[0]) => 
    p && !isServiceProd(p) && ((p.family && p.family.toLowerCase().startsWith('livre')) || !!(p.isbn && p.isbn.trim()));

  // Family totals
  let revenueLivres = 0;
  let revenueFournitures = 0;
  let revenueServices = 0;
  let totalServiceCopies = 0;

  // Top products & Service breakdown
  const productSales: Record<string, { name: string; quantity: number; revenue: number; family: string }> = {};
  const serviceSales: Record<string, { name: string; quantity: number; revenue: number }> = {};

  validTransactions.forEach(t => {
    t.lines.forEach(l => {
      const product = l.productId ? posProducts.find(p => p.id === l.productId) : undefined;
      const isServ = isServiceProd(product, l.description);
      const isLiv = isLivreProd(product);

      if (isServ) {
        revenueServices += l.total;
        totalServiceCopies += l.quantity;
        const key = l.productId || l.description;
        if (!serviceSales[key]) {
          serviceSales[key] = { name: product?.name || l.description, quantity: 0, revenue: 0 };
        }
        serviceSales[key].quantity += l.quantity;
        serviceSales[key].revenue += l.total;
      } else if (isLiv) {
        revenueLivres += l.total;
      } else {
        revenueFournitures += l.total;
      }

      if (l.productId) {
        if (!productSales[l.productId]) {
          productSales[l.productId] = { 
            name: product?.name || l.description, 
            quantity: 0, 
            revenue: 0,
            family: isServ ? 'Service' : isLiv ? 'Livre' : 'Fourniture'
          };
        }
        productSales[l.productId].quantity += l.quantity;
        productSales[l.productId].revenue += l.total;
      }
    });
  });

  const topProducts = Object.values(productSales).sort((a, b) => b.quantity - a.quantity).slice(0, 10);
  const serviceList = Object.values(serviceSales).sort((a, b) => b.revenue - a.revenue);

  const cardStyle: React.CSSProperties = { background: 'white', borderRadius: 'var(--radius-lg)', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' };

  return (
    <div className="pos-page" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0 }}>Rapports & Statistiques POS</h1>
          <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', margin: '4px 0 0' }}>
            Suivi des ventes globales, ventilation par famille et prestations de reprographie.
          </p>
        </div>
      </div>

      {/* Main KPIs */}
      <div className="pos-kpi-grid">
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: 'var(--color-success-tint)', borderRadius: 'var(--radius-md)', padding: '10px' }}><TrendingUp size={24} color="var(--color-success)" /></div>
            <div><div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Chiffre d'affaires Global</div><div style={{ fontSize: '24px', fontWeight: 700 }}>{totalRevenue.toLocaleString()} FCFA</div></div>
          </div>
        </div>
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: 'var(--color-primary-tint)', borderRadius: 'var(--radius-md)', padding: '10px' }}><ShoppingCart size={24} color="var(--color-primary)" /></div>
            <div><div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Transactions validées</div><div style={{ fontSize: '24px', fontWeight: 700 }}>{totalTransactions}</div></div>
          </div>
        </div>
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: 'var(--color-warning-tint)', borderRadius: 'var(--radius-md)', padding: '10px' }}><BarChart3 size={24} color="var(--color-warning)" /></div>
            <div><div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Panier moyen</div><div style={{ fontSize: '24px', fontWeight: 700 }}>{avgBasket.toLocaleString()} FCFA</div></div>
          </div>
        </div>
      </div>

      {/* Family Breakdown Cards */}
      <div>
        <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px' }}>📊 Répartition du Chiffre d'Affaires par Famille</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          <div style={{ ...cardStyle, borderLeft: '4px solid #2563eb' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)' }}>📚 LIVRES</span>
              <BookOpen size={18} color="#2563eb" />
            </div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#1e40af' }}>{revenueLivres.toLocaleString()} FCFA</div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
              {totalRevenue > 0 ? ((revenueLivres / totalRevenue) * 100).toFixed(1) : 0}% du CA total
            </div>
          </div>

          <div style={{ ...cardStyle, borderLeft: '4px solid #16a34a' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)' }}>✏️ FOURNITURES</span>
              <PenTool size={18} color="#16a34a" />
            </div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#15803d' }}>{revenueFournitures.toLocaleString()} FCFA</div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
              {totalRevenue > 0 ? ((revenueFournitures / totalRevenue) * 100).toFixed(1) : 0}% du CA total
            </div>
          </div>

          <div style={{ ...cardStyle, borderLeft: '4px solid #7c3aed', background: '#faf5ff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#6d28d9' }}>🖨️ PHOTOCOPIES & IMPRESSIONS</span>
              <Printer size={18} color="#7c3aed" />
            </div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#6d28d9' }}>{revenueServices.toLocaleString()} FCFA</div>
            <div style={{ fontSize: '12px', color: '#7c3aed', marginTop: '4px', fontWeight: 500 }}>
              {totalRevenue > 0 ? ((revenueServices / totalRevenue) * 100).toFixed(1) : 0}% du CA &bull; {totalServiceCopies} copies / prestations
            </div>
          </div>
        </div>
      </div>

      {/* Dedicated Services / Photocopies Table */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Printer size={18} color="#7c3aed" /> Détail des Ventes Photocopies, Impressions & Services
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', margin: '2px 0 0' }}>
              Volume de tirage et recettes générées par type de prestation.
            </p>
          </div>
          <span style={{ background: '#ede9fe', color: '#6d28d9', padding: '4px 12px', borderRadius: 'var(--radius-full)', fontSize: '13px', fontWeight: 600 }}>
            Total : {revenueServices.toLocaleString()} FCFA ({totalServiceCopies} unités)
          </span>
        </div>
        <div className="table-responsive">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                <th style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Prestation</th>
                <th style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', textAlign: 'right' }}>Volume / Pages</th>
                <th style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', textAlign: 'right' }}>Recette Totale</th>
              </tr>
            </thead>
            <tbody>
              {serviceList.map((s, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--color-surface-alt)' }}>
                  <td style={{ padding: '10px 12px', fontSize: '14px', fontWeight: 500 }}>{s.name}</td>
                  <td style={{ padding: '10px 12px', fontSize: '14px', textAlign: 'right', fontWeight: 600, color: '#7c3aed' }}>{s.quantity.toLocaleString()}</td>
                  <td style={{ padding: '10px 12px', fontSize: '14px', textAlign: 'right', fontWeight: 700 }}>{s.revenue.toLocaleString()} FCFA</td>
                </tr>
              ))}
              {serviceList.length === 0 && (
                <tr>
                  <td colSpan={3} style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    Aucune prestation de photocopie ou impression enregistrée sur cette période.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top 10 Products */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>🏆 Top 10 Produits & Services les plus vendus</h3>
        <div className="table-responsive">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                <th style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)' }}>#</th>
                <th style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Désignation</th>
                <th style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Famille</th>
                <th style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', textAlign: 'right' }}>Qté vendue</th>
                <th style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', textAlign: 'right' }}>Revenu</th>
              </tr>
            </thead>
            <tbody>
              {topProducts.map((p, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--color-surface-alt)' }}>
                  <td style={{ padding: '10px 12px', fontSize: '14px', color: 'var(--color-text-muted)' }}>{i + 1}</td>
                  <td style={{ padding: '10px 12px', fontSize: '14px', fontWeight: 500 }}>{p.name}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ 
                      padding: '2px 8px', 
                      borderRadius: 'var(--radius-md)', 
                      fontSize: '11px', 
                      fontWeight: 500, 
                      background: p.family === 'Livre' ? 'var(--color-primary-tint)' : p.family === 'Service' ? '#f3e8ff' : 'var(--color-success-tint)', 
                      color: p.family === 'Livre' ? 'var(--color-primary)' : p.family === 'Service' ? '#7c3aed' : 'var(--color-success)' 
                    }}>
                      {p.family === 'Service' ? '🖨️ Service' : p.family}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: '14px', textAlign: 'right' }}>{p.quantity}</td>
                  <td style={{ padding: '10px 12px', fontSize: '14px', textAlign: 'right', fontWeight: 600 }}>{p.revenue.toLocaleString()} FCFA</td>
                </tr>
              ))}
              {topProducts.length === 0 && <tr><td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)' }}>Aucune donnée</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

