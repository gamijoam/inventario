import { useState, useCallback } from 'react';
import apiClient from '../../../config/axios';

/**
 * Hook para manejar la lógica de órdenes de servicio
 */
export const useServiceOrder = (orderId) => {
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchOrder = useCallback(async () => {
        if (!orderId) return;
        setLoading(true);
        try {
            const res = await apiClient.get(`/services/orders/${orderId}`);
            setOrder(res.data);
            setError(null);
        } catch (err) {
            setError(err.response?.data?.detail || 'Error al cargar orden');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [orderId]);

    const updateStatus = useCallback(async (newStatus, diagnosisNotes = '') => {
        if (!orderId) return;
        try {
            const res = await apiClient.patch(`/services/orders/${orderId}/status`, {
                status: newStatus,
                diagnosis_notes: diagnosisNotes,
            });
            setOrder(res.data);
            return res.data;
        } catch (err) {
            throw err;
        }
    }, [orderId]);

    const addItem = useCallback(async (itemData) => {
        if (!orderId) return;
        try {
            const res = await apiClient.post(`/services/orders/${orderId}/items`, itemData);
            setOrder(res.data);
            return res.data;
        } catch (err) {
            throw err;
        }
    }, [orderId]);

    const deleteItem = useCallback(async (itemId) => {
        if (!orderId) return;
        try {
            const res = await apiClient.delete(`/services/orders/${orderId}/items/${itemId}`);
            setOrder(res.data);
            return res.data;
        } catch (err) {
            throw err;
        }
    }, [orderId]);

    const addPayment = useCallback(async (paymentData) => {
        if (!orderId) return;
        try {
            const res = await apiClient.post(`/services/orders/${orderId}/payments`, paymentData);
            setOrder(res.data);
            return res.data;
        } catch (err) {
            throw err;
        }
    }, [orderId]);

    return {
        order,
        loading,
        error,
        fetchOrder,
        updateStatus,
        addItem,
        deleteItem,
        addPayment,
    };
};

/**
 * Hook para validaciones de órdenes de servicio
 */
export const useServiceValidation = () => {
    const validateCustomer = useCallback((customer) => {
        if (!customer) return { valid: false, error: 'Cliente es requerido' };
        if (!customer.name) return { valid: false, error: 'Nombre de cliente es requerido' };
        return { valid: true };
    }, []);

    const validateEquipment = useCallback((equipment) => {
        const errors = [];
        if (!equipment.device_type) errors.push('Tipo de dispositivo requerido');
        if (!equipment.brand) errors.push('Marca requerida');
        if (!equipment.model) errors.push('Modelo requerido');
        return {
            valid: errors.length === 0,
            errors,
        };
    }, []);

    const validateDiagnosis = useCallback((diagnosis) => {
        if (!diagnosis.problem_description) {
            return { valid: false, error: 'Descripción del problema requerida' };
        }
        if (diagnosis.problem_description.length < 10) {
            return { valid: false, error: 'Descripción muy corta (mínimo 10 caracteres)' };
        }
        return { valid: true };
    }, []);

    const validateItem = useCallback((item) => {
        const errors = [];
        if (!item.product_id && !item.description) {
            errors.push('Selecciona un producto o escribe una descripción');
        }
        if (!item.unit_price || item.unit_price <= 0) {
            errors.push('Precio debe ser mayor a 0');
        }
        if ((!item.product_id && item.is_manual) && !item.technician_id) {
            errors.push('Técnico requerido para servicios manuales');
        }
        return {
            valid: errors.length === 0,
            errors,
        };
    }, []);

    const validatePayment = useCallback((payment) => {
        const errors = [];
        if (!payment.amount || payment.amount <= 0) {
            errors.push('Monto debe ser mayor a 0');
        }
        if (!payment.payment_method) {
            errors.push('Método de pago requerido');
        }
        return {
            valid: errors.length === 0,
            errors,
        };
    }, []);

    return {
        validateCustomer,
        validateEquipment,
        validateDiagnosis,
        validateItem,
        validatePayment,
    };
};

/**
 * Hook para cálculos comunes en órdenes
 */
export const useServiceCalculations = (order) => {
    const orderTotal = order?.details?.reduce(
        (acc, d) => acc + Number(d.quantity) * Number(d.unit_price),
        0
    ) || 0;

    const rawPaid = order?.payments?.reduce(
        (acc, p) => acc + parseFloat(p.amount),
        0
    ) || 0;

    // Si la orden ya está marcada como PAID en metadata, considerar pagado completo
    const isFullyPaid = order?.order_metadata?.payment_status === 'PAID';
    const orderPaid    = isFullyPaid ? orderTotal : rawPaid;
    const orderPending = isFullyPaid ? 0 : Math.max(0, orderTotal - rawPaid);
    const paymentPercentage = orderTotal > 0
        ? (isFullyPaid ? 100 : (rawPaid / orderTotal) * 100)
        : 0;

    const paymentStatus = isFullyPaid || (rawPaid >= orderTotal && orderTotal > 0)
        ? 'paid'
        : rawPaid > 0
            ? 'partial'
            : 'unpaid';

    return {
        orderTotal,
        orderPaid,
        orderPending,
        paymentPercentage,
        paymentStatus,
    };
};
