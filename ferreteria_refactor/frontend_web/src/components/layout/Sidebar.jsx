import { useLocation, Link, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard,
    ShoppingCart,
    Package,
    Users,
    Settings,
    LogOut,
    FileText,
    Truck,
    CreditCard,
    Briefcase,
    ChevronLeft,
    ChevronRight,
    Archive,
    Tags,
    Warehouse,
    FileInput,
    RefreshCcw,
    ArrowRightLeft,
    BarChart2,
    BookOpen,
    ClipboardList,
    DollarSign,
    CornerDownLeft
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { useAuth } from '../../context/AuthContext';

const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: ShoppingCart, label: 'Ventas (POS)', path: '/pos' },
    { icon: FileInput, label: 'Cotizaciones', path: '/quotes' },
    { icon: BarChart2, label: 'Detalles de Ventas', path: '/reports/detailed' },
    { icon: FileText, label: 'Historial Ventas', path: '/sales-history' },
    { icon: CornerDownLeft, label: 'Devoluciones', path: '/returns' },
    { icon: Users, label: 'Clientes', path: '/customers' },

    // Inventory Section
    { icon: Package, label: 'Catálogo', path: '/products' },
    { icon: Tags, label: 'Categorías', path: '/categories' },
    { icon: Archive, label: 'Kardex', path: '/inventory' },
    { icon: Warehouse, label: 'Almacenes', path: '/warehouses' },
    { icon: ArrowRightLeft, label: 'Traslados', path: '/transfers' },

    // Purchasing & Finance
    { icon: Briefcase, label: 'Compras', path: '/purchases' },
    { icon: Truck, label: 'Proveedores', path: '/suppliers' },
    { icon: CreditCard, label: 'Cuentas por Cobrar', path: '/accounts-receivable' },
    { icon: DollarSign, label: 'Cuentas por Pagar', path: '/accounts-payable' },

    // Admin & Tools
    { icon: RefreshCcw, label: 'Historial de Caja', path: '/cash-history' },
    { icon: ClipboardList, label: 'Auditoría', path: '/audit-logs' },
    { icon: BookOpen, label: 'Ayuda', path: '/help' },
    { icon: Settings, label: 'Configuración', path: '/settings' },
];

export default function Sidebar({ isCollapsed, toggleSidebar }) {
    const location = useLocation();
    const navigate = useNavigate();
    const { logout, user } = useAuth();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <aside
            className={cn(
                "bg-white border-r border-slate-200 fixed h-full flex flex-col z-20 transition-all duration-300 ease-in-out shadow-sm",
                isCollapsed ? "w-20" : "w-64"
            )}
        >
            <div className="h-16 flex items-center justify-between px-4 border-b border-slate-100 relative bg-slate-50/50">
                {!isCollapsed && (
                    <div className="flex items-center gap-2 font-bold text-xl text-slate-800 transition-opacity duration-300">
                        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-md shadow-indigo-200">
                            F
                        </div>
                        <span className="tracking-tight">Ferretería</span>
                    </div>
                )}
                {isCollapsed && (
                    <div className="w-full flex justify-center">
                        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shadow-md shadow-indigo-200">
                            F
                        </div>
                    </div>
                )}

                <button
                    onClick={toggleSidebar}
                    className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-400 hover:text-indigo-600 shadow-sm transition-colors z-30 transform hover:scale-110"
                >
                    {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                </button>
            </div>

            <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 custom-scrollbar">
                {menuItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={cn(
                                "flex items-center px-3 py-2.5 rounded-xl text-sm font-bold transition-all group relative my-0.5",
                                isActive
                                    ? "bg-indigo-50 text-indigo-600 shadow-sm"
                                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900",
                                isCollapsed && "justify-center"
                            )}
                        >
                            <item.icon
                                size={20}
                                className={cn(
                                    "transition-colors flex-shrink-0",
                                    isActive ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600"
                                )}
                            />

                            {!isCollapsed && <span className="ml-3 truncate">{item.label}</span>}

                            {/* Tooltip for collapsed state */}
                            {isCollapsed && (
                                <div className="absolute left-full ml-4 px-3 py-1.5 bg-slate-800 text-white text-xs font-bold rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all whitespace-nowrap z-50 shadow-xl translate-x-2 group-hover:translate-x-0">
                                    {item.label}
                                    <div className="absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 w-2 h-2 bg-slate-800 transform rotate-45"></div>
                                </div>
                            )}
                        </Link>
                    );
                })}
            </nav>

            <div className="p-4 border-t border-slate-100 bg-slate-50/30">
                <button
                    onClick={handleLogout}
                    className={cn(
                        "flex items-center px-3 py-2 w-full rounded-xl text-sm font-bold text-rose-600 hover:bg-rose-50 transition-colors",
                        isCollapsed && "justify-center"
                    )}
                >
                    <LogOut size={20} />
                    {!isCollapsed && <span className="ml-3">Cerrar Sesión</span>}
                </button>

                {!isCollapsed && (
                    <div className="mt-4 flex items-center gap-3 px-3 transition-opacity duration-300 border-t border-slate-100 pt-4">
                        <div className="w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 font-black text-xs shadow-sm">
                            {user?.username?.substring(0, 2).toUpperCase() || 'US'}
                        </div>
                        <div className="text-xs overflow-hidden">
                            <p className="font-bold text-slate-700 truncate">{user?.username || 'Usuario'}</p>
                            <p className="text-slate-400 font-medium truncate w-32">{user?.role || 'Rol'}</p>
                        </div>
                    </div>
                )}
            </div>
        </aside>
    );
}
