import { useState, useEffect } from 'react';
import { Trash2, Save, X, DollarSign, Hash } from 'lucide-react';
import { useConfig } from '../../context/ConfigContext';

const EditItemModal = ({ isOpen, onClose, item, onUpdate, onDelete }) => {
    const [quantity, setQuantity] = useState(1);
    const [quantityInput, setQuantityInput] = useState('1'); // String for input
    const [saleMode, setSaleMode] = useState('quantity'); // 'quantity' | 'amount'
    const [amountInput, setAmountInput] = useState(''); // User input as string
    const [selectedCurrency, setSelectedCurrency] = useState('VES'); // Default to VES

    const { currencies } = useConfig();

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
            const qty = item.quantity;
            setQuantity(qty);
            setQuantityInput(parseFloat(qty.toFixed(3)).toString()); // Format to 3 decimals

            // Calculate initial amount based on quantity
            const initialAmount = qty * item.unit_price_usd;

            // Convert to selected currency
            const rate = item?.exchange_rate || 1;
            const amountInCurrency = selectedCurrency === 'USD' ? initialAmount : initialAmount * rate;

            setAmountInput(amountInCurrency.toFixed(2));
            setSaleMode('quantity'); // Always start in quantity mode
        }
    }, [item, selectedCurrency]);

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
        setAmountInput(displayAmount.toFixed(2));
    };

    const handleCurrencyChange = (newCurrency) => {
        // Convert current amount to new currency
        const currentAmountUSD = convertToUSD(parseFloat(amountInput) || 0, selectedCurrency);
        const newAmount = convertFromUSD(currentAmountUSD, newCurrency);

        setSelectedCurrency(newCurrency);
        setAmountInput(newAmount.toFixed(2));
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
                    <h3 className="text-xl font-bold text-gray-800">Editar Item</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={24} />
                    </button>
                </div>

                {/* Product Info */}
                <div className="text-center mb-6 pb-4 border-b">
                    <h4 className="font-bold text-gray-800 text-lg">{item.name}</h4>
                    <div className="flex items-center justify-center gap-2 mt-2">
                        <span className="text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-semibold">
                            {item.unit_name}
                        </span>
                        <span className="text-sm text-gray-500">
                            ${item.unit_price_usd.toFixed(4)}/{item.unit_name}
                        </span>
                    </div>
                </div>

                {/* Mode Toggle (Only for fractions) */}
                {isFraction && (
                    <div className="mb-6">
                        <div className="grid grid-cols-2 gap-2 bg-gray-100 p-1 rounded-lg">
                            <button
                                onClick={() => setSaleMode('quantity')}
                                className={`py-2 px-4 rounded-md font-semibold transition-all flex items-center justify-center gap-2 ${saleMode === 'quantity'
                                    ? 'bg-white text-blue-600 shadow-sm'
                                    : 'text-gray-600 hover:text-gray-800'
                                    }`}
                            >
                                <Hash size={18} />
                                Por Cantidad
                            </button>
                            <button
                                onClick={() => setSaleMode('amount')}
                                className={`py-2 px-4 rounded-md font-semibold transition-all flex items-center justify-center gap-2 ${saleMode === 'amount'
                                    ? 'bg-white text-green-600 shadow-sm'
                                    : 'text-gray-600 hover:text-gray-800'
                                    }`}
                            >
                                <DollarSign size={18} />
                                Por Monto
                            </button>
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
                                className="text-center text-5xl font-bold border-b-4 border-blue-500 w-full focus:outline-none focus:border-blue-600 py-2"
                                value={quantityInput}
                                onChange={(e) => handleQuantityInputChange(e.target.value)}
                                onFocus={(e) => e.target.select()}
                                autoFocus
                            />
                            <div className="text-center text-sm text-gray-500 mt-2">
                                Total: {currencySymbol}{totalAmount.toFixed(2)}
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
                                        <button
                                            key={curr.currency_code}
                                            onClick={() => handleCurrencyChange(curr.currency_code)}
                                            className={`px-3 py-1 rounded-full text-sm font-bold transition-all ${selectedCurrency === curr.currency_code
                                                ? 'bg-green-600 text-white'
                                                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                                                }`}
                                        >
                                            {curr.symbol} {curr.currency_code}
                                        </button>
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
                        ⚠️ Stock insuficiente (Disponible: {item.stock})
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                    <button
                        onClick={() => { onDelete(item.id); onClose(); }}
                        className="flex-1 bg-red-100 text-red-600 py-3 rounded-xl font-bold hover:bg-red-200 transition-all flex justify-center items-center"
                    >
                        <Trash2 size={20} className="mr-2" /> Eliminar
                    </button>
                    <button
                        onClick={() => { onUpdate(item.id, quantity); onClose(); }}
                        className="flex-[2] bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-all flex justify-center items-center shadow-lg"
                    >
                        <Save size={20} className="mr-2" /> Actualizar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EditItemModal;
