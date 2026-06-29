import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Archive, CalendarClock, CreditCard, Loader2, ShieldCheck, X } from 'lucide-react';
import apiClient from '../../config/axios';
import toast from 'react-hot-toast';
import CustomerSearch from './CustomerSearch';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { useCash } from '../../context/CashContext';
import { getApiErrorMessage } from '../../utils/apiErrors';

const money = (value) => `$${Number(value || 0).toFixed(2)}`;

const buildLayawayItems = (cart, warehouseId) => {
    const resolvedWarehouseId = (!warehouseId || warehouseId === 'all') ? null : Number(warehouseId);
    return (cart || []).flatMap((item) => {
        const productId = item.product_id;
        const unitPrice = Number(item.unit_price_usd || item.price_unit_usd || item.price_usd || 0);
        const serials = Array.isArray(item.serial_numbers) ? item.serial_numbers.filter(Boolean) : [];
        const serialDetails = Array.isArray(item.serial_details) ? item.serial_details : [];

        if (serials.length > 0 || item.has_imei) {
            return serials.map((serial) => {
                const detail = serialDetails.find((entry) => entry.serial_number === serial) || {};
                return {
                    product_id: productId,
                    warehouse_id: resolvedWarehouseId,
                    quantity: 1,
                    unit_price: unitPrice,
                    product_instance_id: detail.instance_id || null,
                    serial_number: serial,
                };
            });
        }

        return [{
            product_id: productId,
            warehouse_id: resolvedWarehouseId,
            quantity: Number(item.quantity || 1) * Number(item.conversion_factor || 1),
            unit_price: unitPrice,
        }];
    });
};

const calculateMinimumPayment = (settings, total) => {
    const kind = settings?.minimum_down_payment_type || 'percent';
    const value = Number(settings?.minimum_down_payment_value || 0);
    if (kind === 'none') return 0;
    if (kind === 'fixed') return value;
    return total * value / 100;
};

