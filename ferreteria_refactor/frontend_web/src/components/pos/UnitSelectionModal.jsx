import { X, Package, Box } from 'lucide-react';
import { useConfig } from '../../context/ConfigContext';

const UnitSelectionModal = ({ isOpen, onClose, product, onSelect }) => {
    const { convertPrice, getActiveCurrencies } = useConfig();

    if (!isOpen || !product) return null;

    // Helper to format currency
    // Helper to format currency
    const formatPrice = (amount, symbol) => {
        const num = Number(amount);
        const decimals = Math.abs(num) < 1 && num !== 0 ? 4 : 2;
        return `${symbol} ${num.toLocaleString('es-VE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
    };

    const activeCurrencies = getActiveCurrencies();

    // Base Unit Option
    const baseOption = {
        name: product.unit || 'Unidad', // Original unit type
        price: product.price,
        price_usd: product.price, // FIX: Ensure price_usd is present for base unit
        factor: 1,
        id: null, // Null ID for base unit
        is_base: true
    };

    // Derived Options from Units
    const unitOptions = (product.units || []).map(u => {
        // Calculate price if not explicit
        const calculatedPrice = u.price_usd !== null && u.price_usd !== undefined && u.price_usd > 0
            ? u.price_usd
            : product.price * u.conversion_factor;

        return {
            unit_name: u.unit_name,
            name: u.unit_name,
            price_usd: u.price_usd, // Pass explicit price if exists
            price: calculatedPrice,
            conversion_factor: u.conversion_factor,
            factor: u.conversion_factor,
            exchange_rate_id: u.exchange_rate_id, // CRITICAL: Pass for hierarchy
            id: u.id,
            is_base: false,
            barcode: u.barcode
        };
    });

    // Combine all options
    const allOptions = [baseOption, ...unitOptions];

    return (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl transform transition-all scale-100 border border-slate-100">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-slate-100">
                    <div>
                        <h3 className="text-xl font-bold text-slate-800 flex items-center">
                            <Box className="mr-2 text-indigo-600" />
                            Seleccionar Presentación
                        </h3>
                        <p className="text-sm text-slate-500 mt-1">
                            Producto: <span className="font-semibold text-slate-700">{product.name}</span>
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Grid of Options */}
                <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto bg-slate-50/50">
                    {allOptions.map((opt, idx) => (
                        <button
                            key={idx}
                            onClick={() => onSelect(opt)}
                            className="relative flex flex-col items-start p-5 bg-white border border-slate-200 hover:border-indigo-500 rounded-xl shadow-sm hover:shadow-md transition-all group text-left w-full"
                        >
                            {/* Badge for Type */}
                            <span className={`absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${opt.is_base ? 'bg-slate-100 text-slate-600' : 'bg-indigo-50 text-indigo-600'
                                }`}>
                                {opt.is_base ? 'Estándar' : 'Presentación'}
                            </span>

                            {/* Name & Icon */}
                            <div className={`p-3 rounded-lg mb-3 ${opt.is_base ? 'bg-slate-100 text-slate-600' : 'bg-indigo-50 text-indigo-600'}`}>
                                <Package size={24} />
                            </div>

                            <h4 className="text-lg font-bold text-slate-800 group-hover:text-indigo-700">
                                {opt.name}
                            </h4>

                            {/* Price Primary */}
                            <div className="mt-2 text-2xl font-bold text-slate-900">
                                {formatPrice(opt.price, '$')}
                            </div>

                            {/* Secondary Currencies */}
                            <div className="mt-1 space-y-0.5">
                                {activeCurrencies.map(curr => {
                                    const val = convertPrice(opt.price, curr.symbol);
                                    return (
                                        <div key={curr.id} className="text-xs text-slate-500 font-medium">
                                            {formatPrice(val, curr.symbol)}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Factor Info */}
                            {!opt.is_base && (
                                <div className="mt-3 text-xs text-slate-400 border-t border-slate-100 pt-2 w-full">
                                    Factor: x{opt.factor}
                                </div>
                            )}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default UnitSelectionModal;
