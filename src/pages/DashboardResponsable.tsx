import React from 'react';
import { FileText, Briefcase, Clock, Percent, Building2, Users, FolderCheck, TrendingUp } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import './DashboardDirecteur.css'; 

export function DashboardResponsable() {
  const { quotes, prestations, sales, installments, clients, services, affaires, users } = useAppContext();
  const { currentUser } = useAuth();

  const currentService = services.find(s => s.id === currentUser?.serviceId);
  const serviceName = currentService?.name || 'Service Non Défini';

  const serviceQuotes = quotes.filter(q => q.serviceId === currentUser?.serviceId);
  const servicePrestations = prestations.filter(p => p.serviceId === currentUser?.serviceId);
  const serviceAffaires = affaires.filter(a => a.serviceId === currentUser?.serviceId);
  const serviceSales = sales.filter(s => s.serviceId === currentUser?.serviceId);
  const serviceCommercials = users.filter(u => u.serviceId === currentUser?.serviceId && u.role === 'Commercial');

  const totalQuotes = serviceQuotes.length;
  const toReviewQuotes = serviceQuotes.filter(q => q.status === 'Brouillon' || q.status === 'Envoyé').length;
  const acceptedQuotes = serviceQuotes.filter(q => q.status === 'Accepté').length;
  const acceptanceRate = totalQuotes > 0 ? Math.round((acceptedQuotes / totalQuotes) * 100) : 0;
  const totalPrestations = servicePrestations.length;

  const todayStr = new Date().toISOString().split('T')[0];
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
      {/* Hero Banner du Service Mis en Avant */}
      <div className="responsable-hero-banner">
        <div className="hero-badge">
          <Building2 size={15} />
          <span>PÔLE D'ACTIVITÉ & GESTION DU SERVICE</span>
        </div>
        <h1 className="hero-title">{serviceName}</h1>
        <p className="hero-subtitle">
          {currentService?.description || 'Vue globale des devis, affaires, prestations et performances de votre service.'}
        </p>
        <div className="hero-meta-tags">
          <span className="hero-tag">
            <Users size={14} color="var(--color-primary)" />
            <strong>{serviceCommercials.length}</strong> Commercial(aux) rattaché(s)
          </span>
          <span className="hero-tag">
            <FolderCheck size={14} color="var(--color-primary)" />
            <strong>{serviceAffaires.length}</strong> Affaire(s) en cours
          </span>
          <span className="hero-tag">
            <Briefcase size={14} color="var(--color-primary)" />
            <strong>{totalPrestations}</strong> Prestation(s) active(s)
          </span>
          <span className="hero-tag">
            <TrendingUp size={14} color="var(--color-success)" />
            <strong>{acceptanceRate}%</strong> Taux de conversion
          </span>
        </div>
      </div>
      
      <div className="widgets-grid">
        <div className="widget-card">
          <div className="widget-icon bg-info">
            <FileText size={32} color="white" />
          </div>
          <div className="widget-content">
            <div className="widget-label">DEVIS DU PÔLE</div>
            <div className="widget-value">{totalQuotes}</div>
          </div>
        </div>
        
        <div className="widget-card">
          <div className="widget-icon bg-primary">
            <Briefcase size={32} color="white" />
          </div>
          <div className="widget-content">
            <div className="widget-label">PRESTATIONS ACTIVES</div>
            <div className="widget-value">{totalPrestations}</div>
          </div>
        </div>

        <div className="widget-card">
          <div className="widget-icon bg-warning">
            <Clock size={32} color="white" />
          </div>
          <div className="widget-content">
            <div className="widget-label">DEVIS EN ATTENTE</div>
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
        <h3>Activité Globale — {serviceName}</h3>
        <div className="table-responsive">
          <table className="data-table responsive-table">
            <thead>
              <tr>
                <th>Pôle / Équipe</th>
                <th>Devis Émis</th>
                <th>Devis Acceptés</th>
                <th>Valeur Totale Engagée</th>
                <th>Taux Conversion</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td data-label="Pôle / Équipe">
                  <strong>Équipe {serviceName}</strong>
                </td>
                <td data-label="Devis Émis">{totalQuotes}</td>
                <td data-label="Devis Acceptés">{acceptedQuotes}</td>
                <td data-label="Valeur Totale Engagée">
                  <strong>{serviceQuotes.filter(q => q.status !== 'Refusé').reduce((sum, q) => sum + q.subtotal, 0).toLocaleString('fr-FR')} FCFA</strong>
                </td>
                <td data-label="Taux Conversion">
                  <span className="badge-status bg-success">{acceptanceRate}%</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h3>Échéances & Créances — {serviceName}</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '12px' }}>
          {overdueTotal > 0 ? `Total restant à percevoir pour le pôle : ${overdueTotal.toLocaleString('fr-FR')} FCFA sur ${overdueInstallments.length} échéance(s).` : `Aucune échéance en retard pour le service ${serviceName}.`}
        </p>
        {overdueInstallments.length > 0 && (
          <div className="table-responsive">
            <table className="data-table responsive-table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Vente</th>
                  <th>Échéance le</th>
                  <th>Retard</th>
                  <th>Restant Dû</th>
                </tr>
              </thead>
              <tbody>
                {overdueInstallments.map(i => (
                  <tr key={i.id}>
                    <td data-label="Client">{getClientName(serviceSales.find(s => s.id === i.saleId)?.clientId || '')}</td>
                    <td data-label="Vente">{getSaleNumber(i.saleId)}</td>
                    <td data-label="Échéance le">{new Date(i.dueDate + 'T00:00:00').toLocaleDateString('fr-FR')}</td>
                    <td data-label="Retard"><span className="badge-status bg-error">{daysLate(i.dueDate)} j</span></td>
                    <td data-label="Restant Dû"><strong>{Math.max(0, i.amount - i.paidAmount).toLocaleString('fr-FR')} FCFA</strong></td>
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
