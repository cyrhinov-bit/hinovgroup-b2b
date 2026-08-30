import { useState, useMemo } from 'react';
import { 
  Briefcase, Plus, Search, Filter, LayoutGrid, List as ListIcon, 
  DollarSign, TrendingUp, CheckCircle2, User, Building, 
  ArrowRight, Edit3, Trash2, ChevronRight, AlertCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppContext, type Affaire, type AffaireStatus } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { AffaireModal } from '../components/AffaireModal';
import './Affaires.css';

const STATUS_COLUMNS: { status: AffaireStatus; label: string; bg: string; border: string }[] = [
  { status: 'PROSPECTION', label: 'Prospection', bg: '#F8FAFC', border: '#94A3B8' },
  { status: 'QUALIFIEE', label: 'Qualifiée', bg: '#F0F9FF', border: '#0284C7' },
  { status: 'PROPOSITION', label: 'Proposition / Devis', bg: '#FEF3C7', border: '#D97706' },
  { status: 'NEGOCIATION', label: 'Négociation', bg: '#F5F3FF', border: '#7C3AED' },
  { status: 'GAGNEE', label: 'Gagnée', bg: '#F0FDF4', border: '#16A34A' },
  { status: 'EN_COURS', label: 'En cours', bg: '#EFF6FF', border: '#2563EB' },
  { status: 'CLOTUREE', label: 'Clôturée', bg: '#ECFDF5', border: '#059669' },
  { status: 'PERDUE', label: 'Perdue / Annulée', bg: '#FEF2F2', border: '#DC2626' }
];

