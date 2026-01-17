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
        const handleKeyDown = (e) => {
            if (!isOpen) return;

            if (e.key >= '0' && e.key <= '9') {
                handleNumberClick(e.key);
            } else if (e.key === 'Backspace') {
                handleBackspace();
            } else if (e.key === 'Enter') {
                if (!loading && pin.length > 0 && selectedUser) {
                    handlePinSubmit();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, pin, selectedUser, loading]);

    const fetchSupervisors = async () => {
        setLoading(true);
        window.fetchStatus = "STARTING";
        try {
            const response = await apiClient.get('/users');
            window.lastRawResponse = response;
            window.fetchStatus = "RECEIVED RESPONSE";

            // Handle different axios response structures
            const data = response.data || response;
            window.lastFetchedUsers = data;

            if (!Array.isArray(data)) {
                console.error("DEBUG ALERT: API returned non-array:", data);
                throw new Error("API response is not an array. Type: " + typeof data);
            }

            // Allow Admin and Supervisor roles (case insensitive)
            const supervisors = data.filter(u => {
                const role = String(u.role || '').toUpperCase();
                const isValid = u.is_active && (role === 'ADMIN' || role === 'MANAGER' || role === 'SUPERVISOR');
                return isValid;
            });

            window.lastFilteredSupervisors = supervisors;
            setUsers(supervisors);

            if (supervisors.length > 0) {
                setSelectedUser(supervisors[0].id);
            } else {
                console.warn("DEBUG: No supervisors found!");
            }
        } catch (err) {
            console.error("Error fetching users:", err);
            window.lastFetchError = err;
            window.fetchStatus = "ERROR";
            setError("Error: " + (err.message || "Unknown error"));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            setPin('');
            setError('');
            fetchSupervisors();
        }
    }, [isOpen]);

    const handlePinSubmit = async () => {
        if (!selectedUser) {
            // Try to auto-select if only one exists (fail-safe)
            if (users.length > 0) {
                // Use first one if not selected
                console.log("Auto-selecting user for auth");
            } else {
                setError("Seleccione un usuario");
                return;
            }
        }

        // ... rest of submit
        setLoading(true);
        setError('');

        const targetUser = selectedUser || (users.length > 0 ? users[0].id : null);
        if (!targetUser) { setError("No user selected"); return; }

        try {
            const response = await apiClient.post('/auth/validate-pin', {
                user_id: targetUser,
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
        setPin(prev => prev + num);
        setError('');
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
                        {users.length === 0 ? (
                            <div className="text-center p-4 bg-amber-50 rounded-lg border border-amber-100 mb-2">
                                <p className="text-xs text-amber-600 font-bold mb-2">No hay supervisores disponibles</p>
                                <details className="text-left text-[10px] text-amber-800 cursor-pointer">
                                    <summary>Ver Detalles Técnicos</summary>
                                    <pre className="mt-2 p-2 bg-white rounded border overflow-auto max-h-32 whitespace-pre-wrap">
                                        Status: {window.fetchStatus || "Unknown"}
                                        {'\n'}Error: {error || (window.lastFetchError ? window.lastFetchError.message : "None")}
                                        {'\n'}Raw Resp Status: {window.lastRawResponse ? window.lastRawResponse.status : "N/A"}
                                        {'\n'}Data Array Len: {window.lastFetchedUsers ? (Array.isArray(window.lastFetchedUsers) ? window.lastFetchedUsers.length : "Not Array") : "Null"}
                                        {'\n'}Filtered Len: {window.lastFilteredSupervisors ? window.lastFilteredSupervisors.length : "N/A"}
                                        {'\n'}
                                        First User: {window.lastFetchedUsers && window.lastFetchedUsers[0] ? JSON.stringify(window.lastFetchedUsers[0], null, 2) : "None"}
                                    </pre>
                                </details>
                            </div>
                        ) : (
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
                        )}
                    </div>

                    {/* PIN Display */}
                    <div className="flex gap-2 mb-6 justify-center min-h-[16px]">
                        {pin.length === 0 ? (
                            <span className="text-slate-300 text-sm font-medium tracking-widest">_ _ _ _</span>
                        ) : (
                            Array.from({ length: pin.length }).map((_, i) => (
                                <div key={i} className="w-4 h-4 rounded-full bg-indigo-600 border border-indigo-600 shadow-sm animate-in zoom-in-50 duration-200" />
                            ))
                        )}
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
                        <div className="text-rose-500 text-xs font-bold bg-rose-50 px-3 py-2 rounded-lg mb-4 animate-in fade-in slide-in-from-bottom-2 text-center w-full">
                            {error}
                        </div>
                    )}

                    {/* Verify Button */}
                    <button
                        onClick={handlePinSubmit}
                        disabled={loading || pin.length === 0}
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
