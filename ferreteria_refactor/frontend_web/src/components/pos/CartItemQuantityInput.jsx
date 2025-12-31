import { useState, useEffect } from 'react';
import { Plus, Minus } from 'lucide-react';

const CartItemQuantityInput = ({ quantity, onUpdate, unitName, min = 1 }) => {
    const [localValue, setLocalValue] = useState(quantity);

    useEffect(() => {
        setLocalValue(quantity);
    }, [quantity]);

    const handleBlur = () => {
        let val = parseFloat(localValue);
        if (isNaN(val) || val < 0) val = 0; // Allow 0 to potentially trigger remove if parent handles it
        // Or if logic dictates min 1, set to 1.
        // Assuming parent handles "0" as remove.

        onUpdate(val);
        // Force sync formatted
        // setLocalValue(val); // Optional, parent update will trigger useEffect
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.target.blur();
        }
    };

    const updateDirect = (val) => {
        onUpdate(val);
    };

    return (
        <div
            className="flex items-center bg-gray-100 rounded-lg p-0.5"
            onClick={(e) => e.stopPropagation()}
        >
            <button
                onClick={() => updateDirect(Number(quantity) - 1)}
                className="p-1 hover:bg-white rounded shadow-sm transition-all text-slate-500 hover:text-red-500 disabled:opacity-50"
                disabled={Number(quantity) <= min && min > 0} // Only disable if strictly limited, but usually 0 removes.
            // If we want to allow 0 (remove):
            // disabled={false} 
            >
                <Minus size={12} />
            </button>
            <input
                type="text"
                inputMode="decimal"
                value={localValue}
                onChange={(e) => setLocalValue(e.target.value)}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                className="w-12 text-center text-xs font-bold bg-transparent border-none focus:ring-0 p-0 text-slate-700"
            />
            <button
                onClick={() => updateDirect(Number(quantity) + 1)}
                className="p-1 hover:bg-white rounded shadow-sm transition-all text-slate-500 hover:text-green-600"
            >
                <Plus size={12} />
            </button>
        </div>
    );
};

export default CartItemQuantityInput;
