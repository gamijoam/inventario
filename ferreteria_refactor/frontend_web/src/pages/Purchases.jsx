import { useState, useEffect } from 'react';
import HelpDrawer, { HelpButton } from '../help/HelpDrawer';
import { useHelp } from '../help/useHelp';
import { Plus, FileText, DollarSign, Calendar, TrendingUp, Trash2, Package, Upload, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import apiClient from '../config/axios';
import toast from 'react-hot-toast';
import { getApiErrorMessage } from '../utils/apiErrors';

const Purchases = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const help = useHelp();
    const helpKey = 'purchases';
    const [purchases, setPurchases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('ALL');

    const formatMoney = (value) => `$${Number(value || 0).toFixed(2)}`;
    const filterLabels = { ALL: 'Todas', PENDING: 'Pendientes', PARTIAL: 'Parciales', PAID: 'Pagadas' };

    useEffect(() => {
        fetchPurchases();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filter]);

    const fetchPurchases = async () => {
        setLoading(true);
        try {
            const endpoint = filter !== 'ALL' ? `/purchases?status=${filter}` : '/purchases';
            const response = await apiClient.get(endpoint);
            setPurchases(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error('Error fetching purchases:', error);
            toast.error(getApiErrorMessage(error, 'Error al cargar compras'));
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (status) => {
        const styles = {
            PENDING: 'border-rose-200 bg-rose-50 text-rose-700',
            PARTIAL: 'border-amber-200 bg-amber-50 text-amber-700',
            PAID: 'border-emerald-200 bg-emerald-50 text-emerald-700'
        };
        const labels = {
            PENDING: 'Pendiente',
            PARTIAL: 'Parcial',
            PAID: 'Pagado'
        };
        return (
            <span className={`inline-flex items-center rounded-md border px-2 py-1 text-[11px] font-black uppercase tracking-wide ${styles[status] || 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                {labels[status] || status}
            </span>
        );
    };

    const handleVoid = async (purchase) => {
        const ref = purchase.invoice_number || `#${purchase.id}`;
        if (!window.confirm(`?Anular la factura ${ref}? Esto revertir? el stock ingresado y no se puede deshacer.`)) return;
        try {
            const res = await apiClient.delete(`/purchases/${purchase.id}`);
            toast.success(`Factura ${ref} anulada. Se revirtieron ${res.data.reversed_items?.length || 0} productos.`);
            fetchPurchases();
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Error al anular la factura'));
        }
    };

    const handleViewDetails = (purchaseId) => {
        navigate(`/purchases/${purchaseId}`);
    };

    const totalAmount = purchases.reduce((sum, purchase) => sum + Number(purchase.total_amount || 0), 0);
    const paidAmount = purchases.reduce((sum, purchase) => sum + Number(purchase.paid_amount || 0), 0);
    const pendingAmount = Math.max(totalAmount - paidAmount, 0);
    const statusCounts = purchases.reduce((acc, purchase) => {
        acc[purchase.payment_status] = (acc[purchase.payment_status] || 0) + 1;
        return acc;
    }, {});

    return (
        <div className="space-y-4 p-4 md:p-6">
            <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-col gap-4 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                                <Package size={20} />
                            </div>
                            <div>
                                <h1 className="text-xl font-black text-slate-900">Compras</h1>
                                <p className="text-sm font-semibold text-slate-500">Recepcion de inventario, facturas y cuentas por pagar.</p>
                            </div>
                            <HelpButton contextKey={helpKey} onClick={help.open} />
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {['ADMIN', 'WAREHOUSE'].includes(user?.role) && (
                            <button
                                onClick={() => navigate('/purchases/import')}
                                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-600 transition-colors hover:border-indigo-300 hover:text-indigo-600"
                                title="Importar historial desde Excel"
                            >
                                <Upload size={16} /> Importar
                            </button>
                        )}
                        <button
                            id="tour-purchases-add-btn"
                            onClick={() => navigate('/purchases/new')}
                            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-black text-white shadow-sm shadow-indigo-100 transition-colors hover:bg-indigo-700"
                        >
                            <Plus size={18} /> Nueva compra
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3">
                    {[
                        { label: 'Compras en vista', value: purchases.length, icon: FileText, cls: 'text-slate-900' },
                        { label: 'Total comprado', value: formatMoney(totalAmount), icon: DollarSign, cls: 'text-indigo-600' },
                        { label: 'Por pagar', value: formatMoney(pendingAmount), icon: TrendingUp, cls: pendingAmount > 0 ? 'text-amber-600' : 'text-emerald-600' },
                    ].map(item => {
                        const Icon = item.icon;
                        return (
                            <div key={item.label} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-[10px] font-black uppercase tracking-wide text-slate-400">{item.label}</span>
                                    <Icon size={16} className="text-slate-400" />
                                </div>
                                <div className={`mt-2 text-2xl font-black leading-none ${item.cls}`}>{item.value}</div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                <div className="flex flex-wrap gap-1.5">
                    {['ALL', 'PENDING', 'PARTIAL', 'PAID'].map(status => {
                        const count = status === 'ALL' ? purchases.length : (statusCounts[status] || 0);
                        const active = filter === status;
                        return (
                            <button
                                key={status}
                                onClick={() => setFilter(status)}
                                className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-black transition-colors ${active ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-500 hover:border-indigo-300 hover:text-indigo-600'}`}
                            >
                                {filterLabels[status]}
                                <span className={`rounded px-1.5 py-0.5 text-[10px] ${active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>{count}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="space-y-3 md:hidden">
                {loading ? (
                    <div className="rounded-lg border border-slate-200 bg-white py-10 text-center text-sm font-semibold text-slate-500">Cargando compras...</div>
                ) : purchases.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-300 bg-white py-10 text-center text-sm font-semibold text-slate-500">No hay compras registradas</div>
                ) : (
                    purchases.map(purchase => (
                        <div
                            key={purchase.id}
                            onClick={() => handleViewDetails(purchase.id)}
                            className="cursor-pointer rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-colors active:bg-slate-50"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                    <p className="truncate font-black text-slate-900">{purchase.supplier?.name || 'Sin proveedor'}</p>
                                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-400">
                                        <span className="inline-flex items-center gap-1"><Calendar size={12} />{new Date(purchase.purchase_date).toLocaleDateString()}</span>
                                        <span className="inline-flex items-center gap-1"><FileText size={12} />{purchase.invoice_number || 'Sin factura'}</span>
                                    </div>
                                </div>
                                {getStatusBadge(purchase.payment_status)}
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Total</p>
                                    <p className="text-base font-black text-slate-900">{formatMoney(purchase.total_amount)}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Pagado</p>
                                    <p className="text-base font-black text-emerald-600">{formatMoney(purchase.paid_amount)}</p>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div className="hidden overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm md:block">
                <table className="w-full">
                    <thead className="border-b border-slate-200 bg-slate-50">
                        <tr>
                            <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wide text-slate-400">Fecha</th>
                            <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wide text-slate-400">Proveedor</th>
                            <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wide text-slate-400">Factura</th>
                            <th className="px-4 py-3 text-right text-[11px] font-black uppercase tracking-wide text-slate-400">Total</th>
                            <th className="px-4 py-3 text-right text-[11px] font-black uppercase tracking-wide text-slate-400">Pagado</th>
                            <th className="px-4 py-3 text-center text-[11px] font-black uppercase tracking-wide text-slate-400">Estado</th>
                            <th className="px-4 py-3 text-right text-[11px] font-black uppercase tracking-wide text-slate-400">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr><td colSpan="7" className="p-8 text-center text-sm font-semibold text-slate-500">Cargando compras...</td></tr>
                        ) : purchases.length === 0 ? (
                            <tr><td colSpan="7" className="p-8 text-center text-sm font-semibold text-slate-500">No hay compras registradas</td></tr>
                        ) : (
                            purchases.map(purchase => (
                                <tr key={purchase.id} className="transition-colors hover:bg-slate-50">
                                    <td className="whitespace-nowrap px-4 py-3 text-sm font-semibold text-slate-600">{new Date(purchase.purchase_date).toLocaleDateString()}</td>
                                    <td className="px-4 py-3 text-sm font-black text-slate-900">{purchase.supplier?.name || 'Sin proveedor'}</td>
                                    <td className="px-4 py-3 text-sm font-mono font-semibold text-slate-500">{purchase.invoice_number || '-'}</td>
                                    <td className="px-4 py-3 text-right text-sm font-black text-slate-900">{formatMoney(purchase.total_amount)}</td>
                                    <td className="px-4 py-3 text-right text-sm font-black text-emerald-600">{formatMoney(purchase.paid_amount)}</td>
                                    <td className="px-4 py-3 text-center">{getStatusBadge(purchase.payment_status)}</td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex items-center justify-end gap-1.5">
                                            <button
                                                onClick={() => handleViewDetails(purchase.id)}
                                                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-black text-indigo-600 transition-colors hover:bg-indigo-50"
                                            >
                                                <Eye size={14} /> Ver
                                            </button>
                                            {user?.role === 'ADMIN' && (
                                                <button
                                                    onClick={() => handleVoid(purchase)}
                                                    title="Anular factura"
                                                    className="rounded-md p-1.5 text-rose-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            {help.isOpen && <HelpDrawer contextKey={helpKey} onClose={help.close} />}
        </div>
    );
};

export default Purchases;
