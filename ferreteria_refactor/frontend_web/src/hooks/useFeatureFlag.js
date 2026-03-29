import { useConfig } from '../context/ConfigContext';

/**
 * Retorna true si el feature flag está activo para este tenant.
 *
 * Uso:
 *   const tieneDescuento = useFeatureFlag('descuento_especial');
 *   if (!tieneDescuento) return null;
 */
export const useFeatureFlag = (flagName) => {
    const { featureFlags } = useConfig();
    return featureFlags?.[flagName] === true;
};
