import React, { useState, useEffect, useMemo } from 'react';
import apiClient from '../../config/axios';
import { toast } from 'react-hot-toast';
import { normalizeSearch } from '../../utils/search';
import { Search, Plus, Trash2, Box, UtensilsCrossed, Settings, ChevronRight, Save, X, Check } from 'lucide-react';

const ModifierRecipeEditor = () => {
    const [modifierGroups, setModifierGroups] = useState([]);
    const [allProducts, setAllProducts] = useState([]);
    const [loading, setLoading] = useState(true);

    // Selected Modifier State
    const [_selectedGroup, _setSelectedGroup] = useState(null);
    const [selectedOption, setSelectedOption] = useState(null);

    // Ingredient Assignment State
    const [ingredientSearch, setIngredientSearch] = useState('');
    const [selectedIngredient, setSelectedIngredient] = useState(null);
    const [quantityConsumed, setQuantityConsumed] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [groupsRes, productsRes] = await Promise.all([
                apiClient.get('/restaurant/modifiers/all-with-options'), // Assuming an endpoint to get all groups and options
                apiClient.get('/products?limit=1000')
            ]);
            setModifierGroups(groupsRes.data);
            const parsedProducts = productsRes.data.map(p => ({
                ...p,
                cost: parseFloat(p.cost_price || p.cost || 0),
                price: parseFloat(p.price || 0),
                stock: parseFloat(p.stock || 0)
            }));
            setAllProducts(parsedProducts);
        } catch (error) {
            toast.error('Error cargando datos');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateModifierRecipe = async (e) => {
        e.preventDefault();
        if (!selectedOption || !selectedIngredient || !quantityConsumed || parseFloat(quantityConsumed) <= 0) {
            toast.error("Selecciona un ingrediente y una cantidad válida");
            return;
        }

        try {
            await apiClient.patch(`/restaurant/modifiers/option/${selectedOption.id}`, {
                ingredient_id: selectedIngredient.id,
                quantity_consumed: parseFloat(quantityConsumed)
            });

            toast.success(`Receta para "${selectedOption.name}" actualizada`);
            loadData(); // Reload all data to refresh
            // Clear assignment state
            setIngredientSearch('');
            setSelectedIngredient(null);
            setQuantityConsumed('');
            setSelectedOption(null); // Deselect option after update
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Error actualizando receta del modificador');
            console.error(error);
        }
    };

    const handleClearModifierRecipe = async () => {
        if (!selectedOption) return;
        if (!window.confirm(`¿Quitar la receta de inventario para el modificador "${selectedOption.name}"?`)) return;

        try {
            await apiClient.patch(`/restaurant/modifiers/option/${selectedOption.id}`, {
                ingredient_id: null,
                quantity_consumed: null
            });
            toast.success('Receta del modificador eliminada');
            loadData();
            setIngredientSearch('');
            setSelectedIngredient(null);
            setQuantityConsumed('');
            setSelectedOption(null);
        } catch (_) {
            toast.error(_.response?.data?.detail || 'Error eliminando receta del modificador');
            console.error(_);
        }
    };


    // --- Computed Values ---
    const ingredientList = useMemo(() => {
        if (!ingredientSearch) return [];
        const term = normalizeSearch(ingredientSearch);
        return allProducts
            .filter(p => normalizeSearch(p.name).includes(term))
            .slice(0, 8); // Top 8 results
    }, [allProducts, ingredientSearch]);

    // Initial load of current assignment when selectedOption changes
    useEffect(() => {
        if (selectedOption) {
            const currentIngredient = allProducts.find(p => p.id === selectedOption.ingredient_id);
            if (currentIngredient) {
                setSelectedIngredient(currentIngredient);
                setIngredientSearch(currentIngredient.name);
            } else {
                setSelectedIngredient(null);
                setIngredientSearch('');
            }
            setQuantityConsumed(selectedOption.quantity_consumed || '');
        }
    }, [selectedOption, allProducts]);


    if (loading) {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center bg-slate-50">
                <div className="flex flex-col items-center gap-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-indigo-600"></div>
                    <p className="text-slate-500 font-bold animate-pulse">Cargando Modificadores...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-[calc(100vh-4rem)] bg-slate-50 overflow-hidden">
            {/* Left Panel: Modifier Groups & Options */}
            <div className="w-1/3 max-w-md bg-white border-r border-slate-200 flex flex-col shadow-sm z-10">
                <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                    <h2 className="text-xl font-black text-slate-800 flex items-center gap-2 mb-1">
                        <Settings className="text-indigo-600" /> Recetas de Modificadores
                    </h2>
                    <p className="text-xs font-bold text-slate-400 mb-4 uppercase tracking-wider">
                        Asigna ingredientes a las opciones de modificador
                    </p>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-4">
                    {modifierGroups.length === 0 ? (
                        <div className="text-center py-10 text-slate-400 italic text-sm">
                            No se encontraron grupos de modificadores.
                        </div>
                    ) : (
                        modifierGroups.map(group => (
                            <div key={group.id} className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                                <div className="p-4 bg-indigo-50/20 border-b border-indigo-100">
                                    <h3 className="font-black text-indigo-700 text-lg">{group.name}</h3>
                                    <p className="text-xs text-indigo-500">{group.selection_type} | {group.is_required ? 'Requerido' : 'Opcional'}</p>
                                </div>
                                <div className="divide-y divide-slate-100">
                                    {group.options.map(option => (
                                        <button
                                            key={option.id}
                                            onClick={() => setSelectedOption(option)}
                                            className={`w-full text-left p-4 transition-colors flex items-center justify-between group
                                                ${selectedOption?.id === option.id ? 'bg-indigo-50 text-indigo-800' : 'hover:bg-slate-50 text-slate-700'}
                                            `}
                                        >
                                            <div className="min-w-0 flex-1">
                                                <p className="font-bold text-base truncate">{option.name}</p>
                                                {option.ingredient_id ? (
                                                    <p className="text-xs text-emerald-600 font-medium flex items-center gap-1 mt-1">
                                                        <Check size={12} /> Descuenta {option.quantity_consumed} de {allProducts.find(p => p.id === option.ingredient_id)?.name}
                                                    </p>
                                                ) : (
                                                    <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                                                        <X size={12} /> Sin inventario asociado
                                                    </p>
                                                )}
                                            </div>
                                            <ChevronRight size={18} className={`shrink-0 transition-transform ${selectedOption?.id === option.id ? 'text-indigo-500 translate-x-1' : 'text-slate-300 group-hover:translate-x-1'}`} />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Right Panel: Modifier Recipe Assignment */}
            <div className="flex-1 flex flex-col bg-slate-50/50 relative">
                {selectedOption ? (
                    <>
                        <div className="bg-white border-b border-slate-200 p-6 shadow-sm">
                            <h1 className="text-3xl font-black text-slate-800 tracking-tight mb-2">
                                {selectedOption.name}
                            </h1>
                            <p className="text-slate-500 font-medium flex items-center gap-2">
                                <Settings size={20} className="text-indigo-600" /> Configurar Consumo de Inventario
                            </p>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="bg-white rounded-2xl p-5 shadow-sm border border-indigo-100 mb-6">
                                <h3 className="text-sm font-black text-indigo-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <Box size={16} className="text-indigo-500" /> Ingrediente que Descuenta
                                </h3>
                                <form onSubmit={handleUpdateModifierRecipe} className="flex gap-3 relative">
                                    <div className="flex-1 relative">
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                            <input
                                                type="text"
                                                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white outline-none transition font-medium"
                                                placeholder="Buscar ingrediente (ej. Tocino, Salsa, Pan)..."
                                                value={selectedIngredient ? selectedIngredient.name : ingredientSearch}
                                                onChange={(e) => {
                                                    setIngredientSearch(e.target.value);
                                                    setSelectedIngredient(null);
                                                }}
                                            />
                                        </div>
                                        
                                        {/* Autocomplete Dropdown */}
                                        {ingredientSearch && !selectedIngredient && (
                                            <div className="absolute z-20 w-full mt-2 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden">
                                                {ingredientList.length > 0 ? (
                                                    <ul className="max-h-64 overflow-y-auto py-2">
                                                        {ingredientList.map(ing => (
                                                            <li
                                                                key={ing.id}
                                                                onClick={() => {
                                                                    setSelectedIngredient(ing);
                                                                    setIngredientSearch(ing.name);
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
                                            value={quantityConsumed}
                                            onChange={e => setQuantityConsumed(e.target.value)}
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Und/Kg</span>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={!selectedIngredient || !quantityConsumed || selectedOption.ingredient_id === selectedIngredient.id && selectedOption.quantity_consumed == quantityConsumed}
                                        className="px-6 py-3 bg-indigo-600 text-white font-black rounded-xl hover:bg-indigo-700 active:scale-95 transition-all shadow-md shadow-indigo-200 disabled:opacity-50 disabled:active:scale-100 flex items-center gap-2"
                                    >
                                        <Save size={20} /> Guardar
                                    </button>
                                </form>

                                {selectedOption.ingredient_id && (
                                    <button
                                        onClick={handleClearModifierRecipe}
                                        className="mt-4 px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 font-bold rounded-lg transition-colors text-sm flex items-center justify-center gap-1.5 w-full"
                                    >
                                        <Trash2 size={16} /> Quitar Consumo
                                    </button>
                                )}
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50/50 text-slate-400">
                        <div className="w-24 h-24 bg-white shadow-sm border border-slate-100 rounded-full flex items-center justify-center mb-6">
                            <Settings size={40} className="text-indigo-300" />
                        </div>
                        <h2 className="text-2xl font-black text-slate-600 mb-2">Editor de Modificadores</h2>
                        <p className="text-center max-w-md text-slate-500">
                            Selecciona una opción de modificador del panel izquierdo para asignarle un ingrediente y cantidad a descontar del inventario.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ModifierRecipeEditor;