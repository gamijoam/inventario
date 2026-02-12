import { useConfig } from '../../context/ConfigContext';

/**
 * MultiCurrencyDisplay Component
 * 
 * Displays an amount in both USD and local currency (Bs) with exchange rate
 * 
 * @param {number} amountUSD - Amount in USD
 * @param {boolean} showRate - Whether to show the exchange rate (default: true)
 * @param {string} size - Size variant: 'sm', 'md', 'lg' (default: 'md')
 */
const MultiCurrencyDisplay = ({ amountUSD = 0, showRate = true, size = 'md', placeholderIfZero = false }) => {
    const { getExchangeRate } = useConfig();

    if (placeholderIfZero && amountUSD === 0) {
        return <div className="text-slate-300 font-bold">—</div>
    }

    // Get current Bs exchange rate
    const bsRate = getExchangeRate('Bs') || getExchangeRate('VES') || 1;
    const amountBs = amountUSD * bsRate;

    // Size variants
    const sizeClasses = {
        sm: {
            usd: 'text-xl',
            bs: 'text-sm',
            rate: 'text-[10px]'
        },
        md: {
            usd: 'text-3xl',
            bs: 'text-lg',
            rate: 'text-xs'
        },
        lg: {
            usd: 'text-4xl',
            bs: 'text-xl',
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

            {/* Bs Amount (Secondary) */}
            <div className={`${classes.bs} font-bold text-emerald-600/80 font-mono`}>
                <span className="text-[0.7em] opacity-60 mr-0.5">Bs</span>
                {amountBs.toLocaleString('es-VE', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                })}
            </div>

            {/* Exchange Rate (Optional) */}
            {showRate && (
                <div className={`${classes.rate} inline-block bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 font-bold uppercase tracking-tighter`}>
                    Tasa: {bsRate.toFixed(2)}
                </div>
            )}
        </div>
    );
};

export default MultiCurrencyDisplay;
