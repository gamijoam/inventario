import { useState, useEffect } from 'react';
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
    ChevronDown,
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
    CornerDownLeft,
    PieChart,
    Utensils,
    ChefHat,
    Smartphone
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { useAuth } from '../../context/AuthContext';
import { useConfig } from '../../context/ConfigContext';

// Moved inside component to use context

export default function Sidebar({ isCollapsed, toggleSidebar }) {
    const location = useLocation();
    const navigate = useNavigate();
    const { logout, user } = useAuth();
    const { modules } = useConfig();

    const menuStructure = [
        {
            type: 'single',
            item: { icon: LayoutDashboard, label: 'Dashboard', path: '/' }
        },
        // RESTAURANT MODULE
        ...(modules?.restaurant ? [{
            type: 'group',
            label: 'Restaurante',
            icon: Utensils,
            items: [
                { icon: Utensils, label: 'Mapa de Mesas', path: '/restaurant/tables' },
                { icon: ChefHat, label: 'Cocina', path: '/restaurant/kitchen' },
                { icon: Smartphone, label: 'Comandera Móvil', path: '/mobile/login' },
                { icon: BookOpen, label: 'Menú Digital', path: '/restaurant/menu' },
                { icon: ClipboardList, label: 'Recetas / Escandallos', path: '/restaurant/recipes' },
            ]
        }] : []),
        {
            type: 'group',
            label: 'Ventas y Atención',
            icon: ShoppingCart, // Used for collapsed tooltip or main icon
            items: [
                { icon: ShoppingCart, label: 'Nueva Venta', path: '/pos' },
                { icon: FileText, label: 'Historial', path: '/sales-history' },
                { icon: FileInput, label: 'Cotizaciones', path: '/quotes' },
                { icon: CornerDownLeft, label: 'Devoluciones', path: '/returns' },
                { icon: Users, label: 'Clientes', path: '/customers' },
            ]
        },
        {
            type: 'group',
            label: 'Inventario',
            icon: Package,
            items: [
                { icon: Package, label: 'Productos', path: '/products' },
                { icon: Tags, label: 'Categorías', path: '/categories' },
                { icon: Archive, label: 'Movimientos', path: '/inventory' },
                { icon: Warehouse, label: 'Almacenes', path: '/warehouses' },
                { icon: ArrowRightLeft, label: 'Traslados', path: '/transfers' },
            ]
        },
        {
            type: 'group',
            label: 'Finanzas y Compras',
            icon: DollarSign,
            items: [
                { icon: Briefcase, label: 'Compras', path: '/purchases' },
                { icon: Truck, label: 'Proveedores', path: '/suppliers' },
                { icon: RefreshCcw, label: 'Corte de Caja', path: '/cash-history' },
                { icon: CreditCard, label: 'Ctas. por Cobrar', path: '/accounts-receivable' },
                { icon: BarChart2, label: 'Antigüedad (Aging)', path: '/credit/aging' },
                { icon: DollarSign, label: 'Ctas. por Pagar', path: '/accounts-payable' },
                { icon: BarChart2, label: 'Reportes', path: '/reports/unified' },
            ]
        },
        {
            type: 'group',
            label: 'Sistema',
            icon: Settings,
            items: [
                { icon: Users, label: 'Usuarios', path: '/users' },
                { icon: ClipboardList, label: 'Auditoría', path: '/audit-logs' },
                { icon: Settings, label: 'Configuración', path: '/settings' },
                { icon: BookOpen, label: 'Ayuda', path: '/help' },
            ]
        }
    ];

    // State for expanded groups
    const [expandedGroups, setExpandedGroups] = useState({});

    // Auto-expand group if current path is inside it
    useEffect(() => {
        if (isCollapsed) return; // Don't messy auto-expand if collapsed

        const newExpanded = { ...expandedGroups };

        menuStructure.forEach(group => {
            if (group.type === 'group') {
                const hasActiveItem = group.items.some(item => item.path === location.pathname);
                if (hasActiveItem) {
                    newExpanded[group.label] = true;
                }
            }
        });

        // Only update if changed (to prevent loops, though object creation makes it tricky, simple check here)
        // For simplicity, just setting it is fine as effect runs on path change
        setExpandedGroups(prev => ({ ...prev, ...newExpanded }));
    }, [location.pathname, isCollapsed]);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const toggleGroup = (label) => {
        if (isCollapsed) {
            toggleSidebar(); // Auto open sidebar if user clicks a group in collapsed mode
            setTimeout(() => {
                setExpandedGroups(prev => ({ ...prev, [label]: true }));
            }, 50);
            return;
        }
        setExpandedGroups(prev => ({ ...prev, [label]: !prev[label] }));
    };

    return (
        <aside
            className={cn(
                "bg-white border-r border-slate-200 fixed h-full flex flex-col z-50 transition-all duration-300 ease-in-out shadow-sm",
                isCollapsed ? "w-20" : "w-64"
            )}
        >
            <div className="h-16 flex items-center justify-between px-4 border-b border-slate-100 relative bg-slate-50/50">
                {!isCollapsed && (
                    <div className="flex items-center gap-2 font-bold text-xl text-slate-800 transition-opacity duration-300">
                        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-md shadow-indigo-200">
                            I
                        </div>
                        <span className="tracking-tight">InvenSoft</span>
                    </div>
                )}
                {isCollapsed && (
                    <div className="w-full flex justify-center">
                        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shadow-md shadow-indigo-200">
                            I
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
                {menuStructure.map((group, idx) => {
                    // RENDER SINGLE ITEM
                    if (group.type === 'single') {
                        const isActive = location.pathname === group.item.path;
                        return (
                            <Link
                                key={group.item.path}
                                to={group.item.path}
                                className={cn(
                                    "flex items-center px-3 py-2.5 rounded-xl text-sm font-bold transition-all group relative my-1",
                                    isActive
                                        ? "bg-indigo-50 text-indigo-600 shadow-sm"
                                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-900",
                                    isCollapsed && "justify-center"
                                )}
                            >
                                <group.item.icon
                                    size={20}
                                    className={cn(
                                        "transition-colors flex-shrink-0",
                                        isActive ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600"
                                    )}
                                />
                                {!isCollapsed && <span className="ml-3 truncate">{group.item.label}</span>}
                                {isCollapsed && (
                                    <div className="absolute left-full ml-4 px-3 py-1.5 bg-slate-800 text-white text-xs font-bold rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all whitespace-nowrap z-50 shadow-xl translate-x-2 group-hover:translate-x-0">
                                        {group.item.label}
                                        <div className="absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 w-2 h-2 bg-slate-800 transform rotate-45"></div>
                                    </div>
                                )}
                            </Link>
                        );
                    }

                    // RENDER GROUP
                    const isExpanded = expandedGroups[group.label];
                    const hasActiveChild = group.items.some(item => item.path === location.pathname);

                    if (isCollapsed) {
                        // Collapsed mode: Show group icon only (simplified)
                        // Or show main icon and a tooltip with subitems (Advanced) -- Let's keep it simple: Main icon that expands sidebar
                        return (
                            <div
                                key={idx}
                                className="group relative my-1 flex justify-center"
                            >
                                <button
                                    onClick={() => toggleGroup(group.label)}
                                    className={cn(
                                        "flex items-center justify-center w-10 h-10 rounded-xl transition-all",
                                        hasActiveChild ? "bg-indigo-50 text-indigo-600" : "text-slate-400 hover:bg-slate-50 hover:text-slate-600"
                                    )}
                                >
                                    <group.icon size={20} />
                                </button>
                                {/* Tooltip for group */}
                                <div className="absolute left-full ml-4 top-0 bg-slate-800 text-white rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all z-50 shadow-xl translate-x-2 group-hover:translate-x-0 overflow-hidden min-w-[150px]">
                                    <div className="px-3 py-2 border-b border-slate-700 font-bold text-xs bg-slate-900/50">
                                        {group.label}
                                    </div>
                                    <div className="py-1">
                                        {group.items.map(subItem => (
                                            <div key={subItem.path} className="px-3 py-1.5 text-xs text-slate-300 flex items-center gap-2">
                                                <subItem.icon size={12} />
                                                {subItem.label}
                                            </div>
                                        ))}
                                    </div>
                                    <div className="absolute left-0 top-3 -translate-x-1 w-2 h-2 bg-slate-800 transform rotate-45"></div>
                                </div>
                            </div>
                        );
                    }

                    return (
                        <div key={idx} className="my-1">
                            <button
                                onClick={() => toggleGroup(group.label)}
                                className={cn(
                                    "w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-bold transition-all group select-none",
                                    hasActiveChild && !isExpanded
                                        ? "text-indigo-600 bg-indigo-50/50"
                                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                                )}
                            >
                                <div className="flex items-center">
                                    <group.icon
                                        size={20}
                                        className={cn(
                                            "transition-colors",
                                            hasActiveChild && !isExpanded ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600"
                                        )}
                                    />
                                    <span className="ml-3">{group.label}</span>
                                </div>
                                <ChevronDown
                                    size={16}
                                    className={cn(
                                        "transition-transform duration-200 text-slate-400",
                                        isExpanded ? "transform rotate-180" : ""
                                    )}
                                />
                            </button>

                            {/* Submenu */}
                            <div
                                className={cn(
                                    "overflow-hidden transition-all duration-300 ease-in-out pl-4 space-y-0.5 border-l-2 border-slate-100 ml-4 mt-1",
                                    isExpanded ? "max-h-[500px] opacity-100 mb-2" : "max-h-0 opacity-0"
                                )}
                            >
                                {group.items.map(subItem => {
                                    const isSubActive = location.pathname === subItem.path;
                                    return (
                                        <Link
                                            key={subItem.path}
                                            to={subItem.path}
                                            className={cn(
                                                "flex items-center px-3 py-2 rounded-lg text-xs font-medium transition-all relative",
                                                isSubActive
                                                    ? "text-indigo-600 bg-indigo-50"
                                                    : "text-slate-500 hover:text-indigo-600 hover:translate-x-1"
                                            )}
                                        >
                                            <span className={cn("w-1.5 h-1.5 rounded-full mr-2 transition-colors", isSubActive ? "bg-indigo-500" : "bg-slate-300")}></span>
                                            {subItem.label}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
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
