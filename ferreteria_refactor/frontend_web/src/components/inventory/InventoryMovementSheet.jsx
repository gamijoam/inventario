import { useState, useEffect, useCallback } from 'react';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
    SheetFooter
} from '../ui/sheet';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import {
    Search,
    Package,
    Box,
    Filter,
    CheckCircle2,
    AlertCircle,
    ArrowRight,
    ArrowUpCircle,
    ArrowDownCircle
} from 'lucide-react';
import apiClient from '../../config/axios';
import { toast } from 'react-hot-toast';
import { cn } from '../../utils/cn';

const InventoryMovementSheet = ({ isOpen, onClose, onSuccess }) => {
    const [step, setStep] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [products, setProducts] = useState([]);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [loadingProducts, setLoadingProducts] = useState(false);
    const [warehouses, setWarehouses] = useState([]);

    const [adjustmentData, setAdjustmentData] = useState({
        type: 'ADJUSTMENT_IN', // ADJUSTMENT_IN, ADJUSTMENT_OUT, DAMAGED, INTERNAL_USE
        quantity: 1,
        unit: null,
        reason: '',
        warehouse_id: ''
    });

    const isInternal = ['INTERNAL_USE', 'DAMAGED', 'ADJUSTMENT_OUT'].includes(adjustmentData.type);

    const MOVEMENT_TYPES = [
        {
            value: 'ADJUSTMENT_IN',
            label: 'Entrada / Ajuste (+)',
            icon: ArrowUpCircle,
            color: 'text-emerald-600 bg-emerald-50 border-emerald-200 ring-emerald-500'
        },
        {
            value: 'ADJUSTMENT_OUT',
            label: 'Salida / Ajuste (-)',
            icon: ArrowDownCircle,
            color: 'text-rose-600 bg-rose-50 border-rose-200 ring-rose-500'
        },
        {
            value: 'DAMAGED',
            label: 'Merma / Dañado (-)',
            icon: AlertCircle,
            color: 'text-orange-600 bg-orange-50 border-orange-200 ring-orange-500'
        },
        {
            value: 'INTERNAL_USE',
            label: 'Uso Interno (-)',
            icon: Box,
            color: 'text-indigo-600 bg-indigo-50 border-indigo-200 ring-indigo-500'
        }
    ];

    // Fetch warehouses on open (static, low count)
    useEffect(() => {
        if (isOpen) {
            setStep(1);
            setSearchTerm('');
            setSelectedProduct(null);
            setAdjustmentData({
                type: 'ADJUSTMENT_IN',
                quantity: 1,
                unit: null,
                reason: '',
                warehouse_id: ''
            });

            apiClient.get('/warehouses')
                .then(whRes => {
                    setWarehouses(whRes.data);
                    if (whRes.data?.length > 0) {
                        const mainWh = whRes.data.find(w => w.is_main) || whRes.data[0];
                        setAdjustmentData(prev => ({ ...prev, warehouse_id: mainWh.id }));
                    }
                })
                .catch(err => {
                    console.error(err);
                    toast.error('Error al cargar datos necesarios');
                });
        }
    }, [isOpen]);

    // Server-side product search with debounce
    const searchProducts = useCallback(async (query) => {
        setLoadingProducts(true);
        try {
            const params = { limit: 500 };
            if (query && query.trim().length >= 1) {
                params.search = query.trim();
            }
            const { data } = await apiClient.get('/products/', { params });
            setProducts(Array.isArray(data) ? data : (data?.items || []));
        } catch (err) {
            console.error(err);
            toast.error('Error al buscar productos');
        } finally {
            setLoadingProducts(false);
        }
    }, []);

    // Debounced search effect
    useEffect(() => {
        const timer = setTimeout(() => {
            if (isOpen && step === 1) {
                searchProducts(searchTerm);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm, isOpen, step, searchProducts]);

    const filteredProducts = products;

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
                reason: adjustmentData.reason,
                warehouse_id: adjustmentData.warehouse_id
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
            let errorMessage = 'Error al registrar ajuste';
            try {
                if (error.response?.data?.detail) {
                    errorMessage = typeof error.response.data.detail === 'string'
                        ? error.response.data.detail
                        : JSON.stringify(error.response.data.detail);
                }
            } catch (e) { console.error(e); }
            toast.error(errorMessage);
        }
    };

    return (
        <Sheet open={isOpen} onOpenChange={onClose}>
            <SheetContent side="left" className="w-full sm:max-w-2xl p-0 flex flex-col h-full">
                <SheetHeader className="px-6 py-4 border-b border-slate-100 bg-white sticky top-0 z-10">
                    <SheetTitle className="flex items-center gap-2">
                        {step === 1 ? (
                            <>
                                <Search className="text-indigo-600" size={20} />
                                Selección de Producto
                            </>
                        ) : (
                            <>
                                <Filter className="text-indigo-600" size={20} />
                                Detalles del Movimiento
                            </>
                        )}
                    </SheetTitle>
                    <SheetDescription>
                        {step === 1
                            ? 'Busca el artículo que deseas ajustar o mover.'
                            : `Registrando movimiento para: ${selectedProduct?.name}`
                        }
                    </SheetDescription>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar">
                    {step === 1 && (
                        <div className="space-y-6">
                            <div className="relative">
                                <Search className="absolute left-3 top-3 text-slate-400" size={18} />
                                <Input
                                    placeholder="Buscar por nombre o código..."
                                    className="pl-10 h-11 bg-slate-50 border-slate-200 focus:bg-white transition-all"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    autoFocus
                                />
                            </div>

                            <div className="space-y-3">
                                {loadingProducts ? (
                                    <div className="text-center py-12 text-slate-400">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-3"></div>
                                        Cargando catálogo...
                                    </div>
                                ) : filteredProducts.length === 0 ? (
                                    <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-xl bg-slate-50/50">
                                        <Package className="mx-auto text-slate-300 mb-2" size={32} />
                                        <p className="text-slate-500 font-medium">No se encontraron productos.</p>
                                    </div>
                                ) : (
                                    filteredProducts.map(p => (
                                        <button
                                            key={p.id}
                                            onClick={() => handleSelectProduct(p)}
                                            className="w-full text-left p-3 border border-slate-100 rounded-xl hover:border-indigo-200 hover:bg-indigo-50/30 transition-all group flex items-start gap-3 bg-white shadow-sm"
                                        >
                                            <div className="bg-indigo-50 text-indigo-600 p-2 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                                <Box size={20} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-bold text-slate-800 group-hover:text-indigo-700 transition-colors truncate">
                                                    {p.name}
                                                </div>
                                                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                                    <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-mono border border-slate-200">
                                                        SKU: {p.sku || 'N/A'}
                                                    </span>
                                                    <span className={cn(
                                                        "text-[10px] font-bold px-1.5 py-0.5 rounded border",
                                                        Number(p.stock) > 0
                                                            ? "text-emerald-700 bg-emerald-50 border-emerald-100"
                                                            : "text-rose-700 bg-rose-50 border-rose-100"
                                                    )}>
                                                        Stock: {p.stock} {p.unit_type}
                                                    </span>
                                                </div>
                                            </div>
                                            <ArrowRight className="text-slate-300 group-hover:text-indigo-400 self-center shrink-0" size={18} />
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {step === 2 && selectedProduct && (
                        <div className="space-y-6">
                            {/* Product Summary Card */}
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-start gap-4">
                                <div className="bg-white p-2.5 rounded-xl shadow-sm border border-slate-100 text-indigo-600">
                                    <Box size={24} />
                                </div>
                                <div>
                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Producto Seleccionado</div>
                                    <h4 className="font-bold text-slate-800 text-base leading-tight">{selectedProduct.name}</h4>
                                    <div className="text-xs text-slate-500 mt-1">
                                        Stock actual: <span className="font-bold text-slate-700">{selectedProduct.stock} {selectedProduct.unit_type}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Movement Type Selection */}
                            <div className="space-y-3">
                                <Label>Tipo de Movimiento</Label>
                                <div className="grid grid-cols-1 gap-2">
                                    {MOVEMENT_TYPES.map(t => {
                                        const Icon = t.icon;
                                        const isSelected = adjustmentData.type === t.value;
                                        return (
                                            <div
                                                key={t.value}
                                                onClick={() => setAdjustmentData({ ...adjustmentData, type: t.value })}
                                                className={cn(
                                                    "flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all relative overflow-hidden",
                                                    isSelected
                                                        ? `bg-white ring-2 ${t.color}`
                                                        : "bg-white border-slate-200 hover:border-indigo-200 hover:bg-slate-50"
                                                )}
                                            >
                                                <div className={cn(
                                                    "p-2 rounded-lg",
                                                    isSelected ? t.color.split(' ')[1] : "bg-slate-100 text-slate-500"
                                                )}>
                                                    <Icon size={18} className={isSelected ? t.color.split(' ')[0] : ""} />
                                                </div>
                                                <span className={cn(
                                                    "font-medium text-sm",
                                                    isSelected ? "text-slate-900" : "text-slate-600"
                                                )}>
                                                    {t.label}
                                                </span>
                                                {isSelected && (
                                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-600">
                                                        <CheckCircle2 size={18} className={t.color.split(' ')[0]} />
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Warehouse & Unit Details */}
                            <div className="grid grid-cols-1 gap-4">
                                <div className="space-y-2">
                                    <Label>Bodega Afectada</Label>
                                    <div className="relative">
                                        <select
                                            className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-white text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none appearance-none"
                                            value={adjustmentData.warehouse_id}
                                            onChange={(e) => setAdjustmentData({ ...adjustmentData, warehouse_id: Number(e.target.value) })}
                                        >
                                            {warehouses.map(wh => (
                                                <option key={wh.id} value={wh.id}>
                                                    {wh.name} {wh.is_main ? '(Principal)' : ''}
                                                </option>
                                            ))}
                                        </select>
                                        <ArrowDownCircle className="absolute right-3 top-3.5 text-slate-400 pointer-events-none" size={16} />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Unidad</Label>
                                        <div className="relative">
                                            <select
                                                className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-white text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none appearance-none"
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
                                            <ArrowDownCircle className="absolute right-3 top-3.5 text-slate-400 pointer-events-none" size={16} />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Cantidad</Label>
                                        <Input
                                            type="number"
                                            min="0.001"
                                            step="0.001"
                                            className="h-11 font-bold text-center"
                                            value={adjustmentData.quantity}
                                            onChange={(e) => setAdjustmentData({ ...adjustmentData, quantity: e.target.value })}
                                        />
                                    </div>
                                </div>

                                {/* Impact Preview */}
                                <div className={cn(
                                    "p-3 rounded-xl border flex items-center justify-between",
                                    isInternal
                                        ? "bg-rose-50 border-rose-100 text-rose-800"
                                        : "bg-emerald-50 border-emerald-100 text-emerald-800"
                                )}>
                                    <span className="text-xs font-bold uppercase tracking-wide">Impacto Total:</span>
                                    <span className="text-sm font-black mono flex items-center gap-1">
                                        {isInternal ? <ArrowDownCircle size={14} /> : <ArrowUpCircle size={14} />}
                                        {Number(adjustmentData.quantity) * (adjustmentData.unit?.factor || 1)} {selectedProduct.unit_type}
                                    </span>
                                </div>

                                <div className="space-y-2">
                                    <Label>Motivo / Nota (Opcional)</Label>
                                    <Textarea
                                        className="resize-none"
                                        placeholder="Describe la razón del ajuste..."
                                        rows={3}
                                        value={adjustmentData.reason}
                                        onChange={(e) => setAdjustmentData({ ...adjustmentData, reason: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <SheetFooter className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex-row gap-3 sm:justify-end">
                    {step === 2 && (
                        <Button
                            variant="outline"
                            className="flex-1 sm:flex-none"
                            onClick={() => setStep(1)}
                        >
                            Atrás
                        </Button>
                    )}
                    <Button
                        variant="ghost"
                        className="flex-1 sm:flex-none"
                        onClick={onClose}
                    >
                        Cancelar
                    </Button>
                    {step === 2 && (
                        <Button
                            className="flex-1 sm:flex-none bg-indigo-600 hover:bg-indigo-700"
                            onClick={handleSubmit}
                        >
                            Confirmar
                        </Button>
                    )}
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
};

export default InventoryMovementSheet;
