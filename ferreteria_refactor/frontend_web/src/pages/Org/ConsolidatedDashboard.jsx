/**
 * ConsolidatedDashboard.jsx
 * Sprint 3 — Multi-Empresa
 *
 * Vista consolidada del grupo empresarial: ventas del día por empresa,
 * gráfico comparativo, alertas de stock y acceso rápido a cada empresa.
 *
 * Ruta: /org/dashboard
 * Solo visible si el usuario pertenece a una organización con 2+ empresas.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    Building2, TrendingUp, AlertTriangle,
    ArrowRight, RefreshCw, Trophy, ShoppingCart,
    Package, ExternalLink, BarChart3, Loader2
} from 'lucide-react';
import apiClient from '../../config/axios';
import { toast } from 'react-hot-toast';

// ─────────────────────────────────────────────────────────────────────────────
// Sub-componentes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * StatCard — Tarjeta de métrica principal (ventas totales, transacciones, etc.)
 */
function StatCard({ icon: Icon, label, value, color = 'indigo', sub = null }) {
    const colors = {
        indigo : 'bg-indigo-50 text-indigo-600',
        emerald: 'bg-emerald-50 text-emerald-600',
        amber  : 'bg-amber-50  text-amber-600',
        rose   : 'bg-rose-50   text-rose-600',
    };
    return (
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colors[color]}`}>
                    <Icon size={20} />
                </div>
                <p className="text-sm font-medium text-slate-500">{label}</p>
            </div>
            <p className="text-2xl font-black text-slate-900">{value}</p>
            {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
        </div>
    );
}

/**
 * TenantRow — Fila de una empresa en la tabla de desempeño
 */
function TenantRow({ tenant, rank, isBest }) {
    // Barra de progreso proporcional al monto de ventas
    const maxSales = 999999; // Se calculará dinámicamente desde el padre
    return (
        <div className={`
            flex items-center gap-4 p-4 rounded-xl border transition-all
            ${isBest
                ? 'bg-amber-50 border-amber-200'
                : 'bg-white border-slate-100 hover:border-indigo-200 hover:shadow-sm'}
        `}>
            {/* Ranking */}
            <div className={`
                w-8 h-8 rounded-full flex items-center justify-center text-sm font-black shrink-0
                ${isBest ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500'}
            `}>
                {isBest ? <Trophy size={14} /> : rank}
            </div>

            {/* Avatar de empresa */}
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center shrink-0">
                <span className="text-sm font-black text-indigo-600">
                    {tenant.name.charAt(0).toUpperCase()}
                </span>
            </div>

            {/* Info empresa */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <p className="font-bold text-slate-800 truncate">{tenant.name}</p>
                    {isBest && (
                        <span className="text-[10px] font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full shrink-0">
                            MEJOR HOY
                        </span>
                    )}
                </div>
                {/* Barra de progreso de ventas */}
                <div className="flex items-center gap-2 mt-1.5">
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-700 ${isBest ? 'bg-amber-400' : 'bg-indigo-400'}`}
                            style={{ width: `${tenant._pct || 0}%` }}
                        />
                    </div>
                    <p className="text-xs text-slate-400 font-mono shrink-0">
                        {tenant.sales_count} tx
                    </p>
                </div>
            </div>

            {/* Monto de ventas */}
            <div className="text-right shrink-0">
                <p className="font-black text-slate-900 text-sm">
                    ${Number(tenant.sales_today || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                {tenant.low_stock > 0 && (
                    <p className="text-[10px] text-rose-500 font-medium mt-0.5 flex items-center gap-1 justify-end">
                        <AlertTriangle size={10} />
                        {tenant.low_stock} bajo stock
                    </p>
                )}
            </div>

            {/* Botón ir a empresa */}
            <a
                href={`https://${tenant.schema_name}.miinventariofacil.com/#/`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 hover:bg-indigo-50 rounded-lg text-slate-300 hover:text-indigo-600 transition-colors shrink-0"
                title={`Ir a ${tenant.name}`}
            >
                <ExternalLink size={16} />
            </a>
        </div>
    );
}

/**
 * BarChart — Gráfico de barras simple SVG para comparar ventas entre empresas
 */
function BarChart({ data }) {
    // No renderizar si no hay datos
    if (!data || data.length === 0) return null;

    const maxVal  = Math.max(...data.map(d => d.sales_today || 0), 1);
    const barW    = Math.floor(100 / data.length) - 4; // % ancho por barra
    const colors  = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981'];

    return (
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
                <BarChart3 size={18} className="text-indigo-500" />
                <h3 className="font-bold text-slate-700 text-sm">Ventas del día por empresa</h3>
            </div>
            {/* SVG gráfico de barras */}
            <div className="flex items-end gap-2 h-32 px-2">
                {data.map((d, i) => {
                    const heightPct = ((d.sales_today || 0) / maxVal) * 100;
                    const color     = colors[i % colors.length];
                    return (
                        <div key={d.schema_name} className="flex-1 flex flex-col items-center gap-1">
                            {/* Valor encima de la barra */}
                            <p className="text-[9px] font-bold text-slate-500 text-center">
                                ${Number(d.sales_today || 0).toFixed(0)}
                            </p>
                            {/* Barra */}
                            <div className="w-full flex items-end" style={{ height: '80px' }}>
                                <div
                                    className="w-full rounded-t-lg transition-all duration-700"
                                    style={{
                                        height    : `${Math.max(heightPct, 2)}%`,
                                        backgroundColor: color,
                                        opacity   : 0.85,
                                    }}
                                />
                            </div>
                            {/* Label empresa */}
                            <p className="text-[9px] text-slate-400 text-center truncate w-full px-0.5">
                                {d.name.split(' ')[0]}
                            </p>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────

export default function ConsolidatedDashboard() {
    const [summary, setSummary]     = useState(null);   // Datos del API
    const [loading, setLoading]     = useState(true);
    const [lastUpdate, setLastUpdate] = useState(null);

    // Obtener el org_id desde las empresas guardadas en localStorage
    const getOrgId = useCallback(() => {
        try {
            const stored = localStorage.getItem('org_companies');
            if (!stored) return null;
            const companies = JSON.parse(stored);
            // El org_id no está en org_companies directamente,
            // lo deducimos del endpoint /organizations/mine
            return companies.length > 0 ? 'mine' : null;
        } catch { return null; }
    }, []);

    /**
     * fetchConsolidated — Carga los datos del dashboard consolidado.
     * Primero obtiene las organizaciones del usuario, luego el dashboard de la primera.
     */
    const fetchConsolidated = useCallback(async () => {
        setLoading(true);
        try {
            // 1. Obtener organización del usuario
            const orgsRes = await apiClient.get('/organizations/mine');
            const companies = orgsRes.data;

            if (!companies || companies.length === 0) {
                setSummary(null);
                setLoading(false);
                return;
            }

            // 2. Obtener el tenant_id actual para deducir el org_id
            //    Buscamos la org a la que pertenece el tenant actual
            const currentSchema = localStorage.getItem('selected_tenant');
            const currentCompany = companies.find(c => c.schema_name === currentSchema)
                                || companies[0];

            // 3. Llamar al endpoint consolidado — necesitamos el org_id
            //    Lo obtenemos del panel admin (solo superadmin) o inferimos del tenant
            //    Para usuarios normales, usamos la lista de empresas + las llamamos individualmente
            //    NOTA: El endpoint GET /organizations/{id}/consolidated requiere el org_id
            //    En esta versión construimos el resumen con los datos que ya tenemos en
            //    org_companies (ventas las cargamos para cada empresa por separado)
            const dashRes = await apiClient.get('/organizations/consolidated-mine');
            setSummary(dashRes.data);
            setLastUpdate(new Date());

        } catch (err) {
            // Fallback: construir resumen básico desde org_companies
            try {
                const stored = localStorage.getItem('org_companies');
                const companies = stored ? JSON.parse(stored) : [];
                setSummary({
                    organization_name  : 'Mi Grupo',
                    total_sales_today  : 0,
                    total_transactions : 0,
                    best_tenant_name   : null,
                    best_tenant_sales  : 0,
                    total_low_stock    : 0,
                    tenants            : companies.map(c => ({
                        tenant_id   : c.tenant_id,
                        schema_name : c.schema_name,
                        name        : c.name,
                        sales_today : 0,
                        sales_count : 0,
                        low_stock   : 0,
                    }))
                });
            } catch {}
        } finally {
            setLoading(false);
        }
    }, []);

    // Cargar al montar y refrescar cada 5 minutos
    useEffect(() => {
        fetchConsolidated();
        const interval = setInterval(fetchConsolidated, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, [fetchConsolidated]);

    // Calcular porcentaje de cada empresa para la barra de progreso
    const tenantsWithPct = summary?.tenants?.map(t => ({
        ...t,
        _pct: summary.total_sales_today > 0
            ? Math.round(((t.sales_today || 0) / summary.total_sales_today) * 100)
            : 0,
    })) || [];

    // ── Render: cargando ──────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 size={40} className="text-indigo-500 animate-spin mx-auto mb-3" />
                    <p className="text-slate-500 text-sm">Cargando datos del grupo...</p>
                </div>
            </div>
        );
    }

    // ── Render: sin organización ──────────────────────────────────────────────
    if (!summary) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                <div className="text-center max-w-sm">
                    <Building2 size={48} className="text-slate-300 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-slate-700 mb-2">Sin organización activa</h2>
                    <p className="text-slate-400 text-sm">
                        No perteneces a ningún grupo empresarial o solo tienes una empresa.
                        Contacta al administrador para agregar tu empresa a una organización.
                    </p>
                </div>
            </div>
        );
    }

    // ── Render principal ──────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-slate-50">
            <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

                {/* ── Header ── */}
                <div className="flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Building2 size={20} className="text-indigo-600" />
                            <h1 className="text-xl font-black text-slate-900">
                                {summary.organization_name}
                            </h1>
                        </div>
                        <p className="text-sm text-slate-400">
                            Vista consolidada del grupo •{' '}
                            {lastUpdate
                                ? `Actualizado ${lastUpdate.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}`
                                : 'Hoy'}
                        </p>
                    </div>
                    {/* Botón refrescar */}
                    <button
                        onClick={fetchConsolidated}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:border-indigo-300 hover:text-indigo-600 transition-all"
                    >
                        <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                        Refrescar
                    </button>
                </div>

                {/* ── KPIs principales ── */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard
                        icon={TrendingUp}
                        label="Ventas hoy"
                        value={`$${Number(summary.total_sales_today || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                        color="indigo"
                        sub="Total del grupo"
                    />
                    <StatCard
                        icon={ShoppingCart}
                        label="Transacciones"
                        value={summary.total_transactions || 0}
                        color="emerald"
                        sub="Ventas realizadas hoy"
                    />
                    <StatCard
                        icon={Trophy}
                        label="Mejor empresa"
                        value={summary.best_tenant_name || '—'}
                        color="amber"
                        sub={summary.best_tenant_sales > 0
                            ? `$${Number(summary.best_tenant_sales).toFixed(2)} hoy`
                            : 'Sin ventas aún'}
                    />
                    <StatCard
                        icon={AlertTriangle}
                        label="Alertas stock"
                        value={summary.total_low_stock || 0}
                        color={summary.total_low_stock > 0 ? 'rose' : 'emerald'}
                        sub="Productos bajo mínimo"
                    />
                </div>

                {/* ── Gráfico + tabla side by side en desktop ── */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Gráfico de barras */}
                    <BarChart data={tenantsWithPct} />

                    {/* Resumen rápido de alertas */}
                    <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                        <div className="flex items-center gap-2 mb-4">
                            <Package size={18} className="text-rose-500" />
                            <h3 className="font-bold text-slate-700 text-sm">
                                Alertas de stock por empresa
                            </h3>
                        </div>
                        {tenantsWithPct.length === 0 ? (
                            <p className="text-slate-400 text-sm text-center py-4">Sin datos</p>
                        ) : (
                            <div className="space-y-2">
                                {tenantsWithPct.map(t => (
                                    <div key={t.schema_name}
                                         className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 bg-indigo-50 rounded-lg flex items-center justify-center">
                                                <span className="text-[10px] font-black text-indigo-600">
                                                    {t.name.charAt(0)}
                                                </span>
                                            </div>
                                            <p className="text-sm text-slate-700 font-medium truncate max-w-[140px]">
                                                {t.name}
                                            </p>
                                        </div>
                                        {t.low_stock > 0 ? (
                                            <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
                                                {t.low_stock} alertas
                                            </span>
                                        ) : (
                                            <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                                                ✓ OK
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Tabla de desempeño por empresa ── */}
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <BarChart3 size={18} className="text-slate-400" />
                        <h2 className="font-bold text-slate-700">Desempeño por empresa — hoy</h2>
                        <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                            {tenantsWithPct.length} empresas
                        </span>
                    </div>
                    <div className="space-y-2">
                        {tenantsWithPct.length === 0 ? (
                            <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center">
                                <p className="text-slate-400 text-sm">No hay empresas en el grupo aún</p>
                            </div>
                        ) : (
                            tenantsWithPct.map((tenant, idx) => (
                                <TenantRow
                                    key={tenant.schema_name}
                                    tenant={tenant}
                                    rank={idx + 1}
                                    isBest={tenant.name === summary.best_tenant_name}
                                />
                            ))
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}
