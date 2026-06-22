import { useEffect, useMemo, useState } from 'react';
import {
    Archive,
    CalendarClock,
    Check,
    Clock3,
    DollarSign,
    Loader2,
    PackageCheck,
    RotateCcw,
    Save,
    ShieldCheck,
    Smartphone,
    ToggleLeft,
    ToggleRight,
    UserCheck,
} from 'lucide-react';
import apiClient from '../../../config/axios';
import { toast } from 'react-hot-toast';
import { getApiErrorMessage } from '../../../utils/apiErrors';

const DEFAULT_FORM = {
    enabled: true,
    default_term_days: 10,
    max_term_days: 30,
    minimum_down_payment_type: 'percent',
    minimum_down_payment_value: 30,
    expiration_action: 'manual_review',
    expired_payment_policy: 'store_credit',
    allow_extensions: true,
    require_customer: true,
    allow_serialized: true,
    allow_non_serialized: true,
};

const toNumber = (value, fallback = 0) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
};

const normalizeSettings = (data = {}) => ({
    ...DEFAULT_FORM,
    ...data,
    default_term_days: toNumber(data.default_term_days, DEFAULT_FORM.default_term_days),
    max_term_days: toNumber(data.max_term_days, DEFAULT_FORM.max_term_days),
    minimum_down_payment_value: toNumber(data.minimum_down_payment_value, DEFAULT_FORM.minimum_down_payment_value),
});

const policyCopy = {
    manual_review: 'Revisión manual',
    auto_release: 'Liberar reserva',
    auto_cancel: 'Cancelar apartado',
    refund: 'Reembolsar',
    forfeit: 'Retener abono',
    store_credit: 'Saldo a favor',
};

