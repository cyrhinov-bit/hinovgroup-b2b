import { FileText, Briefcase, Clock, Percent } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import './DashboardDirecteur.css'; 

export function DashboardResponsable() {
  const { quotes, prestations, sales, installments, clients } = useAppContext();
  const { currentUser } = useAuth();

  const serviceQuotes = quotes.filter(q => q.serviceId === currentUser?.serviceId);
  const servicePrestations = prestations.filter(p => p.serviceId === currentUser?.serviceId);

  const totalQuotes = serviceQuotes.length;
  const toReviewQuotes = serviceQuotes.filter(q => q.status === 'Brouillon' || q.status === 'Envoyé').length;
  const acceptedQuotes = serviceQuotes.filter(q => q.status === 'Accepté').length;
  const acceptanceRate = totalQuotes > 0 ? Math.round((acceptedQuotes / totalQuotes) * 100) : 0;
  const totalPrestations = servicePrestations.length;

  const todayStr = new Date().toISOString().split('T')[0];
  const serviceSales = sales.filter(s => s.serviceId === currentUser?.serviceId);
  const today = new Date();
  const overdueInstallments = installments
    .filter(i => {
      if (i.status === 'Payée' || i.dueDate >= todayStr) return false;
      const sale = serviceSales.find(s => s.id === i.saleId);
      return sale && sale.status !== 'Annulée';
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const overdueTotal = overdueInstallments.reduce((sum, i) => sum + Math.max(0, i.amount - i.paidAmount), 0);
  const daysLate = (dueDate: string) => Math.max(0, Math.floor((today.getTime() - new Date(dueDate + 'T00:00:00').getTime()) / 86400000));
  const getClientName = (id: string) => clients.find(c => c.id === id)?.name || 'Inconnu';
  const getSaleNumber = (id: string) => serviceSales.find(s => s.id === id)?.saleNumber || '-';

  return (
    <div className="dashboard">
      <h2>Tableau de bord - Responsable</h2>
      
      <div className="widgets-grid">
        <div className="widget-card">
          <div className="widget-icon bg-info">
            <FileText size={32} color="white" />
          </div>
          <div className="widget-content">
            <div className="widget-label">DEVIS DU SERVICE</div>
            <div className="widget-value">{totalQuotes}</div>
          </div>
        </div>
        
        <div className="widget-card">
          <div className="widget-icon bg-primary">
            <Briefcase size={32} color="white" />
          </div>
          <div className="widget-content">
            <div className="widget-label">PRESTATIONS</div>
            <div className="widget-value">{totalPrestations}</div>
          </div>
        </div>

        <div className="widget-card">
          <div className="widget-icon bg-warning">
            <Clock size={32} color="white" />
          </div>
          <div className="widget-content">
            <div className="widget-label">DEVIS À VALIDER</div>
            <div className="widget-value">{toReviewQuotes}</div>
          </div>
        </div>

        <div className="widget-card">
          <div className="widget-icon bg-success">
            <Percent size={32} color="white" />
          </div>
          <div className="widget-content">
            <div className="widget-label">TAUX D'ACCEPTATION</div>
            <div className="widget-value">{acceptanceRate}%</div>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Activité du service (Simulée)</h3>
        <div className="table-responsive">
<table className="data-table">
          <thead>
            <tr>
              <th>Responsable</th>
              <th>Devis Créés</th>
              <th>Devis Acceptés</th>
              <th>Valeur Totale</th>
              <th>Taux Conv.</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>L'équipe du Service</td>
              <td>{totalQuotes}</td>
              <td>{acceptedQuotes}</td>
              <td>{serviceQuotes.filter(q => q.status !== 'Refusé').reduce((sum, q) => sum + q.subtotal, 0).toLocaleString('fr-FR')} FCFA</td>
              <td><span className="badge-status bg-success">{acceptanceRate}%</span></td>
            </tr>
          </tbody>
        </table>
</div>
      </div>

      <div className="card">
        <h3>Échéances en retard du service</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '12px' }}>
          {overdueTotal > 0 ? `Total restant à percevoir : ${overdueTotal.toLocaleString('fr-FR')} FCFA sur ${overdueInstallments.length} échéance(s).` : 'Aucune échéance en retard.'}
        </p>
        {overdueInstallments.length > 0 && (
          <div className="table-responsive">
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
                  <td>{getClientName(serviceSales.find(s => s.id === i.saleId)?.clientId || '')}</td>
                  <td>{getSaleNumber(i.saleId)}</td>
                  <td>{new Date(i.dueDate + 'T00:00:00').toLocaleDateString('fr-FR')}</td>
                  <td><span className="badge-status bg-error">{daysLate(i.dueDate)} j</span></td>
                  <td>{Math.max(0, i.amount - i.paidAmount).toLocaleString('fr-FR')} FCFA</td>
                </tr>
              ))}
            </tbody>
          </table>
</div>
        )}
      </div>
    </div>
  );
}
