import { useConfig } from '../../context/ConfigContext';

/**
 * MultiCurrencyDisplay Component
 *
 * Displays an amount in both USD and the active local currency (Bs, COP, etc.)
 * with exchange rate. Dynamically detects the primary local currency from config.
 * Falls back to Bs/VES if no local currency is configured.
 *
 * @param {number} amountUSD - Amount in USD
 * @param {boolean} showRate - Whether to show the exchange rate (default: true)
 * @param {string} size - Size variant: 'sm', 'md', 'lg' (default: 'md')
 */
const MultiCurrencyDisplay = ({ amountUSD = 0, showRate = true, size = 'md', placeholderIfZero = false }) => {
    const { getExchangeRate, getPrimaryLocalCurrency } = useConfig();

    if (placeholderIfZero && amountUSD === 0) {
        return <div className="text-slate-300 font-bold">—</div>
    }

    // Detect the active primary local currency dynamically
    // Falls back to Bs/VES for backward compatibility
    const localCurrency = getPrimaryLocalCurrency();
    const localSymbol = localCurrency?.currency_symbol || localCurrency?.symbol || 'Bs';
    const localCode = localCurrency?.currency_code || 'VES';

    // Resolve the exchange rate: try symbol first, then currency code, then hardcoded Bs/VES fallback
    const localRate = localCurrency
        ? (parseFloat(localCurrency.rate) || getExchangeRate(localSymbol) || getExchangeRate(localCode) || 1)
        : (getExchangeRate('Bs') || getExchangeRate('VES') || 1);

    const amountLocal = amountUSD * localRate;

    // Choose locale for formatting based on currency
    // Comma-decimal currencies (VES, COP, EUR) use 'es-VE' style
    const usesCommaDecimal = ['Bs', 'VES', 'COP', 'EUR'].includes(localSymbol) || ['VES', 'COP', 'EUR'].includes(localCode);
    const formatLocale = usesCommaDecimal ? 'es-VE' : 'en-US';

    // Size variants
    const sizeClasses = {
        sm: {
            usd: 'text-xl',
            local: 'text-sm',
            rate: 'text-[10px]'
        },
        md: {
            usd: 'text-3xl',
            local: 'text-lg',
            rate: 'text-xs'
        },
        lg: {
            usd: 'text-4xl',
            local: 'text-xl',
            rate: 'text-sm'
        }
    };

    const classes = sizeClasses[size] || sizeClasses.md;

    return (
        <div className="space-y-0.5">
            {/* USD Amount (Primary) */}
            <div className={`${classes.usd} font-black text-slate-900 tracking-tighter`}>
                ${amountUSD.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                })}
            </div>

            {/* Local Currency Amount (Secondary) */}
            <div className={`${classes.local} font-bold text-emerald-600/80 font-mono`}>
                <span className="text-[0.7em] opacity-60 mr-0.5">{localSymbol}</span>
                {amountLocal.toLocaleString(formatLocale, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                })}
            </div>

            {/* Exchange Rate (Optional) */}
            {showRate && (
                <div className={`${classes.rate} inline-block bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 font-bold uppercase tracking-tighter`}>
                    Tasa: {localRate.toFixed(2)}
                </div>
            )}
        </div>
    );
};

export default MultiCurrencyDisplay;
