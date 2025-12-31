import React, { useState, useEffect } from 'react';
import apiClient from '../../config/axios';
import { Save, Printer, RefreshCw, AlertCircle, FileText, Code, Check } from 'lucide-react';
import clsx from 'clsx';
import { toast } from 'react-hot-toast';

const TicketConfig = () => {
    const [activeTab, setActiveTab] = useState('gallery'); // 'gallery' or 'editor'
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
            // 1. Obtener datos de prueba (Template + Contexto Dummy) desde el Backend (Nube)
            const response = await apiClient.post('/config/test-print');
            const printPayload = response.data;

            // 2. Enviar estos datos al Hardware Bridge LOCAL (Tu PC)
            try {
                const bridgeResponse = await fetch('http://localhost:5001/print', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        template: printPayload.template,
                        context: printPayload.context
                    })
                });

                if (!bridgeResponse.ok) {
                    throw new Error('Bridge error: ' + bridgeResponse.statusText);
                }

                toast.success('Ticket enviado al Hardware Bridge Local');
            } catch (bridgeError) {
                console.error("Local Bridge Error:", bridgeError);
                toast.error('Error conectando con tu Impresora Local (localhost:5001). Asegúrate de que BridgeInvensoft.exe esté corriendo.');
            }

        } catch (error) {
            console.error('Error getting test data:', error);
            toast.error('Error obteniendo datos de prueba del servidor.');
        }
    };

    const handleReset = () => {
        if (confirm('¿Restaurar plantilla por defecto? Se perderán los cambios no guardados.')) {
            setTemplate(defaultTemplate);
            toast.success('Plantilla restaurada');
        }
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 max-w-7xl mx-auto h-[800px] flex flex-col">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <Printer className="text-indigo-600" size={24} /> Configuración de Tickets
                </h2>

                {/* TABS */}
                <div className="flex p-1 bg-slate-100 rounded-xl">
                    <button
                        onClick={() => setActiveTab('gallery')}
                        className={clsx(
                            "px-4 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2",
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
                            "px-4 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2",
                            activeTab === 'editor'
                                ? 'bg-white text-indigo-600 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                        )}
                    >
                        <Code size={16} /> Editor (Jinja2)
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></div>
                    <p>Cargando configuración...</p>
                </div>
            ) : (
                <div className="flex-1 overflow-hidden flex flex-col">
                    {/* GALLERY VIEW */}
                    {activeTab === 'gallery' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 overflow-y-auto custom-scrollbar p-1">
                            {presets.map(preset => (
                                <div key={preset.id} className="border border-slate-200 rounded-2xl overflow-hidden hover:shadow-lg hover:border-indigo-200 transition-all bg-white flex flex-col group">
                                    <div className="p-5 flex-grow border-b border-slate-100">
                                        <h3 className="font-bold text-lg text-slate-800">{preset.name}</h3>
                                        <p className="text-xs text-slate-500 mt-1 mb-4 font-medium">{preset.description}</p>

                                        {/* Visual Preview */}
                                        <div className="border border-slate-100 p-4 text-[10px] font-mono bg-slate-50 text-slate-700 h-48 overflow-hidden relative select-none shadow-inner rounded-xl leading-tight opacity-80 group-hover:opacity-100 transition-opacity">
                                            <div className="absolute inset-0 z-10 bg-gradient-to-b from-transparent via-transparent to-slate-50 pointer-events-none"></div>
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
                                                    .replace(/{% if sale.is_credit %}[\s\S]*?{% endif %}/g, "") // Hide conditional blocks for preview simplicity
                                                    .replace(/{% for item in sale.products %}[\s\S]*?{% endfor %}/g,
                                                        "1.0 x Cemento Gris\n       $12.00 = $12.00\n2.0 x Cabilla 1/2\n       $5.00 = $10.00"
                                                    )
                                                    .replace(/{{ sale.total }}/g, "$22.00")
                                                    .replace(/{{ "\$%.2f"\|format\(sale.total\) }}/g, "$22.00")
                                                    .replace(/{{ "\$%.2f"\|format\(item.unit_price\) }}/g, "$12.00")
                                                    .replace(/{{ "\$%.2f"\|format\(item.subtotal\) }}/g, "$12.00")
                                                }
                                            </div>
                                        </div>
                                    </div>
                                    <div className="p-4 bg-slate-50 mt-auto">
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

export default TicketConfig;
