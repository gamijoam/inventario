import { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import {
    LayoutDashboard,
    ShoppingCart,
    Package,
    Users,
    Settings,
    FileText,
    Truck,
    CreditCard,
    Briefcase,
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
    Scissors,
    Pill,
    Zap
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { useAuth } from '../../context/AuthContext';
import { useConfig } from '../../context/ConfigContext';
import { PERMISSIONS, PERMISSION_GROUPS } from '../../config/permissions';

export default function Sidebar({ isCollapsed, toggleSidebar, isMobileMenuOpen, closeMobileMenu }) {
    const location = useLocation();
    const { user, hasPermission, hasAnyPermission } = useAuth();
    const { modules, business } = useConfig();
    // En desarrollo, VITE_FORCE_ALL_MODULES=true (en .env.development) activa todos los módulos
    // para poder probarlos sin depender de los feature flags reales del backend.
    // En producción/QA la variable no existe y se usan los flags reales del tenant.
    const forceAll = import.meta.env.VITE_FORCE_ALL_MODULES === 'true';
    const effectiveModules = forceAll ? { ...modules, services: true, barbershop: true, restaurant: true, pharmacy: true } : modules;

    // Helpers de rol + permisos modulares. Mientras migramos, ADMIN conserva acceso total.
    const role = user?.role;
    const isAdmin = role === 'ADMIN';
    const canViewDashboard = isAdmin || hasPermission(PERMISSIONS.DASHBOARD_VIEW);
    const canOpenPos = isAdmin || hasAnyPermission(PERMISSION_GROUPS.POS);
    const canOpenSales = isAdmin || hasAnyPermission(PERMISSION_GROUPS.SALES) || canOpenPos;
    const canOpenInventory = isAdmin || hasAnyPermission(PERMISSION_GROUPS.INVENTORY);
    const canOpenPurchases = isAdmin || hasAnyPermission(PERMISSION_GROUPS.PURCHASES);
    const canOpenSuppliers = isAdmin || hasPermission(PERMISSIONS.PURCHASES_SUPPLIERS_MANAGE);
    const canOpenReports = isAdmin || hasAnyPermission(PERMISSION_GROUPS.REPORTS);
    const canOpenCashRegisters = isAdmin || hasAnyPermission([PERMISSIONS.CASH_AUDIT_VIEW, PERMISSIONS.CASH_FORCE_CLOSE]);
    const canOpenConfig = isAdmin || hasAnyPermission(PERMISSION_GROUPS.CONFIG);
    const canManageRestaurant = isAdmin || hasPermission(PERMISSIONS.RESTAURANT_ORDERS_MANAGE);
    const canViewKitchen = isAdmin || hasPermission(PERMISSIONS.RESTAURANT_KITCHEN_VIEW);
    const canOpenServices = isAdmin || hasPermission(PERMISSIONS.SERVICES_ORDERS_MANAGE);
    const canOpenOrgPanel = Boolean((isAdmin || hasPermission(PERMISSIONS.ORG_PANEL_VIEW)) && (user?.is_superuser || user?.is_org_owner || user?.org_role));

    // Finanzas: items filtrados por permisos (si quedan 0 items, el grupo no aparece)
    const finanzasItems = [
        ...(canOpenPurchases ? [
            { icon: Briefcase, label: 'Compras', path: '/purchases' },
        ] : []),
        ...(canOpenSuppliers ? [
            { icon: Truck, label: 'Proveedores', path: '/suppliers' },
        ] : []),
        ...(canOpenReports ? [
            { icon: BarChart2, label: 'Centro de Reportes', path: '/reports' },
        ] : []),
        ...(canOpenCashRegisters ? [
            { icon: LayoutGrid, label: 'Gestión de Cajas', path: '/cash-registers' },
        ] : []),
    ];

    const menuStructure = [
        ...(canViewDashboard ? [{
            type: 'single',
            item: { icon: LayoutDashboard, label: 'Resumen', path: '/' }
        }] : []),
        // RESTAURANT MODULE — ADMIN, CASHIER, WAITER, KITCHEN
        ...(effectiveModules?.restaurant && (canManageRestaurant || canViewKitchen) ? [{
            type: role === 'WAITER' ? 'single' : 'group',
            ...(role === 'WAITER' ? {
                item: { icon: Smartphone, label: 'Comandera', path: '/waiter' }
            } : {
                label: 'Restaurante',
                icon: Utensils,
                items: [
                    ...(canManageRestaurant ? [{ icon: Utensils, label: 'Mapa de Mesas', path: '/restaurant/tables' }] : []),
                    ...(canViewKitchen ? [{ icon: ChefHat, label: 'Cocina', path: '/restaurant/kitchen' }] : []),
                    ...(canManageRestaurant ? [{ icon: Smartphone, label: 'Comandera', path: '/waiter' }] : []),
                    ...(canManageRestaurant ? [
                        { icon: BookOpen, label: 'Menú Digital', path: '/restaurant/menu' },
                        { icon: ClipboardList, label: 'Recetas', path: '/restaurant/recipes' },
                        { icon: Settings, label: 'Recetas Modificadores', path: '/restaurant/modifiers' },
                    ] : []),
                ]
            })
        }] : []),
        // SERVICE & LAUNDRY MODULES — ADMIN, CASHIER
        ...((effectiveModules?.services || effectiveModules?.laundry) && canOpenServices ? [{
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
                ...(canOpenInventory ? [
                    { icon: Package, label: 'Gestión de Lotes', path: '/pharmacy/lots' },
                    { icon: BookOpen, label: 'Libro de Control', path: '/pharmacy/control-log' },
                ] : []),
                { icon: FileText, label: 'Recetas', path: '/pharmacy/prescriptions' },
            ]
        }] : []),
        // BARBERSHOP MODULE — ADMIN, CASHIER
        ...(effectiveModules?.barbershop && canOpenServices ? [{
            type: 'single',
            item: {
                icon: Scissors,
                label: 'Barbería / Salón',
                path: '/barbershop'
            }
        }] : []),
        ...(canOpenSales ? [{
            type: 'single',
            item: { icon: ShoppingCart, label: 'Centro de Ventas', path: '/sales-center', prefetch: ['/api/v1/products/catalog', '/api/v1/categories', '/api/v1/warehouses'] }
        }] : []),
        // INVENTARIO — ADMIN, WAREHOUSE
        ...(canOpenInventory ? [{
            type: 'single',
            item: { icon: Package, label: 'Centro de Inventario', path: '/inventory-center' }
        }] : []),
        // POS EXPRESS — oculto temporalmente
        // ...(isAdminOrCashier ? [{
        //     type: 'single',
        //     item: { icon: Zap, label: 'POS Express ⚡', path: '/pos-express' }
        // }] : []),
        // FINANZAS — filtrado por rol (no se muestra si no hay items)
        ...(finanzasItems.length > 0 ? [{
            type: 'group',
            label: 'Finanzas',
            icon: DollarSign,
            items: finanzasItems
        }] : []),
        // CONFIGURACIÓN — solo ADMIN
        ...(canOpenConfig ? [{
            type: 'single',
            item: { icon: Settings, label: 'Configuración', path: '/config-center' }
        }] : []),
        ...(canOpenOrgPanel ? [{
            type: 'single',
            item: { icon: Briefcase, label: 'Panel Empresarial', path: '/owner' }
        }] : []),
    ];

    const [expandedGroup, setExpandedGroup] = useState(null);

    const getMenuSection = (group) => {
        const label = group.type === 'single' ? group.item.label : group.label;
        const normalizedLabel = label.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (normalizedLabel === 'Resumen' || normalizedLabel === 'Centro de Ventas' || ['Restaurante', 'Servicios', 'Lavanderia', 'Farmacia', 'Barberia / Salon', 'Comandera'].includes(normalizedLabel)) {
            return 'Operaci\u00f3n';
        }
        if (normalizedLabel === 'Centro de Inventario') return 'Inventario';
        if (normalizedLabel === 'Finanzas') return 'Finanzas';
        if (normalizedLabel === 'Configuracion' || normalizedLabel === 'Panel Empresarial') return 'Administraci\u00f3n';
        return 'M\u00f3dulos';
    };

    const renderSectionMarker = (section, idx) => {
        if (!section) return null;
        if (isCollapsed) {
            return idx === 0 ? null : <div className="mx-auto my-2 h-px w-8 bg-slate-100" />;
        }
        return (
            <div className={cn("px-4 pb-1 pt-4 text-[10px] font-black uppercase tracking-widest text-slate-400", idx === 0 && "pt-0")}>
                {section}
            </div>
        );
    };

    const getTourIdForItem = (label) => {
        const normalized = label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        if (normalized === 'resumen') return 'sidebar-dashboard';
        if (normalized === 'centro de ventas') return 'sidebar-group-ventas';
        if (normalized === 'centro de inventario') return 'sidebar-group-inventario';
        if (normalized === 'configuracion') return 'sidebar-group-sistema';
        return undefined;
    };

    const CollapsedTooltip = ({ label }) => (
        <span className="pointer-events-none absolute left-[58px] top-1/2 z-50 hidden -translate-y-1/2 whitespace-nowrap rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 opacity-0 shadow-lg shadow-slate-200/70 transition-opacity group-hover:block group-hover:opacity-100">
            {label}
        </span>
    );

    useEffect(() => {
        if (isCollapsed) return;
        menuStructure.forEach(group => {
            if (group.type === 'group') {
                const hasActiveItem = group.items.some(item => item.path === location.pathname);
                if (hasActiveItem) setExpandedGroup(group.label);
            }
        });
    }, [location.pathname, isCollapsed, menuStructure]);


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
            "bg-white border-r border-slate-200 fixed h-full transition-all duration-300 ease-in-out shadow-sm inset-y-0 left-0 flex flex-col z-20",
            // Padding seguro para Notch y Barra de Inicio en móvil
            "pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]",
            isCollapsed ? "md:w-20" : "md:w-64",
            isMobileMenuOpen ? "flex w-64 translate-x-0 z-50 transition-transform duration-300" : "hidden md:flex max-md:-translate-x-full"
        )}>
            {/* Logo Area */}
            <div className="h-16 flex items-center px-6 border-b border-slate-100 bg-white relative shrink-0">
                {!isCollapsed ? (
                    <div className="flex items-center gap-3 animate-in fade-in duration-300">
                        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-sm shadow-indigo-100">
                            <span className="font-black text-lg">M</span>
                        </div>
                        <span className="font-black text-lg text-slate-900 tracking-tighter">Mi Inventario</span>
                    </div>
                ) : (
                    <div className="w-full flex justify-center">
                        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-sm shadow-indigo-100">
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
                className="hidden md:flex absolute -right-3 top-[68px] w-6 h-12 bg-white border-2 border-slate-200 rounded-lg items-center justify-center text-slate-400 shadow-sm hover:border-indigo-500 hover:text-indigo-600 transition-colors duration-200 z-30 group/collapse"
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
                    const section = getMenuSection(group);
                    const previousSection = idx > 0 ? getMenuSection(menuStructure[idx - 1]) : null;
                    const sectionMarker = section !== previousSection ? renderSectionMarker(section, idx) : null;

                    // SINGLE ITEM
                    if (group.type === 'single') {
                        const isActive = location.pathname === group.item.path;
                        return (
                            <div key={`nav-${group.item.path}`}>
                                {sectionMarker}
                                <div className={cn("relative", isCollapsed && "group")}>
                                    <Link
                                        to={group.item.path}
                                        id={getTourIdForItem(group.item.label)}
                                        onClick={closeMobileMenu}
                                        className={cn(
                                            "flex items-center px-4 py-3 rounded-lg text-sm transition-colors relative mb-1",
                                            isActive
                                                ? "bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-100"
                                                : "text-slate-500 hover:bg-slate-50 hover:text-slate-900 font-medium",
                                            isCollapsed && "justify-center px-0 h-11"
                                        )}
                                        title={isCollapsed ? group.item.label : ''}
                                    >
                                        <group.item.icon size={20} className={cn("shrink-0", isActive ? "text-indigo-600" : "text-slate-400")} strokeWidth={isActive ? 2.4 : 2} />
                                        {!isCollapsed && <span className="ml-3 font-bold">{group.item.label}</span>}
                                    </Link>
                                    {isCollapsed && <CollapsedTooltip label={group.item.label} />}
                                </div>
                            </div>
                        );
                    }

                    // GROUP ITEM
                    const isExpanded = expandedGroup === group.label;
                    const hasActiveChild = group.items.some(item => item.path === location.pathname);
                    const groupId = `sidebar-group-${group.label.toLowerCase().replace(/\s+/g, '-')}`;

                    if (isCollapsed) {
                        return (
                            <div key={`nav-${group.label}`} className="group relative">
                                {sectionMarker}
                                <div className="flex justify-center my-1">
                                    <button
                                        id={groupId}
                                        onClick={() => toggleGroup(group.label)}
                                        className={cn(
                                            "w-11 h-11 flex items-center justify-center rounded-lg transition-colors",
                                            hasActiveChild ? "bg-indigo-50 text-indigo-600 shadow-sm ring-1 ring-indigo-100" : "text-slate-400 hover:bg-slate-50"
                                        )}
                                        title={group.label}
                                    >
                                        <group.icon size={20} />
                                    </button>
                                    <CollapsedTooltip label={group.label} />
                                </div>
                            </div>
                        );
                    }

                    return (
                        <div key={`nav-${group.label}`} className="mb-2">
                            {sectionMarker}
                            <button
                                onClick={() => toggleGroup(group.label)}
                                id={groupId}
                                className={cn(
                                    "w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm transition-colors group select-none mb-1",
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
                                                "flex items-center px-4 py-2 rounded-md text-[13px] transition-colors relative group",
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

        </aside>
    );
}
