import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Unauthorized from './pages/Unauthorized';
// NEW: Mobile Welcome Screen
import MobileWelcome from './pages/MobileWelcome';
// Desktop screens (Tauri)
import LicenseActivation from './pages/LicenseActivation';
import DesktopFirstRun   from './pages/DesktopFirstRun';

// Detectar si la app corre dentro de Tauri (escritorio)
// window.__TAURI_INTERNALS__ es inyectado por Tauri en todos sus contextos
const IS_TAURI = typeof window !== 'undefined' && typeof window.__TAURI_INTERNALS__ !== 'undefined';

import DashboardLayout from './layouts/DashboardLayout';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Categories from './pages/Categories';
import Inventory from './pages/Inventory';
import POS from './pages/POS';
import CashClose from './pages/CashClose';
import Settings from './pages/Settings';
import Purchases from './pages/Purchases';
import CreatePurchase from './pages/Purchases/CreatePurchase';
import PurchaseDetail from './pages/Purchases/PurchaseDetail';
import AccountsPayable from './pages/Suppliers/AccountsPayable';
import DetailedReports from './pages/Reports/DetailedReports';

// Supplier Ledger
const SupplierLedger = React.lazy(() => import('./pages/Suppliers/SupplierLedger'));
import UnifiedReports from './pages/Reports/UnifiedReports';

// ... existing imports ...
import Suppliers from './pages/Suppliers';
import ReturnsManager from './pages/Returns/ReturnsManager';
import WarrantyManager from './pages/Returns/WarrantyManager';
import SalesHistory from './pages/SalesHistory';
import CustomerManager from './pages/Customers/CustomerManager';
import QuotesManager from './pages/Quotes/QuotesManager';
import WarehouseManager from './pages/Warehouses/WarehouseManager';
import InventoryTransfers from './pages/Warehouses/InventoryTransfers';
import ExternalTransferOut from './pages/Inventory/Transfers/ExternalTransferOut';

import ExternalTransferIn from './pages/Inventory/Transfers/ExternalTransferIn';
import SerializedReception from './pages/Inventory/SerializedReception';
import WarrantyPolicies from './pages/WarrantyPolicies'; // NEW: Warranty Policies

import AccountsReceivable from './pages/Credit/AccountsReceivable';
import AgingReport from './pages/Credit/AgingReport';
import ClientLedger from './pages/Credit/ClientLedger';
import UsersManager from './pages/Users/UsersManager';
import CashHistory from './pages/CashHistory';
import CashRegistersPage from './pages/CashRegisters/CashRegistersPage';
import AuditLogs from './pages/AuditLogs';
import Help from './pages/Help';
import TableMap from './pages/Restaurant/TableMap';
import KitchenDisplay from './pages/Restaurant/KitchenDisplay';
import MenuManager from './pages/Restaurant/MenuManager';
import RecipeEditor from './pages/Restaurant/RecipeEditor';
import { CartProvider } from './context/CartContext';
import { CashProvider } from './context/CashContext';
import { ConfigProvider } from './context/ConfigContext';
import { WebSocketProvider } from './context/WebSocketContext';
import { NotificationProvider } from './context/NotificationContext';
import { CloudConfigProvider } from './context/CloudConfigContext';
import { AutoSyncProvider } from './context/AutoSyncContext';

import MobileWaiterLayout from './layouts/MobileWaiterLayout';
import WaiterLogin from './pages/Mobile/WaiterLogin';
import MobileTableGrid from './pages/Mobile/MobileTableGrid';
import MobileOrderTaker from './pages/Mobile/MobileOrderTaker';
import Reception from './pages/Services/Reception'; // NEW: Service Reception
import ServicesDashboard from './pages/Services/ServicesDashboard'; // NEW: Dashboard
import ServiceManager from './pages/Services/ServiceManager'; // NEW: Service Manager
import ServiceList from './pages/Services/ServiceList'; // NEW: Service List
import CommissionPayout from './pages/HumanResources/CommissionPayout'; // NEW: Commission Payout

// Barbershop Module
import BarbershopDashboard from './pages/Barbershop/BarbershopDashboard';
import EmployeeManager from './pages/Barbershop/EmployeeManager';
import CommissionsReport from './pages/Barbershop/CommissionsReport';

// Laundry Module
import LaundryDashboard from './pages/Laundry/LaundryDashboard';
import LaundryForm from './pages/Laundry/LaundryForm';
import LaundryTicket from './pages/Laundry/components/LaundryTicket';
import SupportTickets from './pages/SupportTickets';

