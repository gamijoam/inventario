import { useState, useEffect } from 'react';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Zap, Loader2, Tag } from 'lucide-react';
import apiClient from '../../config/axios';
import { toast } from 'react-hot-toast';
import { getApiErrorMessage } from '../../utils/apiErrors';

const QuickProductCreateModal = ({ isOpen, onClose, onSuccess }) => {
    const [name, setName] = useState('');
    const [sku, setSku] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [price, setPrice] = useState('');
    const [stock, setStock] = useState('');
    const [categories, setCategories] = useState([]);
    const [loadingCategories, setLoadingCategories] = useState(false);
    const [priceLists, setPriceLists] = useState([]);
    const [loadingPriceLists, setLoadingPriceLists] = useState(false);
    const [selectedPriceListId, setSelectedPriceListId] = useState('');
    const [listPrice, setListPrice] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            // Reset del form
            setName('');
            setSku('');
            setCategoryId('');
            setPrice('');
            setStock('');
            setCategories([]);
            setPriceLists([]);
            setSelectedPriceListId('');
            setListPrice('');
            setLoadingCategories(true);
            setLoadingPriceLists(true);
            apiClient.get('/categories')
                .then(r => setCategories(Array.isArray(r.data) ? r.data : []))
                .catch(() => setCategories([]))
                .finally(() => setLoadingCategories(false));
            apiClient.get('/price-lists/')
                .then(r => {
                    const list = Array.isArray(r.data) ? r.data : [];
                    setPriceLists(list.filter(pl => pl.is_active));
                })
                .catch(() => setPriceLists([]))
                .finally(() => setLoadingPriceLists(false));
        }
    }, [isOpen]);

    const handleSubmit = async (e) => {
        e?.preventDefault();
        if (!name.trim()) { toast.error('El nombre es obligatorio'); return; }
        const priceNum = price === '' ? 0 : Number(price);
        if (Number.isNaN(priceNum) || priceNum < 0) { toast.error('Precio inválido'); return; }
        const stockNum = stock === '' ? 0 : Number(stock);
        if (Number.isNaN(stockNum) || stockNum < 0) { toast.error('Stock inválido'); return; }

        // Precio de la lista seleccionada (si hay)
        let listPriceNum = null;
        if (selectedPriceListId) {
            listPriceNum = listPrice === '' ? null : Number(listPrice);
            if (listPriceNum !== null && (Number.isNaN(listPriceNum) || listPriceNum < 0)) {
                toast.error('Precio de lista inválido');
                return;
            }
        }

        const pricesArray = [];
        if (selectedPriceListId && listPriceNum !== null && listPriceNum > 0) {
            pricesArray.push({
                price_list_id: Number(selectedPriceListId),
                price: listPriceNum,
            });
        }

        setSubmitting(true);
        try {
            const payload = {
                name: name.trim(),
                sku: sku.trim() || null,
                category_id: categoryId ? Number(categoryId) : null,
                price: priceNum,
                stock: stockNum,
                prices: pricesArray,
            };
            const { data } = await apiClient.post('/products/', payload);
            toast.success('Producto creado');
            onSuccess?.(data);
            onClose();
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'No se pudo crear el producto rapido'));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-lg w-[95vw] p-0 gap-0 flex flex-col overflow-hidden">
                <DialogHeader className="px-6 py-4 border-b border-slate-100 bg-white text-left space-y-0">
                    <DialogTitle className="flex items-center gap-2 text-base font-black text-slate-800">
                        <Zap className="text-amber-500" size={20} />
                        Nuevo producto rápido
                    </DialogTitle>
                    <DialogDescription className="text-slate-500 mt-1">
                        Solo lo esencial. Podés completar el resto después.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="flex-1">
                    <div className="px-6 py-5 space-y-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="qp-name">Nombre <span className="text-rose-500">*</span></Label>
                            <Input
                                id="qp-name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Ej: Cable USB-C 1m"
                                autoFocus
                                required
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="qp-sku">SKU</Label>
                            <Input
                                id="qp-sku"
                                value={sku}
                                onChange={(e) => setSku(e.target.value)}
                                placeholder="Opcional"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="qp-cat">Categoría</Label>
                            <select
                                id="qp-cat"
                                value={categoryId}
                                onChange={(e) => setCategoryId(e.target.value)}
                                disabled={loadingCategories}
                                className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none disabled:opacity-60"
                            >
                                <option value="">{loadingCategories ? 'Cargando…' : 'Sin categoría'}</option>
                                {categories.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="qp-price" className="flex items-center gap-1.5">
                                    Precio base (P. Mayor) <span className="text-rose-500">*</span>
                                </Label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">$</span>
                                    <Input
                                        id="qp-price"
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={price}
                                        onChange={(e) => setPrice(e.target.value)}
                                        placeholder="0.00"
                                        className="pl-7"
                                        required
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="qp-stock">Stock inicial</Label>
                                <Input
                                    id="qp-stock"
                                    type="number"
                                    step="0.001"
                                    min="0"
                                    value={stock}
                                    onChange={(e) => setStock(e.target.value)}
                                    placeholder="0"
                                />
                                <p className="text-[10px] text-slate-400">Se asigna a la bodega principal.</p>
                            </div>
                        </div>

                        {/* Lista de precio (opcional) */}
                        <div className="space-y-1.5 pt-1 border-t border-slate-100">
                            <Label htmlFor="qp-plist" className="flex items-center gap-1.5">
                                <Tag size={13} className="text-indigo-500" />
                                Lista de precio
                                <span className="text-[10px] text-slate-400 font-medium">(opcional)</span>
                            </Label>
                            <select
                                id="qp-plist"
                                value={selectedPriceListId}
                                onChange={(e) => {
                                    const v = e.target.value;
                                    setSelectedPriceListId(v);
                                    if (v && listPrice === '' && price !== '') {
                                        setListPrice(price);
                                    }
                                }}
                                disabled={loadingPriceLists}
                                className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none disabled:opacity-60"
                            >
                                <option value="">{loadingPriceLists ? 'Cargando…' : 'Sin lista'}</option>
                                {priceLists.map(pl => (
                                    <option key={pl.id} value={pl.id}>{pl.name}</option>
                                ))}
                            </select>
                            {selectedPriceListId && (
                                <div className="space-y-1.5 pt-1">
                                    <Label htmlFor="qp-lprice" className="text-xs text-slate-500 flex items-center justify-between">
                                        <span>Precio en esta lista</span>
                                        {listPrice !== '' && price !== '' && listPrice === price && (
                                            <span className="text-[10px] text-emerald-600 font-medium">= Precio base</span>
                                        )}
                                    </Label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">$</span>
                                        <Input
                                            id="qp-lprice"
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={listPrice}
                                            onChange={(e) => setListPrice(e.target.value)}
                                            placeholder={price ? `Igual al precio base (${price})` : '0.00'}
                                            className="pl-7"
                                        />
                                    </div>
                                    <p className="text-[10px] text-slate-400">
                                        Por defecto toma el mismo valor que P. Mayor. Modificalo si querés otro precio para esta lista.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                    <DialogFooter className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 gap-3">
                        <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>Cancelar</Button>
                        <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700" disabled={submitting}>
                            {submitting ? (
                                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creando…</>
                            ) : (
                                'Crear producto'
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default QuickProductCreateModal;
