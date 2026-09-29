import React, { useState } from 'react';
import { Plus, Search, Edit2, Trash2, Wrench, AlertTriangle, CheckCircle, Clock, User, Building, Filter, Eye } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../components/ConfirmModal';
import type { InterventionMaintenance, PrioriteIntervention, StatutIntervention } from '../../types/crmModules';

export function CrmMaintenance() {
  const { crmMaintenance, crmTiers, users, addCrmIntervention, updateCrmIntervention, deleteCrmIntervention } = useAppContext();
  const { currentUser } = useAuth();
  const { confirm } = useConfirm();

  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [showModal, setShowModal] = useState(false);
  const [editingIntervention, setEditingIntervention] = useState<InterventionMaintenance | null>(null);
  const [viewingIntervention, setViewingIntervention] = useState<InterventionMaintenance | null>(null);

  const [formData, setFormData] = useState<Partial<InterventionMaintenance>>({
    client_id: '',
    client_nom: '',
    site_agence: '',
    utilisateur_concerne: '',
    equipement: '',
    priorite: 'MOYENNE',
    observation: '',
    travaux: '',
    quantite: 1,
    prix_unitaire: 0,
    technicien_assigne: '',
    statut: 'NOUVEAU',
    date_intervention: new Date().toISOString().split('T')[0]
  });

  const clientsList = crmTiers.filter(t => t.type === 'CLIENT');

  const filteredInterventions = crmMaintenance.filter(m => {
    const matchesSearch =
      (m.reference || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.equipement || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.site_agence || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.utilisateur_concerne || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.technicien_assigne || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPriority = priorityFilter === 'ALL' || m.priorite === priorityFilter;
    const matchesStatus = statusFilter === 'ALL' || m.statut === statusFilter;
    return matchesSearch && matchesPriority && matchesStatus;
  });

  const handleOpenAdd = () => {
    setEditingIntervention(null);
    setFormData({
      client_id: '',
      client_nom: '',
      site_agence: '',
      utilisateur_concerne: '',
      equipement: '',
      priorite: 'MOYENNE',
      observation: '',
      travaux: '',
      quantite: 1,
      prix_unitaire: 0,
      technicien_assigne: currentUser?.name || '',
      statut: 'NOUVEAU',
      date_intervention: new Date().toISOString().split('T')[0]
    });
    setShowModal(true);
  };

  const handleOpenEdit = (m: InterventionMaintenance) => {
    setEditingIntervention(m);
    setFormData({
      client_id: m.client_id || '',
      client_nom: m.client_nom || '',
      site_agence: m.site_agence,
      utilisateur_concerne: m.utilisateur_concerne,
      equipement: m.equipement,
      priorite: m.priorite,
      observation: m.observation,
      travaux: m.travaux,
      quantite: m.quantite || 1,
      prix_unitaire: m.prix_unitaire || 0,
      technicien_assigne: m.technicien_assigne,
      statut: m.statut,
      date_intervention: m.date_intervention || new Date().toISOString().split('T')[0]
    });
    setShowModal(true);
  };

  const handleClientSelect = (clientId: string) => {
    const selected = clientsList.find(c => c.id === clientId);
    setFormData(prev => ({
      ...prev,
      client_id: clientId,
      client_nom: selected ? selected.nom : '',
      site_agence: selected?.ville || prev.site_agence
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.equipement?.trim() || !formData.site_agence?.trim() || !formData.technicien_assigne?.trim()) {
      alert('Veuillez renseigner le site, l\'équipement et le technicien assigné.');
      return;
    }

    const payload: InterventionMaintenance = {
      id: editingIntervention ? editingIntervention.id : '',
      reference: editingIntervention ? editingIntervention.reference : '',
      client_id: formData.client_id || undefined,
      client_nom: formData.client_nom || undefined,
      site_agence: formData.site_agence.trim(),
      utilisateur_concerne: formData.utilisateur_concerne?.trim() || 'N/A',
      equipement: formData.equipement.trim(),
      priorite: formData.priorite || 'MOYENNE',
      observation: formData.observation?.trim() || '',
      travaux: formData.travaux?.trim() || '',
      quantite: Number(formData.quantite) || 1,
      prix_unitaire: Number(formData.prix_unitaire) || 0,
      prix_total: (Number(formData.quantite) || 1) * (Number(formData.prix_unitaire) || 0),
      technicien_assigne: formData.technicien_assigne.trim(),
      statut: formData.statut || 'NOUVEAU',
      date_intervention: formData.date_intervention,
      cree_par: editingIntervention ? editingIntervention.cree_par : (currentUser?.id || ''),
      cree_par_nom: editingIntervention ? editingIntervention.cree_par_nom : currentUser?.name
    };

    if (editingIntervention) {
      await updateCrmIntervention(editingIntervention.id, payload);
    } else {
      await addCrmIntervention(payload);
    }
    setShowModal(false);
  };

  const handleDelete = (m: InterventionMaintenance) => {
    confirm({
      title: 'Supprimer l\'intervention',
      message: `Êtes-vous sûr de vouloir supprimer le ticket ${m.reference} (${m.equipement}) ?`,
      confirmLabel: 'Supprimer',
      onConfirm: () => deleteIntervention(m.id)
    });
  };

  const deleteIntervention = async (id: string) => {
    await deleteCrmIntervention(id);
  };

  const getPriorityBadge = (p: PrioriteIntervention) => {
    switch (p) {
      case 'URGENTE':
        return <span className="badge-status" style={{ background: '#EF4444', color: '#FFF', fontWeight: 700 }}>🚨 Urgente</span>;
      case 'HAUTE':
        return <span className="badge-status" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#DC2626', fontWeight: 600 }}>Haute</span>;
      case 'MOYENNE':
        return <span className="badge-status" style={{ background: 'rgba(234, 179, 8, 0.15)', color: '#CA8A04' }}>Moyenne</span>;
      case 'BASSE':
        return <span className="badge-status" style={{ background: 'rgba(100, 116, 139, 0.12)', color: '#64748B' }}>Basse</span>;
    }
  };

  const getStatusBadge = (s: StatutIntervention) => {
    switch (s) {
      case 'NOUVEAU':
        return <span className="badge-status" style={{ background: 'rgba(37, 99, 235, 0.12)', color: '#2563EB' }}>Nouveau</span>;
      case 'EN_ATTENTE_PIECE':
        return <span className="badge-status" style={{ background: 'rgba(217, 119, 6, 0.12)', color: '#D97706' }}>Attente Pièce</span>;
      case 'EN_COURS':
        return <span className="badge-status" style={{ background: 'rgba(124, 58, 237, 0.12)', color: '#7C3AED' }}>En cours</span>;
      case 'TERMINE_A_FACTURER':
        return <span className="badge-status" style={{ background: 'rgba(13, 148, 136, 0.12)', color: '#0D9488' }}>Terminé (À Facturer)</span>;
      case 'CLOTURE':
        return <span className="badge-status bg-success">Clôturé</span>;
      case 'ANNULE':
        return <span className="badge-status bg-error">Annulé</span>;
    }
  };

  // KPIs
  const totalTickets = crmMaintenance.length;
  const enCoursCount = crmMaintenance.filter(m => ['NOUVEAU', 'EN_COURS', 'EN_ATTENTE_PIECE'].includes(m.statut)).length;
  const urgentesCount = crmMaintenance.filter(m => m.priorite === 'URGENTE' && m.statut !== 'CLOTURE').length;
  const totalFacturation = crmMaintenance.filter(m => m.statut !== 'ANNULE').reduce((sum, m) => sum + (m.prix_total || 0), 0);

  return (
    <div className="dashboard">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2>Maintenance & Interventions Techniques</h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
            Gestion des tickets de panne, suivi des interventions sur site et affectation des techniciens.
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenAdd}>
          <Plus size={16} style={{ marginRight: '8px' }} /> Nouveau Ticket
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Total Interventions</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{totalTickets}</div>
        </div>
        <div className="card" style={{ padding: '16px', borderLeft: '4px solid #2563EB' }}>
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>En cours de traitement</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#2563EB' }}>{enCoursCount}</div>
        </div>
        <div className="card" style={{ padding: '16px', borderLeft: '4px solid #EF4444' }}>
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Interventions Urgentes</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#EF4444' }}>{urgentesCount}</div>
        </div>
        <div className="card" style={{ padding: '16px', borderLeft: '4px solid #10B981' }}>
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Facturation Technique</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#10B981' }}>
            {totalFacturation.toLocaleString('fr-FR')} FCFA
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="card" style={{ marginBottom: '20px', padding: '12px 16px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '220px' }}>
          <Search size={18} color="var(--color-text-muted)" />
          <input
            type="text"
            placeholder="Rechercher par référence, équipement, lieu, technicien..."
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
            value={priorityFilter}
            onChange={e => setPriorityFilter(e.target.value)}
            style={{ padding: '4px 8px', fontSize: '0.85rem', width: 'auto' }}
          >
            <option value="ALL">Toutes les priorités</option>
            <option value="URGENTE">Urgente</option>
            <option value="HAUTE">Haute</option>
            <option value="MOYENNE">Moyenne</option>
            <option value="BASSE">Basse</option>
          </select>

          <select
            className="table-input"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{ padding: '4px 8px', fontSize: '0.85rem', width: 'auto' }}
          >
            <option value="ALL">Tous les statuts</option>
            <option value="NOUVEAU">Nouveau</option>
            <option value="EN_ATTENTE_PIECE">En attente pièce</option>
            <option value="EN_COURS">En cours</option>
            <option value="TERMINE_A_FACTURER">Terminé à facturer</option>
            <option value="CLOTURE">Clôturé</option>
            <option value="ANNULE">Annulé</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="table-responsive">
          <table className="data-table responsive-table">
            <thead>
              <tr>
                <th>Réf. & Date</th>
                <th>Site / Lieu</th>
                <th>Équipement</th>
                <th>Priorité</th>
                <th>Technicien</th>
                <th>Statut</th>
                <th style={{ textAlign: 'right' }}>Montant Facturé</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredInterventions.map(m => (
                <tr key={m.id}>
                  <td data-label="Réf. & Date">
                    <strong style={{ color: 'var(--color-primary)' }}>{m.reference}</strong>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{m.date_intervention || m.created_at?.split('T')[0]}</div>
                  </td>
                  <td data-label="Site">
                    <strong>{m.site_agence}</strong>
                    {m.client_nom && <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{m.client_nom}</div>}
                  </td>
                  <td data-label="Équipement">
                    <div>{m.equipement}</div>
                    {m.utilisateur_concerne && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Demandeur: {m.utilisateur_concerne}</div>
                    )}
                  </td>
                  <td data-label="Priorité">{getPriorityBadge(m.priorite)}</td>
                  <td data-label="Technicien">
                    <span style={{ fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <User size={13} color="var(--color-text-muted)" /> {m.technicien_assigne}
                    </span>
                  </td>
                  <td data-label="Statut">{getStatusBadge(m.statut)}</td>
                  <td data-label="Montant" style={{ textAlign: 'right', fontWeight: 600 }}>
                    {(m.prix_total || 0).toLocaleString('fr-FR')} FCFA
                  </td>
                  <td data-label="Actions">
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button className="icon-button" title="Voir diagnostic et détails" onClick={() => setViewingIntervention(m)}>
                        <Eye size={14} />
                      </button>
                      <button className="icon-button" title="Modifier" onClick={() => handleOpenEdit(m)} style={{ color: 'var(--color-primary)' }}>
                        <Edit2 size={14} />
                      </button>
                      <button className="icon-button text-error" title="Supprimer" onClick={() => handleDelete(m)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredInterventions.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)' }}>
                    Aucune intervention enregistrée.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Ajout / Modification */}
      {showModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '16px', overflowY: 'auto'
        }}>
          <div className="card" style={{ maxWidth: '680px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '24px' }}>
            <h3 style={{ marginBottom: '16px' }}>
              {editingIntervention ? `Modifier le Ticket ${editingIntervention.reference}` : 'Nouveau Ticket d\'Intervention'}
            </h3>

            <form onSubmit={handleSubmit} className="responsive-form-grid">
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Client (Optionnel)</label>
                <select
                  className="table-input"
                  value={formData.client_id}
                  onChange={e => handleClientSelect(e.target.value)}
                >
                  <option value="">Sélectionner un client</option>
                  {clientsList.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Site / Lieu de l'intervention *</label>
                <input
                  type="text"
                  className="table-input"
                  value={formData.site_agence || ''}
                  onChange={e => setFormData({ ...formData, site_agence: e.target.value })}
                  placeholder="Ex: Siège Plateau, Agence Yopougon"
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Équipement concerné *</label>
                <input
                  type="text"
                  className="table-input"
                  value={formData.equipement || ''}
                  onChange={e => setFormData({ ...formData, equipement: e.target.value })}
                  placeholder="Ex: Climatiseur Split 2CV, Baie serveur"
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Demandeur / Utilisateur</label>
                <input
                  type="text"
                  className="table-input"
                  value={formData.utilisateur_concerne || ''}
                  onChange={e => setFormData({ ...formData, utilisateur_concerne: e.target.value })}
                  placeholder="Ex: M. Koné (Chef d'agence)"
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Priorité</label>
                <select
                  className="table-input"
                  value={formData.priorite}
                  onChange={e => setFormData({ ...formData, priorite: e.target.value as PrioriteIntervention })}
                >
                  <option value="BASSE">Basse</option>
                  <option value="MOYENNE">Moyenne</option>
                  <option value="HAUTE">Haute</option>
                  <option value="URGENTE">🚨 Urgente</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Statut</label>
                <select
                  className="table-input"
                  value={formData.statut}
                  onChange={e => setFormData({ ...formData, statut: e.target.value as StatutIntervention })}
                >
                  <option value="NOUVEAU">Nouveau</option>
                  <option value="EN_ATTENTE_PIECE">En attente pièce</option>
                  <option value="EN_COURS">En cours</option>
                  <option value="TERMINE_A_FACTURER">Terminé à facturer</option>
                  <option value="CLOTURE">Clôturé</option>
                  <option value="ANNULE">Annulé</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Technicien assigné *</label>
                <input
                  type="text"
                  className="table-input"
                  value={formData.technicien_assigne || ''}
                  onChange={e => setFormData({ ...formData, technicien_assigne: e.target.value })}
                  placeholder="Ex: Technicien Koffi"
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Date intervention</label>
                <input
                  type="date"
                  className="table-input"
                  value={formData.date_intervention || ''}
                  onChange={e => setFormData({ ...formData, date_intervention: e.target.value })}
                />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Diagnostic & Observation</label>
                <textarea
                  className="table-input"
                  rows={2}
                  value={formData.observation || ''}
                  onChange={e => setFormData({ ...formData, observation: e.target.value })}
                  placeholder="Diagnostic de la panne observée..."
                />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Travaux réalisés / Pièces changées</label>
                <textarea
                  className="table-input"
                  rows={2}
                  value={formData.travaux || ''}
                  onChange={e => setFormData({ ...formData, travaux: e.target.value })}
                  placeholder="Détail des actions correctives et pièces de rechange installées..."
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Quantité (Forfaits / Unités)</label>
                <input
                  type="number"
                  min="1"
                  className="table-input"
                  value={formData.quantite || 1}
                  onChange={e => setFormData({ ...formData, quantite: Number(e.target.value) })}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Prix Unitaire Facturé (FCFA)</label>
                <input
                  type="number"
                  min="0"
                  className="table-input"
                  value={formData.prix_unitaire || 0}
                  onChange={e => setFormData({ ...formData, prix_unitaire: Number(e.target.value) })}
                />
              </div>

              <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Annuler</button>
                <button type="submit" className="btn btn-primary">
                  {editingIntervention ? 'Enregistrer' : 'Créer le Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Consultation Détails */}
      {viewingIntervention && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '16px'
        }}>
          <div className="card" style={{ maxWidth: '560px', width: '100%', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0 }}>Ticket {viewingIntervention.reference}</h3>
                <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Lieu : {viewingIntervention.site_agence}</span>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {getPriorityBadge(viewingIntervention.priorite)}
                {getStatusBadge(viewingIntervention.statut)}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.9rem', marginBottom: '16px' }}>
              <div><strong>Équipement :</strong> {viewingIntervention.equipement}</div>
              <div><strong>Demandeur :</strong> {viewingIntervention.utilisateur_concerne}</div>
              <div><strong>Technicien :</strong> {viewingIntervention.technicien_assigne}</div>
              <div><strong>Montant Total :</strong> <strong style={{ color: 'var(--color-primary)' }}>{(viewingIntervention.prix_total || 0).toLocaleString('fr-FR')} FCFA</strong></div>
            </div>

            {viewingIntervention.observation && (
              <div style={{ marginBottom: '12px', padding: '10px', borderRadius: '6px', background: 'var(--color-surface-alt)', fontSize: '0.85rem' }}>
                <strong>Observation / Diagnostic :</strong>
                <p style={{ margin: '4px 0 0' }}>{viewingIntervention.observation}</p>
              </div>
            )}

            {viewingIntervention.travaux && (
              <div style={{ marginBottom: '16px', padding: '10px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.08)', fontSize: '0.85rem' }}>
                <strong style={{ color: '#065F46' }}>Travaux réalisés & Pièces :</strong>
                <p style={{ margin: '4px 0 0', color: '#065F46' }}>{viewingIntervention.travaux}</p>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="btn btn-secondary" onClick={() => setViewingIntervention(null)}>Fermer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
