import React, { useState, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  Briefcase, ArrowLeft, Building, User, Calendar, 
  DollarSign, FileText, Receipt, TrendingUp, Edit3, 
  Trash2, Plus, CheckCircle2, Clock, AlertTriangle, 
  ChevronRight, ArrowUpRight, ShoppingBag, Edit2, Folder, Upload, Eye, Download
} from 'lucide-react';
import { useAppContext, type AffaireStatus, type Cout, type CrmDocument } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { AffaireModal } from '../components/AffaireModal';
import { CoutModal } from '../components/CoutModal';
import { useConfirm } from '../components/ConfirmModal';
import { DocumentPreviewModal } from '../components/DocumentPreviewModal';
import './Affaires.css';

export function AffaireDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { 
    affaires, clients, services, users, quotes, sales, 
    installments, facturePaiements, couts, crmDocuments, 
    addCrmDocument, deleteCrmDocument, downloadCrmDocument, 
    deleteCout, updateAffaireStatus, deleteAffaire 
  } = useAppContext();
  const { currentUser } = useAuth();
  const { confirm } = useConfirm();

  const [activeTab, setActiveTab] = useState<'synthese' | 'devis' | 'facturation' | 'couts' | 'notes' | 'documents'>('synthese');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCoutModalOpen, setIsCoutModalOpen] = useState(false);
  const [selectedCoutToEdit, setSelectedCoutToEdit] = useState<Cout | null>(null);
  const [previewDoc, setPreviewDoc] = useState<CrmDocument | null>(null);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const affaireFileInputRef = useRef<HTMLInputElement>(null);

  const affaire = useMemo(() => {
    return affaires.find(a => a.id === id);
  }, [affaires, id]);

  const client = useMemo(() => {
    if (!affaire) return null;
    return clients.find(c => c.id === affaire.clientId);
  }, [clients, affaire]);

  const service = useMemo(() => {
    if (!affaire) return null;
    return services.find(s => s.id === affaire.serviceId);
  }, [services, affaire]);

  const commercial = useMemo(() => {
    if (!affaire) return null;
    return users.find(u => u.id === affaire.commercialId);
  }, [users, affaire]);

  // Quotes linked to this affaire
  const linkedQuotes = useMemo(() => {
    if (!affaire) return [];
    return quotes.filter(q => q.affaireId === affaire.id);
  }, [quotes, affaire]);

  // Sales linked to this affaire
  const linkedSales = useMemo(() => {
    if (!affaire) return [];
    return sales.filter(s => s.affaireId === affaire.id);
  }, [sales, affaire]);

  // Direct costs linked to this affaire
  const linkedCouts = useMemo(() => {
    if (!affaire) return [];
    return couts.filter(c => c.affaireId === affaire.id);
  }, [couts, affaire]);

  // Documents linked to this affaire
  const linkedDocuments = useMemo(() => {
    if (!affaire) return [];
    return crmDocuments.filter(d => d.affaireId === affaire.id);
  }, [crmDocuments, affaire]);

  // Financial aggregates
  const financials = useMemo(() => {
    const totalQuotesHt = linkedQuotes.reduce((sum, q) => sum + (q.subtotal || 0), 0);
    const acceptedQuotesHt = linkedQuotes
      .filter(q => q.status === 'Accepté')
      .reduce((sum, q) => sum + (q.subtotal || 0), 0);

    const totalInvoicedHt = linkedSales.reduce((sum, s) => sum + (s.subtotal || 0), 0);
    const totalInvoicedTtc = linkedSales.reduce((sum, s) => sum + (s.total || 0), 0);

    // Sum of net paid amounts for linked sales
    const saleIds = linkedSales.map(s => s.id);
    const linkedPaiements = facturePaiements.filter(p => saleIds.includes(p.venteId) && p.status === 'VALIDE');
    const totalCollected = linkedPaiements.length > 0
      ? linkedPaiements.reduce((sum, p) => p.paymentType === 'ENCAISSEMENT' ? sum + p.amount : sum - p.amount, 0)
      : installments.filter(i => saleIds.includes(i.saleId)).reduce((sum, i) => sum + (i.paidAmount || 0), 0);

    const remainingBalance = Math.max(0, totalInvoicedTtc - totalCollected);

    // Calculate real direct costs from couts table (or fallback from sale lines)
    const directCostsFromTable = linkedCouts
      .filter(c => c.status !== 'ANNULE')
      .reduce((sum, c) => sum + (c.amountHt || 0), 0);

    const directCostsFromSaleLines = linkedSales.reduce((sum, s) => {
      const saleCost = (s.lines || []).reduce((lSum, l) => lSum + ((l.costPrice || 0) * (l.quantity || 0)), 0);
      return sum + saleCost;
    }, 0);

    const directCosts = directCostsFromTable > 0 ? directCostsFromTable : directCostsFromSaleLines;
    const grossMarginHt = totalInvoicedHt - directCosts;
    const marginRate = totalInvoicedHt > 0 ? Math.round((grossMarginHt / totalInvoicedHt) * 100) : 0;

    return {
      totalQuotesHt,
      acceptedQuotesHt,
      totalInvoicedHt,
      totalInvoicedTtc,
      totalCollected,
      remainingBalance,
      directCosts,
      grossMarginHt,
      marginRate
    };
  }, [linkedQuotes, linkedSales, linkedCouts, facturePaiements, installments]);

  if (!affaire) {
    return (
      <div className="affaires-page">
        <div className="affaires-empty-state">
          <AlertTriangle size={48} className="text-amber-500 mb-3" />
          <h2>Affaire introuvable</h2>
          <p>Cette affaire n'existe pas ou a été supprimée.</p>
          <button className="btn-new-affaire mt-4" onClick={() => navigate('/affaires')}>
            <ArrowLeft size={16} />
            <span>Retour aux affaires</span>
          </button>
        </div>
      </div>
    );
  }

  const handleStatusChange = async (newStatus: AffaireStatus) => {
    await updateAffaireStatus(affaire.id, newStatus);
  };

  const handleAffaireFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setIsUploadingDoc(true);
      try {
        await addCrmDocument(file, {
          uploaderId: currentUser?.id,
          affaireId: affaire.id,
          clientId: affaire.clientId,
          category: 'Contrat / Devis signé'
        });
      } catch (err) {
        console.error("Erreur d'upload :", err);
        alert("Erreur lors de l'enregistrement de la pièce jointe.");
      } finally {
        setIsUploadingDoc(false);
        if (affaireFileInputRef.current) affaireFileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteAffaireDoc = (doc: CrmDocument) => {
    confirm({
      title: 'Supprimer la pièce jointe',
      message: `Voulez-vous vraiment supprimer "${doc.name}" de cette affaire ?`,
      confirmLabel: 'Supprimer',
      variant: 'danger',
      onConfirm: () => deleteCrmDocument(doc.id)
    });
  };

  const handleDelete = async () => {
    if (window.confirm(`Voulez-vous vraiment supprimer l'affaire ${affaire.reference} ?`)) {
      await deleteAffaire(affaire.id);
      navigate('/affaires');
    }
  };

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('fr-FR').format(Math.round(amount)) + ' FCFA';
  };

  return (
    <div className="affaire-detail-page">
      {/* Top Breadcrumb & Action bar */}
      <div className="detail-top-bar">
        <button className="btn-back" onClick={() => navigate('/affaires')}>
          <ArrowLeft size={18} />
          <span>Toutes les affaires</span>
        </button>

        <div className="detail-actions">
          <button className="btn-action-outline" onClick={() => setIsEditModalOpen(true)}>
            <Edit3 size={16} />
            <span>Modifier</span>
          </button>
          <button className="btn-action-danger" onClick={handleDelete}>
            <Trash2 size={16} />
            <span>Supprimer</span>
          </button>
        </div>
      </div>

      {/* Main Header Banner */}
      <div className="affaire-hero-card">
        <div className="hero-top">
          <div className="hero-reference-tag">
            <Briefcase size={18} />
            <span>{affaire.reference}</span>
          </div>

          <div className="hero-status-selector">
            <span className="status-label">Étape actuelle :</span>
            <select
              className={`status-select status-${affaire.status.toLowerCase()}`}
              value={affaire.status}
              onChange={e => handleStatusChange(e.target.value as AffaireStatus)}
            >
              <option value="PROSPECTION">Prospection</option>
              <option value="QUALIFIEE">Qualifiée</option>
              <option value="PROPOSITION">Proposition / Devis</option>
              <option value="NEGOCIATION">Négociation</option>
              <option value="GAGNEE">Gagnée</option>
              <option value="EN_COURS">En cours de réalisation</option>
              <option value="CLOTUREE">Clôturée</option>
              <option value="PERDUE">Perdue</option>
              <option value="ANNULEE">Annulée</option>
            </select>
          </div>
        </div>

        <h1 className="hero-title">{affaire.title}</h1>

        <div className="hero-metadata-grid">
          <div className="meta-item">
            <Building size={16} className="text-teal-600" />
            <div>
              <span className="meta-label">Client Associé</span>
              <div className="meta-val">
                {client ? (
                  <Link to={`/clients?selected=${client.id}`} className="client-link">
                    {client.name} {client.company ? `(${client.company})` : ''}
                    <ArrowUpRight size={14} className="inline ml-1" />
                  </Link>
                ) : (
                  'Client non spécifié'
                )}
              </div>
            </div>
          </div>

          <div className="meta-item">
            <User size={16} className="text-teal-600" />
            <div>
              <span className="meta-label">Commercial Responsable</span>
              <div className="meta-val">{commercial?.name || 'Non assigné'}</div>
            </div>
          </div>

          <div className="meta-item">
            <Briefcase size={16} className="text-teal-600" />
            <div>
              <span className="meta-label">Service Métier</span>
              <div className="meta-val">{service?.name || 'Général'}</div>
            </div>
          </div>

          <div className="meta-item">
            <Calendar size={16} className="text-teal-600" />
            <div>
              <span className="meta-label">Date Début / Échéance</span>
              <div className="meta-val">
                {affaire.startDatePlanned ? new Date(affaire.startDatePlanned).toLocaleDateString('fr-FR') : 'Non définie'}
                {' → '}
                {affaire.endDatePlanned ? new Date(affaire.endDatePlanned).toLocaleDateString('fr-FR') : 'Non définie'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Financial KPIs Banner */}
      <div className="financial-kpis-grid">
        <div className="f-kpi-card">
          <span className="f-label">Budget Estimé HT</span>
          <div className="f-value">{formatMoney(affaire.estimatedAmountHt)}</div>
          <span className="f-sub">Probabilité : {affaire.probability}%</span>
        </div>

        <div className="f-kpi-card">
          <span className="f-label">Devis Validés HT</span>
          <div className="f-value text-blue-700">{formatMoney(financials.acceptedQuotesHt)}</div>
          <span className="f-sub">{linkedQuotes.length} devis émis au total</span>
        </div>

        <div className="f-kpi-card">
          <span className="f-label">CA Facturé HT</span>
          <div className="f-value text-teal-700">{formatMoney(financials.totalInvoicedHt)}</div>
          <span className="f-sub">TTC : {formatMoney(financials.totalInvoicedTtc)}</span>
        </div>

        <div className="f-kpi-card">
          <span className="f-label">Marge Brute HT</span>
          <div className="f-value text-emerald-700">{formatMoney(financials.grossMarginHt)}</div>
          <span className="f-sub">Taux de marge : {financials.marginRate}%</span>
        </div>

        <div className="f-kpi-card">
          <span className="f-label">Reste à Recouvrer TTC</span>
          <div className={`f-value ${financials.remainingBalance > 0 ? 'text-amber-600' : 'text-green-600'}`}>
            {formatMoney(financials.remainingBalance)}
          </div>
          <span className="f-sub">Encaissé : {formatMoney(financials.totalCollected)}</span>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="detail-tabs-bar">
        <button
          className={`tab-btn ${activeTab === 'synthese' ? 'active' : ''}`}
          onClick={() => setActiveTab('synthese')}
        >
          <TrendingUp size={16} />
          <span>Synthèse & Rentabilité</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'devis' ? 'active' : ''}`}
          onClick={() => setActiveTab('devis')}
        >
          <FileText size={16} />
          <span>Devis Associés ({linkedQuotes.length})</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'facturation' ? 'active' : ''}`}
          onClick={() => setActiveTab('facturation')}
        >
          <Receipt size={16} />
          <span>Facturation & Ventes ({linkedSales.length})</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'couts' ? 'active' : ''}`}
          onClick={() => setActiveTab('couts')}
        >
          <ShoppingBag size={16} />
          <span>Coûts & Achats ({linkedCouts.length})</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'documents' ? 'active' : ''}`}
          onClick={() => setActiveTab('documents')}
        >
          <Folder size={16} />
          <span>Documents & Pièces ({linkedDocuments.length})</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'notes' ? 'active' : ''}`}
          onClick={() => setActiveTab('notes')}
        >
          <FileText size={16} />
          <span>Cahier des charges & Notes</span>
        </button>
      </div>

      {/* Tab Contents */}
      <div className="detail-tab-content">
        {activeTab === 'synthese' && (
          <div className="tab-synthese-grid">
            <div className="synthese-card">
              <h3>Cycle de Vente & Évolution</h3>
              <div className="progression-bar-wrapper">
                <div className="progression-steps">
                  <div className={`step-node ${['PROSPECTION', 'QUALIFIEE', 'PROPOSITION', 'NEGOCIATION', 'GAGNEE', 'EN_COURS', 'CLOTUREE'].includes(affaire.status) ? 'done' : ''}`}>
                    <span>1. Qualifiée</span>
                  </div>
                  <div className={`step-node ${['PROPOSITION', 'NEGOCIATION', 'GAGNEE', 'EN_COURS', 'CLOTUREE'].includes(affaire.status) ? 'done' : ''}`}>
                    <span>2. Devis émis</span>
                  </div>
                  <div className={`step-node ${['NEGOCIATION', 'GAGNEE', 'EN_COURS', 'CLOTUREE'].includes(affaire.status) ? 'done' : ''}`}>
                    <span>3. Négociation</span>
                  </div>
                  <div className={`step-node ${['GAGNEE', 'EN_COURS', 'CLOTUREE'].includes(affaire.status) ? 'done' : ''}`}>
                    <span>4. Gagnée</span>
                  </div>
                  <div className={`step-node ${['CLOTUREE'].includes(affaire.status) ? 'done' : ''}`}>
                    <span>5. Clôturée</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 p-3 bg-slate-50 rounded-lg text-sm text-slate-700">
                <strong>Probabilité estimée : {affaire.probability}%</strong>
                <p className="mt-1 text-slate-500">
                  Valeur pondérée actuelle : {formatMoney((affaire.estimatedAmountHt * affaire.probability) / 100)}
                </p>
              </div>
            </div>

            <div className="synthese-card">
              <h3>Dernières Pièces Commerciales</h3>
              <div className="mini-pieces-list">
                {linkedQuotes.length === 0 && linkedSales.length === 0 ? (
                  <p className="text-gray-500 text-sm py-4">Aucune pièce commerciale n'a encore été rattachée à cette affaire.</p>
                ) : (
                  <>
                    {linkedQuotes.map(q => (
                      <div key={q.id} className="mini-piece-row">
                        <div className="flex items-center gap-2">
                          <FileText size={16} className="text-blue-600" />
                          <span className="font-mono text-sm font-semibold">{q.quoteNumber}</span>
                          <span className="text-xs text-gray-500">({q.subject})</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold">{formatMoney(q.total)}</span>
                          <span className={`status-badge status-${q.status.toLowerCase()}`}>{q.status}</span>
                        </div>
                      </div>
                    ))}
                    {linkedSales.map(s => (
                      <div key={s.id} className="mini-piece-row">
                        <div className="flex items-center gap-2">
                          <Receipt size={16} className="text-teal-600" />
                          <span className="font-mono text-sm font-semibold">{s.saleNumber}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold">{formatMoney(s.total)}</span>
                          <span className={`status-badge status-${s.status.toLowerCase()}`}>{s.status}</span>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'devis' && (
          <div className="tab-section">
            <div className="section-header-flex">
              <h3>Devis rattachés à cette affaire</h3>
              <button
                className="btn-create-sub"
                onClick={() => navigate(`/devis/nouveau?affaireId=${affaire.id}&clientId=${affaire.clientId}&serviceId=${affaire.serviceId}`)}
              >
                <Plus size={16} />
                <span>Créer un devis pour cette affaire</span>
              </button>
            </div>

            {linkedQuotes.length === 0 ? (
              <div className="sub-empty-card">
                <FileText size={36} className="text-gray-400 mb-2" />
                <p>Aucun devis n'a encore été créé pour cette affaire.</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="affaires-table">
                  <thead>
                    <tr>
                      <th>NUMÉRO</th>
                      <th>OBJET</th>
                      <th>DATE</th>
                      <th className="text-right">TOTAL HT</th>
                      <th className="text-right">TOTAL TTC</th>
                      <th>STATUT</th>
                      <th className="text-center">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linkedQuotes.map(quote => (
                      <tr key={quote.id}>
                        <td className="font-mono font-bold text-teal-700">{quote.quoteNumber}</td>
                        <td>{quote.subject}</td>
                        <td>{new Date(quote.date).toLocaleDateString('fr-FR')}</td>
                        <td className="text-right">{formatMoney(quote.subtotal)}</td>
                        <td className="text-right font-bold">{formatMoney(quote.total)}</td>
                        <td>
                          <span className={`status-badge status-${quote.status.toLowerCase()}`}>
                            {quote.status}
                          </span>
                        </td>
                        <td className="text-center">
                          <button
                            className="btn-icon"
                            onClick={() => navigate(`/devis?selected=${quote.id}`)}
                            title="Voir le devis"
                          >
                            <ChevronRight size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'facturation' && (
          <div className="tab-section">
            <div className="section-header-flex">
              <h3>Factures & Ventes émises</h3>
            </div>

            {linkedSales.length === 0 ? (
              <div className="sub-empty-card">
                <Receipt size={36} className="text-gray-400 mb-2" />
                <p>Aucune facture n'a encore été générée pour cette affaire.</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="affaires-table">
                  <thead>
                    <tr>
                      <th>NUMÉRO FACTURE</th>
                      <th>DATE</th>
                      <th className="text-right">TOTAL HT</th>
                      <th className="text-right">TOTAL TTC</th>
                      <th>STATUT</th>
                      <th className="text-center">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linkedSales.map(sale => (
                      <tr key={sale.id}>
                        <td className="font-mono font-bold text-teal-700">{sale.saleNumber}</td>
                        <td>{new Date(sale.date).toLocaleDateString('fr-FR')}</td>
                        <td className="text-right">{formatMoney(sale.subtotal)}</td>
                        <td className="text-right font-bold">{formatMoney(sale.total)}</td>
                        <td>
                          <span className={`status-badge status-${sale.status.toLowerCase()}`}>
                            {sale.status}
                          </span>
                        </td>
                        <td className="text-center">
                          <button
                            className="btn-icon"
                            onClick={() => navigate(`/ventes?selected=${sale.id}`)}
                            title="Voir la vente"
                          >
                            <ChevronRight size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'couts' && (
          <div className="tab-section">
            <div className="section-header-flex">
              <div>
                <h3>Coûts Directs d'Affaire ({linkedCouts.length})</h3>
                <p style={{ fontSize: '0.85rem', color: '#64748B', margin: '2px 0 0 0' }}>
                  Total direct engagé : <strong>{formatMoney(financials.directCosts)} HT</strong>
                </p>
              </div>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setSelectedCoutToEdit(null);
                  setIsCoutModalOpen(true);
                }}
              >
                <Plus size={16} style={{ marginRight: '6px' }} />
                Ajouter un coût direct
              </button>
            </div>

            {linkedCouts.length === 0 ? (
              <div className="sub-empty-card">
                <ShoppingBag size={36} className="text-gray-400 mb-2" />
                <p>Aucun coût direct n'a encore été rattaché à cette affaire.</p>
                <button
                  className="btn btn-outline mt-3"
                  onClick={() => {
                    setSelectedCoutToEdit(null);
                    setIsCoutModalOpen(true);
                  }}
                >
                  <Plus size={14} style={{ marginRight: '4px' }} /> Ajouter le premier coût
                </button>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="affaires-table">
                  <thead>
                    <tr>
                      <th>RÉFÉRENCE</th>
                      <th>DATE</th>
                      <th>CATÉGORIE</th>
                      <th>FOURNISSEUR / FACTURE</th>
                      <th>DESCRIPTION</th>
                      <th className="text-right">MONTANT HT</th>
                      <th className="text-right">TTC</th>
                      <th>STATUT</th>
                      <th className="text-center">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linkedCouts.map(cout => (
                      <tr key={cout.id}>
                        <td className="font-mono font-bold text-teal-700">{cout.reference}</td>
                        <td>{new Date(cout.date).toLocaleDateString('fr-FR')}</td>
                        <td>
                          <span style={{ fontSize: '0.78rem', color: '#475569' }}>
                            {cout.category}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{cout.supplierName || '-'}</div>
                          {cout.invoiceRef && (
                            <div style={{ fontSize: '0.72rem', color: '#64748B' }}>N° {cout.invoiceRef}</div>
                          )}
                        </td>
                        <td>
                          <div style={{ fontSize: '0.85rem', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {cout.description}
                          </div>
                        </td>
                        <td className="text-right font-semibold">{formatMoney(cout.amountHt)}</td>
                        <td className="text-right font-bold text-teal-800">{formatMoney(cout.amountTtc)}</td>
                        <td>
                          <span className={`status-badge status-${cout.status.toLowerCase()}`}>
                            {cout.status}
                          </span>
                        </td>
                        <td className="text-center">
                          <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                            <button
                              className="btn-icon"
                              onClick={() => {
                                setSelectedCoutToEdit(cout);
                                setIsCoutModalOpen(true);
                              }}
                              title="Modifier"
                            >
                              <Edit2 size={15} />
                            </button>
                            <button
                              className="btn-icon text-red-600"
                              onClick={() => {
                                confirm({
                                  title: 'Supprimer le coût',
                                  message: `Supprimer la dépense "${cout.reference}" ?`,
                                  confirmLabel: 'Supprimer',
                                  variant: 'danger',
                                  onConfirm: () => deleteCout(cout.id)
                                });
                              }}
                              title="Supprimer"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'notes' && (
          <div className="tab-notes-grid">
            <div className="notes-block">
              <h3>Cahier des charges & Besoins exprimés</h3>
              <div className="notes-content">
                {affaire.description ? (
                  <p className="whitespace-pre-wrap">{affaire.description}</p>
                ) : (
                  <p className="text-gray-400 italic">Aucune description détaillée enregistrée.</p>
                )}
              </div>
            </div>

            <div className="notes-block">
              <h3>Notes internes & Stratégie commerciale</h3>
              <div className="notes-content">
                {affaire.notes ? (
                  <p className="whitespace-pre-wrap">{affaire.notes}</p>
                ) : (
                  <p className="text-gray-400 italic">Aucune note interne enregistrée.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab Documents & Pièces Jointes */}
        {activeTab === 'documents' && (
          <div className="tab-documents-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0F172A' }}>Pièces Jointes de l'Affaire</h3>
                <p style={{ margin: '2px 0 0', fontSize: '0.85rem', color: '#64748B' }}>
                  Contrats signés, bons de commande, BAT validés, cahiers des charges et factures
                </p>
              </div>

              <button
                className="btn btn-primary"
                onClick={() => affaireFileInputRef.current?.click()}
                disabled={isUploadingDoc}
              >
                <Upload size={16} style={{ marginRight: '6px' }} />
                {isUploadingDoc ? 'Upload...' : 'Joindre un document'}
              </button>
              <input
                type="file"
                ref={affaireFileInputRef}
                style={{ display: 'none' }}
                onChange={handleAffaireFileUpload}
              />
            </div>

            <div className="card">
              <div className="table-responsive">
                <table className="data-table responsive-table">
                  <thead>
                    <tr>
                      <th>Document</th>
                      <th>Catégorie</th>
                      <th>Date d'ajout</th>
                      <th>Taille</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linkedDocuments.map(doc => (
                      <tr key={doc.id}>
                        <td data-label="Document">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <FileText size={18} color="#0D9488" />
                            <span style={{ fontWeight: 600 }}>{doc.name}</span>
                          </div>
                        </td>

                        <td data-label="Catégorie">
                          <span className="badge-status bg-info" style={{ fontSize: '0.78rem' }}>
                            {doc.category || 'Contrat / Devis signé'}
                          </span>
                        </td>

                        <td data-label="Date">
                          {new Date(doc.createdAt).toLocaleDateString('fr-FR')}
                        </td>

                        <td data-label="Taille">
                          {doc.sizeBytes > 1024 * 1024 ? (doc.sizeBytes / (1024 * 1024)).toFixed(1) + ' MB' : (doc.sizeBytes / 1024).toFixed(1) + ' KB'}
                        </td>

                        <td data-label="Actions">
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button
                              className="icon-button text-teal-700"
                              onClick={() => setPreviewDoc(doc)}
                              title="Aperçu"
                            >
                              <Eye size={16} />
                            </button>

                            <button
                              className="icon-button text-blue-600"
                              onClick={() => downloadCrmDocument(doc)}
                              title="Télécharger"
                            >
                              <Download size={16} />
                            </button>

                            <button
                              className="icon-button text-error"
                              onClick={() => handleDeleteAffaireDoc(doc)}
                              title="Supprimer"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {linkedDocuments.length === 0 && (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: '36px', color: '#64748B' }}>
                          <Folder size={36} style={{ opacity: 0.35, marginBottom: '8px' }} />
                          <div>Aucun document joint à cette affaire pour le moment.</div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      <AffaireModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        affaireToEdit={affaire}
      />

      {/* Cout Modal */}
      <CoutModal
        isOpen={isCoutModalOpen}
        onClose={() => {
          setIsCoutModalOpen(false);
          setSelectedCoutToEdit(null);
        }}
        coutToEdit={selectedCoutToEdit}
        defaultAffaireId={affaire.id}
        defaultServiceId={affaire.serviceId}
      />

      {/* Document Preview Modal */}
      {previewDoc && (
        <DocumentPreviewModal
          document={previewDoc}
          onClose={() => setPreviewDoc(null)}
        />
      )}
    </div>
  );
}

