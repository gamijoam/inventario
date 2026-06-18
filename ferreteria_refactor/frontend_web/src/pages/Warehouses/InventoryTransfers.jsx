import React, { useState, useEffect, useRef } from 'react';
import { ArrowRight, Plus, Calendar, Package, CheckCircle, Search, MapPin, Truck, History, X, Printer, FileText, Zap, AlertTriangle } from 'lucide-react';
import apiClient from '../../config/axios';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import clsx from 'clsx';
import { useFeatureFlag } from '../../hooks/useFeatureFlag';

const InventoryTransfers = () => {
    const trasladosConImei = useFeatureFlag('traslados_con_imei');
    const [view, setView] = useState('list'); // list, create
    const [transfers, setTransfers] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [loading, setLoading] = useState(true);

    // Create Form State
    const [formData, setFormData] = useState({
        source_warehouse_id: '',
        target_warehouse_id: '',
        notes: '',
        date: new Date().toISOString().split('T')[0]
    });
    const [items, setItems] = useState([]);
    const [productSearch, setProductSearch] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [hasSearchedProducts, setHasSearchedProducts] = useState(false);

    // IMEI picker state (per item, by index)
    const [imeiPicker, setImeiPicker] = useState({ openFor: null, instances: [], loading: false, query: '' });
    const imeiPickerDebounce = useRef(null);
    const previousSourceWarehouseId = useRef('');

    useEffect(() => {
        fetchInitialData();
    }, []);

    // Si cambia la bodega origen, limpiar la seleccion: el stock depende del almacen origen.
    useEffect(() => {
        const previousSource = previousSourceWarehouseId.current;
        if (previousSource && previousSource !== formData.source_warehouse_id && items.length > 0) {
            toast('Cambiamos el almacen origen; vuelve a agregar los productos para validar stock.', { icon: 'info' });
        }
        previousSourceWarehouseId.current = formData.source_warehouse_id;
        setItems([]);
        setProductSearch('');
        setSearchResults([]);
        setHasSearchedProducts(false);
        setImeiPicker({ openFor: null, instances: [], loading: false, query: '' });
    }, [formData.source_warehouse_id]);

    const fetchInitialData = async () => {
        try {
            const [transfersRes, warehousesRes] = await Promise.all([
                apiClient.get('/transfers'),
                apiClient.get('/warehouses')
            ]);
            setTransfers(transfersRes.data);
            setWarehouses(warehousesRes.data);
        } catch (error) {
            console.error('Error fetching data:', error);
            toast.error('Error cargando datos');
        } finally {
            setLoading(false);
        }
    };

    const searchProducts = async (query) => {
        const term = (query || '').trim();
        if (!formData.source_warehouse_id) {
            setSearchResults([]);
            setHasSearchedProducts(false);
            return;
        }
        if (term.length < 2) {
            setSearchResults([]);
            setHasSearchedProducts(false);
            return;
        }
        try {
            setSearchLoading(true);
            setHasSearchedProducts(true);
            const { data } = await apiClient.get('/products', {
                params: {
                    search: term,
                    limit: 30,
                    warehouse_id: formData.source_warehouse_id
                }
            });
            const results = Array.isArray(data) ? data : (data?.items || []);
            setSearchResults(results);
        } catch (error) {
            console.error(error);
            setSearchResults([]);
            toast.error('No se pudo buscar productos');
        } finally {
            setSearchLoading(false);
        }
    };

    const addItem = (product) => {
        const stockAvailable = Number(product.stock || 0);
        if (stockAvailable <= 0) {
            return toast.error(`"${product.name}" no tiene stock disponible en el almacen origen.`);
        }
        if (items.find(i => i.product_id === product.id)) return;
        setItems([...items, {
            product_id: product.id,
            name: product.name,
            quantity: 1,
            stock_available: stockAvailable,
            sku: product.sku,
            has_imei: !!product.has_imei,
            selected_imeis: []  // array of {id, serial_number}
        }]);
        setProductSearch('');
        setSearchResults([]);
    };

    const updateItemQty = (index, qty) => {
        const newItems = [...items];
        const quantity = Number(qty);
        newItems[index].quantity = quantity;
        // If quantity went below the number of selected IMEIs, trim
        if (newItems[index].selected_imeis && newItems[index].selected_imeis.length > newItems[index].quantity) {
            newItems[index].selected_imeis = newItems[index].selected_imeis.slice(0, newItems[index].quantity);
        }
        setItems(newItems);
    };

    const removeItem = (index) => {
        setItems(items.filter((_, i) => i !== index));
    };

    const itemStockError = (item) => {
        const quantity = Number(item.quantity || 0);
        const stock = Number(item.stock_available || 0);
        if (quantity <= 0) return 'La cantidad debe ser mayor a cero.';
        if (quantity > stock) return `Solo hay ${stock} disponible(s) en el almacen origen.`;
        return '';
    };

    const hasStockErrors = items.some(item => !!itemStockError(item));

    // ---- IMEI picker (modal-like inline) ----
    const openImeiPicker = async (itemIdx) => {
        const item = items[itemIdx];
        if (!item) return;
        setImeiPicker({ openFor: itemIdx, instances: [], loading: true, query: '' });
        try {
            const { data } = await apiClient.get(`/inventory/product/${item.product_id}/instances`);
            // filter to source warehouse + AVAILABLE
            const sourceId = Number(formData.source_warehouse_id);
            const filtered = (Array.isArray(data) ? data : []).filter(
                pi => pi.warehouse_id === sourceId && pi.status === 'AVAILABLE'
            );
            setImeiPicker(prev => ({ ...prev, instances: filtered, loading: false }));
        } catch (e) {
            console.error(e);
            toast.error('Error cargando IMEIs disponibles');
            setImeiPicker({ openFor: null, instances: [], loading: false, query: '' });
        }
    };

    const closeImeiPicker = () => setImeiPicker({ openFor: null, instances: [], loading: false, query: '' });

    const toggleImeiForItem = (itemIdx, instance) => {
        const newItems = [...items];
        const cur = newItems[itemIdx].selected_imeis || [];
        const isSel = cur.some(s => s.id === instance.id);
        if (isSel) {
            newItems[itemIdx].selected_imeis = cur.filter(s => s.id !== instance.id);
        } else {
            if (cur.length >= newItems[itemIdx].quantity) {
                return toast.error(`Ya seleccionaste ${cur.length} IMEIs (cantidad = ${newItems[itemIdx].quantity}). Quita uno o sube la cantidad.`);
            }
            newItems[itemIdx].selected_imeis = [...cur, { id: instance.id, serial_number: instance.serial_number }];
        }
        setItems(newItems);
    };

    const selectFirstN = (itemIdx, n) => {
        const newItems = [...items];
        const pool = imeiPicker.instances;
        const picks = pool.slice(0, n);
        newItems[itemIdx].selected_imeis = picks.map(p => ({ id: p.id, serial_number: p.serial_number }));
        setItems(newItems);
    };

    const scanImeiForItem = (itemIdx) => {
        const code = imeiPicker.query.trim().toUpperCase();
        if (!code) return;
        const instance = imeiPicker.instances.find(pi => (pi.serial_number || '').toUpperCase() === code);
        if (!instance) {
            toast.error('IMEI no disponible en la bodega origen');
            return;
        }
        toggleImeiForItem(itemIdx, instance);
        setImeiPicker(prev => ({ ...prev, query: '' }));
    };

    const handlePrint = (transferData) => {
        const swName = transferData.source_warehouse?.name || warehouses.find(w => w.id == transferData.source_warehouse_id)?.name || 'N/A';
        const twName = transferData.target_warehouse?.name || warehouses.find(w => w.id == transferData.target_warehouse_id)?.name || 'N/A';
        const itemsList = transferData.details || transferData.items || [];

        const printWindow = window.open('', '_blank');
        if (!printWindow) return toast.error("Permite pop-ups para imprimir");

        const itemsHtml = itemsList.map(item => `
            <tr>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.product?.sku || item.sku || '-'}</td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.product?.name || item.name || 'Item'}</td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center;">${Number(item.quantity).toFixed(2)}</td>
            </tr>
        `).join('');

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Traslado #${transferData.id || 'NUEVO'}</title>
                <style>
                    body { font-family: sans-serif; padding: 20px; color: #333; line-height: 1.4; }
                    .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 10px; }
                    .info { display: flex; justify-content: space-between; margin-bottom: 20px; background: #f9f9f9; padding: 15px; border-radius: 8px; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                    th { text-align: left; background: #f1f5f9; padding: 10px; border-bottom: 2px solid #333; }
                    .signatures { display: flex; justify-content: space-between; margin-top: 60px; }
                    .sig-line { width: 200px; border-top: 1px solid #333; text-align: center; padding-top: 5px; }
                    @media print { .no-print { display: none; } }
                </style>
            </head>
            <body>
                <div class="header">
                    <h2>NOTA DE TRASLADO / ENTREGA</h2>
                    <div style="color: #666;">#${transferData.id || 'BORRADOR'} &bull; ${new Date().toLocaleDateString()}</div>
                </div>

                <div class="info">
                    <div>
                        <strong>ORIGEN (SALE):</strong><br>
                        ${swName}
                    </div>
                    <div style="text-align: right;">
                        <strong>DESTINO (ENTRA):</strong><br>
                        ${twName}
                    </div>
                </div>

                <div style="margin-bottom: 20px;">
                    <strong>Nota:</strong> ${transferData.notes || 'Sin notas adicionales'}
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>SKU</th>
                            <th>Producto</th>
                            <th style="text-align: center;">Cantidad</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHtml}
                    </tbody>
                </table>

                <div class="signatures">
                    <div>
                        <div class="sig-line">Entregado Por</div>
                    </div>
                    <div>
                        <div class="sig-line">Recibido Por</div>
                    </div>
                </div>

                <div class="no-print" style="text-align: center; margin-top: 20px;">
                    <button onclick="window.print()" style="padding: 10px 20px; font-size: 16px; cursor: pointer;">Imprimir</button>
                </div>
                <script>window.onload = function() { window.print(); }</script>
            </body>
            </html>
        `;
        printWindow.document.write(html);
        printWindow.document.close();
    };

    const handleSubmit = async (e, shouldPrint = false) => {
        e && e.preventDefault();
        if (!formData.source_warehouse_id || !formData.target_warehouse_id) {
            return toast.error("Seleccione origen y destino");
        }
        if (items.length === 0) {
            return toast.error("Agregue al menos un producto");
        }
        if (formData.source_warehouse_id === formData.target_warehouse_id) {
            return toast.error("El origen y destino deben ser diferentes");
        }
        const stockErrorItem = items.find(item => !!itemStockError(item));
        if (stockErrorItem) {
            return toast.error(`${stockErrorItem.name}: ${itemStockError(stockErrorItem)}`);
        }

        // Validar IMEIs si el flag esta ON y el item tiene has_imei
        if (trasladosConImei) {
            for (const it of items) {
                if (it.has_imei) {
                    if (!it.selected_imeis || it.selected_imeis.length !== it.quantity) {
                        return toast.error(
                            `"${it.name}" tiene IMEI. Debes seleccionar exactamente ${it.quantity} IMEIs (tienes ${it.selected_imeis?.length || 0}).`
                        );
                    }
                } else if (it.selected_imeis && it.selected_imeis.length > 0) {
                    return toast.error(`"${it.name}" no acepta IMEIs pero se enviaron algunos.`);
                }
            }
        }

        try {
            const payload = {
                ...formData,
                items: items.map(i => {
                    const base = {
                        product_id: i.product_id,
                        quantity: i.quantity
                    };
                    if (trasladosConImei && i.has_imei && i.selected_imeis?.length > 0) {
                        base.instances = i.selected_imeis.map(im => ({ product_instance_id: im.id }));
                    } else {
                        base.instances = [];
                    }
                    return base;
                })
            };
            const { data: newTransfer } = await apiClient.post('/transfers', payload);
            toast.success("Traslado realizado con exito");

            if (shouldPrint) {
                // Reconstruct full object for print with item names
                const printData = {
                    ...newTransfer,
                    source_warehouse: warehouses.find(w => w.id == formData.source_warehouse_id),
                    target_warehouse: warehouses.find(w => w.id == formData.target_warehouse_id),
                    details: items.map(i => ({
                        sku: i.sku,
                        name: i.name,
                        quantity: i.quantity
                    }))
                };
                handlePrint(printData);
            }

            setView('list');
            fetchInitialData();
            // Reset form
            setFormData({ ...formData, notes: '' });
            setItems([]);
            setImeiPicker({ openFor: null, instances: [], loading: false, query: '' });
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.detail || "Error al procesar traslado");
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
    );

    // --- Render List View ---
    if (view === 'list') {
        return (
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                            <Truck className="text-indigo-600" size={32} /> Traslados de Inventario
                        </h1>
                        <p className="text-slate-500 font-medium">Historial y gestión de movimientos entre bodegas</p>
                    </div>
                    <button
                        id="tour-transfers-add-btn"
                        onClick={() => setView('create')}
                        className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-sm shadow-indigo-100 hover:shadow-indigo-300 "
                    >
                        <Plus size={20} /> Nuevo Traslado
                    </button>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">ID</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Fecha</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Origen</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Destino</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Artículos</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Estado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {transfers.map((t, idx) => (
                                    <tr key={t.id} className={clsx(
                                        "hover:bg-slate-50/80 transition-colors",
                                        idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'
                                    )}>
                                        <td className="px-6 py-4 text-xs font-mono font-bold text-slate-400">#{t.id}</td>
                                        <td className="px-6 py-4 text-sm font-medium text-slate-700">{format(new Date(t.date), 'dd/MM/yyyy')}</td>
                                        <td className="px-6 py-4 text-sm">
                                            <span className="flex items-center gap-1.5 text-rose-700 bg-rose-50 px-3 py-1 rounded-lg text-xs font-bold w-fit border border-rose-100">
                                                <MapPin size={12} /> {t.source_warehouse?.name}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm">
                                            <span className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 px-3 py-1 rounded-lg text-xs font-bold w-fit border border-emerald-100">
                                                <ArrowRight size={12} /> {t.target_warehouse?.name}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm font-bold text-slate-600">
                                            <div className="flex items-center gap-2">
                                                <span>{t.details.length}</span>
                                                {t.details.some(d => d.instances && d.instances.length > 0) && (
                                                    <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1" title="Incluye IMEIs / seriales">
                                                        <Zap size={10} />
                                                        {t.details.reduce((sum, d) => sum + (d.instances?.length || 0), 0)} IMEIs
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide">
                                                    {t.status}
                                                </span>
                                                <button
                                                    onClick={() => handlePrint(t)}
                                                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors ml-2"
                                                    title="Imprimir Traslado"
                                                >
                                                    <Printer size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {transfers.length === 0 && (
                                    <tr>
                                        <td colSpan="6" className="py-16 text-center text-slate-400">
                                            <History size={48} className="mx-auto mb-3 opacity-20" />
                                            <p className="font-medium">No hay traslados registrados</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    }

    // --- Render Create View ---
    return (
        <div className="max-w-6xl mx-auto animate-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-4 mb-8">
                <button
                    onClick={() => setView('list')}
                    className="p-3 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-500 transition-colors shadow-sm"
                >
                    <ArrowRight className="rotate-180" size={20} />
                </button>
                <h1 className="text-xl font-black text-slate-800 tracking-tight">Nuevo Traslado</h1>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Config & Items */}
                <div className="lg:col-span-2 space-y-6">

                    {/* Route Card */}
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                        <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2 text-lg border-b border-slate-100 pb-4">
                            <MapPin className="text-indigo-600" size={20} /> Ruta del Traslado
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
                            {/* Connector Arrow for Desktop */}
                            <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 bg-white p-2 rounded-full shadow-sm border border-slate-200 text-slate-400">
                                <ArrowRight size={20} />
                            </div>

                            <div className="space-y-2">
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Bodega Origen (Sale)</label>
                                <select
                                    className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 bg-rose-50/30 text-slate-700 font-medium transition-all"
                                    value={formData.source_warehouse_id}
                                    onChange={e => setFormData({ ...formData, source_warehouse_id: e.target.value })}
                                >
                                    <option value="">Seleccione Origen...</option>
                                    {warehouses.map(w => (
                                        <option key={w.id} value={w.id} disabled={Number(w.id) === Number(formData.target_warehouse_id)}>{w.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Bodega Destino (Entra)</label>
                                <select
                                    className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-emerald-50/30 text-slate-700 font-medium transition-all"
                                    value={formData.target_warehouse_id}
                                    onChange={e => setFormData({ ...formData, target_warehouse_id: e.target.value })}
                                >
                                    <option value="">Seleccione Destino...</option>
                                    {warehouses.map(w => (
                                        <option key={w.id} value={w.id} disabled={Number(w.id) === Number(formData.source_warehouse_id)}>{w.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Products Card */}
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 min-h-[500px] flex flex-col">
                        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 text-lg border-b border-slate-100 pb-4">
                            <Package className="text-indigo-600" size={20} /> Productos a Trasladar
                        </h3>

                        {/* Product Search */}
                        <div className="relative mb-6 group z-20">
                            <div className={clsx(
                                "flex items-center border rounded-xl overflow-hidden transition-all shadow-sm",
                                formData.source_warehouse_id
                                    ? "border-slate-200 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 bg-slate-50 hover:bg-white group-focus-within:bg-white"
                                    : "border-slate-200 bg-slate-100 opacity-80"
                            )}>
                                <Search className={clsx("ml-4", formData.source_warehouse_id ? "text-slate-400" : "text-slate-300")} size={20} />
                                <input
                                    type="text"
                                    className="w-full p-3.5 bg-transparent outline-none font-medium text-slate-700 placeholder:text-slate-400 disabled:cursor-not-allowed"
                                    placeholder={formData.source_warehouse_id ? "Buscar producto por nombre o codigo..." : "Selecciona primero el almacen origen"}
                                    value={productSearch}
                                    disabled={!formData.source_warehouse_id}
                                    onChange={e => {
                                        setProductSearch(e.target.value);
                                        searchProducts(e.target.value);
                                    }}
                                />
                            </div>
                            {!formData.source_warehouse_id && (
                                <div className="mt-2 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                                    El buscador usa el stock del almacen origen. Selecciona de donde sale la mercancia para ver solo productos disponibles ahi.
                                </div>
                            )}
                            {formData.source_warehouse_id && searchLoading && (
                                <div className="absolute top-full left-0 right-0 bg-white shadow-xl rounded-xl mt-2 border border-slate-100 p-4 text-sm font-semibold text-slate-500">
                                    Buscando productos con stock en {warehouses.find(w => w.id == formData.source_warehouse_id)?.name || 'almacen origen'}...
                                </div>
                            )}
                            {searchResults.length > 0 && (
                                <div className="absolute top-full left-0 right-0 bg-white shadow-xl rounded-xl mt-2 border border-slate-100 max-h-64 overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
                                    {searchResults.map(p => (
                                        <button
                                            key={p.id}
                                            onClick={() => addItem(p)}
                                            className="w-full text-left p-4 hover:bg-slate-50 border-b border-slate-50 flex justify-between items-center group transition-colors"
                                        >
                                            <div>
                                                <div className="font-bold text-slate-800 group-hover:text-indigo-600">{p.name}</div>
                                                <div className="text-xs font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded w-fit mt-1">SKU: {p.sku || 'N/A'}</div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="text-right">
                                                    <div className="text-xs uppercase font-black text-slate-400">Disponible</div>
                                                    <div className="text-sm font-black text-emerald-600">{Number(p.stock || 0)} un.</div>
                                                </div>
                                                <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
                                                    <Plus size={16} />
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                            {formData.source_warehouse_id && hasSearchedProducts && !searchLoading && productSearch.trim().length >= 2 && searchResults.length === 0 && (
                                <div className="absolute top-full left-0 right-0 bg-white shadow-xl rounded-xl mt-2 border border-amber-100 p-4 text-sm text-amber-800">
                                    <div className="font-black">Sin stock disponible en este almacen</div>
                                    <div className="text-xs mt-1">
                                        No hay productos que coincidan con "{productSearch.trim()}" en {warehouses.find(w => w.id == formData.source_warehouse_id)?.name || 'el almacen origen'}.
                                    </div>
                                </div>
                            )}
                        </div>

                            {/* Items List */}
                        <div className="space-y-3 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                            {items.map((item, idx) => {
                                const showImeiPicker = trasladosConImei && item.has_imei;
                                const selectedCount = item.selected_imeis?.length || 0;
                                const pickerOpen = imeiPicker.openFor === idx;
                                const stockError = itemStockError(item);
                                return (
                                <div key={idx} className={clsx(
                                    "p-4 border rounded-xl bg-white hover:bg-slate-50/50 transition-all shadow-sm group",
                                    stockError ? "border-rose-200 bg-rose-50/30" : "border-slate-100 hover:border-slate-200"
                                )}>
                                    <div className="flex items-center gap-4">
                                        <div className="flex-1">
                                            <div className="font-bold text-slate-700 flex items-center gap-2">
                                                {item.name}
                                                {showImeiPicker && (
                                                    <span className="text-[10px] uppercase font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">IMEI</span>
                                                )}
                                            </div>
                                            <div className={clsx("text-xs mt-0.5 font-semibold", stockError ? "text-rose-600" : "text-slate-400")}>
                                                Stock en almacen origen: {item.stock_available}
                                            </div>
                                            {stockError && (
                                                <div className="text-xs text-rose-600 font-bold mt-1 flex items-center gap-1">
                                                    <AlertTriangle size={13} /> {stockError}
                                                </div>
                                            )}
                                        </div>
                                        <div className="w-32">
                                            <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block text-center">Cantidad</label>
                                            <input
                                                type="number"
                                                className={clsx(
                                                    "w-full p-2 border rounded-lg text-center font-bold focus:ring-2 outline-none",
                                                    stockError
                                                        ? "border-rose-300 text-rose-600 focus:ring-rose-500/20 focus:border-rose-500"
                                                        : "border-slate-200 text-indigo-600 focus:ring-indigo-500/20 focus:border-indigo-500"
                                                )}
                                                value={item.quantity}
                                                onChange={e => updateItemQty(idx, e.target.value)}
                                                min="0.1"
                                                step="0.1"
                                                max={item.stock_available}
                                            />
                                        </div>
                                        {showImeiPicker && (
                                            <button
                                                type="button"
                                                onClick={() => pickerOpen ? closeImeiPicker() : openImeiPicker(idx)}
                                                className={clsx(
                                                    "text-xs font-bold px-3 py-2 rounded-lg border transition-colors flex items-center gap-1.5",
                                                    selectedCount > 0
                                                        ? "bg-amber-50 border-amber-300 text-amber-700"
                                                        : "bg-white border-slate-200 text-slate-600 hover:border-amber-300 hover:text-amber-700"
                                                )}
                                                title="Seleccionar IMEIs / seriales especificos"
                                            >
                                                <Zap size={13} />
                                                {selectedCount > 0 ? `${selectedCount} IMEI${selectedCount > 1 ? 's' : ''}` : 'IMEIs'}
                                            </button>
                                        )}
                                        <button
                                            onClick={() => removeItem(idx)}
                                            className="text-slate-300 hover:text-rose-500 p-2 hover:bg-rose-50 rounded-lg transition-colors"
                                        >
                                            <X size={20} />
                                        </button>
                                    </div>

                                    {showImeiPicker && pickerOpen && (
                                        <div className="mt-3 border-t border-slate-100 pt-3">
                                            {imeiPicker.loading ? (
                                                <div className="text-xs text-slate-400 py-3 text-center">Cargando IMEIs disponibles...</div>
                                            ) : imeiPicker.instances.length === 0 ? (
                                                <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                                                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                                                    No hay IMEIs AVAILABLE de este producto en la bodega origen. Cambia la bodega origen o agrega IMEIs primero.
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <input
                                                            value={imeiPicker.query}
                                                            onChange={(e) => setImeiPicker(prev => ({ ...prev, query: e.target.value }))}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    e.preventDefault();
                                                                    scanImeiForItem(idx);
                                                                }
                                                            }}
                                                            placeholder="Escanea o escribe el IMEI..."
                                                            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono focus:ring-2 focus:ring-amber-300 outline-none"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => scanImeiForItem(idx)}
                                                            className="px-3 py-2 bg-amber-500 text-white rounded-lg text-xs font-bold"
                                                        >
                                                            Agregar
                                                        </button>
                                                    </div>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <div className="text-xs text-slate-600">
                                                            IMEIs en bodega origen: <b>{imeiPicker.instances.length}</b> disponibles - <b className={selectedCount === item.quantity ? 'text-emerald-600' : 'text-amber-600'}>{selectedCount}/{item.quantity}</b> seleccionados
                                                        </div>
                                                        {imeiPicker.instances.length >= item.quantity && selectedCount < item.quantity && (
                                                            <button
                                                                type="button"
                                                                onClick={() => selectFirstN(idx, item.quantity)}
                                                                className="text-[10px] uppercase font-bold text-indigo-600 hover:text-indigo-700 px-2 py-1 rounded"
                                                            >
                                                                Auto-seleccionar {item.quantity}
                                                            </button>
                                                        )}
                                                    </div>
                                                    <div className="grid grid-cols-1 gap-1 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                                                        {imeiPicker.instances.map(pi => {
                                                            const isSel = item.selected_imeis?.some(s => s.id === pi.id);
                                                            return (
                                                                <button
                                                                    key={pi.id}
                                                                    type="button"
                                                                    onClick={() => toggleImeiForItem(idx, pi)}
                                                                    className={clsx(
                                                                        "text-left p-2 rounded-lg border text-xs font-mono flex items-center gap-2 transition-all",
                                                                        isSel
                                                                            ? "bg-amber-50 border-amber-300 text-amber-800"
                                                                            : "bg-white border-slate-100 text-slate-600 hover:border-slate-300"
                                                                    )}
                                                                >
                                                                    <span className={clsx(
                                                                        "w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0",
                                                                        isSel ? "bg-amber-500 border-amber-500 text-white" : "border-slate-300"
                                                                    )}>
                                                                        {isSel && <CheckCircle size={10} />}
                                                                    </span>
                                                                    <span className="flex-1 truncate">{pi.serial_number}</span>
                                                                    {pi.warehouse?.name && <span className="text-[9px] text-slate-400">{pi.warehouse.name}</span>}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                                );
                            })}
                            {items.length === 0 && (
                                <div className="h-full flex flex-col items-center justify-center text-center py-12 text-slate-400 border-2 border-dashed border-slate-100 rounded-xl bg-slate-50/30">
                                    <Package size={48} className="mb-4 opacity-30" />
                                    <p className="font-bold text-slate-500">Lista de traslado vacia</p>
                                    <p className="text-sm">Busca productos arriba para agregarlos</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column: Actions */}
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 sticky top-6">
                        <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2 text-lg border-b border-slate-100 pb-4">
                            <Calendar className="text-indigo-600" size={20} /> Detalles del envio
                        </h3>
                        <div className="space-y-5">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Fecha</label>
                                <input
                                    type="date"
                                    className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-medium text-slate-700"
                                    value={formData.date}
                                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Notas / Referencia</label>
                                <textarea
                                    className="w-full p-3 border border-slate-200 rounded-xl resize-none h-32 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-700"
                                    placeholder="Razon del traslado, numero de guia..."
                                    value={formData.notes}
                                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                ></textarea>
                            </div>
                        </div>

                        <div className="mt-8 pt-6 border-t border-slate-100">
                            <div className="bg-indigo-50 rounded-xl p-4 mb-4 flex items-start gap-3">
                                <Truck className="text-indigo-600 shrink-0 mt-1" size={18} />
                                <div className="text-xs text-indigo-800 font-medium">
                                    Estas moviendo <span className="font-bold">{items.length} productos</span> de {warehouses.find(w => w.id == formData.source_warehouse_id)?.name || '...'} a {warehouses.find(w => w.id == formData.target_warehouse_id)?.name || '...'}.
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={(e) => handleSubmit(e, true)}
                                    disabled={items.length === 0 || !formData.source_warehouse_id || !formData.target_warehouse_id || hasStockErrors}
                                    className="flex-1 bg-white border-2 border-indigo-600 text-indigo-700 py-4 rounded-xl font-bold shadow-sm hover:bg-indigo-50 transition-all active:scale-95 disabled:opacity-50 flex justify-center items-center gap-2"
                                >
                                    <Printer size={20} /> Guardar e Imprimir
                                </button>
                                <button
                                    onClick={(e) => handleSubmit(e, false)}
                                    disabled={items.length === 0 || !formData.source_warehouse_id || !formData.target_warehouse_id || hasStockErrors}
                                    className="flex-1 bg-indigo-600 text-white py-4 rounded-xl font-bold shadow-sm shadow-indigo-100 hover:bg-indigo-700 hover:shadow-indigo-300 transition-all active:scale-95 disabled:opacity-50 disabled:shadow-none flex justify-center items-center gap-2"
                                >
                                    <CheckCircle size={20} /> Solo Guardar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div >
    );
};

export default InventoryTransfers;
