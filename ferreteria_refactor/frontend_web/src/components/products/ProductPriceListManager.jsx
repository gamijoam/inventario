import React, { useState } from 'react';
import { AlertCircle, ShieldCheck, Plus, Lock, Unlock } from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import toast from 'react-hot-toast';

const ProductPriceListManager = ({
    prices = {},
    onPricesChange,
    priceLists = [],
    basePrice,
    onRefresh
}) => {
    const [showNewListInput, setShowNewListInput] = useState(false);
    const [newListName, setNewListName] = useState('');
    const [newListRequiresPin, setNewListRequiresPin] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [togglingId, setTogglingId] = useState(null);

    // Normalize: support both object {listId: price} and array [{price_list_id, price}]
    const pricesObj = Array.isArray(prices)
        ? prices.reduce((acc, p) => { acc[p.price_list_id] = p.price; return acc; }, {})
        : (prices && typeof prices === 'object' ? prices : {});

    const createList = async () => {
        if (!newListName.trim()) return;
        setIsCreating(true);
        try {
            const { default: apiClient } = await import('../../config/axios');
            await apiClient.post('/price-lists/', {
                name: newListName,
                requires_auth: newListRequiresPin,
                is_active: true
            });
            setNewListName('');
            setNewListRequiresPin(false);
            setShowNewListInput(false);
            if (onRefresh) onRefresh();
        } catch (error) {
            console.error(error);
            toast.error("Error al crear lista");
        } finally {
            setIsCreating(false);
        }
    };

    const toggleRequiresAuth = async (list) => {
        setTogglingId(list.id);
        try {
            const { default: apiClient } = await import('../../config/axios');
            await apiClient.patch(`/price-lists/${list.id}`, {
                requires_auth: !list.requires_auth
            });
            if (onRefresh) onRefresh();
        } catch (error) {
            console.error(error);
            toast.error("Error al actualizar lista");
        } finally {
            setTogglingId(null);
        }
    };

    const handlePriceChange = (listId, newPrice) => {
        const price = parseFloat(newPrice);
        if (isNaN(price)) return;
        onPricesChange({ ...pricesObj, [listId]: price });
    };

    const getPriceForList = (listId) => {
        return pricesObj[listId] ?? '';
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {priceLists.map(list => {
                    const currentPrice = getPriceForList(list.id);
                    const diff = basePrice > 0 && currentPrice > 0
                        ? ((currentPrice - basePrice) / basePrice * 100).toFixed(1)
                        : 0;
                    const isToggling = togglingId === list.id;

                    return (
                        <div
                            key={list.id}
                            className={`bg-white p-4 rounded-xl border shadow-sm transition-colors relative group ${list.requires_auth
                                    ? 'border-amber-200 ring-1 ring-amber-100'
                                    : 'border-slate-200 hover:border-indigo-300'
                                }`}
                        >
                            {/* Header */}
                            <div className="flex justify-between items-center mb-3">
                                <div className="flex items-center gap-2">
                                    <h4 className="font-bold text-slate-700 text-sm uppercase tracking-wide">
                                        {list.name}
                                    </h4>
                                    {list.requires_auth && (
                                        <span className="text-[9px] font-black bg-amber-500 text-white px-1.5 py-0.5 rounded-full">
                                            🔒 PIN
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    {diff !== 0 && (
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${diff > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                                            }`}>
                                            {diff > 0 ? '+' : ''}{diff}%
                                        </span>
                                    )}
                                    {/* Lock toggle */}
                                    <button
                                        onClick={() => toggleRequiresAuth(list)}
                                        disabled={isToggling}
                                        title={list.requires_auth ? 'Quitar protección PIN' : 'Requerir PIN para usar este precio'}
                                        className={`p-1.5 rounded-lg transition-all border text-xs font-bold flex items-center gap-1 ${list.requires_auth
                                                ? 'bg-amber-50 border-amber-300 text-amber-600 hover:bg-amber-100'
                                                : 'bg-slate-50 border-slate-200 text-slate-400 hover:border-amber-300 hover:text-amber-500 hover:bg-amber-50'
                                            } disabled:opacity-50`}
                                    >
                                        {isToggling ? '...' : list.requires_auth
                                            ? <><Lock size={11} /> PIN</>
                                            : <Unlock size={11} />
                                        }
                                    </button>
                                </div>
                            </div>

                            {/* Price input */}
                            <div className="relative">
                                <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-xs">$</span>
                                <Input
                                    type="number"
                                    step="0.01"
                                    placeholder="0.00"
                                    className="pl-7 font-bold text-slate-700 h-9 bg-slate-50/50 focus:bg-white"
                                    value={currentPrice}
                                    onChange={(e) => handlePriceChange(list.id, e.target.value)}
                                    onFocus={(e) => e.target.select()}
                                />
                            </div>
                        </div>
                    );
                })}

                {/* New List Button / Form */}
                {showNewListInput ? (
                    <div className="bg-slate-50 p-4 rounded-xl border border-dashed border-indigo-300 flex flex-col gap-3 justify-center">
                        <Input
                            autoFocus
                            placeholder="Nombre de Lista (Ej. Mayor)"
                            className="h-9 text-sm"
                            value={newListName}
                            onChange={e => setNewListName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && createList()}
                        />

                        {/* PIN toggle for new list */}
                        <button
                            type="button"
                            onClick={() => setNewListRequiresPin(p => !p)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-bold transition-all w-full ${newListRequiresPin
                                    ? 'bg-amber-50 border-amber-400 text-amber-700 ring-1 ring-amber-200'
                                    : 'bg-white border-slate-200 text-slate-400 hover:border-amber-300 hover:text-amber-600'
                                }`}
                        >
                            {newListRequiresPin ? <Lock size={13} /> : <Unlock size={13} />}
                            <span>{newListRequiresPin ? 'Requiere PIN para usar en POS' : 'Sin protección (click para activar PIN)'}</span>
                        </button>

                        <div className="flex gap-2">
                            <Button
                                size="sm"
                                onClick={createList}
                                disabled={isCreating}
                                className="h-8 text-xs w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                            >
                                {isCreating ? 'Guardando...' : 'Crear'}
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => { setShowNewListInput(false); setNewListRequiresPin(false); }}
                                className="h-8 text-xs w-full"
                            >
                                Cancelar
                            </Button>
                        </div>
                    </div>
                ) : (
                    <button
                        onClick={() => setShowNewListInput(true)}
                        className="flex flex-col items-center justify-center p-4 rounded-xl border border-dashed border-slate-300 text-slate-400 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/30 transition-all h-full min-h-[100px]"
                    >
                        <Plus size={24} className="mb-2 opacity-50" />
                        <span className="text-xs font-bold">Nueva Lista</span>
                    </button>
                )}
            </div>

            <div className="bg-blue-50/50 p-3 rounded-xl flex gap-3 border border-blue-100/50">
                <AlertCircle size={16} className="text-blue-500 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-600/80 leading-relaxed">
                    <strong>Nota:</strong> Activa el <strong>🔒 PIN</strong> en una lista para que en el POS solicite autorización de administrador antes de aplicar ese precio.
                </p>
            </div>
        </div>
    );
};

export default ProductPriceListManager;
