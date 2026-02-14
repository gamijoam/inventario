import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, Package, Users, Menu, FileText } from 'lucide-react';
import { cn } from '../../utils/cn';

export default function MobileBottomNav({ onOpenMenu }) {
    const location = useLocation();

    const navItems = [
        { icon: LayoutDashboard, label: 'Inicio', path: '/' },
        { icon: ShoppingCart, label: 'Ventas', path: '/pos' },
        { icon: Package, label: 'Inventario', path: '/products' },
        { icon: Users, label: 'Clientes', path: '/customers' },
    ];

    return (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] z-40 flex justify-between items-end shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                    <Link
                        key={item.path}
                        to={item.path}
                        className={cn(
                            "flex flex-col items-center gap-1 p-2 rounded-xl transition-all duration-200",
                            isActive ? "text-indigo-600" : "text-slate-400 hover:text-slate-600"
                        )}
                    >
                        <item.icon
                            size={24}
                            strokeWidth={isActive ? 2.5 : 2}
                            className={cn(
                                "transition-transform duration-200",
                                isActive ? "-translate-y-1" : ""
                            )}
                        />
                        <span className="text-[10px] font-bold tracking-wide">{item.label}</span>
                    </Link>
                );
            })}

            <button
                onClick={onOpenMenu}
                className="flex flex-col items-center gap-1 p-2 rounded-xl text-slate-400 hover:text-slate-600 transition-all duration-200"
            >
                <Menu size={24} strokeWidth={2} />
                <span className="text-[10px] font-bold tracking-wide">Menú</span>
            </button>
        </div>
    );
}