const LayawayCheckoutModal = ({ isOpen, onClose, cart = [], totalUSD = 0, warehouseId, warehouses = [], onCreated, cartDiscount = null }) => {
    const { session } = useCash();
    const [settings, setSettings] = useState(null);
    const [customers, setCustomers] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [loadingCustomers, setLoadingCustomers] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [form, setForm] = useState({ term_days: 10, initial_payment: '', payment_method: 'Efectivo', reference: '', notes: '' });
    const [targetWarehouseId, setTargetWarehouseId] = useState('');

    const defaultWarehouseId = useMemo(() => {
        if (warehouseId && warehouseId !== 'all') return String(warehouseId);
        const active = (warehouses || []).filter((warehouse) => warehouse.is_active !== false);
        const principal = active.find((warehouse) => warehouse.is_main || warehouse.is_primary || warehouse.name?.toLowerCase().includes('principal'));
        return String((principal || active[0] || {}).id || '');
    }, [warehouseId, warehouses]);

    const effectiveWarehouseId = targetWarehouseId || defaultWarehouseId;
    const layawayItems = useMemo(() => buildLayawayItems(cart, effectiveWarehouseId), [cart, effectiveWarehouseId]);
    const hasSerializedWithoutSerial = useMemo(() => cart.some((item) => item.has_imei && (!item.serial_numbers || item.serial_numbers.length === 0)), [cart]);
    const hasGlobalDiscount = !!cartDiscount?.active;
    const minimumPayment = useMemo(() => calculateMinimumPayment(settings, totalUSD), [settings, totalUSD]);
    const initialPayment = Number(form.initial_payment || 0);
    const remaining = Math.max(totalUSD - initialPayment, 0);

    useEffect(() => {
        if (!isOpen) return;
        setTargetWarehouseId(defaultWarehouseId);
        apiClient.get('/layaways/settings')
            .then(({ data }) => {
                setSettings(data);
                setForm((prev) => ({ ...prev, term_days: data?.default_term_days || 10, initial_payment: '' }));
            })
            .catch((error) => toast.error(getApiErrorMessage(error, 'No se pudo cargar la configuracion de apartados')));
    }, [isOpen, defaultWarehouseId]);

    const fetchCustomers = useCallback(async (q = '') => {
        setLoadingCustomers(true);
        try {
            const { data } = await apiClient.get('/customers', { params: { q, limit: 20 } });
            setCustomers(Array.isArray(data) ? data : (data?.items || []));
        } catch (error) {
            console.error('Error buscando clientes:', error);
        } finally {
            setLoadingCustomers(false);
        }
    }, []);

    const handleSubmit = async () => {
        if (!settings?.enabled) {
            toast.error('Los apartados estan desactivados para esta tienda');
            return;
        }
        if (settings?.require_customer && !selectedCustomer) {
            toast.error('Selecciona un cliente para crear el apartado');
            return;
        }
        if (!effectiveWarehouseId) {
            toast.error('Selecciona el almacen que reservara el apartado');
            return;
        }
        if (hasSerializedWithoutSerial || layawayItems.length === 0) {
            toast.error('Los productos serializados deben tener IMEI seleccionado');
            return;
        }
        if (hasGlobalDiscount) {
            toast.error('Para apartar, elimina el descuento global o ajusta el precio del item');
            return;
        }
        if (initialPayment + 0.0001 < minimumPayment) {
            toast.error(`La inicial minima es ${money(minimumPayment)}`);
            return;
        }
        if (Number(form.term_days || 0) <= 0 || Number(form.term_days || 0) > Number(settings?.max_term_days || 365)) {
            toast.error(`El plazo maximo permitido es ${settings?.max_term_days || 365} dias`);
            return;
        }

        setProcessing(true);
        try {
            const payload = {
                customer_id: selectedCustomer?.id || null,
                warehouse_id: Number(effectiveWarehouseId),
                term_days: Number(form.term_days || settings?.default_term_days || 10),
                currency: 'USD',
                notes: form.notes || null,
                items: layawayItems,
                initial_payment: initialPayment > 0 ? {
                    amount: initialPayment,
                    currency: 'USD',
                    exchange_rate: 1,
                    payment_method: form.payment_method || 'Efectivo',
                    reference: form.reference || null,
                    session_id: session?.id || null,
                    notes: 'Inicial registrada desde POS',
                } : null,
            };
            const { data } = await apiClient.post('/layaways', payload);
            toast.success(`Apartado ${data?.code || ''} creado`);
            onCreated?.(data);
        } catch (error) {
            toast.error(getApiErrorMessage(error, 'No se pudo crear el apartado'));
        } finally {
            setProcessing(false);
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
            <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
                <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
                    <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-md shadow-indigo-200">
                            <Archive size={22} />
                        </div>
                        <div>
                            <p className="text-xs font-black uppercase tracking-widest text-slate-400">Reserva de venta</p>
                            <h2 className="text-2xl font-black text-slate-950">Crear apartado</h2>
                            <p className="text-sm font-bold text-slate-500">Reserva el stock y registra una inicial sin cerrar la venta.</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="rounded-lg border border-slate-200 p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-700">
                        <X size={18} />
                    </button>
                </div>

                <div className="grid min-h-0 flex-1 gap-0 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_320px]">
                    <div className="space-y-4 p-5">
                        <section className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-xs font-black uppercase tracking-widest text-slate-400">Cliente</p>
                                    <p className="text-sm font-bold text-slate-600">{settings?.require_customer ? 'Obligatorio para esta tienda' : 'Opcional'}</p>
                                </div>
                                {selectedCustomer && <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-black text-emerald-700">Seleccionado</span>}
                            </div>
                            <CustomerSearch customers={customers} selectedCustomer={selectedCustomer} onSelect={setSelectedCustomer} onSearch={fetchCustomers} loading={loadingCustomers} />
                        </section>

                        <section className="rounded-lg border border-slate-200 bg-white p-3">
                            <span className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-400">Almacen que reserva</span>
                            <select value={effectiveWarehouseId} onChange={(event) => setTargetWarehouseId(event.target.value)} className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-black outline-none focus:border-indigo-400">
                                <option value="">Selecciona almacen...</option>
                                {(warehouses || []).filter((warehouse) => warehouse.is_active !== false).map((warehouse) => (
                                    <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
                                ))}
                            </select>
                            <p className="mt-2 text-xs font-bold text-slate-400">El stock reservado saldra de este almacen.</p>
                        </section>

                        <section className="grid gap-3 sm:grid-cols-2">
                            <label className="rounded-lg border border-slate-200 bg-white p-3">
                                <span className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400"><CalendarClock size={14} /> Plazo</span>
                                <div className="flex items-center gap-2">
                                    <Input type="number" min="1" max={settings?.max_term_days || 365} value={form.term_days} onChange={(event) => setForm({ ...form, term_days: event.target.value })} className="h-11 text-lg font-black" />
                                    <span className="text-sm font-black text-slate-500">dias</span>
                                </div>
                                <p className="mt-2 text-xs font-bold text-slate-400">Maximo: {settings?.max_term_days || '-'} dias</p>
                            </label>
                            <label className="rounded-lg border border-slate-200 bg-white p-3">
                                <span className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400"><CreditCard size={14} /> Inicial USD</span>
                                <Input type="number" min="0" step="0.01" value={form.initial_payment} onChange={(event) => setForm({ ...form, initial_payment: event.target.value })} placeholder={money(minimumPayment)} className="h-11 text-lg font-black" />
                                <p className="mt-2 text-xs font-bold text-slate-400">Minima: {money(minimumPayment)}</p>
                            </label>
                        </section>

                        <section className="grid gap-3 sm:grid-cols-2">
                            <label className="rounded-lg border border-slate-200 bg-white p-3">
                                <span className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-400">Metodo de inicial</span>
                                <select value={form.payment_method} onChange={(event) => setForm({ ...form, payment_method: event.target.value })} className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-black outline-none focus:border-indigo-400">
                                    <option>Efectivo</option>
                                    <option>Punto de Venta</option>
                                    <option>Zelle</option>
                                    <option>Transferencia</option>
                                    <option>Pago Movil</option>
                                </select>
                            </label>
                            <label className="rounded-lg border border-slate-200 bg-white p-3">
                                <span className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-400">Referencia</span>
                                <Input value={form.reference} onChange={(event) => setForm({ ...form, reference: event.target.value })} placeholder="Opcional" className="h-11 font-bold" />
                            </label>
                        </section>

                        <label className="block rounded-lg border border-slate-200 bg-white p-3">
                            <span className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-400">Nota interna</span>
                            <textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} rows={3} placeholder="Condiciones acordadas, fecha prometida, observaciones..." className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:border-indigo-400" />
                        </label>
                    </div>

                    <aside className="border-t border-slate-100 bg-slate-50 p-5 lg:border-l lg:border-t-0">
                        <div className="sticky top-0 space-y-4">
                            <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-4">
                                <p className="text-xs font-black uppercase tracking-widest text-indigo-500">Resumen</p>
                                <div className="mt-3 space-y-2 text-sm font-bold">
                                    <div className="flex justify-between"><span className="text-slate-500">Total</span><span className="text-slate-950">{money(totalUSD)}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-500">Inicial</span><span className="text-emerald-700">{money(initialPayment)}</span></div>
                                    <div className="flex justify-between border-t border-indigo-100 pt-2"><span className="text-slate-500">Saldo</span><span className="text-amber-700">{money(remaining)}</span></div>
                                </div>
                            </div>

                            <div className="rounded-lg border border-slate-200 bg-white p-4">
                                <p className="mb-3 text-xs font-black uppercase tracking-widest text-slate-400">Productos</p>
                                <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                                    {cart.map((item) => (
                                        <div key={item.id} className="rounded-md bg-slate-50 p-2">
                                            <div className="flex justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-black text-slate-900">{item.name}</p>
                                                    <p className="text-xs font-bold text-slate-400">Cant. {item.quantity} · {money(item.unit_price_usd)}</p>
                                                    {item.serial_numbers?.[0] && <p className="mt-1 text-xs font-black text-indigo-600">IMEI: {item.serial_numbers[0]}</p>}
                                                </div>
                                                <span className="text-sm font-black text-slate-900">{money(item.subtotal_usd)}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {hasGlobalDiscount && (
                                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-700">
                                    El descuento global del carrito no se transfiere al apartado. Ajusta el precio del item o elimina el descuento para continuar.
                                </div>
                            )}

                            <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-xs font-bold text-emerald-700">
                                <ShieldCheck size={15} className="mb-1" />
                                Al confirmar, el stock queda reservado. Si es IMEI, el equipo pasa a estado reservado.
                            </div>
                        </div>
                    </aside>
                </div>

                <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs font-bold text-slate-400">El apartado quedara visible en Centro de Ventas → Apartados.</p>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={onClose} disabled={processing}>Cancelar</Button>
                        <Button onClick={handleSubmit} disabled={processing || !settings} className="bg-indigo-600 font-black hover:bg-indigo-700">
                            {processing ? <Loader2 className="mr-2 animate-spin" size={16} /> : <Archive className="mr-2" size={16} />}
                            Crear apartado
                        </Button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default LayawayCheckoutModal;