export default function ApartadosConfigTab() {
    const [form, setForm] = useState(DEFAULT_FORM);
    const [initial, setInitial] = useState(DEFAULT_FORM);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(initial), [form, initial]);
    const minLabel = form.minimum_down_payment_type === 'percent'
        ? `${toNumber(form.minimum_down_payment_value).toFixed(0)}%`
        : form.minimum_down_payment_type === 'fixed'
            ? `$${toNumber(form.minimum_down_payment_value).toFixed(2)}`
            : 'Sin inicial';

    const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

    const load = async () => {
        setLoading(true);
        try {
            const { data } = await apiClient.get('/layaways/settings');
            const normalized = normalizeSettings(data);
            setForm(normalized);
            setInitial(normalized);
        } catch (error) {
            toast.error(getApiErrorMessage(error, 'No se pudo cargar la configuración de apartados'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const save = async () => {
        if (form.default_term_days > form.max_term_days) {
            toast.error('El plazo por defecto no puede superar el plazo máximo');
            return;
        }
        if (form.minimum_down_payment_type === 'percent' && form.minimum_down_payment_value > 100) {
            toast.error('La inicial porcentual no puede superar 100%');
            return;
        }
        setSaving(true);
        try {
            const payload = {
                ...form,
                default_term_days: Number(form.default_term_days),
                max_term_days: Number(form.max_term_days),
                minimum_down_payment_value: Number(form.minimum_down_payment_value || 0),
            };
            const { data } = await apiClient.put('/layaways/settings', payload);
            const normalized = normalizeSettings(data);
            setForm(normalized);
            setInitial(normalized);
            toast.success('Configuración de apartados guardada');
        } catch (error) {
            toast.error(getApiErrorMessage(error, 'No se pudo guardar la configuración'));
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-[360px] items-center justify-center rounded-lg border border-slate-200 bg-white">
                <div className="text-center">
                    <Loader2 className="mx-auto mb-3 animate-spin text-indigo-600" size={30} />
                    <p className="text-sm font-bold text-slate-500">Cargando apartados...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-col gap-4 border-b border-slate-100 p-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-indigo-600 text-white shadow-sm">
                            <Archive size={22} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs font-black uppercase tracking-widest text-slate-400">Ventas reservadas</p>
                            <h2 className="text-2xl font-black text-slate-950">Apartados</h2>
                            <p className="mt-1 text-sm font-medium text-slate-500">Reglas para reservar productos, recibir abonos y controlar vencimientos.</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {dirty && <span className="rounded-md bg-amber-50 px-3 py-2 text-xs font-black text-amber-700">Cambios pendientes</span>}
                        <button
                            onClick={load}
                            disabled={saving}
                            className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-black text-slate-600 shadow-sm hover:bg-slate-50 disabled:opacity-50"
                        >
                            <RotateCcw size={16} /> Restaurar
                        </button>
                        <button
                            onClick={save}
                            disabled={saving || !dirty}
                            className="inline-flex h-10 items-center gap-2 rounded-md bg-indigo-600 px-4 text-sm font-black text-white shadow-sm shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-50"
                        >
                            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            Guardar
                        </button>
                    </div>
                </div>

                <div className="grid gap-3 border-b border-slate-100 bg-slate-50 p-4 md:grid-cols-4">
                    <SummaryTile icon={ShieldCheck} label="Estado" value={form.enabled ? 'Activo' : 'Inactivo'} tone={form.enabled ? 'emerald' : 'slate'} />
                    <SummaryTile icon={Clock3} label="Plazo" value={`${form.default_term_days}/${form.max_term_days} días`} tone="indigo" />
                    <SummaryTile icon={DollarSign} label="Inicial" value={minLabel} tone="amber" />
                    <SummaryTile icon={PackageCheck} label="Entrega" value={form.allow_serialized ? 'IMEI permitido' : 'Solo normal'} tone="violet" />
                </div>
            </section>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
                <div className="space-y-5">
                    <ConfigCard icon={ShieldCheck} title="Módulo" subtitle="Disponibilidad general del flujo de apartados">
                        <ToggleRow
                            icon={Archive}
                            title="Apartados activos"
                            description={form.enabled ? 'Disponible en POS y Centro de Ventas' : 'Oculto para nuevas reservas'}
                            checked={form.enabled}
                            onChange={(value) => update('enabled', value)}
                        />
                    </ConfigCard>

                    <ConfigCard icon={CalendarClock} title="Reglas comerciales" subtitle="Plazos e inicial mínima para crear reservas">
                        <div className="grid gap-3 md:grid-cols-2">
                            <Field label="Plazo por defecto" suffix="días">
                                <input
                                    type="number"
                                    min="1"
                                    max="365"
                                    value={form.default_term_days}
                                    onChange={(event) => update('default_term_days', Number(event.target.value))}
                                    className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-black text-slate-900 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
                                />
                            </Field>
                            <Field label="Plazo máximo" suffix="días">
                                <input
                                    type="number"
                                    min="1"
                                    max="365"
                                    value={form.max_term_days}
                                    onChange={(event) => update('max_term_days', Number(event.target.value))}
                                    className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-black text-slate-900 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
                                />
                            </Field>
                        </div>

                        <div className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
                            <Field label="Tipo de inicial">
                                <select
                                    value={form.minimum_down_payment_type}
                                    onChange={(event) => update('minimum_down_payment_type', event.target.value)}
                                    className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-black text-slate-900 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
                                >
                                    <option value="percent">Porcentaje</option>
                                    <option value="fixed">Monto fijo</option>
                                    <option value="none">Sin inicial</option>
                                </select>
                            </Field>
                            <Field label={form.minimum_down_payment_type === 'percent' ? 'Inicial mínima' : 'Monto mínimo'} suffix={form.minimum_down_payment_type === 'percent' ? '%' : '$'} disabled={form.minimum_down_payment_type === 'none'}>
                                <input
                                    type="number"
                                    min="0"
                                    max={form.minimum_down_payment_type === 'percent' ? '100' : undefined}
                                    step="0.01"
                                    value={form.minimum_down_payment_value}
                                    disabled={form.minimum_down_payment_type === 'none'}
                                    onChange={(event) => update('minimum_down_payment_value', Number(event.target.value))}
                                    className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-black text-slate-900 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 disabled:bg-slate-100 disabled:text-slate-400"
                                />
                            </Field>
                        </div>
                    </ConfigCard>

                    <ConfigCard icon={PackageCheck} title="Productos permitidos" subtitle="Qué tipo de inventario se puede reservar">
                        <div className="grid gap-3 md:grid-cols-2">
                            <ToggleRow
                                icon={Smartphone}
                                title="Productos con IMEI"
                                description="Reserva el serial exacto hasta la entrega"
                                checked={form.allow_serialized}
                                onChange={(value) => update('allow_serialized', value)}
                            />
                            <ToggleRow
                                icon={PackageCheck}
                                title="Productos normales"
                                description="Controla disponibilidad por cantidad reservada"
                                checked={form.allow_non_serialized}
                                onChange={(value) => update('allow_non_serialized', value)}
                            />
                        </div>
                    </ConfigCard>
                </div>

                <aside className="space-y-5">
                    <ConfigCard icon={UserCheck} title="Operación" subtitle="Controles de seguridad para el equipo">
                        <ToggleRow
                            icon={UserCheck}
                            title="Cliente obligatorio"
                            description="Evita reservas sin responsable"
                            checked={form.require_customer}
                            onChange={(value) => update('require_customer', value)}
                        />
                        <ToggleRow
                            icon={RotateCcw}
                            title="Permitir prórrogas"
                            description="Autoriza extender fecha límite"
                            checked={form.allow_extensions}
                            onChange={(value) => update('allow_extensions', value)}
                        />
                    </ConfigCard>

                    <ConfigCard icon={CalendarClock} title="Vencimiento" subtitle="Qué verá el sistema cuando llegue la fecha límite">
                        <Field label="Acción al vencer">
                            <select
                                value={form.expiration_action}
                                onChange={(event) => update('expiration_action', event.target.value)}
                                className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-black text-slate-900 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
                            >
                                <option value="manual_review">Revisión manual</option>
                                <option value="auto_release">Liberar reserva</option>
                                <option value="auto_cancel">Cancelar apartado</option>
                            </select>
                        </Field>
                        <Field label="Tratamiento del abono">
                            <select
                                value={form.expired_payment_policy}
                                onChange={(event) => update('expired_payment_policy', event.target.value)}
                                className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-black text-slate-900 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
                            >
                                <option value="store_credit">Saldo a favor</option>
                                <option value="refund">Reembolsar</option>
                                <option value="forfeit">Retener abono</option>
                                <option value="manual_review">Revisión manual</option>
                            </select>
                        </Field>
                    </ConfigCard>

                    <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-4">
                        <p className="text-xs font-black uppercase tracking-widest text-indigo-500">Resumen operativo</p>
                        <div className="mt-3 space-y-2 text-sm font-bold text-indigo-900">
                            <p className="flex items-center gap-2"><Check size={15} /> {form.enabled ? 'Se pueden crear apartados' : 'No se crearán nuevos apartados'}</p>
                            <p className="flex items-center gap-2"><Check size={15} /> Inicial mínima: {minLabel}</p>
                            <p className="flex items-center gap-2"><Check size={15} /> Vence: {policyCopy[form.expiration_action]}</p>
                            <p className="flex items-center gap-2"><Check size={15} /> Abono vencido: {policyCopy[form.expired_payment_policy]}</p>
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    );
}

const ConfigCard = ({ icon: Icon, title, subtitle, children }) => (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex items-start gap-3 border-b border-slate-100 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-100 text-indigo-600">
                <Icon size={20} />
            </div>
            <div className="min-w-0">
                <h3 className="text-lg font-black text-slate-950">{title}</h3>
                <p className="text-sm font-medium text-slate-500">{subtitle}</p>
            </div>
        </div>
        <div className="space-y-4 p-4">{children}</div>
    </section>
);

const Field = ({ label, suffix, disabled, children }) => (
    <label className={`block ${disabled ? 'opacity-60' : ''}`}>
        <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-xs font-black uppercase tracking-widest text-slate-400">{label}</span>
            {suffix && <span className="text-xs font-black text-slate-400">{suffix}</span>}
        </div>
        {children}
    </label>
);

const ToggleRow = ({ icon: Icon, title, description, checked, onChange }) => (
    <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left transition-colors ${checked ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
    >
        <div className="flex min-w-0 items-center gap-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${checked ? 'bg-white text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                <Icon size={18} />
            </div>
            <div className="min-w-0">
                <p className="font-black text-slate-900">{title}</p>
                <p className="text-xs font-semibold text-slate-500">{description}</p>
            </div>
        </div>
        {checked ? <ToggleRight size={34} className="shrink-0 text-emerald-500" /> : <ToggleLeft size={34} className="shrink-0 text-slate-300" />}
    </button>
);

const SummaryTile = ({ icon: Icon, label, value, tone }) => {
    const tones = {
        emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
        indigo: 'bg-indigo-50 text-indigo-700 border-indigo-100',
        amber: 'bg-amber-50 text-amber-700 border-amber-100',
        violet: 'bg-violet-50 text-violet-700 border-violet-100',
        slate: 'bg-slate-100 text-slate-600 border-slate-200',
    };
    return (
        <div className={`flex items-center gap-3 rounded-lg border p-3 ${tones[tone] || tones.indigo}`}>
            <Icon size={18} />
            <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-70">{label}</p>
                <p className="truncate text-sm font-black">{value}</p>
            </div>
        </div>
    );
};
