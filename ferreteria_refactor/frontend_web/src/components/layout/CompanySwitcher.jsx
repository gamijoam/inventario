import React, { useState, useEffect, useRef } from 'react';
import { Building2, ChevronDown, Check, Loader2, ExternalLink } from 'lucide-react';
import apiClient from '../../config/axios';
import { toast } from 'react-hot-toast';

/**
 * CompanySwitcher — Menú desplegable en el sidebar para cambiar de empresa.
 * Solo se muestra si el usuario pertenece a una organización con 2+ empresas.
 * 
 * Fixes:
 * - Dropdown abre hacia ABAJO (top-full mt-1), no hacia arriba
 * - org_companies se pasa via URL param al nuevo dominio para preservar el switcher
 */
export default function CompanySwitcher({ isCollapsed, currentSchema }) {
    const [companies, setCompanies]     = useState([]);
    const [open, setOpen]               = useState(false);
    const [switching, setSwitching]     = useState(null); // schema del que se está cambiando
    const [currentName, setCurrentName] = useState('');
    const ref = useRef(null);

    // Cargar las empresas del usuario al montar
    useEffect(() => {
        const stored = localStorage.getItem('org_companies');
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                setCompanies(parsed);
                const current = parsed.find(c => c.schema_name === currentSchema);
                if (current) setCurrentName(current.name);
            } catch {}
        }
    }, [currentSchema]);

    // Cerrar al hacer clic afuera
    useEffect(() => {
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // No mostrar si solo hay 1 empresa o ninguna
    if (companies.length <= 1) return null;

    const handleSwitch = async (company) => {
        if (company.schema_name === currentSchema) { setOpen(false); return; }
        setSwitching(company.schema_name);
        setOpen(false);
        try {
            const res = await apiClient.post('/auth/switch-company', null, {
                params: { target_schema: company.schema_name }
            });

            // Actualizar org_companies con los datos frescos del backend (incluye org_role)
            const freshCompanies = res.data.org_companies || [];
            if (freshCompanies.length > 0) {
                // Guardar en localStorage del dominio actual (útil si vuelven)
                localStorage.setItem('org_companies', JSON.stringify(freshCompanies));
            }

            // Codificar org_companies en base64 para pasarlos al nuevo dominio
            // (localStorage no se comparte entre subdominios)
            const orgsB64 = btoa(
                encodeURIComponent(JSON.stringify(freshCompanies))
            );

            toast.success(`Cambiando a ${company.name}...`);

            // Redirigir con token E org_companies en la URL
            setTimeout(() => {
                const token   = res.data.access_token;
                const baseUrl = company.switch_url;
                window.location.href = `${baseUrl}/?impersonate_token=${token}&org_data=${orgsB64}#/`;
            }, 600);

        } catch (err) {
            toast.error(err.response?.data?.detail || 'Error al cambiar de empresa');
            setSwitching(null);
        }
    };

    return (
        <div ref={ref} className="relative mx-3 mb-2">
            {/* Botón principal */}
            <button
                onClick={() => setOpen(o => !o)}
                disabled={!!switching}
                className={`
                    w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl
                    bg-indigo-50 hover:bg-indigo-100 border border-indigo-100
                    transition-all group disabled:opacity-60
                    ${isCollapsed ? 'justify-center' : ''}
                `}
                title={isCollapsed ? 'Cambiar empresa' : undefined}
            >
                <Building2 size={16} className="text-indigo-600 shrink-0" />
                {!isCollapsed && (
                    <>
                        <span className="text-xs font-bold text-indigo-700 truncate flex-1 text-left">
                            {switching
                                ? 'Cambiando...'
                                : (currentName || currentSchema || 'Mi empresa')}
                        </span>
                        {switching
                            ? <Loader2 size={14} className="text-indigo-400 animate-spin shrink-0" />
                            : <ChevronDown size={14} className={`text-indigo-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
                        }
                    </>
                )}
            </button>

            {/* Dropdown — abre hacia ABAJO */}
            {open && !switching && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-[200]">
                    <div className="px-3 py-2 border-b border-slate-100 bg-slate-50">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            🏢 Mis empresas
                        </p>
                    </div>
                    <div className="py-1 max-h-56 overflow-y-auto">
                        {companies.map((company) => {
                            const isCurrent = company.schema_name === currentSchema;
                            return (
                                <button
                                    key={company.tenant_id}
                                    onClick={() => handleSwitch(company)}
                                    className={`
                                        w-full flex items-center gap-3 px-3 py-2.5
                                        hover:bg-indigo-50 transition-colors text-left
                                        ${isCurrent ? 'bg-indigo-50/80 cursor-default' : 'cursor-pointer'}
                                    `}
                                >
                                    {/* Avatar */}
                                    <div className={`
                                        w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-black
                                        ${isCurrent ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}
                                    `}>
                                        {company.name.charAt(0).toUpperCase()}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-sm font-semibold truncate ${isCurrent ? 'text-indigo-700' : 'text-slate-700'}`}>
                                            {company.name}
                                        </p>
                                        <p className="text-[10px] text-slate-400 font-mono">
                                            {company.schema_name}
                                        </p>
                                    </div>

                                    {/* Indicador */}
                                    {isCurrent
                                        ? <Check size={14} className="text-indigo-500 shrink-0" />
                                        : <ExternalLink size={12} className="text-slate-300 shrink-0" />
                                    }
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