export function Affaires() {
  const navigate = useNavigate();
  const { affaires, clients, services, users, updateAffaireStatus, deleteAffaire } = useAppContext();
  const { currentUser } = useAuth();

  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [selectedCommercialId, setSelectedCommercialId] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [affaireToEdit, setAffaireToEdit] = useState<Affaire | null>(null);

  // Filter accessible affaires based on user role
  const accessibleAffaires = useMemo(() => {
    if (!currentUser) return [];
    if (['SuperAdmin', 'Directeur', 'Directeur adjoint'].includes(currentUser.role)) {
      return affaires;
    }
    if (currentUser.role === 'Responsable') {
      return affaires.filter(a => a.serviceId === currentUser.serviceId);
    }
    if (currentUser.role === 'Commercial') {
      return affaires.filter(a => a.commercialId === currentUser.id);
    }
    return [];
  }, [affaires, currentUser]);

  // Apply search and dropdown filters
  const filteredAffaires = useMemo(() => {
    return accessibleAffaires.filter(a => {
      const client = clients.find(c => c.id === a.clientId);
      const clientName = client ? client.name.toLowerCase() : '';
      const clientCompany = client?.company ? client.company.toLowerCase() : '';
      const matchesSearch = 
        a.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
        clientName.includes(searchTerm.toLowerCase()) ||
        clientCompany.includes(searchTerm.toLowerCase());

      const matchesService = !selectedServiceId || a.serviceId === selectedServiceId;
      const matchesCommercial = !selectedCommercialId || a.commercialId === selectedCommercialId;
      const matchesStatus = selectedStatus === 'ALL' || a.status === selectedStatus;

      return matchesSearch && matchesService && matchesCommercial && matchesStatus;
    });
  }, [accessibleAffaires, clients, searchTerm, selectedServiceId, selectedCommercialId, selectedStatus]);

  // Global KPIs calculation
  const kpis = useMemo(() => {
    const active = filteredAffaires.filter(a => !['CLOTUREE', 'PERDUE', 'ANNULEE'].includes(a.status));
    const totalPipelineHt = active.reduce((sum, a) => sum + (a.estimatedAmountHt || 0), 0);
    const totalWeightedHt = active.reduce((sum, a) => sum + ((a.estimatedAmountHt || 0) * (a.probability || 0) / 100), 0);
    const wonCount = filteredAffaires.filter(a => a.status === 'GAGNEE' || a.status === 'CLOTUREE').length;
    const winRate = filteredAffaires.length > 0 ? Math.round((wonCount / filteredAffaires.length) * 100) : 0;

    return {
      activeCount: active.length,
      totalPipelineHt,
      totalWeightedHt,
      wonCount,
      winRate
    };
  }, [filteredAffaires]);

  const handleEdit = (affaire: Affaire, e: React.MouseEvent) => {
    e.stopPropagation();
    setAffaireToEdit(affaire);
    setIsModalOpen(true);
  };

  const handleDelete = async (affaire: Affaire, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer l'affaire "${affaire.title}" (${affaire.reference}) ?`)) {
      await deleteAffaire(affaire.id);
    }
  };

  const handleStatusChange = async (affaireId: string, newStatus: AffaireStatus, e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation();
    await updateAffaireStatus(affaireId, newStatus);
  };

  const getClientDisplay = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    if (!client) return 'Client inconnu';
    return client.company ? `${client.name} (${client.company})` : client.name;
  };

  const getServiceName = (serviceId: string) => {
    return services.find(s => s.id === serviceId)?.name || 'N/A';
  };

  const getCommercialName = (commercialId: string) => {
    return users.find(u => u.id === commercialId)?.name || 'N/A';
  };

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('fr-FR').format(Math.round(amount)) + ' FCFA';
  };

  return (
    <div className="affaires-page">
      {/* Header */}
      <div className="affaires-header">
        <div className="affaires-header-left">
          <div className="affaires-title-badge">
            <Briefcase className="text-teal-600" size={28} />
            <div>
              <h1>Affaires & Pipeline Commercial</h1>
              <p className="affaires-subtitle">
                Pilotage des projets d'affaires, cycle de vente et rentabilité client
              </p>
            </div>
          </div>
        </div>

        <div className="affaires-header-actions">
          {/* View toggle */}
          <div className="view-mode-toggle">
            <button
              className={`view-toggle-btn ${viewMode === 'kanban' ? 'active' : ''}`}
              onClick={() => setViewMode('kanban')}
              title="Vue Pipeline Kanban"
            >
              <LayoutGrid size={18} />
              <span>Pipeline</span>
            </button>
            <button
              className={`view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              title="Vue Tableau Liste"
            >
              <ListIcon size={18} />
              <span>Tableau</span>
            </button>
          </div>

          <button
            className="btn-new-affaire"
            onClick={() => {
              setAffaireToEdit(null);
              setIsModalOpen(true);
            }}
          >
            <Plus size={18} />
            <span>Nouvelle Affaire</span>
          </button>
        </div>
      </div>

      {/* KPIs Summary Cards */}
      <div className="affaires-kpis-grid">
        <div className="kpi-card">
          <div className="kpi-icon-wrapper bg-blue-50 text-blue-600">
            <Briefcase size={22} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Affaires en cours</span>
            <div className="kpi-value">{kpis.activeCount}</div>
            <span className="kpi-sub">Sur {filteredAffaires.length} affaires au total</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-wrapper bg-teal-50 text-teal-600">
            <DollarSign size={22} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Pipeline Global HT</span>
            <div className="kpi-value">{formatMoney(kpis.totalPipelineHt)}</div>
            <span className="kpi-sub">Montant estimé des opportunités</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-wrapper bg-purple-50 text-purple-600">
            <TrendingUp size={22} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">CA Pondéré Prévisionnel</span>
            <div className="kpi-value">{formatMoney(kpis.totalWeightedHt)}</div>
            <span className="kpi-sub">Pondéré selon probabilité de succès</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-wrapper bg-emerald-50 text-emerald-600">
            <CheckCircle2 size={22} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Taux de Clôture</span>
            <div className="kpi-value">{kpis.winRate}%</div>
            <span className="kpi-sub">{kpis.wonCount} affaires gagnées / clôturées</span>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="affaires-filter-bar">
        <div className="search-input-wrapper">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Rechercher par titre, référence, client..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="filters-group">
          {currentUser?.role !== 'Commercial' && (
            <div className="filter-select-wrapper">
              <User size={16} className="filter-icon" />
              <select
                className="filter-select"
                value={selectedCommercialId}
                onChange={e => setSelectedCommercialId(e.target.value)}
              >
                <option value="">Tous les Commerciaux</option>
                {users.filter(u => ['Commercial', 'Responsable', 'Directeur'].includes(u.role)).map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          )}

          {['SuperAdmin', 'Directeur', 'Directeur adjoint'].includes(currentUser?.role || '') && (
            <div className="filter-select-wrapper">
              <Briefcase size={16} className="filter-icon" />
              <select
                className="filter-select"
                value={selectedServiceId}
                onChange={e => setSelectedServiceId(e.target.value)}
              >
                <option value="">Tous les Services</option>
                {services.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}

          {viewMode === 'list' && (
            <div className="filter-select-wrapper">
              <Filter size={16} className="filter-icon" />
              <select
                className="filter-select"
                value={selectedStatus}
                onChange={e => setSelectedStatus(e.target.value)}
              >
                <option value="ALL">Tous les Statuts</option>
                <option value="PROSPECTION">Prospection</option>
                <option value="QUALIFIEE">Qualifiée</option>
                <option value="PROPOSITION">Proposition</option>
                <option value="NEGOCIATION">Négociation</option>
                <option value="GAGNEE">Gagnée</option>
                <option value="EN_COURS">En cours</option>
                <option value="CLOTUREE">Clôturée</option>
                <option value="PERDUE">Perdue</option>
                <option value="ANNULEE">Annulée</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Main View Area */}
      {viewMode === 'kanban' ? (
        /* KANBAN VIEW */
        <div className="kanban-board-container">
          <div className="kanban-board">
            {STATUS_COLUMNS.map(col => {
              const colAffaires = filteredAffaires.filter(a => {
                if (col.status === 'PERDUE') {
                  return a.status === 'PERDUE' || a.status === 'ANNULEE';
                }
                return a.status === col.status;
              });

              const colTotalHt = colAffaires.reduce((sum, a) => sum + (a.estimatedAmountHt || 0), 0);

              return (
                <div key={col.status} className="kanban-column" style={{ borderTopColor: col.border }}>
                  <div className="kanban-column-header">
                    <div className="kanban-col-title">
                      <span className="kanban-col-name">{col.label}</span>
                      <span className="kanban-col-count">{colAffaires.length}</span>
                    </div>
                    <div className="kanban-col-amount">{formatMoney(colTotalHt)}</div>
                  </div>

                  <div className="kanban-cards-list">
                    {colAffaires.length === 0 ? (
                      <div className="kanban-empty-col">Aucune affaire</div>
                    ) : (
                      colAffaires.map(affaire => (
                        <div
                          key={affaire.id}
                          className="kanban-card"
                          onClick={() => navigate(`/affaires/${affaire.id}`)}
                        >
                          <div className="kanban-card-top">
                            <span className="affaire-ref-badge">{affaire.reference}</span>
                            <div className="kanban-card-actions">
                              <button
                                className="card-action-btn"
                                onClick={e => handleEdit(affaire, e)}
                                title="Modifier"
                              >
                                <Edit3 size={14} />
                              </button>
                              <button
                                className="card-action-btn delete"
                                onClick={e => handleDelete(affaire, e)}
                                title="Supprimer"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>

                          <h4 className="kanban-card-title">{affaire.title}</h4>

                          <div className="kanban-card-client">
                            <Building size={14} className="text-gray-400 flex-shrink-0" />
                            <span className="truncate">{getClientDisplay(affaire.clientId)}</span>
                          </div>

                          <div className="kanban-card-financials">
                            <div className="kanban-amount-block">
                              <span className="amount-label">Budget HT</span>
                              <span className="amount-value">{formatMoney(affaire.estimatedAmountHt)}</span>
                            </div>
                            <div className="kanban-prob-block">
                              <span className="prob-value">{affaire.probability}%</span>
                              <div className="prob-mini-bar">
                                <div
                                  className="prob-fill"
                                  style={{
                                    width: `${affaire.probability}%`,
                                    backgroundColor: affaire.probability >= 70 ? '#16A34A' : affaire.probability >= 40 ? '#D97706' : '#DC2626'
                                  }}
                                />
                              </div>
                            </div>
                          </div>

                          <div className="kanban-card-footer">
                            <div className="card-commercial-info">
                              <User size={13} className="text-gray-400" />
                              <span>{getCommercialName(affaire.commercialId)}</span>
                            </div>

                            <select
                              className="kanban-quick-status"
                              value={affaire.status}
                              onClick={e => e.stopPropagation()}
                              onChange={e => handleStatusChange(affaire.id, e.target.value as AffaireStatus, e)}
                            >
                              <option value="PROSPECTION">Prospection</option>
                              <option value="QUALIFIEE">Qualifiée</option>
                              <option value="PROPOSITION">Proposition</option>
                              <option value="NEGOCIATION">Négociation</option>
                              <option value="GAGNEE">Gagnée</option>
                              <option value="EN_COURS">En cours</option>
                              <option value="CLOTUREE">Clôturée</option>
                              <option value="PERDUE">Perdue</option>
                              <option value="ANNULEE">Annulée</option>
                            </select>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* LIST / TABLE VIEW */
        <div className="affaires-table-card">
          {filteredAffaires.length === 0 ? (
            <div className="affaires-empty-state">
              <AlertCircle size={40} className="text-gray-400 mb-2" />
              <h3>Aucune affaire trouvée</h3>
              <p>Modifiez vos filtres ou créez une nouvelle affaire pour ce client.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="affaires-table">
                <thead>
                  <tr>
                    <th>RÉFÉRENCE</th>
                    <th>PROJET / AFFAIRE</th>
                    <th>CLIENT ASSOCIÉ</th>
                    <th>SERVICE</th>
                    <th>COMMERCIAL</th>
                    <th className="text-right">MONTANT HT</th>
                    <th className="text-center">PROBABILITÉ</th>
                    <th className="text-right">PONDÉRÉ HT</th>
                    <th>STATUT</th>
                    <th className="text-center">ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAffaires.map(affaire => {
                    const weighted = (affaire.estimatedAmountHt || 0) * (affaire.probability || 0) / 100;
                    return (
                      <tr 
                        key={affaire.id} 
                        onClick={() => navigate(`/affaires/${affaire.id}`)}
                        className="clickable-row"
                      >
                        <td className="font-mono font-bold text-teal-700">{affaire.reference}</td>
                        <td>
                          <div className="affaire-row-title">{affaire.title}</div>
                          {affaire.description && (
                            <div className="affaire-row-desc">{affaire.description.slice(0, 50)}...</div>
                          )}
                        </td>
                        <td>
                          <div className="flex items-center gap-1 font-medium text-slate-800">
                            <Building size={14} className="text-gray-400" />
                            <span>{getClientDisplay(affaire.clientId)}</span>
                          </div>
                        </td>
                        <td>{getServiceName(affaire.serviceId)}</td>
                        <td>{getCommercialName(affaire.commercialId)}</td>
                        <td className="text-right font-semibold">{formatMoney(affaire.estimatedAmountHt)}</td>
                        <td className="text-center">
                          <span className={`prob-pill prob-${Math.floor(affaire.probability / 30)}`}>
                            {affaire.probability}%
                          </span>
                        </td>
                        <td className="text-right font-medium text-purple-700">{formatMoney(weighted)}</td>
                        <td>
                          <span className={`status-badge status-${affaire.status.toLowerCase()}`}>
                            {affaire.status}
                          </span>
                        </td>
                        <td className="text-center" onClick={e => e.stopPropagation()}>
                          <div className="row-actions">
                            <button
                              className="btn-icon"
                              onClick={e => handleEdit(affaire, e)}
                              title="Modifier"
                            >
                              <Edit3 size={16} />
                            </button>
                            <button
                              className="btn-icon delete"
                              onClick={e => handleDelete(affaire, e)}
                              title="Supprimer"
                            >
                              <Trash2 size={16} />
                            </button>
                            <button
                              className="btn-icon"
                              onClick={() => navigate(`/affaires/${affaire.id}`)}
                              title="Ouvrir la fiche 360°"
                            >
                              <ChevronRight size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal Création / Modification */}
      <AffaireModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setAffaireToEdit(null);
        }}
        affaireToEdit={affaireToEdit}
      />
    </div>
  );
}

