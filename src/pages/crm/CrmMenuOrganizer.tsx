import React, { useState, useMemo, useEffect } from 'react';
import { 
  ArrowUpDown, GripVertical, ArrowUp, ArrowDown, RotateCcw, Save, Check, 
  Sparkles, Layers, Shield, Eye, Info
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAppContext } from '../../context/AppContext';
import { CRM_MODULE_ACCESS, isCrmModuleAvailable } from '../../config/crmModuleAccess';
import { getSavedCrmMenuOrder, saveCrmMenuOrder, resetCrmMenuOrder } from '../../utils/crmMenuOrder';
import toast from 'react-hot-toast';

export interface CrmMenuItemMeta {
  path: string;
  label: string;
  color: string;
  bg: string;
  description: string;
  permissionKey?: keyof typeof CRM_MODULE_ACCESS;
  roles: readonly string[];
}

export const ALL_CRM_MENU_ITEMS: CrmMenuItemMeta[] = [
  { path: '/', label: 'Dashboard Général', color: '#2563EB', bg: '#EFF6FF', description: 'Tableau de bord de synthèse et indicateurs clés', roles: ['Directeur', 'Responsable', 'Directeur adjoint', 'SuperAdmin'] },
  { path: '/commercial', label: 'Dashboard Commercial', color: '#2563EB', bg: '#EFF6FF', description: 'Espace commercial dédié et objectifs', roles: ['Commercial'] },
  { path: '/responsable', label: 'Dashboard Responsable', color: '#7C3AED', bg: '#FAF5FF', description: 'Pilotage de pôle / service', roles: ['SuperAdmin', 'Responsable'] },
  { path: '/crm/prestations', label: 'Commandes & Prestations', color: '#10B981', bg: '#ECFDF5', description: 'Grille financière, devis, marges et encaissement', permissionKey: 'crmPrestationsEnabled', roles: CRM_MODULE_ACCESS.crmPrestationsEnabled },
  { path: '/crm/caisse', label: 'Caisse & Dépenses', color: '#EF4444', bg: '#FEF2F2', description: 'Journal de trésorerie, entrées/sorties et soldes', permissionKey: 'crmCaisseEnabled', roles: CRM_MODULE_ACCESS.crmCaisseEnabled },
  { path: '/crm/maintenance', label: 'Maintenance & Tickets', color: '#F59E0B', bg: '#FFFBEB', description: 'Interventions, tickets et suivi des pannes', permissionKey: 'crmMaintenanceEnabled', roles: CRM_MODULE_ACCESS.crmMaintenanceEnabled },
  { path: '/crm/stocks', label: 'Stocks Métier', color: '#6366F1', bg: '#EEF2FF', description: 'Valorisation stocks, consommables et alertes rupture', permissionKey: 'crmStocksEnabled', roles: CRM_MODULE_ACCESS.crmStocksEnabled },
  { path: '/crm/tiers', label: 'Tiers & Apporteurs', color: '#8B5CF6', bg: '#F5F3FF', description: 'Annuaire partenaires, clients et apporteurs d\'affaires', permissionKey: 'crmTiersEnabled', roles: CRM_MODULE_ACCESS.crmTiersEnabled },
  { path: '/crm/commerciaux', label: 'Agents Commerciaux', color: '#0D9488', bg: '#F0FDFA', description: 'Fiches négociateurs, volume de vente et suivi contrats', permissionKey: 'crmCommerciauxEnabled', roles: CRM_MODULE_ACCESS.crmCommerciauxEnabled },
  { path: '/crm/commissions', label: 'Gestion des Commissions', color: '#D97706', bg: '#FFFBEB', description: 'Calcul, liquidation et décaissement des primes', permissionKey: 'crmCommissionsEnabled', roles: CRM_MODULE_ACCESS.crmCommissionsEnabled },
  { path: '/devis', label: 'Devis & Proformas', color: '#D97706', bg: '#FFFBEB', description: 'Création, relance et impression des devis clients', roles: ['Directeur', 'Responsable', 'Commercial', 'Directeur adjoint', 'SuperAdmin'] },
  { path: '/bon-livraison', label: 'Bons de Livraison', color: '#F59E0B', bg: '#FFFBEB', description: 'Émission et suivi des bons de livraison', roles: ['Directeur', 'Responsable', 'Commercial', 'Directeur adjoint', 'SuperAdmin'] },
  { path: '/factures', label: 'Suivi des factures clients', color: '#0284C7', bg: '#F0F9FF', description: 'Registre mensuel des factures et rentabilité', permissionKey: 'crmFacturationEnabled', roles: CRM_MODULE_ACCESS.crmFacturationEnabled },
  { path: '/fournisseurs-factures', label: 'Factures Fournisseurs', color: '#EA580C', bg: '#FFF7ED', description: 'Dépenses fournisseurs, échéances et justificatifs', permissionKey: 'crmSupFacturesEnabled', roles: CRM_MODULE_ACCESS.crmSupFacturesEnabled },
  { path: '/crm/rapports', label: 'Rapports Hebdo (Collaborateurs)', color: '#059669', bg: '#ECFDF5', description: 'Saisie quotidienne et soumission hebdomadaire', permissionKey: 'crmReportsEnabled', roles: CRM_MODULE_ACCESS.crmReportsEnabled },
  { path: '/crm/rapports-equipe', label: 'Rapport Supervision Équipe', color: '#7C3AED', bg: '#FAF5FF', description: 'Cockpit de supervision d\'équipe et KPIs', permissionKey: 'crmTeamReportsEnabled', roles: CRM_MODULE_ACCESS.crmTeamReportsEnabled },
  { path: '/crm/sync-errors', label: 'Erreurs de Synchronisation', color: '#DC2626', bg: '#FEF2F2', description: 'Diagnostics et relance des actions hors-ligne', roles: ['Directeur', 'Responsable', 'Commercial', 'Directeur adjoint', 'SuperAdmin', 'Gerant', 'Caissier', 'Encaisseur'] },
  { path: '/clients', label: 'Clients & Annuaire', color: '#8B5CF6', bg: '#F5F3FF', description: 'Base clients et fiches coordonnées', roles: ['Directeur', 'Responsable', 'Commercial', 'Directeur adjoint', 'SuperAdmin'] },
  { path: '/services', label: 'Pôles & Services', color: '#4F46E5', bg: '#EEF2FF', description: 'Structure organisationnelle de l\'entreprise', roles: ['Directeur', 'Directeur adjoint', 'SuperAdmin'] },
  { path: '/prestations', label: 'Catalogue Prestations', color: '#6366F1', bg: '#EEF2FF', description: 'Tarifs et fiches de services', roles: ['Directeur', 'Directeur adjoint', 'SuperAdmin'] },
  { path: '/documents', label: 'Documents & GED', color: '#0284C7', bg: '#F0F9FF', description: 'Gestion documentaire et pièces jointes', roles: ['Directeur', 'Responsable', 'Commercial', 'Directeur adjoint', 'SuperAdmin'] },
  { path: '/crm/modules', label: 'Activation des Modules', color: '#3B82F6', bg: '#EFF6FF', description: 'Matrice des autorisations de modules par collaborateur', roles: ['Directeur', 'Directeur adjoint', 'SuperAdmin'] },
  { path: '/crm/menu-order', label: 'Organisation du Menu', color: '#0891B2', bg: '#ECFEFF', description: 'Personnalisation de l\'ordre des onglets par glissement', permissionKey: 'crmMenuOrderEnabled', roles: CRM_MODULE_ACCESS.crmMenuOrderEnabled },
  { path: '/export', label: 'Exports Excel', color: '#059669', bg: '#ECFDF5', description: 'Extraction de données au format tableur', roles: ['Directeur', 'Responsable', 'Directeur adjoint', 'SuperAdmin'] },
  { path: '/utilisateurs', label: 'Gestion Utilisateurs', color: '#475569', bg: '#F8FAFC', description: 'Comptes, accès et réinitialisation de code PIN', roles: ['Directeur', 'SuperAdmin'] },
  { path: '/parametres', label: 'Paramètres Généraux', color: '#64748B', bg: '#F1F5F9', description: 'Configuration de l\'entreprise, thème et logo', roles: ['Directeur'] }
];

