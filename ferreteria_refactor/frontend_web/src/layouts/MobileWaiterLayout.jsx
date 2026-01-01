import React from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, User } from 'lucide-react';

const MobileWaiterLayout = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/mobile/login');
    };

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col">
            {/* Mobile Header */}
            <header className="bg-blue-600 text-white p-4 shadow-md flex justify-between items-center z-10 sticky top-0">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-blue-500 border border-blue-300 flex items-center justify-center">
                        <User size={18} />
                    </div>
                    <div>
                        <p className="text-xs text-blue-200">Hola,</p>
                        <p className="font-bold leading-tight">{user?.full_name?.split(' ')[0] || user?.username || 'Mesero'}</p>
                    </div>
                </div>

                <button
                    onClick={handleLogout}
                    className="p-2 rounded-lg bg-blue-700 hover:bg-blue-800 transition shadow-inner flex items-center gap-1"
                    title="Bloquear sesión"
                >
                    <Lock size={18} />
                    <span className="text-xs font-bold">SALIR</span>
                </button>
            </header>

            {/* Content Area */}
            <main className="flex-1 overflow-hidden flex flex-col relative">
                <Outlet />
            </main>
        </div>
    );
};

export default MobileWaiterLayout;
