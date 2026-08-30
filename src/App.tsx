import { HashRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { buildAppConfig, getPlatformLabel } from '@/shared';
import { Toaster } from 'react-hot-toast';
import { Layout } from './components/Layout';
import { DashboardDirecteur } from './pages/DashboardDirecteur';
import { DashboardResponsable } from './pages/DashboardResponsable';
import { DashboardCommercial } from './pages/DashboardCommercial';
import { QuoteCreation } from './pages/QuoteCreation';

import { Clients } from './pages/Clients';
import { Affaires } from './pages/Affaires';
import { AffaireDetail } from './pages/AffaireDetail';
import { Services } from './pages/Services';
import { Prestations } from './pages/Prestations';
import { Devis } from './pages/Devis';
import { Sales } from './pages/Sales';
import { Couts } from './pages/Couts';
import { Commissions } from './pages/Commissions';
import { Performance } from './pages/Performance';
import { Prospects } from './pages/Prospects';
import { ProspectDetail } from './pages/ProspectDetail';
import { CommercialClients } from './pages/CommercialClients';
import { CommercialCommissions } from './pages/CommercialCommissions';
import { Documents } from './pages/Documents';
import { ReportsHistory } from './features/reports/presentation/pages/ReportsHistory';
import { WeeklyReportEditor } from './features/reports/presentation/pages/WeeklyReportEditor';
import { TeamReportsView } from './features/reports/presentation/pages/TeamReportsView';
import { Utilisateurs } from './pages/Utilisateurs';
import { Rapports } from './pages/Rapports';
import { Parametres } from './pages/Parametres';
import { GeminiSettings } from './pages/GeminiSettings';
import { Login } from './pages/Login';
import { PublicCatalog } from './pages/public/PublicCatalog';
import TestDashboard from './pages/TestDashboard';

// AI Weekly Reports (Deleted)

// POS Pages (lazy loaded)
import { lazy, Suspense } from 'react';
import type { ReactNode } from 'react';
const DashboardPos = lazy(() => import('./pages/pos/DashboardPos'));
const PosSettings = lazy(() => import('./pages/pos/PosSettings'));
const PosUsers = lazy(() => import('./pages/pos/PosUsers'));
const PosDiscounts = lazy(() => import('./pages/pos/PosDiscounts'));
const PosReports = lazy(() => import('./pages/pos/PosReports'));
const PosFinance = lazy(() => import('./pages/pos/PosFinance'));
const PosReturns = lazy(() => import('./pages/pos/PosReturns'));
const PosProducts = lazy(() => import('./pages/pos/PosProducts'));
const PosStockMovements = lazy(() => import('./pages/pos/PosStockMovements'));
const CashierModulesManager = lazy(() => import('./pages/pos/CashierModulesManager'));
const PosSyncErrors = lazy(() => import('./pages/pos/PosSyncErrors'));
const PosCategories = lazy(() => import('./pages/pos/PosCategories'));
const PosBrands = lazy(() => import('./pages/pos/PosBrands'));
const PosSuppliers = lazy(() => import('./pages/pos/PosSuppliers'));
const PosStock = lazy(() => import('./pages/pos/PosStock'));
const PosSupply = lazy(() => import('./pages/pos/PosSupply'));
const PosInventory = lazy(() => import('./pages/pos/PosInventory'));
const PosTerminal = lazy(() => import('./pages/pos/PosTerminal'));
const PosTransactions = lazy(() => import('./pages/pos/PosTransactions'));
const PosCash = lazy(() => import('./pages/pos/PosCash'));

// Diagnostic pages (lazy loaded)
const DiagnosticPage = lazy(() => import('./components/DiagnosticPage'));
const PrinterDiagnosticPage = lazy(() => import('./components/PrinterDiagnosticPage'));
const ScannerDiagnosticPage = lazy(() => import('./components/ScannerDiagnosticPage'));
const PosDiagnosticPage = lazy(() => import('./components/PosDiagnosticPage'));
const PerformanceDiagnosticPage = lazy(() => import('./components/PerformanceDiagnosticPage'));
const BackupDiagnosticPage = lazy(() => import('./components/BackupDiagnosticPage'));
const FileDiagnosticPage = lazy(() => import('./components/FileDiagnosticPage'));
const SyncDiagnosticPage = lazy(() => import('./components/SyncDiagnosticPage'));
const SupportDiagnosticPage = lazy(() => import('./components/SupportDiagnosticPage'));
const SecurityDiagnosticPage = lazy(() => import('./components/SecurityDiagnosticPage'));
const UpdaterDiagnosticPage = lazy(() => import('./components/UpdaterDiagnosticPage'));
const HardwareDiagnosticPage = lazy(() => import('./components/HardwareDiagnosticPage'));

import { AppProvider } from './context/AppContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ConfirmProvider } from './components/ConfirmModal';
import { ProductImagesProvider } from './features/products/images/ProductImagesContext';

const queryClient = new QueryClient();
const webAppConfig = buildAppConfig('web');

function ProtectedRoute() {
  const { currentUser, loading } = useAuth();
  
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100vh', justifyContent: 'center', alignItems: 'center', backgroundColor: 'var(--color-background)', color: 'var(--color-primary)' }}>
        <h2>{webAppConfig.appName}</h2>
        <small>{getPlatformLabel(webAppConfig.target)}</small>
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

// Composant pour rediriger automatiquement vers le bon dashboard selon le rôle
function RoleBasedDashboard() {
  const { currentUser, loading } = useAuth();
  
  if (loading) return null;

  if (!currentUser) return <Navigate to="/login" replace />;
  
  if (currentUser.role === 'SuperAdmin') return <Navigate to="/utilisateurs" replace />;
  if (currentUser.role === 'Directeur') return <DashboardDirecteur />;
  if (currentUser.role === 'Responsable') return <DashboardResponsable />;
  if (currentUser.role === 'Commercial') return <Navigate to="/commercial" replace />;
  if (currentUser.role === 'Gerant') return <Navigate to="/pos" replace />;
  if (currentUser.role === 'Caissier') return <Navigate to="/pos/terminal" replace />;
  
  return <DashboardDirecteur />;
}

// Garde de route par rôle
type Role = 'SuperAdmin' | 'Directeur' | 'Responsable' | 'Commercial' | 'Gerant' | 'Caissier';
function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { currentUser } = useAuth();
  if (!currentUser) return <Navigate to="/login" replace />;
  
  const hasRole = roles.includes(currentUser.role as Role);
  const hasPosRole = currentUser.posRole ? roles.includes(currentUser.posRole as Role) : false;
  
  if (!hasRole && !hasPosRole) return <Navigate to="/pos" replace />;
  return <>{children}</>;
}

function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <ProductImagesProvider>
        <ConfirmProvider>
          <QueryClientProvider client={queryClient}>
            <HashRouter>
              <Toaster position="top-center" />
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/catalogue" element={<PublicCatalog />} />
                <Route path="/catalog" element={<Navigate to="/catalogue" replace />} />
                <Route path="/boutique" element={<Navigate to="/catalogue" replace />} />
                <Route path="/test" element={<TestDashboard />} />

                <Route path="/diagnostics" element={<Suspense fallback={<div style={{ padding: 20 }}>Chargement...</div>}><DiagnosticPage /></Suspense>} />
                <Route path="/diagnostics/printer" element={<Suspense fallback={<div style={{ padding: 20 }}>Chargement...</div>}><PrinterDiagnosticPage /></Suspense>} />
                <Route path="/diagnostics/scanner" element={<Suspense fallback={<div style={{ padding: 20 }}>Chargement...</div>}><ScannerDiagnosticPage /></Suspense>} />
                <Route path="/diagnostics/pos" element={<Suspense fallback={<div style={{ padding: 20 }}>Chargement...</div>}><PosDiagnosticPage /></Suspense>} />
                <Route path="/diagnostics/performance" element={<Suspense fallback={<div style={{ padding: 20 }}>Chargement...</div>}><PerformanceDiagnosticPage /></Suspense>} />
                <Route path="/diagnostics/backup" element={<Suspense fallback={<div style={{ padding: 20 }}>Chargement...</div>}><BackupDiagnosticPage /></Suspense>} />
                <Route path="/diagnostics/files" element={<Suspense fallback={<div style={{ padding: 20 }}>Chargement...</div>}><FileDiagnosticPage /></Suspense>} />
                <Route path="/diagnostics/sync" element={<Suspense fallback={<div style={{ padding: 20 }}>Chargement...</div>}><SyncDiagnosticPage /></Suspense>} />
                <Route path="/diagnostics/support" element={<Suspense fallback={<div style={{ padding: 20 }}>Chargement...</div>}><SupportDiagnosticPage /></Suspense>} />
                <Route path="/diagnostics/security" element={<Suspense fallback={<div style={{ padding: 20 }}>Chargement...</div>}><SecurityDiagnosticPage /></Suspense>} />
                <Route path="/diagnostics/updater" element={<Suspense fallback={<div style={{ padding: 20 }}>Chargement...</div>}><UpdaterDiagnosticPage /></Suspense>} />
                <Route path="/diagnostics/hardware" element={<Suspense fallback={<div style={{ padding: 20 }}>Chargement...</div>}><HardwareDiagnosticPage /></Suspense>} />

                <Route element={<ProtectedRoute />}>
                  <Route path="/" element={<Layout />}>
                    <Route index element={<RoleBasedDashboard />} />
                    
                    <Route path="clients" element={<Clients />} />
                    <Route path="affaires" element={<Affaires />} />
                    <Route path="affaires/:id" element={<AffaireDetail />} />
                    <Route path="services" element={<Services />} />
                    <Route path="prestations" element={<Prestations />} />
                    <Route path="devis" element={<Devis />} />
                    <Route path="devis/nouveau" element={<QuoteCreation />} />
                    <Route path="ventes" element={<Sales />} />
                    <Route path="couts" element={<Couts />} />
                    <Route path="commissions" element={<Commissions />} />
                    <Route path="performance" element={<Performance />} />
                    <Route path="mes-commissions" element={<CommercialCommissions />} />
                    <Route path="mon-rapport-hebdo" element={<WeeklyReportEditor />} />
                    <Route path="rapports-equipe" element={<TeamReportsView />} />
                    <Route path="documents" element={<Documents />} />
                    <Route path="utilisateurs" element={<Utilisateurs />} />
                    <Route path="rapports" element={<RequireRole roles={['Directeur']}><Rapports /></RequireRole>} />
                    
                    {/* New AI Weekly Reports Module */}
                    <Route path="mes-rapports" element={<ReportsHistory />} />
                    <Route path="parametres-ia" element={<GeminiSettings />} />
                    <Route path="parametres" element={<Parametres />} />

                    {/* Commercial routes */}
                    <Route path="commercial" element={<DashboardCommercial />} />
                    <Route path="commercial/prospects" element={<Prospects />} />
                    <Route path="commercial/prospects/:id" element={<ProspectDetail />} />
                    <Route path="commercial/clients" element={<CommercialClients />} />
                    <Route path="commercial/commissions" element={<CommercialCommissions />} />
                    
                    <Route path="commercial/documents" element={<Documents />} />
                    <Route path="commercial/mes-rapports" element={<ReportsHistory />} />
                    <Route path="commercial/parametres-ia" element={<GeminiSettings />} />

                    {/* POS routes */}
                    <Route path="pos" element={<Suspense fallback={<div style={{ padding: 20 }}>Chargement...</div>}><DashboardPos /></Suspense>} />
                    <Route path="pos/settings" element={<Suspense fallback={<div style={{ padding: 20 }}>Chargement...</div>}><PosSettings /></Suspense>} />
                    <Route path="pos/users" element={<Suspense fallback={<div style={{ padding: 20 }}>Chargement...</div>}><PosUsers /></Suspense>} />
                    <Route path="pos/cashier-modules" element={<Suspense fallback={<div style={{ padding: 20 }}>Chargement...</div>}><RequireRole roles={['Directeur', 'Gerant']}><CashierModulesManager /></RequireRole></Suspense>} />
          <Route path="pos/sync-errors" element={<Suspense fallback={<div style={{ padding: 20 }}>Chargement...</div>}><RequireRole roles={['Directeur', 'Gerant']}><PosSyncErrors /></RequireRole></Suspense>} />
                    <Route path="pos/discounts" element={<Suspense fallback={<div style={{ padding: 20 }}>Chargement...</div>}><PosDiscounts /></Suspense>} />
                    <Route path="pos/reports" element={<Suspense fallback={<div style={{ padding: 20 }}>Chargement...</div>}><PosReports /></Suspense>} />
                    <Route path="pos/finance" element={<Suspense fallback={<div style={{ padding: 20 }}>Chargement...</div>}><PosFinance /></Suspense>} />
                    <Route path="pos/returns" element={<Suspense fallback={<div style={{ padding: 20 }}>Chargement...</div>}><RequireRole roles={['Directeur', 'Gerant', 'Caissier']}><PosReturns /></RequireRole></Suspense>} />
                    <Route path="pos/products" element={<Suspense fallback={<div style={{ padding: 20 }}>Chargement...</div>}><PosProducts /></Suspense>} />
                    <Route path="pos/stock-movements" element={<Suspense fallback={<div style={{ padding: 20 }}>Chargement...</div>}><PosStockMovements /></Suspense>} />
                    <Route path="pos/categories" element={<Suspense fallback={<div style={{ padding: 20 }}>Chargement...</div>}><PosCategories /></Suspense>} />
                    <Route path="pos/brands" element={<Suspense fallback={<div style={{ padding: 20 }}>Chargement...</div>}><PosBrands /></Suspense>} />
                    <Route path="pos/suppliers" element={<Suspense fallback={<div style={{ padding: 20 }}>Chargement...</div>}><PosSuppliers /></Suspense>} />
                    <Route path="pos/stock" element={<Suspense fallback={<div style={{ padding: 20 }}>Chargement...</div>}><PosStock /></Suspense>} />
                    <Route path="pos/supply" element={<Suspense fallback={<div style={{ padding: 20 }}>Chargement...</div>}><PosSupply /></Suspense>} />
                    <Route path="pos/inventory" element={<Suspense fallback={<div style={{ padding: 20 }}>Chargement...</div>}><PosInventory /></Suspense>} />
                    <Route path="pos/terminal" element={<Suspense fallback={<div style={{ padding: 20 }}>Chargement...</div>}><PosTerminal /></Suspense>} />
                    <Route path="pos/transactions" element={<Suspense fallback={<div style={{ padding: 20 }}>Chargement...</div>}><PosTransactions /></Suspense>} />
                    <Route path="pos/cash" element={<Suspense fallback={<div style={{ padding: 20 }}>Chargement...</div>}><PosCash /></Suspense>} />
                    
                    <Route path="*" element={<div style={{ padding: '20px' }}><h1>Page introuvable</h1></div>} />
                  </Route>
                </Route>
              </Routes>
            </HashRouter>
          </QueryClientProvider>
        </ConfirmProvider>
        </ProductImagesProvider>
      </AppProvider>
    </AuthProvider>
  );
}

export default App;
