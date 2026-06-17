import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FileText, Printer, Receipt, WalletCards, CreditCard, TrendingDown, TrendingUp } from 'lucide-react';
import apiClient from '../../config/axios';
import { toast } from 'react-hot-toast';
import { getApiErrorMessage } from '../../utils/apiErrors';

const formatMoney = (amount) => `$${Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const SupplierLedger = () => {
    const { supplierId } = useParams();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (supplierId) {
            fetchLedger();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [supplierId]);

    const fetchLedger = async () => {
        setLoading(true);
        try {
            const response = await apiClient.get(`/suppliers/${supplierId}/ledger`);
            setData(response.data);
        } catch (error) {
            console.error('Error fetching ledger:', error);
            toast.error(getApiErrorMessage(error, 'Error al cargar estado de cuenta'));
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = () => window.print();

    if (loading) {
        return (
            <div className="flex min-h-[420px] items-center justify-center p-10">
                <div className="text-center">
                    <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600" />
                    <p className="text-sm font-bold text-slate-500">Cargando estado de cuenta...</p>
                </div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="p-6">
                <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-sm font-bold text-slate-500">
                    No se encontraron datos del proveedor.
                </div>
            </div>
        );
    }

    const ledger = data.ledger || [];
    const purchasesTotal = ledger.reduce((sum, row) => sum + Number(row.debit || 0), 0);
    const paymentsTotal = ledger.reduce((sum, row) => sum + Number(row.credit || 0), 0);
    const creditLimit = Number(data.supplier?.limit || 0);
    const currentBalance = Number(data.current_balance || 0);
    const creditUsage = creditLimit > 0 ? Math.min(100, (currentBalance / creditLimit) * 100) : 0;

    return (
        <div className="space-y-4 p-4 md:p-6 print:p-0">
            <div className="rounded-lg border border-slate-200 bg-white shadow-sm print:border-0 print:shadow-none">
                <div className="flex flex-col gap-4 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between print:border-slate-300">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate('/suppliers')}
                            className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:border-indigo-200 hover:text-indigo-600 print:hidden"
                            title="Volver"
                        >
                            <ArrowLeft size={18} />
                        </button>
                        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-indigo-600 text-white print:bg-slate-900">
                            <FileText size={22} />
                        </div>
                        <div>
                            <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">Estado de cuenta proveedor</p>
                            <h1 className="text-2xl font-black tracking-tight text-slate-900">{data.supplier.name}</h1>
                            <p className="text-sm font-semibold text-slate-500">Movimientos, pagos y saldo pendiente.</p>
                        </div>
                    </div>
                    <button
                        onClick={handlePrint}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-black text-white shadow-sm shadow-indigo-100 transition-colors hover:bg-indigo-700 print:hidden"
                    >
                        <Printer size={17} /> Imprimir
                    </button>
                </div>

                <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-lg border border-rose-100 bg-rose-50 p-3">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-wide text-rose-400">Saldo pendiente</span>
                            <WalletCards size={17} className="text-rose-400" />
                        </div>
                        <div className="mt-2 text-2xl font-black text-rose-700">{formatMoney(currentBalance)}</div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-wide text-slate-400">Compras acumuladas</span>
                            <Receipt size={17} className="text-slate-400" />
                        </div>
                        <div className="mt-2 text-2xl font-black text-slate-900">{formatMoney(purchasesTotal)}</div>
                    </div>
                    <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-wide text-emerald-500">Pagos aplicados</span>
                            <TrendingDown size={17} className="text-emerald-500" />
                        </div>
                        <div className="mt-2 text-2xl font-black text-emerald-700">{formatMoney(paymentsTotal)}</div>
                    </div>
                    <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-3">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-wide text-indigo-400">Limite de credito</span>
                            <CreditCard size={17} className="text-indigo-400" />
                        </div>
                        <div className="mt-2 text-2xl font-black text-indigo-700">{formatMoney(creditLimit)}</div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
                            <div className="h-full rounded-full bg-indigo-600" style={{ width: `${creditUsage}%` }} />
                        </div>
                    </div>
                </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm print:border-slate-300 print:shadow-none">
                <div className="flex items-center justify-between border-b border-slate-100 p-4">
                    <div>
                        <h2 className="text-lg font-black text-slate-900">Movimientos</h2>
                        <p className="text-sm font-semibold text-slate-500">Compras aumentan la deuda, pagos la reducen.</p>
                    </div>
                    <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-500">{ledger.length} registros</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-[760px] w-full divide-y divide-slate-100">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wide text-slate-400">Fecha</th>
                                <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wide text-slate-400">Movimiento</th>
                                <th className="px-4 py-3 text-right text-[11px] font-black uppercase tracking-wide text-slate-400">Compra</th>
                                <th className="px-4 py-3 text-right text-[11px] font-black uppercase tracking-wide text-slate-400">Pago</th>
                                <th className="px-4 py-3 text-right text-[11px] font-black uppercase tracking-wide text-slate-400">Saldo</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {ledger.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-4 py-12 text-center text-sm font-semibold text-slate-500">No hay movimientos registrados.</td>
                                </tr>
                            ) : ledger.map((row, index) => {
                                const isPurchase = row.type === 'COMPRA';
                                return (
                                    <tr key={`${row.type}-${row.date}-${index}`} className="transition-colors hover:bg-slate-50">
                                        <td className="whitespace-nowrap px-4 py-3 text-sm font-semibold text-slate-600">
                                            {row.date ? new Date(row.date).toLocaleDateString() : 'N/A'}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${isPurchase ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                                    {isPurchase ? <TrendingUp size={17} /> : <TrendingDown size={17} />}
                                                </div>
                                                <div>
                                                    <span className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${isPurchase ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                                                        {isPurchase ? 'Compra' : 'Pago'}
                                                    </span>
                                                    <div className="mt-1 text-sm font-bold text-slate-800">{row.ref}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-black text-amber-700">
                                            {isPurchase ? formatMoney(row.debit) : '-'}
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-black text-emerald-700">
                                            {!isPurchase ? formatMoney(row.credit) : '-'}
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-black text-slate-900">
                                            {formatMoney(row.balance)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot className="bg-slate-50">
                            <tr>
                                <td colSpan="4" className="px-4 py-4 text-right text-sm font-black text-slate-700">Saldo final</td>
                                <td className="px-4 py-4 text-right text-base font-black text-slate-900">{formatMoney(currentBalance)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default SupplierLedger;
