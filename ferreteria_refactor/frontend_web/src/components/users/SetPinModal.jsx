import { useState } from 'react';
import { X, Key, Lock, AlertCircle, Check } from 'lucide-react';

/**
 * SetPinModal - Secure modal for setting/changing user PIN
 * @param {boolean} isOpen - Modal visibility state
 * @param {function} onClose - Close handler
 * @param {object} user - User object { id, name, username }
 * @param {function} onSuccess - Success callback after PIN update
 */
const SetPinModal = ({ isOpen, onClose, user, onSuccess }) => {
    const [pin, setPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    if (!isOpen || !user) return null;

    const validatePin = () => {
        // Clear previous errors
        setError('');

        // Check if PIN is numeric
        if (!/^\d+$/.test(pin)) {
            setError('El PIN debe contener solo números');
            return false;
        }

        // Check PIN length (4-6 digits)
        if (pin.length < 4 || pin.length > 6) {
            setError('El PIN debe tener entre 4 y 6 dígitos');
            return false;
        }

        // Check if PINs match
        if (pin !== confirmPin) {
            setError('Los PINs no coinciden');
            return false;
        }

        return true;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validatePin()) return;

        setLoading(true);
        try {
            // Call the service (will be imported from userService)
            await onSuccess(user.id, pin);

            // Reset form
            setPin('');
            setConfirmPin('');
            setError('');
            onClose();
        } catch (err) {
            setError(err.response?.data?.detail || 'Error al actualizar el PIN');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setPin('');
        setConfirmPin('');
        setError('');
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md transform transition-all">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-blue-600 rounded-xl shadow-lg">
                            <Key className="text-white" size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-gray-800">Establecer PIN de Seguridad</h3>
                            <p className="text-sm text-gray-600 mt-1">
                                Usuario: <span className="font-semibold text-blue-600">{user.name || user.username}</span>
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* Error Alert */}
                    {error && (
                        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 flex items-start gap-3">
                            <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
                            <div>
                                <p className="text-sm font-bold text-red-900">Error de Validación</p>
                                <p className="text-sm text-red-700 mt-1">{error}</p>
                            </div>
                        </div>
                    )}

                    {/* Info Box */}
                    <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                        <div className="flex items-start gap-3">
                            <Lock className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
                            <div className="text-sm text-blue-800">
                                <p className="font-bold mb-1">Requisitos del PIN:</p>
                                <ul className="list-disc list-inside space-y-1 text-xs">
                                    <li>Solo números (0-9)</li>
                                    <li>Entre 4 y 6 dígitos</li>
                                    <li>Fácil de recordar pero difícil de adivinar</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    {/* New PIN Input */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">
                            Nuevo PIN
                        </label>
                        <div className="relative">
                            <input
                                type="password"
                                value={pin}
                                onChange={(e) => setPin(e.target.value)}
                                maxLength={6}
                                className="w-full border-2 border-gray-300 rounded-xl p-4 text-center text-2xl font-mono tracking-widest focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all"
                                placeholder="••••"
                                autoFocus
                                required
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                                <Lock size={20} />
                            </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                            {pin.length > 0 && (
                                <span className={pin.length >= 4 && pin.length <= 6 ? 'text-green-600' : 'text-orange-600'}>
                                    {pin.length} dígitos ingresados
                                </span>
                            )}
                        </p>
                    </div>

                    {/* Confirm PIN Input */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">
                            Confirmar PIN
                        </label>
                        <div className="relative">
                            <input
                                type="password"
                                value={confirmPin}
                                onChange={(e) => setConfirmPin(e.target.value)}
                                maxLength={6}
                                className="w-full border-2 border-gray-300 rounded-xl p-4 text-center text-2xl font-mono tracking-widest focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all"
                                placeholder="••••"
                                required
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                {confirmPin.length > 0 && pin === confirmPin ? (
                                    <Check className="text-green-600" size={20} />
                                ) : (
                                    <Lock className="text-gray-400" size={20} />
                                )}
                            </div>
                        </div>
                        {confirmPin.length > 0 && (
                            <p className={`text-xs mt-2 ${pin === confirmPin ? 'text-green-600' : 'text-red-600'}`}>
                                {pin === confirmPin ? '✓ Los PINs coinciden' : '✗ Los PINs no coinciden'}
                            </p>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={handleClose}
                            className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !pin || !confirmPin}
                            className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Guardando...
                                </>
                            ) : (
                                <>
                                    <Key size={20} />
                                    Establecer PIN
                                </>
                            )}
                        </button>
                    </div>
                </form>

                {/* Footer Note */}
                <div className="px-6 pb-6">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                        <p className="text-xs text-yellow-800">
                            <span className="font-bold">⚠️ Importante:</span> El PIN es requerido para acciones sensibles como retiros de caja y eliminación de ventas.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SetPinModal;
