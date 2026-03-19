import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import {
    LayoutDashboard,
    Building2,
    LogOut,
    Megaphone,
    LifeBuoy,
    CheckSquare,
    HardDrive,
    Key,
    Activity,
    ChevronLeft,
    ChevronRight,
    Menu,
    X,
    Zap,
    ChevronRight as BreadcrumbSeparator,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getPendingCount } from '../api/support';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface NavItem {
    name: string;
    href: string;
    icon: React.ElementType;
    badge?: number;
    group?: string;
}

// ---------------------------------------------------------------------------
// Tooltip component (shown when sidebar is collapsed)
// ---------------------------------------------------------------------------
interface TooltipProps {
    label: string;
    children: React.ReactNode;
    visible: boolean;
}

const SidebarTooltip: React.FC<TooltipProps> = ({ label, children, visible }) => {
    const [show, setShow] = useState(false);

    if (!visible) return <>{children}</>;

    return (
        <div
            className="relative flex items-center"
            onMouseEnter={() => setShow(true)}
            onMouseLeave={() => setShow(false)}
        >
            {children}
            {show && (
                <div
                    className="absolute left-full ml-3 z-50 px-3 py-1.5 text-xs font-semibold
                                text-slate-100 bg-slate-800 border border-slate-700
                                rounded-lg shadow-xl whitespace-nowrap pointer-events-none"
                    style={{ top: '50%', transform: 'translateY(-50%)' }}
                >
                    {label}
                    {/* Arrow */}
                    <div
                        className="absolute right-full top-1/2 -translate-y-1/2
                                    border-4 border-transparent border-r-slate-700"
                    />
                </div>
            )}
        </div>
    );
};

// ---------------------------------------------------------------------------
// Nav groups
// ---------------------------------------------------------------------------
const NAV_GROUPS: { label: string; items: Omit<NavItem, 'badge'>[] }[] = [
    {
        label: 'Principal',
        items: [
            { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, group: 'principal' },
            { name: 'Empresas', href: '/dashboard/tenants', icon: Building2, group: 'principal' },
            { name: 'Licencias', href: '/dashboard/licenses', icon: Key, group: 'principal' },
        ],
    },
    {
        label: 'Soporte',
        items: [
            { name: 'Mesa de Ayuda', href: '/dashboard/support', icon: LifeBuoy, group: 'soporte' },
            { name: 'Recordatorios', href: '/dashboard/reminders', icon: CheckSquare, group: 'soporte' },
            { name: 'Mensajes', href: '/dashboard/messages', icon: Megaphone, group: 'soporte' },
        ],
    },
    {
        label: 'Sistema',
        items: [
            { name: 'Actividad', href: '/dashboard/activity', icon: Activity, group: 'sistema' },
            { name: 'Respaldos', href: '/dashboard/backups', icon: HardDrive, group: 'sistema' },
        ],
    },
];

// ---------------------------------------------------------------------------
// Breadcrumb helper
// ---------------------------------------------------------------------------
const ROUTE_LABELS: Record<string, string> = {
    '/dashboard': 'Dashboard',
    '/dashboard/tenants': 'Empresas',
    '/dashboard/licenses': 'Licencias',
    '/dashboard/support': 'Mesa de Ayuda',
    '/dashboard/reminders': 'Recordatorios',
    '/dashboard/messages': 'Mensajes',
    '/dashboard/activity': 'Actividad',
    '/dashboard/backups': 'Respaldos',
};

function useBreadcrumb(pathname: string): string[] {
    const label = Object.entries(ROUTE_LABELS).find(([route]) =>
        route === pathname || (route !== '/dashboard' && pathname.startsWith(route))
    )?.[1];
    if (!label || label === 'Dashboard') return ['Dashboard'];
    return ['Dashboard', label];
}

