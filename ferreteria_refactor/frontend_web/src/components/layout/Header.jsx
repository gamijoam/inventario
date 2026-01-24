import { Search, Bell, ShoppingCart, PackageSearch, DollarSign } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Header() {
    return (
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-10">
            <div className="flex items-center gap-4 flex-1">
                {/* Search Bar - Visual only for now */}
                <div className="relative w-96 hidden md:block">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar productos, clientes, pedidos..."
                        className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400"
                    />
                </div>
            </div>

            <div className="flex items-center gap-2 md:gap-4">
                {/* Shortcuts */}
                <div className="flex items-center gap-1 mr-2 border-r border-slate-200 pr-4">
                    <Link to="/products" className="p-2 rounded-lg hover:bg-slate-50 text-slate-500 hover:text-indigo-600 transition-colors flex flex-col items-center group" title="Inventario">
                        <PackageSearch size={20} strokeWidth={2} />
                        <span className="text-[10px] font-bold mt-0.5 group-hover:text-indigo-600 hidden lg:block">Productos</span>
                    </Link>

                    <Link to="/cash-close" className="p-2 rounded-lg hover:bg-emerald-50 text-slate-500 hover:text-emerald-600 transition-colors flex flex-col items-center group" title="Cierre de Caja">
                        <DollarSign size={20} strokeWidth={2} />
                        <span className="text-[10px] font-bold mt-0.5 group-hover:text-emerald-600 hidden lg:block">Caja</span>
                    </Link>

                    <Link to="/pos" className="ml-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-200 flex items-center gap-2 transition-all hover:scale-105 active:scale-95 duration-200">
                        <ShoppingCart size={18} />
                        <span className="font-bold text-sm hidden md:block">Abrir POS</span>
                    </Link>
                </div>

                <button className="relative p-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors">
                    <Bell size={20} />
                    <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                </button>
            </div>
        </header>
    );
}