import { Toaster } from 'react-hot-toast';
import AppWithCloudConfig from './components/setup/AppWithCloudConfig';
import { Capacitor } from '@capacitor/core';
import AndroidBackButton from './components/common/AndroidBackButton';

function App() {

  // 🛡️ STARTUP LOADER (Chicken & Egg Fix)
  // We MUST wait for checking the API URL before rendering ANY provider
  // otherwise CloudConfigProvider or AuthProvider will try to connect and fail.
  const [isReady, setIsReady] = React.useState(false);
  const [loadingMsg, setLoadingMsg]   = React.useState('Iniciando...');
  const [loadingError, setLoadingError] = React.useState(null);
  // Tauri sin licencia: renderiza SOLO la pantalla de activación,
  // sin montar ningún provider (AuthContext, WebSocket, Config, etc.)
  const [tauriPreLicense, setTauriPreLicense] = React.useState(false);

  // ── Check periódico de licencia (solo Tauri) ────────────────────────────────
  // Verifica cada 5 minutos si la licencia sigue vigente.
  // Si vence mientras la app está abierta, redirige a /license-activation.
  React.useEffect(() => {
    if (!IS_TAURI || !isReady) return;

    const checkLicense = () => {
      const key = localStorage.getItem('desktop_license');
      const exp = localStorage.getItem('desktop_license_exp');
      const valid = key && exp && new Date(exp) > new Date();
      if (!valid) {
        console.warn('[Tauri] ⏰ Licencia vencida/eliminada → /license-activation');
        window.location.replace('/#/license-activation');
      }
    };

    const interval = setInterval(checkLicense, 5 * 60 * 1000); // cada 5 min
    return () => clearInterval(interval);
  }, [isReady]);

  React.useEffect(() => {
    const initApp = async () => {

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
      } else if (IS_TAURI) {
        // ── TAURI DESKTOP ─────────────────────────────────────────
        // El backend es local (127.0.0.1:8000, tenant fijo 'desktop_local').
        // Flujo:
        //   1. Sin licencia → /license-activation  (no requiere backend)
        //   2. Con licencia → ESPERAR al backend con reintentos (hasta 60s)
        //   3. Backend listo + first_run → /desktop-first-run
        //   4. Backend listo + usuarios  → /login  (normal)
        //
        // ⚠️ NO ponemos setIsReady(true) hasta que el backend esté OK.
        //    Así evitamos que los providers (CashContext, ConfigContext, etc.)
        //    hagan llamadas API que fallen y muestren "error del servidor".
        const licenseKey  = localStorage.getItem('desktop_license');
        const licenseExp  = localStorage.getItem('desktop_license_exp');
        const currentHash = window.location.hash;

        const licenseValid = licenseKey && licenseExp && new Date(licenseExp) > new Date();

        // 1. Sin licencia → pantalla de activación (no necesita backend)
        // ⚠️ Usamos tauriPreLicense=true en lugar de isReady=true para que
        //    NO se monten los providers (AuthContext, WebSocket, Config, etc.)
        //    que intentarían conectarse a 127.0.0.1:8000 (backend no listo).
        if (!licenseValid) {
          console.log('[Tauri] Sin licencia → /license-activation (modo pre-license)');
          setTauriPreLicense(true);
          return;
        }

        // 2. Con licencia válida: ESPERAR al backend con reintentos
        if (licenseValid) {
          setLoadingMsg('Conectando con el servidor local...');

          const TIMEOUT_MS = 60_000; // máx 60 segundos
          const POLL_MS    = 1_500;  // reintentar cada 1.5s
          const startTs    = Date.now();
          let   desktopInfo = null;

          while (Date.now() - startTs < TIMEOUT_MS) {
            try {
              const res = await fetch(
                'http://127.0.0.1:8000/api/v1/desktop/info',
                { signal: AbortSignal.timeout(2000) }
              );
              if (res.ok) {
                desktopInfo = await res.json();
                break;
              }
            } catch { /* backend no listo todavía, seguir reintentando */ }

            const elapsed = Math.round((Date.now() - startTs) / 1000);
            if (elapsed > 4) {
              setLoadingMsg(`Esperando servidor local... (${elapsed}s)`);
            }
            await new Promise(r => setTimeout(r, POLL_MS));
          }

          // Timeout: el backend nunca respondió
          if (!desktopInfo) {
            setLoadingError(
              'No se pudo conectar al servidor local después de 60 segundos.\n\n' +
              'Asegúrate de que el backend de Invensoft está corriendo:\n' +
              '  → Ejecuta "iniciar_backend.bat" y vuelve a intentarlo.'
            );
            setIsReady(true);
            return;
          }

          console.log('[Tauri] ✅ Backend listo:', desktopInfo);

          // Redirigir según estado
          if (desktopInfo.first_run && !currentHash.includes('desktop-first-run')) {
            console.log('[Tauri] Primer arranque → /desktop-first-run');
            window.location.replace('/#/desktop-first-run');
          } else if (currentHash.includes('license-activation')) {
            console.log('[Tauri] Licencia válida → /login');
            window.location.replace('/#/login');
          }

          setIsReady(true);
          return;
        }

        // (no debería llegar aquí — tauriPreLicense cubre el caso sin licencia)
        setTauriPreLicense(true);
      } else {
        // Web always ready
        setIsReady(true);
      }
    };

    initApp();
  }, []);

  // ── Tauri sin licencia: render mínimo SIN providers ─────────────────────────
  // Evita que AuthContext, WebSocket, Config, etc. intenten conectar al backend
  // local antes de que el usuario haya activado la licencia.
  if (tauriPreLicense) {
    return (
      <Router>
        <Toaster position="top-right" />
        <Routes>
          <Route path="/license-activation" element={<LicenseActivation />} />
          <Route path="*" element={<Navigate to="/license-activation" replace />} />
        </Routes>
      </Router>
    );
  }

  if (!isReady) {
    // ── Error: backend no respondió (solo Tauri) ──────────────────────────────
    if (loadingError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900 p-6">
          <div className="text-center max-w-sm">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-900/40 mb-4">
              <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Error de conexión</h2>
            <p className="text-gray-400 text-sm mb-6 whitespace-pre-line">{loadingError}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              Reintentar
            </button>
          </div>
        </div>
      );
    }

    // ── Loading spinner ───────────────────────────────────────────────────────
    return (
      <div className={`min-h-screen flex items-center justify-center ${IS_TAURI ? 'bg-gray-900' : 'bg-slate-100'}`}>
        <div className="flex flex-col items-center gap-4">
          <div className={`w-12 h-12 border-4 border-t-transparent rounded-full animate-spin ${IS_TAURI ? 'border-blue-500' : 'border-indigo-600'}`}></div>
          <p className={`font-medium animate-pulse ${IS_TAURI ? 'text-gray-300' : 'text-slate-500'}`}>{loadingMsg}</p>
        </div>
      </div>
    );
  }

  return (
    <CloudConfigProvider>
      <AuthProvider>
        <Toaster position="top-right" />
        <AppWithCloudConfig>
          <AutoSyncProvider>
            <WebSocketProvider>
              <NotificationProvider>
                <ConfigProvider>
                  <CashProvider>
                    <CartProvider>
                      <Router>
                        <AndroidBackButton />
                        <Routes>
                          <Route path="/login" element={<Login />} />
                          <Route path="/forgot-password" element={<ForgotPassword />} />
                          <Route path="/reset-password" element={<ResetPassword />} />

                          {/* Mobile Welcome (Tenant Setup — Capacitor) */}
                          <Route path="/mobile-welcome" element={<MobileWelcome />} />

                          {/* Desktop — Tauri */}
                          <Route path="/license-activation" element={<LicenseActivation />} />
                          <Route path="/desktop-first-run"  element={<DesktopFirstRun />} />

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

                          {/* Reports Routes */}
                          <Route path="/reports/detailed" element={
                            <ProtectedRoute allowedRoles={['ADMIN']}>
                              <DetailedReports />
                            </ProtectedRoute>
                          } />
                          <Route path="/reports/unified" element={
                            <ProtectedRoute allowedRoles={['ADMIN']}>
                              <UnifiedReports />
                            </ProtectedRoute>
                          } />

                          {/* Standalone POS Routes (No Dashboard Layout) */}
                          <Route element={<ProtectedRoute roles={['ADMIN', 'CASHIER']} />}>
                            <Route path="/pos" element={<POS />} />
                            <Route path="/cash-close" element={<CashClose />} />
                          </Route>

                          {/* Dashboard Layout Routes */}
                          <Route element={<ProtectedRoute />}>
                            <Route element={<DashboardLayout />}>
                              <Route path="/" element={<Dashboard />} />

                              {/* Inventory - ADMIN or WAREHOUSE */}
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
                              <Route path="/warranty-policies" element={
                                <ProtectedRoute roles={['ADMIN']}>
                                  <WarrantyPolicies />
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

                              {/* Sales - ADMIN or CASHIER */}
                              <Route path="/sales-history" element={
                                <ProtectedRoute roles={['ADMIN', 'CASHIER']}>
                                  <SalesHistory />
                                </ProtectedRoute>
                              } />
                              <Route path="/cash-history" element={
                                <ProtectedRoute roles={['ADMIN', 'CASHIER']}>
                                  <CashHistory />
                                </ProtectedRoute>
                              } />
                              <Route path="/cash-registers" element={
                                <ProtectedRoute roles={['ADMIN']}>
                                  <CashRegistersPage />
                                </ProtectedRoute>
                              } />
                              <Route path="/customers" element={
                                <ProtectedRoute roles={['ADMIN', 'CASHIER']}>
                                  <CustomerManager />
                                </ProtectedRoute>
                              } />
                              <Route path="/quotes" element={
                                <ProtectedRoute roles={['ADMIN', 'CASHIER']}>
                                  <QuotesManager />
                                </ProtectedRoute>
                              } />
                              <Route path="/accounts-receivable" element={
                                <ProtectedRoute roles={['ADMIN', 'CASHIER']}>
                                  <AccountsReceivable />
                                </ProtectedRoute>
                              } />
                              <Route path="/credit/aging" element={
                                <ProtectedRoute roles={['ADMIN', 'CASHIER']}>
                                  <AgingReport />
                                </ProtectedRoute>
                              } />
                              <Route path="/credit/ledger/:clientId" element={
                                <ProtectedRoute roles={['ADMIN', 'CASHIER']}>
                                  <ClientLedger />
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
                              <Route path="/accounts-payable" element={
                                <ProtectedRoute roles={['ADMIN', 'WAREHOUSE']}>
                                  <AccountsPayable />
                                </ProtectedRoute>
                              } />
                              <Route path="/suppliers/:supplierId/ledger" element={
                                <ProtectedRoute roles={['ADMIN', 'WAREHOUSE']}>
                                  <SupplierLedger />
                                </ProtectedRoute>
                              } />
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

                              {/* Admin Only */}
                              <Route path="/settings" element={
                                <ProtectedRoute roles={['ADMIN']}>
                                  <Settings />
                                </ProtectedRoute>
                              } />
                              <Route path="/users" element={
                                <ProtectedRoute roles={['ADMIN']}>
                                  <UsersManager />
                                </ProtectedRoute>
                              } />
                              <Route path="/audit-logs" element={
                                <ProtectedRoute roles={['ADMIN']}>
                                  <AuditLogs />
                                </ProtectedRoute>
                              } />
                              <Route path="/hr/commissions" element={
                                <ProtectedRoute roles={['ADMIN']}>
                                  <CommissionPayout />
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
                                <ProtectedRoute>
                                  <TableMap />
                                </ProtectedRoute>
                              } />
                              <Route path="/restaurant/kitchen" element={
                                <ProtectedRoute>
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

                              {/* Service Module Routes */}
                              <Route path="/services" element={
                                <ProtectedRoute>
                                  <ServicesDashboard />
                                </ProtectedRoute>
                              } />
                              <Route path="/services/list" element={
                                <ProtectedRoute>
                                  <ServiceList />
                                </ProtectedRoute>
                              } />
                              <Route path="/services/reception" element={
                                <ProtectedRoute>
                                  <Reception />
                                </ProtectedRoute>
                              } />
                              <Route path="/services/orders/:id" element={
                                <ProtectedRoute>
                                  <ServiceManager />
                                </ProtectedRoute>
                              } />

                              {/* Laundry Routes - Decoupled */}
                              <Route path="/laundry" element={
                                <ProtectedRoute>
                                  <LaundryDashboard />
                                </ProtectedRoute>
                              } />
                              <Route path="/laundry/new" element={
                                <ProtectedRoute>
                                  <LaundryForm />
                                </ProtectedRoute>
                              } />
                              <Route path="/laundry/ticket/:orderId" element={
                                <ProtectedRoute>
                                  <LaundryTicket />
                                </ProtectedRoute>
                              } />

                              {/* Barbershop Routes - Unified Section */}
                              <Route path="/barbershop" element={
                                <ProtectedRoute>
                                  <BarbershopDashboard />
                                </ProtectedRoute>
                              } />
                              <Route path="/barbershop/employees" element={
                                <ProtectedRoute>
                                  <EmployeeManager />
                                </ProtectedRoute>
                              } />
                              <Route path="/barbershop/commissions" element={
                                <ProtectedRoute>
                                  <CommissionsReport />
                                </ProtectedRoute>
                              } />
                            </Route>
                          </Route>

                          {/* Catch all - Redirect to Dashboard */}
                          <Route path="*" element={<Navigate to="/" replace />} />
                        </Routes>
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
