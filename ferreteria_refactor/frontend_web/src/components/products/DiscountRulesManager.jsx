import { useState, useEffect } from 'react';
import { Plus, Trash2, Tag, Zap } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import apiClient from '../../config/axios';
import toast from 'react-hot-toast';

const DiscountRulesManager = ({ productId, initialRules = [] }) => {
    const [rules, setRules] = useState(initialRules);
    const [loading, setLoading] = useState(false);
    const [newRule, setNewRule] = useState({ min_quantity: '', discount_percentage: '' });

    useEffect(() => {
        if (productId) {
            apiClient.get(`/products/${productId}/discount-rules`)
                .then(r => setRules(r.data))
                .catch(() => { });
        }
    }, [productId]);

    const handleAdd = async () => {
        const qty = parseFloat(newRule.min_quantity);
        const pct = parseFloat(newRule.discount_percentage);
        if (!qty || qty <= 0 || !pct || pct <= 0 || pct > 100) {
            toast.error('Ingresa cantidad mínima y descuento válidos (1-100%)');
            return;
        }
        if (!productId) {
            toast.error('Guarda el producto primero para agregar reglas de precio');
            return;
        }
        setLoading(true);
        try {
            const res = await apiClient.post(`/products/${productId}/discount-rules`, {
                min_quantity: qty,
                discount_percentage: pct,
                is_active: true
            });
            setRules(prev => [...prev, res.data].sort((a, b) => a.min_quantity - b.min_quantity));
            setNewRule({ min_quantity: '', discount_percentage: '' });
            toast.success('Regla agregada');
        } catch (e) {
            toast.error('Error al agregar regla');
        }
        setLoading(false);
    };

    const handleDelete = async (id) => {
        try {
            await apiClient.delete(`/products/${productId}/discount-rules/${id}`);
            setRules(prev => prev.filter(r => r.id !== id));
            toast.success('Regla eliminada');
        } catch {
            toast.error('Error al eliminar regla');
        }
    };

    const handleToggle = async (rule) => {
        try {
            const res = await apiClient.put(`/products/${productId}/discount-rules/${rule.id}`, {
                is_active: !rule.is_active
            });
            setRules(prev => prev.map(r => r.id === rule.id ? res.data : r));
        } catch {
            toast.error('Error al actualizar regla');
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
                <Zap size={16} className="text-amber-500" />
                <p className="text-xs text-slate-500">
                    Define descuentos automáticos por cantidad. Se aplicarán en el POS cuando el cliente compre la cantidad indicada o más.
                </p>
            </div>

            {rules.length === 0 ? (
                <div className="text-center py-8 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                    <Tag size={24} className="mx-auto mb-2 opacity-40" />
                    <p className="text-sm font-medium">No hay reglas de descuento</p>
                    <p className="text-xs">Agrega una regla para activar precios mayoristas automáticos</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {rules.sort((a, b) => a.min_quantity - b.min_quantity).map(rule => (
                        <div
                            key={rule.id}
                            className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${rule.is_active
                                    ? 'bg-amber-50 border-amber-200'
                                    : 'bg-slate-50 border-slate-200 opacity-60'
                                }`}
                        >
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${rule.is_active ? 'bg-amber-500' : 'bg-slate-300'}`} />
                            <div className="flex-1 flex items-center gap-4 flex-wrap">
                                <div>
                                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Cantidad Mínima</span>
                                    <span className="text-sm font-black text-slate-800 font-mono">{parseFloat(rule.min_quantity).toFixed(0)} uds.</span>
                                </div>
                                <div className="text-slate-300">→</div>
                                <div>
                                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Descuento</span>
                                    <span className="text-sm font-black text-amber-600 font-mono">{parseFloat(rule.discount_percentage).toFixed(1)}%</span>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleToggle(rule)}
                                    title={rule.is_active ? 'Desactivar' : 'Activar'}
                                    className={`text-[10px] font-bold px-2 py-1 rounded-lg transition-colors ${rule.is_active
                                            ? 'bg-amber-200 text-amber-700 hover:bg-amber-300'
                                            : 'bg-slate-200 text-slate-500 hover:bg-slate-300'
                                        }`}
                                >
                                    {rule.is_active ? 'ON' : 'OFF'}
                                </button>
                                <button
                                    onClick={() => handleDelete(rule.id)}
                                    className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="flex gap-2 items-end pt-3 border-t border-slate-100">
                <div className="flex-1">
                    <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block mb-1">Cantidad mínima</label>
                    <Input
                        type="number"
                        min="1"
                        step="1"
                        placeholder="Ej: 10"
                        value={newRule.min_quantity}
                        onChange={e => setNewRule(p => ({ ...p, min_quantity: e.target.value }))}
                        className="h-9 text-sm font-mono border-slate-200"
                    />
                </div>
                <div className="flex-1">
                    <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block mb-1">Descuento (%)</label>
                    <Input
                        type="number"
                        min="0.1"
                        max="100"
                        step="0.1"
                        placeholder="Ej: 15"
                        value={newRule.discount_percentage}
                        onChange={e => setNewRule(p => ({ ...p, discount_percentage: e.target.value }))}
                        className="h-9 text-sm font-mono border-slate-200"
                    />
                </div>
                <Button
                    onClick={handleAdd}
                    disabled={loading}
                    size="sm"
                    className="h-9 bg-amber-500 hover:bg-amber-600 text-white font-bold px-4 rounded-lg"
                >
                    <Plus size={14} className="mr-1" />
                    Agregar
                </Button>
            </div>
        </div>
    );
};

export default DiscountRulesManager;
