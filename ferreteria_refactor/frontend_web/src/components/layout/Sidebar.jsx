import { useState, useEffect, useCallback } from 'react';
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
    Building2,
    Monitor,
    Printer,
    LayoutGrid,
    Percent,
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
    LifeBuoy,
    Scissors,
    Pill
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { useAuth } from '../../context/AuthContext';
import { useConfig } from '../../context/ConfigContext';
import { useAppTour } from '../../hooks/useAppTour';
import TourSelectionModal from '../common/TourSelectionModal';
import supportService from '../../services/supportService';

export default function Sidebar({ isCollapsed, toggleSidebar, isMobileMenuOpen, closeMobileMenu }) {
    const location = useLocation();
    const navigate = useNavigate();
    const { logout, user } = useAuth();
    const { modules } = useConfig();
    const { startTour: _startTour } = useAppTour();
    const [isTourModalOpen, setIsTourModalOpen] = useState(false);
    const [supportUnread, setSupportUnread] = useState(0);

    // Poll unread support ticket count every 60 seconds
    const fetchUnreadCount = useCallback(async () => {
        try {
            const count = await supportService.getUnreadCount();
            setSupportUnread(count);
        } catch {
            // Silently ignore — user may not be authenticated yet
        }
    }, []);

    useEffect(() => {
        const initSupportUnread = async () => {
          await fetchUnreadCount();
        };
        initSupportUnread();
        const interval = setInterval(fetchUnreadCount, 60000);
        return () => clearInterval(interval);
    }, [fetchUnreadCount]);

    // Reset badge when user navigates to /support
    useEffect(() => {
        if (location.pathname === '/support') {
            supportService.markAsRead();
            setSupportUnread(0); // This is fine, it's a reaction to navigation
        }
    }, [location.pathname]);

    // En desarrollo, VITE_FORCE_ALL_MODULES=true (en .env.development) activa todos los módulos
    // para poder probarlos sin depender de los feature flags reales del backend.
    // En producción/QA la variable no existe y se usan los flags reales del tenant.
    const forceAll = import.meta.env.VITE_FORCE_ALL_MODULES === 'true';
    const effectiveModules = forceAll ? { ...modules, services: true, barbershop: true, restaurant: true, pharmacy: true } : modules;

    // Helpers de rol
    const role = user?.role;
    const isAdmin = role === 'ADMIN';
    const isAdminOrWarehouse = ['ADMIN', 'WAREHOUSE'].includes(role);
    const isAdminOrCashier = ['ADMIN', 'CASHIER'].includes(role);

    // Finanzas: items filtrados por rol (si quedan 0 items, el grupo no aparece)
    const finanzasItems = [
        ...(isAdminOrWarehouse ? [
            { icon: Briefcase, label: 'Compras', path: '/purchases' },
            { icon: Truck, label: 'Proveedores', path: '/suppliers' },
        ] : []),
        ...(isAdmin ? [
            { icon: BarChart2, label: 'Centro de Reportes', path: '/reports' },
            { icon: LayoutGrid, label: 'Gestión de Cajas', path: '/cash-registers' },
        ] : []),
    ];

    const menuStructure = [
        {
            type: 'single',
            item: { icon: LayoutDashboard, label: 'Resumen', path: '/' }
        },
        // RESTAURANT MODULE — ADMIN, CASHIER, WAITER, KITCHEN
        ...(effectiveModules?.restaurant && ['ADMIN', 'CASHIER', 'WAITER', 'KITCHEN'].includes(role) ? [{
            type: 'group',
            label: 'Restaurante',
            icon: Utensils,
            items: [
                { icon: Utensils, label: 'Mapa de Mesas', path: '/restaurant/tables' },
                { icon: ChefHat, label: 'Cocina', path: '/restaurant/kitchen' },
                { icon: Smartphone, label: 'Comandera Móvil', path: '/mobile/login' },
                ...(isAdmin ? [
                    { icon: BookOpen, label: 'Menú Digital', path: '/restaurant/menu' },
                    { icon: ClipboardList, label: 'Recetas', path: '/restaurant/recipes' },
                    { icon: Settings, label: 'Recetas Modificadores', path: '/restaurant/modifiers' },
                ] : []),
            ]
        }] : []),
        // SERVICE & LAUNDRY MODULES — ADMIN, CASHIER
        ...((effectiveModules?.services || effectiveModules?.laundry) && isAdminOrCashier ? [{
            type: 'group',
            label: effectiveModules?.services ? 'Servicios' : 'Lavandería',
            icon: effectiveModules?.services ? Wrench : Smartphone,
            items: [
                ...(effectiveModules?.services ? [
                    { icon: Wrench, label: 'Servicios', path: '/services' },
                ] : []),
                ...(effectiveModules?.laundry ? [
                    { icon: Smartphone, label: 'Tablero Lavandería', path: '/laundry' },
                ] : []),
            ]
        }] : []),
        // PHARMACY MODULE — ADMIN, CASHIER, WAREHOUSE
        ...(effectiveModules?.pharmacy ? [{
            type: 'group',
            label: 'Farmacia',
            icon: Pill,
            items: [
                { icon: LayoutDashboard, label: 'Dashboard Farmacia', path: '/pharmacy' },
                ...(isAdminOrWarehouse ? [
                    { icon: Package, label: 'Gestión de Lotes', path: '/pharmacy/lots' },
                    { icon: BookOpen, label: 'Libro de Control', path: '/pharmacy/control-log' },
                ] : []),
                { icon: FileText, label: 'Recetas', path: '/pharmacy/prescriptions' },
            ]
        }] : []),
        // BARBERSHOP MODULE — ADMIN, CASHIER
        ...(effectiveModules?.barbershop && isAdminOrCashier ? [{
            type: 'single',
            item: {
                icon: Scissors,
                label: 'Barbería / Salón',
                path: '/barbershop'
            }
        }] : []),
        {
            type: 'single',
            item: { icon: ShoppingCart, label: 'Centro de Ventas', path: '/sales-center' }
        },
        // INVENTARIO — ADMIN, WAREHOUSE
        ...(isAdminOrWarehouse ? [{
            type: 'single',
            item: { icon: Package, label: 'Centro de Inventario', path: '/inventory-center' }
        }] : []),
        // FINANZAS — filtrado por rol (no se muestra si no hay items)
        ...(finanzasItems.length > 0 ? [{
            type: 'group',
            label: 'Finanzas',
            icon: DollarSign,
            items: finanzasItems
        }] : []),
        // CONFIGURACIÓN — solo ADMIN
        ...(isAdmin ? [{
            type: 'single',
            item: { icon: Settings, label: 'Configuración', path: '/config-center' }
        }] : [])
    ];

    const [expandedGroup, setExpandedGroup] = useState(null);

    useEffect(() => {
        if (isCollapsed) return;
        menuStructure.forEach(group => {
            if (group.type === 'group') {
                const hasActiveItem = group.items.some(item => item.path === location.pathname);
                if (hasActiveItem) setExpandedGroup(group.label);
            }
        });
    }, [location.pathname, isCollapsed, menuStructure]);

    const handleLogout = () => { logout(); navigate('/login'); };

    const toggleGroup = (label) => {
        if (isCollapsed) {
            toggleSidebar();
            setTimeout(() => setExpandedGroup(label), 50);
            return;
        }
        setExpandedGroup(prev => prev === label ? null : label);
    };

    return (
        <aside className={cn(
            "bg-white border-r border-slate-200 fixed h-full transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1) shadow-[1px_0_15px_rgba(0,0,0,0.02)] inset-y-0 left-0 flex flex-col z-20",
            // Padding seguro para Notch y Barra de Inicio en móvil
            "pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]",
            isCollapsed ? "md:w-20" : "md:w-64",
            isMobileMenuOpen ? "flex w-64 translate-x-0 z-50 transition-transform duration-300" : "hidden md:flex max-md:-translate-x-full"
        )}>
            {/* Logo Area */}
            <div className="h-16 flex items-center px-6 border-b border-slate-100 bg-white relative shrink-0">
                {!isCollapsed ? (
                    <div className="flex items-center gap-3 animate-in fade-in duration-300">
                        <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
                            <span className="font-black text-lg">M</span>
                        </div>
                        <span className="font-black text-lg text-slate-900 tracking-tighter">Mi Inventario</span>
                    </div>
                ) : (
                    <div className="w-full flex justify-center">
                        <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
                            <span className="font-black text-lg">M</span>
                        </div>
                    </div>
                )}

                {/* Close Mobile */}
                {isMobileMenuOpen && (
                    <button onClick={closeMobileMenu} className="md:hidden absolute right-4 top-1/2 -translate-y-1/2 p-2 hover:bg-slate-100 rounded-lg text-slate-400">
                        <X size={20} />
                    </button>
                )}
            </div>

            {/* Desktop Collapse Button - Positioned Precisely */}
            <button
                onClick={toggleSidebar}
                className="hidden md:flex absolute -right-3 top-[68px] w-6 h-12 bg-white border-2 border-slate-200 rounded-full items-center justify-center text-slate-400 shadow-sm hover:border-indigo-500 hover:text-indigo-600 transition-all duration-300 z-30 group/collapse"
                title={isCollapsed ? "Expandir menú (→)" : "Colapsar menú (←)"}
            >
                {isCollapsed ? (
                    <ChevronRight size={16} strokeWidth={3} className="group-hover/collapse:translate-x-0.5 transition-transform" />
                ) : (
                    <ChevronLeft size={16} strokeWidth={3} className="group-hover/collapse:-translate-x-0.5 transition-transform" />
                )}
            </button>

            {/* Navigation - Scrollable Area */}
            <nav className="flex-1 overflow-y-auto px-3 py-6 space-y-1 custom-scrollbar scroll-smooth">
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
                                    "flex items-center px-4 py-3 rounded-xl text-sm transition-all relative group mb-1",
                                    isActive
                                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200"
                                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-900 font-medium",
                                    isCollapsed && "justify-center px-0 h-11"
                                )}
                                title={isCollapsed ? group.item.label : ''}
                            >
                                <group.item.icon size={20} className={cn("shrink-0", isActive ? "text-white" : "text-slate-400 group-hover:text-slate-600")} strokeWidth={isActive ? 2.5 : 2} />
                                {!isCollapsed && <span className="ml-3 font-bold">{group.item.label}</span>}
                            </Link>
                        );
                    }

                    // GROUP ITEM
                    const isExpanded = expandedGroup === group.label;
                    const hasActiveChild = group.items.some(item => item.path === location.pathname);
                    const groupId = `sidebar-group-${group.label.toLowerCase().replace(/\s+/g, '-')}`;

                    if (isCollapsed) {
                        return (
                            <div key={idx} className="flex justify-center my-1 group relative">
                                <button
                                    id={groupId}
                                    onClick={() => toggleGroup(group.label)}
                                    className={cn(
                                        "w-11 h-11 flex items-center justify-center rounded-xl transition-all",
                                        hasActiveChild ? "bg-indigo-50 text-indigo-600 shadow-sm" : "text-slate-400 hover:bg-slate-50"
                                    )}
                                    title={group.label}
                                >
                                    <group.icon size={20} />
                                </button>
                            </div>
                        );
                    }

                    return (
                        <div key={idx} className="mb-2">
                            <button
                                onClick={() => toggleGroup(group.label)}
                                id={groupId}
                                className={cn(
                                    "w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm transition-all group select-none mb-1",
                                    isExpanded ? "bg-slate-50/80 text-slate-900" : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                                )}
                            >
                                <div className="flex items-center">
                                    <group.icon size={20} className={cn("transition-colors", isExpanded || hasActiveChild ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600")} />
                                    <span className={cn("ml-3 font-bold tracking-tight", isExpanded || hasActiveChild ? "text-slate-900" : "text-slate-500")}>{group.label}</span>
                                </div>
                                <ChevronDown size={14} className={cn("transition-transform duration-300 text-slate-400", isExpanded && "rotate-180 text-indigo-600")} />
                            </button>

                            <div
                                className={cn(
                                    "overflow-hidden transition-all duration-300 ease-in-out pl-9 space-y-1 ml-4 border-l-2 border-slate-100",
                                    isExpanded ? "max-h-[500px] opacity-100 mb-2 mt-1" : "max-h-0 opacity-0"
                                )}
                            >
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
                                                "flex items-center px-4 py-2 rounded-lg text-[13px] transition-all relative group",
                                                isSubActive
                                                    ? "text-indigo-600 font-bold bg-indigo-50/50"
                                                    : "text-slate-500 font-semibold hover:text-slate-900 hover:bg-slate-50/50"
                                            )}
                                        >
                                            <span className={cn(
                                                "absolute -left-[11px] w-2 h-2 rounded-full border-2 border-white transition-all scale-75",
                                                isSubActive ? "bg-indigo-600 ring-4 ring-indigo-50 scale-100" : "bg-slate-300 group-hover:bg-slate-400"
                                            )}></span>
                                            {subItem.label}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </nav>

            {/* Footer Actions */}
            <div className="px-3 py-4 border-t border-slate-100 bg-white shrink-0 space-y-1">
                {/* Support Group */}
                {!isCollapsed && <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4 mb-2">Soporte y Guía</p>}

                <div className={cn("grid gap-1", isCollapsed ? "grid-cols-1" : "grid-cols-1")}>
                    <Link to="/support" className={cn("flex items-center px-4 py-2.5 rounded-xl text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-all font-bold text-sm relative", isCollapsed && "justify-center p-0 h-10 w-10 mx-auto")} title="Soporte Técnico">
                        <LifeBuoy size={18} />
                        {!isCollapsed && <span className="ml-3">Soporte</span>}
                        {supportUnread > 0 && (
                            <span className={cn(
                                "absolute flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-black text-white bg-rose-500 rounded-full shadow-sm animate-pulse",
                                isCollapsed ? "top-0 right-0" : "top-1 right-2"
                            )}>
                                {supportUnread > 9 ? '9+' : supportUnread}
                            </span>
                        )}
                    </Link>

                    <button
                        onClick={() => setIsTourModalOpen(true)}
                        className={cn("flex items-center px-4 py-2.5 rounded-xl text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-all font-bold text-sm", isCollapsed && "justify-center p-0 h-10 w-10 mx-auto")}
                        title="Guía de Uso"
                    >
                        <BookOpen size={18} />
                        {!isCollapsed && <span className="ml-3">Manual</span>}
                    </button>
                </div>

                <div className="pt-2">
                    <button
                        onClick={handleLogout}
                        className={cn(
                            "flex items-center px-4 py-3 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-all w-full font-bold text-sm group",
                            isCollapsed && "justify-center p-0 h-11 w-11 mx-auto"
                        )}
                        title="Cerrar Sesión"
                    >
                        <LogOut size={20} className="text-slate-400 group-hover:text-rose-500" />
                        {!isCollapsed && <span className="ml-3">Cerrar Sesión</span>}
                    </button>
                </div>
            </div>

            {/* Tour Selection Modal */}
            <TourSelectionModal
                isOpen={isTourModalOpen}
                onClose={() => setIsTourModalOpen(false)}
            />
        </aside>
    );
}
