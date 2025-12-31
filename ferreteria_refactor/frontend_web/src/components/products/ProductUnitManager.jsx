import { useState, useMemo, useEffect } from 'react';
import { Layers, Plus, Trash2, Package, Divide, Info, DollarSign, TrendingUp, Tag, Edit2, X, Check } from 'lucide-react';
import clsx from 'clsx';

const ProductUnitManager = ({ units, onUnitsChange, baseUnitType, basePrice, baseCost, exchangeRates, productExchangeRateId }) => {
    const [isWizardOpen, setIsWizardOpen] = useState(false);
    const [wizardStep, setWizardStep] = useState(1); // 1: Type, 2: Details & Pricing
    const [editingUnitId, setEditingUnitId] = useState(null);

    // Wizard State
    const [newUnit, setNewUnit] = useState({
        unit_name: '',
        type: 'packing', // 'packing' | 'fraction'
        user_input: 1,
        barcode: '',
        cost_price: 0,
        profit_margin: '',
        price_usd: '',
        discount_percentage: 0,
        is_discount_active: false,
        exchange_rate_id: ''
    });

    // Calculated values
    const [calculatedPrice, setCalculatedPrice] = useState(null);
    const [calculatedMargin, setCalculatedMargin] = useState(null);
    const [finalPriceWithDiscount, setFinalPriceWithDiscount] = useState(null);
    const [savingsVsUnit, setSavingsVsUnit] = useState(null);

    // Calculate unit cost when factor changes
    useEffect(() => {
        if (newUnit.user_input && baseCost) {
            const factor = parseFloat(newUnit.user_input);
            const cost = parseFloat(baseCost);
            const unitCost = newUnit.type === 'packing' ? cost * factor : cost / factor;
            setNewUnit(prev => ({ ...prev, cost_price: unitCost.toFixed(4) }));
        }
    }, [newUnit.user_input, newUnit.type, baseCost]);

    // Auto-calculate price
    useEffect(() => {
        if (newUnit.cost_price && newUnit.profit_margin) {
            const cost = parseFloat(newUnit.cost_price);
            const margin = parseFloat(newUnit.profit_margin);
            if (cost > 0 && margin >= 0) {
                const price = cost * (1 + margin / 100);
                setCalculatedPrice(price.toFixed(2));
                setNewUnit(prev => ({ ...prev, price_usd: price.toFixed(2) }));
            }
        } else {
            setCalculatedPrice(null);
        }
    }, [newUnit.cost_price, newUnit.profit_margin]);

    // Reverse-calculate margin
    useEffect(() => {
        if (newUnit.cost_price && newUnit.price_usd && !newUnit.profit_margin) {
            const cost = parseFloat(newUnit.cost_price);
            const price = parseFloat(newUnit.price_usd);
            if (cost > 0) {
                const margin = ((price - cost) / cost) * 100;
                setCalculatedMargin(margin.toFixed(2));
            } else {
                setCalculatedMargin(null);
            }
        } else {
            setCalculatedMargin(null);
        }
    }, [newUnit.cost_price, newUnit.price_usd, newUnit.profit_margin]);

    // Calculate final price with discount
    useEffect(() => {
        if (newUnit.price_usd && newUnit.is_discount_active && newUnit.discount_percentage) {
            const price = parseFloat(newUnit.price_usd);
            const discount = parseFloat(newUnit.discount_percentage);
            if (price > 0 && discount > 0) {
                const final = price * (1 - discount / 100);
                setFinalPriceWithDiscount(final.toFixed(2));
            } else {
                setFinalPriceWithDiscount(null);
            }
        } else {
            setFinalPriceWithDiscount(null);
        }
    }, [newUnit.price_usd, newUnit.discount_percentage, newUnit.is_discount_active]);

    // Calculate savings
    useEffect(() => {
        if (newUnit.price_usd && basePrice && newUnit.user_input && newUnit.type === 'packing') {
            const unitPrice = parseFloat(newUnit.price_usd);
            const factor = parseFloat(newUnit.user_input);
            const basePriceNum = parseFloat(basePrice);
            const totalIfBuyingSeparate = basePriceNum * factor;
            const savings = totalIfBuyingSeparate - unitPrice;
            const savingsPercent = totalIfBuyingSeparate > 0 ? (savings / totalIfBuyingSeparate) * 100 : 0;

            if (savings > 0) {
                setSavingsVsUnit({ amount: savings.toFixed(2), percent: savingsPercent.toFixed(1) });
            } else {
                setSavingsVsUnit(null);
            }
        } else {
            setSavingsVsUnit(null);
        }
    }, [newUnit.price_usd, basePrice, newUnit.user_input, newUnit.type]);

    const resetWizard = () => {
        setNewUnit({
            unit_name: '',
            type: 'packing',
            user_input: 1,
            barcode: '',
            cost_price: 0,
            profit_margin: '',
            price_usd: '',
            discount_percentage: 0,
            is_discount_active: false,
            exchange_rate_id: ''
        });
        setWizardStep(1);
        setIsWizardOpen(false);
        setEditingUnitId(null);
        setCalculatedPrice(null);
        setCalculatedMargin(null);
        setFinalPriceWithDiscount(null);
        setSavingsVsUnit(null);
    };

    const handleEditUnit = (unit) => {
        setNewUnit({
            unit_name: unit.unit_name,
            type: unit.type,
            user_input: unit.user_input,
            barcode: unit.barcode || '',
            cost_price: unit.cost_price || 0,
            profit_margin: unit.profit_margin || '',
            price_usd: unit.price_usd || '',
            discount_percentage: unit.discount_percentage || 0,
            is_discount_active: unit.is_discount_active || false,
            exchange_rate_id: unit.exchange_rate_id || ''
        });
        setEditingUnitId(unit.id);
        setWizardStep(2);
        setIsWizardOpen(true);
    };

    const handleAddUnit = () => {
        let finalFactor = parseFloat(newUnit.user_input);
        if (newUnit.type === 'fraction') {
            finalFactor = finalFactor !== 0 ? 1 / finalFactor : 0;
        }

        const unitData = {
            unit_name: newUnit.unit_name,
            user_input: parseFloat(newUnit.user_input),
            conversion_factor: finalFactor,
            type: newUnit.type,
            barcode: newUnit.barcode,
            cost_price: parseFloat(newUnit.cost_price) || 0,
            profit_margin: newUnit.profit_margin ? parseFloat(newUnit.profit_margin) : null,
            price_usd: parseFloat(newUnit.price_usd) || 0,
            discount_percentage: parseFloat(newUnit.discount_percentage) || 0,
            is_discount_active: newUnit.is_discount_active,
            exchange_rate_id: newUnit.exchange_rate_id ? parseInt(newUnit.exchange_rate_id) : null
        };

        if (editingUnitId) {
            const updatedUnits = units.map(u =>
                u.id === editingUnitId ? { ...unitData, id: editingUnitId } : u
            );
            onUnitsChange(updatedUnits);
        } else {
            const unitToAdd = {
                ...unitData,
                id: Date.now()
            };
            onUnitsChange([...units, unitToAdd]);
        }

        resetWizard();
    };

    const feedbackMessage = useMemo(() => {
        const val = parseFloat(newUnit.user_input) || 0;
        if (newUnit.type === 'packing') {
            return `✅ Perfecto: 1 ${newUnit.unit_name || '[Unidad]'} contiene ${val} ${baseUnitType || 'Unidades'}.`;
        } else {
            const exampleQty = Math.round(val / 4);
            const exampleDeduction = (exampleQty / val).toFixed(3);
            return `✅ Perfecto: Hay ${val} ${newUnit.unit_name || '[Unidades]'} en 1 ${baseUnitType || 'Unidad'}.`;
        }
    }, [newUnit.user_input, newUnit.type, newUnit.unit_name, baseUnitType]);

    const renderWizard = () => (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200 flex flex-col">
                <div className="bg-white border-b border-slate-100 p-6 sticky top-0 z-10 flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-bold flex items-center text-slate-800 gap-2">
                            <Layers className="text-indigo-600" size={24} /> {editingUnitId ? 'Editar Presentación' : 'Nueva Presentación'}
                        </h3>
                        <p className="text-slate-500 text-sm mt-1 font-medium">
                            {editingUnitId ? 'Modifica los datos de la presentación' : `Paso ${wizardStep} de 2: ${wizardStep === 1 ? 'Tipo de Unidad' : 'Detalles y Precios'}`}
                        </p>
                    </div>
                    <button onClick={resetWizard} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 hover:text-slate-600">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-8 flex-1 overflow-y-auto bg-slate-50/50">
                    {wizardStep === 1 && !editingUnitId ? (
                        <div className="space-y-4">
                            <p className="text-slate-600 mb-6 font-medium text-lg text-center">¿Qué tipo de unidad deseas agregar?</p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <button
                                    onClick={() => { setNewUnit({ ...newUnit, type: 'packing' }); setWizardStep(2); }}
                                    className="p-6 bg-white border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/50 rounded-2xl transition-all flex flex-col items-center text-center shadow-sm hover:shadow-md group"
                                >
                                    <div className="bg-indigo-50 text-indigo-600 p-4 rounded-full mb-4 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                        <Package size={32} />
                                    </div>
                                    <h4 className="font-bold text-slate-800 text-lg mb-2">Unidad Mayorista</h4>
                                    <p className="text-sm text-slate-500 leading-relaxed">
                                        Contiene múltiples unidades base.<br />Ej: Caja de 12, Bulto de 50.
                                    </p>
                                </button>

                                <button
                                    onClick={() => { setNewUnit({ ...newUnit, type: 'fraction' }); setWizardStep(2); }}
                                    className="p-6 bg-white border border-slate-200 hover:border-pink-500 hover:bg-pink-50/50 rounded-2xl transition-all flex flex-col items-center text-center shadow-sm hover:shadow-md group"
                                >
                                    <div className="bg-pink-50 text-pink-600 p-4 rounded-full mb-4 group-hover:bg-pink-600 group-hover:text-white transition-colors">
                                        <Divide size={32} />
                                    </div>
                                    <h4 className="font-bold text-slate-800 text-lg mb-2">Unidad Fraccionaria</h4>
                                    <p className="text-sm text-slate-500 leading-relaxed">
                                        Es una parte de la unidad base.<br />Ej: Gramos, Metros, Litros.
                                    </p>
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            {/* Basic Info */}
                            <div className="space-y-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Información Básica</h4>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Nombre de la Unidad</label>
                                    <input
                                        autoFocus
                                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-medium text-slate-700"
                                        placeholder={newUnit.type === 'packing' ? "Ej: Caja, Bulto, Paquete" : "Ej: Gramo, Metro"}
                                        value={newUnit.unit_name}
                                        onChange={e => setNewUnit({ ...newUnit, unit_name: e.target.value })}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                            {newUnit.type === 'packing' ? 'Cantidad de Unidades' : 'Divisor'}
                                        </label>
                                        <input
                                            type="number"
                                            step="any"
                                            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-bold text-slate-700"
                                            placeholder="1"
                                            value={newUnit.user_input}
                                            onChange={e => setNewUnit({ ...newUnit, user_input: e.target.value })}
                                        />
                                        <p className="text-[10px] text-slate-400 mt-1">
                                            {newUnit.type === 'packing'
                                                ? `Cuántos ${baseUnitType || 'items'} contiene.`
                                                : `Cuántos caben en 1 ${baseUnitType || 'item'}.`
                                            }
                                        </p>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Código de Barras</label>
                                        <input
                                            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-medium text-slate-700"
                                            placeholder="Opcional"
                                            value={newUnit.barcode}
                                            onChange={e => setNewUnit({ ...newUnit, barcode: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="bg-blue-50/50 text-blue-700 p-3 rounded-xl flex items-start text-xs border border-blue-100 font-medium">
                                    <Info size={16} className="mr-2 mt-0.5 flex-shrink-0" />
                                    <span>{feedbackMessage}</span>
                                </div>
                            </div>

                            {/* Cost & Price Preview */}
                            {newUnit.user_input > 0 && basePrice && (
                                <div className="p-5 border border-indigo-100 rounded-2xl bg-indigo-50/30 space-y-3">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-bold text-indigo-700">💰 Precio Calculado (Ref)</span>
                                        <span className="text-2xl font-black text-indigo-900">
                                            ${newUnit.type === 'packing'
                                                ? (parseFloat(basePrice) * parseFloat(newUnit.user_input)).toFixed(2)
                                                : (parseFloat(basePrice) / parseFloat(newUnit.user_input)).toFixed(4)
                                            }
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Pricing Section */}
                            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2 flex items-center">
                                    <DollarSign className="mr-2" size={14} /> Configuración de Precio
                                </h4>

                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">% Ganancia</label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={newUnit.profit_margin}
                                                onChange={(e) => setNewUnit({ ...newUnit, profit_margin: e.target.value })}
                                                className="w-full pr-8 border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-emerald-500/20 py-2.5 text-sm font-medium"
                                                placeholder="30"
                                            />
                                            <span className="absolute right-3 top-2.5 text-slate-400 font-bold text-xs">%</span>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Precio Venta USD</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-2.5 text-emerald-600 font-bold text-sm">$</span>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={newUnit.price_usd}
                                                onChange={(e) => setNewUnit({ ...newUnit, price_usd: e.target.value })}
                                                className="w-full pl-8 border border-emerald-200 rounded-xl focus:border-emerald-500 focus:ring-emerald-500/20 py-2.5 font-bold text-emerald-700 text-sm"
                                                placeholder="0.00"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Exchange Rate Section */}
                            <div className="border border-purple-200 rounded-2xl p-6 bg-purple-50/20">
                                <h4 className="text-xs font-bold text-purple-700 uppercase tracking-wider mb-4 border-b border-purple-200 pb-2 flex items-center">
                                    💱 Tasa Diferenciada (Opcional)
                                </h4>
                                <div className="space-y-3">
                                    <select
                                        value={newUnit.exchange_rate_id || ''}
                                        onChange={(e) => setNewUnit({ ...newUnit, exchange_rate_id: e.target.value })}
                                        className="w-full border border-purple-200 rounded-xl focus:border-purple-500 focus:ring-purple-500/20 py-2.5 text-sm font-medium bg-white"
                                    >
                                        <option value="">🔗 Usar Tasa del Producto (Default)</option>
                                        {exchangeRates && exchangeRates.filter(r => r.is_active).map(rate => (
                                            <option key={rate.id} value={rate.id}>
                                                {rate.name} ({rate.currency_code}) - {rate.rate}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Savings vs Unit */}
                            {savingsVsUnit && (
                                <div className="bg-amber-50 rounded-xl p-4 border border-amber-100 flex items-center justify-between">
                                    <div>
                                        <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wide">Ahorro por Volumen</h4>
                                        <p className="text-[10px] text-amber-600 font-medium">vs comprar suelto</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-lg font-black text-amber-900">${savingsVsUnit.amount}</p>
                                        <span className="text-[10px] font-bold bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full">{savingsVsUnit.percent}% OFF</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="bg-white p-6 flex justify-end gap-3 border-t border-slate-100 sticky bottom-0 z-20">
                    {wizardStep === 2 && !editingUnitId && (
                        <button onClick={() => setWizardStep(1)} className="px-5 py-2.5 text-slate-600 hover:bg-slate-50 rounded-xl font-bold transition-colors">Atrás</button>
                    )}
                    <button onClick={resetWizard} className="px-5 py-2.5 text-rose-600 hover:bg-rose-50 rounded-xl font-bold transition-colors">Cancelar</button>
                    {(wizardStep === 2 || editingUnitId) && (
                        <button
                            disabled={!newUnit.unit_name || !newUnit.user_input || !newUnit.price_usd}
                            onClick={handleAddUnit}
                            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 hover:shadow-indigo-300 transition-all active:scale-95 disabled:opacity-50 disabled:shadow-none flex items-center gap-2"
                        >
                            <Check size={18} />
                            {editingUnitId ? 'Actualizar' : 'Guardar Unidad'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-bold text-slate-800">Unidades y Presentaciones</h3>
                    <p className="text-slate-500 text-sm font-medium">Administra cajas, bultos y fracciones.</p>
                </div>
                <button
                    onClick={() => setIsWizardOpen(true)}
                    className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl font-semibold shadow-lg shadow-slate-200 transition-all flex items-center text-sm"
                >
                    <Plus size={18} className="mr-2" /> Nueva Presentación
                </button>
            </div>

            {units.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                    <Layers className="mx-auto text-slate-300 mb-4" size={48} />
                    <p className="text-slate-500 font-bold">Solo se vende por unidad base ({baseUnitType}).</p>
                    <p className="text-sm text-slate-400 mt-1 font-medium">Agrega presentaciones (Cajas, Litros, etc.) si es necesario.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {units.map((unit) => (
                        <div key={unit.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative group">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-3">
                                    <div className={clsx(
                                        "p-2.5 rounded-xl",
                                        unit.type === 'packing' ? 'bg-indigo-50 text-indigo-600' : 'bg-pink-50 text-pink-600'
                                    )}>
                                        {unit.type === 'packing' ? <Package size={20} /> : <Divide size={20} />}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-800 text-lg leading-tight">{unit.unit_name}</h4>
                                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                                            {unit.type === 'packing' ? 'Empaque' : 'Fracción'}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => handleEditUnit(unit)}
                                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                        title="Editar"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button
                                        onClick={() => onUnitsChange(units.filter(u => u.id !== unit.id))}
                                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                        title="Eliminar"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2 text-sm bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                                <div className="flex justify-between border-b border-slate-200 pb-2 mb-2">
                                    <span className="text-slate-500 font-medium">Contenido</span>
                                    <span className="font-bold text-slate-700">
                                        {unit.type === 'packing' ? `${unit.user_input} x ${baseUnitType}` : `1 / ${unit.user_input} ${baseUnitType}`}
                                    </span>
                                </div>

                                {unit.price_usd > 0 && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-500 font-medium">Precio</span>
                                        <span className="font-black text-emerald-600 text-lg">${Number(unit.price_usd).toFixed(2)}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {isWizardOpen && renderWizard()}
        </div>
    );
};

export default ProductUnitManager;
