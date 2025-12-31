import React, { useState, useEffect } from 'react';
import apiClient from '../../config/axios';
import { Package, Plus, Trash2, Box, Info } from 'lucide-react';
import clsx from 'clsx';

const ComboManager = ({ productId, initialComboItems = [], onChange }) => {
    const [comboItems, setComboItems] = useState(initialComboItems);
    const [availableProducts, setAvailableProducts] = useState([]);
    const [selectedProductId, setSelectedProductId] = useState('');
    const [selectedUnitId, setSelectedUnitId] = useState('');
    const [availableUnits, setAvailableUnits] = useState([]);
    const [quantity, setQuantity] = useState('1.000');

    // Fetch available products
    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const response = await apiClient.get('/products');
                // Filter: exclude current product (if editing) and other combos
                const filtered = response.data.filter(p => {
                    if (!productId) return !p.is_combo;
                    return p.id !== productId && !p.is_combo;
                });
                setAvailableProducts(filtered);
            } catch (error) {
                console.error('❌ Error fetching products:', error);
            }
        };
        fetchProducts();
    }, [productId]);

    // Notify parent component of changes
    useEffect(() => {
        if (onChange) {
            onChange(comboItems);
        }
    }, [comboItems]);

    // Load units when product is selected
    useEffect(() => {
        if (selectedProductId) {
            const product = availableProducts.find(p => p.id === parseInt(selectedProductId));
            if (product && product.units) {
                setAvailableUnits(product.units);
            } else {
                setAvailableUnits([]);
            }
        } else {
            setAvailableUnits([]);
            setSelectedUnitId('');
        }
    }, [selectedProductId, availableProducts]);

    const handleAddItem = () => {
        if (!selectedProductId || !quantity) {
            alert('Por favor selecciona un producto y cantidad');
            return;
        }

        const product = availableProducts.find(p => p.id === parseInt(selectedProductId));
        if (!product) return;

        if (comboItems.some(item => item.child_product_id === product.id)) {
            alert('Este producto ya está en el combo');
            return;
        }

        const newItem = {
            child_product_id: product.id,
            quantity: parseFloat(quantity),
            unit_id: selectedUnitId ? parseInt(selectedUnitId) : null,
            _product_name: product.name,
            _product_price: product.price,
            _unit_name: selectedUnitId ? availableUnits.find(u => u.id === parseInt(selectedUnitId))?.unit_name : null
        };

        setComboItems([...comboItems, newItem]);
        setSelectedProductId('');
        setSelectedUnitId('');
        setAvailableUnits([]);
        setQuantity('1.000');
    };

    const handleRemoveItem = (index) => {
        setComboItems(comboItems.filter((_, i) => i !== index));
    };

    const handleQuantityChange = (index, newQuantity) => {
        const updated = [...comboItems];
        updated[index].quantity = parseFloat(newQuantity);
        setComboItems(updated);
    };

    const calculateTotalCost = () => {
        return comboItems.reduce((sum, item) => {
            const product = availableProducts.find(p => p.id === item.child_product_id);
            if (product) {
                return sum + (parseFloat(product.price) * parseFloat(item.quantity));
            }
            return sum;
        }, 0);
    };

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Agregar Componente</h4>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                    <div className="md:col-span-12 lg:col-span-5">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Producto</label>
                        <div className="relative">
                            <Box className="absolute left-3 top-3 text-slate-400" size={18} />
                            <select
                                value={selectedProductId}
                                onChange={(e) => setSelectedProductId(e.target.value)}
                                className="w-full pl-10 border-slate-200 rounded-xl shadow-sm focus:border-indigo-500 focus:ring-indigo-500/20 py-2.5 font-medium text-slate-700 bg-white"
                            >
                                <option value="">Seleccionar producto...</option>
                                {availableProducts.map(product => (
                                    <option key={product.id} value={product.id}>
                                        {product.name} - ${parseFloat(product.price).toFixed(2)}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="md:col-span-6 lg:col-span-3">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Presentación</label>
                        <select
                            value={selectedUnitId}
                            onChange={(e) => setSelectedUnitId(e.target.value)}
                            disabled={!selectedProductId || availableUnits.length === 0}
                            className="w-full border-slate-200 rounded-xl shadow-sm focus:border-indigo-500 focus:ring-indigo-500/20 py-2.5 font-medium text-slate-700 bg-white disabled:bg-slate-50 disabled:text-slate-400"
                        >
                            <option value="">Base (unidad)</option>
                            {availableUnits.map(unit => (
                                <option key={unit.id} value={unit.id}>
                                    {unit.unit_name} (x{parseFloat(unit.conversion_factor).toFixed(2)})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="md:col-span-6 lg:col-span-2">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Cantidad</label>
                        <input
                            type="number"
                            step="0.001"
                            min="0.001"
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                            className="w-full border-slate-200 rounded-xl shadow-sm focus:border-indigo-500 focus:ring-indigo-500/20 py-2.5 font-bold text-slate-700 text-center"
                        />
                    </div>

                    <div className="md:col-span-12 lg:col-span-2">
                        <button
                            type="button"
                            onClick={handleAddItem}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-200 hover:shadow-indigo-300 transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                            <Plus size={18} />
                            Agregar
                        </button>
                    </div>
                </div>
            </div>

            {comboItems.length > 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                        <h3 className="text-sm font-bold text-slate-700">Items incluídos ({comboItems.length})</h3>
                        <div className="text-right">
                            <span className="text-xs text-slate-500 mr-2">Costo Total Componentes:</span>
                            <span className="font-black text-indigo-600 text-lg">${calculateTotalCost().toFixed(2)}</span>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50 border-b border-slate-100">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Producto</th>
                                    <th className="px-6 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Presentación</th>
                                    <th className="px-6 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Cantidad</th>
                                    <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Subtotal</th>
                                    <th className="px-6 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Acción</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {comboItems.map((item, index) => {
                                    const product = availableProducts.find(p => p.id === item.child_product_id);
                                    const subtotal = product ? parseFloat(product.price) * parseFloat(item.quantity) : 0;

                                    return (
                                        <tr key={index} className="hover:bg-slate-50/50 transition-colors group">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center mr-3">
                                                        <Box size={16} />
                                                    </div>
                                                    <div className="text-sm font-bold text-slate-700">
                                                        {product?.name || item._product_name || 'Desconocido'}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                {item._unit_name ? (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700">
                                                        {item._unit_name}
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-500">
                                                        Unidad Base
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitepsace-nowrap text-center">
                                                <input
                                                    type="number"
                                                    value={item.quantity}
                                                    onChange={(e) => handleQuantityChange(index, e.target.value)}
                                                    className="w-20 text-center border-slate-200 rounded-lg py-1 px-2 text-sm font-bold focus:ring-indigo-500 focus:border-indigo-500"
                                                />
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-slate-700">
                                                ${subtotal.toFixed(2)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                <button
                                                    onClick={() => handleRemoveItem(index)}
                                                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors opacity-60 group-hover:opacity-100"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="text-center py-12 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                    <Package className="mx-auto text-slate-300 mb-4" size={48} />
                    <p className="text-slate-500 font-bold">No hay componentes en este combo</p>
                    <p className="text-sm text-slate-400 mt-1 font-medium">Agrega productos usando el formulario de arriba</p>
                </div>
            )}

            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-100 rounded-xl">
                <Info className="flex-shrink-0 text-amber-500 mt-0.5" size={20} />
                <div>
                    <p className="text-sm font-bold text-amber-800">Sobre el precio del combo</p>
                    <p className="text-xs text-amber-700/80 mt-1 leading-relaxed">
                        El precio de venta final del combo se configura en la pestaña "Precios".
                        El costo sumado aquí es solo referencial para calcular tu margen de ganancia real.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ComboManager;
