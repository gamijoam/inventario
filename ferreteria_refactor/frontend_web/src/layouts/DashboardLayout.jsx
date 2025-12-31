import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useConfig } from '../context/ConfigContext';
import RoleGuard from '../components/RoleGuard';
import SyncButton from '../components/sync/SyncButton';
import {
    LayoutDashboard,
    BarChart,
    Package,
    ShoppingCart,
    Settings as SettingsIcon,
    LogOut,
    FolderTree,
    ShoppingBag,
    DollarSign,

    Wallet,
    RotateCcw,
    Archive,
    User,
    History,
    ChevronDown,
    ChevronRight,
    Users,
    FileText,
    ClipboardList,
    Menu,
    X,
    HelpCircle,
    ArrowLeft,
    MapPin,
    Truck
} from 'lucide-react';

const DashboardLayout = () => {
    const { user, logout } = useAuth();
    const { business } = useConfig(); // Get business info
    const navigate = useNavigate();
    const location = useLocation();

    // Mobile menu state
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Collapsible menu states
    const [openSections, setOpenSections] = useState({
        inventory: true,
        sales: true,
        finance: true,
        operations: false,
        reports: false
    });

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const toggleSection = (section) => {
        setOpenSections(prev => ({
            ...prev,
            [section]: !prev[section]
        }));
    };

    const isActive = (path) => location.pathname === path;

    const SidebarContent = () => (
        <>
            <div className="p-4 border-b border-slate-700 flex justify-between items-center">
                <h1 className="text-xl font-bold truncate" title={business?.name || 'Ferretería Pro'}>
                    {business?.name || 'Ferretería Pro'}
                </h1>
                {/* Close button for mobile */}
                <button
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="md:hidden text-gray-400 hover:text-white"
                >
                    <X size={24} />
                </button>
            </div>

            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                {/* Dashboard */}
                <Link
                    to="/"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center space-x-3 p-3 rounded transition-colors ${isActive('/') ? 'bg-blue-600' : 'hover:bg-slate-700'
                        }`}
                >
                    <LayoutDashboard size={20} />
                    <span>Dashboard</span>
                </Link>

                {/* Inventario y Productos - ADMIN or WAREHOUSE */}
                <RoleGuard allowed={['ADMIN', 'WAREHOUSE']}>
                    <div>
                        <button
                            onClick={() => toggleSection('inventory')}
                            className="flex items-center justify-between w-full p-3 rounded hover:bg-slate-700 transition-colors"
                        >
                            <div className="flex items-center space-x-3">
                                <Package size={20} />
                                <span className="font-medium">Inventario</span>
                            </div>
                            {openSections.inventory ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>
                        {openSections.inventory && (
                            <div className="ml-4 mt-1 space-y-1">
                                <Link to="/products" onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center space-x-3 p-2 pl-4 rounded text-sm transition-colors ${isActive('/products') ? 'bg-blue-600' : 'hover:bg-slate-700'}`}>
                                    <Package size={16} />
                                    <span>Productos</span>
                                </Link>
                                <Link to="/categories" onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center space-x-3 p-2 pl-4 rounded text-sm transition-colors ${isActive('/categories') ? 'bg-blue-600' : 'hover:bg-slate-700'}`}>
                                    <FolderTree size={16} />
                                    <span>Categorías</span>
                                </Link>
                                <Link to="/inventory" onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center space-x-3 p-2 pl-4 rounded text-sm transition-colors ${isActive('/inventory') ? 'bg-blue-600' : 'hover:bg-slate-700'}`}>
                                    <Archive size={16} />
                                    <span>Kardex</span>
                                </Link>
                                <Link to="/warehouses" onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center space-x-3 p-2 pl-4 rounded text-sm transition-colors ${isActive('/warehouses') ? 'bg-blue-600' : 'hover:bg-slate-700'}`}>
                                    <MapPin size={16} />
                                    <span>Almacenes</span>
                                </Link>
                                <Link to="/transfers" onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center space-x-3 p-2 pl-4 rounded text-sm transition-colors ${isActive('/transfers') ? 'bg-blue-600' : 'hover:bg-slate-700'}`}>
                                    <Truck size={16} />
                                    <span>Traslados</span>
                                </Link>
                            </div>
                        )}
                    </div>
                </RoleGuard>

                {/* Ventas - ADMIN or CASHIER */}
                <RoleGuard allowed={['ADMIN', 'CASHIER']}>
                    <div>
                        <button
                            onClick={() => toggleSection('sales')}
                            className="flex items-center justify-between w-full p-3 rounded hover:bg-slate-700 transition-colors"
                        >
                            <div className="flex items-center space-x-3">
                                <ShoppingCart size={20} />
                                <span className="font-medium">Ventas</span>
                            </div>
                            {openSections.sales ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>
                        {openSections.sales && (
                            <div className="ml-4 mt-1 space-y-1">
                                <Link to="/pos" onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center space-x-3 p-2 pl-4 rounded text-sm transition-colors ${isActive('/pos') ? 'bg-blue-600' : 'hover:bg-slate-700'}`}>
                                    <ShoppingCart size={16} />
                                    <span>Punto de Venta</span>
                                </Link>
                                <Link to="/quotes" onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center space-x-3 p-2 pl-4 rounded text-sm transition-colors ${isActive('/quotes') ? 'bg-blue-600' : 'hover:bg-slate-700'}`}>
                                    <ClipboardList size={16} />
                                    <span>Cotizaciones</span>
                                </Link>
                                <Link to="/sales-history" onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center space-x-3 p-2 pl-4 rounded text-sm transition-colors ${isActive('/sales-history') ? 'bg-blue-600' : 'hover:bg-slate-700'}`}>
                                    <History size={16} />
                                    <span>Historial</span>
                                </Link>
                                <RoleGuard allowed={['ADMIN']}>
                                    <Link to="/returns" onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center space-x-3 p-2 pl-4 rounded text-sm transition-colors ${isActive('/returns') ? 'bg-blue-600' : 'hover:bg-slate-700'}`}>
                                        <RotateCcw size={16} />
                                        <span>Devoluciones</span>
                                    </Link>
                                </RoleGuard>
                            </div>
                        )}
                    </div>
                </RoleGuard>

                {/* Finanzas */}
                <RoleGuard allowed={['ADMIN', 'CASHIER']}>
                    <div>
                        <button
                            onClick={() => toggleSection('finance')}
                            className="flex items-center justify-between w-full p-3 rounded hover:bg-slate-700 transition-colors"
                        >
                            <div className="flex items-center space-x-3">
                                <DollarSign size={20} />
                                <span className="font-medium">Finanzas</span>
                            </div>
                            {openSections.finance ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>
                        {openSections.finance && (
                            <div className="ml-4 mt-1 space-y-1">
                                <Link to="/customers" onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center space-x-3 p-2 pl-4 rounded text-sm transition-colors ${isActive('/customers') ? 'bg-blue-600' : 'hover:bg-slate-700'}`}>
                                    <Users size={16} />
                                    <span>Clientes</span>
                                </Link>
                                <RoleGuard allowed={['ADMIN', 'CASHIER']}>
                                    <Link to="/accounts-receivable" onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center space-x-3 p-2 pl-4 rounded text-sm transition-colors ${isActive('/accounts-receivable') ? 'bg-blue-600' : 'hover:bg-slate-700'}`}>
                                        <FileText size={16} />
                                        <span>Cuentas por Cobrar</span>
                                    </Link>
                                </RoleGuard>
                                <RoleGuard allowed={['ADMIN']}>
                                    <Link to="/suppliers" onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center space-x-3 p-2 pl-4 rounded text-sm transition-colors ${isActive('/suppliers') ? 'bg-blue-600' : 'hover:bg-slate-700'}`}>
                                        <Truck size={16} />
                                        <span>Proveedores</span>
                                    </Link>
                                    <Link to="/accounts-payable" onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center space-x-3 p-2 pl-4 rounded text-sm transition-colors ${isActive('/accounts-payable') ? 'bg-blue-600' : 'hover:bg-slate-700'}`}>
                                        <Wallet size={16} />
                                        <span>Cuentas por Pagar</span>
                                    </Link>
                                </RoleGuard>
                            </div>
                        )}
                    </div>
                </RoleGuard>

                {/* Operaciones */}
                <RoleGuard allowed={['ADMIN', 'WAREHOUSE']}>
                    <div>
                        <button
                            onClick={() => toggleSection('operations')}
                            className="flex items-center justify-between w-full p-3 rounded hover:bg-slate-700 transition-colors"
                        >
                            <div className="flex items-center space-x-3">
                                <ShoppingBag size={20} />
                                <span className="font-medium">Operaciones</span>
                            </div>
                            {openSections.operations ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>
                        {openSections.operations && (
                            <div className="ml-4 mt-1 space-y-1">
                                <Link to="/purchases" onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center space-x-3 p-2 pl-4 rounded text-sm transition-colors ${isActive('/purchases') ? 'bg-blue-600' : 'hover:bg-slate-700'}`}>
                                    <ShoppingBag size={16} />
                                    <span>Compras</span>
                                </Link>
                            </div>
                        )}
                    </div>
                </RoleGuard>

                {/* Reportes - ADMIN ONLY */}
                <RoleGuard allowed={['ADMIN']}>
                    <div>
                        <button
                            onClick={() => toggleSection('reports')}
                            className="flex items-center justify-between w-full p-3 rounded hover:bg-slate-700 transition-colors"
                        >
                            <div className="flex items-center space-x-3">
                                <BarChart size={20} />
                                <span className="font-medium">Reportes</span>
                            </div>
                            {openSections.reports ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>
                        {openSections.reports && (
                            <div className="ml-4 mt-1 space-y-1">
                                <Link to="/reports/detailed" onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center space-x-3 p-2 pl-4 rounded text-sm transition-colors ${isActive('/reports/detailed') ? 'bg-blue-600' : 'hover:bg-slate-700'}`}>
                                    <FileText size={16} />
                                    <span>Detalles de Ventas</span>
                                </Link>
                            </div>
                        )}
                    </div>
                </RoleGuard>

                {/* Users - ADMIN ONLY */}
                <RoleGuard allowed="ADMIN">
                    <Link to="/users" onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center space-x-3 p-3 rounded transition-colors ${isActive('/users') ? 'bg-blue-600' : 'hover:bg-slate-700'}`}>
                        <Users size={20} />
                        <span>Usuarios</span>
                    </Link>
                    <Link to="/cash-history" onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center space-x-3 p-3 rounded transition-colors ${isActive('/cash-history') ? 'bg-blue-600' : 'hover:bg-slate-700'}`}>
                        <History size={20} />
                        <span>Historial de Caja</span>
                    </Link>
                    <Link to="/audit-logs" onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center space-x-3 p-3 rounded transition-colors ${isActive('/audit-logs') ? 'bg-blue-600' : 'hover:bg-slate-700'}`}>
                        <ClipboardList size={20} />
                        <span>Auditoría</span>
                    </Link>
                </RoleGuard>

                {/* Settings - ADMIN ONLY */}
                <RoleGuard allowed="ADMIN">
                    <Link to="/settings" onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center space-x-3 p-3 rounded transition-colors ${isActive('/settings') ? 'bg-blue-600' : 'hover:bg-slate-700'}`}>
                        <SettingsIcon size={20} />
                        <span>Configuración</span>
                    </Link>
                </RoleGuard>

                {/* Help - Available to all users */}
                <Link to="/help" onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center space-x-3 p-3 rounded transition-colors ${isActive('/help') ? 'bg-blue-600' : 'hover:bg-slate-700'}`}>
                    <HelpCircle size={20} />
                    <span>Ayuda</span>
                </Link>
            </nav>

            <div className="p-4 border-t border-slate-700">
                <button
                    onClick={handleLogout}
                    className="flex items-center space-x-3 p-3 rounded hover:bg-red-600 transition-colors w-full"
                >
                    <LogOut size={20} />
                    <span>Cerrar Sesión</span>
                </button>
            </div>
        </>
    );

    return (
        <div className="flex h-screen bg-gray-100">
            {/* Mobile Sidebar Overlay */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* Mobile Sidebar Drawer */}
            <aside className={`
                fixed inset-y-0 left-0 z-30 w-64 bg-slate-800 text-white transform transition-transform duration-300 ease-in-out md:hidden flex flex-col
                ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
            `}>
                <SidebarContent />
            </aside>

            {/* Desktop Sidebar (Static) */}
            <aside className="hidden md:flex w-64 bg-slate-800 text-white flex-col overflow-y-auto">
                <SidebarContent />
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden w-full">
                {/* Header */}
                <header className="bg-white shadow-sm h-16 flex items-center justify-between px-4 md:px-6 z-10">
                    <div className="flex items-center">
                        {/* Mobile Menu Button */}
                        <button
                            className="md:hidden mr-4 text-gray-600 hover:text-gray-900 focus:outline-none"
                            onClick={() => setIsMobileMenuOpen(true)}
                        >
                            <Menu size={24} />
                        </button>

                        {/* Back Button (Desktop/Mobile) */}
                        {location.pathname !== '/' && (
                            <button
                                onClick={() => navigate(-1)}
                                className="mr-4 p-2 text-gray-500 hover:text-gray-900 rounded-full hover:bg-gray-200 transition-colors"
                                title="Volver atrás"
                            >
                                <ArrowLeft size={20} />
                            </button>
                        )}

                        <h2 className="text-xl font-semibold text-gray-800 truncate">Panel de Control</h2>
                    </div>

                    <div className="flex items-center space-x-4 md:space-x-6">
                        {/* Hybrid Sync Trigger */}
                        <SyncButton />

                        {/* Quick Rate Widget - Hidden on very small screens if needed, or condensed */}
                        <div className="hidden sm:flex items-center bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
                            <div className="text-xs font-bold text-blue-800 mr-2">TASA BCV</div>
                            <div className="text-sm font-mono font-bold text-blue-600">
                                {useConfig().getExchangeRate('VES').toFixed(2)} Bs
                            </div>
                        </div>

                        <div className="flex items-center space-x-2 text-gray-700">
                            <User size={20} />
                            <div className="hidden md:flex flex-col items-end">
                                <span className="font-medium">{user?.username || 'Usuario'}</span>
                                <span className="text-xs text-gray-500">{user?.role || 'CASHIER'}</span>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Page Content - Adjusted padding for mobile */}
                <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 p-4 md:p-6">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default DashboardLayout;
