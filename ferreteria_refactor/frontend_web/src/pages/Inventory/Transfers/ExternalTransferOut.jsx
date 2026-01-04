import React, { useState, useEffect } from 'react';
import apiClient from '../../../config/axios';
import { toast } from 'react-hot-toast';
import { Search, Package, ArrowRight, Download, Trash2, AlertTriangle } from 'lucide-react';

const ExternalTransferOut = () => {
    const [products, setProducts] = useState([]);
    const [search, setSearch] = useState('');
    const [selectedItems, setSelectedItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [warehouses, setWarehouses] = useState([]);
    const [selectedWarehouseId, setSelectedWarehouseId] = useState('');

    // Load warehouses on mount
    useEffect(() => {
        const fetchWarehouses = async () => {
            try {
                const response = await apiClient.get('/warehouses');
                const active = response.data.filter(w => w.is_active);
                setWarehouses(active);
                // Default to main or first
                const main = active.find(w => w.is_main);
                if (main) setSelectedWarehouseId(main.id);
                else if (active.length > 0) setSelectedWarehouseId(active[0].id);
            } catch (error) {
                console.error("Error loading warehouses:", error);
                toast.error("No se pudieron cargar los almacenes");
            }
        };
        fetchWarehouses();
    }, []);

    // Initial Search Logic
    useEffect(() => {
        if (search.length > 2) {
            searchProducts();
        }
    }, [search]);

    const searchProducts = async () => {
        try {
            setLoading(true);
            const response = await apiClient.get(`/products?search=${search}&limit=20`);
            setProducts(response.data);
        } catch (error) {
            console.error("Error searching products:", error);
        } finally {
            setLoading(false);
        }
    };

    const addToTransfer = (product) => {
        if (!product.sku) {
            toast.error(`El producto "${product.name}" no tiene Código de Barras (SKU) y no se puede transferir.`);
            return;
        }
        if (selectedItems.find(i => i.product_id === product.id)) {
            toast('El producto ya está en la lista', { icon: '⚠️' });
            return;
        }
        setSelectedItems([...selectedItems, {
            product_id: product.id,
            name: product.name,
            sku: product.sku,
            current_stock: product.stock,
            quantity: 1
        }]);
    };

    const updateQuantity = (id, qty) => {
        const item = selectedItems.find(i => i.product_id === id);
        if (item && qty > item.current_stock) {
            toast.error(`Stock insuficiente. Disponible: ${item.current_stock}`);
            return;
        }
        setSelectedItems(selectedItems.map(item =>
            item.product_id === id ? { ...item, quantity: parseFloat(qty) } : item
        ));
    };

    const removeItem = (id) => {
        setSelectedItems(selectedItems.filter(item => item.product_id !== id));
    };

    const handleExport = async () => {
        if (selectedItems.length === 0) return;
        if (!selectedWarehouseId) {
            toast.error("Seleccione un almacén de origen");
            return;
        }

        try {
            setGenerating(true);
            const loadingToast = toast.loading("Generando y descargando paquete...");

            // Call API to generate package (and deduct stock)
            const payload = {
                source_company: "Ferreteria Principal", // TODO: Make configurable or dynamic
                warehouse_id: parseInt(selectedWarehouseId),
                items: selectedItems.map(item => ({
                    product_id: item.product_id,
                    quantity: item.quantity
                }))
            };

            const response = await apiClient.post('/inventory/transfer/export', payload);

            // Create download
            const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `TRANSFER_${new Date().toISOString().slice(0, 10)}.json`);
            document.body.appendChild(link);
            link.click();
            link.remove();

            toast.dismiss(loadingToast);
            toast.success("Paquete generado exitosamente. Stock descontado.");
            setSelectedItems([]);
            setSearch('');
            setProducts([]);

        } catch (error) {
            console.error("Export failed:", error);
            const msg = error.response?.data?.detail || "Error al generar paquete";
            toast.error(msg);
        } finally {
            setGenerating(false);
        }
    };

    return (
        <div className="flex h-screen bg-slate-50">
            {/* Left Panel: Search */}
            <div className="w-1/2 p-6 flex flex-col border-r border-slate-200">
                <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <Search className="text-indigo-600" />
                    Buscar Productos
                </h2>

                {/* Warehouse Selector */}
                <div className="mb-4 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Almacén de Origen</label>
                    <select
                        value={selectedWarehouseId}
                        onChange={(e) => setSelectedWarehouseId(e.target.value)}
                        className="w-full border-slate-200 rounded-lg text-sm font-semibold text-slate-700 focus:ring-indigo-500"
                    >
                        {warehouses.map(w => (
                            <option key={w.id} value={w.id}>{w.name} {w.is_main ? '(Principal)' : ''}</option>
                        ))}
                    </select>
                </div>

                <div className="relative mb-6">
                    <input
                        type="text"
                        placeholder="Buscar por nombre o código..."
                        className="w-full pl-10 pr-4 py-3 rounded-xl border-none shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-slate-600"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        autoFocus
                    />
                    <Search className="absolute left-3 top-3.5 text-slate-400" size={20} />
                </div>

                <div className="flex-1 overflow-y-auto pr-2 space-y-3">
                    {loading && <div className="text-center py-4 text-slate-400">Buscando...</div>}

                    {products.map(product => (
                        <div
                            key={product.id}
                            onClick={() => addToTransfer(product)}
                            className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer group"
                        >
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="font-bold text-slate-700 group-hover:text-indigo-700 transition-colors">
                                        {product.name}
                                    </h3>
                                    <div className="flex items-center gap-3 mt-1 text-sm">
                                        <span className={`px-2 py-0.5 rounded-md font-mono text-xs ${product.sku ? 'bg-slate-100 text-slate-600' : 'bg-red-50 text-red-600'}`}>
                                            {product.sku || 'SIN SKU'}
                                        </span>
                                        <span className="text-slate-500">
                                            Stock Global: <span className="font-bold text-slate-700">{product.stock}</span>
                                        </span>
                                    </div>
                                </div>
                                <div className="bg-slate-50 p-2 rounded-lg group-hover:bg-indigo-50 transition-colors">
                                    <ArrowRight size={20} className="text-slate-400 group-hover:text-indigo-600" />
                                </div>
                            </div>
                        </div>
                    ))}

                    {!loading && products.length === 0 && search.length > 2 && (
                        <div className="text-center py-8 text-slate-400">
                            No se encontraron productos
                        </div>
                    )}
                </div>
            </div>

            {/* Right Panel: Transfer List */}
            <div className="w-1/2 p-6 flex flex-col bg-white">
                <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <Package className="text-emerald-600" />
                    Paquete de Salida
                </h2>

                <div className="flex-1 overflow-y-auto mb-4 border border-slate-100 rounded-xl bg-slate-50 p-4">
                    {selectedItems.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3 opacity-60">
                            <Download size={48} />
                            <p>Agrega productos para generar el archivo</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {selectedItems.map(item => (
                                <div key={item.product_id} className="bg-white p-3 rounded-lg shadow-sm border border-slate-200 flex items-center gap-4">
                                    <div className="flex-1">
                                        <h4 className="font-bold text-slate-700 text-sm">{item.name}</h4>
                                        <p className="text-xs text-slate-400 font-mono">{item.sku}</p>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-slate-400 font-bold uppercase">Cant:</span>
                                        <input
                                            type="number"
                                            className="w-20 px-2 py-1 border border-slate-200 rounded-lg text-right font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none"
                                            value={item.quantity}
                                            onChange={(e) => updateQuantity(item.product_id, e.target.value)}
                                            min="0"
                                            max={item.current_stock}
                                        />
                                    </div>

                                    <button
                                        onClick={() => removeItem(item.product_id)}
                                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="mt-auto pt-4 border-t border-slate-100">
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex gap-3 text-sm text-amber-800">
                        <AlertTriangle className="flex-shrink-0" size={20} />
                        <p>
                            Al generar el paquete, el stock se descontará <strong>automáticamente</strong> del almacén seleccionado ({warehouses.find(w => w.id == selectedWarehouseId)?.name}) como "Traspaso de Salida".
                        </p>
                    </div>

                    <button
                        onClick={handleExport}
                        disabled={selectedItems.length === 0 || generating || !selectedWarehouseId}
                        className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold shadow-lg hover:bg-slate-800 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                    >
                        {generating ? (
                            <span className="animate-pulse">Procesando...</span>
                        ) : (
                            <>
                                <Download size={20} />
                                Generar y Descargar Paquete JSON
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ExternalTransferOut;
