import React, { useState } from 'react';
import { Plus, Search, Edit2, Trash2, CheckCircle, ArrowRight, DollarSign, Filter, Eye, AlertCircle, TrendingUp, User, Users, FileText, CheckCircle2 } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../components/ConfirmModal';
import type { PrestationCommande, StatutPrestation } from '../../types/crmModules';

export function CrmPrestations() {
  const {
    crmPrestations,
    crmTiers,
    crmCommerciaux,
    users,
    addCrmPrestation,
    updateCrmPrestation,
    deleteCrmPrestation,
    encaisserCrmPrestation
  } = useAppContext();
  const { currentUser } = useAuth();
  const { confirm } = useConfirm();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [showModal, setShowModal] = useState(false);
  const [editingPrestation, setEditingPrestation] = useState<PrestationCommande | null>(null);
  const [viewingPrestation, setViewingPrestation] = useState<PrestationCommande | null>(null);

  // Encaissement modal
  const [showEncaissementModal, setShowEncaissementModal] = useState(false);
  const [prestationToEncaisser, setPrestationToEncaisser] = useState<PrestationCommande | null>(null);
  const [modeReglement, setModeReglement] = useState('ESPECES');

  // Form State
  const [formData, setFormData] = useState({
    client_id: '',
    client_nom: '',
    commercial_id: '',
    commercial_nom: '',
    apporteur_id: '',
    apporteur_nom: '',
    resp_service_id: currentUser?.id || '',
    resp_service_nom: currentUser?.name || '',
    designation: '',
    quantite: 1,
    cout_unitaire_achat: 0,
    prix_vente_unitaire: 0,
    taux_commission_app: 10,
    commission_apporteur: 0,
    has_apporteur: false,
    commission_resp_service: 0,
    has_resp_commission: false,
    commission_agent: 0,
    has_commercial_commission: false,
    statut: 'BROUILLON' as StatutPrestation,
    notes: ''
  });

  const clientsList = crmTiers.filter(t => t.type === 'CLIENT');
  const apporteursList = crmTiers.filter(t => t.type === 'PARTENAIRE');

  // Dynamic calculations for the 11-column financial model
  const q = Number(formData.quantite) || 1;
  const cu_achat = Number(formData.cout_unitaire_achat) || 0;
  const ct_achat = q * cu_achat;
  const pu_vente = Number(formData.prix_vente_unitaire) || 0;
  const pt_vente = q * pu_vente;
  const marge_interne = pt_vente - ct_achat;

  const c_app = formData.has_apporteur ? Number(formData.commission_apporteur) || 0 : 0;
  const c_resp = formData.has_resp_commission ? Number(formData.commission_resp_service) || 0 : 0;
  const c_com = formData.has_commercial_commission ? Number(formData.commission_agent) || 0 : 0;
  const benefice_net = marge_interne - (c_app + c_resp + c_com);

  const filteredPrestations = crmPrestations.filter(p => {
    const matchesSearch =
      (p.reference || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.designation || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.client_nom || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.commercial_nom || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || p.statut === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleOpenAdd = () => {
    setEditingPrestation(null);
    setFormData({
      client_id: '',
      client_nom: '',
      commercial_id: '',
      commercial_nom: '',
      apporteur_id: '',
      apporteur_nom: '',
      resp_service_id: currentUser?.id || '',
      resp_service_nom: currentUser?.name || '',
      designation: '',
      quantite: 1,
      cout_unitaire_achat: 0,
      prix_vente_unitaire: 0,
      taux_commission_app: 10,
      commission_apporteur: 0,
      has_apporteur: false,
      commission_resp_service: 0,
      has_resp_commission: false,
      commission_agent: 0,
      has_commercial_commission: false,
      statut: 'BROUILLON',
      notes: ''
    });
    setShowModal(true);
  };

  const handleOpenEdit = (p: PrestationCommande) => {
    setEditingPrestation(p);
    setFormData({
      client_id: p.client_id || '',
      client_nom: p.client_nom || '',
      commercial_id: p.commercial_id || '',
      commercial_nom: p.commercial_nom || '',
      apporteur_id: p.apporteur_id || '',
      apporteur_nom: p.apporteur_nom || '',
      resp_service_id: p.resp_service_id || currentUser?.id || '',
      resp_service_nom: p.resp_service_nom || currentUser?.name || '',
      designation: p.designation,
      quantite: p.quantite || 1,
      cout_unitaire_achat: p.cout_unitaire_achat || 0,
      prix_vente_unitaire: p.prix_vente_unitaire || 0,
      taux_commission_app: p.taux_commission_app || 10,
      commission_apporteur: p.commission_apporteur || 0,
      has_apporteur: (p.commission_apporteur || 0) > 0 || !!p.apporteur_id,
      commission_resp_service: p.commission_resp_service || 0,
      has_resp_commission: (p.commission_resp_service || 0) > 0,
      commission_agent: p.commission_agent || 0,
      has_commercial_commission: (p.commission_agent || 0) > 0 || !!p.commercial_id,
      statut: p.statut,
      notes: p.notes || ''
    });
    setShowModal(true);
  };

  const handleClientSelect = (clientId: string) => {
    const selected = clientsList.find(c => c.id === clientId);
    setFormData(prev => ({
      ...prev,
      client_id: clientId,
      client_nom: selected ? selected.nom : ''
    }));
  };

  const handleApporteurSelect = (appId: string) => {
    const selected = apporteursList.find(a => a.id === appId);
    const calculatedCommission = selected ? Math.round((pt_vente * 10) / 100) : 0;
    setFormData(prev => ({
      ...prev,
      apporteur_id: appId,
      apporteur_nom: selected ? selected.nom : '',
      has_apporteur: !!appId,
      commission_apporteur: calculatedCommission
    }));
  };

  const handleCommercialSelect = (commId: string) => {
    const selected = crmCommerciaux.find(c => c.id === commId);
    const taux = selected?.taux_commission_defaut || 0;
    const calculatedCommission = Math.round((pt_vente * taux) / 100);
    setFormData(prev => ({
      ...prev,
      commercial_id: commId,
      commercial_nom: selected ? selected.nom : '',
      has_commercial_commission: !!commId,
      commission_agent: calculatedCommission
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.client_nom?.trim() || !formData.designation?.trim()) {
      alert('Veuillez sélectionner un client et saisir une désignation.');
      return;
    }

    const payload: PrestationCommande = {
      id: editingPrestation ? editingPrestation.id : '',
      reference: editingPrestation ? editingPrestation.reference : '',
      client_id: formData.client_id,
      client_nom: formData.client_nom.trim(),
      commercial_id: formData.commercial_id || undefined,
      commercial_nom: formData.commercial_nom || undefined,
      apporteur_id: formData.apporteur_id || undefined,
      apporteur_nom: formData.apporteur_nom || undefined,
      resp_service_id: formData.resp_service_id || currentUser?.id,
      resp_service_nom: formData.resp_service_nom || currentUser?.name,
      designation: formData.designation.trim(),
      quantite: q,
      cout_unitaire_achat: cu_achat,
      cout_final_achat: ct_achat,
      prix_vente_unitaire: pu_vente,
      prix_client_final: pt_vente,
      marge_interne: marge_interne,
      taux_commission_app: formData.has_apporteur ? formData.taux_commission_app : 0,
      commission_apporteur: c_app,
      commission_resp_service: c_resp,
      commission_agent: c_com,
      benefice_net: benefice_net,
      statut: formData.statut,
      notes: formData.notes?.trim() || undefined,
      cree_par: editingPrestation ? editingPrestation.cree_par : (currentUser?.id || ''),
      cree_par_nom: editingPrestation ? editingPrestation.cree_par_nom : currentUser?.name,
      date_creation: editingPrestation ? editingPrestation.date_creation : new Date().toISOString().split('T')[0]
    };

    if (editingPrestation) {
      await updateCrmPrestation(editingPrestation.id, payload);
    } else {
      await addCrmPrestation(payload);
    }
    setShowModal(false);
  };

  const handleDelete = (p: PrestationCommande) => {
    confirm({
      title: 'Supprimer la commande / prestation',
      message: `Êtes-vous sûr de vouloir supprimer la commande ${p.reference} (${p.designation}) ?`,
      confirmLabel: 'Supprimer',
      onConfirm: () => deleteCrmPrestation(p.id)
    });
  };

  const handleOpenEncaissement = (p: PrestationCommande) => {
    setPrestationToEncaisser(p);
    setModeReglement('ESPECES');
    setShowEncaissementModal(true);
  };

  const handleConfirmEncaissement = async () => {
    if (!prestationToEncaisser) return;
    await encaisserCrmPrestation(prestationToEncaisser.id, modeReglement);
    setShowEncaissementModal(false);
    setPrestationToEncaisser(null);
  };

  const getStatusBadge = (statut: StatutPrestation) => {
    switch (statut) {
      case 'BROUILLON':
        return <span className="badge-status" style={{ background: 'rgba(100, 116, 139, 0.12)', color: '#64748B' }}>Brouillon</span>;
      case 'EN_ATTENTE_VALIDATION':
        return <span className="badge-status" style={{ background: 'rgba(234, 179, 8, 0.12)', color: '#CA8A04' }}>Attente Validation</span>;
      case 'VALIDE':
        return <span className="badge-status" style={{ background: 'rgba(37, 99, 235, 0.12)', color: '#2563EB' }}>Validé</span>;
      case 'EN_COURS_EXECUTION':
        return <span className="badge-status" style={{ background: 'rgba(124, 58, 237, 0.12)', color: '#7C3AED' }}>En cours</span>;
      case 'LIVREE':
        return <span className="badge-status" style={{ background: 'rgba(13, 148, 136, 0.12)', color: '#0D9488' }}>Livrée</span>;
      case 'PAYEE':
        return <span className="badge-status" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10B981', fontWeight: 600 }}>Payée / Encaissée</span>;
      case 'CLOTUREE':
        return <span className="badge-status" style={{ background: 'rgba(71, 85, 105, 0.12)', color: '#475569' }}>Clôturée</span>;
      case 'ANNULEE':
        return <span className="badge-status bg-error">Annulée</span>;
      default:
        return <span className="badge-status">{statut}</span>;
    }
  };

  // KPIs
  const totalCommandes = crmPrestations.length;
  const caTotal = crmPrestations.filter(p => p.statut !== 'ANNULEE').reduce((sum, p) => sum + (p.prix_client_final || 0), 0);
  const margeTotal = crmPrestations.filter(p => p.statut !== 'ANNULEE').reduce((sum, p) => sum + (p.marge_interne || 0), 0);
  const beneficeNetTotal = crmPrestations.filter(p => p.statut !== 'ANNULEE').reduce((sum, p) => sum + (p.benefice_net || 0), 0);
  const commissionsTotal = crmPrestations.filter(p => p.statut !== 'ANNULEE').reduce((sum, p) => sum + (p.commission_apporteur || 0) + (p.commission_resp_service || 0) + (p.commission_agent || 0), 0);

  return (
    <div className="dashboard">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2>Prestations & Commandes Clients</h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
            Grille financière rigoureuse à 11 colonnes, ventilation automatique des commissions et encaissement en trésorerie.
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenAdd}>
          <Plus size={16} style={{ marginRight: '8px' }} /> Nouvelle Commande
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginBottom: '4px' }}>Total Commandes</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>{totalCommandes}</div>
        </div>
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginBottom: '4px' }}>CA Facturé Client</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--color-primary)' }}>
            {caTotal.toLocaleString('fr-FR')} FCFA
          </div>
        </div>
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginBottom: '4px' }}>Marge Interne Brute</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#2563EB' }}>
            {margeTotal.toLocaleString('fr-FR')} FCFA
          </div>
        </div>
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginBottom: '4px' }}>Commissions Affaires</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#D97706' }}>
            {commissionsTotal.toLocaleString('fr-FR')} FCFA
          </div>
        </div>
        <div className="card" style={{ padding: '16px', borderLeft: '4px solid #10B981' }}>
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginBottom: '4px' }}>Bénéfice Réel Net</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#10B981' }}>
            {beneficeNetTotal.toLocaleString('fr-FR')} FCFA
          </div>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="card" style={{ marginBottom: '20px', padding: '12px 16px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '220px' }}>
          <Search size={18} color="var(--color-text-muted)" />
          <input
            type="text"
            placeholder="Rechercher par référence, désignation, client..."
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
          <Filter size={16} color="var(--color-text-muted)" />
          <select
            className="table-input"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{ padding: '4px 8px', fontSize: '0.85rem', width: 'auto' }}
          >
            <option value="ALL">Tous les statuts</option>
            <option value="BROUILLON">Brouillon</option>
            <option value="EN_ATTENTE_VALIDATION">En attente de validation</option>
            <option value="VALIDE">Validé</option>
            <option value="EN_COURS_EXECUTION">En cours d'exécution</option>
            <option value="LIVREE">Livrée</option>
            <option value="PAYEE">Payée / Encaissée</option>
            <option value="CLOTUREE">Clôturée</option>
            <option value="ANNULEE">Annulée</option>
          </select>
        </div>
      </div>

      {/* 11-Column Table View */}
      <div className="card">
        <div className="table-responsive">
          <table className="data-table responsive-table" style={{ fontSize: '0.85rem' }}>
            <thead>
              <tr>
                <th>Réf. & Client</th>
                <th>Désignation</th>
                <th style={{ textAlign: 'center' }}>Qte</th>
                <th style={{ textAlign: 'right' }}>Coût Ach. (CT)</th>
                <th style={{ textAlign: 'right' }}>Prix Vte (PT)</th>
                <th style={{ textAlign: 'right' }}>Marge Int.</th>
                <th style={{ textAlign: 'right' }}>C. App.</th>
                <th style={{ textAlign: 'right' }}>C. Resp.</th>
                <th style={{ textAlign: 'right' }}>C. Agent</th>
                <th style={{ textAlign: 'right' }}>Bénéf. Net</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPrestations.map(p => (
                <tr key={p.id}>
                  <td data-label="Réf. & Client">
                    <strong style={{ color: 'var(--color-primary)' }}>{p.reference}</strong>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{p.client_nom}</div>
                  </td>
                  <td data-label="Désignation" style={{ maxWidth: '200px' }}>
                    <div style={{ fontWeight: 500 }}>{p.designation}</div>
                  </td>
                  <td data-label="Qte" style={{ textAlign: 'center' }}>
                    {p.quantite}
                  </td>
                  <td data-label="Coût Achat" style={{ textAlign: 'right' }}>
                    {(p.cout_final_achat || 0).toLocaleString('fr-FR')}
                  </td>
                  <td data-label="Prix Vente" style={{ textAlign: 'right', fontWeight: 600 }}>
                    {(p.prix_client_final || 0).toLocaleString('fr-FR')}
                  </td>
                  <td data-label="Marge Interne" style={{ textAlign: 'right', color: '#2563EB', fontWeight: 600 }}>
                    {(p.marge_interne || 0).toLocaleString('fr-FR')}
                  </td>
                  <td data-label="C. Apporteur" style={{ textAlign: 'right', color: p.commission_apporteur ? '#D97706' : 'var(--color-text-muted)' }}>
                    {p.commission_apporteur ? `${p.commission_apporteur.toLocaleString('fr-FR')}` : '-'}
                  </td>
                  <td data-label="C. Responsable" style={{ textAlign: 'right', color: p.commission_resp_service ? '#7C3AED' : 'var(--color-text-muted)' }}>
                    {p.commission_resp_service ? `${p.commission_resp_service.toLocaleString('fr-FR')}` : '-'}
                  </td>
                  <td data-label="C. Agent" style={{ textAlign: 'right', color: p.commission_agent ? '#0D9488' : 'var(--color-text-muted)' }}>
                    {p.commission_agent ? `${p.commission_agent.toLocaleString('fr-FR')}` : '-'}
                  </td>
                  <td data-label="Bénéfice Net" style={{ textAlign: 'right', color: '#10B981', fontWeight: 700 }}>
                    {(p.benefice_net || 0).toLocaleString('fr-FR')}
                  </td>
                  <td data-label="Statut">
                    {getStatusBadge(p.statut)}
                  </td>
                  <td data-label="Actions">
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      {p.statut !== 'PAYEE' && p.statut !== 'CLOTUREE' && p.statut !== 'ANNULEE' && (
                        <button
                          className="btn btn-primary"
                          style={{ padding: '3px 8px', fontSize: '11px' }}
                          title="Encaisser la commande en caisse"
                          onClick={() => handleOpenEncaissement(p)}
                        >
                          <DollarSign size={12} style={{ marginRight: '2px' }} /> Encaisser
                        </button>
                      )}
                      <button className="icon-button" title="Détails" onClick={() => setViewingPrestation(p)}>
                        <Eye size={14} />
                      </button>
                      <button className="icon-button" title="Modifier" onClick={() => handleOpenEdit(p)} style={{ color: 'var(--color-primary)' }}>
                        <Edit2 size={14} />
                      </button>
                      <button className="icon-button text-error" title="Supprimer" onClick={() => handleDelete(p)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredPrestations.length === 0 && (
                <tr>
                  <td colSpan={12} style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)' }}>
                    Aucune commande trouvée.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Création / Édition avec Calcul Direct des 11 Colonnes */}
      {showModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '16px', overflowY: 'auto'
        }}>
          <div className="card" style={{ maxWidth: '820px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '24px' }}>
            <h3 style={{ marginBottom: '16px' }}>
              {editingPrestation ? `Modifier la Commande ${editingPrestation.reference}` : 'Nouvelle Commande / Prestation'}
            </h3>

            <form onSubmit={handleSubmit}>
              <div className="responsive-form-grid" style={{ marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Client *</label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <select
                      className="table-input"
                      value={formData.client_id}
                      onChange={e => handleClientSelect(e.target.value)}
                    >
                      <option value="">Sélectionner dans l'annuaire</option>
                      {clientsList.map(c => (
                        <option key={c.id} value={c.id}>{c.nom} {c.ville ? `(${c.ville})` : ''}</option>
                      ))}
                    </select>
                  </div>
                  {!formData.client_id && (
                    <input
                      type="text"
                      className="table-input"
                      style={{ marginTop: '6px' }}
                      value={formData.client_nom}
                      onChange={e => setFormData({ ...formData, client_nom: e.target.value })}
                      placeholder="Ou saisissez le nom du client libre..."
                      required
                    />
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Statut du cycle de vie</label>
                  <select
                    className="table-input"
                    value={formData.statut}
                    onChange={e => setFormData({ ...formData, statut: e.target.value as StatutPrestation })}
                  >
                    <option value="BROUILLON">Brouillon</option>
                    <option value="EN_ATTENTE_VALIDATION">En attente de validation</option>
                    <option value="VALIDE">Validé</option>
                    <option value="EN_COURS_EXECUTION">En cours d'exécution</option>
                    <option value="LIVREE">Livrée</option>
                    <option value="PAYEE">Payée</option>
                    <option value="CLOTUREE">Clôturée</option>
                    <option value="ANNULEE">Annulée</option>
                  </select>
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Désignation des travaux ou prestations *</label>
                  <input
                    type="text"
                    className="table-input"
                    value={formData.designation}
                    onChange={e => setFormData({ ...formData, designation: e.target.value })}
                    placeholder="Ex: Installation réseau informatique + 3 points d'accès Wifi"
                    required
                  />
                </div>
              </div>

              {/* Grille des 11 Colonnes Métier */}
              <div style={{ padding: '16px', borderRadius: '8px', background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)', marginBottom: '16px' }}>
                <strong style={{ display: 'block', marginBottom: '12px', fontSize: '0.95rem', color: 'var(--color-text)' }}>
                  Grille Financière & Paramètres de Rentabilité
                </strong>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>1. Quantité (Q)</label>
                    <input
                      type="number"
                      min="1"
                      className="table-input"
                      value={formData.quantite}
                      onChange={e => setFormData({ ...formData, quantite: Number(e.target.value) })}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>2. Coût Unit. Achat (CU)</label>
                    <input
                      type="number"
                      min="0"
                      className="table-input"
                      value={formData.cout_unitaire_achat}
                      onChange={e => setFormData({ ...formData, cout_unitaire_achat: Number(e.target.value) })}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>3. Coût Final Achat (CT)</label>
                    <input
                      type="text"
                      className="table-input"
                      value={`${ct_achat.toLocaleString('fr-FR')} FCFA`}
                      disabled
                      style={{ background: 'var(--color-bg)', fontWeight: 600 }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>4. Prix Vente Unit. (PU)</label>
                    <input
                      type="number"
                      min="0"
                      className="table-input"
                      value={formData.prix_vente_unitaire}
                      onChange={e => setFormData({ ...formData, prix_vente_unitaire: Number(e.target.value) })}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>5. Prix Client Final (PT)</label>
                    <input
                      type="text"
                      className="table-input"
                      value={`${pt_vente.toLocaleString('fr-FR')} FCFA`}
                      disabled
                      style={{ background: 'var(--color-bg)', fontWeight: 700, color: 'var(--color-primary)' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>6. Marge Interne</label>
                    <input
                      type="text"
                      className="table-input"
                      value={`${marge_interne.toLocaleString('fr-FR')} FCFA`}
                      disabled
                      style={{ background: 'var(--color-bg)', fontWeight: 700, color: '#2563EB' }}
                    />
                  </div>
                </div>

                {/* Section Commissions Optionnelles */}
                <div style={{ borderTop: '1px dashed var(--color-border)', paddingTop: '12px', marginTop: '12px' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px', color: 'var(--color-text)' }}>
                    Ventilation des Commissions (Optionnel selon l'affaire) :
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                    {/* Apporteur */}
                    <div style={{ padding: '10px', borderRadius: '6px', background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', marginBottom: '6px' }}>
                        <input
                          type="checkbox"
                          checked={formData.has_apporteur}
                          onChange={e => setFormData({ ...formData, has_apporteur: e.target.checked })}
                        />
                        <span>7. Commission Apporteur</span>
                      </label>
                      {formData.has_apporteur && (
                        <>
                          <select
                            className="table-input"
                            value={formData.apporteur_id}
                            onChange={e => handleApporteurSelect(e.target.value)}
                            style={{ marginBottom: '6px', fontSize: '0.8rem' }}
                          >
                            <option value="">Sélectionner l'apporteur</option>
                            {apporteursList.map(a => (
                              <option key={a.id} value={a.id}>{a.nom}</option>
                            ))}
                          </select>
                          <input
                            type="number"
                            className="table-input"
                            value={formData.commission_apporteur}
                            onChange={e => setFormData({ ...formData, commission_apporteur: Number(e.target.value) })}
                            placeholder="Montant FCFA"
                          />
                        </>
                      )}
                    </div>

                    {/* Responsable de Service */}
                    <div style={{ padding: '10px', borderRadius: '6px', background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', marginBottom: '6px' }}>
                        <input
                          type="checkbox"
                          checked={formData.has_resp_commission}
                          onChange={e => setFormData({ ...formData, has_resp_commission: e.target.checked })}
                        />
                        <span>8. Comm. Resp. Service</span>
                      </label>
                      {formData.has_resp_commission && (
                        <input
                          type="number"
                          className="table-input"
                          value={formData.commission_resp_service}
                          onChange={e => setFormData({ ...formData, commission_resp_service: Number(e.target.value) })}
                          placeholder="Montant forfaitaire FCFA"
                        />
                      )}
                    </div>

                    {/* Agent Commercial */}
                    <div style={{ padding: '10px', borderRadius: '6px', background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', marginBottom: '6px' }}>
                        <input
                          type="checkbox"
                          checked={formData.has_commercial_commission}
                          onChange={e => setFormData({ ...formData, has_commercial_commission: e.target.checked })}
                        />
                        <span>9. Commission Commercial</span>
                      </label>
                      {formData.has_commercial_commission && (
                        <>
                          <select
                            className="table-input"
                            value={formData.commercial_id}
                            onChange={e => handleCommercialSelect(e.target.value)}
                            style={{ marginBottom: '6px', fontSize: '0.8rem' }}
                          >
                            <option value="">Sélectionner le commercial</option>
                            {crmCommerciaux.map(c => (
                              <option key={c.id} value={c.id}>{c.nom} ({c.taux_commission_defaut}%)</option>
                            ))}
                          </select>
                          <input
                            type="number"
                            className="table-input"
                            value={formData.commission_agent}
                            onChange={e => setFormData({ ...formData, commission_agent: Number(e.target.value) })}
                            placeholder="Montant FCFA"
                          />
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* 11. Bénéfice Net Réel */}
                <div style={{ marginTop: '16px', padding: '12px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.95rem', color: '#065F46' }}>
                    10. Bénéfice Réel Net Entreprise :
                  </span>
                  <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#065F46' }}>
                    {benefice_net.toLocaleString('fr-FR')} FCFA
                  </span>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Notes / Instructions particulières</label>
                <textarea
                  className="table-input"
                  rows={2}
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Détails du lieu, date de réalisation, conditions de livraison..."
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Annuler</button>
                <button type="submit" className="btn btn-primary">
                  {editingPrestation ? 'Sauvegarder les modifications' : 'Enregistrer la commande'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Détails d'une Prestation */}
      {viewingPrestation && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '16px'
        }}>
          <div className="card" style={{ maxWidth: '600px', width: '100%', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0 }}>Fiche Commande {viewingPrestation.reference}</h3>
                <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Client : {viewingPrestation.client_nom}</span>
              </div>
              <div>{getStatusBadge(viewingPrestation.statut)}</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.9rem', marginBottom: '16px' }}>
              <div><strong>Désignation :</strong> {viewingPrestation.designation}</div>
              <div><strong>Quantité :</strong> {viewingPrestation.quantite}</div>
              <div><strong>Coût Unit. Achat :</strong> {(viewingPrestation.cout_unitaire_achat || 0).toLocaleString('fr-FR')} FCFA</div>
              <div><strong>Coût Total Achat :</strong> {(viewingPrestation.cout_final_achat || 0).toLocaleString('fr-FR')} FCFA</div>
              <div><strong>Prix Vente Unit. :</strong> {(viewingPrestation.prix_vente_unitaire || 0).toLocaleString('fr-FR')} FCFA</div>
              <div><strong>Prix Client Final :</strong> {(viewingPrestation.prix_client_final || 0).toLocaleString('fr-FR')} FCFA</div>
              <div><strong>Marge Interne :</strong> {(viewingPrestation.marge_interne || 0).toLocaleString('fr-FR')} FCFA</div>
              <div><strong>Bénéfice Net :</strong> <strong style={{ color: '#10B981' }}>{(viewingPrestation.benefice_net || 0).toLocaleString('fr-FR')} FCFA</strong></div>
              <div><strong>Comm. Apporteur :</strong> {(viewingPrestation.commission_apporteur || 0).toLocaleString('fr-FR')} FCFA ({viewingPrestation.apporteur_nom || '-'})</div>
              <div><strong>Comm. Resp. Service :</strong> {(viewingPrestation.commission_resp_service || 0).toLocaleString('fr-FR')} FCFA ({viewingPrestation.resp_service_nom || '-'})</div>
              <div><strong>Comm. Agent Commercial :</strong> {(viewingPrestation.commission_agent || 0).toLocaleString('fr-FR')} FCFA ({viewingPrestation.commercial_nom || '-'})</div>
              <div><strong>Date Création :</strong> {viewingPrestation.date_creation || '-'}</div>
            </div>

            {viewingPrestation.notes && (
              <div style={{ padding: '10px', borderRadius: '6px', background: 'var(--color-surface-alt)', fontSize: '0.85rem', marginBottom: '16px' }}>
                <strong>Notes :</strong> {viewingPrestation.notes}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="btn btn-secondary" onClick={() => setViewingPrestation(null)}>Fermer</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmation d'Encaissement */}
      {showEncaissementModal && prestationToEncaisser && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '16px'
        }}>
          <div className="card" style={{ maxWidth: '480px', width: '100%', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(16, 185, 129, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10B981' }}>
                <DollarSign size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0 }}>Encaisser la Commande</h3>
                <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>{prestationToEncaisser.reference}</span>
              </div>
            </div>

            <p style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
              L'encaissement passera la commande au statut <strong>PAYEE</strong> et créera automatiquement une entrée de trésorerie de <strong style={{ color: 'var(--color-primary)' }}>{(prestationToEncaisser.prix_client_final || 0).toLocaleString('fr-FR')} FCFA</strong> dans le journal de caisse.
            </p>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Mode de règlement *</label>
              <select
                className="table-input"
                value={modeReglement}
                onChange={e => setModeReglement(e.target.value)}
              >
                <option value="ESPECES">Espèces</option>
                <option value="MOBILE_MONEY">Mobile Money (Wave, Orange, MTN, Moov)</option>
                <option value="VIREMENT">Virement bancaire</option>
                <option value="CHEQUE">Chèque</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="btn btn-secondary" onClick={() => setShowEncaissementModal(false)}>Annuler</button>
              <button className="btn btn-primary" onClick={handleConfirmEncaissement} style={{ background: '#10B981', borderColor: '#10B981' }}>
                Confirmer l'Encaissement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
