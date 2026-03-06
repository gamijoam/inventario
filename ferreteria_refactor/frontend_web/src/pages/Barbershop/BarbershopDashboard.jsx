import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Scissors, Users, DollarSign, ShoppingBag, ArrowRight } from 'lucide-react';

const BarbershopDashboard = () => {
    const navigate = useNavigate();

    const menuItems = [
        {
            title: 'Punto de Venta',
            description: 'Vender servicios de barbería y productos.',
            icon: ShoppingBag,
            path: '/pos',
            color: 'bg-blue-500',
            bgLight: 'bg-blue-50',
            border: 'border-blue-200'
        },
        {
            title: 'Personal',
            description: 'Gestionar barberos, estilistas y sus porcentajes de comisión.',
            icon: Users,
            path: '/barbershop/employees',
            color: 'bg-emerald-500',
            bgLight: 'bg-emerald-50',
            border: 'border-emerald-200'
        },
        {
            title: 'Reporte de Comisiones',
            description: 'Historial de comisiones generadas por los servicios realizados.',
            icon: DollarSign,
            path: '/barbershop/commissions',
            color: 'bg-purple-500',
            bgLight: 'bg-purple-50',
            border: 'border-purple-200'
        }
    ];

    return (
        <div id="tour-barbershop-container" className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-center text-center md:text-left">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-emerald-100 text-emerald-600 rounded-2xl shadow-sm">
                        <Scissors size={32} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 tracking-tight">Barbería / Salón</h1>
                        <p className="text-slate-500 mt-1 font-medium">Panel de control de servicios y comisiones</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {menuItems.map((item, index) => (
                    <div
                        key={index}
                        onClick={() => navigate(item.path)}
                        className={`group bg-white p-8 rounded-[2rem] shadow-sm border ${item.border} cursor-pointer hover:shadow-2xl hover:border-transparent hover:-translate-y-2 transition-all duration-300 relative overflow-hidden`}
                    >
                        {/* Background Decoration */}
                        <div className={`absolute -right-8 -bottom-8 w-32 h-32 ${item.bgLight} rounded-full opacity-50 group-hover:scale-150 transition-transform duration-500`}></div>

                        <div className={`w-16 h-16 ${item.bgLight} ${item.color.replace('bg-', 'text-')} rounded-2xl flex items-center justify-center mb-6 shadow-inner group-hover:${item.color} group-hover:text-white transition-all duration-300`}>
                            <item.icon size={32} strokeWidth={2.5} />
                        </div>

                        <h2 className="text-2xl font-black text-slate-800 mb-2 relative z-10 uppercase tracking-tight">{item.title}</h2>
                        <p className="text-slate-500 mb-8 font-medium relative z-10 leading-relaxed">
                            {item.description}
                        </p>

                        <div className={`flex items-center ${item.color.replace('bg-', 'text-')} font-black text-sm uppercase tracking-widest group-hover:translate-x-3 transition-transform relative z-10`}>
                            Acceder <ArrowRight size={18} className="ml-2" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default BarbershopDashboard;
