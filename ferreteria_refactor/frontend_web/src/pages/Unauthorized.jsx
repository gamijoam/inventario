import { useNavigate } from 'react-router-dom';
import { ArrowRight, LogOut, ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getDefaultRouteForUser } from '../utils/defaultRoute';

const Unauthorized = () => {
    const navigate = useNavigate();
    const { user, permissions, logout } = useAuth();
    const fallbackRoute = getDefaultRouteForUser(user, permissions, { preferDashboard: false });
    const safeFallback = fallbackRoute && fallbackRoute !== '/unauthorized' ? fallbackRoute : '/login';

    const handleLogout = async () => {
        await logout();
        navigate('/login', { replace: true });
    };

    return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
            <div className="max-w-lg w-full bg-white rounded-xl shadow-xl border border-slate-200 p-8 text-center">
                <div className="flex justify-center mb-6">
                    <div className="bg-red-50 rounded-full p-4 ring-8 ring-red-50/60">
                        <ShieldAlert className="text-red-600" size={46} />
                    </div>
                </div>

                <p className="text-xs font-black tracking-widest text-slate-400 uppercase mb-2">Permisos insuficientes</p>
                <h1 className="text-3xl font-black text-slate-900 mb-4">
                    Esta sección está bloqueada para tu usuario
                </h1>

                <p className="text-slate-600 mb-8 leading-relaxed">
                    Tu cuenta está activa, pero no tiene permiso para abrir esta pantalla. Puedes volver a una sección disponible o cerrar sesión para entrar con otra cuenta.
                </p>

                <div className="grid gap-3 sm:grid-cols-2">
                    <button
                        onClick={() => navigate(safeFallback, { replace: true })}
                        className="flex items-center justify-center gap-2 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3 px-5 rounded-lg transition-colors"
                    >
                        Ir a mi inicio
                        <ArrowRight size={18} />
                    </button>
                    <button
                        onClick={handleLogout}
                        className="flex items-center justify-center gap-2 w-full bg-white hover:bg-slate-50 text-slate-700 font-black py-3 px-5 rounded-lg border border-slate-200 transition-colors"
                    >
                        <LogOut size={18} />
                        Cerrar sesión
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Unauthorized;
