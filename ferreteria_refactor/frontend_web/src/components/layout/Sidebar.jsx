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
    RotateCcw,
    HelpCircle,
    CreditCard,
    Briefcase
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { useAuth } from '../../context/AuthContext';

const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: ShoppingCart, label: 'Ventas', path: '/pos' }, // Pointing to POS for now, or Sales History? Maybe Sales History is better for Dashboard sidebar.
    { icon: FileText, label: 'Historial Ventas', path: '/sales-history' },
    { icon: Package, label: 'Inventario', path: '/inventory' },
    { icon: Users, label: 'Clientes', path: '/customers' },
    { icon: Truck, label: 'Proveedores', path: '/suppliers' },
    { icon: Briefcase, label: 'Compras', path: '/purchases' },
    { icon: CreditCard, label: 'Créditos', path: '/accounts-receivable' },
    { icon: Settings, label: 'Configuración', path: '/settings' },
];

export default function Sidebar() {
    const location = useLocation();
    const navigate = useNavigate();
    const { logout, user } = useAuth();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <aside className="w-64 bg-white border-r border-slate-200 fixed h-full flex flex-col z-10 transition-all duration-300">
            <div className="h-16 flex items-center px-6 border-b border-slate-100">
                <div className="flex items-center gap-2 font-bold text-xl text-slate-800">
                    <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
                        F
                    </div>
                    <span>Ferretería</span>
                </div>
            </div>

            <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
                {menuItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={cn(
                                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                                isActive
                                    ? "bg-slate-50 text-indigo-600"
                                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                            )}
                        >
                            <item.icon size={20} className={cn(isActive ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600")} />
                            {item.label}
                        </Link>
                    );
                })}
            </nav>

            <div className="p-4 border-t border-slate-100">
                <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                >
                    <LogOut size={20} />
                    Cerrar Sesión
                </button>

                <div className="mt-4 flex items-center gap-3 px-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-xs">
                        {user?.username?.substring(0, 2).toUpperCase() || 'US'}
                    </div>
                    <div className="text-xs">
                        <p className="font-medium text-slate-700">{user?.username || 'Usuario'}</p>
                        <p className="text-slate-400">{user?.role || 'Rol'}</p>
                    </div>
                </div>
            </div>
        </aside>
    );
}
