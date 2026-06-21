import { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, CreditCard, AlertCircle, Wallet, Banknote, Search, CheckCircle, XCircle, DollarSign } from 'lucide-react';
import apiClient from '../../../config/axios';
import { useConfig } from '../../../context/ConfigContext';
import { toast } from 'react-hot-toast';
import clsx from 'clsx';
import { getApiErrorMessage } from '../../../utils/apiErrors';

const CURRENCY_OPTIONS = [
    { value: 'FLEX', label: 'Flexible', short: 'FLEX', description: 'Acepta USD y Bs', tone: 'slate' },
    { value: 'USD', label: 'USD', short: 'USD', description: 'Solo divisa', tone: 'emerald' },
    { value: 'VES', label: 'Bs / VES', short: 'BS', description: 'Solo bolivares', tone: 'amber' },
];

const FILTERS = [
    { value: 'all', label: 'Todos' },
    { value: 'active', label: 'Activos' },
    { value: 'inactive', label: 'Inactivos' },
    { value: 'reference', label: 'Con referencia' },
];

const currencyMeta = (value) => CURRENCY_OPTIONS.find(option => option.value === value) || CURRENCY_OPTIONS[0];
const methodCurrency = (method) => method.currency_code || method.currency || 'FLEX';

const ToggleSwitch = ({ active, onChange, tone = 'indigo', label }) => {
    const toneClass = {
        indigo: 'peer-checked:bg-indigo-600',
        emerald: 'peer-checked:bg-emerald-600',
        amber: 'peer-checked:bg-amber-500',
    }[tone] || 'peer-checked:bg-indigo-600';

    return (
        <label className="relative inline-flex cursor-pointer items-center" title={label}>
            <input type="checkbox" className="peer sr-only" checked={!!active} onChange={onChange} />
            <span className={clsx('h-6 w-11 rounded-full bg-slate-300 transition-colors', toneClass)} />
            <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full border border-slate-300 bg-white shadow-sm transition-transform peer-checked:translate-x-5 peer-checked:border-white" />
        </label>
    );
};

const StatusPill = ({ tone = 'slate', children }) => {
    const tones = {
        indigo: 'border-indigo-200 bg-indigo-50 text-indigo-700',
        emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        amber: 'border-amber-200 bg-amber-50 text-amber-700',
        rose: 'border-rose-200 bg-rose-50 text-rose-700',
        slate: 'border-slate-200 bg-slate-50 text-slate-600',
    };

    return (
        <span className={clsx('inline-flex items-center rounded-md border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide', tones[tone] || tones.slate)}>
            {children}
        </span>
    );
};

const StatCard = ({ icon: Icon, label, value, tone = 'indigo', detail }) => {
    const tones = {
        indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
        emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
        amber: 'bg-amber-50 text-amber-600 border-amber-100',
        slate: 'bg-slate-50 text-slate-600 border-slate-200',
    };

    return (
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
                    <p className="mt-1 text-2xl font-black text-slate-900">{value}</p>
                    {detail && <p className="mt-1 text-xs font-semibold text-slate-500">{detail}</p>}
                </div>
                <div className={clsx('flex h-10 w-10 items-center justify-center rounded-md border', tones[tone] || tones.indigo)}>
                    <Icon size={20} />
                </div>
            </div>
        </div>
    );
};

