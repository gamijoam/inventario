import { useState, useEffect, useMemo } from 'react';
import { Search, Calendar, Trash2, Eye, Printer, AlertTriangle, X, FileText, ArrowRight, Filter, Download, MoreHorizontal, FileDown, ScanBarcode } from 'lucide-react';
import apiClient from '../config/axios';
import { useAuth } from '../context/AuthContext';
import { useConfig } from '../context/ConfigContext';
import { pdf } from '@react-pdf/renderer';
import InvoicePDF from '../components/pdf/InvoicePDF';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

// Shadcn UI Components
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import printerService from '../services/printerService';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Separator } from '../components/ui/separator';
import { ScrollArea } from '../components/ui/scroll-area';

const SalesHistory = () => {
    const { user } = useAuth();
    const { business, paymentMethods } = useConfig();
    const [sales, setSales] = useState([]);
    const [filteredSales, setFilteredSales] = useState([]);
    const [loading, setLoading] = useState(false);

    // Filters
    const [dateFrom, setDateFrom] = useState(new Date().toISOString().split('T')[0]);
    const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('');
    const [selectedStatus, setSelectedStatus] = useState('COMPLETED'); // Default to completed

    // Modals
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [showPinModal, setShowPinModal] = useState(false);
    const [selectedSale, setSelectedSale] = useState(null);
    const [saleToVoid, setSaleToVoid] = useState(null);

    // PIN Auth
    const [adminPin, setAdminPin] = useState('');
    const [pinError, setPinError] = useState('');

    // Metrics Calculation
    const metrics = useMemo(() => {
        const completedSales = filteredSales.filter(s => s.status !== 'VOIDED');
        const totalSales = completedSales.length;
        const totalRevenue = completedSales.reduce((acc, curr) => acc + Number(curr.total_amount || 0), 0);
        const averageTicket = totalSales > 0 ? totalRevenue / totalSales : 0;

        return {
            totalSales,
            totalRevenue,
            averageTicket
        };
    }, [filteredSales]);

    useEffect(() => {
        fetchSales();
    }, [dateFrom, dateTo, selectedPaymentMethod, selectedStatus]);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchSales();
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const fetchSales = async () => {
        setLoading(true);
        try {
            const params = {
                limit: 100,
                start_date: dateFrom,
                end_date: dateTo
            };

            if (searchQuery) params.q = searchQuery;
            if (selectedPaymentMethod) params.payment_method = selectedPaymentMethod;
            if (selectedStatus) params.status = selectedStatus;

            const response = await apiClient.get('/returns/sales/search', { params });
            // Sort by ID desc locally to ensure order if not forced by backend
            const sorted = response.data.sort((a, b) => b.id - a.id);
            setSales(sorted);
            setFilteredSales(sorted);
        } catch (error) {
            console.error('Error fetching sales:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleViewDetails = async (sale) => {
        try {
            const response = await apiClient.get(`/returns/sales/${sale.id}`);
            setSelectedSale(response.data);
            setShowDetailModal(true);
        } catch (error) {
            console.error('Error fetching sale details:', error);
            alert('Error al cargar detalles de la venta');
        }
    };

    const handleVoidClick = (sale) => {
        if (sale.status === 'VOIDED') {
            alert('Esta venta ya está anulada');
            return;
        }

        setSaleToVoid(sale);
        setShowPinModal(true);
        setAdminPin('');
        setPinError('');
    };

    const handleVoidConfirm = async () => {
        if (!adminPin) {
            setPinError('Ingrese el PIN de administrador');
            return;
        }

        try {
            // Validate PIN
            const pinResponse = await apiClient.post('/auth/validate-pin', {
                user_id: user?.id,
                pin: adminPin
            });

            if (!pinResponse.data.valid) {
                setPinError('PIN incorrecto');
                return;
            }

            // Process void as a return
            const items = saleToVoid.details?.map(detail => ({
                product_id: detail.product_id,
                quantity: detail.quantity,
                condition: 'GOOD'
            })) || [];

            await apiClient.post('/returns', {
                sale_id: saleToVoid.id,
                items: items,
                reason: 'ANULACIÓN DE VENTA - ERROR OPERATIVO',
                refund_currency: 'USD',
                exchange_rate: 1.0
            });

            // Update sale status locally
            const updatedSales = sales.map(s =>
                s.id === saleToVoid.id ? { ...s, status: 'VOIDED' } : s
            );
            setSales(updatedSales);
            setFilteredSales(updatedSales); // Also update filtered list to reflect change immediately

            alert('✅ Venta anulada correctamente');
            setShowPinModal(false);
            setSaleToVoid(null);
            setAdminPin('');
        } catch (error) {
            console.error('Error voiding sale:', error);
            if (error.response?.status === 401) {
                setPinError('PIN incorrecto');
            } else {
                setPinError(error.response?.data?.detail || 'Error al anular venta');
            }
        }
    };

    const handlePrintPDF = async (sale) => {
        try {
            const blob = await pdf(<InvoicePDF sale={sale} business={business} />).toBlob();
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');
        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Error al generar el PDF');
        }
    };

    const handleReprint = async (sale) => {
        try {
            await printerService.printTicket(sale.id);
            alert('✅ Ticket enviado a impresora exitosamente');
        } catch (error) {
            console.error('Error reprinting:', error);
            alert(`❌ Error al reimprimir:\n${error.message}`);
        }
    };

    const getStatusBadge = (status) => {
        if (status === 'VOIDED') {
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-600 border border-rose-100 uppercase tracking-wide">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Anulada
                </span>
            );
        }
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-100 uppercase tracking-wide">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Completada
            </span>
        );
    };

    const getCurrencySymbol = (currency) => {
        const symbols = { 'USD': '$', 'Bs': 'Bs', 'VES': 'Bs', 'COP': '$', 'EUR': '€' };
        return symbols[currency] || currency;
    };

    const renderPaymentInfo = (sale) => {
        if (!sale.payments || sale.payments.length === 0) {
            // Fallback to old display
            return (
                <div className="flex flex-col items-end">
                    <div className="font-bold text-slate-800 text-sm">${Number(sale.total_amount).toFixed(2)}</div>
                    <div className="text-[10px] text-slate-400 font-bold tracking-wide">USD</div>
                </div>
            );
        }

        // Case 1: Single Payment
        if (sale.payments.length === 1) {
            const payment = sale.payments[0];
            const symbol = getCurrencySymbol(payment.currency);
            return (
                <div className="flex flex-col items-end">
                    <div className="font-bold text-slate-800 text-sm">
                        {symbol} {Number(payment.amount).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="text-[10px] text-slate-400 font-bold tracking-wide flex items-center gap-1">
                        {payment.currency}
                        {payment.currency !== 'USD' && (
                            <span className="text-slate-300">| ${Number(sale.total_amount).toFixed(2)}</span>
                        )}
                        {payment.reference && (
                            <span className="block w-full text-right text-[9px] text-indigo-400 italic">Ref: {payment.reference}</span>
                        )}
                    </div>
                </div>
            );
        }

        // Case 2: Mixed Payments
        return (
            <div className="group relative flex flex-col items-end">
                <div className="px-2 py-0.5 rounded bg-purple-50 text-purple-600 font-bold text-xs border border-purple-100">
                    MIXTO
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">{sale.payments.length} pagos</div>

                {/* Tooltip on hover */}
                <div className="hidden group-hover:block absolute z-50 right-0 top-full mt-2 w-48 bg-slate-800 text-white text-xs rounded-xl p-3 shadow-2xl animate-in fade-in zoom-in duration-200">
                    <div className="font-bold mb-2 text-slate-300 border-b border-slate-700 pb-1">Desglose</div>
                    {sale.payments.map((payment, idx) => (
                        <div key={idx} className="flex justify-between py-1 border-b border-slate-700/50 last:border-0 text-slate-200 flex-wrap">
                            <span className="font-medium">{payment.currency}</span>
                            <span className="font-mono">{getCurrencySymbol(payment.currency)} {Number(payment.amount).toFixed(2)}</span>
                            {payment.reference && (
                                <span className="w-full text-[10px] text-slate-400 text-right italic">Ref: {payment.reference}</span>
                            )}
                        </div>
                    ))}
                    <div className="mt-2 pt-2 border-t border-slate-600 font-bold text-white flex justify-between">
                        <span>Total USD:</span>
                        <span>${Number(sale.total_amount).toFixed(2)}</span>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div id="tour-sales-container" className="space-y-6 max-w-7xl mx-auto px-4 py-8">
            {/* Header & Metrics */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight">Historial de Ventas</h1>
                    <p className="text-slate-500 font-medium">Gestiona y consulta todas las transacciones.</p>
                </div>
            </div>

            {/* Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">
                            Ventas Totales
                        </CardTitle>
                        <FileText className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black text-slate-800">{metrics.totalSales}</div>
                        <p className="text-xs text-slate-400 font-bold mt-1">Transacciones filtradas</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">
                            Ingreso Total
                        </CardTitle>
                        <AlertTriangle className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black text-emerald-600">${Number(metrics.totalRevenue).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                        <p className="text-xs text-slate-400 font-bold mt-1">En USD (aprox)</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">
                            Ticket Promedio
                        </CardTitle>
                        <Calendar className="h-4 w-4 text-indigo-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black text-indigo-600">${Number(metrics.averageTicket).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                        <p className="text-xs text-slate-400 font-bold mt-1">Por transacción</p>
                    </CardContent>
                </Card>
            </div>

            {/* Filter Toolbar */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-3 w-full md:w-auto flex-1">
                    <div className="relative w-full max-w-sm">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Buscar folio, cliente o referencia..."
                            className="pl-9 bg-slate-50/50 border-slate-200 focus:bg-white transition-colors"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <Input
                            type="date"
                            className="w-full sm:w-auto bg-slate-50/50 border-slate-200 text-xs font-bold text-slate-600 uppercase"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                        />
                        <span className="text-slate-300">-</span>
                        <Input
                            type="date"
                            className="w-full sm:w-auto bg-slate-50/50 border-slate-200 text-xs font-bold text-slate-600 uppercase"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                        />
                    </div>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="gap-2 border-slate-200 text-slate-600">
                                <Filter size={14} /> Filtro: {selectedStatus === '' ? 'Todos' : selectedStatus === 'VOIDED' ? 'Anulados' : 'Completados'}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Filtrar Estado</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setSelectedStatus('')}>Todos</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setSelectedStatus('COMPLETED')}>Completados</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setSelectedStatus('VOIDED')}>Anulados</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <Button variant="outline" className="gap-2 border-slate-200 text-slate-600 hover:text-indigo-600 active:scale-95 transition-transform" onClick={() => alert('Exportar Excel no implementado en demo')}>
                        <FileDown size={14} /> Exportar
                    </Button>
                </div>
            </div>

            {/* Sales Table */}
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                <Table>
                    <TableHeader className="bg-slate-50/50">
                        <TableRow>
                            <TableHead className="w-[100px] font-bold text-slate-500 uppercase text-xs tracking-wider">Folio</TableHead>
                            <TableHead className="font-bold text-slate-500 uppercase text-xs tracking-wider">Fecha</TableHead>
                            <TableHead className="font-bold text-slate-500 uppercase text-xs tracking-wider">Cliente</TableHead>
                            <TableHead className="font-bold text-slate-500 uppercase text-xs tracking-wider">Cajero / Caja</TableHead>
                            <TableHead className="font-bold text-slate-500 uppercase text-xs tracking-wider text-right">Total</TableHead>
                            <TableHead className="font-bold text-slate-500 uppercase text-xs tracking-wider text-center">Estado</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-32 text-center text-slate-400 font-medium animate-pulse">
                                    Cargando datos...
                                </TableCell>
                            </TableRow>
                        ) : filteredSales.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-32 text-center text-slate-400 font-medium">
                                    No se encontraron ventas
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredSales.map((sale) => (
                                <TableRow key={sale.id} className="hover:bg-slate-50/50 group">
                                    <TableCell className="font-mono font-bold text-slate-700">
                                        #{sale.id}
                                    </TableCell>
                                    <TableCell className="text-slate-500 text-xs">
                                        <div className="flex flex-col">
                                            <span className="font-medium text-slate-600">{new Date(sale.date).toLocaleDateString()}</span>
                                            <span>{new Date(sale.date).toLocaleTimeString()}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-8 w-8 bg-indigo-100 text-indigo-600 font-bold border border-indigo-200">
                                                <AvatarFallback>
                                                    {sale.customer?.name ? sale.customer.name.substring(0, 2).toUpperCase() : 'GN'}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-700 text-sm">
                                                    {sale.customer?.name || 'Cliente General'}
                                                </span>
                                                {sale.customer?.id_number && (
                                                    <span className="text-[10px] text-slate-400 font-medium">
                                                        {sale.customer.id_number}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col gap-0.5">
                                            {sale.cashier_name ? (
                                                <span className="text-xs font-semibold text-slate-700">{sale.cashier_name}</span>
                                            ) : (
                                                <span className="text-xs text-slate-400">—</span>
                                            )}
                                            {sale.register_name && (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded w-fit">
                                                    {sale.register_code} · {sale.register_name}
                                                </span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className={clsx("font-bold", sale.status === 'VOIDED' ? "text-slate-400 line-through" : "text-slate-800")}>
                                            ${Number(sale.total_amount).toFixed(2)}
                                        </div>
                                        {sale.payment_method && (
                                            <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wide">
                                                {sale.payment_method}
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        {sale.status === 'VOIDED' ? (
                                            <Badge variant="destructive" className="bg-rose-50 text-rose-600 border-rose-100 hover:bg-rose-100">
                                                Anulada
                                            </Badge>
                                        ) : (
                                            <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100 shadow-none">
                                                Completada
                                            </Badge>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="secondary" className="h-8 px-3 gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 shadow-sm transition-all hover:scale-105 active:scale-95">
                                                    <span className="text-xs font-bold">Opciones</span>
                                                    <MoreHorizontal className="h-3.5 w-3.5" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem onClick={() => handleViewDetails(sale)}>
                                                    <Eye className="mr-2 h-4 w-4" /> Ver Detalles
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handlePrintPDF(sale)}>
                                                    <FileText className="mr-2 h-4 w-4" /> Nota de Entrega
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleReprint(sale)}>
                                                    <Printer className="mr-2 h-4 w-4" /> Reimprimir Ticket
                                                </DropdownMenuItem>
                                                {sale.status !== 'VOIDED' && (
                                                    <>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem onClick={() => handleVoidClick(sale)} className="text-rose-600 focus:text-rose-600 focus:bg-rose-50">
                                                            <Trash2 className="mr-2 h-4 w-4" /> Anular Venta
                                                        </DropdownMenuItem>
                                                    </>
                                                )}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Modals - Kept but restyled slightly if needing container updates, though they are fixed position */}
            {/* Keeping existing modal logic as is, just wrapped in fragment if needed, but they are here in the flow */}

            {/* Sale Detail Modal (Bento Styled - Same as before but verified styling) */}
            {showDetailModal && selectedSale && (
                <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                    <Badge variant="outline" className="bg-indigo-50 text-indigo-600 border-indigo-100 px-2 py-1 h-auto text-xs">
                                        VENTA
                                    </Badge>
                                    #{selectedSale.id}
                                </h3>
                                <p className="text-sm text-slate-500 mt-1">
                                    {new Date(selectedSale.date).toLocaleString()}
                                </p>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setShowDetailModal(false)}>
                                <X className="h-5 w-5 text-slate-400" />
                            </Button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 flex flex-col p-6 overflow-hidden">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 flex-shrink-0">
                                <Card className="shadow-sm">
                                    <CardContent className="p-4">
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Cliente</p>
                                        <p className="font-bold text-slate-800 text-lg">{selectedSale.customer?.name || 'Cliente General'}</p>
                                        {selectedSale.customer?.id_number && (
                                            <p className="text-sm text-slate-500 font-medium">{selectedSale.customer.id_number}</p>
                                        )}
                                    </CardContent>
                                </Card>
                                <Card className="shadow-sm">
                                    <CardContent className="p-4">
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Estado</p>
                                        <div className="mt-1">{getStatusBadge(selectedSale.status)}</div>
                                    </CardContent>
                                </Card>
                            </div>

                            <div className="flex-1 shadow-none border border-slate-200 overflow-hidden flex flex-col min-h-0 bg-white rounded-xl">
                                <div className="flex-1 overflow-y-auto custom-scrollbar relative">
                                    <Table>
                                        <TableHeader className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                                            <TableRow>
                                                <TableHead className="py-3">Producto</TableHead>
                                                <TableHead className="text-center py-3">Cant.</TableHead>
                                                <TableHead className="text-right py-3">Precio</TableHead>
                                                <TableHead className="text-right py-3">Total</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {selectedSale.details?.map((detail, index) => (
                                                <TableRow key={index} className="group/row">
                                                    <TableCell className="font-medium py-4">
                                                        <div className="flex flex-col gap-1">
                                                            <div className="text-sm font-bold text-slate-700 group-hover/row:text-indigo-600 transition-colors">
                                                                {detail.product?.name || 'Producto Desconocido'}
                                                            </div>

                                                            {/* Styled Serial Numbers - More prominent now */}
                                                            {detail.instances && detail.instances.length > 0 && (
                                                                <div className="mt-2 flex flex-col gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200/60 shadow-inner">
                                                                    <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                                                        <div className="p-1 bg-indigo-100 text-indigo-600 rounded">
                                                                            <ScanBarcode size={10} />
                                                                        </div>
                                                                        Seriales / IMEIs ({detail.instances.length})
                                                                    </div>
                                                                    <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                                                                        {detail.instances.map((inst, idx) => (
                                                                            <Badge
                                                                                key={idx}
                                                                                variant="secondary"
                                                                                className="font-mono text-[11px] px-2.5 py-1 bg-white text-indigo-700 border-indigo-100 border shadow-sm hover:border-indigo-300 hover:bg-indigo-50 transition-all cursor-default font-bold"
                                                                            >
                                                                                {inst.product_instance?.serial_number || 'S/N'}
                                                                            </Badge>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-center font-bold text-slate-600">{detail.quantity}</TableCell>
                                                    <TableCell className="text-right text-slate-600">
                                                        ${Number(detail.unit_price).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                    </TableCell>
                                                    <TableCell className="text-right font-black text-slate-900">
                                                        ${Number(detail.subtotal).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                                <div className="bg-slate-50 p-4 border-t border-slate-200 flex flex-col items-end gap-2 flex-shrink-0">
                                    {selectedSale?.total_discount_usd > 0 && (
                                        <div className="flex justify-between items-center w-full max-w-[200px] text-rose-500">
                                            <div className="flex flex-col">
                                                <span className="font-bold uppercase tracking-wider text-[10px]">
                                                    Descuento {selectedSale?.cart_discount_type === 'percent' ? '(%)' : (selectedSale?.cart_discount_type === 'fixed_bs' ? '(Bs)' : '(Fijo)')}
                                                </span>
                                                {selectedSale?.cart_discount_type === 'fixed_bs' && selectedSale?.exchange_rate_used && (
                                                    <span className="text-[9px] text-rose-400 font-medium tracking-tight -mt-0.5">
                                                        Bs. {Number(selectedSale.total_discount_usd * selectedSale.exchange_rate_used).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </span>
                                                )}
                                            </div>
                                            <span className="font-bold text-sm">
                                                -${Number(selectedSale.total_discount_usd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    )}
                                    <div className="flex justify-between items-center w-full max-w-[200px]">
                                        <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Total Venta</span>
                                        <span className="font-black text-3xl text-indigo-600 tracking-tight">${Number(selectedSale.total_amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-3">
                            <Button className="flex-1 bg-indigo-600 hover:bg-indigo-700" onClick={() => handlePrintPDF(selectedSale)}>
                                <FileText className="mr-2 h-4 w-4" /> Generar PDF
                            </Button>
                            <Button variant="outline" className="flex-1 border-indigo-200 text-indigo-700 hover:bg-indigo-50" onClick={() => handleReprint(selectedSale)}>
                                <Printer className="mr-2 h-4 w-4" /> Reimprimir
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* PIN Auth Modal */}
            {showPinModal && saleToVoid && (
                <div className="fixed inset-0 bg-slate-900/70 flex items-center justify-center z-50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <Card className="w-full max-w-sm shadow-2xl border-2 border-white/20">
                        <CardHeader className="text-center pb-2">
                            <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <AlertTriangle className="text-rose-500 h-8 w-8" />
                            </div>
                            <CardTitle className="text-xl font-black text-rose-600">Confirmar Anulación</CardTitle>
                            <p className="text-slate-500 text-sm mt-1">
                                Anular venta <span className="font-bold text-slate-800">#{saleToVoid.id}</span>
                            </p>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="bg-rose-50 border border-rose-100 rounded-xl p-3">
                                <p className="text-xs text-rose-700 font-bold text-center leading-relaxed">
                                    Esta acción devolverá los productos al inventario y reembolsará el dinero.
                                </p>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block text-center">PIN Administrativo</label>
                                <Input
                                    type="password"
                                    value={adminPin}
                                    onChange={(e) => {
                                        setAdminPin(e.target.value);
                                        setPinError('');
                                    }}
                                    onKeyPress={(e) => e.key === 'Enter' && handleVoidConfirm()}
                                    className="text-center text-2xl tracking-[0.5em] font-black h-14"
                                    maxLength={6}
                                    autoFocus
                                />
                                {pinError && (
                                    <p className="text-rose-600 text-xs font-bold text-center animate-pulse">{pinError}</p>
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-3 pt-2">
                                <Button variant="outline" onClick={() => { setShowPinModal(false); setAdminPin(''); }}>
                                    Cancelar
                                </Button>
                                <Button variant="destructive" onClick={handleVoidConfirm}>
                                    ANULAR
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
};

export default SalesHistory;
