import React, { useState, useEffect } from 'react';
import { X, Search, Loader2, Copy, Check, Filter } from 'lucide-react';
import apiClient from '../../config/axios';
import { Badge } from '../../components/ui/badge';
import { toast } from 'react-hot-toast';

const ProductInstancesModal = ({ isOpen, onClose, product }) => {
    const [instances, setInstances] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    useEffect(() => {
        if (isOpen && product) {
            fetchInstances();
        } else {
            setInstances([]);
            setSearchTerm('');
            setStatusFilter('');
        }
    }, [isOpen, product]);

    const fetchInstances = async () => {
        setIsLoading(true);
        try {
            const { data } = await apiClient.get(`/inventory/product/${product.id}/instances`);
            setInstances(data);
        } catch (error) {
            console.error("Error fetching instances:", error);
            toast.error("Error cargando seriales");
        } finally {
            setIsLoading(false);
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        toast.success("Copiado al portapapeles");
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'AVAILABLE': return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Disponible</Badge>;
            case 'SOLD': return <Badge className="bg-blue-100 text-blue-700 border-blue-200">Vendido</Badge>;
            case 'RMA': return <Badge className="bg-amber-100 text-amber-700 border-amber-200">Garantía / RMA</Badge>;
            case 'DAMAGED': return <Badge className="bg-rose-100 text-rose-700 border-rose-200">Dañado</Badge>;
            case 'TRANSIT': return <Badge className="bg-purple-100 text-purple-700 border-purple-200">En Tránsito</Badge>;
            default: return <Badge variant="outline" className="text-slate-500">{status}</Badge>;
        }
    };

    const filteredInstances = instances.filter(instance => {
        const matchesSearch = instance.serial_number.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = !statusFilter || instance.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">

                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-white">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900">Seriales / IMEIs</h2>
                        <p className="text-sm text-slate-500 font-medium">
                            Producto: <span className="text-indigo-600">{product?.name}</span>
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-rose-500">
                        <X size={20} />
                    </button>
                </div>

                {/* Toolbar */}
                <div className="p-4 bg-slate-50 border-b border-slate-100 flex gap-4 flex-col sm:flex-row">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder="Buscar serial..."
                            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <select
                        className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:border-indigo-500 outline-none w-full sm:w-48"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="">Todos los Estados</option>
                        <option value="AVAILABLE">Disponible</option>
                        <option value="SOLD">Vendido</option>
                        <option value="RMA">Garantía / RMA</option>
                        <option value="DAMAGED">Dañado</option>
                    </select>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-0 bg-white">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-2">
                            <Loader2 className="animate-spin text-indigo-500" size={32} />
                            <span className="text-sm font-medium">Cargando seriales...</span>
                        </div>
                    ) : (
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="px-6 py-3 tracking-wider">Serial / IMEI</th>
                                    <th className="px-6 py-3 tracking-wider">Estado</th>
                                    <th className="px-6 py-3 tracking-wider">Bodega</th>
                                    <th className="px-6 py-3 tracking-wider text-right">Fecha Ingreso</th>
                                    <th className="px-6 py-3 tracking-wider w-[60px]"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredInstances.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">
                                            No se encontraron seriales coincindentes.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredInstances.map((instance) => (
                                        <tr key={instance.id} className="hover:bg-slate-50 transition-colors group">
                                            <td className="px-6 py-3 font-mono text-slate-700 font-medium">
                                                {instance.serial_number}
                                            </td>
                                            <td className="px-6 py-3">
                                                {getStatusBadge(instance.status)}
                                            </td>
                                            <td className="px-6 py-3 text-slate-600">
                                                {instance.warehouse?.name || '---'}
                                            </td>
                                            <td className="px-6 py-3 text-right text-slate-500 tabular-nums">
                                                {new Date(instance.created_at).toLocaleDateString()} <span className="text-xs opacity-60">{new Date(instance.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </td>
                                            <td className="px-6 py-3 text-right">
                                                <button
                                                    onClick={() => copyToClipboard(instance.serial_number)}
                                                    className="p-1.5 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                    title="Copiar Serial"
                                                >
                                                    <Copy size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center text-xs text-slate-500">
                    <span>Total: <span className="font-bold text-slate-700">{instances.length}</span> registros</span>
                    <span>Mostrando: <span className="font-bold text-slate-700">{filteredInstances.length}</span></span>
                </div>
            </div>
        </div>
    );
};

export default ProductInstancesModal;
