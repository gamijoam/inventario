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
    Smartphone,
    Plus,
    ArrowRight,
    Download,
    Wrench,
    ShieldCheck,
    X,
    HelpCircle,
    LifeBuoy
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { useAuth } from '../../context/AuthContext';
import { useConfig } from '../../context/ConfigContext';
import { useAppTour } from '../../hooks/useAppTour';
import TourSelectionModal from '../common/TourSelectionModal';

export default function Sidebar({ isCollapsed, toggleSidebar, isMobileMenuOpen, closeMobileMenu }) {
    const location = useLocation();
    const navigate = useNavigate();
    const { logout, user } = useAuth();
    const { modules } = useConfig();
    const { startTour } = useAppTour();
    const [isTourModalOpen, setIsTourModalOpen] = useState(false);

    const menuStructure = [
        {
            type: 'single',
            item: { icon: LayoutDashboard, label: 'Resumen', path: '/' }
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
                { icon: ClipboardList, label: 'Recetas', path: '/restaurant/recipes' },
            ]
        }] : []),
        // SERVICE & LAUNDRY MODULES
        ...((modules?.services || modules?.laundry) ? [{
            type: 'group',
            label: modules?.services ? 'Servicios' : 'Lavandería',
            icon: modules?.services ? Wrench : Smartphone,
            items: [
                ...(modules?.services ? [
                    { icon: FileText, label: 'Taller', path: '/services/list' },
                    { icon: Plus, label: 'Nueva Recepción', path: '/services/reception' }
                ] : []),
                ...(modules?.laundry ? [
                    { icon: Smartphone, label: 'Tablero Lavandería', path: '/laundry' },
                ] : []),
            ]
        }] : []),
        {
            type: 'group',
            label: 'Ventas',
            icon: ShoppingCart,
            items: [
                { icon: ShoppingCart, label: 'Nueva Venta', path: '/pos' },
                { icon: FileText, label: 'Historial', path: '/sales-history' },
                { icon: FileInput, label: 'Cotizaciones', path: '/quotes' },
                { icon: CornerDownLeft, label: 'Devoluciones', path: '/returns' },
                ...(modules?.services ? [
                    { icon: ShieldCheck, label: 'Garantías', path: '/rma/warranty' }
                ] : []),
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
                { icon: ArrowRight, label: 'Exportar', path: '/transfers/external/out' },
                { icon: Download, label: 'Importar', path: '/transfers/external/in' },
            ]
        },
        {
            type: 'group',
            label: 'Finanzas',
            icon: DollarSign,
            items: [
                { icon: Briefcase, label: 'Compras', path: '/purchases' },
                { icon: Truck, label: 'Proveedores', path: '/suppliers' },
                { icon: RefreshCcw, label: 'Corte de Caja', path: '/cash-history' },
                { icon: CreditCard, label: 'Ctas. por Cobrar', path: '/accounts-receivable' },
                { icon: BarChart2, label: 'Antigüedad', path: '/credit/aging' },
                { icon: DollarSign, label: 'Ctas. por Pagar', path: '/accounts-payable' },
                ...(modules?.services ? [
                    { icon: DollarSign, label: 'Comisiones', path: '/hr/commissions' }
                ] : []),
                { icon: BarChart2, label: 'Reportes Unificados', path: '/reports/unified' },
                { icon: PieChart, label: 'Reportes Detallados', path: '/reports/detailed' },
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
            ]
        }
    ];

    const [expandedGroups, setExpandedGroups] = useState({});

    useEffect(() => {
        if (isCollapsed) return;
        const newExpanded = { ...expandedGroups };
        menuStructure.forEach(group => {
            if (group.type === 'group') {
                const hasActiveItem = group.items.some(item => item.path === location.pathname);
                if (hasActiveItem) newExpanded[group.label] = true;
            }
        });
        setExpandedGroups(prev => ({ ...prev, ...newExpanded }));
    }, [location.pathname, isCollapsed]);

    const handleLogout = () => { logout(); navigate('/login'); };

    const toggleGroup = (label) => {
        if (isCollapsed) {
            toggleSidebar();
            setTimeout(() => setExpandedGroups(prev => ({ ...prev, [label]: true })), 50);
            return;
        }
        setExpandedGroups(prev => ({ ...prev, [label]: !prev[label] }));
    };

    return (
        <aside className={cn(
            "bg-white border-r border-slate-200 fixed h-full transition-all duration-300 ease-in-out shadow-[1px_0_5px_rgba(0,0,0,0.02)] inset-y-0 left-0 flex flex-col z-20",
            isCollapsed ? "md:w-20" : "md:w-64",
            isMobileMenuOpen ? "flex w-64 translate-x-0 z-50" : "hidden md:flex max-md:-translate-x-full"
        )}>
            {/* Logo Area */}
            <div className="h-16 flex items-center px-6 border-b border-slate-100 bg-white relative">
                {!isCollapsed ? (
                    <div className="flex items-center gap-3 animate-in fade-in duration-300">
                        <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center text-white shadow-sm">
                            <span className="font-bold text-lg">M</span>
                        </div>
                        <span className="font-bold text-lg text-slate-900 tracking-tight">Mi Inventario</span>
                    </div>
                ) : (
                    <div className="w-full flex justify-center">
                        <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center text-white shadow-sm">
                            <span className="font-bold text-lg">M</span>
                        </div>
                    </div>
                )}

                {/* Close Mobile */}
                {isMobileMenuOpen && (
                    <button onClick={closeMobileMenu} className="md:hidden absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                        <X size={20} />
                    </button>
                )}
            </div>

            {/* Desktop Collapse Button - Positioned Below Header */}
            <button
                onClick={toggleSidebar}
                className="hidden md:flex absolute -right-3 top-20 w-6 h-12 bg-white border-2 border-indigo-500 rounded-full items-center justify-center text-indigo-600 shadow-md hover:shadow-lg hover:bg-indigo-50 transition-all duration-200 z-30"
                title={isCollapsed ? "Expandir menú (→)" : "Colapsar menú (←)"}
            >
                {isCollapsed ? (
                    <ChevronRight size={20} strokeWidth={3} />
                ) : (
                    <ChevronLeft size={20} strokeWidth={3} />
                )}
            </button>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto px-3 py-6 space-y-1 custom-scrollbar">
                {menuStructure.map((group, idx) => {
                    // SINGLE ITEM
                    if (group.type === 'single') {
                        const isActive = location.pathname === group.item.path;
                        return (
                            <Link
                                key={group.item.path}
                                to={group.item.path}
                                id={group.item.label === 'Resumen' ? 'sidebar-dashboard' : undefined}
                                onClick={closeMobileMenu}
                                className={cn(
                                    "flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all relative group mb-1",
                                    isActive
                                        ? "bg-slate-900 text-white shadow-md shadow-slate-200"
                                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-900",
                                    isCollapsed && "justify-center px-0"
                                )}
                                title={isCollapsed ? group.item.label : ''}
                            >
                                <group.item.icon size={20} className={cn("shrink-0", isActive ? "text-white" : "text-slate-400 group-hover:text-slate-600")} strokeWidth={isActive ? 2.5 : 2} />
                                {!isCollapsed && <span className="ml-3 font-semibold">{group.item.label}</span>}
                            </Link>
                        );
                    }

                    // GROUP ITEM
                    const isExpanded = expandedGroups[group.label];
                    const hasActiveChild = group.items.some(item => item.path === location.pathname);
                    const groupId = `sidebar-group-${group.label.toLowerCase().replace(/\s+/g, '-')}`;

                    if (isCollapsed) {
                        return (
                            <div key={idx} className="flex justify-center my-1 group relative">
                                <button id={groupId} onClick={() => toggleGroup(group.label)} className={cn("w-10 h-10 flex items-center justify-center rounded-lg transition-all", hasActiveChild ? "bg-slate-100 text-slate-900" : "text-slate-400 hover:bg-slate-50")}>
                                    <group.icon size={20} />
                                </button>
                                {/* Tooltip Logic Simplified */}
                            </div>
                        );
                    }

                    return (
                        <div key={idx} className="mb-2">
                            <button
                                onClick={() => toggleGroup(group.label)}
                                id={groupId}
                                className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-colors group select-none"
                            >
                                <div className="flex items-center">
                                    <group.icon size={18} className={cn("text-slate-400 group-hover:text-slate-600 transition-colors", hasActiveChild && "text-slate-900")} />
                                    <span className={cn("ml-3 font-semibold", hasActiveChild && "text-slate-900")}>{group.label}</span>
                                </div>
                                <ChevronDown size={14} className={cn("transition-transform duration-200", isExpanded && "rotate-180")} />
                            </button>

                            <div className={cn("overflow-hidden transition-all duration-300 ease-in-out pl-4 space-y-0.5 mt-1 border-l border-slate-100 ml-4", isExpanded ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0")}>
                                {group.items.map(subItem => {
                                    const isSubActive = location.pathname === subItem.path;
                                    const itemId = `sidebar-item-${subItem.label.toLowerCase().replace(/\s+/g, '-')}`;
                                    return (
                                        <Link
                                            key={subItem.path}
                                            to={subItem.path}
                                            id={itemId}
                                            onClick={closeMobileMenu}
                                            className={cn(
                                                "flex items-center px-3 py-2 rounded-md text-sm transition-all relative",
                                                isSubActive
                                                    ? "text-indigo-600 font-bold bg-indigo-50/50"
                                                    : "text-slate-500 font-medium hover:text-slate-900 hover:bg-slate-50"
                                            )}
                                        >
                                            <span className={cn("w-1.5 h-1.5 rounded-full mr-2.5", isSubActive ? "bg-indigo-600" : "bg-slate-200")}></span>
                                            {subItem.label}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </nav>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 bg-white">
                <Link to="/support" className={cn("flex items-center px-3 py-2 rounded-lg text-indigo-500 hover:text-indigo-900 hover:bg-indigo-50 transition-colors w-full mb-1", isCollapsed && "justify-center")}>
                    <LifeBuoy size={20} />
                    {!isCollapsed && <span className="ml-3 font-semibold text-sm">Soporte Técnico</span>}
                </Link>
                <Link to="/help" className={cn("flex items-center px-3 py-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-colors w-full mb-1", isCollapsed && "justify-center")}>
                    <HelpCircle size={20} />
                    {!isCollapsed && <span className="ml-3 font-semibold text-sm">Ayuda</span>}
                </Link>

                <button
                    onClick={() => setIsTourModalOpen(true)}
                    className={cn("flex items-center px-3 py-2 rounded-lg text-indigo-600 hover:bg-indigo-50 transition-colors w-full mb-1", isCollapsed && "justify-center")}
                >
                    <BookOpen size={20} />
                    {!isCollapsed && <span className="ml-3 font-semibold text-sm">Guía de Uso</span>}
                </button>
                <button onClick={handleLogout} className={cn("flex items-center px-3 py-2 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors w-full", isCollapsed && "justify-center")}>
                    <LogOut size={20} />
                    {!isCollapsed && <span className="ml-3 font-bold text-sm">Salir</span>}
                </button>
            </div>

            {/* Tour Selection Modal */}
            <TourSelectionModal
                isOpen={isTourModalOpen}
                onClose={() => setIsTourModalOpen(false)}
            />
        </aside>
    );
}
