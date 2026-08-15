import { FileText, DollarSign, CheckCircle, AlertCircle } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import './DashboardDirecteur.css';

export function DashboardDirecteur() {
  const { quotes, clients, sales, installments } = useAppContext();

  const totalQuotes = quotes.length;
  // Ne comptabiliser dans le Chiffre d'Affaires / Valeur Totale que les devis non refusés (Accepté, Envoyé, Brouillon)
  const totalValue = quotes.filter(q => q.status !== 'Refusé').reduce((acc, q) => acc + q.subtotal, 0);
  const acceptedQuotes = quotes.filter(q => q.status === 'Accepté').length;
  const toReviewQuotes = quotes.filter(q => q.status === 'Envoyé' || q.status === 'Brouillon').length;

  const getClientName = (id: string) => clients.find(c => c.id === id)?.name || 'Inconnu';
  const getSaleNumber = (id: string) => sales.find(s => s.id === id)?.saleNumber || '-';

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const overdueInstallments = installments
    .filter(i => {
      if (i.status === 'Payée' || i.dueDate >= todayStr) return false;
      const sale = sales.find(s => s.id === i.saleId);
      return sale && sale.status !== 'Annulée';
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const overdueTotal = overdueInstallments.reduce((sum, i) => sum + Math.max(0, i.amount - i.paidAmount), 0);
  const daysLate = (dueDate: string) => Math.max(0, Math.floor((today.getTime() - new Date(dueDate + 'T00:00:00').getTime()) / 86400000));
  
  const getBadgeColor = (status: string) => {
    switch (status) {
      case 'Accepté': return 'bg-success';
      case 'Refusé': return 'bg-error';
      case 'Envoyé': return 'bg-primary';
      case 'Brouillon': return 'bg-secondary';
      default: return '';
    }
  };

  const recentQuotes = [...quotes].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);

  return (
    <div className="dashboard">
      <h2>Tableau de bord - Directeur</h2>
      
      <div className="widgets-grid">
        <div className="widget-card">
          <div className="widget-icon bg-info">
            <FileText size={32} color="white" />
          </div>
          <div className="widget-content">
            <div className="widget-label">NOMBRE TOTAL DE DEVIS</div>
            <div className="widget-value">{totalQuotes}</div>
          </div>
        </div>
        
        <div className="widget-card">
          <div className="widget-icon bg-primary">
            <DollarSign size={32} color="white" />
          </div>
          <div className="widget-content">
            <div className="widget-label">VALEUR TOTALE</div>
            <div className="widget-value">{totalValue.toLocaleString('fr-FR')} FCFA</div>
          </div>
        </div>

        <div className="widget-card">
          <div className="widget-icon bg-success">
            <CheckCircle size={32} color="white" />
          </div>
          <div className="widget-content">
            <div className="widget-label">DEVIS ACCEPTÉS</div>
            <div className="widget-value">{acceptedQuotes}</div>
          </div>
        </div>

        <div className="widget-card">
          <div className="widget-icon bg-warning">
            <AlertCircle size={32} color="white" />
          </div>
          <div className="widget-content">
            <div className="widget-label">DEVIS À RÉVISER</div>
            <div className="widget-value">{toReviewQuotes}</div>
          </div>
        </div>
      </div>

      <div className="charts-grid">
        <div className="card chart-card">
          <h3>Devis par service</h3>
          <div className="chart-placeholder">
            [Graphique à barres simulé]
          </div>
        </div>
        <div className="card chart-card">
          <h3>Devis par statut</h3>
          <div className="chart-placeholder">
            [Graphique circulaire simulé]
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Activité récente</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Client</th>
              <th>Sujet</th>
              <th>Montant</th>
              <th>Statut</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {recentQuotes.map(q => (
              <tr key={q.id}>
                <td>{getClientName(q.clientId)}</td>
                <td>{q.subject}</td>
                <td>{q.subtotal.toLocaleString('fr-FR')} FCFA</td>
                <td><span className={`badge-status ${getBadgeColor(q.status)}`}>{q.status}</span></td>
                <td>{q.date}</td>
              </tr>
            ))}
            {recentQuotes.length === 0 && (
              <tr><td colSpan={5} style={{textAlign: 'center', padding: '16px'}}>Aucune activité.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>Suivi des échéances en retard</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '12px' }}>
          {overdueTotal > 0 ? `Total restant à percevoir : ${overdueTotal.toLocaleString('fr-FR')} FCFA sur ${overdueInstallments.length} échéance(s).` : 'Aucune échéance en retard.'}
        </p>
        {overdueInstallments.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Vente</th>
                <th>Échéance le</th>
                <th>Retard</th>
                <th>Restant</th>
              </tr>
            </thead>
            <tbody>
              {overdueInstallments.map(i => (
                <tr key={i.id}>
                  <td>{getClientName(sales.find(s => s.id === i.saleId)?.clientId || '')}</td>
                  <td>{getSaleNumber(i.saleId)}</td>
                  <td>{new Date(i.dueDate + 'T00:00:00').toLocaleDateString('fr-FR')}</td>
                  <td><span className="badge-status bg-error">{daysLate(i.dueDate)} j</span></td>
                  <td>{Math.max(0, i.amount - i.paidAmount).toLocaleString('fr-FR')} FCFA</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
