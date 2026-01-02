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
const MultiCurrencyDisplay = ({ amountUSD = 0, showRate = true, size = 'md' }) => {
    const { getExchangeRate } = useConfig();

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
        <div className="space-y-1">
            {/* USD Amount (Primary) */}
            <div className={`${classes.usd} font-bold text-slate-800 tracking-tight`}>
                ${amountUSD.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                })}
            </div>

            {/* Bs Amount (Secondary) */}
            <div className={`${classes.bs} font-semibold text-slate-500`}>
                Bs {amountBs.toLocaleString('es-VE', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                })}
            </div>

            {/* Exchange Rate (Optional) */}
            {showRate && (
                <div className={`${classes.rate} text-slate-400 font-medium`}>
                    Tasa: {bsRate.toFixed(2)}
                </div>
            )}
        </div>
    );
};

export default MultiCurrencyDisplay;
