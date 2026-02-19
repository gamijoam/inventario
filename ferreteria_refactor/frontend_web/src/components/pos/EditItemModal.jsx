import { useState, useEffect } from 'react';
import { Trash2, Save, X, DollarSign, Hash, Tag } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useConfig } from '../../context/ConfigContext';

const formatLocalCurrency = (amount, decimals = 2) => {
    try {
        return new Intl.NumberFormat('de-DE', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        }).format(amount);
    } catch (error) {
        return amount.toFixed(decimals);
    }
};

const EditItemModal = ({ isOpen, onClose, item, onUpdate, onDelete, priceLists = [], onPriceListSelect }) => {
    const [quantity, setQuantity] = useState(1);
    const [quantityInput, setQuantityInput] = useState('1');
    const [saleMode, setSaleMode] = useState('quantity');
    const [amountInput, setAmountInput] = useState('');
    const [selectedCurrency, setSelectedCurrency] = useState('VES');
    const [priceListId, setPriceListId] = useState(null);
    const [price, setPrice] = useState(0);

    const { currencies, modules } = useConfig();

    // Get unique active currencies (deduplicate by currency_code)
    const getUniqueCurrencies = () => {
        if (!Array.isArray(currencies)) return [];

        const uniqueMap = {};

        // Always include USD
        uniqueMap['USD'] = {
            currency_code: 'USD',
            symbol: '$',
            name: 'Dólar'
        };

        // Add active currencies
        currencies.filter(c => c.is_active).forEach(curr => {
            const code = curr.currency_code?.trim().toUpperCase();
            if (code && code !== 'USD') { // Don't duplicate USD
                uniqueMap[code] = {
                    currency_code: code,
                    symbol: curr.currency_symbol || curr.symbol || '$',
                    name: curr.name || code
                };
            }
        });

        return Object.values(uniqueMap);
    };

    const activeCurrencies = getUniqueCurrencies();

    // Detect if item is a fraction (conversion_factor < 1)
    const isFraction = item?.conversion_factor < 1;

    // Initialize currency on mount
    useEffect(() => {
        if (activeCurrencies.length > 0) {
            setSelectedCurrency(activeCurrencies[0].currency_code);
        }
    }, []);

    useEffect(() => {
        if (item) {
            const qty = Number(item.quantity || 0);
            setQuantity(qty);
            setQuantityInput(parseFloat(qty.toFixed(3)).toString());

            // Calculate initial amount based on quantity
            const initialAmount = qty * item.unit_price_usd;

            // Convert to selected currency
            const rate = item?.exchange_rate || 1;
            const amountInCurrency = selectedCurrency === 'USD' ? initialAmount : initialAmount * rate;

            setAmountInput(amountInCurrency.toFixed(2));
            setSaleMode('quantity'); // Always start in quantity mode

            setPriceListId(item.price_list_id || null);
            setPrice(item.unit_price_usd || 0);
        }
    }, [item, selectedCurrency]);

    // Handle Price List Change - delegates to POS-level logic which handles price lookup + PIN auth
    const handlePriceListChange = (listIdStr) => {
        if (listIdStr === 'default') {
            setPriceListId(null);
            // Revert to base unit price
            if (onPriceListSelect) {
                onPriceListSelect(null, item);
            }
            return;
        }
        const listId = parseInt(listIdStr);
        const list = priceLists.find(l => l.id === listId);
        if (!list) return;
        if (onPriceListSelect) {
            // POS handles price lookup, PIN auth, and cart update
            // We close the modal so POS PIN modal can appear on top
            onClose();
            onPriceListSelect(list, item);
        } else {
            // Fallback: just update the price_list_id without price change
            setPriceListId(listId);
        }
    };

    // Calculate quantity from amount (in USD)
    const calculateQuantityFromUSD = (amountUSD) => {
        if (item && item.unit_price_usd > 0) {
            return amountUSD / item.unit_price_usd;
        }
        return 0;
    };

    // Convert amount between currencies using item's rate
    const convertToUSD = (amount, currencyCode) => {
        if (currencyCode === 'USD') return amount;

        // Use item's exchange rate (already resolved from product/unit)
        const rate = item?.exchange_rate || 1;
        return amount / rate;
    };

    const convertFromUSD = (amountUSD, currencyCode) => {
        if (currencyCode === 'USD') return amountUSD;

        const rate = item?.exchange_rate || 1;
        return amountUSD * rate;
    };

    const handleAmountInputChange = (value) => {
        setAmountInput(value);
        const numValue = parseFloat(value) || 0;

        // Convert to USD first
        const amountUSD = convertToUSD(numValue, selectedCurrency);

        // Calculate quantity
        const newQty = calculateQuantityFromUSD(amountUSD);
        setQuantity(newQty);
    };

    const handleQuantityInputChange = (value) => {
        // Normalize comma to period
        const normalizedValue = value.replace(',', '.');
        setQuantityInput(normalizedValue);

        const numValue = parseFloat(normalizedValue) || 0;
        setQuantity(numValue);

        // Calculate amount in USD
        const amountUSD = (item?.unit_price_usd || 0) * numValue;

        // Convert to selected currency
        const displayAmount = convertFromUSD(amountUSD, selectedCurrency);
        setAmountInput(Number(displayAmount || 0).toFixed(2));
    };

    const handleCurrencyChange = (newCurrency) => {
        // Convert current amount to new currency
        const currentAmountUSD = convertToUSD(parseFloat(amountInput) || 0, selectedCurrency);
        const newAmount = convertFromUSD(currentAmountUSD, newCurrency);

        setSelectedCurrency(newCurrency);
        setAmountInput(Number(newAmount || 0).toFixed(2));
    };

    if (!isOpen || !item) return null;

    const currentCurrency = activeCurrencies.find(c => c.currency_code === selectedCurrency);
    const currencySymbol = currentCurrency?.symbol || '$';
    const totalAmount = convertFromUSD((item.unit_price_usd || 0) * quantity, selectedCurrency);

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-fade-in-up">
                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-slate-800">Editar Item</h3>
                    <Button variant="ghost" size="icon" onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X size={24} />
                    </Button>
                </div>

                {/* Product Info */}
                <div className="text-center mb-6 pb-4 border-b">
                    <h4 className="font-bold text-gray-800 text-lg">{item.name}</h4>
                    <div className="flex items-center justify-center gap-2 mt-2">
                        <span className="text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-semibold">
                            {item.unit_name}
                        </span>
                        <span className="text-sm text-gray-400 font-medium">
                            ${formatLocalCurrency(item.unit_price_usd || 0, 4)} / {item.unit_name}
                        </span>
                    </div>
                </div>

                {/* Mode Toggle (Only for fractions) */}
                {isFraction && (
                    <div className="mb-6">
                        <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                            <Button
                                variant={saleMode === 'quantity' ? 'default' : 'ghost'}
                                onClick={() => setSaleMode('quantity')}
                                className={`h-9 font-bold transition-all ${saleMode === 'quantity'
                                    ? 'bg-white text-indigo-600 shadow-sm hover:bg-white hover:text-indigo-700'
                                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                                    }`}
                            >
                                <Hash size={16} className="mr-2" />
                                Por Cantidad
                            </Button>
                            <Button
                                variant={saleMode === 'amount' ? 'default' : 'ghost'}
                                onClick={() => setSaleMode('amount')}
                                className={`h-9 font-bold transition-all ${saleMode === 'amount'
                                    ? 'bg-white text-emerald-600 shadow-sm hover:bg-white hover:text-emerald-700'
                                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                                    }`}
                            >
                                <DollarSign size={16} className="mr-2" />
                                Por Monto
                            </Button>
                        </div>
                    </div>
                )}

                {/* Input Section */}
                <div className="mb-6">
                    {saleMode === 'quantity' ? (
                        // Quantity Mode
                        <div className="space-y-3">
                            <label className="block text-sm font-bold text-gray-600 text-center">
                                Cantidad ({item.unit_name})
                            </label>
                            <input
                                type="text"
                                inputMode="decimal"
                                className="text-center text-5xl font-bold bg-transparent border-b-4 border-indigo-500 w-full focus:outline-none focus:border-indigo-600 py-2 text-slate-800 placeholder-slate-300 disabled:text-slate-400 disabled:border-slate-300"
                                value={quantityInput}
                                onChange={(e) => handleQuantityInputChange(e.target.value)}
                                onFocus={(e) => e.target.select()}
                                autoFocus={!item.has_imei}
                                disabled={item.has_imei}
                            />
                            {item.has_imei && (
                                <p className="text-xs text-center text-amber-600 font-bold bg-amber-50 p-2 rounded-lg">
                                    ⚠️ Items serializados no pueden cambiar cantidad aquí. Escanee o elimine individualmente.
                                </p>
                            )}
                            <div className="text-center text-xs font-black text-blue-600 bg-blue-50 py-2 rounded-xl border border-blue-100/50 mt-4">
                                TOTAL: {currencySymbol}{formatLocalCurrency(totalAmount)}
                            </div>
                        </div>
                    ) : (
                        // Amount Mode
                        <div className="space-y-3">
                            <label className="block text-sm font-bold text-gray-600 text-center">
                                Monto a Vender
                            </label>

                            {/* Currency Selector */}
                            {activeCurrencies.length > 1 && (
                                <div className="flex justify-center gap-2 mb-3">
                                    {activeCurrencies.map(curr => (
                                        <Button
                                            key={curr.currency_code}
                                            size="sm"
                                            variant={selectedCurrency === curr.currency_code ? "default" : "outline"}
                                            onClick={() => handleCurrencyChange(curr.currency_code)}
                                            className={`rounded-full h-7 text-xs font-bold px-3 ${selectedCurrency === curr.currency_code
                                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-transparent'
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-200'
                                                }`}
                                        >
                                            {curr.symbol} {curr.currency_code}
                                        </Button>
                                    ))}
                                </div>
                            )}

                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-4xl font-bold text-gray-400">
                                    {currencySymbol}
                                </span>
                                <input
                                    type="number"
                                    step="0.01"
                                    className="text-center text-5xl font-bold border-b-4 border-green-500 w-full focus:outline-none focus:border-green-600 py-2 pl-16"
                                    value={amountInput}
                                    onChange={(e) => handleAmountInputChange(e.target.value)}
                                    autoFocus
                                />
                            </div>

                            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-3">
                                <div className="text-center">
                                    <span className="text-xs text-green-700 font-semibold uppercase">Cantidad Calculada</span>
                                    <div className="text-2xl font-bold text-green-800 mt-1">
                                        {parseFloat(quantity.toFixed(3))} {item.unit_name}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Stock Warning */}
                {quantity * (item.conversion_factor || 1) > item.stock && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg mb-4 text-sm text-center">
                        ⚠️ Stock insuficiente (Disponible: {Number(item.stock)})
                    </div>
                )}

                {/* Price List Selector */}
                {modules?.services && (
                    <div className="mb-6 space-y-1.5">
                        <Label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5">
                            <Tag size={12} />
                            Lista de Precio
                        </Label>
                        <div className="grid grid-cols-1 gap-2">
                            {/* Base Price option */}
                            <button
                                onClick={() => handlePriceListChange('default')}
                                className={`flex items-center justify-between px-4 py-2.5 rounded-xl border text-sm font-bold transition-all ${!priceListId
                                    ? 'border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500'
                                    : 'border-slate-200 hover:border-slate-300 text-slate-600 hover:bg-slate-50'
                                    }`}
                            >
                                <span>Precio Base</span>
                                {!priceListId && <span className="text-[10px] font-black bg-blue-500 text-white px-2 py-0.5 rounded-full">ACTIVO</span>}
                            </button>
                            {/* Other price lists */}
                            {priceLists.map(l => (
                                <button
                                    key={l.id}
                                    onClick={() => handlePriceListChange(l.id.toString())}
                                    className={`flex items-center justify-between px-4 py-2.5 rounded-xl border text-sm font-bold transition-all ${priceListId === l.id
                                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-500'
                                        : 'border-slate-200 hover:border-slate-300 text-slate-600 hover:bg-slate-50'
                                        }`}
                                >
                                    <span>{l.name}</span>
                                    <span className="flex items-center gap-1.5">
                                        {l.requires_auth && (
                                            <span className="text-[9px] font-black bg-amber-500 text-white px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                                                🔒 PIN
                                            </span>
                                        )}
                                        {priceListId === l.id && <span className="text-[10px] font-black bg-indigo-500 text-white px-2 py-0.5 rounded-full">ACTIVO</span>}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                    <Button
                        variant="destructive"
                        onClick={() => { onDelete(item.id); onClose(); }}
                        className="flex-1 h-12 rounded-xl font-bold hover:bg-rose-600/90 text-white shadow-md hover:shadow-lg"
                    >
                        <Trash2 size={20} className="mr-2" /> Eliminar
                    </Button>
                    <Button
                        onClick={() => {
                            onUpdate(item.id, quantity);
                            onClose();
                        }}
                        className="flex-[2] h-12 bg-blue-600 text-white rounded-xl font-black uppercase tracking-widest hover:bg-blue-700 shadow-lg shadow-blue-500/30 hover:-translate-y-1 transition-all"
                    >
                        <Save size={18} className="mr-2" /> Actualizar
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default EditItemModal;
