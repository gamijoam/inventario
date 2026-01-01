import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Delete, UserCheck } from 'lucide-react';
import axiosInstance from '../../config/axios';
import toast from 'react-hot-toast';

const WaiterLogin = () => {
    const [pin, setPin] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleNumberClick = (num) => {
        if (pin.length < 4) {
            const newPin = pin + num;
            setPin(newPin);
            if (newPin.length === 4) {
                handleLogin(newPin);
            }
        }
    };

    const handleDelete = () => {
        setPin(prev => prev.slice(0, -1));
    };

    const handleLogin = async (completePin) => {
        setLoading(true);
        try {
            // Call the new PIN endpoint
            const response = await axiosInstance.post('/users/pin-login', { pin: completePin });

            // response.data contains { access_token, user, etc }
            const { access_token, user } = response.data;

            // Use existing auth context login logic if possible, 
            // but useAuth.login usually expects email/password or handles the request itself.
            // If useAuth.login takes (user, token), great. 
            // If not, we might need to manually set token and reload or patch useAuth.
            // Assuming standard flow: set token in localStorage and context.

            // Let's assume useAuth exposes a method to set auth state directly OR we handle it manually here
            // If useAuth.login is hardcoded to username/password, we might need to manually set storage
            localStorage.setItem('token', access_token);
            localStorage.setItem('user', JSON.stringify(user));

            // Force reload to update context or if context listens to storage
            // Better: update context. But I cannot see useAuth implementation. 
            // I'll try to just reload page or navigate if context picks up token on mount.

            // Navigation
            window.location.href = '/mobile/tables';

        } catch (error) {
            console.error(error);
            toast.error("PIN Incorrecto");
            setPin('');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4">
            <div className="mb-8 text-center">
                <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/50">
                    <UserCheck size={40} className="text-white" />
                </div>
                <h1 className="text-2xl font-bold text-white mb-1">Acceso Meseros</h1>
                <p className="text-gray-400 text-sm">Ingresa tu PIN de 4 dígitos</p>
            </div>

            {/* PIN Display */}
            <div className="flex justify-center gap-4 mb-8">
                {[0, 1, 2, 3].map(i => (
                    <div
                        key={i}
                        className={`w-4 h-4 rounded-full transition-all duration-300 ${pin.length > i ? 'bg-blue-500 scale-125' : 'bg-gray-700'
                            }`}
                    />
                ))}
            </div>

            {/* Keypad */}
            <div className="grid grid-cols-3 gap-4 w-full max-w-xs">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                    <button
                        key={num}
                        onClick={() => handleNumberClick(num.toString())}
                        disabled={loading}
                        className="h-20 bg-gray-800 rounded-2xl text-2xl font-bold text-white shadow-lg active:bg-blue-600 active:scale-95 transition-all touch-manipulation"
                    >
                        {num}
                    </button>
                ))}

                {/* Empty bottom left */}
                <div className="h-20"></div>

                <button
                    onClick={() => handleNumberClick('0')}
                    disabled={loading}
                    className="h-20 bg-gray-800 rounded-2xl text-2xl font-bold text-white shadow-lg active:bg-blue-600 active:scale-95 transition-all touch-manipulation"
                >
                    0
                </button>

                <button
                    onClick={handleDelete}
                    className="h-20 bg-red-900/30 rounded-2xl flex items-center justify-center text-red-500 active:bg-red-900 active:scale-95 transition-all touch-manipulation"
                >
                    <Delete size={28} />
                </button>
            </div>

            {loading && <p className="mt-8 text-blue-400 animate-pulse">Verificando...</p>}
        </div>
    );
};

export default WaiterLogin;
