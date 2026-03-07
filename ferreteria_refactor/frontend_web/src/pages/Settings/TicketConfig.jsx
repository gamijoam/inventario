import React, { useState, useEffect } from 'react';
import apiClient from '../../config/axios';
import { Save, Printer, RefreshCw, AlertCircle, FileText, Code, Check, Smartphone } from 'lucide-react';
import clsx from 'clsx';
import { toast } from 'react-hot-toast';
import { useConfig } from '../../context/ConfigContext';

const TicketConfig = () => {
    const [activeTab, setActiveTab] = useState('gallery'); // 'gallery' or 'editor'
    const [selectedWidth, setSelectedWidth] = useState(58); // 58 or 80
    const [template, setTemplate] = useState('');
    const [presets, setPresets] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // Initial default template (escaped for JS string)
    const defaultTemplate = `=== TICKET DE VENTA ===
{{ business.name }}
{{ business.address }}
RIF: {{ business.document_id }}
Tel: {{ business.phone }}
================================
Fecha: {{ sale.date }}
Factura: #{{ sale.id }}
Cliente: {{ sale.customer.name if sale.customer else "Consumidor Final" }}
================================
CANT   PRODUCTO         TOTAL
--------------------------------
{% for item in sale.products %}
{{ item.quantity }} x {{ item.product.name }}
       {{ item.unit_price }} = {{ item.subtotal }}
{% endfor %}
================================
TOTAL:       {{ sale.total }}
================================
      Gracias por su compra`;

    useEffect(() => {
        fetchConfig();
        fetchPresets();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fetchConfig = async () => {
        setLoading(true);
        try {
            const response = await apiClient.get('/config/business');
            if (response.data && response.data.ticket_template) {
                setTemplate(response.data.ticket_template);
            } else {
                setTemplate(defaultTemplate);
            }
        } catch (error) {
            console.error('Error fetching config:', error);
            toast.error('Error al cargar configuración');
        } finally {
            setLoading(false);
        }
    };

    const fetchPresets = async () => {
        try {
            const response = await apiClient.get('/config/ticket-templates/presets');
            setPresets(response.data);
        } catch (error) {
            console.error('Error fetching presets:', error);
        }
    };

    const handleApplyPreset = async (presetId) => {
        if (!confirm('¿Aplicar esta plantilla? Se sobrescribirá la configuración actual.')) return;

        setSaving(true);
        try {
            const response = await apiClient.post(`/config/ticket-templates/apply/${presetId}`);
            toast.success(`Plantilla "${response.data.preset_name}" aplicada`);
            // Refresh editor with new template
            fetchConfig();
            setActiveTab('editor'); // Switch to editor to see result
        } catch (error) {
            console.error('Error applying preset:', error);
            toast.error('Error al aplicar plantilla');
        } finally {
            setSaving(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await apiClient.put('/config/business', {
                ticket_template: template
            });
            toast.success('Plantilla guardada correctamente');
        } catch (error) {
            console.error('Error saving template:', error);
            toast.error('Error al guardar plantilla');
        } finally {
            setSaving(false);
        }
    };

    const handleTestPrint = async () => {
        try {
            // 1. Solicitar impresión de prueba al Backend
            // El backend se encarga de enviar la orden al Hardware Bridge vía WebSocket
            const response = await apiClient.post('/config/test-print');

            if (response.data.status === 'success') {
                toast.success('Ticket enviado al Hardware Bridge');
            } else {
                toast.success('Ticket generado'); // Fallback logic
            }

        } catch (error) {
            console.error('Error getting test data:', error);
            toast.error('Error enviando prueba de impresión');
        }
    };

    const handleReset = () => {
        if (confirm('¿Restaurar plantilla por defecto? Se perderán los cambios no guardados.')) {
            setTemplate(defaultTemplate);
            toast.success('Plantilla restaurada');
        }
    };

    const filteredPresets = presets.filter(p => p.paper_width === selectedWidth || (!p.paper_width && selectedWidth === 58));

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 md:p-6 max-w-7xl mx-auto min-h-[600px] flex flex-col">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-4 border-b border-slate-100">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <Printer className="text-indigo-600" size={24} /> Configuración de Tickets
                </h2>

                {/* TABS */}
                <div className="flex p-1 bg-slate-100 rounded-xl w-full md:w-auto">
                    <button
                        onClick={() => setActiveTab('gallery')}
                        className={clsx(
                            "flex-1 md:flex-none justify-center px-4 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2",
                            activeTab === 'gallery'
                                ? 'bg-white text-indigo-600 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                        )}
                    >
                        <FileText size={16} /> Galería
                    </button>
                    <button
                        onClick={() => setActiveTab('editor')}
                        className={clsx(
                            "flex-1 md:flex-none justify-center px-4 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2",
                            activeTab === 'editor'
                                ? 'bg-white text-indigo-600 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                        )}
                    >
                        <Code size={16} /> Editor
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></div>
                    <p>Cargando configuración...</p>
                </div>
            ) : (
                <div className="flex-1 overflow-hidden flex flex-col">
                    {/* GALLERY VIEW */}
                    {activeTab === 'gallery' && (
                        <div className="flex flex-col h-full overflow-hidden">
                            {/* Width Selector */}
                            <div className="flex justify-center mb-6">
                                <div className="inline-flex bg-slate-100 p-1.5 rounded-xl border border-slate-200">
                                    <button
                                        onClick={() => setSelectedWidth(58)}
                                        className={clsx(
                                            "px-6 py-2.5 rounded-lg text-sm font-bold transition-all",
                                            selectedWidth === 58
                                                ? "bg-white text-emerald-600 shadow-sm border border-emerald-100/50"
                                                : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                                        )}
                                    >
                                        Impresoras 58mm (Estándar)
                                    </button>
                                    <button
                                        onClick={() => setSelectedWidth(80)}
                                        className={clsx(
                                            "px-6 py-2.5 rounded-lg text-sm font-bold transition-all",
                                            selectedWidth === 80
                                                ? "bg-white text-indigo-600 shadow-sm border border-indigo-100/50"
                                                : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                                        )}
                                    >
                                        Impresoras 80mm (Anchas)
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 overflow-y-auto custom-scrollbar p-1 pb-4">
                                {filteredPresets.map(preset => (
                                    <div key={preset.id} className="border border-slate-200 rounded-2xl overflow-hidden hover:shadow-lg hover:border-indigo-200 transition-all bg-white flex flex-col group h-full">
                                        <div className="p-5 flex-grow border-b border-slate-100 flex flex-col">
                                            <div className="flex justify-between items-start mb-1">
                                                <h3 className="font-bold text-lg text-slate-800 leading-tight">{preset.name}</h3>
                                                <span className={clsx(
                                                    "text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0",
                                                    preset.paper_width === 80 ? "bg-indigo-50 text-indigo-600" : "bg-emerald-50 text-emerald-600"
                                                )}>{preset.paper_width || 58}mm</span>
                                            </div>
                                            <p className="text-xs text-slate-500 mb-4 font-medium line-clamp-2">{preset.description}</p>

                                            {/* Visual Preview */}
                                            <div className="mt-auto bg-slate-100 rounded-xl p-3 flex justify-center items-center shadow-inner h-56">
                                                <div className={clsx(
                                                    "bg-white border border-slate-200 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.1)] p-3 text-[9px] sm:text-[10px] font-mono text-slate-700 h-full overflow-hidden relative select-none leading-tight transition-all",
                                                    preset.paper_width === 80 ? "w-full" : "w-3/4"
                                                )}>
                                                    <div className="absolute inset-0 z-10 bg-gradient-to-b from-transparent via-transparent to-white pointer-events-none"></div>
                                                    {/* Simulate Render */}
                                                    <div style={{ whiteSpace: 'pre-wrap' }}>
                                                        {preset.template
                                                            .replace(/{{ business.name }}/g, "MI FERRETERÍA")
                                                            .replace(/{{ business.address }}/g, "Calle 1, Local 1")
                                                            .replace(/{{ business.document_id }}/g, "J-12345678")
                                                            .replace(/{{ business.phone }}/g, "0414-1234567")
                                                            .replace(/{{ sale.date }}/g, "19/12/2025")
                                                            .replace(/{{ sale.id }}/g, "1001")
                                                            .replace(/{{ sale.customer.name.*}}/g, "Juan Pérez")
                                                            .replace(/{{ if sale.customer && sale.customer.id_number }}.*?{{ end }}/gs, "DOC: V-12345678\n")
                                                            .replace(/{{ if sale.is_credit }}.*?{{ end }}/gs, "") // Hide conditional blocks for preview simplicity
                                                            .replace(/<center>/g, " ".repeat(preset.paper_width === 80 ? 15 : 6)) // Fake center
                                                            .replace(/<\/center>/g, "")
                                                            .replace(/<right>/g, " ".repeat(preset.paper_width === 80 ? 25 : 10)) // Fake right
                                                            .replace(/<\/right>/g, "")
                                                            .replace(/<bold>/g, "")
                                                            .replace(/<\/bold>/g, "")
                                                            .replace(/<cut>/g, "")
                                                            .replace(/{{ for item in sale.products }}.*?{{ end }}/gs,
                                                                preset.paper_width === 80 ?
                                                                    "2 Cemento Gris                   $12.00\n1 Cabilla 1/2                    $5.00" :
                                                                    "2 Cemento Gris      $12.00\n1 Cabilla 1/2        $5.00"
                                                            )
                                                            .replace(/{{ sale.total }}/g, "$22.00")
                                                        }
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="p-4 bg-slate-50 mt-auto shrink-0">
                                            <button
                                                onClick={() => handleApplyPreset(preset.id)}
                                                className="w-full py-2.5 bg-white border border-indigo-200 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white font-bold transition-all shadow-sm active:scale-95"
                                            >
                                                Aplicar Plantilla
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* EDITOR VIEW */}
                    {activeTab === 'editor' && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full overflow-hidden">
                            {/* Editor Panel */}
                            <div className="lg:col-span-2 flex flex-col h-full">
                                <div className="mb-2 flex justify-between items-center px-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Plantilla Jinja2</label>
                                    <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-1 rounded-lg font-bold">Soporta variables y lógica</span>
                                </div>
                                <div className="relative flex-1 rounded-xl overflow-hidden border border-slate-300 shadow-inner group focus-within:ring-2 focus-within:ring-indigo-500/50 transition-all">
                                    <textarea
                                        className="w-full h-full p-4 font-mono text-sm bg-slate-900 text-emerald-400 resize-none outline-none custom-scrollbar leading-relaxed"
                                        value={template}
                                        onChange={(e) => setTemplate(e.target.value)}
                                        placeholder="Escribe tu plantilla aquí..."
                                        spellCheck={false}
                                    />
                                </div>

                                <div className="mt-4 flex flex-wrap gap-3">
                                    <button
                                        onClick={handleSave}
                                        disabled={saving}
                                        className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 font-bold shadow-lg shadow-indigo-200 active:scale-95 transition-all flex items-center gap-2"
                                    >
                                        <Save size={18} />
                                        {saving ? 'Guardando...' : 'Guardar Cambios'}
                                    </button>
                                    <button
                                        onClick={handleTestPrint}
                                        className="px-6 py-2.5 bg-slate-800 text-white rounded-xl hover:bg-slate-900 font-bold shadow-lg shadow-slate-200 active:scale-95 transition-all flex items-center gap-2"
                                    >
                                        <Printer size={18} />
                                        Imprimir Prueba
                                    </button>
                                    <button
                                        onClick={handleReset}
                                        className="px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 font-bold ml-auto flex items-center gap-2 hover:text-slate-800 transition-colors"
                                    >
                                        <RefreshCw size={18} /> Reset
                                    </button>
                                </div>
                            </div>

                            {/* Reference Sidebar */}
                            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 flex flex-col h-full overflow-hidden">
                                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 text-sm uppercase tracking-wide">
                                    <Code size={18} className="text-indigo-500" /> Variables Disponibles
                                </h3>

                                <div className="space-y-6 text-xs font-mono text-slate-600 overflow-y-auto custom-scrollbar flex-1 pr-2">
                                    <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                                        <p className="font-bold text-indigo-600 mb-2 border-b border-slate-100 pb-1">Negocio</p>
                                        <ul className="space-y-1.5">
                                            <li className="flex items-center gap-2 cursor-pointer hover:text-indigo-500"><div className="w-1.5 h-1.5 rounded-full bg-indigo-300"></div>business.name</li>
                                            <li className="flex items-center gap-2 cursor-pointer hover:text-indigo-500"><div className="w-1.5 h-1.5 rounded-full bg-indigo-300"></div>business.address</li>
                                            <li className="flex items-center gap-2 cursor-pointer hover:text-indigo-500"><div className="w-1.5 h-1.5 rounded-full bg-indigo-300"></div>business.phone</li>
                                            <li className="flex items-center gap-2 cursor-pointer hover:text-indigo-500"><div className="w-1.5 h-1.5 rounded-full bg-indigo-300"></div>business.document_id</li>
                                        </ul>
                                    </div>

                                    <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                                        <p className="font-bold text-indigo-600 mb-2 border-b border-slate-100 pb-1">Venta</p>
                                        <ul className="space-y-1.5">
                                            <li className="flex items-center gap-2 cursor-pointer hover:text-indigo-500"><div className="w-1.5 h-1.5 rounded-full bg-indigo-300"></div>sale.id</li>
                                            <li className="flex items-center gap-2 cursor-pointer hover:text-indigo-500"><div className="w-1.5 h-1.5 rounded-full bg-indigo-300"></div>sale.date</li>
                                            <li className="flex items-center gap-2 cursor-pointer hover:text-indigo-500"><div className="w-1.5 h-1.5 rounded-full bg-indigo-300"></div>sale.total</li>
                                            <li className="flex items-center gap-2 cursor-pointer hover:text-indigo-500"><div className="w-1.5 h-1.5 rounded-full bg-indigo-300"></div>sale.is_credit</li>
                                            <li className="flex items-center gap-2 cursor-pointer hover:text-indigo-500"><div className="w-1.5 h-1.5 rounded-full bg-indigo-300"></div>sale.customer.name</li>
                                        </ul>
                                    </div>

                                    <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                                        <p className="font-bold text-indigo-600 mb-2 border-b border-slate-100 pb-1">Items (Bucle)</p>
                                        <div className="bg-slate-100 p-2 rounded-lg text-[10px] mb-2 text-slate-500 font-bold">
                                            {'start_loop item in sale.products end_loop'}
                                        </div>
                                        <ul className="space-y-1.5">
                                            <li className="flex items-center gap-2 cursor-pointer hover:text-indigo-500"><div className="w-1.5 h-1.5 rounded-full bg-indigo-300"></div>item.product.name</li>
                                            <li className="flex items-center gap-2 cursor-pointer hover:text-indigo-500"><div className="w-1.5 h-1.5 rounded-full bg-indigo-300"></div>item.quantity</li>
                                            <li className="flex items-center gap-2 cursor-pointer hover:text-indigo-500"><div className="w-1.5 h-1.5 rounded-full bg-indigo-300"></div>item.unit_price</li>
                                            <li className="flex items-center gap-2 cursor-pointer hover:text-indigo-500"><div className="w-1.5 h-1.5 rounded-full bg-indigo-300"></div>item.subtotal</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// SERVICES TICKET SECTION — Visible only when modules.services is active
// Manages ticket_template_services_58 and ticket_template_services_80
// ─────────────────────────────────────────────────────────────────────────────
const ServicesTicketSection = () => {
    const [activeTab, setActiveTab] = useState('gallery');
    const [selectedWidth, setSelectedWidth] = useState(58);
    const [template58, setTemplate58] = useState('');
    const [template80, setTemplate80] = useState('');
    const [presets, setPresets] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const currentTemplate = selectedWidth === 80 ? template80 : template58;
    const setCurrentTemplate = (v) => selectedWidth === 80 ? setTemplate80(v) : setTemplate58(v);

    useEffect(() => {
        fetchConfig();
        fetchPresets();
    }, []);

    const fetchConfig = async () => {
        setLoading(true);
        try {
            const res = await apiClient.get('/config/services-ticket');
            setTemplate58(res.data.template_58 || '');
            setTemplate80(res.data.template_80 || '');
        } catch {
            toast.error('Error al cargar configuración de equipos');
        } finally {
            setLoading(false);
        }
    };

    const fetchPresets = async () => {
        try {
            const res = await apiClient.get('/config/ticket-templates/presets');
            // Only keep services-category presets
            setPresets((res.data || []).filter(p => p.category === 'services'));
        } catch { /* silent */ }
    };

    const handleApplyPreset = async (presetId) => {
        if (!confirm('¿Aplicar esta plantilla? Se sobrescribirá la configuración actual.')) return;
        setSaving(true);
        try {
            const res = await apiClient.post(`/config/services-ticket/apply/${presetId}`);
            toast.success(`Plantilla "${res.data.preset_name}" aplicada`);
            fetchConfig();
            setActiveTab('editor');
        } catch {
            toast.error('Error al aplicar plantilla');
        } finally {
            setSaving(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await apiClient.put('/config/services-ticket', {
                template_58: template58,
                template_80: template80,
            });
            toast.success('Plantilla de equipos guardada');
        } catch {
            toast.error('Error al guardar plantilla');
        } finally {
            setSaving(false);
        }
    };

    const filteredPresets = presets.filter(p => p.paper_width === selectedWidth);

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-indigo-100 p-4 md:p-6 max-w-7xl mx-auto min-h-[500px] flex flex-col mt-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-4 border-b border-indigo-50">
                <div>
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <Smartphone className="text-indigo-600" size={22} />
                        Tickets de Venta — Equipos Tecnológicos
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                        Se usa automáticamente cuando la venta incluye equipos con IMEI/serial.
                    </p>
                </div>
                <div className="flex p-1 bg-slate-100 rounded-xl w-full md:w-auto">
                    <button onClick={() => setActiveTab('gallery')} className={clsx("flex-1 md:flex-none px-4 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2", activeTab === 'gallery' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
                        <FileText size={16} /> Galería
                    </button>
                    <button onClick={() => setActiveTab('editor')} className={clsx("flex-1 md:flex-none px-4 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2", activeTab === 'editor' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
                        <Code size={16} /> Editor
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex-1 flex items-center justify-center text-slate-400 py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mr-3"></div>
                    Cargando...
                </div>
            ) : (
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Width selector — shared between gallery and editor */}
                    <div className="flex justify-center mb-6">
                        <div className="inline-flex bg-slate-100 p-1.5 rounded-xl border border-slate-200">
                            <button onClick={() => setSelectedWidth(58)} className={clsx("px-6 py-2.5 rounded-lg text-sm font-bold transition-all", selectedWidth === 58 ? "bg-white text-emerald-600 shadow-sm border border-emerald-100/50" : "text-slate-500 hover:text-slate-700")}>
                                Impresoras 58mm
                            </button>
                            <button onClick={() => setSelectedWidth(80)} className={clsx("px-6 py-2.5 rounded-lg text-sm font-bold transition-all", selectedWidth === 80 ? "bg-white text-indigo-600 shadow-sm border border-indigo-100/50" : "text-slate-500 hover:text-slate-700")}>
                                Impresoras 80mm
                            </button>
                        </div>
                    </div>

                    {/* GALLERY */}
                    {activeTab === 'gallery' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto pb-4">
                            {filteredPresets.length === 0 && (
                                <div className="col-span-full py-12 text-center text-slate-400">
                                    No hay plantillas disponibles para {selectedWidth}mm.
                                </div>
                            )}
                            {filteredPresets.map(preset => (
                                <div key={preset.id} className="border border-slate-200 rounded-2xl overflow-hidden hover:shadow-lg hover:border-indigo-200 transition-all bg-white flex flex-col group">
                                    <div className="p-5 flex-grow border-b border-slate-100">
                                        <div className="flex justify-between items-start mb-1">
                                            <h3 className="font-bold text-lg text-slate-800">{preset.name}</h3>
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600">{preset.paper_width}mm</span>
                                        </div>
                                        <p className="text-xs text-slate-500 mb-4">{preset.description}</p>
                                        <div className="bg-slate-100 rounded-xl p-3 flex justify-center items-center shadow-inner h-56">
                                            <div className={clsx("bg-white border border-slate-200 shadow p-3 text-[9px] font-mono text-slate-700 h-full overflow-hidden relative leading-tight", preset.paper_width === 80 ? "w-full" : "w-3/4")}>
                                                <div className="absolute inset-0 z-10 bg-gradient-to-b from-transparent to-white pointer-events-none"></div>
                                                <div style={{ whiteSpace: 'pre-wrap' }}>
                                                    {preset.template
                                                        .replace(/{{ business\.name }}/g, "MI TIENDA")
                                                        .replace(/{{ business\.address }}/g, "Calle 1, Local 1")
                                                        .replace(/{{ business\.document_id }}/g, "J-12345678")
                                                        .replace(/{{ business\.phone }}/g, "0414-1234567")
                                                        .replace(/{{ sale\.date }}/g, "25/01/2026 10:30")
                                                        .replace(/{{ sale\.id }}/g, "1001")
                                                        .replace(/{{ sale\.formatted_total }}/g, "$ 150.00")
                                                        .replace(/{{ sale\.formatted_total_ref }}/g, "Bs 7,500.00")
                                                        .replace(/{{ sale\.exchange_rate }}/g, "50.00")
                                                        .replace(/{{ if.*?}}.*?{{ end }}/gs, "")
                                                        .replace(/{{ for.*?}}.*?{{ end }}/gs,
                                                            preset.paper_width === 80
                                                                ? "Samsung A52\n  Cant: 1   Total: $ 150.00\n  IMEI: 123456789012345\n  Garantia: 6 meses"
                                                                : "Samsung A52\n  Cant:1 Total:$150.00\n  IMEI:12345678"
                                                        )
                                                        .replace(/<center>/g, "  ").replace(/<\/center>/g, "")
                                                        .replace(/<bold>/g, "").replace(/<\/bold>/g, "")
                                                        .replace(/<cut>/g, "")
                                                    }
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="p-4 bg-slate-50">
                                        <button onClick={() => handleApplyPreset(preset.id)} className="w-full py-2.5 bg-white border border-indigo-200 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white font-bold transition-all shadow-sm">
                                            Aplicar Plantilla
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* EDITOR */}
                    {activeTab === 'editor' && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 overflow-hidden">
                            <div className="lg:col-span-2 flex flex-col">
                                <div className="mb-2 flex justify-between items-center px-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Plantilla Scriban — {selectedWidth}mm</label>
                                    <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-1 rounded-lg font-bold">Equipos / IMEI</span>
                                </div>
                                <div className="relative flex-1 rounded-xl overflow-hidden border border-slate-300 shadow-inner min-h-[350px]">
                                    <textarea
                                        className="w-full h-full min-h-[350px] p-4 font-mono text-sm bg-slate-900 text-emerald-400 resize-none outline-none leading-relaxed"
                                        value={currentTemplate}
                                        onChange={(e) => setCurrentTemplate(e.target.value)}
                                        spellCheck={false}
                                    />
                                </div>
                                <div className="mt-4 flex flex-wrap gap-3">
                                    <button onClick={handleSave} disabled={saving} className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 font-bold shadow-lg shadow-indigo-200 flex items-center gap-2">
                                        <Save size={18} /> {saving ? 'Guardando...' : 'Guardar Cambios'}
                                    </button>
                                    <button onClick={fetchConfig} className="px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 font-bold flex items-center gap-2">
                                        <RefreshCw size={18} /> Resetear
                                    </button>
                                </div>
                            </div>

                            {/* Variables reference */}
                            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 flex flex-col overflow-hidden">
                                <h3 className="font-bold text-slate-800 mb-4 text-sm uppercase tracking-wide flex items-center gap-2">
                                    <Code size={16} className="text-indigo-500" /> Variables Disponibles
                                </h3>
                                <div className="space-y-4 text-xs font-mono text-slate-600 overflow-y-auto flex-1">
                                    <div className="bg-white p-3 rounded-xl border border-slate-200">
                                        <p className="font-bold text-indigo-600 mb-2 border-b pb-1">Negocio</p>
                                        <ul className="space-y-1">
                                            {['business.name','business.address','business.phone','business.document_id'].map(v => <li key={v} className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-indigo-300"></div>{v}</li>)}
                                        </ul>
                                    </div>
                                    <div className="bg-white p-3 rounded-xl border border-slate-200">
                                        <p className="font-bold text-indigo-600 mb-2 border-b pb-1">Venta</p>
                                        <ul className="space-y-1">
                                            {['sale.id','sale.date','sale.formatted_total','sale.formatted_total_ref','sale.exchange_rate','sale.is_usd','sale.customer.name','sale.customer.id_number'].map(v => <li key={v} className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-indigo-300"></div>{v}</li>)}
                                        </ul>
                                    </div>
                                    <div className="bg-white p-3 rounded-xl border border-slate-200">
                                        <p className="font-bold text-emerald-600 mb-2 border-b pb-1">Items — Equipos</p>
                                        <div className="bg-slate-100 p-2 rounded text-[10px] text-slate-500 mb-2">{'{{ for item in sale.products }}'}</div>
                                        <ul className="space-y-1">
                                            {['item.product.name','item.quantity','item.formatted_total','item.serial_numbers','item.warranty.name','item.warranty.duration_text'].map(v => <li key={v} className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-300"></div>{v}</li>)}
                                        </ul>
                                    </div>
                                    <div className="bg-white p-3 rounded-xl border border-slate-200">
                                        <p className="font-bold text-indigo-600 mb-2 border-b pb-1">Pagos</p>
                                        <div className="bg-slate-100 p-2 rounded text-[10px] text-slate-500 mb-2">{'{{ for p in sale.payments }}'}</div>
                                        <ul className="space-y-1">
                                            {['p.method','p.formatted_amount'].map(v => <li key={v} className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-indigo-300"></div>{v}</li>)}
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ─── Main export — wraps both sections ───────────────────────────────────────
const TicketConfigWrapper = () => {
    const { modules } = useConfig();
    return (
        <>
            <TicketConfig />
            {modules?.services && <ServicesTicketSection />}
        </>
    );
};

export { TicketConfig };
export default TicketConfigWrapper;
