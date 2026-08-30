import React, { useState } from 'react';
import { 
  Home, Users, Briefcase, FileText, Folder, Shield, PieChart, Settings, 
  UserCircle, LogOut, Receipt, Coins, Target, ShoppingCart, Package, Truck, 
  ClipboardList, Warehouse, Tag, BarChart3, DollarSign, RotateCcw, 
  FileSpreadsheet, Wallet, ToggleRight, Trophy, Sparkles, Bot 
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAppContext } from '../context/AppContext';
import { InstallButton } from './InstallButton';
import './Sidebar.css';

interface NavItemConfig {
  label: string;
  icon: React.ElementType;
  path: string;
  color: string;
  bg: string;
  roles: Array<'Directeur' | 'Responsable' | 'Commercial' | 'Directeur adjoint' | 'SuperAdmin' | 'Gerant' | 'Caissier'>;
}

export function Sidebar({ mobileOpen, setMobileOpen }: { mobileOpen?: boolean; setMobileOpen?: (val: boolean) => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();
  const { posWorkspace } = useAppContext();
  const [clickedPath, setClickedPath] = useState<string | null>(null);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleItemClick = (path: string) => {
    setClickedPath(path);
    setTimeout(() => {
      setClickedPath(null);
    }, 500);

    if (setMobileOpen) {
      setMobileOpen(false);
    }
  };

  // CRM nav items avec couleurs distinctives
  const crmNavItems: NavItemConfig[] = [
    { label: 'Dashboard', icon: Home, path: '/', color: '#2563EB', bg: '#EFF6FF', roles: ['Directeur', 'Responsable'] },
    { label: 'Clients', icon: Users, path: '/clients', color: '#8B5CF6', bg: '#F5F3FF', roles: ['Directeur', 'Responsable'] },
    { label: 'Affaires', icon: Briefcase, path: '/affaires', color: '#0D9488', bg: '#F0FDFA', roles: ['Directeur', 'Responsable', 'Directeur adjoint', 'SuperAdmin'] },
    { label: 'Services', icon: Briefcase, path: '/services', color: '#4F46E5', bg: '#EEF2FF', roles: ['Directeur'] },
    { label: 'Prestations', icon: FileText, path: '/prestations', color: '#6366F1', bg: '#EEF2FF', roles: ['Directeur'] },
    { label: 'Devis', icon: FileText, path: '/devis', color: '#D97706', bg: '#FFFBEB', roles: ['Directeur', 'Responsable'] },
    { label: 'Ventes', icon: Receipt, path: '/ventes', color: '#10B981', bg: '#ECFDF5', roles: ['Directeur', 'Responsable'] },
    { label: 'Coûts & Dépenses', icon: DollarSign, path: '/couts', color: '#F43F5E', bg: '#FFF1F2', roles: ['Directeur', 'Responsable', 'Directeur adjoint', 'SuperAdmin'] },
    { label: 'Commissions', icon: Coins, path: '/commissions', color: '#EAB308', bg: '#FEFCE8', roles: ['Directeur', 'Responsable'] },
    { label: 'Performance & Primes', icon: Trophy, path: '/performance', color: '#F97316', bg: '#FFF7ED', roles: ['Directeur', 'Responsable', 'Directeur adjoint', 'Commercial', 'SuperAdmin'] },
    { label: 'Mes Commissions', icon: Coins, path: '/mes-commissions', color: '#EAB308', bg: '#FEFCE8', roles: ['Responsable'] },
    { label: 'Mon Rapport Hebdo (IA)', icon: Sparkles, path: '/mon-rapport-hebdo', color: '#A855F7', bg: '#FAF5FF', roles: ['Commercial', 'Responsable', 'Directeur', 'Directeur adjoint', 'SuperAdmin'] },
    { label: 'Rapports d\'Équipe', icon: ClipboardList, path: '/rapports-equipe', color: '#06B6D4', bg: '#ECFEFF', roles: ['Directeur', 'Directeur adjoint', 'Responsable', 'SuperAdmin'] },
    { label: 'Documents (GED)', icon: Folder, path: '/documents', color: '#0284C7', bg: '#F0F9FF', roles: ['Directeur', 'Responsable'] },
    { label: 'Utilisateurs', icon: Shield, path: '/utilisateurs', color: '#475569', bg: '#F8FAFC', roles: ['Directeur', 'SuperAdmin'] },
    { label: 'Rapports', icon: PieChart, path: '/rapports', color: '#3B82F6', bg: '#EFF6FF', roles: ['Directeur'] },
    { label: 'Paramètres Gemini IA', icon: Bot, path: '/parametres-ia', color: '#D946EF', bg: '#FDF4FF', roles: ['Directeur', 'Responsable', 'Directeur adjoint', 'SuperAdmin', 'Commercial'] },
    { label: 'Paramètres', icon: Settings, path: '/parametres', color: '#64748B', bg: '#F1F5F9', roles: ['Directeur'] },
    // Commercial routes
    { label: 'Dashboard', icon: Home, path: '/commercial', color: '#2563EB', bg: '#EFF6FF', roles: ['Commercial', 'SuperAdmin'] },
    { label: 'Prospects', icon: Target, path: '/commercial/prospects', color: '#EC4899', bg: '#FDF2F8', roles: ['Commercial', 'SuperAdmin'] },
    { label: 'Mes Affaires', icon: Briefcase, path: '/affaires', color: '#0D9488', bg: '#F0FDFA', roles: ['Commercial', 'SuperAdmin'] },
    { label: 'Clients Apportés', icon: Users, path: '/commercial/clients', color: '#8B5CF6', bg: '#F5F3FF', roles: ['Commercial', 'SuperAdmin'] },
    { label: 'Mes Commissions', icon: Coins, path: '/commercial/commissions', color: '#EAB308', bg: '#FEFCE8', roles: ['Commercial', 'SuperAdmin'] },
    { label: 'Mon Rapport Hebdo (IA)', icon: Sparkles, path: '/mon-rapport-hebdo', color: '#A855F7', bg: '#FAF5FF', roles: ['Commercial', 'SuperAdmin'] },
    { label: 'Paramètres Gemini IA', icon: Bot, path: '/parametres-ia', color: '#D946EF', bg: '#FDF4FF', roles: ['Commercial', 'SuperAdmin'] },
    { label: 'Documents (GED)', icon: Folder, path: '/commercial/documents', color: '#0284C7', bg: '#F0F9FF', roles: ['Commercial', 'SuperAdmin'] },
  ];

  // POS nav items avec couleurs distinctives
  const posNavItems: NavItemConfig[] = [
    { label: 'Dashboard', icon: Home, path: '/pos', color: '#2563EB', bg: '#EFF6FF', roles: ['Directeur', 'Gerant'] },
    { label: 'Finance', icon: DollarSign, path: '/pos/finance', color: '#10B981', bg: '#ECFDF5', roles: ['Directeur', 'Gerant'] },
    { label: 'Caisse', icon: ShoppingCart, path: '/pos/terminal', color: '#0D9488', bg: '#F0FDFA', roles: ['Caissier'] },
    { label: 'Catalogue', icon: Package, path: '/pos/products', color: '#8B5CF6', bg: '#F5F3FF', roles: ['Directeur', 'Gerant', 'Caissier'] },
    { label: 'Mouvements Stock', icon: Package, path: '/pos/stock-movements', color: '#6366F1', bg: '#EEF2FF', roles: ['Directeur', 'Gerant', 'Caissier'] },
    { label: 'Retours', icon: RotateCcw, path: '/pos/returns', color: '#F43F5E', bg: '#FFF1F2', roles: ['Directeur', 'Gerant', 'Caissier'] },
    { label: 'Gestion de caisse', icon: Wallet, path: '/pos/cash', color: '#059669', bg: '#ECFDF5', roles: ['Caissier'] },
    { label: 'Historique', icon: Receipt, path: '/pos/transactions', color: '#0284C7', bg: '#F0F9FF', roles: ['Directeur', 'Caissier'] },
    // Administration Directeur
    { label: 'Paramètres', icon: Settings, path: '/pos/settings', color: '#64748B', bg: '#F1F5F9', roles: ['Directeur'] },
    { label: 'Utilisateurs', icon: Shield, path: '/pos/users', color: '#475569', bg: '#F8FAFC', roles: ['Directeur', 'Gerant'] },
    { label: 'Modules Caissier', icon: ToggleRight, path: '/pos/cashier-modules', color: '#3B82F6', bg: '#EFF6FF', roles: ['Directeur', 'Gerant'] },
    { label: 'Erreurs Sync', icon: Shield, path: '/pos/sync-errors', color: '#DC2626', bg: '#FEF2F2', roles: ['Directeur', 'Gerant'] },
    { label: 'Remises', icon: Tag, path: '/pos/discounts', color: '#D97706', bg: '#FFFBEB', roles: ['Directeur'] },
    { label: 'Rapports', icon: BarChart3, path: '/pos/reports', color: '#06B6D4', bg: '#ECFEFF', roles: ['Directeur'] },
    // Gestion catalogue Gérant
    { label: 'Produits à compléter', icon: FileSpreadsheet, path: '/pos/products?tab=complete', color: '#F59E0B', bg: '#FFFBEB', roles: ['Gerant'] },
    { label: 'Fournisseurs', icon: Truck, path: '/pos/suppliers', color: '#7C3AED', bg: '#F5F3FF', roles: ['Directeur', 'Gerant'] },
    { label: 'Stock', icon: Warehouse, path: '/pos/stock', color: '#4F46E5', bg: '#EEF2FF', roles: ['Directeur', 'Gerant', 'Caissier'] },
    { label: 'Approvisionnement', icon: Truck, path: '/pos/supply', color: '#EA580C', bg: '#FFF7ED', roles: ['Directeur', 'Gerant', 'Caissier'] },
    { label: 'Inventaire', icon: ClipboardList, path: '/pos/inventory', color: '#0D9488', bg: '#F0FDFA', roles: ['Directeur', 'Gerant', 'Caissier'] },
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
          <UserCircle size={44} />
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
            const isClicked = clickedPath === item.path;

            return (
              <li key={item.path} className={`nav-item ${isActive ? 'active' : ''}`}>
                <Link 
                  to={item.path} 
                  className={`nav-link ${isClicked ? 'clicked' : ''}`}
                  onClick={() => handleItemClick(item.path)}
                >
                  <span 
                    className="nav-icon-badge" 
                    style={{ 
                      backgroundColor: item.bg, 
                      color: item.color,
                      boxShadow: isActive ? `0 4px 12px ${item.color}35` : undefined
                    }}
                  >
                    <item.icon size={18} />
                  </span>
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
            backgroundColor: 'var(--color-primary, #0D9488)',
            border: 'none',
            borderRadius: '8px',
            color: 'white',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: 'pointer',
            transition: 'opacity 0.2s, transform 0.1s'
          }}
          onMouseOver={e => e.currentTarget.style.opacity = '0.92'}
          onMouseOut={e => e.currentTarget.style.opacity = '1'}
          onMouseDown={e => e.currentTarget.style.transform = 'scale(0.98)'}
          onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          <LogOut size={16} /> Déconnexion
        </button>
      </div>
    </aside>
  );
}
