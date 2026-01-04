import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Unauthorized from './pages/Unauthorized';
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

// ... existing imports ...
import Suppliers from './pages/Suppliers';
import ReturnsManager from './pages/Returns/ReturnsManager';
import SalesHistory from './pages/SalesHistory';
import CustomerManager from './pages/Customers/CustomerManager';
import QuotesManager from './pages/Quotes/QuotesManager';
import WarehouseManager from './pages/Warehouses/WarehouseManager';
import InventoryTransfers from './pages/Warehouses/InventoryTransfers';
import ExternalTransferOut from './pages/Inventory/Transfers/ExternalTransferOut';
import ExternalTransferIn from './pages/Inventory/Transfers/ExternalTransferIn';

// ... existing imports


import AccountsReceivable from './pages/Credit/AccountsReceivable';
import AgingReport from './pages/Credit/AgingReport';
import ClientLedger from './pages/Credit/ClientLedger';
import UsersManager from './pages/Users/UsersManager';
import CashHistory from './pages/CashHistory';
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
import { CloudConfigProvider } from './context/CloudConfigContext';
import { AutoSyncProvider } from './context/AutoSyncContext';

import MobileWaiterLayout from './layouts/MobileWaiterLayout';
import WaiterLogin from './pages/Mobile/WaiterLogin';
import MobileTableGrid from './pages/Mobile/MobileTableGrid';
import MobileOrderTaker from './pages/Mobile/MobileOrderTaker';
import Reception from './pages/Services/Reception'; // NEW: Service Reception

import { Toaster } from 'react-hot-toast';
import AppWithCloudConfig from './components/setup/AppWithCloudConfig';

function App() {
  return (
    <CloudConfigProvider>
      <AuthProvider>
        <Toaster position="top-right" />
        <AppWithCloudConfig>
          <AutoSyncProvider>
            <WebSocketProvider>
              <ConfigProvider>
                <CashProvider>
                  <CartProvider>
                    <Router>
                      <Routes>
                        <Route path="/login" element={<Login />} />

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
                            <Route path="/warehouses" element={
                              <ProtectedRoute roles={['ADMIN', 'WAREHOUSE']}>
                                <WarehouseManager />
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
                              <ProtectedRoute roles={['ADMIN', 'WAREHOUSE']}>
                                <ReturnsManager />
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

                            {/* Service Module */}
                            <Route path="/services/reception" element={
                              <ProtectedRoute>
                                <Reception />
                              </ProtectedRoute>
                            } />
                          </Route>
                        </Route>
                      </Routes>
                    </Router>
                  </CartProvider>
                </CashProvider>
              </ConfigProvider>
            </WebSocketProvider>
          </AutoSyncProvider>
        </AppWithCloudConfig>
      </AuthProvider>
    </CloudConfigProvider>
  );
}

export default App;
