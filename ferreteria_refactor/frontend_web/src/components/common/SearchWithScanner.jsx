import { useState, forwardRef } from 'react';
import { Search, ScanBarcode } from 'lucide-react';
import { cn } from '../../utils/cn';
import BarcodeScannerComponent from './BarcodeScanner';

const SearchWithScanner = forwardRef(({
    value,
    onChange,
    onSearch, // Opción para manejar "Enter" o búsqueda explícita
    placeholder = "Buscar productos...",
    className,
    inputClassName,
    autoFocus = false,
    id
}, ref) => {
    const [isScanning, setIsScanning] = useState(false);

    // Manejo híbrido: si se pasa 'value' es controlado, si no, usa estado local (aunque para este caso de uso asumimos controlado)
    // Pero simplicaremos asumiendo que siempre recibe value/onChange para el caso de POS/Products.

    const handleScanResult = (code) => {
        if (onChange) onChange(code);
        if (onSearch) onSearch(code);
        setIsScanning(false);
    };

    return (
        <div id={id} className={cn("relative w-full", className)}>
            <div className="relative flex items-center">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10">
                    <Search size={18} className="opacity-50" />
                </div>

                <input
                    ref={ref}
                    type="text"
                    value={value}
                    onChange={(e) => onChange && onChange(e.target.value)}
                    placeholder={placeholder}
                    autoFocus={autoFocus}
                    className={cn(
                        "w-full pl-10 pr-12 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm shadow-sm",
                        inputClassName
                    )}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && onSearch) {
                            e.preventDefault();
                            onSearch(value);
                        }
                    }}
                />

                <button
                    type="button"
                    onClick={() => setIsScanning(true)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors z-10"
                    title="Escanear código de barras"
                >
                    <ScanBarcode size={20} />
                </button>
            </div>

            {isScanning && (
                <BarcodeScannerComponent
                    onScanned={handleScanResult}
                    onClose={() => setIsScanning(false)}
                />
            )}
        </div>
    );
});

SearchWithScanner.displayName = 'SearchWithScanner';

export default SearchWithScanner;
