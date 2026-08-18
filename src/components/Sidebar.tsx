import React from 'react';
import { Home, Users, Briefcase, FileText, Folder, Shield, PieChart, Settings, UserCircle, LogOut, Receipt, Coins, Target, ShoppingCart, Package, Truck, ClipboardList, Warehouse, Tag, BarChart3, DollarSign, RotateCcw, FileSpreadsheet, Wallet, ToggleRight, Calendar } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAppContext } from '../context/AppContext';
import { InstallButton } from './InstallButton';
import './Sidebar.css';

export function Sidebar({ mobileOpen, setMobileOpen }: { mobileOpen?: boolean; setMobileOpen?: (val: boolean) => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();
  const { posWorkspace } = useAppContext();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // CRM nav items
  const crmNavItems: { label: string; icon: React.ElementType; path: string; roles: Array<'Directeur' | 'Responsable' | 'Commercial'> }[] = [
    { label: 'Dashboard', icon: Home, path: '/', roles: ['Directeur', 'Responsable'] },
    { label: 'Clients', icon: Users, path: '/clients', roles: ['Directeur', 'Responsable'] },
    { label: 'Services', icon: Briefcase, path: '/services', roles: ['Directeur'] },
    { label: 'Prestations', icon: FileText, path: '/prestations', roles: ['Directeur'] },
    { label: 'Devis', icon: FileText, path: '/devis', roles: ['Directeur', 'Responsable'] },
    { label: 'Ventes', icon: Receipt, path: '/ventes', roles: ['Directeur', 'Responsable'] },
    { label: 'Commissions', icon: Coins, path: '/commissions', roles: ['Directeur', 'Responsable'] },
    { label: 'Mes Commissions', icon: Coins, path: '/mes-commissions', roles: ['Responsable'] },
    { label: 'Rapport d\'activité', icon: FileText, path: '/rapport-activite', roles: ['Responsable'] },
    { label: 'Rapport hebdo', icon: Calendar, path: '/rapport-hebdo', roles: ['Responsable'] },
    { label: 'Rapport de prospection', icon: FileText, path: '/rapport-prospection', roles: ['Responsable'] },
    { label: 'Documents', icon: Folder, path: '/documents', roles: ['Directeur', 'Responsable'] },
    { label: 'Historique Rapports', icon: FileText, path: '/mes-rapports', roles: ['Responsable', 'Directeur'] },
    { label: 'Utilisateurs', icon: Shield, path: '/utilisateurs', roles: ['Directeur', 'SuperAdmin'] as any },
    { label: 'Rapports', icon: PieChart, path: '/rapports', roles: ['Directeur'] },
    { label: 'Paramètres', icon: Settings, path: '/parametres', roles: ['Directeur'] },
    // Commercial routes
    { label: 'Dashboard', icon: Home, path: '/commercial', roles: ['Commercial', 'SuperAdmin'] as any },
    { label: 'Prospects', icon: Target, path: '/commercial/prospects', roles: ['Commercial', 'SuperAdmin'] as any },
    { label: 'Clients Apportés', icon: Users, path: '/commercial/clients', roles: ['Commercial', 'SuperAdmin'] as any },
    { label: 'Mes Commissions', icon: Coins, path: '/commercial/commissions', roles: ['Commercial', 'SuperAdmin'] as any },
    { label: 'Rapport d\'activité', icon: FileText, path: '/commercial/rapport-activite', roles: ['Commercial', 'SuperAdmin'] as any },
    { label: 'Rapport hebdo', icon: Calendar, path: '/commercial/rapport-hebdo', roles: ['Commercial', 'SuperAdmin'] as any },
    { label: 'Rapport de prospection', icon: FileText, path: '/commercial/rapport-prospection', roles: ['Commercial', 'SuperAdmin'] as any },
    { label: 'Documents', icon: Folder, path: '/commercial/documents', roles: ['Commercial', 'SuperAdmin'] as any },
    { label: 'Historique Rapports', icon: FileText, path: '/commercial/mes-rapports', roles: ['Commercial', 'SuperAdmin'] as any },
  ];

  // POS nav items
  const posNavItems: { label: string; icon: React.ElementType; path: string; roles: Array<'Directeur' | 'Gerant' | 'Caissier'> }[] = [
    // Opérations partagées
    { label: 'Dashboard', icon: Home, path: '/pos', roles: ['Directeur', 'Gerant'] },
    { label: 'Finance', icon: DollarSign, path: '/pos/finance', roles: ['Directeur', 'Gerant'] },
    { label: 'Caisse', icon: ShoppingCart, path: '/pos/terminal', roles: ['Caissier'] },
    { label: 'Catalogue', icon: Package, path: '/pos/products', roles: ['Directeur', 'Gerant', 'Caissier'] },
    { label: 'Mouvements Stock', icon: Package, path: '/pos/stock-movements', roles: ['Directeur', 'Gerant', 'Caissier'] },
    { label: 'Retours', icon: RotateCcw, path: '/pos/returns', roles: ['Directeur', 'Gerant', 'Caissier'] },
    { label: 'Gestion de caisse', icon: Wallet, path: '/pos/cash', roles: ['Caissier'] },
    { label: 'Historique', icon: Receipt, path: '/pos/transactions', roles: ['Directeur', 'Caissier'] },
    // Administration Directeur
    { label: 'Paramètres', icon: Settings, path: '/pos/settings', roles: ['Directeur'] },
    { label: 'Utilisateurs', icon: Shield, path: '/pos/users', roles: ['Directeur', 'Gerant'] },
    { label: 'Modules Caissier', icon: ToggleRight, path: '/pos/cashier-modules', roles: ['Directeur', 'Gerant'] },
    { label: 'Erreurs Sync', icon: Shield, path: '/pos/sync-errors', roles: ['Directeur', 'Gerant'] },
    { label: 'Remises', icon: Tag, path: '/pos/discounts', roles: ['Directeur'] },
    { label: 'Rapports', icon: BarChart3, path: '/pos/reports', roles: ['Directeur'] },
    // Gestion catalogue Gérant
    { label: 'Produits à compléter', icon: FileSpreadsheet, path: '/pos/products?tab=complete', roles: ['Gerant'] },
    { label: 'Fournisseurs', icon: Truck, path: '/pos/suppliers', roles: ['Directeur', 'Gerant'] },
    { label: 'Stock', icon: Warehouse, path: '/pos/stock', roles: ['Directeur', 'Gerant', 'Caissier'] },
    { label: 'Approvisionnement', icon: Truck, path: '/pos/supply', roles: ['Directeur', 'Gerant', 'Caissier'] },
    { label: 'Inventaire', icon: ClipboardList, path: '/pos/inventory', roles: ['Directeur', 'Gerant', 'Caissier'] },
  ];

  const isPos = posWorkspace.active;
  const navItems = isPos ? posNavItems : crmNavItems;

  // Filtrer les éléments selon le rôle de l'utilisateur connecté et ses permissions
  const visibleNavItems = navItems.filter(item => {
    if (!currentUser) return false;
    const effectiveRole = (isPos && currentUser.posRole) ? currentUser.posRole : currentUser.role;
    
    if (!item.roles.includes(effectiveRole as any)) return false;

    // Isoler la vue SuperAdmin entre Admin et Commercial
    if (currentUser.role === 'SuperAdmin') {
      const isCommercialSpace = location.pathname.startsWith('/commercial');
      const isCommercialRoute = item.path.startsWith('/commercial');
      if (isCommercialSpace && !isCommercialRoute) return false;
      if (!isCommercialSpace && isCommercialRoute) return false;
    }

    if (isPos && effectiveRole === 'Caissier') {
      if (item.label === 'Catalogue' && !currentUser.posCatalogueEnabled) return false;
      if (item.label === 'Retours' && !currentUser.posReturnsEnabled) return false;
      if (item.label === 'Approvisionnement' && !currentUser.posSupplyEnabled) return false;
      if (item.label === 'Inventaire' && !currentUser.posInventoryEnabled) return false;
      if ((item.label === 'Stock' || item.label === 'Mouvements Stock') && !currentUser.posStockEnabled) return false;
    }
    return true;
  });

  // Unique paths for POS (some items share the same path for different roles)
  const uniqueVisibleNavItems = visibleNavItems.filter((item, index, self) => 
    index === self.findIndex(i => i.path === item.path)
  );

  return (
    <aside className={`sidebar ${mobileOpen ? "mobile-open" : ""}`}>
      <div className="user-profile">
        <div className="avatar">
          <UserCircle size={48} />
        </div>
        <div className="user-info">
          <div className="user-name">{currentUser?.name || 'Utilisateur'}</div>
          <div className="user-role">{currentUser?.role || 'Aucun rôle'}</div>
        </div>
      </div>
      <nav className="nav-menu">
        <ul className="nav-list">
          {uniqueVisibleNavItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <li key={item.path} className={`nav-item ${isActive ? 'active' : ''}`}>
                <Link to={item.path} className="nav-link">
                  <item.icon className="nav-icon" size={20} />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div style={{ padding: '16px', marginTop: 'auto', borderTop: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <InstallButton />
        <button 
          onClick={handleLogout}
          style={{ 
            width: '100%', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            gap: '8px', 
            padding: '10px',
            backgroundColor: 'var(--color-primary)',
            border: 'none',
            borderRadius: '4px',
            color: 'white',
            cursor: 'pointer',
            transition: 'opacity 0.2s'
          }}
          onMouseOver={e => e.currentTarget.style.opacity = '0.9'}
          onMouseOut={e => e.currentTarget.style.opacity = '1'}
        >
          <LogOut size={16} /> Déconnexion
        </button>
      </div>
    </aside>
  );
}
