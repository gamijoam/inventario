import React, { useState, useEffect, useRef } from 'react';
import { Building2, ChevronDown, Check, Loader2 } from 'lucide-react';
import apiClient from '../../config/axios';
import { toast } from 'react-hot-toast';

/**
 * CompanySwitcher — Menú desplegable en el sidebar para cambiar de empresa.
 * Solo se muestra si el usuario pertenece a una organización con 2+ empresas.
 *
 * Props:
 *   isCollapsed: bool — sidebar colapsado o no
 *   currentSchema: string — schema_name de la empresa actual
 */
export default function CompanySwitcher({ isCollapsed, currentSchema }) {
    const [companies, setCompanies]   = useState([]);
    const [open, setOpen]             = useState(false);
    const [switching, setSwitching]   = useState(false);
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
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // No mostrar si solo hay 1 empresa
    if (companies.length <= 1) return null;

    const handleSwitch = async (company) => {
        if (company.schema_name === currentSchema) { setOpen(false); return; }
        setSwitching(true);
        try {
            const res = await apiClient.post('/auth/switch-company', null, {
                params: { target_schema: company.schema_name }
            });
            // Actualizar localStorage con el nuevo tenant
            localStorage.setItem('selected_tenant', company.schema_name);
            if (res.data.org_companies) {
                localStorage.setItem('org_companies', JSON.stringify(res.data.org_companies));
            }
            toast.success(`Cambiando a ${company.name}...`);
            // Redirigir al subdominio de la empresa destino
            setTimeout(() => {
                window.location.href = company.switch_url + '/#/';
            }, 800);
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Error al cambiar de empresa');
            setSwitching(false);
        }
    };

    return (
        <div ref={ref} className="relative mx-3 mb-2">
            <button
                onClick={() => setOpen(o => !o)}
                className={`
                    w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl
                    bg-indigo-50 hover:bg-indigo-100 border border-indigo-100
                    transition-all group
                    ${isCollapsed ? 'justify-center' : ''}
                `}
                title={isCollapsed ? 'Cambiar empresa' : undefined}
            >
                <Building2 size={16} className="text-indigo-600 shrink-0" />
                {!isCollapsed && (
                    <>
                        <span className="text-xs font-bold text-indigo-700 truncate flex-1 text-left">
                            {currentName || currentSchema || 'Mi empresa'}
                        </span>
                        {switching
                            ? <Loader2 size={14} className="text-indigo-400 animate-spin shrink-0" />
                            : <ChevronDown size={14} className={`text-indigo-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
                        }
                    </>
                )}
            </button>

            {/* Dropdown */}
            {open && !switching && (
                <div className="absolute left-0 right-0 bottom-full mb-2 bg-white rounded-xl shadow-2xl border border-slate-100 overflow-hidden z-50 animate-in slide-in-from-bottom-2 duration-150">
                    <div className="px-3 py-2 border-b border-slate-50">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            Mis empresas
                        </p>
                    </div>
                    <div className="py-1 max-h-64 overflow-y-auto">
                        {companies.map((company) => {
                            const isCurrent = company.schema_name === currentSchema;
                            return (
                                <button
                                    key={company.tenant_id}
                                    onClick={() => { setOpen(false); handleSwitch(company); }}
                                    className={`
                                        w-full flex items-center gap-3 px-3 py-2.5
                                        hover:bg-slate-50 transition-colors text-left
                                        ${isCurrent ? 'bg-indigo-50/50' : ''}
                                    `}
                                >
                                    <div className={`
                                        w-7 h-7 rounded-lg flex items-center justify-center shrink-0
                                        ${isCurrent ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}
                                    `}>
                                        <span className="text-xs font-black">
                                            {company.name.charAt(0).toUpperCase()}
                                        </span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-sm font-semibold truncate ${isCurrent ? 'text-indigo-700' : 'text-slate-700'}`}>
                                            {company.name}
                                        </p>
                                        <p className="text-[10px] text-slate-400 font-mono truncate">
                                            {company.schema_name}
                                        </p>
                                    </div>
                                    {isCurrent && (
                                        <Check size={14} className="text-indigo-600 shrink-0" />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
