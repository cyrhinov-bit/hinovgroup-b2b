import { useState, useMemo } from 'react';
import { Trash2, CheckCircle, DollarSign, Eye, Download, Printer, Filter, Building, User } from 'lucide-react';
import { useAppContext, type Commission } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../components/ConfirmModal';
import { CommissionDetailModal } from '../components/CommissionDetailModal';
import './Commissions.css';

export function Commissions() {
  const { currentUser } = useAuth();
  const { commissions, clients, users, services, sales, affaires, couts, facturePaiements, updateCommissionStatus, deleteCommission } = useAppContext();
  const { confirm } = useConfirm();

  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [serviceFilter, setServiceFilter] = useState('');
  const [commercialFilter, setCommercialFilter] = useState('');
  const [periodFilter, setPeriodFilter] = useState<'ALL' | 'MONTH' | 'QUARTER' | 'YEAR'>('MONTH');
  const [selectedCommission, setSelectedCommission] = useState<Commission | null>(null);

  const isDirection = ['Directeur', 'Directeur adjoint', 'SuperAdmin'].includes(currentUser?.role || '');

  // Scope permissions
  const allowedCommissions = useMemo(() => {
    if (isDirection) return commissions;
    if (currentUser?.role === 'Responsable') {
      return commissions.filter(c => c.serviceId === currentUser?.serviceId);
    }
    return commissions.filter(c => c.commercialId === currentUser?.id);
  }, [commissions, currentUser, isDirection]);

  // Date range filter
  const filteredByPeriod = useMemo(() => {
    const now = new Date();
    return allowedCommissions.filter(c => {
      const cDate = new Date(c.createdAt);
      if (periodFilter === 'MONTH') {
        return cDate.getMonth() === now.getMonth() && cDate.getFullYear() === now.getFullYear();
      }
      if (periodFilter === 'QUARTER') {
        const currentQuarter = Math.floor(now.getMonth() / 3);
        const itemQuarter = Math.floor(cDate.getMonth() / 3);
        return itemQuarter === currentQuarter && cDate.getFullYear() === now.getFullYear();
      }
      if (periodFilter === 'YEAR') {
        return cDate.getFullYear() === now.getFullYear();
      }
      return true;
    });
  }, [allowedCommissions, periodFilter]);

  const getClientName = (id?: string) => clients.find(c => c.id === id)?.name || 'Inconnu';
  const getUserName = (id?: string) => users.find(u => u.id === id)?.name || 'Inconnu';
  const getServiceName = (id?: string) => services.find(s => s.id === id)?.name || 'Général';

  // Helper to compute collection and eligible unlockable commission
  const getCommissionData = (c: Commission) => {
    const sale = sales.find(s => s.id === c.saleId);
    const payments = sale?.id ? facturePaiements.filter(p => p.venteId === sale.id && p.status === 'VALIDE') : [];
    const netReceived = payments.reduce((sum, p) => p.paymentType === 'ENCAISSEMENT' ? sum + p.amount : sum - p.amount, 0);
    const totalTtc = sale?.total || 1;
    const collectionRate = Math.max(0, Math.min(100, Math.round((netReceived / totalTtc) * 100)));
    const eligibleAmount = Math.round((c.commissionAmount * collectionRate) / 100);
    const paidAmount = c.paidAmount || 0;
    const remainingToPay = Math.max(0, c.commissionAmount - paidAmount);

    return {
      sale,
      collectionRate,
      eligibleAmount,
      paidAmount,
      remainingToPay
    };
  };

  const filteredCommissions = useMemo(() => {
    return filteredByPeriod.filter(c => {
      const clientName = getClientName(c.clientId).toLowerCase();
      const commercialName = getUserName(c.commercialId).toLowerCase();
      const saleNum = sales.find(s => s.id === c.saleId)?.saleNumber?.toLowerCase() || '';
      const affRef = affaires.find(a => a.id === c.affaireId)?.reference?.toLowerCase() || '';
      const q = filter.toLowerCase();

      const matchSearch = clientName.includes(q) || commercialName.includes(q) || saleNum.includes(q) || affRef.includes(q);
      const matchStatus = statusFilter ? c.status === statusFilter : true;
      const matchService = serviceFilter ? c.serviceId === serviceFilter : true;
      const matchCommercial = commercialFilter ? c.commercialId === commercialFilter : true;

      return matchSearch && matchStatus && matchService && matchCommercial;
    });
  }, [filteredByPeriod, filter, statusFilter, serviceFilter, commercialFilter, sales, affaires, clients, users]);

  // Aggregate KPIs
  const totalCommissions = filteredCommissions.reduce((sum, c) => sum + c.commissionAmount, 0);
  const totalEligible = filteredCommissions.reduce((sum, c) => sum + getCommissionData(c).eligibleAmount, 0);
  const totalValidees = filteredCommissions.filter(c => c.status === 'Validée').reduce((sum, c) => sum + (c.commissionAmount - (c.paidAmount || 0)), 0);
  const totalPayees = filteredCommissions.reduce((sum, c) => sum + (c.paidAmount || 0), 0);

  const getBadgeColor = (status: string) => {
    switch (status) {
      case 'Payée': return 'bg-success';
      case 'Validée': return 'bg-primary';
      case 'Annulée': return 'bg-danger';
      default: return 'bg-warning';
    }
  };

  const formatMoney = (val: number) => val.toLocaleString('fr-FR') + ' FCFA';

  // Export CSV for Payroll
  const exportCsv = () => {
    const headers = [
      'Date',
      'Commercial',
      'Client',
      'Service',
      'Vente Facture',
      'Affaire',
      'CA Facturé HT',
      'Coûts Déduits HT',
      'Marge Nette HT',
      'Taux Commission %',
      'Commission Totale',
      'Encaissé Client %',
      'Commission Éligible',
      'Déjà Payé',
      'Solde Dû',
      'Statut'
    ];

    const rows = filteredCommissions.map(c => {
      const data = getCommissionData(c);
      const aff = affaires.find(a => a.id === c.affaireId);
      return [
        new Date(c.createdAt).toLocaleDateString('fr-FR'),
        `"${getUserName(c.commercialId)}"`,
        `"${getClientName(c.clientId)}"`,
        `"${getServiceName(c.serviceId)}"`,
        `"${data.sale?.saleNumber || '-'}"`,
        `"${aff?.reference || '-'}"`,
        c.totalHt,
        c.costTotal,
        c.marginAmount,
        c.commissionPercent,
        c.commissionAmount,
        `${data.collectionRate}%`,
        data.eligibleAmount,
        data.paidAmount,
        data.remainingToPay,
        c.status
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `bordereau_commissions_${periodFilter}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="dashboard">
      <div className="commissions-header">
        <div>
          <h2>Module Commissions & Rémunérations</h2>
          <p style={{ color: 'var(--color-text-muted)', margin: '4px 0 0' }}>
            Pilotage des commissions sur marges réelles et déblocages proportionnels aux encaissements
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="commissions-export-btn" onClick={exportCsv} title="Exporter en CSV pour la paie">
            <Download size={16} /> Exporter Bordereau (CSV)
          </button>
          <button className="commissions-export-btn" onClick={() => window.print()} title="Imprimer le bordereau">
            <Printer size={16} /> Imprimer
          </button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="commissions-kpi-grid">
        <div className="widget-card">
          <div className="widget-icon bg-info">
            <DollarSign size={24} color="white" />
          </div>
          <div className="widget-content">
            <div className="widget-label">COMMISSIONS GÉNÉRÉES</div>
            <div className="widget-value">{formatMoney(totalCommissions)}</div>
          </div>
        </div>

        <div className="widget-card">
          <div className="widget-icon bg-primary">
            <CheckCircle size={24} color="white" />
          </div>
          <div className="widget-content">
            <div className="widget-label">DÉBLOCABLES / ÉLIGIBLES</div>
            <div className="widget-value">{formatMoney(totalEligible)}</div>
          </div>
        </div>

        <div className="widget-card">
          <div className="widget-icon bg-warning">
            <DollarSign size={24} color="white" />
          </div>
          <div className="widget-content">
            <div className="widget-label">VALIDÉES À PAYER</div>
            <div className="widget-value">{formatMoney(totalValidees)}</div>
          </div>
        </div>

        <div className="widget-card">
          <div className="widget-icon bg-success">
            <DollarSign size={24} color="white" />
          </div>
          <div className="widget-content">
            <div className="widget-label">TOTAL PAYÉES</div>
            <div className="widget-value">{formatMoney(totalPayees)}</div>
          </div>
        </div>
      </div>

      <div className="card">
        {/* Filters Bar */}
        <div className="commissions-filter-bar">
          <input
            type="text"
            className="table-input"
            placeholder="Rechercher (client, commercial, facture, affaire)..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />

          <select
            className="table-input"
            value={periodFilter}
            onChange={e => setPeriodFilter(e.target.value as any)}
            style={{ maxWidth: '160px' }}
          >
            <option value="MONTH">Mois en cours</option>
            <option value="QUARTER">Trimestre en cours</option>
            <option value="YEAR">Année en cours</option>
            <option value="ALL">Tout l'historique</option>
          </select>

          <select
            className="table-input"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{ maxWidth: '160px' }}
          >
            <option value="">Tous statuts</option>
            <option value="En attente">En attente</option>
            <option value="Validée">Validée</option>
            <option value="Payée">Payée</option>
            <option value="Annulée">Annulée</option>
          </select>

          {isDirection && (
            <>
              <select
                className="table-input"
                value={serviceFilter}
                onChange={e => setServiceFilter(e.target.value)}
                style={{ maxWidth: '180px' }}
              >
                <option value="">Tous les services</option>
                {services.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>

              <select
                className="table-input"
                value={commercialFilter}
                onChange={e => setCommercialFilter(e.target.value)}
                style={{ maxWidth: '180px' }}
              >
                <option value="">Tous les commerciaux</option>
                {users.filter(u => ['Commercial', 'Responsable'].includes(u.role)).map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </>
          )}
        </div>

        {/* Commissions Table */}
        <div className="table-responsive">
          <table className="data-table responsive-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Client / Affaire</th>
                <th>Commercial</th>
                <th>Service</th>
                <th>CA HT</th>
                <th>Marge Réelle</th>
                <th>Commission</th>
                <th>Encaissement Client</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCommissions.map(c => {
                const data = getCommissionData(c);
                const aff = affaires.find(a => a.id === c.affaireId);

                return (
                  <tr key={c.id}>
                    <td data-label="Date">
                      <span style={{ fontSize: '0.85rem', color: '#64748B' }}>
                        {new Date(c.createdAt).toLocaleDateString('fr-FR')}
                      </span>
                    </td>

                    <td data-label="Client / Affaire">
                      <strong>{getClientName(c.clientId)}</strong>
                      <div style={{ fontSize: '0.78rem', color: '#64748B', display: 'flex', gap: '6px', marginTop: '2px' }}>
                        <span>{data.sale?.saleNumber || 'Facture'}</span>
                        {aff && <span className="badge-status bg-info" style={{ fontSize: '0.7rem' }}>{aff.reference}</span>}
                      </div>
                    </td>

                    <td data-label="Commercial">
                      <span style={{ fontWeight: 600 }}>{getUserName(c.commercialId)}</span>
                    </td>

                    <td data-label="Service">
                      <span style={{ fontSize: '0.85rem' }}>{getServiceName(c.serviceId)}</span>
                    </td>

                    <td data-label="CA HT">
                      {c.totalHt.toLocaleString('fr-FR')} F
                    </td>

                    <td data-label="Marge Réelle">
                      <strong>{c.marginAmount.toLocaleString('fr-FR')} F</strong>
                      <div style={{ fontSize: '0.75rem', color: '#059669' }}>{c.marginPercent}%</div>
                    </td>

                    <td data-label="Commission">
                      <div style={{ fontWeight: 700, color: 'var(--color-primary-strong)' }}>
                        {c.commissionAmount.toLocaleString('fr-FR')} F
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
                        Taux: {c.commissionPercent}%
                      </div>
                    </td>

                    <td data-label="Encaissement">
                      <div className="commissions-progress-cell">
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                          <span>{data.collectionRate}% payé</span>
                          <span style={{ fontWeight: 600, color: '#0D9488' }}>{data.eligibleAmount.toLocaleString('fr-FR')} F</span>
                        </div>
                        <div className="commissions-progress-bar">
                          <div className="commissions-progress-fill" style={{ width: `${data.collectionRate}%` }} />
                        </div>
                      </div>
                    </td>

                    <td data-label="Statut">
                      <span className={`badge-status ${getBadgeColor(c.status)}`}>{c.status}</span>
                      {c.paidAmount ? (
                        <div style={{ fontSize: '0.75rem', color: '#059669', marginTop: '2px' }}>
                          Payé: {c.paidAmount.toLocaleString('fr-FR')} F
                        </div>
                      ) : null}
                    </td>

                    <td data-label="Actions">
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                        <button
                          className="icon-button text-teal-600"
                          onClick={() => setSelectedCommission(c)}
                          title="Voir le détail du calcul"
                        >
                          <Eye size={16} />
                        </button>

                        {isDirection && c.status === 'En attente' && (
                          <button
                            className="icon-button text-blue-600"
                            onClick={() => {
                              confirm({
                                title: 'Valider la commission',
                                message: `Valider la commission de ${formatMoney(c.commissionAmount)} pour ${getUserName(c.commercialId)} ?`,
                                confirmLabel: 'Valider',
                                variant: 'success',
                                onConfirm: () => updateCommissionStatus(c.id, 'Validée')
                              });
                            }}
                            title="Valider la commission"
                          >
                            <CheckCircle size={16} />
                          </button>
                        )}

                        {isDirection && c.status === 'Validée' && (
                          <button
                            className="icon-button text-green-600"
                            onClick={() => {
                              confirm({
                                title: 'Confirmer le règlement',
                                message: `Marquer la commission de ${formatMoney(data.remainingToPay)} comme payée à ${getUserName(c.commercialId)} ?`,
                                confirmLabel: 'Payer',
                                variant: 'info',
                                onConfirm: () => updateCommissionStatus(c.id, 'Payée', c.commissionAmount)
                              });
                            }}
                            title="Marquer Payée"
                          >
                            <DollarSign size={16} />
                          </button>
                        )}

                        {isDirection && (
                          <button
                            className="icon-button text-error"
                            onClick={() => confirm({
                              title: 'Supprimer la commission',
                              message: 'Voulez-vous vraiment supprimer cette commission ?',
                              confirmLabel: 'Supprimer',
                              onConfirm: () => deleteCommission(c.id)
                            })}
                            title="Supprimer"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredCommissions.length === 0 && (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)' }}>
                    Aucune commission trouvée pour les critères sélectionnés.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Detail Calculation */}
      {selectedCommission && (
        <CommissionDetailModal
          commission={selectedCommission}
          onClose={() => setSelectedCommission(null)}
        />
      )}
    </div>
  );
}
