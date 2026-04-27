import React, { useState, useEffect, useMemo } from 'react';
import apiClient from '../../config/axios';
import { toast } from 'react-hot-toast';
import { normalizeSearch } from '../../utils/search';
import { Search, Plus, Trash2, ChefHat, Box, DollarSign, Percent, ArrowRight, AlertCircle, UtensilsCrossed } from 'lucide-react';

const RecipeEditor = () => {
    const [products, setProducts] = useState([]);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [recipeItems, setRecipeItems] = useState([]);
    const [loading, setLoading] = useState(true);

    // Search & Filter State
    const [searchTerm, setSearchTerm] = useState('');
    const [ingredientSearch, setIngredientSearch] = useState('');
    const [selectedIngredient, setSelectedIngredient] = useState(null);
    const [quantity, setQuantity] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);

    useEffect(() => {
        loadProducts();
    }, []);

    useEffect(() => {
        if (selectedProduct) {
            loadRecipe(selectedProduct.id);
            setIngredientSearch('');
            setSelectedIngredient(null);
            setQuantity('');
            setShowSuggestions(false);
        } else {
            setRecipeItems([]);
        }
    }, [selectedProduct]);

    const loadProducts = async () => {
        setLoading(true);
        try {
            const res = await apiClient.get('/products?limit=1000');
            // Ensure we have cost and price as numbers
            const parsedProducts = res.data.map(p => ({
                ...p,
                cost: parseFloat(p.cost || 0),
                price: parseFloat(p.price || 0),
                stock: parseFloat(p.stock || 0)
            }));
            setProducts(parsedProducts);
        } catch (error) {
            console.error(error);
            toast.error('Error cargando productos');
        } finally {
            setLoading(false);
        }
    };

    const loadRecipe = async (productId) => {
        try {
            const res = await apiClient.get(`/restaurant/menu/recipes/${productId}`);
            setRecipeItems(res.data);
        } catch (error) {
           console.error(error);
            console.error(error);
            toast.error('Error cargando la receta');
        }
    };

    const handleAddIngredient = async (e) => {
        e.preventDefault();
        if (!selectedProduct || !selectedIngredient || !quantity || parseFloat(quantity) <= 0) {
            toast.error("Selecciona un insumo y una cantidad válida");
            return;
        }

        try {
            await apiClient.post('/restaurant/menu/recipes', {
                product_id: selectedProduct.id,
                ingredient_id: selectedIngredient.id,
                quantity: parseFloat(quantity)
            });

            toast.success(`${selectedIngredient.name} agregado a la receta`);
            loadRecipe(selectedProduct.id);
            setQuantity('');
            setSelectedIngredient(null);
            setIngredientSearch('');
            setShowSuggestions(false);
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.detail || 'Error guardando ingrediente en la receta');
        }
    };

    const handleRemoveIngredient = async (id) => {
        if (!window.confirm('¿Eliminar este insumo de la receta?')) return;
        try {
            await apiClient.delete(`/restaurant/menu/recipes/${id}`);
            loadRecipe(selectedProduct.id);
            toast.success('Insumo eliminado');
        } catch (error) {
            console.error(error);
            toast.error('Error eliminando insumo');
        }
    };

    const handleClearRecipe = async () => {
        if (recipeItems.length === 0) return;
        if (!window.confirm(`¿Estás seguro que deseas eliminar TODOS los ingredientes de la receta para ${selectedProduct.name}?`)) return;

        try {
            await apiClient.delete(`/restaurant/menu/recipes/product/${selectedProduct.id}`);
            setRecipeItems([]);
            toast.success('Receta vaciada completamente');
        } catch (error) {
            console.error(error);
            toast.error('Error vaciando receta');
        }
    };

    const handleSyncCost = async () => {
        if (!selectedProduct || recipeItems.length === 0) return;
        if (!window.confirm(`¿Actualizar el costo maestro de "${selectedProduct.name}" a $${recipeCost.toFixed(2)}?`)) return;

        try {
            await apiClient.put(`/products/${selectedProduct.id}`, {
                cost_price: recipeCost
            });
            toast.success('Costo maestro actualizado con éxito');

            // Optimistic update in frontend state
            const updatedProducts = products.map(p => 
                p.id === selectedProduct.id ? { ...p, cost: recipeCost, cost_price: recipeCost } : p
            );
            setProducts(updatedProducts);
            setSelectedProduct(prev => ({ ...prev, cost: recipeCost, cost_price: recipeCost }));
        } catch (error) {
            console.error(error);
            toast.error('Error actualizando el costo del producto');
        }
    };
    // --- Computed Values & Filters ---

    const dishList = useMemo(() => {
        const term = normalizeSearch(searchTerm);
        return products.filter(p => p.is_menu_item && normalizeSearch(p.name).includes(term));
    }, [products, searchTerm]);

    const ingredientList = useMemo(() => {
        if (!ingredientSearch) return [];
        const term = normalizeSearch(ingredientSearch);
        return products
            .filter(p => p.id !== selectedProduct?.id && normalizeSearch(p.name).includes(term))
            .slice(0, 8); // Top 8 results
    }, [products, ingredientSearch, selectedProduct]);

    // Financial calculations
    const recipeCost = useMemo(() => {
        return recipeItems.reduce((total, item) => {
            const ing = products.find(p => p.id === item.ingredient_id);
            const unitCost = ing ? ing.cost : 0;
            return total + (unitCost * parseFloat(item.quantity));
        }, 0);
    }, [recipeItems, products]);

    const dishPrice = selectedProduct ? selectedProduct.price : 0;
    const profitMargin = dishPrice > 0 ? ((dishPrice - recipeCost) / dishPrice) * 100 : 0;
    const profitAmount = dishPrice - recipeCost;

    const isMarginHealthy = profitMargin >= 30; // Assuming 30% is a healthy food cost margin

    return (
        <div className="flex h-[calc(100vh-4rem)] bg-slate-50 overflow-hidden">
            {/* Left Panel: Catalog */}
            <div className="w-1/3 max-w-md bg-white border-r border-slate-200 flex flex-col shadow-sm z-10">
                <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                    <h2 className="text-xl font-black text-slate-800 flex items-center gap-2 mb-4">
                        <ChefHat className="text-indigo-600" /> Ingeniería de Menú
                    </h2>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar plato para configurar..."
                            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition shadow-sm text-sm"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {loading ? (
                        <div className="flex justify-center py-10">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                        </div>
                    ) : dishList.length > 0 ? (
                        dishList.map(p => {
                            const isSelected = selectedProduct?.id === p.id;
                            return (
                                <button
                                    key={p.id}
                                    onClick={() => setSelectedProduct(p)}
                                    className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-center justify-between group ${isSelected
                                        ? 'border-indigo-500 bg-indigo-50 shadow-md'
                                        : 'border-transparent hover:border-slate-200 bg-white hover:bg-slate-50 shadow-sm'
                                        }`}
                                >
                                    <div className="min-w-0 flex-1">
                                        <h3 className={`font-bold truncate ${isSelected ? 'text-indigo-900' : 'text-slate-700'}`}>
                                            {p.name}
                                        </h3>
                                        <div className="flex items-center gap-3 mt-1">
                                            <span className="text-xs font-black text-emerald-600">${p.price.toFixed(2)}</span>
                                            {p.sku && <span className="text-[10px] text-slate-400 font-mono bg-slate-100 px-1.5 rounded">{p.sku}</span>}
                                        </div>
                                    </div>
                                    <ArrowRight className={`shrink-0 transition-transform ${isSelected ? 'text-indigo-500 translate-x-1' : 'text-slate-300 group-hover:translate-x-1'}`} size={18} />
                                </button>
                            );
                        })
                    ) : (
                        <div className="text-center py-10 text-slate-400 italic text-sm">
                            No se encontraron platos
                        </div>
                    )}
                </div>
            </div>

            {/* Right Panel: Recipe Editor */}
            <div className="flex-1 flex flex-col bg-slate-50/50 relative">
                {selectedProduct ? (
                    <>
                        {/* Financial Header */}
                        <div className="bg-white border-b border-slate-200 p-6 shadow-sm">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h1 className="text-3xl font-black text-slate-800 tracking-tight">{selectedProduct.name}</h1>
                                    <p className="text-slate-500 mt-1 flex items-center gap-1.5 font-medium">
                                        <UtensilsCrossed size={16} /> Escandallo y Costos de Receta
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Precio de Venta</p>
                                    <p className="text-3xl font-black text-emerald-600">${dishPrice.toFixed(2)}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex justify-between items-center gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                                            <Box size={24} />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-slate-500 uppercase">Costo Insumos</p>
                                            <p className="text-xl font-black text-slate-800">${recipeCost.toFixed(2)}</p>
                                        </div>
                                    </div>
                                    {recipeItems.length > 0 && (
                                        <button
                                            onClick={handleSyncCost}
                                            className="px-2 py-1.5 bg-white border border-slate-200 text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200 text-[10px] font-bold rounded-lg transition-all shadow-sm text-center"
                                            title="Actualizar el costo del producto con este valor"
                                        >
                                            Sincronizar
                                        </button>
                                    )}
                                </div>
                                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                                        <DollarSign size={24} />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-slate-500 uppercase">Ganancia Bruta</p>
                                        <p className="text-xl font-black text-slate-800">${profitAmount.toFixed(2)}</p>
                                    </div>
                                </div>
                                <div className={`p-4 rounded-2xl border flex items-center gap-4 ${isMarginHealthy ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${isMarginHealthy ? 'bg-emerald-200 text-emerald-700' : 'bg-red-200 text-red-700'}`}>
                                        <Percent size={24} />
                                    </div>
                                    <div>
                                        <p className={`text-xs font-bold uppercase ${isMarginHealthy ? 'text-emerald-700' : 'text-red-700'}`}>Margen (Profit)</p>
                                        <p className={`text-xl font-black flex items-center gap-2 ${isMarginHealthy ? 'text-emerald-800' : 'text-red-800'}`}>
                                            {profitMargin.toFixed(1)}%
                                            {!isMarginHealthy && <AlertCircle size={16} />}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Editor Content */}
                        <div className="flex-1 overflow-y-auto p-6">
                            {/* Add Ingredient Form */}
                            <div className="bg-white rounded-2xl p-5 shadow-sm border border-indigo-100 mb-6">
                                <h3 className="text-sm font-black text-indigo-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <Plus size={16} className="text-indigo-500" /> Agregar Insumo
                                </h3>
                                <form onSubmit={handleAddIngredient} className="flex gap-3 relative">
                                    <div className="flex-1 relative">
                                        <div className="relative">
                                            <Box className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                            <input
                                                type="text"
                                                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white outline-none transition font-medium"
                                                placeholder="Buscar ingrediente (ej. Carne, Pan, Queso)..."
                                                value={selectedIngredient ? selectedIngredient.name : ingredientSearch}
                                                onChange={(e) => {
                                                    setIngredientSearch(e.target.value);
                                                    setSelectedIngredient(null);
                                                    setShowSuggestions(true);
                                                }}
                                                onFocus={() => setShowSuggestions(true)}
                                            />
                                        </div>
                                        
                                        {/* Autocomplete Dropdown */}
                                        {showSuggestions && ingredientSearch && !selectedIngredient && (
                                            <div className="absolute z-20 w-full mt-2 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden">
                                                {ingredientList.length > 0 ? (
                                                    <ul className="max-h-64 overflow-y-auto py-2">
                                                        {ingredientList.map(ing => (
                                                            <li
                                                                key={ing.id}
                                                                onClick={() => {
                                                                    setSelectedIngredient(ing);
                                                                    setIngredientSearch('');
                                                                    setShowSuggestions(false);
                                                                }}
                                                                className="px-4 py-2.5 hover:bg-indigo-50 cursor-pointer flex justify-between items-center transition-colors group"
                                                            >
                                                                <div>
                                                                    <p className="font-bold text-slate-700 group-hover:text-indigo-700">{ing.name}</p>
                                                                    <p className="text-xs text-slate-400">Costo: ${ing.cost.toFixed(2)} | Stock: {ing.stock}</p>
                                                                </div>
                                                                <Plus size={16} className="text-indigo-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                            </li>
                                                        ))}
                                                    </ul>
                                                ) : (
                                                    <div className="p-4 text-center text-sm text-slate-500 italic">No se encontraron insumos</div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <div className="w-32 relative">
                                        <input
                                            type="number"
                                            step="0.001"
                                            min="0"
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white outline-none transition font-black text-slate-700"
                                            placeholder="0.000"
                                            value={quantity}
                                            onChange={e => setQuantity(e.target.value)}
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Und/Kg</span>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={!selectedIngredient || !quantity}
                                        className="px-6 py-3 bg-indigo-600 text-white font-black rounded-xl hover:bg-indigo-700 active:scale-95 transition-all shadow-md shadow-indigo-200 disabled:opacity-50 disabled:active:scale-100 flex items-center gap-2"
                                    >
                                        <Plus size={20} /> Añadir
                                    </button>
                                </form>
                            </div>

                            {/* Recipe Table */}
                            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                    <h3 className="text-sm font-black text-slate-700 uppercase tracking-wider flex items-center gap-2">
                                        <Box size={16} className="text-slate-400" /> Ingredientes ({recipeItems.length})
                                    </h3>
                                    {recipeItems.length > 0 && (
                                        <button
                                            onClick={handleClearRecipe}
                                            className="px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 font-bold rounded-lg transition-colors text-xs flex items-center gap-1.5"
                                        >
                                            <Trash2 size={14} /> Vaciar Receta
                                        </button>
                                    )}
                                </div>
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50/80 text-slate-500 text-xs uppercase tracking-wider">
                                            <th className="p-4 font-black">Insumo / Ingrediente</th>
                                            <th className="p-4 font-black">Cantidad</th>
                                            <th className="p-4 font-black">Costo Unit.</th>
                                            <th className="p-4 font-black">Subtotal Costo</th>
                                            <th className="p-4 font-black text-right">Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {recipeItems.map(item => {
                                            const ing = products.find(p => p.id === item.ingredient_id);
                                            const ingName = ing ? ing.name : `Insumo ID: ${item.ingredient_id}`;
                                            const unitCost = ing ? ing.cost : 0;
                                            const subtotal = unitCost * parseFloat(item.quantity);

                                            return (
                                                <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                                                    <td className="p-4 font-bold text-slate-800">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">
                                                                <Box size={14} />
                                                            </div>
                                                            {ingName}
                                                        </div>
                                                    </td>
                                                    <td className="p-4">
                                                        <span className="font-black text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100">
                                                            {item.quantity}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-slate-500 font-medium">
                                                        ${unitCost.toFixed(2)}
                                                    </td>
                                                    <td className="p-4 font-black text-slate-700">
                                                        ${subtotal.toFixed(2)}
                                                    </td>
                                                    <td className="p-4 text-right">
                                                        <button
                                                            onClick={() => handleRemoveIngredient(item.id)}
                                                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                            title="Eliminar insumo"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {recipeItems.length === 0 && (
                                            <tr>
                                                <td colSpan="5" className="p-12 text-center">
                                                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                                        <UtensilsCrossed size={24} className="text-slate-300" />
                                                    </div>
                                                    <p className="text-lg font-bold text-slate-600">Receta Vacía</p>
                                                    <p className="text-slate-400 text-sm mt-1 max-w-sm mx-auto">
                                                        Agrega ingredientes usando el buscador de arriba para calcular el costo de {selectedProduct.name}.
                                                    </p>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50/50 text-slate-400">
                        <div className="w-24 h-24 bg-white shadow-sm border border-slate-100 rounded-full flex items-center justify-center mb-6">
                            <ChefHat size={40} className="text-indigo-300" />
                        </div>
                        <h2 className="text-2xl font-black text-slate-600 mb-2">Ingeniería de Menú</h2>
                        <p className="text-center max-w-md text-slate-500">
                            Selecciona un plato del catálogo a la izquierda para configurar su escandallo (receta), analizar su costo de producción y margen de ganancia.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default RecipeEditor;