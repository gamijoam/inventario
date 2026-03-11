import React, { useEffect, useState, useCallback } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Building2, LogOut, Megaphone, LifeBuoy, CheckSquare, HardDrive, Key, Activity } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getPendingCount } from '../api/support';

const DashboardLayout: React.FC = () => {
    const { logout, user } = useAuth();
    const location = useLocation();
    const [pendingTickets, setPendingTickets] = useState(0);

    const fetchPendingCount = useCallback(async () => {
        try {
            const count = await getPendingCount();
            setPendingTickets(count);
        } catch {
            // Silently ignore
        }
    }, []);

    // Poll pending ticket count every 60 seconds
    useEffect(() => {
        fetchPendingCount();
        const interval = setInterval(fetchPendingCount, 60000);
        return () => clearInterval(interval);
    }, [fetchPendingCount]);

    // Refresh count when navigating away from support page (after responding)
    useEffect(() => {
        if (!location.pathname.includes('/support')) {
            fetchPendingCount();
        }
    }, [location.pathname, fetchPendingCount]);

    const navigation = [
        { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
        { name: 'Empresas', href: '/dashboard/tenants', icon: Building2 },
        { name: 'Licencias', href: '/dashboard/licenses', icon: Key },
        { name: 'Mesa de Ayuda', href: '/dashboard/support', icon: LifeBuoy, badge: pendingTickets },
        { name: 'Recordatorios', href: '/dashboard/reminders', icon: CheckSquare },
        { name: 'Mensajes', href: '/dashboard/messages', icon: Megaphone },
        { name: 'Actividad', href: '/dashboard/activity', icon: Activity },
        { name: 'Respaldos', href: '/dashboard/backups', icon: HardDrive },
    ];

    const isActive = (path: string) => {
        if (path === '/dashboard' && location.pathname === '/dashboard') return true;
        if (path !== '/dashboard' && location.pathname.startsWith(path)) return true;
        return false;
    };

    return (
        <div className="min-h-screen bg-gray-100 flex">
            {/* Sidebar */}
            <aside className="w-64 bg-slate-900 text-white flex flex-col fixed h-full transition-all duration-300 z-10">
                <div className="p-6 border-b border-slate-800">
                    <h1 className="text-2xl font-bold tracking-wider text-blue-400">SaaS Admin</h1>
                    <p className="text-xs text-slate-400 mt-1">Panel de Control Global</p>
                </div>

                <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
                    {navigation.map((item) => {
                        const Icon = item.icon;
                        const active = isActive(item.href);
                        return (
                            <Link
                                key={item.name}
                                to={item.href}
                                className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors duration-200 group relative ${active
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50'
                                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                    }`}
                            >
                                <Icon className={`mr-3 h-5 w-5 ${active ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} />
                                {item.name}
                                {item.badge != null && item.badge > 0 && (
                                    <span className="ml-auto flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[11px] font-bold text-white bg-rose-500 rounded-full shadow-sm animate-pulse">
                                        {item.badge > 99 ? '99+' : item.badge}
                                    </span>
                                )}
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-slate-800">
                    <div className="flex items-center mb-4 px-2">
                        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold mr-3">
                            {user?.username?.substring(0, 2).toUpperCase() || 'AD'}
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-sm font-medium truncate">{user?.username}</p>
                            <p className="text-xs text-slate-500 truncate">{user?.email || 'Super Admin'}</p>
                        </div>
                    </div>
                    <button
                        onClick={logout}
                        className="w-full flex items-center justify-center px-4 py-2 text-sm font-medium text-red-200 bg-red-900/20 hover:bg-red-900/40 rounded-lg transition-colors"
                    >
                        <LogOut className="mr-2 h-4 w-4" />
                        Cerrar Sesión
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 ml-64 p-8 transition-all duration-300">
                <div className="max-w-7xl mx-auto">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default DashboardLayout;