// ---------------------------------------------------------------------------
// Main Layout
// ---------------------------------------------------------------------------
const DashboardLayout: React.FC = () => {
    const { logout, user } = useAuth();
    const location = useLocation();

    // Sidebar state
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [pendingTickets, setPendingTickets] = useState(0);

    const overlayRef = useRef<HTMLDivElement>(null);

    // Close mobile sidebar on route change
    useEffect(() => {
        setMobileOpen(false);
    }, [location.pathname]);

    // Pending tickets polling
    const fetchPendingCount = useCallback(async () => {
        try {
            const count = await getPendingCount();
            setPendingTickets(count);
        } catch {
            // Silently ignore
        }
    }, []);

    useEffect(() => {
        fetchPendingCount();
        const interval = setInterval(fetchPendingCount, 60000);
        return () => clearInterval(interval);
    }, [fetchPendingCount]);

    useEffect(() => {
        if (!location.pathname.includes('/support')) {
            fetchPendingCount();
        }
    }, [location.pathname, fetchPendingCount]);

    const isActive = (href: string): boolean => {
        if (href === '/dashboard' && location.pathname === '/dashboard') return true;
        if (href !== '/dashboard' && location.pathname.startsWith(href)) return true;
        return false;
    };

    const breadcrumbs = useBreadcrumb(location.pathname);

    // User initials
    const initials = user?.username?.substring(0, 2).toUpperCase() ?? 'AD';

    // Sidebar width classes
    const sidebarWidth = collapsed ? 'w-16' : 'w-64';

    // ---------------------------------------------------------------------------
    // Sidebar content (shared between desktop and mobile)
    // ---------------------------------------------------------------------------
    const SidebarContent = () => (
        <div className="flex flex-col h-full">
            {/* Logo / Brand */}
            <div
                className={`flex items-center border-b border-slate-800 shrink-0
                            ${collapsed ? 'justify-center px-0 py-5' : 'px-5 py-5 gap-3'}`}
            >
                <div
                    className="flex items-center justify-center w-9 h-9 rounded-xl
                                bg-emerald-500/15 border border-emerald-500/30 shrink-0"
                >
                    <Zap className="w-4 h-4 text-emerald-400" strokeWidth={2.5} />
                </div>
                {!collapsed && (
                    <div className="overflow-hidden">
                        <p className="text-sm font-bold text-slate-100 leading-tight tracking-tight">
                            Invensoft Admin
                        </p>
                        <p className="text-[10px] text-slate-500 font-medium tracking-widest uppercase">
                            Control Global
                        </p>
                    </div>
                )}
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-6 scrollbar-thin">
                {NAV_GROUPS.map((group) => (
                    <div key={group.label}>
                        {/* Group label */}
                        {!collapsed && (
                            <p className="px-3 mb-1.5 text-[10px] font-semibold tracking-widest uppercase text-slate-600 select-none">
                                {group.label}
                            </p>
                        )}
                        {collapsed && (
                            <div className="flex justify-center mb-1.5">
                                <div className="w-4 h-px bg-slate-800" />
                            </div>
                        )}

                        <ul className="space-y-0.5">
                            {group.items.map((item) => {
                                const badge =
                                    item.href === '/dashboard/support' ? pendingTickets : 0;
                                const active = isActive(item.href);
                                const Icon = item.icon;

                                const linkContent = (
                                    <Link
                                        to={item.href}
                                        className={`relative flex items-center rounded-lg text-sm font-medium
                                                    transition-all duration-200 group overflow-hidden
                                                    ${collapsed
                                                ? 'justify-center w-10 h-10 mx-auto'
                                                : 'px-3 py-2.5 gap-3'
                                            }
                                                    ${active
                                                ? 'bg-emerald-500/10 text-emerald-400'
                                                : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
                                            }`}
                                    >
                                        {/* Active bar */}
                                        {active && !collapsed && (
                                            <span
                                                className="absolute left-0 top-1/2 -translate-y-1/2
                                                            w-[3px] h-5 bg-emerald-500 rounded-r-full"
                                            />
                                        )}

                                        <Icon
                                            className={`shrink-0 transition-colors duration-200
                                                        ${collapsed ? 'w-5 h-5' : 'w-4 h-4'}
                                                        ${active
                                                    ? 'text-emerald-400'
                                                    : 'text-slate-500 group-hover:text-slate-300'
                                                }`}
                                            strokeWidth={active ? 2.2 : 1.8}
                                        />

                                        {!collapsed && (
                                            <span className="flex-1 truncate">{item.name}</span>
                                        )}

                                        {/* Badge — expanded mode */}
                                        {!collapsed && badge > 0 && (
                                            <span
                                                className="ml-auto flex items-center justify-center min-w-[20px] h-5
                                                            px-1.5 text-[10px] font-bold text-white bg-rose-500
                                                            rounded-full animate-pulse"
                                            >
                                                {badge > 99 ? '99+' : badge}
                                            </span>
                                        )}

                                        {/* Badge — collapsed mode (dot) */}
                                        {collapsed && badge > 0 && (
                                            <span
                                                className="absolute top-1 right-1 w-2 h-2 rounded-full
                                                            bg-rose-500 animate-pulse"
                                            />
                                        )}
                                    </Link>
                                );

                                return (
                                    <li key={item.name}>
                                        <SidebarTooltip label={item.name} visible={collapsed}>
                                            {linkContent}
                                        </SidebarTooltip>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                ))}
            </nav>

            {/* User profile + logout */}
            <div className="shrink-0 border-t border-slate-800 p-3 space-y-2">
                <div
                    className={`flex items-center rounded-lg p-2 gap-3
                                ${collapsed ? 'justify-center' : ''}`}
                >
                    <div
                        className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600
                                    flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                    >
                        {initials}
                    </div>
                    {!collapsed && (
                        <div className="overflow-hidden flex-1">
                            <p className="text-sm font-semibold text-slate-200 truncate leading-tight">
                                {user?.username}
                            </p>
                            <p className="text-[10px] text-slate-500 truncate">
                                {user?.email ?? 'Super Admin'}
                            </p>
                        </div>
                    )}
                </div>

                <SidebarTooltip label="Cerrar Sesión" visible={collapsed}>
                    <button
                        onClick={logout}
                        className={`w-full flex items-center rounded-lg text-sm font-medium
                                    text-red-400/80 hover:text-red-300 hover:bg-red-500/10
                                    transition-all duration-200 group
                                    ${collapsed
                                ? 'justify-center py-2.5'
                                : 'px-3 py-2 gap-3'
                            }`}
                    >
                        <LogOut
                            className="w-4 h-4 shrink-0 transition-colors"
                            strokeWidth={1.8}
                        />
                        {!collapsed && <span>Cerrar Sesión</span>}
                    </button>
                </SidebarTooltip>
            </div>

            {/* Collapse toggle (desktop only) */}
            <div className="shrink-0 hidden md:flex justify-end border-t border-slate-800/60 px-3 py-2">
                <button
                    onClick={() => setCollapsed((v) => !v)}
                    className="flex items-center justify-center w-7 h-7 rounded-md
                                text-slate-600 hover:text-slate-300 hover:bg-slate-800
                                transition-all duration-200"
                    aria-label={collapsed ? 'Expandir sidebar' : 'Contraer sidebar'}
                >
                    {collapsed ? (
                        <ChevronRight className="w-4 h-4" strokeWidth={2} />
                    ) : (
                        <ChevronLeft className="w-4 h-4" strokeWidth={2} />
                    )}
                </button>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-950 flex" style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>

            {/* ---------------------------------------------------------------- */}
            {/* DESKTOP SIDEBAR                                                  */}
            {/* ---------------------------------------------------------------- */}
            <aside
                className={`hidden md:flex flex-col fixed top-0 left-0 h-full z-20
                            bg-slate-950 border-r border-slate-800
                            transition-all duration-300 ease-in-out
                            ${sidebarWidth}`}
            >
                <SidebarContent />
            </aside>

            {/* ---------------------------------------------------------------- */}
            {/* MOBILE SIDEBAR OVERLAY                                           */}
            {/* ---------------------------------------------------------------- */}
            {mobileOpen && (
                <div
                    ref={overlayRef}
                    className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden"
                    onClick={() => setMobileOpen(false)}
                />
            )}

            {/* MOBILE SIDEBAR DRAWER */}
            <aside
                className={`fixed top-0 left-0 h-full z-40 w-64
                            bg-slate-950 border-r border-slate-800
                            flex flex-col md:hidden
                            transition-transform duration-300 ease-in-out
                            ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
            >
                {/* Mobile close button */}
                <button
                    onClick={() => setMobileOpen(false)}
                    className="absolute top-4 right-4 z-50 flex items-center justify-center
                                w-7 h-7 rounded-md text-slate-500 hover:text-slate-200
                                hover:bg-slate-800 transition-all duration-200"
                    aria-label="Cerrar menú"
                >
                    <X className="w-4 h-4" strokeWidth={2} />
                </button>
                {/* Reuse sidebar content but never collapsed on mobile */}
                <div className="flex flex-col h-full">
                    {/* Logo */}
                    <div className="flex items-center border-b border-slate-800 px-5 py-5 gap-3 shrink-0">
                        <div
                            className="flex items-center justify-center w-9 h-9 rounded-xl
                                        bg-emerald-500/15 border border-emerald-500/30 shrink-0"
                        >
                            <Zap className="w-4 h-4 text-emerald-400" strokeWidth={2.5} />
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-sm font-bold text-slate-100 leading-tight tracking-tight">
                                Invensoft Admin
                            </p>
                            <p className="text-[10px] text-slate-500 font-medium tracking-widest uppercase">
                                Control Global
                            </p>
                        </div>
                    </div>

                    {/* Nav */}
                    <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-6">
                        {NAV_GROUPS.map((group) => (
                            <div key={group.label}>
                                <p className="px-3 mb-1.5 text-[10px] font-semibold tracking-widest uppercase text-slate-600 select-none">
                                    {group.label}
                                </p>
                                <ul className="space-y-0.5">
                                    {group.items.map((item) => {
                                        const badge =
                                            item.href === '/dashboard/support' ? pendingTickets : 0;
                                        const active = isActive(item.href);
                                        const Icon = item.icon;
                                        return (
                                            <li key={item.name}>
                                                <Link
                                                    to={item.href}
                                                    className={`relative flex items-center rounded-lg text-sm
                                                                font-medium transition-all duration-200 px-3 py-2.5 gap-3
                                                                ${active
                                                            ? 'bg-emerald-500/10 text-emerald-400'
                                                            : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
                                                        }`}
                                                >
                                                    {active && (
                                                        <span
                                                            className="absolute left-0 top-1/2 -translate-y-1/2
                                                                        w-[3px] h-5 bg-emerald-500 rounded-r-full"
                                                        />
                                                    )}
                                                    <Icon
                                                        className={`w-4 h-4 shrink-0 ${active ? 'text-emerald-400' : 'text-slate-500'}`}
                                                        strokeWidth={active ? 2.2 : 1.8}
                                                    />
                                                    <span className="flex-1 truncate">{item.name}</span>
                                                    {badge > 0 && (
                                                        <span
                                                            className="ml-auto flex items-center justify-center min-w-[20px] h-5
                                                                        px-1.5 text-[10px] font-bold text-white bg-rose-500
                                                                        rounded-full animate-pulse"
                                                        >
                                                            {badge > 99 ? '99+' : badge}
                                                        </span>
                                                    )}
                                                </Link>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        ))}
                    </nav>

                    {/* Profile + logout */}
                    <div className="shrink-0 border-t border-slate-800 p-3 space-y-2">
                        <div className="flex items-center rounded-lg p-2 gap-3">
                            <div
                                className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600
                                            flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                            >
                                {initials}
                            </div>
                            <div className="overflow-hidden flex-1">
                                <p className="text-sm font-semibold text-slate-200 truncate leading-tight">
                                    {user?.username}
                                </p>
                                <p className="text-[10px] text-slate-500 truncate">
                                    {user?.email ?? 'Super Admin'}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={logout}
                            className="w-full flex items-center px-3 py-2 gap-3 rounded-lg text-sm
                                        font-medium text-red-400/80 hover:text-red-300 hover:bg-red-500/10
                                        transition-all duration-200"
                        >
                            <LogOut className="w-4 h-4 shrink-0" strokeWidth={1.8} />
                            <span>Cerrar Sesión</span>
                        </button>
                    </div>
                </div>
            </aside>

            {/* ---------------------------------------------------------------- */}
            {/* MAIN CONTENT AREA                                                */}
            {/* ---------------------------------------------------------------- */}
            <div
                className={`flex-1 flex flex-col min-h-screen
                            transition-all duration-300 ease-in-out
                            ${collapsed ? 'md:ml-16' : 'md:ml-64'}`}
            >
                {/* Top Header */}
                <header
                    className="sticky top-0 z-10 flex items-center justify-between
                                bg-slate-950/80 backdrop-blur-md border-b border-slate-800/60
                                px-5 h-14 shrink-0"
                >
                    {/* Left: hamburger (mobile) + breadcrumb */}
                    <div className="flex items-center gap-3">
                        {/* Hamburger — mobile only */}
                        <button
                            className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg
                                        text-slate-400 hover:text-slate-200 hover:bg-slate-800
                                        transition-all duration-200"
                            onClick={() => setMobileOpen(true)}
                            aria-label="Abrir menú"
                        >
                            <Menu className="w-5 h-5" strokeWidth={1.8} />
                        </button>

                        {/* Breadcrumb */}
                        <nav className="flex items-center gap-1.5" aria-label="Breadcrumb">
                            {breadcrumbs.map((crumb, idx) => (
                                <React.Fragment key={crumb}>
                                    {idx > 0 && (
                                        <BreadcrumbSeparator
                                            className="w-3 h-3 text-slate-700 shrink-0"
                                            strokeWidth={2}
                                        />
                                    )}
                                    <span
                                        className={`text-sm font-medium ${idx === breadcrumbs.length - 1
                                            ? 'text-slate-200'
                                            : 'text-slate-600'
                                            }`}
                                    >
                                        {crumb}
                                    </span>
                                </React.Fragment>
                            ))}
                        </nav>
                    </div>

                    {/* Right: user avatar */}
                    <div className="flex items-center gap-3">
                        <div className="hidden sm:flex flex-col items-end">
                            <p className="text-xs font-semibold text-slate-300 leading-tight">
                                {user?.username}
                            </p>
                            <p className="text-[10px] text-slate-600">Super Admin</p>
                        </div>
                        <div
                            className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600
                                        flex items-center justify-center text-[11px] font-bold text-white
                                        ring-2 ring-emerald-500/20 shrink-0"
                        >
                            {initials}
                        </div>
                    </div>
                </header>

                {/* Page content */}
                <main className="flex-1 p-6 md:p-8 bg-white">
                    <div className="max-w-7xl mx-auto">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
};

export default DashboardLayout;
