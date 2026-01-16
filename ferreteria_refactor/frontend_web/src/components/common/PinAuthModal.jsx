import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, User, Delete } from 'lucide-react';
import apiClient from '../../config/axios';
import { toast } from 'react-hot-toast';

const PinAuthModal = ({ isOpen, onClose, onSuccess, title = "Autorización Requerida", message = "Ingrese PIN de Supervisor" }) => {
    const [pin, setPin] = useState('');
    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            fetchSupervisors();
            setPin('');
            setError('');
            setSelectedUser(null);
        }
    }, [isOpen]);

    const fetchSupervisors = async () => {
        try {
            const { data } = await apiClient.get('/users');
            // Allow Admin and Supervisor roles (adjust logic if role structure differs)
            const supervisors = data.filter(u =>
                u.is_active && (u.role === 'admin' || u.role === 'supervisor')
            );
            setUsers(supervisors);

            // Auto-select if only one
            if (supervisors.length === 1) {
                setSelectedUser(supervisors[0].id);
            }
        } catch (err) {
            console.error("Error fetching users:", err);
            setError("Error cargando lista de usuarios");
        }
    };

    const handlePinSubmit = async () => {
        if (!selectedUser) {
            setError("Seleccione un usuario");
            return;
        }
        if (pin.length < 4) {
            setError("PIN incompleto");
            return;
        }

        setLoading(true);
        setError('');

        try {
            const response = await apiClient.post('/auth/validate-pin', {
                user_id: selectedUser,
                pin: pin
            });

            if (response.data.valid) {
                toast.success(`Autorizado: ${response.data.username}`);
                onSuccess(response.data.user_id); // Return the Auth User ID
                onClose();
            } else {
                setError("PIN Incorrecto");
                setPin('');
            }
        } catch (err) {
            console.error("PIN Validation Error:", err);
            setError(err.response?.data?.detail || "Error validando PIN");
            setPin('');
        } finally {
            setLoading(false);
        }
    };

    const handleNumberClick = (num) => {
        if (pin.length < 6) {
            setPin(prev => prev + num);
            setError('');
        }
    };

    const handleBackspace = () => {
        setPin(prev => prev.slice(0, -1));
        setError('');
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col">

                {/* Header */}
                <div className="bg-slate-50 p-4 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <ShieldCheck className="text-indigo-600" size={20} />
                        {title}
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 flex-1 flex flex-col items-center">
                    <p className="text-sm text-slate-500 mb-6 text-center font-medium">
                        {message}
                    </p>

                    {/* User Selection */}
                    <div className="w-full mb-6">
                        <label className="block text-[10px] uppercase font-bold text-slate-400 mb-2">Supervisor</label>
                        <div className="grid grid-cols-1 gap-2">
                            {users.map(u => (
                                <button
                                    key={u.id}
                                    onClick={() => { setSelectedUser(u.id); setError(''); }}
                                    className={`
                                        flex items-center gap-3 p-3 rounded-xl border text-left transition-all
                                        ${selectedUser === u.id
                                            ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-600'
                                            : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50 text-slate-600'}
                                    `}
                                >
                                    <div className={`p-2 rounded-full ${selectedUser === u.id ? 'bg-indigo-200 text-indigo-700' : 'bg-slate-100 text-slate-400'}`}>
                                        <User size={16} />
                                    </div>
                                    <span className="font-bold text-sm">{u.full_name || u.username}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* PIN Display */}
                    <div className="flex gap-2 mb-6 justify-center">
                        {[0, 1, 2, 3].map(i => (
                            <div key={i} className={`
                                w-4 h-4 rounded-full border transition-all duration-200
                                ${i < pin.length
                                    ? 'bg-indigo-600 border-indigo-600 scale-110'
                                    : 'bg-slate-100 border-slate-300'}
                            `} />
                        ))}
                    </div>

                    {/* Keypad */}
                    <div className="grid grid-cols-3 gap-3 w-full max-w-[240px] mb-6">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                            <button
                                key={num}
                                onClick={() => handleNumberClick(num.toString())}
                                className="h-14 rounded-xl bg-slate-50 border border-slate-200 text-xl font-bold text-slate-700 hover:bg-white hover:shadow-md active:scale-95 transition-all shadow-sm"
                            >
                                {num}
                            </button>
                        ))}
                        <div className="pointer-events-none"></div>
                        <button
                            onClick={() => handleNumberClick('0')}
                            className="h-14 rounded-xl bg-slate-50 border border-slate-200 text-xl font-bold text-slate-700 hover:bg-white hover:shadow-md active:scale-95 transition-all shadow-sm"
                        >
                            0
                        </button>
                        <button
                            onClick={handleBackspace}
                            className="h-14 rounded-xl bg-rose-50 border border-rose-100 text-rose-500 hover:bg-rose-100 hover:shadow-md active:scale-95 transition-all shadow-sm flex items-center justify-center"
                        >
                            <Delete size={20} />
                        </button>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="text-rose-500 text-xs font-bold bg-rose-50 px-3 py-2 rounded-lg mb-4 animate-in fade-in slide-in-from-bottom-2">
                            {error}
                        </div>
                    )}

                    {/* Verify Button */}
                    <button
                        onClick={handlePinSubmit}
                        disabled={loading || !selectedUser || pin.length < 4}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl shadow-lg shadow-indigo-200 transition-all active:scale-95"
                    >
                        {loading ? 'Verificando...' : 'Autorizar'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PinAuthModal;
