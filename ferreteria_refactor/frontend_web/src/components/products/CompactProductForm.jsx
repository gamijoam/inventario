import { useEffect, useState } from 'react';
import { X, Package, DollarSign, Warehouse, Layers, ScanBarcode, Scissors, Check, ChevronDown } from 'lucide-react';
import { Sheet, SheetContent } from '../../components/ui/sheet';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { cn } from '../../lib/utils';
import { useConfig } from '../../context/ConfigContext';
import apiClient from '../../config/axios';

const defaultForm = {
    name: '',
    sku: '',
    category_id: null,
    cost: '',
    price: '',
    profit_margin: '',
    stock: 0,
    min_stock: 5,
    location: '',
    unit_type: 'UNID',
    exchange_rate_id: null,
    is_service: false,
    has_imei: false,
    is_combo: false,
    is_menu_item: false,
    is_commissionable: false,
    warehouse_stocks: [],
    prices: {},
    units: [],
    combo_items: [],
    warranty_policy_id: null,
    commission_amount: '',
    commission_percentage: '',
};

const ProductTypeButton = ({ active, icon: Icon, label, desc, onClick }) => (
    <button
        type="button"
        onClick={onClick}
        className={cn(
            'flex min-h-[70px] items-center gap-3 rounded-lg border p-3 text-left transition-all',
            active ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-500/10' : 'border-slate-200 bg-white hover:border-indigo-200'
        )}
    >
        <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', active ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400')}>
            <Icon size={16} />
        </span>
        <span className="min-w-0">
            <span className="block truncate text-sm font-black text-slate-800">{label}</span>
            <span className="block truncate text-xs font-bold text-slate-400">{desc}</span>
        </span>
    </button>
);

