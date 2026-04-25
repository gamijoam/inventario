import { renderHook, act } from '@testing-library/react';
import { useServiceValidation, useServiceCalculations } from '../hooks/useServiceOrder';

describe('useServiceValidation Hook', () => {
    test('validateCustomer should require name', () => {
        const { result } = renderHook(() => useServiceValidation());
        const validation = result.current.validateCustomer({ name: '' });
        expect(validation.valid).toBe(false);
        expect(validation.error).toBe('Nombre de cliente es requerido');
    });

    test('validateCustomer should pass with valid name', () => {
        const { result } = renderHook(() => useServiceValidation());
        const validation = result.current.validateCustomer({ name: 'Juan' });
        expect(validation.valid).toBe(true);
    });

    test('validateEquipment should require brand and model', () => {
        const { result } = renderHook(() => useServiceValidation());
        const validation = result.current.validateEquipment({
            brand: 'Samsung',
            model: ''
        });
        expect(validation.valid).toBe(false);
        expect(validation.errors).toContain('Modelo requerido');
    });

    test('validateDiagnosis should require text', () => {
        const { result } = renderHook(() => useServiceValidation());
        const validation = result.current.validateDiagnosis({
            problem_description: ''
        });
        expect(validation.valid).toBe(false);
    });

    test('validateDiagnosis should fail on short text', () => {
        const { result } = renderHook(() => useServiceValidation());
        const validation = result.current.validateDiagnosis({
            problem_description: 'Corto'
        });
        expect(validation.valid).toBe(false);
    });

    test('validateItem should require price > 0', () => {
        const { result } = renderHook(() => useServiceValidation());
        const validation = result.current.validateItem({
            product_id: 1,
            unit_price: 0
        });
        expect(validation.valid).toBe(false);
    });

    test('validatePayment should require amount > 0', () => {
        const { result } = renderHook(() => useServiceValidation());
        const validation = result.current.validatePayment({
            amount: 0
        });
        expect(validation.valid).toBe(false);
    });
});

describe('useServiceCalculations Hook', () => {
    const mockOrder = {
        details: [
            { quantity: 1, unit_price: 40 },
            { quantity: 2, unit_price: 30 }
        ],
        payments: [
            { amount: 50 },
            { amount: 20 }
        ]
    };

    test('calculates orderTotal correctly', () => {
        const { result } = renderHook(() => useServiceCalculations(mockOrder));
        // 1*40 + 2*30 = 100
        expect(result.current.orderTotal).toBe(100);
    });

    test('calculates orderPaid correctly', () => {
        const { result } = renderHook(() => useServiceCalculations(mockOrder));
        // 50 + 20 = 70
        expect(result.current.orderPaid).toBe(70);
    });

    test('calculates orderPending correctly', () => {
        const { result } = renderHook(() => useServiceCalculations(mockOrder));
        // 100 - 70 = 30
        expect(result.current.orderPending).toBe(30);
    });

    test('calculates paymentPercentage correctly', () => {
        const { result } = renderHook(() => useServiceCalculations(mockOrder));
        // 70/100 = 70%
        expect(result.current.paymentPercentage).toBe(70);
    });

    test('determines paid status correctly', () => {
        const paidOrder = {
            ...mockOrder,
            payments: [{ amount: 100 }]
        };
        const { result } = renderHook(() => useServiceCalculations(paidOrder));
        expect(result.current.paymentStatus).toBe('paid');
    });

    test('determines partial status correctly', () => {
        const { result } = renderHook(() => useServiceCalculations(mockOrder));
        expect(result.current.paymentStatus).toBe('partial');
    });

    test('determines unpaid status correctly', () => {
        const unpaidOrder = {
            ...mockOrder,
            payments: []
        };
        const { result } = renderHook(() => useServiceCalculations(unpaidOrder));
        expect(result.current.paymentStatus).toBe('unpaid');
    });

    test('handles empty order gracefully', () => {
        const emptyOrder = { details: [], payments: [] };
        const { result } = renderHook(() => useServiceCalculations(emptyOrder));
        expect(result.current.orderTotal).toBe(0);
        expect(result.current.orderPaid).toBe(0);
        expect(result.current.paymentPercentage).toBe(0);
    });
});
