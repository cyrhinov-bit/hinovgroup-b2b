import React, { useState } from 'react';
import { Search, DollarSign, CheckCircle, Clock, AlertCircle, Filter, UserCheck, Award, ArrowUpRight } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../components/ConfirmModal';
import type { CommissionPrestation, StatutCommission, TypeBeneficiaire } from '../../types/crmModules';

export function CrmCommissions() {
  const { crmCommissions, crmPrestations, updateCrmCommissionStatus, payerCrmCommission } = useAppContext();
  const { currentUser } = useAuth();
  const { confirm } = useConfirm();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  // Payment Modal
  const [payingCommission, setPayingCommission] = useState<CommissionPrestation | null>(null);
  const [paymentMode, setPaymentMode] = useState<string>('ESPECES');

  const filteredCommissions = crmCommissions.filter(c => {
    const prest = crmPrestations.find(p => p.id === c.prestation_id);
    const ref = prest?.reference || '';
    const matchesSearch =
      (c.beneficiaire_nom || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      ref.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.type_beneficiaire.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || c.statut === statusFilter;
    const matchesType = typeFilter === 'ALL' || c.type_beneficiaire === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  // KPIs
  const totalEnAttente = crmCommissions.filter(c => c.statut === 'EN_ATTENTE').reduce((sum, c) => sum + (c.montant || 0), 0);
  const totalValidees = crmCommissions.filter(c => c.statut === 'VALIDEE').reduce((sum, c) => sum + (c.montant || 0), 0);
  const totalPayees = crmCommissions.filter(c => c.statut === 'PAYEE').reduce((sum, c) => sum + (c.montant || 0), 0);
  const totalGeneral = crmCommissions.filter(c => c.statut !== 'ANNULEE').reduce((sum, c) => sum + (c.montant || 0), 0);

  const handleValidate = async (comm: CommissionPrestation) => {
    await updateCrmCommissionStatus(comm.id, 'VALIDEE');
  };

  const handleOpenPay = (comm: CommissionPrestation) => {
    setPayingCommission(comm);
    setPaymentMode('ESPECES');
  };

  const handleConfirmPay = async () => {
    if (!payingCommission) return;
    await payerCrmCommission(payingCommission.id, paymentMode);
    setPayingCommission(null);
  };

  const getTypeBadge = (type: TypeBeneficiaire) => {
    switch (type) {
      case 'APPORTEUR':
        return <span className="badge-status" style={{ background: 'rgba(217, 119, 6, 0.12)', color: '#D97706', fontWeight: 600 }}>Apporteur d'affaires</span>;
      case 'AGENT_COMMERCIAL':
        return <span className="badge-status" style={{ background: 'rgba(37, 99, 235, 0.12)', color: '#2563EB', fontWeight: 600 }}>Agent Commercial</span>;
      case 'RESPONSABLE':
        return <span className="badge-status" style={{ background: 'rgba(124, 58, 237, 0.12)', color: '#7C3AED', fontWeight: 600 }}>Resp. Technique / Service</span>;
    }
  };

  const getStatusBadge = (statut: StatutCommission) => {
    switch (statut) {
      case 'EN_ATTENTE':
        return <span className="badge-status" style={{ background: 'rgba(234, 179, 8, 0.15)', color: '#CA8A04' }}>En attente</span>;
      case 'VALIDEE':
        return <span className="badge-status" style={{ background: 'rgba(37, 99, 235, 0.15)', color: '#2563EB', fontWeight: 600 }}>Validée (À payer)</span>;
      case 'PAYEE':
        return <span className="badge-status" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10B981', fontWeight: 600 }}>Payée / Liquidée</span>;
      case 'ANNULEE':
        return <span className="badge-status bg-error">Annulée</span>;
    }
  };

  return (
    <div className="dashboard">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2>Gestion des Commissions d'Affaires</h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
            Validation et liquidation des rétributions financières (Apporteurs, Commerciaux, Responsables).
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="card" style={{ padding: '16px', borderLeft: '4px solid #CA8A04' }}>
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginBottom: '4px' }}>En attente de validation</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#CA8A04' }}>
            {totalEnAttente.toLocaleString('fr-FR')} FCFA
          </div>
        </div>

        <div className="card" style={{ padding: '16px', borderLeft: '4px solid #2563EB' }}>
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginBottom: '4px' }}>Validées (Prêtes à payer)</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#2563EB' }}>
            {totalValidees.toLocaleString('fr-FR')} FCFA
          </div>
        </div>

        <div className="card" style={{ padding: '16px', borderLeft: '4px solid #10B981' }}>
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginBottom: '4px' }}>Total Commissions Payées</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#10B981' }}>
            {totalPayees.toLocaleString('fr-FR')} FCFA
          </div>
        </div>

        <div className="card" style={{ padding: '16px' }}>
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginBottom: '4px' }}>Volume Total Rétributions</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 700 }}>
            {totalGeneral.toLocaleString('fr-FR')} FCFA
          </div>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="card" style={{ marginBottom: '20px', padding: '12px 16px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '220px' }}>
          <Search size={18} color="var(--color-text-muted)" />
          <input
            type="text"
            placeholder="Rechercher par bénéficiaire, commande..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: '0.9rem',
              color: 'var(--color-text)'
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <select
            className="table-input"
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            style={{ padding: '4px 8px', fontSize: '0.85rem', width: 'auto' }}
          >
            <option value="ALL">Tous les types</option>
            <option value="APPORTEUR">Apporteurs</option>
            <option value="AGENT_COMMERCIAL">Commerciaux</option>
            <option value="RESPONSABLE">Responsables de service</option>
          </select>

          <select
            className="table-input"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{ padding: '4px 8px', fontSize: '0.85rem', width: 'auto' }}
          >
            <option value="ALL">Tous les statuts</option>
            <option value="EN_ATTENTE">En attente</option>
            <option value="VALIDEE">Validée</option>
            <option value="PAYEE">Payée</option>
            <option value="ANNULEE">Annulée</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="table-responsive">
          <table className="data-table responsive-table">
            <thead>
              <tr>
                <th>Bénéficiaire</th>
                <th>Type d'Ayant-droit</th>
                <th>Commande Associée</th>
                <th>Statut</th>
                <th>Date Règlement</th>
                <th style={{ textAlign: 'right' }}>Montant</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCommissions.map(comm => {
                const prest = crmPrestations.find(p => p.id === comm.prestation_id);

                return (
                  <tr key={comm.id}>
                    <td data-label="Bénéficiaire">
                      <strong>{comm.beneficiaire_nom}</strong>
                    </td>
                    <td data-label="Type">{getTypeBadge(comm.type_beneficiaire)}</td>
                    <td data-label="Commande">
                      {prest ? (
                        <div>
                          <strong style={{ color: 'var(--color-primary)' }}>{prest.reference}</strong>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{prest.designation}</div>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>-</span>
                      )}
                    </td>
                    <td data-label="Statut">{getStatusBadge(comm.statut)}</td>
                    <td data-label="Date">
                      {comm.statut === 'PAYEE' ? (
                        <span style={{ fontSize: '0.85rem' }}>
                          {comm.date_reglement || '-'} ({comm.mode_reglement || 'ESPECES'})
                        </span>
                      ) : '-'}
                    </td>
                    <td data-label="Montant" style={{ textAlign: 'right' }}>
                      <strong style={{ fontSize: '1rem', color: 'var(--color-primary)' }}>
                        {(comm.montant || 0).toLocaleString('fr-FR')} FCFA
                      </strong>
                    </td>
                    <td data-label="Actions">
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        {comm.statut === 'EN_ATTENTE' && (
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '3px 8px', fontSize: '11px', color: '#2563EB' }}
                            onClick={() => handleValidate(comm)}
                            title="Valider la commission pour paiement"
                          >
                            <CheckCircle size={12} style={{ marginRight: '3px' }} /> Valider
                          </button>
                        )}
                        {(comm.statut === 'EN_ATTENTE' || comm.statut === 'VALIDEE') && (
                          <button
                            className="btn btn-primary"
                            style={{ padding: '3px 8px', fontSize: '11px', background: '#10B981', borderColor: '#10B981' }}
                            onClick={() => handleOpenPay(comm)}
                            title="Payer la commission (génère sortie caisse)"
                          >
                            <DollarSign size={12} style={{ marginRight: '3px' }} /> Payer
                          </button>
                        )}
                        {comm.statut === 'PAYEE' && (
                          <span style={{ color: '#10B981', fontSize: '12px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <CheckCircle size={14} /> Réglé
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredCommissions.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)' }}>
                    Aucune fiche de commission trouvée.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Confirmation de Paiement */}
      {payingCommission && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '16px'
        }}>
          <div className="card" style={{ maxWidth: '460px', width: '100%', padding: '24px' }}>
            <h3 style={{ marginBottom: '12px' }}>Payer la Commission</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
              Bénéficiaire : <strong>{payingCommission.beneficiaire_nom}</strong> ({payingCommission.type_beneficiaire})<br />
              Montant à décaisser : <strong style={{ color: '#EF4444', fontSize: '1.1rem' }}>{(payingCommission.montant || 0).toLocaleString('fr-FR')} FCFA</strong>
            </p>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Mode de règlement *</label>
              <select
                className="table-input"
                value={paymentMode}
                onChange={e => setPaymentMode(e.target.value)}
              >
                <option value="ESPECES">Espèces</option>
                <option value="MOBILE_MONEY">Mobile Money</option>
                <option value="VIREMENT">Virement bancaire</option>
                <option value="CHEQUE">Chèque</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="btn btn-secondary" onClick={() => setPayingCommission(null)}>Annuler</button>
              <button className="btn btn-primary" onClick={handleConfirmPay} style={{ background: '#10B981', borderColor: '#10B981' }}>
                Confirmer le Paiement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
