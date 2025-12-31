import { useState, useEffect, useRef } from 'react';

const CurrencyInput = ({ value, onChange, currencySymbol, placeholder, className, autoFocus }) => {
    // Determine configuration based on currency
    // USD: 1,234.56 (Decimal: '.', Thousands: ',')
    // VES: 1.234,56 (Decimal: ',', Thousands: '.')
    const isVES = currencySymbol === 'Bs';
    const decimalSeparator = isVES ? ',' : '.';
    const thousandsSeparator = isVES ? '.' : ',';

    const [displayValue, setDisplayValue] = useState('');
    const inputRef = useRef(null);

    // Sync external value changes to display value
    useEffect(() => {
        if (value === '' || value === null || value === undefined) {
            setDisplayValue('');
            return;
        }

        // Don't overwrite if the user is currently typing (handy for decimals)
        // But we need to format initial values or values changed by other logic (e.g. "Complete" button)
        // We compare the parsed display value with the prop value
        const currentRaw = parse(displayValue);
        if (currentRaw !== parseFloat(value)) {
            setDisplayValue(format(value));
        }
    }, [value, currencySymbol]);

    const format = (val) => {
        if (val === '' || val === undefined || val === null) return '';

        // Split integer and decimal parts
        let parts = val.toString().split('.');
        let integerPart = parts[0];
        let decimalPart = parts.length > 1 ? parts[1] : '';

        // Add thousands separators to integer part
        integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, thousandsSeparator);

        // Reassemble
        if (parts.length > 1) {
            return `${integerPart}${decimalSeparator}${decimalPart}`;
        } else {
            return integerPart;
        }
    };

    const parse = (str) => {
        if (!str) return 0;
        // Remove thousands separators
        let clean = str.split(thousandsSeparator).join('');
        // Replace decimal separator with dot
        clean = clean.replace(decimalSeparator, '.');
        return parseFloat(clean);
    };

    const handleChange = (e) => {
        let newValue = e.target.value;

        // Allow only valid characters: digits, decimal separator
        const regex = isVES ? /^[0-9.,]*$/ : /^[0-9.,]*$/;
        if (!regex.test(newValue)) return;

        // Handle raw input logic to allow typing
        // We only enforce formatting on the integer part while typing, 
        // and allow the decimal separator to sit there.

        // 1. Normalize input for parsing
        // Replace the "other" separator if user typed it by mistake? 
        // For now, assume strictness or auto-correction

        // Remove all non-numeric and non-decimal-separator chars
        let cleanInput = newValue;

        // Count separators to prevent multiple decimals
        const separatorCount = (cleanInput.match(new RegExp(`\\${decimalSeparator}`, 'g')) || []).length;
        if (separatorCount > 1) return; // Prevent 1.2.3

        // Clean for raw value calculation
        let rawStr = cleanInput.split(thousandsSeparator).join('').replace(decimalSeparator, '.');

        // If it ends with decimal separator, we keep it in display but don't parse fully yet
        // Update parent with current parsed float (or raw string if needed?)
        // Usually parents expect a number. 

        const rawNum = parseFloat(rawStr);

        // Update Local Display immediately to allow valid characters
        // We do a "Smart Format" that respects the cursor position?
        // Basic version: Just update display to exactly what user typed if it's valid, 
        // OR re-format entire string. Re-formatting forces thousands separators.

        // Re-formatting algorithm:
        // 1. Strip non-digits (keep decimal)
        // 2. Re-insert thousands

        let digitsOnly = cleanInput.replace(/\D/g, '');

        // Check if we are in "decimal mode"
        const hasDecimal = cleanInput.includes(decimalSeparator);

        let intPart = '';
        let fracPart = '';

        if (hasDecimal) {
            const parts = cleanInput.split(decimalSeparator);
            intPart = parts[0].replace(/\D/g, '');
            fracPart = parts[1].replace(/\D/g, ''); // Enforce only digits in fractional
        } else {
            intPart = digitsOnly;
        }

        // Format integer part
        const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, thousandsSeparator);

        let finalDisplay = formattedInt;
        if (hasDecimal) {
            finalDisplay += decimalSeparator + fracPart;
        }

        setDisplayValue(finalDisplay);

        // Send up to parent
        // Handle edge case: "12." -> raw number is 12
        if (isNaN(rawNum)) {
            onChange('');
        } else {
            onChange(rawStr); // Pass string so we don't lose trailing zeros or precision context if needed, but standard is number
        }
    };

    return (
        <input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            value={displayValue}
            onChange={handleChange}
            placeholder={placeholder}
            className={className}
            autoFocus={autoFocus}
        />
    );
};

export default CurrencyInput;
