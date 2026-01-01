import React, { useState, useEffect } from 'react';
import apiClient from '../../config/axios';
import { toast } from 'react-hot-toast';

const RecipeEditor = () => {
    // State
    const [products, setProducts] = useState([]);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [recipeItems, setRecipeItems] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [ingredientSearch, setIngredientSearch] = useState('');

    // Form State
    const [selectedIngredient, setSelectedIngredient] = useState(null);
    const [quantity, setQuantity] = useState('');

    useEffect(() => {
        loadProducts();
    }, []);

    useEffect(() => {
        if (selectedProduct) {
            loadRecipe(selectedProduct.id);
        } else {
            setRecipeItems([]);
        }
    }, [selectedProduct]);

    const loadProducts = async () => {
        try {
            const res = await apiClient.get('/products?limit=1000');
            setProducts(res.data);
        } catch (error) {
            console.error(error);
        }
    };

    const loadRecipe = async (productId) => {
        try {
            const res = await apiClient.get(`/restaurant/menu/recipes/${productId}`);
            setRecipeItems(res.data);
        } catch (error) {
            console.error(error);
        }
    };

    const handleAddIngredient = async (e) => {
        e.preventDefault();
        if (!selectedProduct || !selectedIngredient || !quantity) return;

        try {
            await apiClient.post('/restaurant/menu/recipes', {
                product_id: selectedProduct.id,
                ingredient_id: selectedIngredient.id,
                quantity: parseFloat(quantity)
            });

            toast.success('Ingrediente agregado');
            loadRecipe(selectedProduct.id);
            setQuantity('');
            setSelectedIngredient(null);
            setIngredientSearch('');
        } catch (error) {
            toast.error('Error guardando receta');
        }
    };

    const handleRemoveIngredient = async (id) => {
        try {
            await apiClient.delete(`/restaurant/menu/recipes/${id}`);
            loadRecipe(selectedProduct.id);
            toast.success('Ingrediente eliminado');
        } catch (error) {
            toast.error('Error eliminando');
        }
    };

    // Filter helpers
    const dishList = products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));

    // Filter ingredients: Exclude the selected product itself to avoid recursion
    const ingredientList = products.filter(p =>
        p.id !== selectedProduct?.id &&
        p.name.toLowerCase().includes(ingredientSearch.toLowerCase())
    ).slice(0, 10); // Limit results

    return (
        <div className="flex h-screen bg-gray-100 p-4 gap-4">
            {/* Left: Product Selector (Dishes) */}
            <div className="w-1/3 bg-white rounded-lg shadow flex flex-col">
                <div className="p-4 border-b">
                    <h2 className="font-bold text-gray-700">Seleccionar Título (Plato)</h2>
                    <input
                        className="w-full mt-2 p-2 border rounded"
                        placeholder="Buscar plato..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex-1 overflow-y-auto">
                    {dishList.map(p => (
                        <div
                            key={p.id}
                            className={`p-3 border-b cursor-pointer hover:bg-blue-50 ${selectedProduct?.id === p.id ? 'bg-blue-100 border-l-4 border-blue-500' : ''}`}
                            onClick={() => setSelectedProduct(p)}
                        >
                            <p className="font-medium">{p.name}</p>
                            <p className="text-xs text-gray-500">Stock: {p.stock}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Right: Recipe Editor */}
            <div className="flex-1 bg-white rounded-lg shadow p-6 flex flex-col">
                {selectedProduct ? (
                    <>
                        <div className="border-b pb-4 mb-4">
                            <h2 className="text-2xl font-bold text-gray-800">{selectedProduct.name}</h2>
                            <p className="text-gray-500">Gestionar Ingredientes (Escandallo)</p>
                        </div>

                        {/* Add Ingredient Form */}
                        <div className="bg-gray-50 p-4 rounded mb-6 border">
                            <h3 className="font-bold text-sm mb-2 text-gray-700">Agregar Ingrediente</h3>
                            <div className="flex gap-2 relative">
                                <div className="flex-1 relative">
                                    <input
                                        className="w-full p-2 border rounded"
                                        placeholder="Buscar insumo (ej: Pan, Queso)..."
                                        value={selectedIngredient ? selectedIngredient.name : ingredientSearch}
                                        onChange={(e) => {
                                            setIngredientSearch(e.target.value);
                                            setSelectedIngredient(null);
                                        }}
                                    />
                                    {/* Autocomplete Dropdown */}
                                    {ingredientSearch && !selectedIngredient && (
                                        <div className="absolute z-10 w-full bg-white border shadow-lg mt-1 rounded max-h-48 overflow-y-auto">
                                            {ingredientList.map(ing => (
                                                <div
                                                    key={ing.id}
                                                    className="p-2 hover:bg-gray-100 cursor-pointer text-sm"
                                                    onClick={() => {
                                                        setSelectedIngredient(ing);
                                                        setIngredientSearch('');
                                                    }}
                                                >
                                                    {ing.name}
                                                </div>
                                            ))}
                                            {ingredientList.length === 0 && (
                                                <div className="p-2 text-gray-400 text-sm">No encontrado</div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <input
                                    className="w-24 p-2 border rounded"
                                    type="number"
                                    step="0.001"
                                    placeholder="Cant."
                                    value={quantity}
                                    onChange={e => setQuantity(e.target.value)}
                                />

                                <button
                                    onClick={handleAddIngredient}
                                    disabled={!selectedIngredient || !quantity}
                                    className="bg-blue-600 text-white px-4 rounded hover:bg-blue-700 disabled:opacity-50"
                                >
                                    Agregar
                                </button>
                            </div>
                            {selectedIngredient && (
                                <div className="text-xs text-green-600 mt-1">
                                    Seleccionado: {selectedIngredient.name} (Stock: {selectedIngredient.stock})
                                </div>
                            )}
                        </div>

                        {/* Ingredients Table */}
                        <div className="flex-1 overflow-y-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-100 text-gray-600 text-sm">
                                        <th className="p-3">Ingrediente</th>
                                        <th className="p-3">Cantidad</th>
                                        <th className="p-3 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recipeItems.map(item => (
                                        <tr key={item.id} className="border-b hover:bg-gray-50">
                                            <td className="p-3 font-medium text-gray-800">
                                                {/* Requires backend to return name, or we fetch it. 
                                                    Schema has 'product_name' and 'ingredient_name' from relationship? 
                                                    Yes, RecipeRead has ingredient_name if backend populates it.
                                                    Let's check backend schema... yes, we used simple objects.
                                                    Actually, backend query returns plain objects. Pydantic 'from_attributes' might not auto-fetch names without relationship loading.
                                                    Let's assume backend populates the names or IDs match my product list.
                                                */}
                                                {products.find(p => p.id === item.ingredient_id)?.name || `ID: ${item.ingredient_id}`}
                                            </td>
                                            <td className="p-3">
                                                {item.quantity}
                                            </td>
                                            <td className="p-3 text-right">
                                                <button
                                                    onClick={() => handleRemoveItem(item.id)}
                                                    className="text-red-500 hover:text-red-700 text-sm underline"
                                                >
                                                    Quitar
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {recipeItems.length === 0 && (
                                        <tr>
                                            <td colSpan="3" className="p-8 text-center text-gray-400 italic">
                                                Este plato no tiene receta definida.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </>
                ) : (
                    <div className="h-full flex items-center justify-center text-gray-400">
                        Selecciona un plato de la izquierda para editar su receta.
                    </div>
                )}
            </div>
        </div>
    );
};

export default RecipeEditor;
