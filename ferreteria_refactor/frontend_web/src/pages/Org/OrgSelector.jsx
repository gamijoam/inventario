import React from 'react';
import { Building2, ArrowRight, LogOut } from 'lucide-react';

/**
 * OrgSelector — Pantalla de selección de empresa al hacer login
 * Se muestra cuando el usuario pertenece a una organización con 2+ empresas.
 *
 * Props:
 *   companies: [{ tenant_id, schema_name, name, switch_url, is_current }]
 *   onSelect:  (company) => void — callback al seleccionar una empresa
 *   onLogout:  () => void
 *   userName:  string
 */
export default function OrgSelector({ companies = [], onSelect, onLogout, userName = '' }) {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md">

                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-200 mb-4">
                        <Building2 size={32} className="text-white" />
                    </div>
                    <h1 className="text-2xl font-black text-slate-900">¿A qué empresa entras?</h1>
                    {userName && (
                        <p className="text-slate-500 mt-1 text-sm">
                            Bienvenido, <span className="font-semibold text-slate-700">{userName}</span>
                        </p>
                    )}
                    <p className="text-slate-400 text-xs mt-1">
                        Tienes acceso a {companies.length} empresas
                    </p>
                </div>

                {/* Lista de empresas */}
                <div className="space-y-3 mb-6">
                    {companies.map((company) => (
                        <button
                            key={company.tenant_id}
                            onClick={() => onSelect(company)}
                            className="w-full flex items-center gap-4 p-4 bg-white rounded-2xl border-2 border-slate-100 hover:border-indigo-400 hover:shadow-md hover:shadow-indigo-100 transition-all group text-left"
                        >
                            {/* Ícono empresa */}
                            <div className="w-12 h-12 bg-indigo-50 group-hover:bg-indigo-100 rounded-xl flex items-center justify-center shrink-0 transition-colors">
                                <span className="text-lg font-black text-indigo-600">
                                    {company.name.charAt(0).toUpperCase()}
                                </span>
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-slate-900 truncate">{company.name}</p>
                                <p className="text-xs text-slate-400 font-mono truncate">
                                    {company.schema_name}.miinventariofacil.com
                                </p>
                            </div>

                            {/* Flecha */}
                            <ArrowRight
                                size={20}
                                className="text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all shrink-0"
                            />
                        </button>
                    ))}
                </div>

                {/* Logout */}
                <button
                    onClick={onLogout}
                    className="w-full flex items-center justify-center gap-2 py-3 text-slate-400 hover:text-slate-600 text-sm font-medium transition-colors"
                >
                    <LogOut size={16} />
                    Cerrar sesión
                </button>
            </div>
        </div>
    );
}
