
import { useState, useRef, useEffect } from 'react';
import { X, Search, Check, AlertTriangle, Trash2 } from 'lucide-react';
import { useHotkeys } from 'react-hotkeys-hook';
import { toast } from 'react-hot-toast';
import apiClient from '../../config/axios';

const SerializedItemModal = ({ isOpen, onClose, product, quantity = 1, onConfirm }) => {
    const [serialInput, setSerialInput] = useState('');
    const [scannedSerials, setScannedSerials] = useState([]);
    const inputRef = useRef(null);

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setScannedSerials([]);
            setSerialInput('');
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen, product]);

    // Handle Enter in input
    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addSerial();
        }
    };

    const addSerial = async () => {
        const code = serialInput.trim().toUpperCase();
        if (!code) return;

        // Validation 1: Already scanned in this session
        if (scannedSerials.includes(code)) {
            toast.error('Este serial ya está en la lista');
            setSerialInput('');
            return;
        }

        // Validation 2: Limit reached
        if (scannedSerials.length >= quantity) {
            toast.error(`Ya has escaneado los ${quantity} seriales requeridos`);
            setSerialInput('');
            return;
        }

        // Validation 3: Backend Verification
        try {
            const { data } = await apiClient.get('/inventory/validate-imei', {
                params: { product_id: product.id, imei: code }
            });

            if (!data.valid) {
                toast.error(data.message);
                setSerialInput('');
                return;
            }

            // Success
            setScannedSerials([...scannedSerials, code]);
            setSerialInput('');
            toast.success('Serial verificado y agregado');

        } catch (error) {
            console.error(error);
            toast.error('Error verificando serial en el servidor');
        }
    };

    const removeSerial = (serial) => {
        setScannedSerials(scannedSerials.filter(s => s !== serial));
    };

    const handleConfirm = () => {
        if (scannedSerials.length !== quantity) {
            toast.error(`Faltan seriales. Requeridos: ${quantity}, Escaneados: ${scannedSerials.length}`);
            return;
        }
        onConfirm(scannedSerials);
        onClose();
    };

    useHotkeys('esc', () => {
        if (isOpen) onClose();
    }, { enableOnFormTags: true });

    if (!isOpen || !product) return null;

    const remaining = quantity - scannedSerials.length;
    const progress = (scannedSerials.length / quantity) * 100;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm transition-opacity">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">Escanear Seriales (IMEI)</h3>
                        <p className="text-xs text-slate-500 font-mono mt-0.5">{product.name}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-400 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 flex-1 overflow-y-auto">

                    {/* Progress Bar */}
                    <div className="mb-6">
                        <div className="flex justify-between text-xs font-bold text-slate-500 mb-1.5">
                            <span>Progreso</span>
                            <span className={remaining === 0 ? "text-green-600" : "text-indigo-600"}>
                                {scannedSerials.length} / {quantity}
                            </span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div
                                className={`h-full transition-all duration-300 ${remaining === 0 ? 'bg-green-500' : 'bg-indigo-500'}`}
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>

                    {/* Input Area */}
                    <div className="relative mb-6">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-5 w-5 text-slate-400" />
                        </div>
                        <input
                            ref={inputRef}
                            type="text"
                            className="
                                w-full pl-10 pr-4 py-3 
                                bg-white border-2 border-indigo-100 rounded-xl
                                text-lg font-mono text-slate-700 placeholder-slate-300
                                focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10
                                disabled:bg-slate-50 disabled:text-slate-400
                            "
                            placeholder={remaining > 0 ? "Escanea o escribe el serial..." : "Completado"}
                            value={serialInput}
                            onChange={(e) => setSerialInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            disabled={remaining === 0}
                            autoComplete="off"
                        />
                        <div className="absolute inset-y-0 right-2 flex items-center">
                            <kbd className="hidden sm:inline-block px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px] font-bold text-slate-400">
                                ENTER
                            </kbd>
                        </div>
                    </div>

                    {/* Scanned List */}
                    {scannedSerials.length > 0 && (
                        <div className="space-y-2">
                            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                                Seriales Capturados
                            </div>
                            {scannedSerials.map((serial, idx) => (
                                <div key={`${serial}-${idx}`} className="flex justify-between items-center p-3 bg-slate-50 border border-slate-100 rounded-lg group hover:border-indigo-100 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-6 h-6 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
                                            <Check size={14} strokeWidth={3} />
                                        </div>
                                        <span className="font-mono text-sm font-medium text-slate-700">{serial}</span>
                                    </div>
                                    <button
                                        onClick={() => removeSerial(serial)}
                                        className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                        title="Eliminar"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {scannedSerials.length === 0 && (
                        <div className="text-center py-8 text-slate-300 border-2 border-dashed border-slate-100 rounded-xl">
                            <Search size={32} className="mx-auto mb-2 opacity-50" />
                            <p className="text-sm">Esperando escaneo...</p>
                        </div>
                    )}

                </div>

                {/* Footer */}
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-200 rounded-lg transition-colors text-sm"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={scannedSerials.length !== quantity}
                        className="
                            px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg shadow-lg shadow-indigo-200
                            hover:bg-indigo-700 hover:shadow-indigo-300 hover:-translate-y-0.5 transition-all
                            disabled:bg-slate-300 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none
                            flex items-center gap-2 text-sm
                        "
                    >
                        {scannedSerials.length !== quantity ? (
                            <>
                                <AlertTriangle size={16} />
                                Completa los seriales
                            </>
                        ) : (
                            <>
                                <Check size={16} />
                                Confirmar Agregado
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SerializedItemModal;
