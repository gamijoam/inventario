import { useState, useMemo, useEffect } from 'react';
import { Layers, Plus, Trash2, Package, Divide, Info, DollarSign, TrendingUp, Tag, Edit2 } from 'lucide-react';

const ProductUnitManager = ({ units, onUnitsChange, baseUnitType, basePrice, baseCost, exchangeRates, productExchangeRateId }) => {
    const [isWizardOpen, setIsWizardOpen] = useState(false);
    const [wizardStep, setWizardStep] = useState(1); // 1: Type, 2: Details & Pricing
    const [editingUnitId, setEditingUnitId] = useState(null); // Track which unit is being edited

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

    // Auto-calculate price from cost + profit margin
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

    // Reverse-calculate margin from cost + price
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

    // Calculate savings vs buying individual units
    useEffect(() => {
        if (newUnit.price_usd && basePrice && newUnit.user_input && newUnit.type === 'packing') {
            const unitPrice = parseFloat(newUnit.price_usd);
            const factor = parseFloat(newUnit.user_input);
            const basePriceNum = parseFloat(basePrice);
            const totalIfBuyingSeparate = basePriceNum * factor;
            const savings = totalIfBuyingSeparate - unitPrice;
            const savingsPercent = (savings / totalIfBuyingSeparate) * 100;

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
        // Load unit data into wizard
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
        setWizardStep(2); // Skip type selection
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
            // Update existing unit
            const updatedUnits = units.map(u =>
                u.id === editingUnitId ? { ...unitData, id: editingUnitId } : u
            );
            onUnitsChange(updatedUnits);
        } else {
            // Add new unit
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
            return `✅ Perfecto: 1 ${newUnit.unit_name || '[Unidad]'} contiene ${val} ${baseUnitType}. Al venderla, se descontarán ${val} ${baseUnitType} del inventario.`;
        } else {
            const exampleQty = Math.round(val / 4); // Example: 1/4 of the divisor
            const exampleDeduction = (exampleQty / val).toFixed(3);
            return `✅ Perfecto: Hay ${val} ${newUnit.unit_name || '[Unidades]'} en 1 ${baseUnitType}. Ejemplo: Al vender ${exampleQty} ${newUnit.unit_name || '[unidades]'}, se descontarán ${exampleDeduction} ${baseUnitType} del inventario.`;
        }
    }, [newUnit.user_input, newUnit.type, newUnit.unit_name, baseUnitType]);

    const renderWizard = () => (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-fade-in-up flex flex-col">
                <div className="bg-white border-b p-6 sticky top-0 z-10">
                    <h3 className="text-xl font-bold flex items-center text-gray-800">
                        <Layers className="mr-2 text-blue-600" /> {editingUnitId ? 'Editar Presentación' : 'Agregar Nueva Presentación'}
                    </h3>
                    <p className="text-gray-500 text-sm mt-1">
                        {editingUnitId ? 'Modifica los datos de la presentación' : `Paso ${wizardStep} de 2: ${wizardStep === 1 ? 'Tipo de Unidad' : 'Detalles y Precios'}`}
                    </p>
                </div>

                <div className="p-8 flex-1 overflow-y-auto">
                    {wizardStep === 1 && !editingUnitId ? (
                        <div className="space-y-4">
                            <p className="text-gray-600 mb-4 font-medium">¿Qué tipo de unidad deseas agregar?</p>

                            <button
                                onClick={() => { setNewUnit({ ...newUnit, type: 'packing' }); setWizardStep(2); }}
                                className="w-full p-4 border border-gray-200 hover:border-blue-500 hover:bg-blue-50/50 rounded-xl transition-all flex items-center group text-left shadow-sm hover:shadow-md"
                            >
                                <div className="bg-blue-50 text-blue-600 p-3 rounded-lg mr-4 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                    <Package size={24} />
                                </div>
                                <div>
                                    <h4 className="font-bold text-gray-800">Unidad de Empaque (Mayorista)</h4>
                                    <p className="text-sm text-gray-500">Ej: Caja de 12, Bulto de 50. Contiene múltiples unidades base.</p>
                                </div>
                            </button>

                            <button
                                onClick={() => { setNewUnit({ ...newUnit, type: 'fraction' }); setWizardStep(2); }}
                                className="w-full p-4 border border-gray-200 hover:border-indigo-500 hover:bg-indigo-50/50 rounded-xl transition-all flex items-center group text-left shadow-sm hover:shadow-md"
                            >
                                <div className="bg-indigo-50 text-indigo-600 p-3 rounded-lg mr-4 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                    <Divide size={24} />
                                </div>
                                <div>
                                    <h4 className="font-bold text-gray-800">Unidad Fraccionaria (Menudeo)</h4>
                                    <p className="text-sm text-gray-500">Ej: Gramos, Mililitros. Es una parte de la unidad base.</p>
                                </div>
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-8 animate-fade-in-right">
                            {/* Basic Info */}
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Nombre de la Unidad</label>
                                    <input
                                        autoFocus
                                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
                                        placeholder={newUnit.type === 'packing' ? "Ej: Caja, Bulto, Paquete" : "Ej: Gramo, Metro"}
                                        value={newUnit.unit_name}
                                        onChange={e => setNewUnit({ ...newUnit, unit_name: e.target.value })}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">
                                            {newUnit.type === 'packing'
                                                ? `¿Cuántos ${baseUnitType} contiene?`
                                                : `¿Cuántos ${newUnit.unit_name || '[unidades]'} hay en 1 ${baseUnitType}?`
                                            }
                                        </label>
                                        <input
                                            type="number"
                                            step="any"
                                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono font-bold text-lg"
                                            placeholder={newUnit.type === 'packing' ? 'Ej: 12, 50, 100' : 'Ej: 1000 (gramos en 1 kilo)'}
                                            value={newUnit.user_input}
                                            onChange={e => setNewUnit({ ...newUnit, user_input: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">Código de Barras (Opcional)</label>
                                        <input
                                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                            placeholder="Escanea o escribe..."
                                            value={newUnit.barcode}
                                            onChange={e => setNewUnit({ ...newUnit, barcode: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="bg-blue-50 text-blue-800 p-3 rounded-lg flex items-start text-sm border border-blue-100">
                                    <Info size={16} className="mr-2 mt-0.5 flex-shrink-0" />
                                    <span>{feedbackMessage}</span>
                                </div>
                            </div>

                            {/* Cost & Price Preview */}
                            {newUnit.user_input > 0 && basePrice && (
                                <div className="p-5 border-2 border-blue-200 rounded-xl bg-blue-50 space-y-3">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-semibold text-blue-700">💰 Precio Calculado Automáticamente:</span>
                                        <span className="text-3xl font-black text-blue-900">
                                            ${newUnit.type === 'packing'
                                                ? (parseFloat(basePrice) * parseFloat(newUnit.user_input)).toFixed(2)
                                                : (parseFloat(basePrice) / parseFloat(newUnit.user_input)).toFixed(4)
                                            }
                                        </span>
                                    </div>
                                    <div className="text-xs text-blue-600 bg-white/50 p-2 rounded">
                                        {newUnit.type === 'packing'
                                            ? `Cálculo: $${basePrice} × ${newUnit.user_input} = $${(parseFloat(basePrice) * parseFloat(newUnit.user_input)).toFixed(2)}`
                                            : `Cálculo: $${basePrice} ÷ ${newUnit.user_input} = $${(parseFloat(basePrice) / parseFloat(newUnit.user_input)).toFixed(4)}`
                                        }
                                    </div>
                                </div>
                            )}

                            {/* Pricing Section */}
                            <div className="border border-gray-200 rounded-xl p-6 relative">
                                <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 border-b pb-2 flex items-center">
                                    <TrendingUp className="mr-2" size={16} /> Configuración de Precio
                                </h4>

                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">% Ganancia</label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={newUnit.profit_margin}
                                                onChange={(e) => setNewUnit({ ...newUnit, profit_margin: e.target.value })}
                                                className="w-full pr-8 border-gray-300 rounded-lg shadow-sm focus:border-green-500 focus:ring-green-500 py-2"
                                                placeholder="Ej: 30"
                                            />
                                            <span className="absolute right-3 top-2 text-gray-500 font-bold">%</span>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">Precio Venta USD</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-2 text-gray-500 font-bold">$</span>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={newUnit.price_usd}
                                                onChange={(e) => setNewUnit({ ...newUnit, price_usd: e.target.value })}
                                                className="w-full pl-8 border-green-300 rounded-lg shadow-sm focus:border-green-500 focus:ring-green-500 py-2 font-bold text-green-700"
                                                placeholder="0.00"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {calculatedPrice && (
                                    <div className="mt-2 text-right text-xs text-gray-500">
                                        Precio Sugerido: <span className="font-bold text-green-600">${calculatedPrice}</span>
                                    </div>
                                )}
                            </div>

                            {/* Exchange Rate Section */}
                            <div className="border border-purple-200 rounded-xl p-6 bg-purple-50/30">
                                <h4 className="text-sm font-bold text-purple-700 uppercase tracking-wider mb-4 border-b border-purple-200 pb-2 flex items-center">
                                    💱 Tasa de Cambio Específica
                                </h4>
                                <div className="space-y-3">
                                    <p className="text-xs text-purple-600 bg-white/70 p-2 rounded">
                                        Por defecto, esta presentación hereda la tasa del producto. Solo cambia esto si necesitas una tasa diferente (ej: importaciones).
                                    </p>
                                    <select
                                        value={newUnit.exchange_rate_id || ''}
                                        onChange={(e) => setNewUnit({ ...newUnit, exchange_rate_id: e.target.value })}
                                        className="w-full border-purple-300 rounded-lg shadow-sm focus:border-purple-500 focus:ring-purple-500 py-2"
                                    >
                                        <option value="">🔗 Heredar del Producto</option>
                                        {exchangeRates && exchangeRates.filter(r => r.is_active).map(rate => (
                                            <option key={rate.id} value={rate.id}>
                                                {rate.name} ({rate.currency_code}) - {rate.rate} {rate.is_default ? '⭐ Default' : ''}
                                            </option>
                                        ))}
                                    </select>
                                    {newUnit.exchange_rate_id && (
                                        <div className="bg-purple-100 text-purple-800 p-2 rounded text-xs font-semibold flex items-center gap-2">
                                            ⚠️ Esta presentación usará una tasa diferente al producto base
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Discount Toggle */}
                            <div className="border border-gray-200 rounded-xl p-4">
                                <label className="flex items-center justify-between cursor-pointer">
                                    <div className="flex items-center gap-2">
                                        <Tag size={16} className="text-red-500" />
                                        <span className="font-semibold text-gray-700">Descuento Promocional</span>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={newUnit.is_discount_active}
                                        onChange={(e) => setNewUnit({ ...newUnit, is_discount_active: e.target.checked })}
                                        className="w-5 h-5 text-red-600 border-gray-300 rounded focus:ring-red-500"
                                    />
                                </label>

                                {newUnit.is_discount_active && (
                                    <div className="mt-4 pt-4 border-t border-gray-100 animate-fade-in-down flex items-center gap-4">
                                        <div className="w-1/2">
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">% Off</label>
                                            <input
                                                type="number"
                                                value={newUnit.discount_percentage}
                                                onChange={(e) => setNewUnit({ ...newUnit, discount_percentage: e.target.value })}
                                                className="w-full border-red-200 rounded-lg py-2 px-3 focus:border-red-500 focus:ring-red-500"
                                            />
                                        </div>
                                        <div className="w-1/2">
                                            {finalPriceWithDiscount && (
                                                <div className="text-right">
                                                    <p className="text-xs text-gray-500">Precio Final</p>
                                                    <p className="text-lg font-bold text-red-600">${finalPriceWithDiscount}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Savings vs Unit */}
                            {savingsVsUnit && (
                                <div className="bg-purple-50 rounded-xl p-4 border border-purple-100 flex items-center justify-between">
                                    <div>
                                        <h4 className="text-sm font-bold text-purple-800">Ahorro por Volumen</h4>
                                        <p className="text-xs text-purple-600">vs comprar suelto</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-lg font-bold text-purple-900">${savingsVsUnit.amount}</p>
                                        <span className="text-xs font-bold bg-purple-200 text-purple-800 px-2 py-0.5 rounded-full">{savingsVsUnit.percent}% OFF</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="bg-gray-50 p-6 flex justify-end gap-3 border-t sticky bottom-0">
                    {wizardStep === 2 && !editingUnitId && (
                        <button onClick={() => setWizardStep(1)} className="px-5 py-2 text-gray-600 hover:bg-gray-200 rounded-lg font-medium transition-colors">Atrás</button>
                    )}
                    <button onClick={resetWizard} className="px-5 py-2 text-red-600 hover:bg-red-50 rounded-lg font-medium transition-colors">Cancelar</button>
                    {(wizardStep === 2 || editingUnitId) && (
                        <button
                            disabled={!newUnit.unit_name || !newUnit.user_input || !newUnit.price_usd}
                            onClick={handleAddUnit}
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-lg transition-all transform active:scale-95 disabled:opacity-50 disabled:scale-100"
                        >
                            {editingUnitId ? 'Actualizar Unidad' : 'Guardar Unidad'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-fade-in-up">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-xl font-bold text-gray-800">Unidades y Presentaciones</h3>
                    <p className="text-gray-500 text-sm">Administra cajas, bultos y fracciones para este producto.</p>
                </div>
                <button
                    onClick={() => setIsWizardOpen(true)}
                    className="bg-gray-900 hover:bg-gray-800 text-white px-5 py-2.5 rounded-xl font-semibold shadow-lg shadow-gray-200 transition-all flex items-center"
                >
                    <Plus size={18} className="mr-2" /> Agregar Unidad
                </button>
            </div>

            {units.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                    <Layers className="mx-auto text-gray-300 mb-4" size={48} />
                    <p className="text-gray-500 font-medium">Solo se vende por unidad base ({baseUnitType}).</p>
                    <p className="text-sm text-gray-400 mt-2">Agrega presentaciones si vendes cajas o fracciones.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {units.map((unit) => (
                        <div key={unit.id} className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow relative group">
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${unit.type === 'packing' ? 'bg-blue-100 text-blue-600' : 'bg-indigo-100 text-indigo-600'}`}>
                                        {unit.type === 'packing' ? <Package size={20} /> : <Divide size={20} />}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-gray-900">{unit.unit_name}</h4>
                                        <span className="text-xs uppercase font-bold tracking-wider text-gray-400">
                                            {unit.type === 'packing' ? 'Empaque' : 'Fracción'}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleEditUnit(unit)}
                                        className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                        title="Editar"
                                    >
                                        <Edit2 size={18} />
                                    </button>
                                    <button
                                        onClick={() => onUnitsChange(units.filter(u => u.id !== unit.id))}
                                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                        title="Eliminar"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2 text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                                <div className="flex justify-between">
                                    <span>Factor:</span>
                                    <span className="font-mono font-bold">
                                        {unit.type === 'packing' ? `x${unit.user_input}` : `1/${unit.user_input}`}
                                    </span>
                                </div>
                                {unit.price_usd > 0 && (
                                    <div className="flex justify-between text-green-700">
                                        <span>Precio USD:</span>
                                        <span className="font-bold">${Number(unit.price_usd).toFixed(2)}</span>
                                    </div>
                                )}
                                {unit.profit_margin && (
                                    <div className="flex justify-between text-blue-700">
                                        <span>Margen:</span>
                                        <span className="font-bold">{unit.profit_margin}%</span>
                                    </div>
                                )}
                                {unit.exchange_rate_id && (
                                    <div className="flex justify-between text-purple-700">
                                        <span>💱 Tasa:</span>
                                        <span className="font-bold text-xs">
                                            {exchangeRates?.find(r => r.id === unit.exchange_rate_id)?.name || 'Especial'}
                                        </span>
                                    </div>
                                )}
                                {unit.is_discount_active && unit.discount_percentage > 0 && (
                                    <div className="flex justify-between text-red-700">
                                        <span>Descuento:</span>
                                        <span className="font-bold">{unit.discount_percentage}%</span>
                                    </div>
                                )}
                                {unit.barcode && (
                                    <div className="flex justify-between">
                                        <span>Barcode:</span>
                                        <span className="font-mono">{unit.barcode}</span>
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
