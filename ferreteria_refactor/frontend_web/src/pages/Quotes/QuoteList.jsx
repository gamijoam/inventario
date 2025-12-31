import React, { useState, useEffect } from 'react';
import {
    FileText, Calendar, User, DollarSign, ArrowRight, Trash2, Printer,
    RefreshCcw, AlertCircle, CheckCircle, Clock, Search, Edit
} from 'lucide-react';
import apiClient from '../../config/axios';
import { toast } from 'react-hot-toast';
import { useConfig } from '../../context/ConfigContext';
import clsx from 'clsx';

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
            const { data: fullQuote } = await apiClient.get(`/quotes/${partialQuote.id}`);
            toast.dismiss(loadingToast);

            const items = fullQuote.details || fullQuote.items || [];

            if (items.length === 0) {
                toast.error("La cotización está vacía");
                return;
            }

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
                return <span className="bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1"><CheckCircle size={12} /> Facturada</span>;
            case 'EXPIRED':
                return <span className="bg-rose-100 text-rose-700 px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1"><AlertCircle size={12} /> Vencida</span>;
            default: // PENDING
                return <span className="bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1"><Clock size={12} /> Pendiente</span>;
        }
    };

    if (loading) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-8 text-slate-400">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-200 border-t-indigo-600 mb-4"></div>
                <p className="font-medium animate-pulse">Cargando cotizaciones...</p>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col">
            {/* Toolbar */}
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center sticky top-0 z-20 backdrop-blur-sm">
                <div>
                    <h2 className="text-lg font-bold text-slate-800">Historial</h2>
                    <p className="text-xs text-slate-500 font-medium">{filteredQuotes.length} cotizaciones encontradas</p>
                </div>

                <div className="flex gap-3 items-center">
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar..."
                            className="pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none w-64 text-sm font-medium transition-all shadow-sm"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 bg-slate-50/30">
                {filteredQuotes.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-300">
                        <div className="bg-slate-50 p-6 rounded-full mb-4">
                            <FileText size={48} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-500 mb-2">No se encontraron cotizaciones</h3>
                        <p className="text-sm font-medium mb-6">Intenta con otro término de búsqueda o crea una nueva.</p>
                        <button
                            onClick={onCreateNew}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-200 transition-all flex items-center gap-2"
                        >
                            <FileText size={18} /> Crear Cotización
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
                        {filteredQuotes.map(quote => (
                            <div
                                key={quote.id}
                                className="bg-white rounded-2xl shadow-sm border border-slate-200 hover:shadow-md hover:border-indigo-200 transition-all group overflow-hidden flex flex-col h-[260px] relative"
                            >
                                {/* Status Indicator Line */}
                                <div className={clsx(
                                    "absolute top-0 left-0 w-1.5 h-full",
                                    quote.status === 'CONVERTED' ? 'bg-emerald-500' :
                                        quote.status === 'EXPIRED' ? 'bg-rose-500' : 'bg-blue-500'
                                )}></div>

                                <div className="p-5 flex-1 flex flex-col pl-7">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className="text-lg font-black text-slate-800">#{quote.id}</h3>
                                            <div className="text-xs text-slate-500 flex items-center gap-1 mt-1 font-medium">
                                                <Calendar size={12} />
                                                {new Date(quote.date).toLocaleDateString()}
                                            </div>
                                        </div>
                                        {getStatusBadge(quote.status)}
                                    </div>

                                    <div className="space-y-3 mb-4 flex-1">
                                        <div className="flex items-start gap-2 text-sm text-slate-700">
                                            <div className="bg-slate-100 p-1 rounded-md text-slate-500">
                                                <User size={14} />
                                            </div>
                                            <span className="font-bold line-clamp-1 mt-0.5" title={quote.customer?.name}>
                                                {quote.customer?.name || "Cliente General"}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs font-medium text-slate-500 ml-8">
                                            <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                                {(quote.details?.length || quote.items?.length || 0)} items
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1 text-xl font-black text-slate-800 border-t border-slate-50 pt-3">
                                        <span className="text-slate-400 text-sm font-bold mt-1">$</span>
                                        <span>{Number(quote.total_amount).toFixed(2)}</span>
                                    </div>
                                </div>

                                {/* Actions Footer - Slide up on hover */}
                                <div className="bg-slate-50 p-3 border-t border-slate-100 flex justify-between items-center group-hover:bg-indigo-50/30 transition-colors pl-7">
                                    <div className="flex gap-1">
                                        <button
                                            onClick={(e) => handleDelete(quote.id, e)}
                                            className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                                            title="Eliminar"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                        <button
                                            onClick={(e) => handlePrint(quote, e)}
                                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                            title="Imprimir"
                                        >
                                            <Printer size={18} />
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onEdit && onEdit(quote.id); }}
                                            className="p-2 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-colors"
                                            title="Editar"
                                        >
                                            <Edit size={18} />
                                        </button>
                                    </div>

                                    {quote.status !== 'CONVERTED' && (
                                        <button
                                            onClick={(e) => handleConvertToSale(quote, e)}
                                            className="flex items-center gap-1 px-3 py-1.5 bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 rounded-lg text-xs font-bold shadow-sm transition-all active:scale-95"
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
        </div>
    );
};

export default QuoteList;
