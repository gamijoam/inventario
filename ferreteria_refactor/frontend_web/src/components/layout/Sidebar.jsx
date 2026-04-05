import { useState, useEffect, useCallback } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import {
    Building2, LayoutDashboard, ShoppingCart, Package, Users, Settings, LogOut,
    FileText, Truck, CreditCard, Briefcase, Monitor, LayoutGrid,
    ChevronLeft, ChevronRight, ChevronDown, BarChart2, BookOpen,
    ClipboardList, DollarSign, Utensils, ChefHat, Smartphone, Wrench,
    X, LifeBuoy, Scissors, Pill, HelpCircle
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { useAuth } from '../../context/AuthContext';
import { useConfig } from '../../context/ConfigContext';
import { useAppTour } from '../../hooks/useAppTour';
import TourSelectionModal from '../common/TourSelectionModal';
import supportService from '../../services/supportService';

/* ── Nav Item simple ──────────────────────────────────────────────────────── */
const NavItem = ({ icon: Icon, label, path, isCollapsed, onClick, badge }) => {
    const location = useLocation();
    const isActive = path === '/'
        ? location.pathname === '/'
        : location.pathname.startsWith(path.split('?')[0]);

    return (
        <Link to={path} onClick={onClick} title={isCollapsed ? label : undefined}
            className={cn(
                'group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all relative',
                isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800',
                isCollapsed && 'justify-center px-0'
            )}>
            <Icon size={18} strokeWidth={isActive ? 2.5 : 2}
                className={cn('shrink-0', isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-600')} />
            {!isCollapsed && <span className="truncate">{label}</span>}
            {badge > 0 && (
                <span className={cn(
                    'absolute flex items-center justify-center min-w-[16px] h-4 px-1 text-[9px] font-black text-white bg-rose-500 rounded-full',
                    isCollapsed ? 'top-0 right-0' : 'top-1.5 right-2'
                )}>{badge > 9 ? '9+' : badge}</span>
            )}
        </Link>
    );
};

/* ── Grupo colapsable ─────────────────────────────────────────────────────── */
const NavGroup = ({ icon: Icon, label, items, isCollapsed, onNavigate, defaultOpen = false }) => {
    const location = useLocation();
    const hasActive = items.some(i => location.pathname.startsWith(i.path.split('?')[0]));
    const [open, setOpen] = useState(defaultOpen || hasActive);

    useEffect(() => { if (hasActive) setOpen(true); }, [location.pathname]);

    if (isCollapsed) {
        return (
            <div className="flex justify-center">
                <button title={label} className={cn('w-10 h-10 flex items-center justify-center rounded-xl transition-all',
                    hasActive ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600')}>
                    <Icon size={18} />
                </button>
            </div>
        );
    }

    return (
        <div>
            <button onClick={() => setOpen(o => !o)}
                className={cn('w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all group',
                    hasActive ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50')}>
                <div className="flex items-center gap-3">
                    <Icon size={18} strokeWidth={2} className={cn('shrink-0', hasActive ? 'text-indigo-500' : 'text-slate-400 group-hover:text-slate-600')} />
                    <span className="font-semibold">{label}</span>
                </div>
                <ChevronDown size={14} className={cn('text-slate-400 transition-transform duration-200', open && 'rotate-180')} />
            </button>

            <div className={cn('overflow-hidden transition-all duration-200', open ? 'max-h-96 mt-0.5' : 'max-h-0')}>
                <div className="ml-4 pl-3 border-l-2 border-slate-100 space-y-0.5 py-1">
                    {items.map(item => {
                        const active = location.pathname.startsWith(item.path.split('?')[0]);
                        return (
                            <Link key={item.path} to={item.path} onClick={onNavigate}
                                className={cn('flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-semibold transition-all',
                                    active ? 'text-indigo-600 bg-indigo-50/70' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50')}>
                                <item.icon size={15} className={active ? 'text-indigo-500' : 'text-slate-400'} />
                                {item.label}
                            </Link>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

/* ── Separador con label ──────────────────────────────────────────────────── */
const SectionLabel = ({ label, isCollapsed }) => (
    !isCollapsed
        ? <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-3 pt-4 pb-1">{label}</p>
        : <div className="my-2 mx-3 h-px bg-slate-100" />
);

/* ── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────── */
import CompanySwitcher from './CompanySwitcher';

export default function Sidebar({ isCollapsed, toggleSidebar, isMobileMenuOpen, closeMobileMenu }) {
    const navigate    = useNavigate();
    const { logout, user } = useAuth();
    const { modules, business } = useConfig();
    const [isTourModalOpen, setIsTourModalOpen] = useState(false);
    const [supportUnread, setSupportUnread] = useState(0);

    const fetchUnreadCount = useCallback(async () => {
        try { setSupportUnread(await supportService.getUnreadCount()); } catch {}
    }, []);

    const location = useLocation();

    useEffect(() => {
        fetchUnreadCount();
        const t = setInterval(fetchUnreadCount, 60000);
        return () => clearInterval(t);
    }, [fetchUnreadCount]);

    useEffect(() => {
        if (location.pathname === '/support') { supportService.markAsRead(); setSupportUnread(0); }
    }, [location.pathname]);

    const forceAll = import.meta.env.VITE_FORCE_ALL_MODULES === 'true';
    const eff = forceAll ? { ...modules, services: true, barbershop: true, restaurant: true, pharmacy: true } : modules;

    const role            = user?.role;
    const isAdmin         = role === 'ADMIN';
    const currentSchema   = localStorage.getItem('selected_tenant') || '';
    const isAdminOrWH     = ['ADMIN', 'WAREHOUSE'].includes(role);
    const isAdminOrCashier = ['ADMIN', 'CASHIER'].includes(role);

    const close = () => closeMobileMenu?.();
    const handleLogout = () => { logout(); navigate('/login'); };

    return (
        <aside className={cn(
            'bg-white border-r border-slate-200 fixed inset-y-0 left-0 flex flex-col z-20 shadow-[1px_0_12px_rgba(0,0,0,0.03)]',
            'pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]',
            'transition-all duration-300',
            isCollapsed ? 'md:w-[68px]' : 'md:w-60',
            isMobileMenuOpen ? 'flex w-60 translate-x-0 z-50' : 'hidden md:flex'
        )}>

            {/* ── Logo ── */}
            <div className="h-16 flex items-center px-4 border-b border-slate-100 shrink-0 relative">
                {!isCollapsed ? (
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-indigo-200 shrink-0">
                            <span className="font-black text-sm">MI</span>
                        </div>
                        <div className="min-w-0">
                            <p className="font-black text-sm text-slate-900 truncate leading-none">
                                {business?.name || 'Mi Inventario'}
                            </p>
                            <p className="text-[10px] text-slate-400 font-medium mt-0.5">Sistema de gestión</p>
                        </div>
                    </div>
                ) : (
                    <div className="w-full flex justify-center">
                        <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-indigo-200">
                            <span className="font-black text-sm">MI</span>
                        </div>
                    </div>
                )}
                {isMobileMenuOpen && (
                    <button onClick={close} className="md:hidden absolute right-3 top-1/2 -translate-y-1/2 p-1.5 hover:bg-slate-100 rounded-lg text-slate-400">
                        <X size={18} />
                    </button>
                )}
            </div>

            {/* ── Botón colapsar (desktop) ── */}
            <button onClick={toggleSidebar}
                className="hidden md:flex absolute -right-3 top-[68px] w-6 h-10 bg-white border-2 border-slate-200 rounded-full items-center justify-center text-slate-400 shadow-sm hover:border-indigo-400 hover:text-indigo-600 transition-all z-30">
                {isCollapsed ? <ChevronRight size={14} strokeWidth={3} /> : <ChevronLeft size={14} strokeWidth={3} />}
            </button>

            {/* ── Navegación ── */}
            <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">

                {/* Principal */}
                <SectionLabel label="Principal" isCollapsed={isCollapsed} />
                <CompanySwitcher isCollapsed={isCollapsed} currentSchema={currentSchema} />
                {/* Menú multi-empresa — visible solo si pertenece a una organización con 2+ empresas */}
                {(() => {
                    try {
                        const orgs = JSON.parse(localStorage.getItem('org_companies') || '[]');
                        if (orgs.length > 1) {
                            return (
                                <>
                                    <NavItem
                                        icon={Building2}
                                        label="Grupo Empresarial"
                                        path="/org/dashboard"
                                        isCollapsed={isCollapsed}
                                        onClick={close}
                                    />
                                    <NavItem
                                        icon={BookOpen}
                                        label="Catálogo Compartido"
                                        path="/org/catalog"
                                        isCollapsed={isCollapsed}
                                        onClick={close}
                                    />
                                    <NavItem
                                        icon={ArrowLeftRight}
                                        label="Transferencias"
                                        path="/org/transfers"
                                        isCollapsed={isCollapsed}
                                        onClick={close}
                                    />
                                    <NavItem
                                        icon={Settings}
                                        label="Config. del Grupo"
                                        path="/org/config"
                                        isCollapsed={isCollapsed}
                                        onClick={close}
                                    />
                                </>
                            );
                        }
                    } catch {}
                    return null;
                })()}
                <NavItem icon={LayoutDashboard} label="Resumen"          path="/"              isCollapsed={isCollapsed} onClick={close} />
                <NavItem icon={ShoppingCart}    label="Centro de Ventas" path="/sales-center"  isCollapsed={isCollapsed} onClick={close} />
                {isAdminOrWH && (
                    <NavItem icon={Package} label="Centro de Inventario" path="/inventory-center" isCollapsed={isCollapsed} onClick={close} />
                )}

                {/* Módulos especiales */}
                {(eff?.services || eff?.laundry) && isAdminOrCashier && (<>
                    <SectionLabel label="Módulos" isCollapsed={isCollapsed} />
                    {eff?.services && <NavItem icon={Wrench}     label="Taller / Servicios"  path="/services"  isCollapsed={isCollapsed} onClick={close} />}
                    {eff?.laundry  && <NavItem icon={Smartphone} label="Lavandería"           path="/laundry"   isCollapsed={isCollapsed} onClick={close} />}
                    {eff?.barbershop && <NavItem icon={Scissors} label="Barbería / Salón"     path="/barbershop" isCollapsed={isCollapsed} onClick={close} />}
                    {eff?.restaurant && (
                        <NavGroup icon={Utensils} label="Restaurante" isCollapsed={isCollapsed} onNavigate={close} items={[
                            { icon: Utensils,  label: 'Mapa de Mesas',   path: '/restaurant/tables' },
                            { icon: ChefHat,   label: 'Cocina',          path: '/restaurant/kitchen' },
                            { icon: Smartphone,label: 'Comandera Móvil', path: '/mobile/login' },
                            ...(isAdmin ? [
                                { icon: BookOpen,      label: 'Menú Digital', path: '/restaurant/menu' },
                                { icon: ClipboardList, label: 'Recetas',      path: '/restaurant/recipes' },
                            ] : []),
                        ]} />
                    )}
                    {eff?.pharmacy && (
                        <NavGroup icon={Pill} label="Farmacia" isCollapsed={isCollapsed} onNavigate={close} items={[
                            { icon: LayoutDashboard, label: 'Dashboard',       path: '/pharmacy' },
                            ...(isAdminOrWH ? [
                                { icon: Package,  label: 'Gestión de Lotes',   path: '/pharmacy/lots' },
                                { icon: BookOpen, label: 'Libro de Control',   path: '/pharmacy/control-log' },
                            ] : []),
                            { icon: FileText, label: 'Recetas',                path: '/pharmacy/prescriptions' },
                        ]} />
                    )}
                </>)}

                {/* Finanzas y Reportes */}
                {isAdmin && (<>
                    <SectionLabel label="Análisis" isCollapsed={isCollapsed} />
                    <NavItem icon={BarChart2}   label="Reportes"       path="/reports"         isCollapsed={isCollapsed} onClick={close} />
                    <NavItem icon={LayoutGrid}  label="Gestión Cajas"  path="/cash-registers"  isCollapsed={isCollapsed} onClick={close} />
                </>)}

                {isAdminOrWH && (<>
                    <SectionLabel label="Compras" isCollapsed={isCollapsed} />
                    <NavItem icon={Briefcase}  label="Compras"         path="/purchases"  isCollapsed={isCollapsed} onClick={close} />
                    <NavItem icon={Truck}      label="Proveedores"     path="/suppliers"  isCollapsed={isCollapsed} onClick={close} />
                </>)}

                {/* Configuración */}
                {isAdmin && (<>
                    <SectionLabel label="Sistema" isCollapsed={isCollapsed} />
                    <NavItem icon={Settings} label="Configuración" path="/config-center" isCollapsed={isCollapsed} onClick={close} />
                </>)}
            </nav>

            {/* ── Footer ── */}
            <div className="px-2 py-3 border-t border-slate-100 space-y-0.5 shrink-0">
                {!isCollapsed && <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-3 pb-1">Soporte y Guía</p>}
                <NavItem icon={LifeBuoy}  label="Soporte"  path="/support" isCollapsed={isCollapsed} onClick={close} badge={supportUnread} />
                <button onClick={() => setIsTourModalOpen(true)} title="Manual de uso"
                    className={cn('w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-all',
                        isCollapsed && 'justify-center px-0')}>
                    <BookOpen size={18} className="shrink-0 text-slate-400" />
                    {!isCollapsed && 'Manual'}
                </button>

                {/* User + Logout */}
                <div className={cn('flex items-center gap-2 pt-2 border-t border-slate-100 mt-1', isCollapsed && 'justify-center')}>
                    {!isCollapsed && (
                        <div className="flex-1 min-w-0 px-1">
                            <p className="text-xs font-bold text-slate-700 truncate">{user?.username}</p>
                            <p className="text-[10px] text-slate-400 truncate">{user?.role === 'ADMIN' ? 'Administrador' : user?.role === 'CASHIER' ? 'Cajero' : user?.role}</p>
                        </div>
                    )}
                    <button onClick={handleLogout} title="Cerrar sesión"
                        className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all shrink-0">
                        <LogOut size={18} />
                    </button>
                </div>
            </div>

            <TourSelectionModal isOpen={isTourModalOpen} onClose={() => setIsTourModalOpen(false)} />
        </aside>
    );
}
