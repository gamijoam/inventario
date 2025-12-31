import { useState, useEffect } from 'react';
import { X, Save, AlertTriangle, ArrowRight, Search, Package, Box, Filter } from 'lucide-react';
import apiClient from '../../config/axios';
import clsx from 'clsx';
import { toast } from 'react-hot-toast';

const AdjustmentModal = ({ isOpen, onClose, onSuccess }) => {
    const [step, setStep] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [products, setProducts] = useState([]);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [loadingProducts, setLoadingProducts] = useState(false);

    const [adjustmentData, setAdjustmentData] = useState({
        type: 'ADJUSTMENT_IN', // ADJUSTMENT_IN, ADJUSTMENT_OUT, DAMAGED, INTERNAL_USE
        quantity: 1,
        unit: null,
        reason: ''
    });

    const MOVEMENT_TYPES = [
        { value: 'ADJUSTMENT_IN', label: 'Entrada / Ajuste (+)', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
        { value: 'ADJUSTMENT_OUT', label: 'Salida / Ajuste (-)', color: 'text-rose-600 bg-rose-50 border-rose-200' },
        { value: 'DAMAGED', label: 'Merma / Dañado (-)', color: 'text-orange-600 bg-orange-50 border-orange-200' },
        { value: 'INTERNAL_USE', label: 'Uso Interno (-)', color: 'text-indigo-600 bg-indigo-50 border-indigo-200' }
    ];

    useEffect(() => {
        if (isOpen) {
            setStep(1);
            setSearchTerm('');
            setSelectedProduct(null);
            setLoadingProducts(true);
            setAdjustmentData({
                type: 'ADJUSTMENT_IN',
                quantity: 1,
                unit: null,
                reason: ''
            });

            apiClient.get('/products/')
                .then(res => setProducts(res.data))
                .catch(err => {
                    console.error(err);
                    toast.error('Error al cargar catálogo');
                })
                .finally(() => setLoadingProducts(false));
        }
    }, [isOpen]);

    const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));

    const handleSelectProduct = (product) => {
        setSelectedProduct(product);
        setAdjustmentData(prev => ({
            ...prev,
            unit: { name: product.unit_type, factor: 1 }
        }));
        setStep(2);
    };

    const handleSubmit = async () => {
        try {
            if (!selectedProduct || !adjustmentData.unit) return;

            const totalQuantity = Number(adjustmentData.quantity) * Number(adjustmentData.unit.factor);

            const payload = {
                product_id: selectedProduct.id,
                type: adjustmentData.type,
                quantity: totalQuantity,
                reason: adjustmentData.reason
            };

            const endpoint = ['ADJUSTMENT_IN', 'PURCHASE'].includes(adjustmentData.type)
                ? '/inventory/add'
                : '/inventory/remove';

            await apiClient.post(endpoint, payload);

            toast.success('Ajuste registrado exitosamente');
            onSuccess();
            onClose();
        } catch (error) {
            console.error("Adjustment failed", error);
            toast.error('Error al registrar ajuste: ' + (error.response?.data?.detail || error.message));
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden transform transition-all scale-100 flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-white sticky top-0 z-10">
                    <div>
                        <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <Filter className="text-indigo-600" size={24} />
                            {step === 1 ? 'Seleccionar Producto' : 'Detalles del Ajuste'}
                        </h3>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                            {step === 1 ? 'Busca el artículo a ajustar' : `Ajustando: ${selectedProduct?.name}`}
                        </p>
                    </div>

                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-xl transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                    {step === 1 && (
                        <div className="space-y-4">
                            <div className="relative group">
                                <Search className="absolute left-4 top-3.5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
                                <input
                                    type="text"
                                    placeholder="Buscar por nombre o código..."
                                    className="w-full pl-11 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-medium text-slate-700 transition-all bg-slate-50 focus:bg-white"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    autoFocus
                                />
                            </div>

                            <div className="space-y-2">
                                {loadingProducts && (
                                    <div className="text-center py-8 text-slate-400">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-2"></div>
                                        Cargando catálogo...
                                    </div>
                                )}

                                {!loadingProducts && filteredProducts.length === 0 && (
                                    <div className="text-center py-10 border-2 border-dashed border-slate-100 rounded-xl bg-slate-50/50">
                                        <Package className="mx-auto text-slate-300 mb-2" size={32} />
                                        <p className="text-slate-500 font-medium">No se encontraron productos.</p>
                                    </div>
                                )}

                                {!loadingProducts && filteredProducts.map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => handleSelectProduct(p)}
                                        className="w-full text-left p-4 border border-slate-100 rounded-xl hover:border-indigo-200 hover:bg-indigo-50/30 transition-all group flex items-start gap-3"
                                    >
                                        <div className="bg-indigo-100 text-indigo-600 p-2 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                            <Box size={20} />
                                        </div>
                                        <div className="flex-1">
                                            <div className="font-bold text-slate-800 group-hover:text-indigo-700 transition-colors">{p.name}</div>
                                            <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                                                <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-mono">SKU: {p.sku || 'N/A'}</span>
                                                <span>•</span>
                                                <span className={Number(p.stock) > 0 ? "text-emerald-600 font-bold" : "text-rose-600 font-bold"}>
                                                    Stock: {p.stock} {p.unit_type}
                                                </span>
                                            </div>
                                        </div>
                                        <ArrowRight className="text-slate-300 group-hover:text-indigo-400 self-center" size={18} />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {step === 2 && selectedProduct && (
                        <div className="space-y-6">
                            {/* Product Summary */}
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-start gap-4">
                                <div className="bg-white p-2 rounded-lg shadow-sm border border-slate-100 text-indigo-600">
                                    <Box size={24} />
                                </div>
                                <div>
                                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">Producto Seleccionado</div>
                                    <div className="font-bold text-slate-800 text-lg">{selectedProduct.name}</div>
                                    <div className="text-sm text-slate-500 mt-1">
                                        Stock actual: <span className="font-bold text-slate-700">{selectedProduct.stock} {selectedProduct.unit_type}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Movement Type Grid */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tipo de Movimiento</label>
                                <div className="grid grid-cols-1 gap-2">
                                    {MOVEMENT_TYPES.map(t => (
                                        <label
                                            key={t.value}
                                            className={clsx(
                                                "flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all",
                                                adjustmentData.type === t.value
                                                    ? `ring-1 ring-inset ${t.color}`
                                                    : "border-slate-200 hover:bg-slate-50 text-slate-600"
                                            )}
                                        >
                                            <input
                                                type="radio"
                                                name="movementType"
                                                value={t.value}
                                                checked={adjustmentData.type === t.value}
                                                onChange={(e) => setAdjustmentData({ ...adjustmentData, type: e.target.value })}
                                                className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                                            />
                                            <span className="font-bold text-sm">{t.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Unidad</label>
                                    <select
                                        className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none bg-white font-medium text-slate-700"
                                        onChange={(e) => {
                                            const [name, factor] = e.target.value.split('|');
                                            setAdjustmentData({ ...adjustmentData, unit: { name, factor: Number(factor) } });
                                        }}
                                        value={adjustmentData.unit ? `${adjustmentData.unit.name}|${adjustmentData.unit.factor}` : ''}
                                    >
                                        <option value={`${selectedProduct.unit_type}|1`}>{selectedProduct.unit_type} (Base)</option>
                                        {selectedProduct.units?.map((pres, idx) => (
                                            <option key={idx} value={`${pres.unit_name}|${pres.conversion_factor}`}>
                                                {pres.unit_name} (x{pres.conversion_factor})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Cantidad</label>
                                    <input
                                        type="number"
                                        min="0.001"
                                        step="0.001"
                                        className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-bold text-slate-700 text-center"
                                        value={adjustmentData.quantity}
                                        onChange={(e) => setAdjustmentData({ ...adjustmentData, quantity: e.target.value })}
                                    />
                                </div>
                            </div>

                            {/* Calculation Preview */}
                            <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100 flex items-center justify-between">
                                <span className="text-xs font-bold text-indigo-700 uppercase tracking-wide">Impacto en Stock:</span>
                                <span className={clsx(
                                    "text-sm font-black mono",
                                    ['ADJUSTMENT_IN'].includes(adjustmentData.type) ? "text-emerald-600" : "text-rose-600"
                                )}>
                                    {['ADJUSTMENT_IN'].includes(adjustmentData.type) ? '+' : '-'} {Number(adjustmentData.quantity) * (adjustmentData.unit?.factor || 1)} {selectedProduct.unit_type}
                                </span>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Motivo / Nota</label>
                                <textarea
                                    className="w-full p-3 border border-slate-200 rounded-xl h-24 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none resize-none text-sm"
                                    value={adjustmentData.reason}
                                    onChange={(e) => setAdjustmentData({ ...adjustmentData, reason: e.target.value })}
                                    placeholder="Explica la razón del ajuste (opcional)..."
                                ></textarea>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-5 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3 sticky bottom-0 z-10">
                    {step === 2 && (
                        <button
                            onClick={() => setStep(1)}
                            className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800 font-bold rounded-xl transition-colors shadow-sm"
                        >
                            Atrás
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 font-bold rounded-xl transition-colors"
                    >
                        Cancelar
                    </button>

                    {step === 2 && (
                        <button
                            onClick={handleSubmit}
                            className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 hover:shadow-indigo-300 transition-all active:scale-95 flex items-center gap-2"
                        >
                            <Save size={18} />
                            Confirmar Ajuste
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdjustmentModal;