const CompactProductForm = ({ isOpen, onClose, onSubmit, categories = [], warehouses = [], exchangeRates = [] }) => {
    const { modules } = useConfig();
    const [formData, setFormData] = useState(defaultForm);
    const [activeTab, setActiveTab] = useState('precios');
    const [saving, setSaving] = useState(false);
    const [priceLists, setPriceLists] = useState([]);


    useEffect(() => {
        if (!isOpen) return;
        let cancelled = false;
        (async () => {
            try {
                const { data } = await apiClient.get('/price-lists/');
                if (!cancelled) setPriceLists(Array.isArray(data) ? data.filter(list => list.is_active !== false) : []);
            } catch {
                if (!cancelled) setPriceLists([]);
            }
        })();
        return () => { cancelled = true; };
    }, [isOpen]);

    const priceValue = parseFloat(formData.price || 0) || 0;
    const costValue = parseFloat(formData.cost || 0) || 0;
    const profitValue = priceValue - costValue;
    const productType = formData.is_service ? 'service' : formData.is_combo ? 'combo' : formData.has_imei ? 'serial' : 'physical';

    const setProductType = (type) => {
        setFormData(prev => ({
            ...prev,
            is_service: type === 'service',
            has_imei: type === 'serial',
            is_combo: type === 'combo',
            combo_items: type === 'combo' ? prev.combo_items : [],
            warehouse_stocks: type === 'physical' ? prev.warehouse_stocks : [],
            stock: type === 'physical' ? prev.stock : 0,
        }));
    };

    const setWarehouseQty = (warehouseId, rawValue) => {
        const quantity = parseFloat(rawValue) || 0;
        setFormData(prev => {
            const stocks = [...prev.warehouse_stocks];
            const idx = stocks.findIndex(item => item.warehouse_id === warehouseId);
            if (idx >= 0) stocks[idx] = { ...stocks[idx], quantity };
            else stocks.push({ warehouse_id: warehouseId, quantity });
            return { ...prev, warehouse_stocks: stocks, stock: stocks.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0) };
        });
    };

    const handleSubmit = async () => {
        setSaving(true);
        try {
            await onSubmit({
                ...formData,
                name: formData.name.trim(),
                sku: formData.sku.trim(),
                category_id: formData.category_id || null,
                cost: parseFloat(formData.cost || 0) || 0,
                price: parseFloat(formData.price || 0) || 0,
                profit_margin: parseFloat(formData.profit_margin || 0) || 0,
                min_stock: parseFloat(formData.min_stock || 0) || 0,
                exchange_rate_id: formData.exchange_rate_id || null,
            });
            setFormData(defaultForm);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Sheet open={isOpen} onOpenChange={onClose}>
            <SheetContent side="right" className="w-full sm:w-[94vw] sm:max-w-[1120px] flex flex-col gap-0 p-0 border-l border-slate-200 bg-slate-50 [&>button.absolute]:hidden">
                <div className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-3 shadow-sm">
                    <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white">
                            <Package size={18} />
                        </div>
                        <div className="min-w-0">
                            <h2 className="truncate text-lg font-black text-slate-900">Nuevo producto compacto</h2>
                            <p className="truncate text-xs font-bold text-slate-500">Diseno experimental horizontal</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button type="button" variant="ghost" onClick={onClose} className="font-bold">Cancelar</Button>
                        <Button type="button" onClick={handleSubmit} disabled={saving || !formData.name.trim()} className="bg-indigo-600 font-black text-white hover:bg-indigo-700">
                            <Check size={16} className="mr-2" /> {saving ? 'Guardando...' : 'Guardar'}
                        </Button>
                    </div>
                </div>

                <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[360px_1fr]">
                    <aside className="overflow-y-auto border-r border-slate-200 bg-white p-4">
                        <div className="space-y-4">
                            <div>
                                <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-500">Nombre del producto *</label>
                                <Input value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} placeholder="Ej: Adaptador USB-C" className="h-11 font-bold" />
                            </div>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
                                <div>
                                    <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-500">SKU / Codigo</label>
                                    <Input value={formData.sku} onChange={e => setFormData(p => ({ ...p, sku: e.target.value }))} placeholder="SKU-001" className="h-10 font-bold" />
                                </div>
                                <div>
                                    <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-500">Categoria</label>
                                    <select
                                        value={formData.category_id || ''}
                                        onChange={e => setFormData(p => ({ ...p, category_id: e.target.value || null }))}
                                        className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-indigo-400"
                                    >
                                        <option value="">Sin categoria</option>
                                        {categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">Tipo</p>
                                <div className="grid grid-cols-1 gap-2">
                                    <ProductTypeButton active={productType === 'physical'} icon={Package} label="Fisico" desc="Stock por almacen" onClick={() => setProductType('physical')} />
                                    {modules.services && (
                                        <ProductTypeButton active={productType === 'serial'} icon={ScanBarcode} label="Serial / IMEI" desc="Un serial por unidad" onClick={() => setProductType('serial')} />
                                    )}
                                    <ProductTypeButton active={productType === 'service'} icon={Scissors} label="Servicio" desc="Sin inventario" onClick={() => setProductType('service')} />
                                    <ProductTypeButton active={productType === 'combo'} icon={Layers} label="Combo / kit" desc="Componentes" onClick={() => setProductType('combo')} />
                                </div>
                            </div>
                        </div>
                    </aside>

                    <main className="flex min-h-0 flex-col overflow-hidden">
                        <div className="border-b border-slate-200 bg-white px-4 py-3">
                            <div className="inline-flex rounded-lg bg-slate-100 p-1">
                                {[
                                    { id: 'precios', label: 'Precios', icon: DollarSign },
                                    { id: 'inventario', label: 'Inventario', icon: Warehouse },
                                    { id: 'avanzado', label: 'Avanzado', icon: Layers },
                                ].map(tab => {
                                    const Icon = tab.icon;
                                    return (
                                        <button
                                            key={tab.id}
                                            type="button"
                                            onClick={() => setActiveTab(tab.id)}
                                            className={cn('inline-flex h-9 items-center gap-2 rounded-md px-4 text-sm font-black transition-all', activeTab === tab.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-900')}
                                        >
                                            <Icon size={15} /> {tab.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto p-4">
                            {activeTab === 'precios' && (
                                <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_320px]">
                                    <section className="rounded-lg border border-emerald-200 bg-white p-4 shadow-sm">
                                        <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-emerald-600">Precio de venta</label>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black text-emerald-500">$</span>
                                            <Input type="number" value={formData.price} onChange={e => setFormData(p => ({ ...p, price: e.target.value }))} className="h-14 border-2 border-emerald-200 pl-10 text-right text-3xl font-black text-emerald-600" placeholder="0.00" />
                                        </div>
                                    </section>
                                    <section className="space-y-3">
                                        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                                            <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-500">Costo</label>
                                            <Input type="number" value={formData.cost} onChange={e => setFormData(p => ({ ...p, cost: e.target.value }))} className="h-10 font-bold" placeholder="0.00" />
                                        </div>
                                        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                                            <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-500">Margen</label>
                                            <Input type="number" value={formData.profit_margin} onChange={e => setFormData(p => ({ ...p, profit_margin: e.target.value }))} className="h-10 text-center font-black text-indigo-600" placeholder="0" />
                                        </div>
                                        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Utilidad estimada</p>
                                            <p className={cn('mt-1 text-xl font-black', profitValue < 0 ? 'text-rose-600' : 'text-slate-900')}>${profitValue.toFixed(2)}</p>
                                        </div>
                                    </section>
                                    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm xl:col-span-2">
                                        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                            <div>
                                                <h3 className="text-sm font-black text-slate-900">Listas de precios</h3>
                                                <p className="text-xs font-bold text-slate-400">Precio base ${priceValue.toFixed(2)} - {priceLists.length} listas activas</p>
                                            </div>
                                            <span className="rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-indigo-600">
                                                Opcional
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                                            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                                                <p className="text-[10px] font-black uppercase tracking-wider text-emerald-600">Precio base</p>
                                                <p className="text-lg font-black text-emerald-700">${priceValue.toFixed(2)}</p>
                                            </div>
                                            {priceLists.map(list => {
                                                const listPrice = formData.prices?.[list.id] || '';
                                                return (
                                                    <div key={list.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                                        <label className="mb-1 block truncate text-[10px] font-black uppercase tracking-wider text-slate-500">{list.name}</label>
                                                        <div className="relative">
                                                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">$</span>
                                                            <Input
                                                                type="number"
                                                                step="0.01"
                                                                value={listPrice}
                                                                onChange={e => setFormData(prev => ({
                                                                    ...prev,
                                                                    prices: { ...prev.prices, [list.id]: e.target.value }
                                                                }))}
                                                                placeholder="0.00"
                                                                className="h-9 border-slate-200 bg-white pl-6 text-right text-sm font-black text-indigo-700"
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            {priceLists.length === 0 && (
                                                <div className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-xs font-bold text-slate-400 md:col-span-2">
                                                    No hay listas de precios activas.
                                                </div>
                                            )}
                                        </div>
                                    </section>
                                </div>
                            )}

                            {activeTab === 'inventario' && (
                                <div className="space-y-4">
                                    {productType === 'physical' && (
                                        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                                            <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                                                <div>
                                                    <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-500">Stock minimo</label>
                                                    <Input type="number" value={formData.min_stock} onChange={e => setFormData(p => ({ ...p, min_stock: e.target.value }))} className="h-10 font-bold" />
                                                </div>
                                                <div>
                                                    <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-500">Ubicacion</label>
                                                    <Input value={formData.location} onChange={e => setFormData(p => ({ ...p, location: e.target.value }))} className="h-10 font-bold" placeholder="Pasillo A" />
                                                </div>
                                                <div>
                                                    <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-500">Unidad</label>
                                                    <select value={formData.unit_type} onChange={e => setFormData(p => ({ ...p, unit_type: e.target.value }))} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-bold">
                                                        <option value="UNID">Unidad</option>
                                                        <option value="KILO">Kilo</option>
                                                        <option value="METRO">Metro</option>
                                                        <option value="CAJA">Caja</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                                                {warehouses.map(warehouse => {
                                                    const qty = formData.warehouse_stocks.find(item => item.warehouse_id === warehouse.id)?.quantity || 0;
                                                    return (
                                                        <div key={warehouse.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                                            <span className="truncate text-sm font-bold text-slate-700">{warehouse.name}</span>
                                                            <Input type="number" value={Number(qty).toString()} onChange={e => setWarehouseQty(warehouse.id, e.target.value)} className="h-9 w-24 text-right font-black" />
                                                        </div>
                                                    );
                                                })}
                                                {warehouses.length === 0 && <p className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-sm font-bold text-slate-400">No hay almacenes configurados</p>}
                                            </div>
                                        </section>
                                    )}
                                    {productType === 'serial' && (
                                        <section className="rounded-lg border border-blue-100 bg-white p-4 shadow-sm">
                                            <h3 className="font-black text-slate-900">Control serializado</h3>
                                            <p className="mt-1 text-sm font-medium text-slate-500">Las unidades se cargan luego desde Recepcion IMEI. Aqui defines alerta y ubicacion sugerida.</p>
                                            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                                                <Input type="number" value={formData.min_stock} onChange={e => setFormData(p => ({ ...p, min_stock: e.target.value }))} placeholder="Alerta minima" />
                                                <Input value={formData.location} onChange={e => setFormData(p => ({ ...p, location: e.target.value }))} placeholder="Ubicacion sugerida" />
                                            </div>
                                        </section>
                                    )}
                                    {(productType === 'service' || productType === 'combo') && (
                                        <section className="rounded-lg border border-indigo-100 bg-white p-5 shadow-sm">
                                            <h3 className="font-black text-slate-900">{productType === 'service' ? 'Servicio sin inventario' : 'Combo calculado por componentes'}</h3>
                                            <p className="mt-1 text-sm font-medium text-slate-500">Este tipo no requiere carga manual de stock en este formulario compacto.</p>
                                        </section>
                                    )}
                                </div>
                            )}

                            {activeTab === 'avanzado' && (
                                <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                        {modules?.restaurant && (
                                            <label className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-black text-slate-700">
                                                Item de menu
                                                <input type="checkbox" checked={formData.is_menu_item} onChange={e => setFormData(p => ({ ...p, is_menu_item: e.target.checked }))} />
                                            </label>
                                        )}
                                        <label className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-black text-slate-700">
                                            Aplica comision
                                            <input type="checkbox" checked={formData.is_commissionable} onChange={e => setFormData(p => ({ ...p, is_commissionable: e.target.checked }))} />
                                        </label>
                                        <div>
                                            <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-500">Tasa de referencia</label>
                                            <select value={formData.exchange_rate_id || ''} onChange={e => setFormData(p => ({ ...p, exchange_rate_id: e.target.value || null }))} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-bold">
                                                <option value="">Tasa global</option>
                                                {exchangeRates.map(rate => <option key={rate.id} value={rate.id}>{rate.name}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </main>
                </div>
            </SheetContent>
        </Sheet>
    );
};

export default CompactProductForm;
