import React, { Suspense } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import { CartProvider } from './context/CartContext';
import { CashProvider } from './context/CashContext';
import { ConfigProvider } from './context/ConfigContext';
import { WebSocketProvider } from './context/WebSocketContext';
import { NotificationProvider } from './context/NotificationContext';
import { CloudConfigProvider } from './context/CloudConfigContext';
import { AutoSyncProvider } from './context/AutoSyncContext';
import { Toaster } from 'react-hot-toast';
import AppWithCloudConfig from './components/setup/AppWithCloudConfig';
import { Capacitor } from '@capacitor/core';
import AndroidBackButton from './components/common/AndroidBackButton';

// Eager imports — critical path only
import OnboardingWizard from './components/onboarding/OnboardingWizard';
import { useOnboarding } from './hooks/useOnboarding';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

// Lazy-loaded pages (all non-critical-path pages)
import PublicCatalog from './pages/Catalog/PublicCatalog';
const ForgotPassword = React.lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = React.lazy(() => import('./pages/ResetPassword'));
const Unauthorized = React.lazy(() => import('./pages/Unauthorized'));
// NEW: Mobile Welcome Screen
const MobileWelcome = React.lazy(() => import('./pages/MobileWelcome'));

const DashboardLayout = React.lazy(() => import('./layouts/DashboardLayout'));
const Products = React.lazy(() => import('./pages/Products'));
const Categories = React.lazy(() => import('./pages/Categories'));
const Inventory = React.lazy(() => import('./pages/Inventory'));
const POS = React.lazy(() => import('./pages/POS'));
const CashClose = React.lazy(() => import('./pages/CashClose'));
const Settings = React.lazy(() => import('./pages/Settings'));
const Purchases = React.lazy(() => import('./pages/Purchases'));
const CreatePurchase  = React.lazy(() => import('./pages/Purchases/CreatePurchase'));
const ImportHistory   = React.lazy(() => import('./pages/Purchases/ImportHistory'));
const PurchaseDetail = React.lazy(() => import('./pages/Purchases/PurchaseDetail'));
// Supplier Ledger
const SupplierLedger = React.lazy(() => import('./pages/Suppliers/SupplierLedger'));

const Suppliers = React.lazy(() => import('./pages/Suppliers'));
const ReturnsManager = React.lazy(() => import('./pages/Returns/ReturnsManager'));
const WarrantyManager = React.lazy(() => import('./pages/Returns/WarrantyManager'));
const CustomerManager = React.lazy(() => import('./pages/Customers/CustomerManager'));
const QuotesManager = React.lazy(() => import('./pages/Quotes/QuotesManager'));
const WarehouseManager = React.lazy(() => import('./pages/Warehouses/WarehouseManager'));
const InventoryTransfers = React.lazy(() => import('./pages/Warehouses/InventoryTransfers'));
const ExternalTransferOut = React.lazy(() => import('./pages/Inventory/Transfers/ExternalTransferOut'));
const ExternalTransferIn = React.lazy(() => import('./pages/Inventory/Transfers/ExternalTransferIn'));
const SerializedReception = React.lazy(() => import('./pages/Inventory/SerializedReception'));
const WarrantyPolicies = React.lazy(() => import('./pages/WarrantyPolicies')); // NEW: Warranty Policies

