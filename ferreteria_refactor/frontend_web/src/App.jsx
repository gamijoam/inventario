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
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

// Lazy-loaded pages (all non-critical-path pages)
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
const CreatePurchase = React.lazy(() => import('./pages/Purchases/CreatePurchase'));
const PurchaseDetail = React.lazy(() => import('./pages/Purchases/PurchaseDetail'));
const AccountsPayable = React.lazy(() => import('./pages/Suppliers/AccountsPayable'));
const DetailedReports = React.lazy(() => import('./pages/Reports/DetailedReports'));

// Supplier Ledger
const SupplierLedger = React.lazy(() => import('./pages/Suppliers/SupplierLedger'));
const UnifiedReports = React.lazy(() => import('./pages/Reports/UnifiedReports'));

const Suppliers = React.lazy(() => import('./pages/Suppliers'));
const ReturnsManager = React.lazy(() => import('./pages/Returns/ReturnsManager'));
const WarrantyManager = React.lazy(() => import('./pages/Returns/WarrantyManager'));
const SalesHistory = React.lazy(() => import('./pages/SalesHistory'));
const CustomerManager = React.lazy(() => import('./pages/Customers/CustomerManager'));
const QuotesManager = React.lazy(() => import('./pages/Quotes/QuotesManager'));
const WarehouseManager = React.lazy(() => import('./pages/Warehouses/WarehouseManager'));
const InventoryTransfers = React.lazy(() => import('./pages/Warehouses/InventoryTransfers'));
const ExternalTransferOut = React.lazy(() => import('./pages/Inventory/Transfers/ExternalTransferOut'));
const ExternalTransferIn = React.lazy(() => import('./pages/Inventory/Transfers/ExternalTransferIn'));
const SerializedReception = React.lazy(() => import('./pages/Inventory/SerializedReception'));
const WarrantyPolicies = React.lazy(() => import('./pages/WarrantyPolicies')); // NEW: Warranty Policies

const AccountsReceivable = React.lazy(() => import('./pages/Credit/AccountsReceivable'));
const AgingReport = React.lazy(() => import('./pages/Credit/AgingReport'));
const ClientLedger = React.lazy(() => import('./pages/Credit/ClientLedger'));
const UsersManager = React.lazy(() => import('./pages/Users/UsersManager'));
const CashHistory = React.lazy(() => import('./pages/CashHistory'));
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
const Reception = React.lazy(() => import('./pages/Services/Reception')); // NEW: Service Reception
const ServicesDashboard = React.lazy(() => import('./pages/Services/ServicesDashboard')); // NEW: Dashboard
const ServiceManager = React.lazy(() => import('./pages/Services/ServiceManager')); // NEW: Service Manager
const ServiceList = React.lazy(() => import('./pages/Services/ServiceList')); // NEW: Service List
const CommissionPayout = React.lazy(() => import('./pages/HumanResources/CommissionPayout')); // NEW: Commission Payout

// Barbershop Module
const BarbershopDashboard = React.lazy(() => import('./pages/Barbershop/BarbershopDashboard'));
const EmployeeManager = React.lazy(() => import('./pages/Barbershop/EmployeeManager'));
const CommissionsReport = React.lazy(() => import('./pages/Barbershop/CommissionsReport'));

// Laundry Module
const LaundryDashboard = React.lazy(() => import('./pages/Laundry/LaundryDashboard'));
const LaundryForm = React.lazy(() => import('./pages/Laundry/LaundryForm'));
const LaundryTicket = React.lazy(() => import('./pages/Laundry/components/LaundryTicket'));
const SupportTickets = React.lazy(() => import('./pages/SupportTickets'));

// Suspense fallback spinner
const SuspenseFallback = (
  <div className="flex items-center justify-center h-screen">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
  </div>
);

function App() {

  // 🛡️ STARTUP LOADER (Chicken & Egg Fix)
  // We MUST wait for checking the API URL before rendering ANY provider
  // otherwise CloudConfigProvider or AuthProvider will try to connect and fail.
  const [isReady, setIsReady] = React.useState(false);

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
                        </Suspense>
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
