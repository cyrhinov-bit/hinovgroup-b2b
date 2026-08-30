import React, { useState } from 'react';
import { 
  Plus, Search, Filter, DollarSign, Briefcase, Building2, 
  Receipt, Edit2, Trash2, ArrowUpRight, ArrowDownLeft, FileText, CheckCircle2 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppContext, type Cout, type CostType, type CostCategory } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../components/ConfirmModal';
import { CoutModal } from '../components/CoutModal';
import './Couts.css';

export const Couts: React.FC = () => {
  const navigate = useNavigate();
  const { couts, affaires, services, deleteCout } = useAppContext();
  const { currentUser } = useAuth();
  const { confirm } = useConfirm();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [serviceFilter, setServiceFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCout, setSelectedCout] = useState<Cout | null>(null);

  // Filtrage selon les droits utilisateurs
  const allowedCouts = currentUser?.role === 'Directeur' || currentUser?.role === 'SuperAdmin'
    ? couts
    : couts.filter(c => c.serviceId === currentUser?.serviceId);

  const filteredCouts = allowedCouts.filter(c => {
    const matchSearch = 
      c.reference.toLowerCase().includes(search.toLowerCase()) ||
      c.description.toLowerCase().includes(search.toLowerCase()) ||
      (c.supplierName && c.supplierName.toLowerCase().includes(search.toLowerCase())) ||
      (c.invoiceRef && c.invoiceRef.toLowerCase().includes(search.toLowerCase()));

    const matchType = typeFilter === 'ALL' || c.costType === typeFilter;
    const matchService = serviceFilter === 'ALL' || c.serviceId === serviceFilter;
    const matchCategory = categoryFilter === 'ALL' || c.category === categoryFilter;
    const matchStatus = statusFilter === 'ALL' || c.status === statusFilter;

    return matchSearch && matchType && matchService && matchCategory && matchStatus;
  });

  // Calcul des KPIs
  const totalHt = allowedCouts.filter(c => c.status !== 'ANNULE').reduce((sum, c) => sum + c.amountHt, 0);
  const totalDirectHt = allowedCouts.filter(c => c.costType === 'DIRECT' && c.status !== 'ANNULE').reduce((sum, c) => sum + c.amountHt, 0);
  const totalIndirectHt = allowedCouts.filter(c => c.costType === 'INDIRECT' && c.status !== 'ANNULE').reduce((sum, c) => sum + c.amountHt, 0);
  const totalVat = allowedCouts.filter(c => c.status !== 'ANNULE').reduce((sum, c) => sum + c.vatAmount, 0);

  const handleDelete = (cout: Cout) => {
    confirm({
      title: 'Supprimer la dépense',
      message: `Voulez-vous vraiment supprimer la dépense "${cout.reference} - ${cout.description}" ?`,
      confirmLabel: 'Supprimer',
      variant: 'danger',
      onConfirm: async () => {
        await deleteCout(cout.id);
      }
    });
  };

  const getCategoryLabel = (cat: CostCategory) => {
    switch (cat) {
      case 'SOUS_TRAITANCE': return 'Sous-traitance';
      case 'ACHAT_MATERIEL': return 'Achat Matériel';
      case 'TRANSPORT': return 'Transport';
      case 'LOGICIEL_LICENCE': return 'Logiciels/Licences';
      case 'HONORAIRES': return 'Honoraires';
      case 'LOYER_CHARGES': return 'Loyer & Charges';
      case 'TELECOM': return 'Télécom/Internet';
      default: return 'Autre';
    }
  };

  return (
    <div className="couts-page">
      <div className="couts-header">
        <div>
          <h2>Gestion des Coûts & Dépenses</h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', margin: '4px 0 0 0' }}>
            Suivi analytique des coûts directs d'affaires et charges indirectes de service.
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setSelectedCout(null);
            setIsModalOpen(true);
          }}
        >
          <Plus size={16} style={{ marginRight: '6px' }} />
          Enregistrer une Dépense
        </button>
      </div>

      {/* Cartes KPIs */}
      <div className="couts-kpis-grid">
        <div className="cout-kpi-card">
          <div className="cout-kpi-icon" style={{ background: '#F0FDFA', color: '#0D9488' }}>
            <DollarSign size={24} />
          </div>
          <div className="cout-kpi-info">
            <div className="kpi-title">Total Dépenses HT</div>
            <div className="kpi-value">{totalHt.toLocaleString('fr-FR')} F</div>
          </div>
        </div>

        <div className="cout-kpi-card">
          <div className="cout-kpi-icon" style={{ background: '#ECFDF5', color: '#16A34A' }}>
            <Briefcase size={24} />
          </div>
          <div className="cout-kpi-info">
            <div className="kpi-title">Coûts Directs Affaires HT</div>
            <div className="kpi-value">{totalDirectHt.toLocaleString('fr-FR')} F</div>
          </div>
        </div>

        <div className="cout-kpi-card">
          <div className="cout-kpi-icon" style={{ background: '#EFF6FF', color: '#2563EB' }}>
            <Building2 size={24} />
          </div>
          <div className="cout-kpi-info">
            <div className="kpi-title">Coûts Indirects Structure HT</div>
            <div className="kpi-value">{totalIndirectHt.toLocaleString('fr-FR')} F</div>
          </div>
        </div>

        <div className="cout-kpi-card">
          <div className="cout-kpi-icon" style={{ background: '#FAF5FF', color: '#9333EA' }}>
            <Receipt size={24} />
          </div>
          <div className="cout-kpi-info">
            <div className="kpi-title">TVA Récupérable</div>
            <div className="kpi-value">{totalVat.toLocaleString('fr-FR')} F</div>
          </div>
        </div>
      </div>

      {/* Barre de recherche et filtres */}
      <div className="couts-filters-bar">
        <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
          <input
            type="text"
            className="table-input"
            style={{ width: '100%', paddingLeft: '32px' }}
            placeholder="Rechercher par réf, fournisseur, facture, motif..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <Search size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94A3B8' }} />
        </div>

        <select
          className="table-input"
          style={{ minWidth: '150px' }}
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
        >
          <option value="ALL">Toutes les natures</option>
          <option value="DIRECT">Directs (Affaires)</option>
          <option value="INDIRECT">Indirects (Structure)</option>
        </select>

        {(currentUser?.role === 'Directeur' || currentUser?.role === 'SuperAdmin') && (
          <select
            className="table-input"
            style={{ minWidth: '160px' }}
            value={serviceFilter}
            onChange={e => setServiceFilter(e.target.value)}
          >
            <option value="ALL">Tous les services</option>
            {services.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        )}

        <select
          className="table-input"
          style={{ minWidth: '160px' }}
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
        >
          <option value="ALL">Toutes les catégories</option>
          <option value="SOUS_TRAITANCE">Sous-traitance</option>
          <option value="ACHAT_MATERIEL">Achat Matériel</option>
          <option value="TRANSPORT">Transport</option>
          <option value="LOGICIEL_LICENCE">Logiciels & Licences</option>
          <option value="HONORAIRES">Honoraires</option>
          <option value="LOYER_CHARGES">Loyer & Charges</option>
          <option value="TELECOM">Télécom & Internet</option>
          <option value="AUTRE">Autre dépense</option>
        </select>

        <select
          className="table-input"
          style={{ minWidth: '140px' }}
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="ALL">Tous statuts</option>
          <option value="ENGAGE">Engagé</option>
          <option value="VALIDE">Validé</option>
          <option value="PAYE">Payé</option>
          <option value="ANNULE">Annulé</option>
        </select>
      </div>

      {/* Tableau des Coûts */}
      <div className="couts-table-container">
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Réf. / Date</th>
                <th>Nature & Affectation</th>
                <th>Service</th>
                <th>Catégorie</th>
                <th>Fournisseur / Facture</th>
                <th>Description</th>
                <th style={{ textAlign: 'right' }}>Montant HT</th>
                <th style={{ textAlign: 'right' }}>TTC</th>
                <th>Statut</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCouts.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '2rem', color: '#94A3B8' }}>
                    Aucune dépense trouvée avec les critères sélectionnés.
                  </td>
                </tr>
              ) : (
                filteredCouts.map(cout => {
                  const affaire = cout.affaireId ? affaires.find(a => a.id === cout.affaireId) : null;
                  const service = services.find(s => s.id === cout.serviceId);

                  return (
                    <tr key={cout.id}>
                      <td>
                        <div style={{ fontWeight: 700, color: '#0F172A' }}>{cout.reference}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748B' }}>{cout.date}</div>
                      </td>

                      <td>
                        {cout.costType === 'DIRECT' ? (
                          <div>
                            <span className="badge-cost-type badge-cost-direct">
                              <Briefcase size={11} /> Direct
                            </span>
                            {affaire ? (
                              <div
                                onClick={() => navigate(`/affaires/${affaire.id}`)}
                                style={{ fontSize: '0.75rem', color: '#0D9488', fontWeight: 600, cursor: 'pointer', marginTop: '2px' }}
                                title="Ouvrir la fiche affaire"
                              >
                                {affaire.reference} - {affaire.title}
                              </div>
                            ) : (
                              <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>Affaire inconnue</div>
                            )}
                          </div>
                        ) : (
                          <span className="badge-cost-type badge-cost-indirect">
                            <Building2 size={11} /> Indirect
                          </span>
                        )}
                      </td>

                      <td>
                        <span style={{ fontSize: '0.8rem', color: '#334155' }}>
                          {service?.name || '-'}
                        </span>
                      </td>

                      <td>
                        <span style={{ fontSize: '0.8rem', color: '#475569' }}>
                          {getCategoryLabel(cout.category)}
                        </span>
                      </td>

                      <td>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{cout.supplierName || '-'}</div>
                        {cout.invoiceRef && (
                          <div style={{ fontSize: '0.72rem', color: '#64748B' }}>
                            N° {cout.invoiceRef}
                          </div>
                        )}
                      </td>

                      <td>
                        <div style={{ fontSize: '0.85rem', color: '#334155', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {cout.description}
                        </div>
                      </td>

                      <td style={{ textAlign: 'right', fontWeight: 600, color: '#0F172A' }}>
                        {cout.amountHt.toLocaleString('fr-FR')} F
                      </td>

                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#0D9488' }}>
                        {cout.amountTtc.toLocaleString('fr-FR')} F
                        {cout.vatRate > 0 && (
                          <div style={{ fontSize: '0.7rem', color: '#64748B' }}>(TVA {cout.vatRate}%)</div>
                        )}
                      </td>

                      <td>
                        <span className={`badge-cost-status ${cout.status.toLowerCase()}`}>
                          {cout.status}
                        </span>
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          <button
                            className="icon-button"
                            onClick={() => {
                              setSelectedCout(cout);
                              setIsModalOpen(true);
                            }}
                            title="Modifier"
                            style={{ color: '#0D9488' }}
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            className="icon-button"
                            onClick={() => handleDelete(cout)}
                            title="Supprimer"
                            style={{ color: '#EF4444' }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modale d'enregistrement / édition */}
      <CoutModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedCout(null);
        }}
        coutToEdit={selectedCout}
      />
    </div>
  );
};
