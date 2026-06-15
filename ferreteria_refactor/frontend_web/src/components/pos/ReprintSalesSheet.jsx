import { useEffect, useMemo, useState } from 'react';
import { FileText, Printer, ReceiptText, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../ui/sheet';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import apiClient from '../../config/axios';
import printerService from '../../services/printerService';
import { getApiErrorMessage } from '../../utils/apiErrors';

const money = (value, currency = 'USD') => {
    const amount = Number(value || 0);
    return `${currency === 'USD' ? '$' : currency} ${amount.toFixed(2)}`;
};

const formatDate = (value) => {
    if (!value) return '';
    try {
        return new Date(value).toLocaleString('es-VE', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return value;
    }
};

const ReprintSalesSheet = ({ open, onOpenChange, session, currentRegister }) => {
    const [sales, setSales] = useState([]);
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [busySaleId, setBusySaleId] = useState(null);

    const params = useMemo(() => {
        const next = { limit: 30 };
        if (session?.id) next.session_id = session.id;
        else if (currentRegister?.id) next.register_id = currentRegister.id;
        if (query.trim()) next.q = query.trim();
        return next;
    }, [session?.id, currentRegister?.id, query]);

    const loadSales = async () => {
        setLoading(true);
        try {
            const res = await apiClient.get('/products/sales/reprintable/recent', { params });
            setSales(Array.isArray(res.data) ? res.data : []);
        } catch (error) {
            toast.error(getApiErrorMessage(error, 'No se pudieron cargar las ventas'));
            setSales([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!open) return;
        loadSales();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, params.session_id, params.register_id]);

    useEffect(() => {
        if (!open) return;
        const timer = setTimeout(loadSales, 350);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [query]);

    const handleTicket = async (sale) => {
        setBusySaleId(sale.id);
        try {
            await printerService.printTicket(sale.id);
            toast.success(`Ticket #${sale.id} enviado a impresora`);
        } catch (error) {
            toast.error(getApiErrorMessage(error, 'No se pudo reimprimir el ticket'));
        } finally {
            setBusySaleId(null);
        }
    };

    const handleWarranty = async (sale) => {
        setBusySaleId(sale.id);
        try {
            const response = await apiClient.get(`/warranties/print/${sale.id}`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
            const printWindow = window.open(url, '_blank');
            if (!printWindow) {
                toast.error('Permite ventanas emergentes para abrir la garantia');
                return;
            }
            printWindow.addEventListener('load', () => {
                try { printWindow.print(); } catch {}
            });
            toast.success(`Garantia #${sale.id} generada`);
        } catch (error) {
            toast.error(getApiErrorMessage(error, 'Esta venta no tiene garantia disponible'));
        } finally {
            setBusySaleId(null);
        }
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="flex w-full flex-col overflow-hidden sm:max-w-xl">
                <SheetHeader className="shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                            <ReceiptText size={20} />
                        </div>
                        <div>
                            <SheetTitle>Reimprimir venta</SheetTitle>
                            <p className="text-sm font-semibold text-slate-500">
                                {currentRegister?.code || currentRegister?.name || 'Caja actual'}
                                {currentRegister?.hardware_client_id ? ` / ${currentRegister.hardware_client_id}` : ''}
                            </p>
                        </div>
                    </div>
                </SheetHeader>

                <div className="shrink-0 border-b border-slate-200 bg-white px-6 py-4">
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <Input
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder="Buscar venta, cliente o pago..."
                                className="pl-9"
                            />
                        </div>
                        <Button type="button" variant="outline" size="icon" onClick={loadSales} disabled={loading} title="Actualizar">
                            <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
                        </Button>
                    </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 px-6 py-4">
                    {loading && sales.length === 0 ? (
                        <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm font-bold text-slate-500">
                            Cargando ventas...
                        </div>
                    ) : sales.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
                            <ReceiptText className="mx-auto mb-3 h-8 w-8 text-slate-300" />
                            <p className="font-black text-slate-700">Sin ventas para reimprimir</p>
                            <p className="mt-1 text-sm text-slate-500">Prueba buscando por numero de venta o revisa la caja seleccionada.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {sales.map((sale) => (
                                <div key={sale.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="text-lg font-black text-slate-900">Venta #{sale.id}</p>
                                                {sale.has_warranty && <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50">Garantia</Badge>}
                                            </div>
                                            <p className="text-sm font-semibold text-slate-500">{formatDate(sale.date)} ? {sale.payment_method}</p>
                                            <p className="mt-1 truncate text-sm text-slate-600">{sale.customer_name}</p>
                                            {sale.items_preview?.length > 0 && (
                                                <p className="mt-2 line-clamp-2 text-xs font-semibold text-slate-400">
                                                    {sale.items_preview.join(' ? ')}{sale.item_count > sale.items_preview.length ? ` +${sale.item_count - sale.items_preview.length}` : ''}
                                                </p>
                                            )}
                                        </div>
                                        <div className="text-right">
                                            <p className="text-lg font-black text-indigo-600">{money(sale.total_amount, sale.currency)}</p>
                                            <p className="text-xs font-bold text-slate-400">{sale.register_code || sale.register_name || 'Caja'}</p>
                                        </div>
                                    </div>
                                    <div className="mt-4 grid grid-cols-2 gap-2">
                                        <Button
                                            type="button"
                                            onClick={() => handleTicket(sale)}
                                            disabled={busySaleId === sale.id}
                                            className="h-10 gap-2 rounded-xl bg-indigo-600 font-black hover:bg-indigo-700"
                                        >
                                            <Printer size={16} /> Ticket
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => handleWarranty(sale)}
                                            disabled={busySaleId === sale.id || !sale.has_warranty}
                                            className="h-10 gap-2 rounded-xl border-emerald-200 font-black text-emerald-700 hover:bg-emerald-50 disabled:border-slate-200 disabled:text-slate-300"
                                            title={sale.has_warranty ? 'Abrir garantia PDF' : 'La venta no tiene garantia'}
                                        >
                                            {sale.has_warranty ? <ShieldCheck size={16} /> : <FileText size={16} />} Garantia
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
};

export default ReprintSalesSheet;
