import React, { useState, useEffect } from 'react';
import { Store, Plus, ArrowRightLeft, CheckCircle2, Clock, MapPin, Phone, Mail, FileText, Search, Package } from 'lucide-react';
import { PosMagasinService } from '../../features/pos/services/PosMagasinService';
import type { PosMagasin, PosStockTransfer, PosStockTransferLine } from '../../types/posMagasins';
import { useAppContext } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-hot-toast';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';

export default function PosMagasins() {
  const { posProducts } = useAppContext();
  const { currentUser } = useAuth();
  const [magasins, setMagasins] = useState<PosMagasin[]>([]);
  const [transfers, setTransfers] = useState<PosStockTransfer[]>([]);
  const [activeTab, setActiveTab] = useState<'magasins' | 'transfers'>('magasins');
  const [loading, setLoading] = useState(true);

  // Modal Création Magasin
  const [showAddMagasin, setShowAddMagasin] = useState(false);
  const [newMagasin, setNewMagasin] = useState({
    nom: '',
    code: '',
    adresse: '',
    ville: 'Abidjan',
    telephone: '',
    email: '',
    ticketMessage: '',
  });

  // Modal Nouveau Transfert
  const [showNewTransfer, setShowNewTransfer] = useState(false);
  const [transferSourceId, setTransferSourceId] = useState('');
  const [transferDestId, setTransferDestId] = useState('');
  const [transferNotes, setTransferNotes] = useState('');
  const [transferLines, setTransferLines] = useState<PosStockTransferLine[]>([]);
  const [productSearch, setProductSearch] = useState('');

  const canManage = currentUser && ['SuperAdmin', 'Directeur', 'Directeur adjoint', 'Gerant'].includes(currentUser.role);

  const loadData = async () => {
    setLoading(true);
    try {
      const [magList, trfList] = await Promise.all([
        PosMagasinService.loadMagasins(),
        PosMagasinService.loadStockTransfers(),
      ]);
      setMagasins(magList);
      setTransfers(trfList);
      if (magList.length >= 2 && !transferSourceId) {
        setTransferSourceId(magList[0].id);
        setTransferDestId(magList[1].id);
      }
    } catch {
      toast.error('Erreur chargement des magasins');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateMagasin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMagasin.nom.trim()) {
      toast.error('Le nom de la librairie est obligatoire');
      return;
    }
    try {
      await PosMagasinService.createMagasin({
        ...newMagasin,
        actif: true,
        isDefault: magasins.length === 0,
      });
      toast.success('Boutique créée avec succès !');
      setShowAddMagasin(false);
      setNewMagasin({ nom: '', code: '', adresse: '', ville: 'Abidjan', telephone: '', email: '', ticketMessage: '' });
      loadData();
    } catch {
      toast.error('Erreur lors de la création');
    }
  };

  const handleAddProductToTransfer = (prod: typeof posProducts[0]) => {
    const existing = transferLines.find(l => l.productId === prod.id);
    if (existing) {
      setTransferLines(transferLines.map(l => l.productId === prod.id ? { ...l, quantity: l.quantity + 1 } : l));
    } else {
      setTransferLines([...transferLines, {
        id: prod.id,
        productId: prod.id,
        productName: prod.name,
        reference: prod.reference,
        quantity: 1,
      }]);
    }
    setProductSearch('');
  };

  const handleCreateTransfer = async () => {
    if (!transferSourceId || !transferDestId) {
      toast.error('Veuillez sélectionner la boutique source et la boutique destination');
      return;
    }
    if (transferSourceId === transferDestId) {
      toast.error('Le magasin source et la destination doivent être différents');
      return;
    }
    if (transferLines.length === 0) {
      toast.error('Ajoutez au moins un article à transférer');
      return;
    }
    try {
      await PosMagasinService.createStockTransfer(
        transferSourceId,
        transferDestId,
        transferLines,
        currentUser?.id,
        transferNotes
      );
      toast.success('Bon de transfert expédié avec succès !');
      setShowNewTransfer(false);
      setTransferLines([]);
      setTransferNotes('');
      loadData();
    } catch {
      toast.error('Erreur création du transfert');
    }
  };

  const handleConfirmReceipt = async (transferId: string) => {
    try {
      await PosMagasinService.confirmTransferReceipt(transferId, currentUser?.id);
      toast.success('Réception confirmée ! Stock mis à jour.');
      loadData();
    } catch {
      toast.error('Erreur lors de la confirmation');
    }
  };

  const filteredSearchProducts = posProducts.filter(p => {
    if (!productSearch.trim()) return false;
    const q = productSearch.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.reference.toLowerCase().includes(q);
  }).slice(0, 5);

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Store size={26} color="var(--color-primary, #0D9488)" />
            Multi-Magasins & Librairies
          </h1>
          <p style={{ color: 'var(--color-text-muted, #64748b)', marginTop: '4px', fontSize: '14px' }}>
            Gestion centralisée de vos points de vente et des transferts de stock entre boutiques.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          {canManage && activeTab === 'magasins' && (
            <Button onClick={() => setShowAddMagasin(true)}>
              <Plus size={16} style={{ marginRight: '6px' }} />
              Nouvelle Librairie
            </Button>
          )}
          {canManage && activeTab === 'transfers' && (
            <Button onClick={() => setShowNewTransfer(true)}>
              <ArrowRightLeft size={16} style={{ marginRight: '6px' }} />
              Nouveau Transfert
            </Button>
          )}
        </div>
      </div>

      {/* Onglets */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--color-border, #e2e8f0)', marginBottom: '24px' }}>
        <button
          type="button"
          onClick={() => setActiveTab('magasins')}
          style={{
            padding: '10px 18px',
            border: 'none',
            borderBottom: activeTab === 'magasins' ? '2px solid var(--color-primary, #0D9488)' : '2px solid transparent',
            background: 'transparent',
            fontWeight: activeTab === 'magasins' ? 600 : 500,
            color: activeTab === 'magasins' ? 'var(--color-primary, #0D9488)' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Store size={18} />
          Boutiques ({magasins.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('transfers')}
          style={{
            padding: '10px 18px',
            border: 'none',
            borderBottom: activeTab === 'transfers' ? '2px solid var(--color-primary, #0D9488)' : '2px solid transparent',
            background: 'transparent',
            fontWeight: activeTab === 'transfers' ? 600 : 500,
            color: activeTab === 'transfers' ? 'var(--color-primary, #0D9488)' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <ArrowRightLeft size={18} />
          Transferts Inter-Boutiques ({transfers.length})
        </button>
      </div>

      {/* Vue 1 : Liste des Magasins */}
      {activeTab === 'magasins' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
          {magasins.map(mag => (
            <div
              key={mag.id}
              style={{
                background: '#ffffff',
                borderRadius: 'var(--radius-lg, 12px)',
                border: '1px solid var(--color-border, #e2e8f0)',
                padding: '20px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(13, 148, 136, 0.1)', color: 'var(--color-primary, #0D9488)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Store size={22} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>{mag.nom}</h3>
                      {mag.code && <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>Code : {mag.code}</span>}
                    </div>
                  </div>
                  {mag.isDefault && (
                    <span style={{ fontSize: '11px', background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                      Principale
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: '#475569', marginTop: '14px' }}>
                  {(mag.adresse || mag.ville) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <MapPin size={15} color="#94a3b8" />
                      <span>{[mag.adresse, mag.ville].filter(Boolean).join(', ')}</span>
                    </div>
                  )}
                  {mag.telephone && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Phone size={15} color="#94a3b8" />
                      <span>{mag.telephone}</span>
                    </div>
                  )}
                  {mag.email && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Mail size={15} color="#94a3b8" />
                      <span>{mag.email}</span>
                    </div>
                  )}
                  {mag.ticketMessage && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontStyle: 'italic', background: '#f8fafc', padding: '8px', borderRadius: '6px', fontSize: '12px' }}>
                      <FileText size={14} color="#94a3b8" style={{ marginTop: '2px', flexShrink: 0 }} />
                      <span>« {mag.ticketMessage} »</span>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: mag.actif ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                  ● {mag.actif ? 'Active' : 'Désactivée'}
                </span>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  {posProducts.length} articles au catalogue
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Vue 2 : Transferts de Stock Inter-Librairies */}
      {activeTab === 'transfers' && (
        <div style={{ background: '#ffffff', borderRadius: 'var(--radius-lg, 12px)', border: '1px solid var(--color-border, #e2e8f0)', overflow: 'hidden' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--color-border, #e2e8f0)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>Historique des Transferts de Stock</h3>
            <span style={{ fontSize: '13px', color: '#64748b' }}>Total : {transfers.length}</span>
          </div>

          {transfers.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
              <ArrowRightLeft size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
              <p>Aucun transfert de stock pour le moment.</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--color-border, #e2e8f0)' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>N° Bon</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Date</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Boutique Source</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Destination</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Articles</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Statut</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map(trf => {
                  const source = magasins.find(m => m.id === trf.magasinSourceId)?.nom || 'Boutique Source';
                  const dest = magasins.find(m => m.id === trf.magasinDestId)?.nom || 'Boutique Dest.';
                  const totalUnits = (trf.lines || []).reduce((sum, l) => sum + (l.quantity || 0), 0);

                  return (
                    <tr key={trf.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>{trf.transferNumber}</td>
                      <td style={{ padding: '12px 16px', color: '#64748b' }}>{new Date(trf.createdAt).toLocaleDateString('fr-FR')}</td>
                      <td style={{ padding: '12px 16px' }}>{source}</td>
                      <td style={{ padding: '12px 16px', fontWeight: 500 }}>{dest}</td>
                      <td style={{ padding: '12px 16px' }}>
                        {trf.lines?.length || 0} réf. ({totalUnits} unité{totalUnits > 1 ? 's' : ''})
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {trf.status === 'Réceptionné' ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#16a34a', background: '#dcfce7', padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600 }}>
                            <CheckCircle2 size={12} /> Réceptionné
                          </span>
                        ) : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#d97706', background: '#fef3c7', padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600 }}>
                            <Clock size={12} /> En transit
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        {trf.status === 'Expédié' && canManage && (
                          <button
                            type="button"
                            onClick={() => handleConfirmReceipt(trf.id)}
                            style={{
                              padding: '5px 10px',
                              borderRadius: '6px',
                              background: 'var(--color-primary, #0D9488)',
                              color: '#ffffff',
                              border: 'none',
                              fontSize: '12px',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Confirmer Réception
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Modal Création Magasin */}
      {showAddMagasin && (
        <Modal open={showAddMagasin} onClose={() => setShowAddMagasin(false)} title="Ajouter une Librairie / Boutique">
          <form onSubmit={handleCreateMagasin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>Nom de la Librairie *</label>
              <input
                type="text"
                required
                value={newMagasin.nom}
                onChange={e => setNewMagasin({ ...newMagasin, nom: e.target.value })}
                placeholder="Ex: Librairie Hinov Cocody"
                style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>Code Boutique</label>
                <input
                  type="text"
                  value={newMagasin.code}
                  onChange={e => setNewMagasin({ ...newMagasin, code: e.target.value })}
                  placeholder="Ex: LIB-02"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>Ville</label>
                <input
                  type="text"
                  value={newMagasin.ville}
                  onChange={e => setNewMagasin({ ...newMagasin, ville: e.target.value })}
                  placeholder="Ex: Abidjan"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>Adresse physique</label>
              <input
                type="text"
                value={newMagasin.adresse}
                onChange={e => setNewMagasin({ ...newMagasin, adresse: e.target.value })}
                placeholder="Ex: Boulevard Latrille, près de la pharmacie"
                style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>Téléphone</label>
                <input
                  type="text"
                  value={newMagasin.telephone}
                  onChange={e => setNewMagasin({ ...newMagasin, telephone: e.target.value })}
                  placeholder="+225 07..."
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>Email</label>
                <input
                  type="email"
                  value={newMagasin.email}
                  onChange={e => setNewMagasin({ ...newMagasin, email: e.target.value })}
                  placeholder="cocody@hinovgroup.com"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>Message personnalisé sur le ticket de caisse</label>
              <input
                type="text"
                value={newMagasin.ticketMessage}
                onChange={e => setNewMagasin({ ...newMagasin, ticketMessage: e.target.value })}
                placeholder="Ex: Merci pour votre visite chez Hinov Cocody !"
                style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
              <Button variant="outline" type="button" onClick={() => setShowAddMagasin(false)}>Annuler</Button>
              <Button type="submit">Enregistrer la Boutique</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal Nouveau Transfert */}
      {showNewTransfer && (
        <Modal open={showNewTransfer} onClose={() => setShowNewTransfer(false)} title="Nouveau Bon de Transfert de Stock">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>Boutique Source (Départ) *</label>
                <select
                  value={transferSourceId}
                  onChange={e => setTransferSourceId(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                >
                  {magasins.map(m => (
                    <option key={m.id} value={m.id}>{m.nom}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>Boutique Destination (Arrivée) *</label>
                <select
                  value={transferDestId}
                  onChange={e => setTransferDestId(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                >
                  {magasins.map(m => (
                    <option key={m.id} value={m.id} disabled={m.id === transferSourceId}>{m.nom}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Ajout d'articles */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>Rechercher un article à transférer</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={productSearch}
                  onChange={e => setProductSearch(e.target.value)}
                  placeholder="Tapez le nom ou la référence..."
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                />
                {filteredSearchProducts.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', zIndex: 10, marginTop: '4px' }}>
                    {filteredSearchProducts.map(p => (
                      <div
                        key={p.id}
                        onClick={() => handleAddProductToTransfer(p)}
                        style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}
                      >
                        <span style={{ fontWeight: 500 }}>{p.name} ({p.reference})</span>
                        <span style={{ color: '#64748b' }}>Stock : {p.quantity}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Articles sélectionnés */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '12px', maxHeight: '180px', overflowY: 'auto' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '8px' }}>
                Articles dans le bon de transfert ({transferLines.length})
              </div>
              {transferLines.length === 0 ? (
                <div style={{ color: '#94a3b8', fontSize: '13px', textAlign: 'center', padding: '10px 0' }}>Aucun article ajouté</div>
              ) : (
                transferLines.map(line => (
                  <div key={line.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f8fafc', fontSize: '13px' }}>
                    <span>{line.productName} ({line.reference})</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="number"
                        min="1"
                        value={line.quantity}
                        onChange={e => setTransferLines(transferLines.map(l => l.id === line.id ? { ...l, quantity: Math.max(1, Number(e.target.value)) } : l))}
                        style={{ width: '60px', padding: '4px 6px', borderRadius: '4px', border: '1px solid #cbd5e1', textAlign: 'center' }}
                      />
                      <button
                        type="button"
                        onClick={() => setTransferLines(transferLines.filter(l => l.id !== line.id))}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>Notes / Motif du transfert</label>
              <textarea
                value={transferNotes}
                onChange={e => setTransferNotes(e.target.value)}
                placeholder="Ex: Réapprovisionnement de début de rentrée scolaire..."
                rows={2}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
              <Button variant="outline" type="button" onClick={() => setShowNewTransfer(false)}>Annuler</Button>
              <Button type="button" onClick={handleCreateTransfer}>Expédier le Transfert</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
