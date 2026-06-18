import { useState, useRef, useEffect } from 'react';
import { X, Search, Check, AlertTriangle, Trash2, Palette } from 'lucide-react';
import { useHotkeys } from 'react-hotkeys-hook';
import { toast } from 'react-hot-toast';
import apiClient from '../../config/axios';

const getSafeColorHex = (hex) => /^#([0-9a-fA-F]{6})$/.test(hex || '') ? hex : '#cbd5e1';

const SerializedItemModal = ({ isOpen, onClose, product, quantity = 1, onConfirm, title, subtitle }) => {
    const [serialInput, setSerialInput] = useState('');
    const [scannedSerials, setScannedSerials] = useState([]);
    const inputRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            setScannedSerials([]);
            setSerialInput('');
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen, product]);

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
        if (scannedSerials.some(item => item.serial_number === code)) {
            toast.error('Este serial ya está en la lista');
            setSerialInput('');
            return;
        }

        if (quantity > 0 && scannedSerials.length >= quantity) {
            toast.error(`Ya has escaneado los ${quantity} seriales requeridos`);
            setSerialInput('');
            return;
        }

        try {
            const { data } = await apiClient.get('/inventory/validate-imei', {
                params: { product_id: product.id, imei: code }
            });

            if (!data.valid) {
                toast.error(data.message);
                setSerialInput('');
                return;
            }

            setScannedSerials(prev => ([
                ...prev,
                {
                    serial_number: code,
                    instance_id: data.instance_id || null,
                    color_name: data.color_name || null,
                    color_hex: data.color_hex || null,
                }
            ]));
            setSerialInput('');
            toast.success(data.color_name ? `Serial agregado - ${data.color_name}` : 'Serial verificado y agregado');
        } catch (error) {
            console.error(error);
            toast.error('Error verificando serial en el servidor');
        }
    };

    const removeSerial = (serial) => {
        setScannedSerials(prev => prev.filter(item => item.serial_number !== serial));
    };

    const handleConfirm = () => {
        if (scannedSerials.length === 0) {
            toast.error('Debe escanear al menos un serial');
            return;
        }

        if (quantity > 0 && scannedSerials.length !== quantity) {
            toast.error(`Faltan seriales. Requeridos: ${quantity}, Escaneados: ${scannedSerials.length}`);
            return;
        }

        onConfirm(
            scannedSerials.map(item => item.serial_number),
            scannedSerials
        );
        onClose();
    };

    useHotkeys('esc', () => {
        if (isOpen) onClose();
    }, { enableOnFormTags: true });

    if (!isOpen || !product) return null;

    const remaining = quantity > 0 ? quantity - scannedSerials.length : 1;
    const progress = quantity > 0 ? (scannedSerials.length / quantity) * 100 : 100;

    return (
        <div id="tour-serial-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm transition-opacity">
            <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4">
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">{title || 'Escanear Seriales (IMEI)'}</h3>
                        <p className="mt-0.5 font-mono text-xs text-slate-500">{product.name}</p>
                        {subtitle && <p className="mt-0.5 text-xs font-bold text-indigo-500">{subtitle}</p>}
                    </div>
                    <button onClick={onClose} className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-200">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    <div className="mb-6">
                        <div className="mb-1.5 flex justify-between text-xs font-bold text-slate-500">
                            <span>{quantity > 0 ? 'Progreso' : 'Seriales capturados'}</span>
                            <span className={quantity > 0 && remaining === 0 ? 'text-green-600' : 'text-indigo-600'}>
                                {quantity > 0 ? `${scannedSerials.length} / ${quantity}` : scannedSerials.length}
                            </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                            <div
                                className={`h-full transition-all duration-300 ${quantity > 0 && remaining === 0 ? 'bg-green-500' : 'bg-indigo-500'}`}
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>

                    <div id="tour-serial-input" className="relative mb-6">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <Search className="h-5 w-5 text-slate-400" />
                        </div>
                        <input
                            ref={inputRef}
                            type="text"
                            className="w-full rounded-xl border-2 border-indigo-100 bg-white py-3 pl-10 pr-4 text-lg font-mono text-slate-700 placeholder-slate-300 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 disabled:bg-slate-50 disabled:text-slate-400"
                            placeholder={remaining > 0 ? 'Escanea o escribe el serial...' : 'Completado'}
                            value={serialInput}
                            onChange={(e) => setSerialInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            disabled={remaining === 0}
                            autoComplete="off"
                        />
                        <div className="absolute inset-y-0 right-2 flex items-center">
                            <kbd className="hidden rounded border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-400 sm:inline-block">
                                ENTER
                            </kbd>
                        </div>
                    </div>

                    {scannedSerials.length > 0 ? (
                        <div id="tour-serial-list" className="space-y-2">
                            <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                                Seriales capturados ({scannedSerials.length})
                            </div>
                            <div className="custom-scrollbar max-h-[240px] space-y-2 overflow-y-auto pr-2">
                                {scannedSerials.map((item, idx) => (
                                    <div key={`${item.serial_number}-${idx}`} className="group flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-3 transition-colors hover:border-indigo-100">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-600">
                                                    <Check size={14} strokeWidth={3} />
                                                </div>
                                                <span className="font-mono text-sm font-medium text-slate-700">{item.serial_number}</span>
                                            </div>
                                            {(item.color_name || item.color_hex) && (
                                                <div className="mt-2 flex items-center gap-2 pl-9">
                                                    <span className="h-2.5 w-2.5 rounded-full border border-white shadow-sm" style={{ backgroundColor: getSafeColorHex(item.color_hex) }} />
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-200/70 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-slate-600">
                                                        <Palette size={11} />
                                                        {item.color_name || 'Color registrado'}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => removeSerial(item.serial_number)}
                                            className="rounded-lg p-1.5 text-slate-300 opacity-0 transition-all group-hover:opacity-100 hover:bg-rose-50 hover:text-rose-500"

                                            title="Eliminar"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="rounded-xl border-2 border-dashed border-slate-100 py-8 text-center text-slate-300">
                            <Search size={32} className="mx-auto mb-2 opacity-50" />
                            <p className="text-sm">Esperando escaneo...</p>
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 p-4">
                    <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-200">
                        Cancelar
                    </button>
                    <button
                        id="tour-serial-confirm"
                        onClick={handleConfirm}
                        disabled={quantity > 0 ? scannedSerials.length !== quantity : scannedSerials.length === 0}
                        className="flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition-all hover:-translate-y-0.5 hover:bg-indigo-700 hover:shadow-indigo-300 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none disabled:transform-none"
                    >
                        {(quantity > 0 ? scannedSerials.length !== quantity : scannedSerials.length === 0) ? (
                            <>
                                <AlertTriangle size={16} />
                                Completa los seriales
                            </>
                        ) : (
                            <>
                                <Check size={16} />
                                Confirmar agregado
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SerializedItemModal;
