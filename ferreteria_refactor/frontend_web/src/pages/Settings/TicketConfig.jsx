import React, { useState, useEffect } from 'react';
import apiClient from '../../config/axios';

const TicketConfig = () => {
    const [activeTab, setActiveTab] = useState('gallery'); // 'gallery' or 'editor'
    const [template, setTemplate] = useState('');
    const [presets, setPresets] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);

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
            setMessage({ type: 'error', text: 'Error al cargar configuración' });
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
        setMessage(null);
        try {
            const response = await apiClient.post(`/config/ticket-templates/apply/${presetId}`);
            setMessage({ type: 'success', text: `Plantilla "${response.data.preset_name}" aplicada` });
            // Refresh editor with new template
            fetchConfig();
            setActiveTab('editor'); // Switch to editor to see result
        } catch (error) {
            console.error('Error applying preset:', error);
            setMessage({ type: 'error', text: 'Error al aplicar plantilla' });
        } finally {
            setSaving(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setMessage(null);
        try {
            await apiClient.put('/config/business', {
                ticket_template: template
            });
            setMessage({ type: 'success', text: '✅ Plantilla guardada correctamente' });
            // Clear success message after 3 seconds
            setTimeout(() => setMessage(null), 3000);
        } catch (error) {
            console.error('Error saving template:', error);
            setMessage({ type: 'error', text: '❌ Error al guardar plantilla' });
        } finally {
            setSaving(false);
        }
    };

    const handleTestPrint = async () => {
        setMessage(null);
        try {
            // 1. Obtener datos de prueba (Template + Contexto Dummy) desde el Backend (Nube)
            // El backend ya NO intenta imprimir, solo nos da los datos.
            const response = await apiClient.post('/config/test-print');
            const printPayload = response.data;

            // 2. Enviar estos datos al Hardware Bridge LOCAL (Tu PC)
            // Usamos fetch directo para saltarnos la baseURL de axios
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

                setMessage({ type: 'success', text: '🖨️ Ticket enviado al Hardware Bridge Local' });
            } catch (bridgeError) {
                console.error("Local Bridge Error:", bridgeError);
                setMessage({
                    type: 'error',
                    text: '❌ Error conectando con tu Impresora Local (localhost:5001). Asegúrate de que BridgeInvensoft.exe esté corriendo.'
                });
            }

        } catch (error) {
            console.error('Error getting test data:', error);
            setMessage({ type: 'error', text: '❌ Error obteniendo datos de prueba del servidor.' });
        }
    };

    const handleReset = () => {
        if (confirm('¿Restaurar plantilla por defecto? Se perderán los cambios no guardados.')) {
            setTemplate(defaultTemplate);
        }
    };

    return (
        <div className="bg-white rounded-lg shadow-sm p-6 max-w-6xl mx-auto">
            <h2 className="text-xl font-bold mb-4 text-gray-800 border-b pb-2">Configuración de Tickets</h2>

            {/* TABS */}
            <div className="flex space-x-4 mb-6">
                <button
                    onClick={() => setActiveTab('gallery')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'gallery'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                >
                    🖼️ Galería de Plantillas
                </button>
                <button
                    onClick={() => setActiveTab('editor')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'editor'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                >
                    📝 Editor de Código (Jinja2)
                </button>
            </div>

            {message && (
                <div className={`mb-4 p-4 rounded-md ${message.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                    {message.text}
                </div>
            )}

            {loading ? (
                <div className="text-center py-8 text-gray-500">Cargando configuración...</div>
            ) : (
                <>
                    {/* GALLERY VIEW */}
                    {activeTab === 'gallery' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {presets.map(preset => (
                                <div key={preset.id} className="border rounded-xl hover:shadow-lg transition-shadow overflow-hidden bg-gray-50 flex flex-col">
                                    <div className="p-4 bg-white border-b flex-grow">
                                        <h3 className="font-bold text-lg text-gray-800">{preset.name}</h3>
                                        <p className="text-sm text-gray-500 mt-1">{preset.description}</p>

                                        {/* Visual Preview */}
                                        <div className="mt-4 border p-3 text-[10px] font-mono bg-white text-gray-700 h-48 overflow-hidden relative select-none shadow-inner rounded leading-tight">
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
                                    <div className="p-4 bg-gray-50 mt-auto">
                                        <button
                                            onClick={() => handleApplyPreset(preset.id)}
                                            className="w-full py-2 bg-white border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 font-medium transition-colors"
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
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Editor Panel */}
                            <div className="lg:col-span-2">
                                <div className="mb-2 flex justify-between items-center">
                                    <label className="text-sm font-medium text-gray-700">Plantilla Jinja2</label>
                                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">Soporta variables y lógica</span>
                                </div>
                                <textarea
                                    className="w-full h-[500px] p-4 font-mono text-sm bg-gray-900 text-green-400 rounded-lg border focus:ring-2 focus:ring-blue-500 resize-none shadow-inner"
                                    value={template}
                                    onChange={(e) => setTemplate(e.target.value)}
                                    placeholder="Escribe tu plantilla aquí..."
                                    spellCheck={false}
                                />

                                <div className="mt-4 flex flex-wrap gap-3">
                                    <button
                                        onClick={handleSave}
                                        disabled={saving}
                                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium shadow-sm active:scale-95 transition-transform"
                                    >
                                        {saving ? 'Guardando...' : '💾 Guardar Cambios'}
                                    </button>
                                    <button
                                        onClick={handleTestPrint}
                                        className="px-6 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 font-medium shadow-sm active:scale-95 transition-transform"
                                    >
                                        🖨️ Imprimir Prueba
                                    </button>
                                    <button
                                        onClick={handleReset}
                                        className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 ml-auto"
                                    >
                                        🔄 Reset
                                    </button>
                                </div>
                            </div>

                            {/* Reference Sidebar */}
                            <div className="bg-gray-50 rounded-lg p-5 border h-fit sticky top-4">
                                <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                                    <span>📚</span> Variables Disponibles
                                </h3>

                                <div className="space-y-4 text-sm font-mono text-gray-600 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                                    <div>
                                        <p className="font-bold text-blue-600 mb-1">Negocio</p>
                                        <ul className="list-disc pl-4 space-y-0.5">
                                            <li>business.name</li>
                                            <li>business.address</li>
                                            <li>business.phone</li>
                                            <li>business.document_id</li>
                                        </ul>
                                    </div>

                                    <div>
                                        <p className="font-bold text-blue-600 mb-1">Venta</p>
                                        <ul className="list-disc pl-4 space-y-0.5">
                                            <li>sale.id</li>
                                            <li>sale.date</li>
                                            <li>sale.total</li>
                                            <li>sale.is_credit</li>
                                            <li>sale.customer.name</li>
                                        </ul>
                                    </div>

                                    <div>
                                        <p className="font-bold text-blue-600 mb-1">Items (Bucle)</p>
                                        <div className="bg-gray-200 p-2 rounded text-xs mb-1">
                                            {'start_loop item in sale.products end_loop'}
                                        </div>
                                        <ul className="list-disc pl-4 space-y-0.5">
                                            <li>item.product.name</li>
                                            <li>item.quantity</li>
                                            <li>item.unit_price</li>
                                            <li>item.subtotal</li>
                                        </ul>
                                    </div>

                                    <div>
                                        <p className="font-bold text-blue-600 mb-1">Formateo $</p>
                                        <div className="bg-gray-200 p-2 rounded text-xs text-gray-500">
                                            {'{{ "%.2f"|format(valor) }}'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default TicketConfig;