const UsersManager = React.lazy(() => import('./pages/Users/UsersManager'));
const CashRegistersPage = React.lazy(() => import('./pages/CashRegisters/CashRegistersPage'));
const AuditLogs = React.lazy(() => import('./pages/AuditLogs'));
const Help = React.lazy(() => import('./pages/Help'));
const TableMap = React.lazy(() => import('./pages/Restaurant/TableMap'));
const KitchenDisplay = React.lazy(() => import('./pages/Restaurant/KitchenDisplay'));
const MenuManager = React.lazy(() => import('./pages/Restaurant/MenuManager'));
const RecipeEditor = React.lazy(() => import('./pages/Restaurant/RecipeEditor'));
const MobileWaiterLayout = React.lazy(() => import('./layouts/MobileWaiterLayout'));
const WaiterLogin = React.lazy(() => import('./pages/Mobile/WaiterLogin'));
const MobileTableGrid = React.lazy(() => import('./pages/Mobile/MobileTableGrid'));
const MobileOrderTaker = React.lazy(() => import('./pages/Mobile/MobileOrderTaker'));
const ServicesUnified = React.lazy(() => import('./pages/Services/ServicesUnified')); // LEGACY
const ServiceManager = React.lazy(() => import('./pages/Services/ServiceManager')); // LEGACY
const ServicesDashboard = React.lazy(() => import('./pages/Services/ServicesDashboard')); // NEW v2
const ReportsCenter = React.lazy(() => import('./pages/Reports/ReportsCenter')); // NEW: Unified Reports Center
const InventoryCenter = React.lazy(() => import('./pages/Inventory/InventoryCenter')); // NEW: Unified Inventory Center
const SalesCenter = React.lazy(() => import('./pages/Sales/SalesCenter')); // NEW: Unified Sales Center
const ConfigCenter = React.lazy(() => import('./pages/Config/ConfigCenter'));

// Barbershop Module
const BarbershopDashboard = React.lazy(() => import('./pages/Barbershop/BarbershopDashboard'));
const EmployeeManager = React.lazy(() => import('./pages/Barbershop/EmployeeManager'));
const CommissionsReport = React.lazy(() => import('./pages/Barbershop/CommissionsReport'));

// Pharmacy Module
const PharmacyDashboard = React.lazy(() => import('./pages/Pharmacy/PharmacyDashboard'));
const LotsManager = React.lazy(() => import('./pages/Pharmacy/LotsManager'));
const ControlLog = React.lazy(() => import('./pages/Pharmacy/ControlLog'));
const PrescriptionsHistory = React.lazy(() => import('./pages/Pharmacy/PrescriptionsHistory'));

// Laundry Module
const LaundryDashboard = React.lazy(() => import('./pages/Laundry/LaundryDashboard'));
const LaundryForm = React.lazy(() => import('./pages/Laundry/LaundryForm'));
const LaundryTicket = React.lazy(() => import('./pages/Laundry/components/LaundryTicket'));
const SupportTickets = React.lazy(() => import('./pages/SupportTickets'));
const MiSuscripcion = React.lazy(() => import('./pages/MiSuscripcion'));
const FuncionesPage = React.lazy(() => import('./pages/Settings/FuncionesPage'));
// Multi-empresa — Sprint 3
const ConsolidatedDashboard = React.lazy(() => import('./pages/Org/ConsolidatedDashboard'));
// Multi-empresa — Sprint 4
const SharedCatalog = React.lazy(() => import('./pages/Org/SharedCatalog'));
// Multi-empresa — Sprint 5
const InterCompanyTransfers = React.lazy(() => import('./pages/Org/InterCompanyTransfers'));
// Multi-empresa — Sprint 6
const OrgConfig = React.lazy(() => import('./pages/Org/OrgConfig'));

// Suspense fallback spinner
const SuspenseFallback = (
  <div className="flex items-center justify-center h-screen">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
  </div>
);

class LazyErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, componentStack: '' };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('[LazyErrorBoundary]', error?.message, info?.componentStack);
    this.setState({ componentStack: info?.componentStack || '' });
  }
  render() {
    if (this.state.hasError) {
      const msg   = this.state.error?.message || '';
      // componentStack muestra la jerarquía: el primer componente es el que crashea
      const compStack = (this.state.componentStack || '')
        .split('\n')
        .filter(l => l.trim() && !l.includes('at '))
        .slice(0, 6)
        .join(' > ');
      const lines = (this.state.componentStack || '')
        .split('\n').slice(1, 5).join(' | ');
      return (
        <div className="flex flex-col items-center justify-center h-screen gap-4 px-4">
          <p className="text-gray-600 font-bold">Error al cargar la página</p>
          {msg && <p className="text-xs text-red-600 max-w-lg text-center font-mono bg-red-50 p-2 rounded border border-red-200">{msg}</p>}
          {lines && <p className="text-xs text-blue-600 max-w-lg text-center font-mono bg-blue-50 p-2 rounded border border-blue-200 break-all">Componente: {lines}</p>}
          <button
            onClick={() => { this.setState({ hasError: false, error: null, componentStack: '' }); window.location.reload(); }}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Reintentar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Onboarding Gate ─────────────────────────────────────────
// Muestra el wizard de configuración inicial si el tenant no lo completó
function OnboardingGate({ children }) {
  const { completed, loading, refresh } = useOnboarding();
  const [dismissed, setDismissed] = React.useState(false);

  if (loading) return children;
  if (!completed && !dismissed) {
    return (
      <>
        {children}
        <OnboardingWizard
          onClose={() => { setDismissed(true); refresh(); }}
        />
      </>
    );
  }
  return children;
}


function App() {

  // 🛡️ STARTUP LOADER (Chicken & Egg Fix)
  // We MUST wait for checking the API URL before rendering ANY provider
  // otherwise CloudConfigProvider or AuthProvider will try to connect and fail.
  const [isReady, setIsReady] = React.useState(false);

  React.useEffect(() => {
    const initApp = async () => {

      // ── Procesar org_data de URL (switch entre dominios de org) ──────────────
      // Cuando el CompanySwitcher redirige a otro subdominio, pasa las empresas
      // de la organización en ?org_data=BASE64 para que el switcher siga visible
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const orgData = urlParams.get('org_data');
        if (orgData) {
          const orgs = JSON.parse(decodeURIComponent(atob(orgData)));
          if (Array.isArray(orgs) && orgs.length > 0) {
            localStorage.setItem('org_companies', JSON.stringify(orgs));
          }
          // Limpiar el parámetro de la URL sin recargar
          const cleanUrl = window.location.pathname + window.location.hash;
          window.history.replaceState({}, document.title, cleanUrl);
        }
      } catch (_) {}

      if (Capacitor.isNativePlatform()) {
        const apiUrl = localStorage.getItem('api_url');
        const currentHash = window.location.hash;

        // Debug
        // console.log('📱 Startup Check:', { apiUrl, currentHash });

        // SANITIZATION: Check for bad API URLs (e.g. user pasted /login)
        if (apiUrl && (apiUrl.includes('/login') || apiUrl.includes('/dashboard'))) {
          console.warn('📱 Mobile: Bad API URL detected. Cleaning up...');
          localStorage.removeItem('api_url');
          localStorage.removeItem('selected_tenant');
          window.location.replace('/#/mobile-welcome');
          setIsReady(true);
          return;
        }

        if (!apiUrl && !currentHash.includes('mobile-welcome')) {
          console.warn('📱 Mobile: No API URL found. Redirecting to setup...');
          // Force redirect
          window.location.replace('/#/mobile-welcome');

          // FIX: We MUST set isReady=true to allow the Router to render the new route
          // Otherwise we stay stuck in the "Loading..." screen
          setIsReady(true);
        } else {
          // Valid config or already at welcome screen
          setIsReady(true);
        }
      } else {
        // Web always ready
        setIsReady(true);
      }
    };

    initApp();
  }, []);

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-t-transparent border-indigo-600 rounded-full animate-spin"></div>
          <p className="font-medium animate-pulse text-slate-500">Iniciando...</p>
        </div>
      </div>
    );
  }

  // ── Catálogo público — sin providers de autenticación ──
  const hash = typeof window !== 'undefined' ? window.location.hash : '';
  if (hash === '#/catalogo' || hash.startsWith('#/catalogo?') || hash.startsWith('#/catalogo/')) {
    return <PublicCatalog />;
  }

  return (
    <CloudConfigProvider>
      <AuthProvider>
        <Toaster
          position="top-left"
          toastOptions={{
            style: {
              zIndex: 99999,
              fontSize: '14px',
              fontWeight: '600',
              borderRadius: '12px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            },
            success: { duration: 3000 },
            error:   { duration: 4000 },
          }}
          containerStyle={{ zIndex: 99999, top: 16, left: 16 }}
        />
        <AppWithCloudConfig>
          <AutoSyncProvider>
            <WebSocketProvider>
              <NotificationProvider>
                <ConfigProvider>
                  <CashProvider>
                    <CartProvider>
                      <Router>
                        <AndroidBackButton />
                        <LazyErrorBoundary>
                        <Suspense fallback={SuspenseFallback}>
                        <Routes>
                          <Route path="/login" element={<Login />} />
                          <Route path="/forgot-password" element={<ForgotPassword />} />
                          <Route path="/reset-password" element={<ResetPassword />} />

                          {/* Mobile Welcome (Tenant Setup — Capacitor) */}
                          <Route path="/mobile-welcome" element={<MobileWelcome />} />

                          {/* Mobile Waiter Routes */}
                          <Route path="/mobile/login" element={<WaiterLogin />} />

                          <Route path="/mobile" element={
                            <ProtectedRoute>
                              <MobileWaiterLayout />
                            </ProtectedRoute>
                          }>
                            <Route index element={<Navigate to="tables" replace />} />
                            <Route path="tables" element={<MobileTableGrid />} />
                            <Route path="order/:tableId" element={<MobileOrderTaker />} />
                          </Route>

                          <Route path="/unauthorized" element={<Unauthorized />} />

                          {/* Legacy Reports Routes — redirect to unified ReportsCenter */}
                          <Route path="/reports/detailed" element={<Navigate to="/reports" replace />} />
                          <Route path="/reports/unified" element={<Navigate to="/reports" replace />} />

                          {/* Standalone POS Routes (No Dashboard Layout) */}
                          <Route element={<ProtectedRoute roles={['ADMIN', 'CASHIER']} />}>
                            <Route path="/pos" element={<POS />} />
                            <Route path="/cash-close" element={<CashClose />} />
                          </Route>

                          {/* Dashboard Layout Routes */}
                          <Route element={<ProtectedRoute />}>
                            <Route element={<DashboardLayout />}>
                              <Route path="/" element={<OnboardingGate><Dashboard /></OnboardingGate>} />
                              {/* Multi-empresa: dashboard consolidado del grupo */}
                              <Route path="/org/dashboard" element={<ConsolidatedDashboard />} />
                              {/* Multi-empresa: catálogo compartido del grupo */}
                              <Route path="/org/catalog" element={<SharedCatalog />} />
                              {/* Multi-empresa: transferencias de stock entre empresas */}
                              <Route path="/org/transfers" element={<InterCompanyTransfers />} />
                              {/* Multi-empresa: configuración del grupo */}
                              <Route path="/org/config" element={<OrgConfig />} />

                              {/* Unified Inventory Center */}
                              <Route path="/inventory-center" element={
                                <ProtectedRoute roles={['ADMIN', 'WAREHOUSE']}>
                                  <InventoryCenter />
                                </ProtectedRoute>
                              } />

                              {/* Backward-compatible redirects to Inventory Center */}
                              <Route path="/products" element={<Navigate to="/inventory-center?tab=productos" replace />} />
                              <Route path="/categories" element={<Navigate to="/inventory-center?tab=categorias" replace />} />
                              <Route path="/inventory" element={<Navigate to="/inventory-center?tab=kardex" replace />} />
                              <Route path="/warehouses" element={<Navigate to="/inventory-center?tab=almacenes" replace />} />
                              <Route path="/transfers" element={<Navigate to="/inventory-center?tab=traslados" replace />} />
                              <Route path="/transfers/external/out" element={<Navigate to="/inventory-center?tab=traslados" replace />} />
                              <Route path="/transfers/external/in" element={<Navigate to="/inventory-center?tab=traslados" replace />} />
                              <Route path="/inventory/serialized-reception" element={<Navigate to="/inventory-center?tab=seriales" replace />} />

                              {/* Old Inventory Routes (kept for reference)
                              <Route path="/products" element={
                                <ProtectedRoute roles={['ADMIN', 'WAREHOUSE']}>
                                  <Products />
                                </ProtectedRoute>
                              } />
                              <Route path="/categories" element={
                                <ProtectedRoute roles={['ADMIN', 'WAREHOUSE']}>
                                  <Categories />
                                </ProtectedRoute>
                              } />
                              <Route path="/inventory" element={
                                <ProtectedRoute roles={['ADMIN', 'WAREHOUSE']}>
                                  <Inventory />
                                </ProtectedRoute>
                              } />
                              <Route path="/warehouses" element={
                                <ProtectedRoute roles={['ADMIN', 'WAREHOUSE']}>
                                  <WarehouseManager />
                                </ProtectedRoute>
                              } />
                              <Route path="/inventory/serialized-reception" element={
                                <ProtectedRoute roles={['ADMIN', 'WAREHOUSE']}>
                                  <SerializedReception />
                                </ProtectedRoute>
                              } />
                              <Route path="/transfers" element={
                                <ProtectedRoute roles={['ADMIN', 'WAREHOUSE']}>
                                  <InventoryTransfers />
                                </ProtectedRoute>
                              } />
                              <Route path="/transfers/external/out" element={
                                <ProtectedRoute roles={['ADMIN', 'WAREHOUSE']}>
                                  <ExternalTransferOut />
                                </ProtectedRoute>
                              } />
                              <Route path="/transfers/external/in" element={
                                <ProtectedRoute roles={['ADMIN', 'WAREHOUSE']}>
                                  <ExternalTransferIn />
                                </ProtectedRoute>
                              } />
                              */}

                              {/* Unified Sales Center */}
                              <Route path="/sales-center" element={
                                <ProtectedRoute roles={['ADMIN', 'CASHIER', 'WAREHOUSE']}>
                                  <SalesCenter />
                                </ProtectedRoute>
                              } />

                              {/* Backward-compatible redirects to Sales Center */}
                              {/* /quotes → QuotesManager (editor completo) */}
                              <Route path="/customers" element={<Navigate to="/sales-center?tab=clientes" replace />} />
                              <Route path="/accounts-receivable" element={<Navigate to="/sales-center?tab=creditos" replace />} />

                              {/* Sales - ADMIN or CASHIER */}
                              <Route path="/sales-history" element={<Navigate to="/reports" replace />} />
                              <Route path="/cash-history" element={<Navigate to="/reports" replace />} />
                              <Route path="/cash-registers" element={
                                <ProtectedRoute roles={['ADMIN']}>
                                  <CashRegistersPage />
                                </ProtectedRoute>
                              } />
                              <Route path="/credit/aging" element={<Navigate to="/reports" replace />} />
                              <Route path="/credit/ledger/:clientId" element={<Navigate to="/reports" replace />} />

                              <Route path="/quotes" element={
                                <ProtectedRoute roles={['ADMIN', 'CASHIER']}>
                                  <QuotesManager />
                                </ProtectedRoute>
                              } />

                              {/* Purchases - ADMIN or WAREHOUSE */}
                              <Route path="/purchases" element={
                                <ProtectedRoute roles={['ADMIN', 'WAREHOUSE']}>
                                  <Purchases />
                                </ProtectedRoute>
                              } />
                              <Route path="/purchases/new" element={
                                <ProtectedRoute roles={['ADMIN', 'WAREHOUSE']}>
                                  <CreatePurchase />
                                </ProtectedRoute>
                              } />
                              <Route path="/purchases/:id" element={
                                <ProtectedRoute roles={['ADMIN', 'WAREHOUSE']}>
                                  <PurchaseDetail />
                                </ProtectedRoute>
                              } />
                              <Route path="/suppliers" element={
                                <ProtectedRoute roles={['ADMIN', 'WAREHOUSE']}>
                                  <Suppliers />
                                </ProtectedRoute>
                              } />
                              <Route path="/accounts-payable" element={<Navigate to="/reports" replace />} />
                              <Route path="/suppliers/:supplierId/ledger" element={
                                <ProtectedRoute roles={['ADMIN', 'WAREHOUSE']}>
                                  <SupplierLedger />
                                </ProtectedRoute>
                              } />
                              {/* Backward-compatible redirects to Sales Center (returns/warranty) */}
                              <Route path="/returns" element={<Navigate to="/sales-center?tab=devoluciones" replace />} />
                              <Route path="/rma/warranty" element={<Navigate to="/sales-center?tab=garantias" replace />} />

                              {/* Old Returns/Warranty Routes (kept for reference)
                              <Route path="/returns" element={
                                <ProtectedRoute roles={['ADMIN']}>
                                  <ReturnsManager />
                                </ProtectedRoute>
                              } />
                              <Route path="/rma/warranty" element={
                                <ProtectedRoute roles={['ADMIN']}>
                                  <WarrantyManager />
                                </ProtectedRoute>
                              } />
                              */}

                              {/* Admin Only */}
                              <Route path="/settings" element={<Navigate to="/config-center" replace />} />
                              <Route path="/config-center" element={
                                <ProtectedRoute roles={['ADMIN']}>
                                  <ConfigCenter />
                                </ProtectedRoute>
                              } />

                              {/* Redirects for old settings routes */}
                              <Route path="/settings" element={<Navigate to="/config-center" replace />} />
                              <Route path="/users" element={<Navigate to="/config-center?tab=usuarios" replace />} />
                              <Route path="/audit-logs" element={<Navigate to="/config-center?tab=auditoria" replace />} />
                              <Route path="/warranty-policies" element={<WarrantyPolicies />} />
                              <Route path="/hr/commissions" element={<Navigate to="/reports" replace />} />

                              {/* Unified Reports Center */}
                              <Route path="/reports" element={
                                <ProtectedRoute roles={['ADMIN']}>
                                  <ReportsCenter />
                                </ProtectedRoute>
                              } />

                              {/* Barbershop Module */}
                              <Route path="/barbershop/employees" element={
                                <ProtectedRoute roles={['ADMIN', 'MANAGER']}>
                                  <EmployeeManager />
                                </ProtectedRoute>
                              } />
                              <Route path="/barbershop/commissions" element={
                                <ProtectedRoute roles={['ADMIN', 'MANAGER']}>
                                  <CommissionsReport />
                                </ProtectedRoute>
                              } />

                              {/* Restaurant Module - Phase 1 */}
                              <Route path="/restaurant/tables" element={
                                <ProtectedRoute roles={['ADMIN', 'CASHIER', 'WAITER']}>
                                  <TableMap />
                                </ProtectedRoute>
                              } />
                              <Route path="/restaurant/kitchen" element={
                                <ProtectedRoute roles={['ADMIN', 'KITCHEN']}>
                                  <KitchenDisplay />
                                </ProtectedRoute>
                              } />

                              {/* Restaurant Management */}
                              <Route path="/restaurant/menu" element={
                                <ProtectedRoute roles={['ADMIN']}>
                                  <MenuManager />
                                </ProtectedRoute>
                              } />
                              <Route path="/restaurant/recipes" element={
                                <ProtectedRoute roles={['ADMIN']}>
                                  <RecipeEditor />
                                </ProtectedRoute>
                              } />

                              <Route path="/help" element={<Help />} />
                              <Route path="/support" element={<SupportTickets />} />
                              <Route path="/mi-suscripcion" element={<MiSuscripcion />} />
                              <Route path="/funciones" element={
                                <ProtectedRoute roles={['ADMIN']}>
                                  <FuncionesPage />
                                </ProtectedRoute>
                              } />

                              {/* Service Module Routes — ADMIN + CASHIER */}
                              <Route path="/services" element={
                                <ProtectedRoute roles={['ADMIN', 'CASHIER']}>
                                  <ServicesDashboard />
                                </ProtectedRoute>
                              } />
                              {/* LEGACY routes — kept for direct-link compatibility */}
                              <Route path="/services/orders/:id" element={
                                <ProtectedRoute roles={['ADMIN', 'CASHIER']}>
                                  <ServicesDashboard />
                                </ProtectedRoute>
                              } />

                              {/* Laundry Routes — ADMIN + CASHIER */}
                              <Route path="/laundry" element={
                                <ProtectedRoute roles={['ADMIN', 'CASHIER']}>
                                  <LaundryDashboard />
                                </ProtectedRoute>
                              } />
                              <Route path="/laundry/new" element={
                                <ProtectedRoute roles={['ADMIN', 'CASHIER']}>
                                  <LaundryForm />
                                </ProtectedRoute>
                              } />
                              <Route path="/laundry/ticket/:orderId" element={
                                <ProtectedRoute roles={['ADMIN', 'CASHIER']}>
                                  <LaundryTicket />
                                </ProtectedRoute>
                              } />

                              {/* Barbershop Routes — ADMIN + CASHIER */}
                              <Route path="/barbershop" element={
                                <ProtectedRoute roles={['ADMIN', 'CASHIER']}>
                                  <BarbershopDashboard />
                                </ProtectedRoute>
                              } />
                              <Route path="/barbershop/employees" element={
                                <ProtectedRoute roles={['ADMIN']}>
                                  <EmployeeManager />
                                </ProtectedRoute>
                              } />
                              <Route path="/barbershop/commissions" element={
                                <ProtectedRoute roles={['ADMIN']}>
                                  <CommissionsReport />
                                </ProtectedRoute>
                              } />

                              {/* Pharmacy Module Routes — ADMIN + CASHIER + WAREHOUSE */}
                              <Route path="/pharmacy" element={
                                <ProtectedRoute roles={['ADMIN', 'CASHIER', 'WAREHOUSE']}>
                                  <PharmacyDashboard />
                                </ProtectedRoute>
                              } />
                              <Route path="/pharmacy/lots" element={
                                <ProtectedRoute roles={['ADMIN', 'WAREHOUSE']}>
                                  <LotsManager />
                                </ProtectedRoute>
                              } />
                              <Route path="/pharmacy/control-log" element={
                                <ProtectedRoute roles={['ADMIN', 'WAREHOUSE']}>
                                  <ControlLog />
                                </ProtectedRoute>
                              } />
                              <Route path="/pharmacy/prescriptions" element={
                                <ProtectedRoute roles={['ADMIN', 'CASHIER', 'WAREHOUSE']}>
                                  <PrescriptionsHistory />
                                </ProtectedRoute>
                              } />
                            </Route>
                          </Route>

                          {/* Catch all - Redirect to Dashboard */}
                          <Route path="*" element={<Navigate to="/" replace />} />
                        </Routes>
                        </Suspense>
                        </LazyErrorBoundary>
                      </Router>
                    </CartProvider>
                  </CashProvider>
                </ConfigProvider>
              </NotificationProvider>
            </WebSocketProvider>
          </AutoSyncProvider>
        </AppWithCloudConfig>
      </AuthProvider>
    </CloudConfigProvider >
  );
}

export default App;
