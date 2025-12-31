import { X, Package, Box } from 'lucide-react';
import { useConfig } from '../../context/ConfigContext';

const UnitSelectionModal = ({ isOpen, onClose, product, onSelect }) => {
    const { convertPrice, getActiveCurrencies } = useConfig();

    if (!isOpen || !product) return null;

    // Helper to format currency
    const formatPrice = (amount, symbol) => {
        return `${symbol} ${amount.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const activeCurrencies = getActiveCurrencies();

    // Base Unit Option
    const baseOption = {
        name: product.unit || 'Unidad', // Original unit type
        price: product.price,
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
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl transform transition-all scale-100">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b">
                    <div>
                        <h3 className="text-xl font-bold text-gray-800 flex items-center">
                            <Box className="mr-2 text-blue-600" />
                            Seleccionar Presentación
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">
                            Producto: <span className="font-semibold text-gray-700">{product.name}</span>
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Grid of Options */}
                <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto bg-gray-50">
                    {allOptions.map((opt, idx) => (
                        <button
                            key={idx}
                            onClick={() => onSelect(opt)}
                            className="relative flex flex-col items-start p-5 bg-white border-2 border-transparent hover:border-blue-500 rounded-xl shadow-sm hover:shadow-md transition-all group text-left w-full"
                        >
                            {/* Badge for Type */}
                            <span className={`absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${opt.is_base ? 'bg-gray-100 text-gray-600' : 'bg-blue-100 text-blue-600'
                                }`}>
                                {opt.is_base ? 'Estándar' : 'Presentación'}
                            </span>

                            {/* Name & Icon */}
                            <div className={`p-3 rounded-lg mb-3 ${opt.is_base ? 'bg-gray-100 text-gray-600' : 'bg-blue-50 text-blue-600'}`}>
                                <Package size={24} />
                            </div>

                            <h4 className="text-lg font-bold text-gray-800 group-hover:text-blue-700">
                                {opt.name}
                            </h4>

                            {/* Price Primary */}
                            <div className="mt-2 text-2xl font-bold text-gray-900">
                                ${Number(opt.price).toFixed(2)}
                            </div>

                            {/* Secondary Currencies */}
                            <div className="mt-1 space-y-0.5">
                                {activeCurrencies.map(curr => {
                                    const val = convertPrice(opt.price, curr.symbol);
                                    return (
                                        <div key={curr.id} className="text-xs text-gray-500 font-medium">
                                            {formatPrice(val, curr.symbol)}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Factor Info */}
                            {!opt.is_base && (
                                <div className="mt-3 text-xs text-gray-400 border-t pt-2 w-full">
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
