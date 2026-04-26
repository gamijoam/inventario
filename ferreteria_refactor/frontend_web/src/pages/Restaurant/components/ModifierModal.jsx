import React, { useState, useEffect } from 'react';
import { X, ChevronRight, Plus, Minus, Check } from 'lucide-react';
import axiosInstance from '../../../config/axios';

/**
 * Modal para seleccionar modificadores (tamaño, porciones, extras)
 * antes de agregar un producto a la orden.
 */
const ModifierModal = ({ product, onConfirm, onCancel }) => {
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);

    // selections: { [groupId]: optionId (SINGLE) or Set<optionId> (MULTIPLE) }
    const [selections, setSelections] = useState({});
    const [quantity, setQuantity] = useState(1);
    const [notes, setNotes] = useState('');

    useEffect(() => {
        if (!product) return;
        setLoading(true);
        axiosInstance.get(`/restaurant/modifiers/product/${product.id}`)
            .then(res => {
                const data = res.data || [];
                setGroups(data);
                // Pre-select first option of SINGLE required groups
                const initial = {};
                data.forEach(g => {
                    if (g.selection_type === 'SINGLE' && g.is_required && g.options.length > 0) {
                        initial[g.id] = g.options[0].id;
                    }
                    if (g.selection_type === 'MULTIPLE') {
                        initial[g.id] = new Set();
                    }
                });
                setSelections(initial);
            })
            .catch(() => setGroups([]))
            .finally(() => setLoading(false));
    }, [product]);

    const handleSingleSelect = (groupId, optionId) => {
        setSelections(prev => ({ ...prev, [groupId]: optionId }));
    };

    const handleMultipleToggle = (groupId, optionId) => {
        setSelections(prev => {
            const current = new Set(prev[groupId] || []);
            if (current.has(optionId)) current.delete(optionId);
            else current.add(optionId);
            return { ...prev, [groupId]: current };
        });
    };

    // Calculate total price with modifiers
    const basePrice = parseFloat(product?.price || 0);
    let priceAdjustment = 0;
    groups.forEach(g => {
        if (g.selection_type === 'SINGLE') {
            const selId = selections[g.id];
            const opt = g.options.find(o => o.id === selId);
            if (opt) priceAdjustment += parseFloat(opt.price_adjustment || 0);
        } else {
            const selSet = selections[g.id] || new Set();
            g.options.forEach(o => {
                if (selSet.has(o.id)) priceAdjustment += parseFloat(o.price_adjustment || 0);
            });
        }
    });
    const unitPrice = basePrice + priceAdjustment;
    const totalPrice = unitPrice * quantity;

    const isValid = () => {
        return groups.every(g => {
            if (!g.is_required) return true;
            if (g.selection_type === 'SINGLE') return !!selections[g.id];
            if (g.selection_type === 'MULTIPLE') {
                const s = selections[g.id];
                return s && s.size > 0;
            }
            return true;
        });
    };

    const handleConfirm = () => {
        const modifierOptionIds = [];
        groups.forEach(g => {
            if (g.selection_type === 'SINGLE' && selections[g.id]) {
                modifierOptionIds.push(selections[g.id]);
            } else if (g.selection_type === 'MULTIPLE') {
                const s = selections[g.id] || new Set();
                s.forEach(id => modifierOptionIds.push(id));
            }
        });
        onConfirm({ product_id: product.id, quantity, notes, modifier_option_ids: modifierOptionIds });
    };

    if (!product) return null;

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100">
                    <div>
                        <h3 className="font-bold text-slate-800 text-base">{product.name}</h3>
                        <p className="text-sm text-slate-400">Precio base: ${basePrice.toFixed(2)}</p>
                    </div>
                    <button onClick={onCancel}
                        className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="animate-spin w-6 h-6 rounded-full border-2 border-orange-500 border-t-transparent" />
                        </div>
                    ) : groups.length === 0 ? (
                        <div className="py-3 text-center text-sm text-slate-400">Sin modificadores disponibles</div>
                    ) : (
                        groups.map(group => (
                            <div key={group.id}>
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="font-semibold text-slate-700 text-sm">{group.name}</span>
                                    {group.is_required && (
                                        <span className="text-[10px] bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-semibold">Requerido</span>
                                    )}
                                    {group.selection_type === 'MULTIPLE' && (
                                        <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">Varios</span>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    {group.options.map(opt => {
                                        const isSelected = group.selection_type === 'SINGLE'
                                            ? selections[group.id] === opt.id
                                            : (selections[group.id] || new Set()).has(opt.id);
                                        return (
                                            <button
                                                key={opt.id}
                                                onClick={() => group.selection_type === 'SINGLE'
                                                    ? handleSingleSelect(group.id, opt.id)
                                                    : handleMultipleToggle(group.id, opt.id)}
                                                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all text-left
                                                    ${isSelected
                                                        ? 'border-orange-500 bg-orange-50'
                                                        : 'border-slate-200 hover:border-orange-300 bg-white'}`}>
                                                <span className={`text-sm font-medium ${isSelected ? 'text-orange-700' : 'text-slate-700'}`}>
                                                    {opt.name}
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    {parseFloat(opt.price_adjustment) !== 0 && (
                                                        <span className={`text-xs font-semibold ${parseFloat(opt.price_adjustment) > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                            {parseFloat(opt.price_adjustment) > 0 ? '+' : ''}{parseFloat(opt.price_adjustment).toFixed(2)}
                                                        </span>
                                                    )}
                                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition
                                                        ${isSelected ? 'border-orange-500 bg-orange-500' : 'border-slate-300'}`}>
                                                        {isSelected && <Check size={12} className="text-white" strokeWidth={3} />}
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))
                    )}

                    {/* Notes */}
                    <div>
                        <label className="text-sm font-semibold text-slate-700 block mb-2">Comentarios / Notas</label>
                        <textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            placeholder="Ej: Sin cebolla, bien cocido..."
                            rows={2}
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm resize-none focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none"
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="px-5 pb-5 pt-3 border-t border-slate-100 space-y-3">
                    {/* Quantity control */}
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-600">Cantidad</span>
                        <div className="flex items-center gap-3">
                            <button onClick={() => setQuantity(q => Math.max(1, q - 1))}
                                className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 transition">
                                <Minus size={14} className="text-slate-600" />
                            </button>
                            <span className="font-bold text-slate-800 w-6 text-center">{quantity}</span>
                            <button onClick={() => setQuantity(q => q + 1)}
                                className="w-8 h-8 flex items-center justify-center rounded-full bg-orange-100 hover:bg-orange-200 transition">
                                <Plus size={14} className="text-orange-600" />
                            </button>
                        </div>
                    </div>

                    {/* Price summary */}
                    <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-2">
                        <span className="text-sm text-slate-500">Total</span>
                        <span className="font-bold text-slate-800">${totalPrice.toFixed(2)}</span>
                    </div>

                    {/* Confirm */}
                    <button
                        onClick={handleConfirm}
                        disabled={!isValid()}
                        className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition
                            ${isValid()
                                ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-200'
                                : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>
                        <Plus size={16} /> Agregar a la comanda
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ModifierModal;
