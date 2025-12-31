import { useNavigate } from 'react-router-dom';
import { ShieldAlert, Home } from 'lucide-react';

const Unauthorized = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8 text-center">
                <div className="flex justify-center mb-6">
                    <div className="bg-red-100 rounded-full p-4">
                        <ShieldAlert className="text-red-600" size={48} />
                    </div>
                </div>

                <h1 className="text-3xl font-bold text-gray-800 mb-4">
                    Acceso Denegado
                </h1>

                <p className="text-gray-600 mb-8">
                    No tienes permisos suficientes para acceder a esta página.
                    Por favor, contacta al administrador si crees que esto es un error.
                </p>

                <button
                    onClick={() => navigate('/')}
                    className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                >
                    <Home size={20} />
                    Volver al Dashboard
                </button>
            </div>
        </div>
    );
};

export default Unauthorized;
