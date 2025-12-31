import React, { useState, useEffect } from 'react';
import apiClient from '../../config/axios';

/**
 * ComboManager Component
 * Manages combo/bundle items for a product
 * Used within ProductForm to add/edit/remove combo components
 */
const ComboManager = ({ productId, initialComboItems = [], onChange }) => {
    const [comboItems, setComboItems] = useState(initialComboItems);
    const [availableProducts, setAvailableProducts] = useState([]);
    const [selectedProductId, setSelectedProductId] = useState('');
    const [selectedUnitId, setSelectedUnitId] = useState('');  // NEW: Selected unit
    const [availableUnits, setAvailableUnits] = useState([]);  // NEW: Units for selected product
    const [quantity, setQuantity] = useState('1.000');
    const [loading, setLoading] = useState(false);

    // Fetch available products (excluding the current product to prevent circular refs)
    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const response = await apiClient.get('/products');
                console.log('📦 All products:', response.data);
                console.log('🔍 Current productId:', productId);

                // Filter: exclude current product (if editing) and other combos
                const filtered = response.data.filter(p => {
                    // If creating new product (no productId), just exclude combos
                    if (!productId) {
                        return !p.is_combo;
                    }
                    // If editing, exclude current product AND combos
                    return p.id !== productId && !p.is_combo;
                });

                console.log('✅ Filtered products (available for combo):', filtered);
                console.log('🎁 Combos filtered out:', response.data.filter(p => p.is_combo));

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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [comboItems]); // Only depend on comboItems, not onChange

    // NEW: Load units when product is selected
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

        // Check if product already exists in combo
        if (comboItems.some(item => item.child_product_id === product.id)) {
            alert('Este producto ya está en el combo');
            return;
        }

        const newItem = {
            child_product_id: product.id,
            quantity: parseFloat(quantity),
            unit_id: selectedUnitId ? parseInt(selectedUnitId) : null,  // NEW: Include unit_id
            // For display purposes (not sent to backend)
            _product_name: product.name,
            _product_price: product.price,
            _unit_name: selectedUnitId ? availableUnits.find(u => u.id === parseInt(selectedUnitId))?.unit_name : null  // NEW
        };

        setComboItems([...comboItems, newItem]);
        setSelectedProductId('');
        setSelectedUnitId('');  // NEW: Reset unit
        setAvailableUnits([]);  // NEW: Clear units
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

    // Calculate total cost of combo components
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
        <div className="combo-manager">
            <div className="combo-header">
                <h3 className="text-lg font-semibold mb-2">
                    Componentes del Combo
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                    Agrega los productos que forman parte de este combo
                </p>
            </div>

            {/* Add Item Form */}
            <div className="add-item-form bg-gray-50 p-4 rounded-lg mb-4">
                <div className="grid grid-cols-12 gap-3">
                    <div className="col-span-5">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Producto
                        </label>
                        <select
                            value={selectedProductId}
                            onChange={(e) => setSelectedProductId(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">Seleccionar producto...</option>
                            {availableProducts.map(product => (
                                <option key={product.id} value={product.id}>
                                    {product.name} - ${parseFloat(product.price).toFixed(2)}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* NEW: Unit Selector */}
                    <div className="col-span-3">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Presentación
                        </label>
                        <select
                            value={selectedUnitId}
                            onChange={(e) => setSelectedUnitId(e.target.value)}
                            disabled={!selectedProductId || availableUnits.length === 0}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                        >
                            <option value="">Base (unidad)</option>
                            {availableUnits.map(unit => (
                                <option key={unit.id} value={unit.id}>
                                    {unit.unit_name} (x{parseFloat(unit.conversion_factor).toFixed(2)})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Cantidad
                        </label>
                        <input
                            type="number"
                            step="0.001"
                            min="0.001"
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <div className="col-span-2 flex items-end">
                        <button
                            type="button"
                            onClick={handleAddItem}
                            className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition"
                        >
                            + Agregar
                        </button>
                    </div>
                </div>
            </div>

            {/* Combo Items List */}
            {comboItems.length > 0 ? (
                <div className="combo-items-list">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-gray-100 border-b">
                                <th className="text-left p-2 text-sm font-medium">Producto</th>
                                <th className="text-center p-2 text-sm font-medium">Presentación</th>
                                <th className="text-center p-2 text-sm font-medium">Cantidad</th>
                                <th className="text-right p-2 text-sm font-medium">Precio Unit.</th>
                                <th className="text-right p-2 text-sm font-medium">Subtotal</th>
                                <th className="text-center p-2 text-sm font-medium">Acción</th>
                            </tr>
                        </thead>
                        <tbody>
                            {comboItems.map((item, index) => {
                                const product = availableProducts.find(p => p.id === item.child_product_id);
                                const subtotal = product ? parseFloat(product.price) * parseFloat(item.quantity) : 0;

                                return (
                                    <tr key={index} className="border-b hover:bg-gray-50">
                                        <td className="p-2 text-sm">
                                            {product?.name || item._product_name || 'Producto desconocido'}
                                        </td>
                                        <td className="p-2 text-center text-sm">
                                            {item._unit_name ? (
                                                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                                                    {item._unit_name}
                                                </span>
                                            ) : (
                                                <span className="text-gray-400 text-xs">Base</span>
                                            )}
                                        </td>
                                        <td className="p-2 text-center">
                                            <input
                                                type="number"
                                                step="0.001"
                                                min="0.001"
                                                value={item.quantity}
                                                onChange={(e) => handleQuantityChange(index, e.target.value)}
                                                className="w-20 px-2 py-1 border border-gray-300 rounded text-center text-sm"
                                            />
                                        </td>
                                        <td className="p-2 text-right text-sm">
                                            ${product ? parseFloat(product.price).toFixed(2) : '0.00'}
                                        </td>
                                        <td className="p-2 text-right text-sm font-medium">
                                            ${subtotal.toFixed(2)}
                                        </td>
                                        <td className="p-2 text-center">
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveItem(index)}
                                                className="text-red-600 hover:text-red-800 text-sm font-medium"
                                            >
                                                Eliminar
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot>
                            <tr className="bg-blue-50 font-semibold">
                                <td colSpan="3" className="p-2 text-right text-sm">
                                    Costo Total de Componentes:
                                </td>
                                <td className="p-2 text-right text-sm">
                                    ${calculateTotalCost().toFixed(2)}
                                </td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>

                    <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                        <p className="text-sm text-yellow-800">
                            <strong>💡 Nota:</strong> El precio del combo es independiente del costo de los componentes.
                            Puedes establecer un precio con descuento para incentivar la compra del combo.
                        </p>
                    </div>
                </div>
            ) : (
                <div className="empty-state text-center py-8 text-gray-500">
                    <svg className="mx-auto h-12 w-12 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                    <p className="text-sm">No hay componentes en este combo</p>
                    <p className="text-xs mt-1">Agrega productos usando el formulario arriba</p>
                </div>
            )}
        </div>
    );
};

export default ComboManager;