export function CrmMenuOrganizer() {
  const { currentUser: authUser } = useAuth();
  const { users } = useAppContext();
  const currentUser = users.find(u => u.id === authUser?.id) || authUser;

  const userRole = currentUser?.role || '';
  const isDirection = ['Directeur', 'Directeur adjoint', 'SuperAdmin'].includes(userRole);
  const isCommercial = userRole === 'Commercial';

  // Vérifier si le module est autorisé pour cet utilisateur
  const isModuleAllowed = isDirection
    ? currentUser?.crmMenuOrderEnabled !== false
    : currentUser?.crmMenuOrderEnabled === true;

  // Filtrer les items auxquels l'utilisateur a réellement accès
  const accessibleItems = useMemo(() => {
    if (!currentUser) return [];
    return ALL_CRM_MENU_ITEMS.filter(item => {
      // Filtrage rôle
      const hasRole = item.roles.some(r => r.toLowerCase() === userRole.toLowerCase());
      if (!hasRole) return false;

      // Règles Commerciales spécifiques
      if (isCommercial) {
        if (item.path === '/') return false;
        if (item.permissionKey && currentUser[item.permissionKey] === false) return false;
        return true;
      }

      // Permissions CRM granulaires
      if (item.permissionKey) {
        if (currentUser[item.permissionKey] === false) return false;
        if (item.permissionKey === 'crmTeamReportsEnabled' && !currentUser.crmTeamReportsEnabled && !isDirection) return false;
        if (item.permissionKey === 'crmMenuOrderEnabled' && !currentUser.crmMenuOrderEnabled && !isDirection) return false;
      }

      return true;
    });
  }, [currentUser, userRole, isCommercial, isDirection]);

  // Liste ordonnée d'items
  const [items, setItems] = useState<CrmMenuItemMeta[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);

  // Initialisation à partir du localStorage
  useEffect(() => {
    if (!currentUser?.id || accessibleItems.length === 0) return;
    const savedPaths = getSavedCrmMenuOrder(currentUser.id);
    if (!savedPaths || savedPaths.length === 0) {
      setItems(accessibleItems);
      setHasUnsavedChanges(false);
      return;
    }

    const orderMap = new Map<string, number>();
    savedPaths.forEach((path, idx) => orderMap.set(path, idx));

    const sorted = [...accessibleItems].sort((a, b) => {
      const idxA = orderMap.has(a.path) ? orderMap.get(a.path)! : 999;
      const idxB = orderMap.has(b.path) ? orderMap.get(b.path)! : 999;
      return idxA - idxB;
    });

    setItems(sorted);
    setHasUnsavedChanges(false);
  }, [currentUser?.id, accessibleItems]);

  // Déplacement via glisser-déposer
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const updated = [...items];
    const [movedItem] = updated.splice(draggedIndex, 1);
    updated.splice(targetIndex, 0, movedItem);

    setItems(updated);
    setDraggedIndex(null);
    setDragOverIndex(null);
    setHasUnsavedChanges(true);

    // Sauvegarde automatique et application immédiate
    if (currentUser?.id) {
      saveCrmMenuOrder(currentUser.id, updated.map(i => i.path));
      toast.success(`Onglet "${movedItem.label}" replacé en position #${targetIndex + 1}`, { duration: 1500 });
    }
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Déplacement par boutons ▲ / ▼
  const moveItem = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;

    const updated = [...items];
    const [movedItem] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, movedItem);

    setItems(updated);
    setHasUnsavedChanges(true);

    if (currentUser?.id) {
      saveCrmMenuOrder(currentUser.id, updated.map(i => i.path));
      toast.success(`Position mise à jour : #${targetIndex + 1}`, { duration: 1200 });
    }
  };

  // Réinitialiser aux valeurs par défaut
  const handleReset = () => {
    if (!currentUser?.id) return;
    resetCrmMenuOrder(currentUser.id);
    setItems(accessibleItems);
    setHasUnsavedChanges(false);
    toast.success('Ordre par défaut du menu restauré avec succès.');
  };

  if (!isModuleAllowed) {
    return (
      <div className="dashboard" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <Shield size={48} color="#DC2626" style={{ margin: '0 auto 16px' }} />
        <h2>Module non activé</h2>
        <p style={{ color: 'var(--color-text-muted)', maxWidth: '520px', margin: '8px auto 0' }}>
          La personnalisation de l'organisation du menu latéral n'est pas activée pour votre compte. Veuillez contacter la Direction.
        </p>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* Entête */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(8, 145, 178, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0891B2' }}>
            <ArrowUpDown size={24} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>Organisation du Menu Latéral CRM</h2>
            <p style={{ margin: '4px 0 0', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
              Glissez et déposez les onglets pour organiser votre menu selon vos priorités quotidiennes.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button 
            type="button" 
            className="btn btn-secondary" 
            onClick={handleReset}
            title="Rétablir l'ordre d'origine fourni par le système"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RotateCcw size={16} /> Rétablir l'ordre par défaut
          </button>
        </div>
      </div>

      {/* Guide visuel */}
      <div style={{
        padding: '14px 18px',
        borderRadius: '8px',
        background: 'rgba(8, 145, 178, 0.08)',
        border: '1px solid rgba(8, 145, 178, 0.25)',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        fontSize: '0.9rem',
        color: '#0E7490'
      }}>
        <Sparkles size={20} style={{ flexShrink: 0 }} />
        <span>
          <strong>Personnalisation en direct :</strong> Glissez les cartes vers le haut ou vers le bas avec la souris ou utilisez les boutons fléchés <strong>▲ / ▼</strong>. Les modifications sont appliquées <strong>instantanément</strong> dans votre menu de gauche.
        </span>
      </div>

      {/* Liste des cartes d'onglets réorganisables */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {items.map((item, index) => {
          const isDragging = draggedIndex === index;
          const isOver = dragOverIndex === index;

          return (
            <div
              key={item.path}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 18px',
                background: isDragging ? 'rgba(8, 145, 178, 0.06)' : 'var(--color-card)',
                border: isOver 
                  ? '2px dashed #0891B2' 
                  : isDragging 
                    ? '1px dashed #94A3B8' 
                    : '1px solid var(--color-border)',
                borderRadius: '10px',
                cursor: 'grab',
                opacity: isDragging ? 0.4 : 1,
                transform: isOver ? 'scale(1.01)' : 'scale(1)',
                transition: 'all 0.15s ease',
                boxShadow: isOver ? '0 4px 12px rgba(8, 145, 178, 0.15)' : 'none'
              }}
            >
              {/* Gauche : Poignée de glissement + Position + Détails */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
                {/* Poignée Grip */}
                <div 
                  style={{ 
                    color: '#94A3B8', 
                    cursor: 'grab', 
                    display: 'flex', 
                    alignItems: 'center',
                    padding: '4px'
                  }}
                  title="Glisser pour réordonner"
                >
                  <GripVertical size={20} />
                </div>

                {/* Badge position */}
                <div style={{
                  minWidth: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: index < 3 ? 'rgba(8, 145, 178, 0.15)' : 'var(--color-surface-alt)',
                  color: index < 3 ? '#0891B2' : 'var(--color-text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '0.85rem'
                }}>
                  #{index + 1}
                </div>

                {/* Pastille couleur & Libellé */}
                <div style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  background: item.color,
                  flexShrink: 0
                }} />

                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.98rem', color: 'var(--color-text)' }}>
                    {item.label}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                    {item.description}
                  </div>
                </div>
              </div>

              {/* Droite : Boutons de déplacement unitaire */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                <button
                  type="button"
                  className="icon-button"
                  disabled={index === 0}
                  onClick={(e) => { e.stopPropagation(); moveItem(index, 'up'); }}
                  title="Monter d'une position"
                  style={{
                    opacity: index === 0 ? 0.3 : 1,
                    cursor: index === 0 ? 'not-allowed' : 'pointer',
                    padding: '6px',
                    borderRadius: '6px',
                    border: '1px solid var(--color-border)'
                  }}
                >
                  <ArrowUp size={16} />
                </button>

                <button
                  type="button"
                  className="icon-button"
                  disabled={index === items.length - 1}
                  onClick={(e) => { e.stopPropagation(); moveItem(index, 'down'); }}
                  title="Descendre d'une position"
                  style={{
                    opacity: index === items.length - 1 ? 0.3 : 1,
                    cursor: index === items.length - 1 ? 'not-allowed' : 'pointer',
                    padding: '6px',
                    borderRadius: '6px',
                    border: '1px solid var(--color-border)'
                  }}
                >
                  <ArrowDown size={16} />
                </button>
              </div>
            </div>
          );
        })}

        {items.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--color-text-muted)' }}>
            Aucun onglet CRM disponible pour votre profil.
          </div>
        )}
      </div>
    </div>
  );
}
export default CrmMenuOrganizer;
