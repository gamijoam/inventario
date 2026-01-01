import React, { useState, useEffect } from 'react';
import { useConfig } from '../../context/ConfigContext';
import apiClient from '../../config/axios';
import { toast } from 'react-hot-toast';

const MenuManager = () => {
    const { business } = useConfig();
    const [sections, setSections] = useState([]);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);

    // UI State
    const [searchTerm, setSearchTerm] = useState('');
    const [newSectionName, setNewSectionName] = useState('');
    const [draggedProduct, setDraggedProduct] = useState(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [menuRes, prodRes] = await Promise.all([
                apiClient.get('/restaurant/menu/full'),
                apiClient.get('/products?limit=1000') // Get all products for selection
            ]);
            setSections(menuRes.data.sections);
            setProducts(prodRes.data);
        } catch (error) {
            console.error(error);
            toast.error('Error cargando menú');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateSection = async (e) => {
        e.preventDefault();
        if (!newSectionName.trim()) {
            toast.error("El nombre de la sección no puede estar vacío");
            return;
        }

        try {
            console.log("Creating section:", newSectionName);
            await apiClient.post('/restaurant/menu/sections', { name: newSectionName });
            setNewSectionName('');
            loadData();
            toast.success('Sección creada correctamente');
        } catch (error) {
            console.error("Error creating section:", error);
            const msg = error.response?.data?.detail || "Error desconocido";
            toast.error(`Error creando sección: ${msg}`);
        }
    };

    const handleDeleteSection = async (id) => {
        if (!window.confirm('¿Borrar sección y sus items?')) return;
        try {
            await apiClient.delete(`/restaurant/menu/sections/${id}`);
            loadData();
        } catch (error) {
            toast.error('Error borrando sección');
        }
    };

    const handleAddItem = async (sectionId, product) => {
        try {
            await apiClient.post('/restaurant/menu/items', {
                section_id: sectionId,
                product_id: product.id,
                alias: product.name, // Default alias
                price_override: null
            });
            loadData();
            toast.success(`Agregado: ${product.name}`);
        } catch (error) {
            toast.error('Error agregando producto');
        }
    };

    const handleRemoveItem = async (itemId) => {
        try {
            await apiClient.delete(`/restaurant/menu/items/${itemId}`);
            loadData();
        } catch (error) {
            toast.error('Error removiendo item');
        }
    };

    // Filter products for sidebar
    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.barcode?.includes(searchTerm)
    );

    return (
        <div className="flex h-screen bg-gray-100 p-4 gap-4">

            {/* LEFT: Product Catalog */}
            <div className="w-1/3 bg-white rounded-lg shadow flex flex-col">
                <div className="p-4 border-b">
                    <h2 className="font-bold text-lg text-gray-700">Inventario</h2>
                    <input
                        type="text"
                        placeholder="Buscar producto..."
                        className="w-full mt-2 p-2 border rounded"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                    {filteredProducts.map(product => (
                        <div
                            key={product.id}
                            className="p-3 mb-2 bg-gray-50 rounded border cursor-pointer hover:bg-blue-50 transition-colors flex justify-between items-center group"
                            draggable
                            onDragStart={(e) => setDraggedProduct(product)}
                        >
                            <div>
                                <p className="font-medium text-sm">{product.name}</p>
                                <p className="text-xs text-gray-500">${product.price}</p>
                            </div>
                            {/* Mobile/Direct Action */}
                            <button
                                className="text-blue-500 text-xs opacity-0 group-hover:opacity-100"
                                onClick={() => {
                                    const secId = prompt("Ingrese ID de sección (Temporal):"); // Simple fallback if no D&D
                                }}
                            >
                                +
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* RIGHT: Menu Structure */}
            <div className="flex-1 bg-white rounded-lg shadow flex flex-col">
                <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
                    <h2 className="font-bold text-lg text-gray-800">Estructura del Menú (Carta)</h2>
                    <form onSubmit={handleCreateSection} className="flex gap-2">
                        <input
                            type="text"
                            className="p-2 border rounded text-sm"
                            placeholder="Nueva Sección (Ej: Bebidas)"
                            value={newSectionName}
                            onChange={(e) => setNewSectionName(e.target.value)}
                        />
                        <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700">
                            Crear
                        </button>
                    </form>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {sections.map(section => (
                        <div
                            key={section.id}
                            className="border-2 border-dashed border-gray-300 rounded-lg p-4 bg-gray-50 transition-colors hover:border-blue-400"
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                                e.preventDefault();
                                if (draggedProduct) {
                                    handleAddItem(section.id, draggedProduct);
                                    setDraggedProduct(null);
                                }
                            }}
                        >
                            <div className="flex justify-between items-center mb-4 border-b pb-2">
                                <h3 className="font-bold text-lg text-gray-700">{section.name}</h3>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded">Orden: {section.sort_order}</span>
                                    <button
                                        onClick={() => handleDeleteSection(section.id)}
                                        className="text-red-500 hover:text-red-700 text-sm"
                                    >
                                        Eliminar
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                {section.items.map(item => (
                                    <div key={item.id} className="bg-white p-3 rounded shadow-sm border border-gray-200 relative group">
                                        <button
                                            onClick={() => handleRemoveItem(item.id)}
                                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            ×
                                        </button>
                                        <p className="font-semibold text-sm truncate" title={item.alias}>{item.alias}</p>
                                        <p className="text-xs text-green-600 font-medium">${item.price}</p>
                                    </div>
                                ))}
                                {section.items.length === 0 && (
                                    <div className="col-span-full py-8 text-center text-gray-400 text-sm italic">
                                        Arrastra productos aquí...
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default MenuManager;