const MethodCard = ({ method, onToggleActive, onToggleReference, onToggleFinancer, onChangeCurrency, onDelete }) => {
    const currency = methodCurrency(method);
    const meta = currencyMeta(currency);
    const isActive = !!method.is_active;

    return (
        <article className={clsx(
            'group overflow-hidden rounded-lg border bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md',
            isActive ? 'border-slate-200' : 'border-slate-200 opacity-75'
        )}>
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-4">
                <div className="flex min-w-0 items-start gap-3">
                    <div className={clsx(
                        'flex h-11 w-11 shrink-0 items-center justify-center rounded-md',
                        isActive ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-400'
                    )}>
                        {currency === 'USD' ? <DollarSign size={21} /> : currency === 'VES' ? <Banknote size={21} /> : <CreditCard size={21} />}
                    </div>
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <h3 className={clsx('truncate text-base font-black', isActive ? 'text-slate-900' : 'text-slate-500')}>
                                {method.name}
                            </h3>
                            <StatusPill tone={method.is_system ? 'slate' : 'indigo'}>
                                {method.is_system ? 'Sistema' : 'Manual'}
                            </StatusPill>
                        </div>
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                            {isActive ? 'Disponible para cobrar en el POS.' : 'Oculto para cajeros y ventas.'}
                        </p>
                    </div>
                </div>

                {!method.is_system && (
                    <button
                        onClick={() => onDelete(method)}
                        className="rounded-md p-2 text-slate-400 opacity-100 transition-colors hover:bg-rose-50 hover:text-rose-600 md:opacity-0 md:group-hover:opacity-100"
                        title="Eliminar metodo"
                    >
                        <Trash2 size={17} />
                    </button>
                )}
            </div>

            <div className="grid gap-3 p-4">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Moneda de cobro</p>
                            <p className="mt-0.5 text-xs font-semibold text-slate-500">{meta.description}</p>
                        </div>
                        <StatusPill tone={meta.tone}>{meta.short}</StatusPill>
                    </div>
                    <select
                        value={currency}
                        onChange={(e) => onChangeCurrency(method, e.target.value)}
                        className="mt-3 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-black text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20"
                    >
                        {CURRENCY_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                </div>

                <div className="grid gap-2 sm:grid-cols-3">
                    <div className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 py-2.5">
                        <span className="text-xs font-black text-slate-700">Activo</span>
                        <ToggleSwitch active={method.is_active} onChange={() => onToggleActive(method)} label="Activar metodo" />
                    </div>

                    <div className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 py-2.5">
                        <span className={clsx('text-xs font-black', method.requires_reference ? 'text-emerald-700' : 'text-slate-600')}>
                            Referencia
                        </span>
                        <ToggleSwitch active={method.requires_reference} onChange={() => onToggleReference(method)} tone="emerald" label="Exigir referencia" />
                    </div>

                    <div className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 py-2.5">
                        <span className={clsx('text-xs font-black', method.is_external_financer ? 'text-indigo-700' : 'text-slate-600')}>
                            Financia
                        </span>
                        <ToggleSwitch active={method.is_external_financer} onChange={() => onToggleFinancer(method)} label="Marcar financiadora" />
                    </div>
                </div>
            </div>
        </article>
    );
};

const PagosTab = () => {
    const { refreshConfig } = useConfig();
    const [methods, setMethods] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newMethodName, setNewMethodName] = useState('');
    const [newMethodRequiresReference, setNewMethodRequiresReference] = useState(false);
    const [newMethodCurrencyCode, setNewMethodCurrencyCode] = useState('FLEX');
    const [processing, setProcessing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [currencyFilter, setCurrencyFilter] = useState('all');

    useEffect(() => {
        fetchMethods();
    }, []);

    const fetchMethods = async () => {
        setLoading(true);
        try {
            const response = await apiClient.get('/payment-methods');
            setMethods(response.data);
        } catch (error) {
            console.error('Error fetching payment methods:', error);
            toast.error(getApiErrorMessage(error, 'No se pudieron cargar los metodos de pago'));
        } finally {
            setLoading(false);
        }
    };

    const stats = useMemo(() => {
        const active = methods.filter(method => method.is_active).length;
        const references = methods.filter(method => method.requires_reference).length;
        const financiers = methods.filter(method => method.is_external_financer).length;
        const byCurrency = methods.reduce((acc, method) => {
            const currency = methodCurrency(method);
            acc[currency] = (acc[currency] || 0) + 1;
            return acc;
        }, { FLEX: 0, USD: 0, VES: 0 });

        return {
            total: methods.length,
            active,
            inactive: methods.length - active,
            references,
            financiers,
            byCurrency,
        };
    }, [methods]);

    const filteredMethods = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        return methods.filter(method => {
            const currency = methodCurrency(method);
            const matchesSearch = !term || method.name?.toLowerCase().includes(term);
            const matchesCurrency = currencyFilter === 'all' || currency === currencyFilter;
            const matchesStatus = statusFilter === 'all'
                || (statusFilter === 'active' && method.is_active)
                || (statusFilter === 'inactive' && !method.is_active)
                || (statusFilter === 'reference' && method.requires_reference);
            return matchesSearch && matchesCurrency && matchesStatus;
        });
    }, [methods, searchTerm, statusFilter, currencyFilter]);

    const handleToggleActive = async (method) => {
        try {
            const updatedMethods = methods.map(m =>
                m.id === method.id ? { ...m, is_active: !m.is_active } : m
            );
            setMethods(updatedMethods);

            await apiClient.put(`/payment-methods/${method.id}`, {
                is_active: !method.is_active
            });
            refreshConfig();
            toast.success(`Metodo ${!method.is_active ? 'activado' : 'desactivado'}`);
        } catch (error) {
            console.error('Error toggling method:', error);
            fetchMethods();
            toast.error(getApiErrorMessage(error, 'No se pudo actualizar el metodo de pago'));
        }
    };

    const handleToggleRequiresReference = async (method) => {
        try {
            const updatedMethods = methods.map(m =>
                m.id === method.id ? { ...m, requires_reference: !m.requires_reference } : m
            );
            setMethods(updatedMethods);
            await apiClient.put(`/payment-methods/${method.id}`, {
                requires_reference: !method.requires_reference
            });
            refreshConfig();
            toast.success(`Referencia ${!method.requires_reference ? 'activada' : 'desactivada'}`);
        } catch (error) {
            console.error('Error updating reference requirement:', error);
            fetchMethods();
            toast.error(getApiErrorMessage(error, 'No se pudo actualizar la configuracion del metodo'));
        }
    };

    const handleToggleExternalFinancer = async (method) => {
        try {
            const updatedMethods = methods.map(m =>
                m.id === method.id ? { ...m, is_external_financer: !m.is_external_financer } : m
            );
            setMethods(updatedMethods);
            await apiClient.put(`/payment-methods/${method.id}`, {
                is_external_financer: !method.is_external_financer
            });
            refreshConfig();
            toast.success(`Financiadora externa ${!method.is_external_financer ? 'activada' : 'desactivada'}`);
        } catch (error) {
            console.error('Error updating external financer:', error);
            fetchMethods();
            toast.error(getApiErrorMessage(error, 'No se pudo actualizar la configuracion del metodo'));
        }
    };

    const handleChangeCurrency = async (method, currencyCode) => {
        try {
            setMethods(prev => prev.map(m => m.id === method.id ? { ...m, currency_code: currencyCode, currency: currencyCode } : m));
            await apiClient.put(`/payment-methods/${method.id}`, { currency_code: currencyCode });
            refreshConfig();
            toast.success('Moneda del metodo actualizada');
        } catch (error) {
            fetchMethods();
            toast.error(getApiErrorMessage(error, 'No se pudo actualizar la moneda del metodo'));
        }
    };

    const handleDelete = async (method) => {
        if (!confirm(`Eliminar el metodo "${method.name}"?`)) return;
        try {
            await apiClient.delete(`/payment-methods/${method.id}`);
            fetchMethods();
            refreshConfig();
            toast.success('Metodo eliminado');
        } catch (error) {
            toast.error(getApiErrorMessage(error, 'No se pudo eliminar el metodo de pago'));
        }
    };

    const handleAddMethod = async () => {
        if (!newMethodName.trim()) return;

        setProcessing(true);
        try {
            const response = await apiClient.post('/payment-methods', {
                name: newMethodName.trim(),
                is_active: true,
                requires_reference: newMethodRequiresReference,
                currency_code: newMethodCurrencyCode
            });
            setMethods([...methods, response.data]);
            setNewMethodName('');
            setNewMethodRequiresReference(false);
            setNewMethodCurrencyCode('FLEX');
            setShowAddModal(false);
            refreshConfig();
            toast.success('Metodo de pago agregado');
        } catch (error) {
            console.error('Error adding method:', error);
            toast.error(getApiErrorMessage(error, 'No se pudo crear el metodo de pago'));
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div className="space-y-5 animate-in fade-in duration-300">
            <div className="rounded-lg border border-indigo-100 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-indigo-600 text-white shadow-sm">
                            <Wallet size={22} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cobros y precios</p>
                            <h2 className="text-xl font-black text-slate-900">Metodos de Pago</h2>
                            <p className="mt-1 text-sm text-slate-500">
                                Define que metodos aparecen en caja, su moneda y si requieren referencia.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 text-sm font-black text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.98]"
                    >
                        <Plus size={18} />
                        Nuevo Metodo
                    </button>
                </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <StatCard icon={CreditCard} label="Metodos" value={stats.total} detail={`${stats.active} activos / ${stats.inactive} ocultos`} />
                <StatCard icon={DollarSign} label="USD" value={stats.byCurrency.USD || 0} tone="emerald" detail="Solo divisa" />
                <StatCard icon={Banknote} label="Bolivares" value={stats.byCurrency.VES || 0} tone="amber" detail="Solo VES" />
                <StatCard icon={CheckCircle} label="Referencia" value={stats.references} tone="slate" detail={`${stats.financiers} financiadoras`} />
            </div>

            <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-col gap-3 border-b border-slate-100 p-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="relative min-w-0 flex-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                            placeholder="Buscar metodo de pago..."
                            className="h-11 w-full rounded-md border border-slate-200 bg-white pl-10 pr-3 text-sm font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20"
                        />
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {FILTERS.map(filter => (
                            <button
                                key={filter.value}
                                onClick={() => setStatusFilter(filter.value)}
                                className={clsx(
                                    'h-10 rounded-md border px-3 text-xs font-black transition',
                                    statusFilter === filter.value
                                        ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
                                        : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700'
                                )}
                            >
                                {filter.label}
                            </button>
                        ))}
                        <select
                            value={currencyFilter}
                            onChange={(event) => setCurrencyFilter(event.target.value)}
                            className="h-10 rounded-md border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20"
                        >
                            <option value="all">Todas las monedas</option>
                            {CURRENCY_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                    </div>
                </div>

                <div className="bg-slate-50/60 p-4 sm:p-5">
                    {loading ? (
                        <div className="flex h-64 flex-col items-center justify-center text-slate-400">
                            <div className="mb-4 h-9 w-9 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600" />
                            <p className="text-sm font-medium">Cargando metodos...</p>
                        </div>
                    ) : filteredMethods.length ? (
                        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                            {filteredMethods.map(method => (
                                <MethodCard
                                    key={method.id}
                                    method={method}
                                    onToggleActive={handleToggleActive}
                                    onToggleReference={handleToggleRequiresReference}
                                    onToggleFinancer={handleToggleExternalFinancer}
                                    onChangeCurrency={handleChangeCurrency}
                                    onDelete={handleDelete}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="flex min-h-[220px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
                            <XCircle className="text-slate-300" size={42} />
                            <h3 className="mt-3 text-lg font-black text-slate-800">Sin resultados</h3>
                            <p className="mt-1 max-w-md text-sm font-medium text-slate-500">
                                No hay metodos que coincidan con la busqueda o filtros seleccionados.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-indigo-950/40 p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="w-full max-w-lg overflow-hidden rounded-lg bg-white shadow-xl animate-in zoom-in-95 duration-200">
                        <div className="border-b border-slate-100 p-5">
                            <div className="flex items-start gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-indigo-600 text-white">
                                    <Plus size={20} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-900">Nuevo Metodo</h3>
                                    <p className="mt-1 text-sm font-medium text-slate-500">Configuralo una vez y aparece en el POS de inmediato.</p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4 p-5">
                            <div>
                                <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-500">Nombre</label>
                                <input
                                    type="text"
                                    className="h-11 w-full rounded-md border border-slate-200 px-3 font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                                    placeholder="Ej. Zelle, Binance, Pago movil..."
                                    autoFocus
                                    value={newMethodName}
                                    onChange={event => setNewMethodName(event.target.value)}
                                    onKeyDown={event => event.key === 'Enter' && handleAddMethod()}
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-500">Moneda del metodo</label>
                                <div className="grid gap-2 sm:grid-cols-3">
                                    {CURRENCY_OPTIONS.map(option => (
                                        <button
                                            key={option.value}
                                            type="button"
                                            onClick={() => setNewMethodCurrencyCode(option.value)}
                                            className={clsx(
                                                'rounded-md border p-3 text-left transition',
                                                newMethodCurrencyCode === option.value
                                                    ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-500/15'
                                                    : 'border-slate-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/50'
                                            )}
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-sm font-black text-slate-900">{option.short}</span>
                                                {newMethodCurrencyCode === option.value && <CheckCircle size={16} className="text-indigo-600" />}
                                            </div>
                                            <p className="mt-1 text-xs font-semibold text-slate-500">{option.description}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 transition-colors hover:border-indigo-200 hover:bg-white">
                                <div>
                                    <div className="text-sm font-black text-slate-800">Exigir referencia</div>
                                    <div className="text-xs font-medium text-slate-500">El cajero debe colocar comprobante o numero de operacion.</div>
                                </div>
                                <ToggleSwitch active={newMethodRequiresReference} onChange={event => setNewMethodRequiresReference(event.target.checked)} tone="emerald" />
                            </label>

                            <div className="flex gap-3 rounded-md border border-indigo-100 bg-indigo-50 p-3 text-xs text-indigo-700">
                                <AlertCircle size={16} className="mt-0.5 shrink-0 text-indigo-500" />
                                <p className="font-semibold">Si una lista de precios queda en modo estricto, el POS solo mostrara metodos compatibles con su moneda.</p>
                            </div>
                        </div>

                        <div className="flex gap-3 border-t border-slate-100 bg-slate-50 p-4">
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="flex-1 rounded-md py-2.5 font-bold text-slate-600 transition-colors hover:bg-slate-200 hover:text-slate-800"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleAddMethod}
                                disabled={!newMethodName.trim() || processing}
                                className="flex-1 rounded-md bg-indigo-600 py-2.5 font-bold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-50"
                            >
                                {processing ? 'Guardando...' : 'Guardar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PagosTab;
