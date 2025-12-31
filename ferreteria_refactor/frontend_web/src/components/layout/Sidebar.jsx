import { useState } from 'react';
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
    ChevronRight
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { useAuth } from '../../context/AuthContext';

const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: ShoppingCart, label: 'Ventas', path: '/pos' },
    { icon: FileText, label: 'Historial', path: '/sales-history' },
    { icon: Package, label: 'Inventario', path: '/inventory' },
    { icon: Users, label: 'Clientes', path: '/customers' },
    { icon: Truck, label: 'Proveedores', path: '/suppliers' },
    { icon: Briefcase, label: 'Compras', path: '/purchases' },
    { icon: CreditCard, label: 'Créditos', path: '/accounts-receivable' },
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
                "bg-white border-r border-slate-200 fixed h-full flex flex-col z-20 transition-all duration-300 ease-in-out",
                isCollapsed ? "w-20" : "w-64"
            )}
        >
            <div className="h-16 flex items-center justify-between px-4 border-b border-slate-100 relative">
                {!isCollapsed && (
                    <div className="flex items-center gap-2 font-bold text-xl text-slate-800 transition-opacity duration-300">
                        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
                            F
                        </div>
                        <span>Ferretería</span>
                    </div>
                )}
                {isCollapsed && (
                    <div className="w-full flex justify-center">
                        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">
                            F
                        </div>
                    </div>
                )}

                <button
                    onClick={toggleSidebar}
                    className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-400 hover:text-indigo-600 shadow-sm transition-colors z-30"
                >
                    {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                </button>
            </div>

            <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 scrollbar-hide">
                {menuItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={cn(
                                "flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors group relative",
                                isActive
                                    ? "bg-indigo-50 text-indigo-600"
                                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                                isCollapsed && "justify-center"
                            )}
                        >
                            <item.icon size={20} className={cn(isActive ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600")} />

                            {!isCollapsed && <span className="ml-3">{item.label}</span>}

                            {/* Tooltip for collapsed state */}
                            {isCollapsed && (
                                <div className="absolute left-full ml-4 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                                    {item.label}
                                </div>
                            )}
                        </Link>
                    );
                })}
            </nav>

            <div className="p-4 border-t border-slate-100">
                <button
                    onClick={handleLogout}
                    className={cn(
                        "flex items-center px-3 py-2 w-full rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors",
                        isCollapsed && "justify-center"
                    )}
                >
                    <LogOut size={20} />
                    {!isCollapsed && <span className="ml-3">Cerrar Sesión</span>}
                </button>

                {!isCollapsed && (
                    <div className="mt-4 flex items-center gap-3 px-3 transition-opacity duration-300">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-xs">
                            {user?.username?.substring(0, 2).toUpperCase() || 'US'}
                        </div>
                        <div className="text-xs overflow-hidden">
                            <p className="font-medium text-slate-700 truncate">{user?.username || 'Usuario'}</p>
                            <p className="text-slate-400 truncate w-24">{user?.role || 'Rol'}</p>
                        </div>
                    </div>
                )}
            </div>
        </aside>
    );
}
