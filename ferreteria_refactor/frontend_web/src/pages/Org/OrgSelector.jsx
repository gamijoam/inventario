import React, { useMemo, useState } from 'react';
import {
    Building2,
    ArrowRight,
    LogOut,
    Search,
    CheckCircle2,
    ShieldCheck,
    Store,
    Network,
    Sparkles,
} from 'lucide-react';

/**
 * OrgSelector - Pantalla de seleccion de empresa al hacer login
 * Se muestra cuando el usuario pertenece a una organizacion con 2+ empresas.
 *
 * Props:
 *   companies: [{ tenant_id, schema_name, name, switch_url, is_current }]
 *   onSelect:  (company) => void - callback al seleccionar una empresa
 *   onLogout:  () => void
 *   userName:  string
 */
export default function OrgSelector({ companies = [], onSelect, onLogout, userName = '' }) {
    const [query, setQuery] = useState('');

    const filteredCompanies = useMemo(() => {
        const term = query.trim().toLowerCase();
        if (!term) return companies;
        return companies.filter((company) => {
            const name = company.name || '';
            const schema = company.schema_name || '';
            return `${name} ${schema}`.toLowerCase().includes(term);
        });
    }, [companies, query]);

    const currentCompany = companies.find((company) => company.is_current);
    const initials = (userName || 'Mi').trim().slice(0, 2).toUpperCase();

    return (
        <div className="min-h-screen bg-slate-100 text-slate-950">
            <div className="grid min-h-screen lg:grid-cols-[minmax(360px,0.9fr)_minmax(520px,1.1fr)]">
                <aside className="relative hidden overflow-hidden bg-[#101a3a] text-white lg:block">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_20%,rgba(79,70,229,0.45),transparent_32%),linear-gradient(145deg,rgba(37,99,235,0.18),transparent_44%)]" />
                    <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#0b1024] to-transparent" />

                    <div className="relative flex h-full flex-col justify-between p-12">
                        <div>
                            <div className="flex items-center gap-4">
                                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/15 bg-white/10 shadow-2xl shadow-blue-950/40">
                                    <Building2 size={28} />
                                </div>
                                <div>
                                    <p className="text-sm font-black uppercase tracking-[0.22em] text-blue-200">MiInventario</p>
                                    <h1 className="text-3xl font-black leading-tight">Centro multiempresa</h1>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-8">
                            <div className="max-w-md">
                                <p className="text-sm font-black uppercase tracking-[0.24em] text-blue-200">Acceso seguro</p>
                                <h2 className="mt-4 text-4xl font-black leading-tight">
                                    Elige la empresa donde vas a trabajar ahora.
                                </h2>
                                <p className="mt-5 text-base leading-7 text-blue-100/85">
                                    Mantienes tu sesion activa y el sistema cambia el contexto al tenant correcto antes de entrar al tablero.
                                </p>
                            </div>

                            <div className="grid gap-3 text-sm text-blue-50/90">
                                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                                    <ShieldCheck size={20} className="text-emerald-300" />
                                    Permisos validados por organizacion
                                </div>
                                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                                    <Network size={20} className="text-sky-300" />
                                    {companies.length} empresa{companies.length !== 1 ? 's' : ''} disponible{companies.length !== 1 ? 's' : ''}
                                </div>
                            </div>
                        </div>
                    </div>
                </aside>

                <main className="flex min-h-screen items-center justify-center px-4 py-8 sm:px-8 lg:px-12">
                    <section className="w-full max-w-3xl">
                        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center gap-4">
                                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-lg font-black text-white shadow-lg shadow-indigo-200">
                                    {initials}
                                </div>
                                <div>
                                    <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Bienvenido</p>
                                    <h2 className="text-2xl font-black text-slate-950 sm:text-3xl">
                                        {userName || 'Selecciona tu empresa'}
                                    </h2>
                                </div>
                            </div>

                            <button
                                onClick={onLogout}
                                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-600 shadow-sm transition hover:border-rose-200 hover:text-rose-600"
                            >
                                <LogOut size={17} />
                                Cerrar sesion
                            </button>
                        </div>

                        <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl shadow-slate-200/70">
                            <header className="border-b border-slate-100 p-5 sm:p-7">
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                    <div>
                                        <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-indigo-700">
                                            <Sparkles size={14} />
                                            Organizacion
                                        </div>
                                        <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950">
                                            A que empresa entras?
                                        </h1>
                                        <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
                                            Selecciona el negocio para cargar inventario, caja, reportes y configuracion de ese tenant.
                                        </p>
                                    </div>

                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                                        <span className="font-black text-slate-950">{companies.length}</span> empresas
                                        {currentCompany && (
                                            <p className="mt-1 max-w-[220px] truncate text-xs text-emerald-700">
                                                Actual: {currentCompany.name}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="relative mt-6">
                                    <Search size={19} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        value={query}
                                        onChange={(event) => setQuery(event.target.value)}
                                        className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 py-4 pl-12 pr-4 text-sm font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                                        placeholder="Buscar por nombre o dominio..."
                                    />
                                </div>
                            </header>

                            <div className="max-h-[52vh] overflow-y-auto p-3 sm:p-4">
                                {filteredCompanies.length > 0 ? (
                                    <div className="grid gap-3">
                                        {filteredCompanies.map((company) => {
                                            const companyName = company.name || company.schema_name || 'Empresa';
                                            const schemaName = company.schema_name || 'tenant';
                                            return (
                                                <button
                                                    key={company.tenant_id || schemaName}
                                                    onClick={() => onSelect(company)}
                                                    className="group grid w-full grid-cols-[auto_1fr_auto] items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-indigo-50/35 hover:shadow-lg hover:shadow-indigo-100"
                                                >
                                                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-base font-black text-indigo-700 transition group-hover:bg-indigo-600 group-hover:text-white">
                                                        {companyName.charAt(0).toUpperCase()}
                                                    </div>

                                                    <div className="min-w-0">
                                                        <div className="flex min-w-0 items-center gap-2">
                                                            <p className="truncate text-base font-black text-slate-950">{companyName}</p>
                                                            {company.is_current && (
                                                                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-black uppercase text-emerald-700">
                                                                    <CheckCircle2 size={12} />
                                                                    Actual
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="mt-1 truncate text-xs font-bold text-slate-400">
                                                            {schemaName}.miinventariofacil.com
                                                        </p>
                                                    </div>

                                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 transition group-hover:border-indigo-200 group-hover:text-indigo-600">
                                                        <ArrowRight size={19} className="transition group-hover:translate-x-0.5" />
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
                                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm">
                                            <Store size={24} />
                                        </div>
                                        <h3 className="mt-4 text-lg font-black text-slate-900">Sin resultados</h3>
                                        <p className="mt-1 max-w-sm text-sm text-slate-500">
                                            No encontramos empresas que coincidan con tu busqueda.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>
                </main>
            </div>
        </div>
    );
}
