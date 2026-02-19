import React, { useEffect, useState } from 'react';
import { DollarSign, AlertCircle, ShieldCheck, Plus } from 'lucide-react';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';

const ProductPriceListManager = ({
    prices = [],
    onPricesChange,
    priceLists = [],
    basePrice,
    onRefresh
}) => {
    const [showNewListInput, setShowNewListInput] = useState(false);
    const [newListName, setNewListName] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    const createList = async () => {
        if (!newListName.trim()) return;
        setIsCreating(true);
        try {
            const { default: apiClient } = await import('../../config/axios');

            await apiClient.post('/price-lists/', {
                name: newListName,
                requires_auth: false,
                is_active: true
            });

            setNewListName('');
            setShowNewListInput(false);
            if (onRefresh) onRefresh();

        } catch (error) {
            console.error(error);
            alert("Error al crear lista");
        } finally {
            setIsCreating(false);
        }
    };

    const handlePriceChange = (listId, newPrice) => {
        const price = parseFloat(newPrice);
        if (isNaN(price)) return;

        // Remove existing entry for this list if exists
        const otherPrices = prices.filter(p => p.price_list_id !== listId);

        // Add new entry
        const newEntry = {
            price_list_id: listId,
            price: price,
            currency_code: 'USD' // Default to USD for now, or inherit
        };

        onPricesChange([...otherPrices, newEntry]);
    };

    const getPriceForList = (listId) => {
        const entry = prices.find(p => p.price_list_id === listId);
        return entry ? entry.price : '';
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {priceLists.map(list => {
                    const currentPrice = getPriceForList(list.id);
                    const marginIds = basePrice > 0 && currentPrice > 0
                        ? ((currentPrice - basePrice) / basePrice * 100).toFixed(1)
                        : 0;

                    return (
                        <div key={list.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:border-indigo-300 transition-colors relative group">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <h4 className="font-bold text-slate-700 text-sm uppercase tracking-wide">{list.name}</h4>
                                    {list.requires_auth && <ShieldCheck size={12} className="inline ml-1 text-rose-500" />}
                                </div>
                                {marginIds !== 0 && (
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${marginIds > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                                        }`}>
                                        {marginIds > 0 ? '+' : ''}{marginIds}%
                                    </span>
                                )}
                            </div>

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
                            placeholder="Nombre de Lista (Ej. Especial)"
                            className="h-9 text-sm"
                            value={newListName}
                            onChange={e => setNewListName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && createList()}
                        />
                        <div className="flex gap-2">
                            <Button size="sm" onClick={createList} disabled={isCreating} className="h-8 text-xs w-full bg-indigo-600 hover:bg-indigo-700 text-white">
                                {isCreating ? 'Guardando...' : 'Crear'}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setShowNewListInput(false)} className="h-8 text-xs w-full">
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
                    <strong>Nota:</strong> Los precios definidos aquí anulan el precio base cuando se selecciona la lista correspondiente en el punto de venta.
                </p>
            </div>
        </div>
    );
};

export default ProductPriceListManager;
