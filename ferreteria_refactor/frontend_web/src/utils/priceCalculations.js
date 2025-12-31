/**
 * Helper function to calculate item price with correct exchange rate hierarchy
 * 
 * Hierarchy: Unit Rate > Product Rate > Global Default Rate
 * 
 * @param {Object} product - Product object with price and exchange_rate_id
 * @param {Object} unit - Unit object with conversion_factor, price_usd, and exchange_rate_id
 * @param {Array} globalRates - Array of all exchange rates from ConfigContext
 * @returns {Object} { priceUSD, rate, priceBS, rateName }
 */
export const calculateItemPrice = (product, unit, globalRates) => {
    // 1. Determine which exchange rate to use (Hierarchy)
    const unitRateId = unit?.exchange_rate_id;
    const productRateId = product?.exchange_rate_id;

    let selectedRate = globalRates.find(r => r.is_default); // Fallback to default

    // Apply hierarchy: Unit > Product > Default
    if (unitRateId) {
        const unitRate = globalRates.find(r => r.id === unitRateId);
        if (unitRate) selectedRate = unitRate;
    } else if (productRateId) {
        const productRate = globalRates.find(r => r.id === productRateId);
        if (productRate) selectedRate = productRate;
    }

    // 2. Determine Price in USD
    // If unit has specific price, use it; otherwise calculate from product price
    let priceUSD = 0;

    if (unit?.price_usd && unit.price_usd > 0) {
        // Unit has its own price
        priceUSD = parseFloat(unit.price_usd);
    } else {
        // Calculate from product price * conversion factor
        const basePrice = parseFloat(product?.price || 0);
        const conversionFactor = parseFloat(unit?.conversion_factor || 1);
        priceUSD = basePrice * conversionFactor;
    }

    // 3. Calculate Price in Bolívares (or other currency)
    const rate = parseFloat(selectedRate?.rate || 1);
    const priceBS = priceUSD * rate;

    // 4. Return complete pricing information
    return {
        priceUSD: priceUSD,
        priceBS: priceBS,
        rate: selectedRate,
        rateName: selectedRate?.name || 'Default',
        rateValue: rate,
        isSpecialRate: !selectedRate?.is_default, // Flag for visual indicator
        source: unitRateId ? 'unit' : (productRateId ? 'product' : 'default')
    };
};

/**
 * Example usage in POS.jsx:
 * 
 * const handleUnitSelect = (product, selectedUnit) => {
 *     const { exchangeRates } = useConfig();
 *     
 *     const pricing = calculateItemPrice(product, selectedUnit, exchangeRates);
 *     
 *     addToCart({
 *         product_id: product.id,
 *         name: product.name,
 *         unit_name: selectedUnit.unit_name,
 *         quantity: 1,
 *         price_usd: pricing.priceUSD,
 *         price_bs: pricing.priceBS,
 *         exchange_rate_id: pricing.rate.id,
 *         exchange_rate_name: pricing.rateName,
 *         is_special_rate: pricing.isSpecialRate,
 *         conversion_factor: selectedUnit.conversion_factor
 *     });
 * };
 */
