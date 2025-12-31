import { useState, useEffect } from 'react';
import {
    FileText, Calendar, User, DollarSign, ArrowRight, Trash2, Printer,
    RefreshCcw, AlertCircle, CheckCircle, Clock, Search
} from 'lucide-react';
import apiClient from '../../config/axios';
import { toast } from 'react-hot-toast';
import { useConfig } from '../../context/ConfigContext';

const QuoteList = ({ onCreateNew, onEdit }) => {
    const [quotes, setQuotes] = useState([]);
    const [filteredQuotes, setFilteredQuotes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const { currencies } = useConfig();
    const anchorCurrency = currencies.find(c => c.is_anchor) || { symbol: '$' };

    useEffect(() => {
        fetchQuotes();
    }, []);

    useEffect(() => {
        if (!searchTerm) {
            setFilteredQuotes(quotes);
        } else {
            const term = searchTerm.toLowerCase();
            const filtered = quotes.filter(q =>
                q.id.toString().includes(term) ||
                q.customer?.name?.toLowerCase().includes(term) ||
                q.customer?.id_number?.toLowerCase().includes(term)
            );
            setFilteredQuotes(filtered);
        }
    }, [searchTerm, quotes]);

    const fetchQuotes = async () => {
        setLoading(true);
        try {
            const response = await apiClient.get('/quotes');
            // Sort by ID desc (newest first)
            const sorted = response.data.sort((a, b) => b.id - a.id);
            setQuotes(sorted);
            setFilteredQuotes(sorted);
        } catch (error) {
            console.error("Error loading quotes:", error);
            toast.error("Error al cargar cotizaciones");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id, e) => {
        e.stopPropagation();
        if (!window.confirm("¿Seguro que deseas eliminar esta cotización?")) return;

        try {
            await apiClient.delete(`/quotes/${id}`);
            toast.success("Cotización eliminada");
            const updated = quotes.filter(q => q.id !== id);
            setQuotes(updated);
        } catch (error) {
            console.error(error);
            toast.error("No se pudo eliminar");
        }
    };

    const handleConvertToSale = async (quote, e) => {
        e.stopPropagation();
        if (confirm(`¿Cargar cotización #${quote.id} en Caja para facturar?`)) {
            window.location.href = `/pos?quote_id=${quote.id}`;
        }
    };

    const handlePrint = async (partialQuote, e) => {
        e.stopPropagation();

        try {
            const loadingToast = toast.loading("Preparando impresión...");
            // Fetch full details because the list view might not have them
            const { data: fullQuote } = await apiClient.get(`/quotes/${partialQuote.id}`);
            toast.dismiss(loadingToast);

            // Use details from response (backend sends 'details' or 'items' depending on schema, usually 'details' for Quotes)
            // We map it to a standardized structure if needed
            const items = fullQuote.details || fullQuote.items || [];

            if (items.length === 0) {
                toast.error("La cotización está vacía");
                return;
            }

            // Simple Print Logic: Open new window with basic HTML
            const printWindow = window.open('', '_blank');
            if (!printWindow) return toast.error("Permite pop-ups para imprimir");

            const itemsHtml = items.map(item => `
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 8px;">${item.product?.name || 'Item'}</td>
                    <td style="padding: 8px; text-align: center;">${item.quantity}</td>
                    <td style="padding: 8px; text-align: right;">${anchorCurrency.symbol}${Number(item.unit_price).toFixed(2)}</td>
                    <td style="padding: 8px; text-align: right;">${anchorCurrency.symbol}${Number(item.subtotal).toFixed(2)}</td>
                </tr>
            `).join('');

            const htmlContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Cotización #${fullQuote.id}</title>
                    <style>
                        body { font-family: sans-serif; padding: 20px; line-height: 1.4; }
                        .header {  margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 10px; }
                        .title { font-size: 24px; font-weight: bold; }
                        .details { margin-bottom: 20px; }
                        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                        th { text-align: left; background: #f5f5f5; padding: 8px; border-bottom: 1px solid #ddd; }
                        .totals { text-align: right; margin-top: 20px; font-size: 18px; font-weight: bold; }
                        @media print { .no-print { display: none; } }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <div class="title">Cotización #${fullQuote.id}</div>
                        <div style="color: #666;">${new Date(fullQuote.date).toLocaleString()}</div>
                    </div>
                    
                    <div class="details">
                        <strong>Cliente:</strong> ${fullQuote.customer?.name || 'Cliente General'}<br>
                        <strong>C.I./RIF:</strong> ${fullQuote.customer?.id_number || 'N/A'}<br>
                        <strong>Teléfono:</strong> ${fullQuote.customer?.phone || 'N/A'}
                    </div>

                    <table>
                        <thead>
                            <tr>
                                <th>Descripción</th>
                                <th style="text-align: center;">Cant</th>
                                <th style="text-align: right;">Precio</th>
                                <th style="text-align: right;">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${itemsHtml}
                        </tbody>
                    </table>

                    <div class="totals">
                        Total: ${anchorCurrency.symbol}${Number(fullQuote.total_amount).toFixed(2)}
                    </div>

                    ${fullQuote.notes ? `<div style="margin-top: 20px; background: #fffbe6; padding: 10px; border: 1px solid #ffe58f;"><strong>Notas:</strong> ${fullQuote.notes}</div>` : ''}

                    <div class="no-print" style="margin-top: 30px; text-align: center;">
                        <button onclick="window.print()" style="padding: 10px 20px; font-size: 16px; cursor: pointer;">Imprimir</button>
                        <button onclick="window.close()" style="padding: 10px 20px; font-size: 16px; cursor: pointer; margin-left: 10px;">Cerrar</button>
                    </div>
                    <script>
                        window.onload = function() { window.print(); }
                    </script>
                </body>
                </html>
            `;

            printWindow.document.write(htmlContent);
            printWindow.document.close();

        } catch (error) {
            console.error("Print Error:", error);
            toast.error("Error al generar impresión");
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'CONVERTED':
                return <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1"><CheckCircle size={12} /> Facturada</span>;
            case 'EXPIRED':
                return <span className="bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1"><AlertCircle size={12} /> Vencida</span>;
            default: // PENDING
                return <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1"><Clock size={12} /> Pendiente</span>;
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-gray-500">Cargando cotizaciones...</div>;
    }

    return (
        <div className="h-full flex flex-col p-6">
            {/* Header / Toolbar */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-xl font-bold text-gray-800">Historial de Cotizaciones</h2>
                    <p className="text-sm text-gray-500">Gestiona tus presupuestos guardados</p>
                </div>

                <div className="flex gap-3 items-center">
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar por ID o Cliente..."
                            className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none w-64"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={onCreateNew}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold shadow transition-all flex items-center gap-2"
                    >
                        <FileText size={18} /> Nueva Cotización
                    </button>
                </div>
            </div>

            {filteredQuotes.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                    <FileText size={64} className="mb-4 opacity-20" />
                    <h3 className="text-xl font-medium text-gray-600 mb-2">No se encontraron cotizaciones</h3>
                    {quotes.length === 0 && <p className="mb-6">Crea propuestas comerciales para tus clientes</p>}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 overflow-y-auto pb-10">
                    {filteredQuotes.map(quote => (
                        <div
                            key={quote.id}
                            className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-all group overflow-hidden flex flex-col h-[280px]"
                        >
                            {/* Status Stripe */}
                            <div className={`h-1.5 w-full ${quote.status === 'CONVERTED' ? 'bg-green-500' : 'bg-blue-500'}`}></div>

                            <div className="p-5 flex-1 flex flex-col">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-800">#{quote.id}</h3>
                                        <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                                            <Calendar size={12} />
                                            {new Date(quote.date).toLocaleDateString()}
                                        </div>
                                    </div>
                                    {getStatusBadge(quote.status)}
                                </div>

                                <div className="space-y-3 mb-4 flex-1">
                                    <div className="flex items-start gap-2 text-sm text-gray-700">
                                        <User size={16} className="text-gray-400 mt-0.5" />
                                        <span className="font-semibold line-clamp-2" title={quote.customer?.name}>
                                            {quote.customer?.name || "Cliente General"}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-gray-600">
                                        <span className="bg-gray-100 text-gray-500 text-xs px-2 py-0.5 rounded">
                                            {(quote.details?.length || quote.items?.length || 0)} items
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 text-lg font-bold text-gray-900 border-t border-gray-100 pt-3">
                                    <DollarSign size={18} className="text-gray-400" />
                                    <span>{anchorCurrency.symbol}{Number(quote.total_amount).toFixed(2)}</span>
                                </div>
                            </div>

                            {/* Actions Footer */}
                            <div className="bg-gray-50 p-3 border-t border-gray-100 flex justify-between items-center group-hover:bg-blue-50/30 transition-colors">
                                <div className="flex gap-1">
                                    <button
                                        onClick={(e) => handleDelete(quote.id, e)}
                                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Eliminar"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                    <button
                                        onClick={(e) => handlePrint(quote, e)}
                                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                        title="Imprimir"
                                    >
                                        <Printer size={18} />
                                    </button>
                                    {/* Edit Button */}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onEdit && onEdit(quote.id); }}
                                        className="p-2 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-colors"
                                        title="Editar"
                                    >
                                        <FileText size={18} />
                                    </button>
                                </div>

                                {quote.status !== 'CONVERTED' && (
                                    <button
                                        onClick={(e) => handleConvertToSale(quote, e)}
                                        className="flex items-center gap-1 px-3 py-1.5 bg-white border border-blue-200 text-blue-700 hover:bg-blue-600 hover:text-white hover:border-blue-600 rounded-lg text-sm font-bold shadow-sm transition-all"
                                    >
                                        Facturar <ArrowRight size={14} />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default QuoteList;
