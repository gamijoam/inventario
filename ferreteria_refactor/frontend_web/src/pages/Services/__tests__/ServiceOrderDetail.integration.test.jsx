import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ServiceOrderDetail from '../ServiceOrderDetail';
import * as api from '../../config/axios';

// Mock del API
jest.mock('../../config/axios');

describe('ServiceOrderDetail Integration Tests', () => {
    const mockOrder = {
        id: 1,
        ticket_number: 'SRV-001',
        status: 'DIAGNOSING',
        brand: 'Samsung',
        model: 'A52',
        customer: { id: 1, name: 'Juan Pérez', phone: '04121234567' },
        problem_description: 'Batería muerta',
        diagnosis_notes: 'Circuito quemado',
        details: [
            { id: 1, description: 'Batería', quantity: 1, unit_price: 40 }
        ],
        payments: [
            { id: 1, amount: 30, payment_method: 'Efectivo', created_at: '2026-03-31T10:00:00Z' }
        ],
        created_at: '2026-03-31T10:00:00Z'
    };

    beforeEach(() => {
        // Mock API calls
        api.get.mockResolvedValue({ data: mockOrder });
        api.post.mockResolvedValue({ data: { ...mockOrder, status: 'APPROVED' } });
        api.patch.mockResolvedValue({ data: { ...mockOrder, status: 'APPROVED' } });
        api.delete.mockResolvedValue({ data: mockOrder });
    });

    test('loads and displays order details', async () => {
        render(<ServiceOrderDetail orderId={1} onBack={() => {}} />);

        await waitFor(() => {
            expect(screen.getByText('SRV-001')).toBeInTheDocument();
        });
        
        expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
        expect(screen.getByText(/Samsung A52/i)).toBeInTheDocument();
    });

    test('displays diagnosis panel with content', async () => {
        render(<ServiceOrderDetail orderId={1} onBack={() => {}} />);

        await waitFor(() => {
            expect(screen.getByText('Circuito quemado')).toBeInTheDocument();
        });
    });

    test('displays payment timeline with correct totals', async () => {
        render(<ServiceOrderDetail orderId={1} onBack={() => {}} />);

        await waitFor(() => {
            expect(screen.getByText(/Total: \$40/)).toBeInTheDocument(); // Total items
            expect(screen.getByText(/Pagado: \$30/)).toBeInTheDocument(); // Total paid
        });
    });

    test('opens QuickItemForm when Add button clicked', async () => {
        render(<ServiceOrderDetail orderId={1} onBack={() => {}} />);

        await waitFor(() => {
            const addButton = screen.getByText('+ Agregar');
            fireEvent.click(addButton);
        });

        expect(screen.getByText('Agregar Ítem')).toBeInTheDocument();
    });

    test('adds item to order', async () => {
        const { getByText, getByPlaceholderText } = render(
            <ServiceOrderDetail orderId={1} onBack={() => {}} />
        );

        await waitFor(() => {
            fireEvent.click(getByText('+ Agregar'));
        });

        // Simular agregar item
        const quantityInput = getByPlaceholderText(/cantidad/i);
        fireEvent.change(quantityInput, { target: { value: '2' } });

        expect(api.post).toHaveBeenCalled();
    });

    test('edits diagnosis when panel edited', async () => {
        const { getByText, getByDisplayValue } = render(
            <ServiceOrderDetail orderId={1} onBack={() => {}} />
        );

        await waitFor(() => {
            const editButton = screen.getByRole('button', { name: /editar/i });
            fireEvent.click(editButton);
        });

        const textarea = getByDisplayValue('Circuito quemado');
        fireEvent.change(textarea, { target: { value: 'Circuito quemado, display roto' } });

        const saveButton = getByText('Guardar');
        fireEvent.click(saveButton);

        expect(api.patch).toHaveBeenCalled();
    });

    test('changes order status when Avanzar clicked', async () => {
        render(<ServiceOrderDetail orderId={1} onBack={() => {}} />);

        await waitFor(() => {
            const avanzarButton = screen.getByText('Avanzar');
            fireEvent.click(avanzarButton);
        });

        expect(api.patch).toHaveBeenCalledWith(
            expect.stringContaining('status'),
            expect.any(Object)
        );
    });

    test('prints ticket when Imprimir clicked', async () => {
        api.get.mockResolvedValueOnce({ data: 'ESC_CODE_DATA' });

        const { getByText } = render(
            <ServiceOrderDetail orderId={1} onBack={() => {}} />
        );

        await waitFor(() => {
            fireEvent.click(getByText('🖨️ Imprimir'));
        });

        expect(api.get).toHaveBeenCalledWith(
            expect.stringContaining('/print/thermal')
        );
    });

    test('handles API errors gracefully', async () => {
        api.get.mockRejectedValueOnce(new Error('API Error'));

        render(<ServiceOrderDetail orderId={1} onBack={() => {}} />);

        await waitFor(() => {
            expect(screen.getByText(/Error al cargar/)).toBeInTheDocument();
        });
    });

    test('deletes item when delete button clicked', async () => {
        window.confirm = jest.fn(() => true);

        const { getByRole } = render(
            <ServiceOrderDetail orderId={1} onBack={() => {}} />
        );

        await waitFor(() => {
            const deleteButton = getByRole('button', { name: /eliminar/i });
            fireEvent.click(deleteButton);
        });

        expect(api.delete).toHaveBeenCalled();
    });

    test('back button calls onBack callback', async () => {
        const onBack = jest.fn();
        const { getByText } = render(
            <ServiceOrderDetail orderId={1} onBack={onBack} />
        );

        await waitFor(() => {
            fireEvent.click(getByText('← Volver'));
        });

        expect(onBack).toHaveBeenCalled();
    });

    test('registers payment when form submitted', async () => {
        const { getByText, getByDisplayValue } = render(
            <ServiceOrderDetail orderId={1} onBack={() => {}} />
        );

        await waitFor(() => {
            fireEvent.click(getByText('+ Agregar abono'));
        });

        const amountInput = getByDisplayValue('');
        fireEvent.change(amountInput, { target: { value: '20' } });

        fireEvent.click(getByText('Guardar'));

        expect(api.post).toHaveBeenCalledWith(
            expect.stringContaining('/payments'),
            expect.objectContaining({ amount: 20 })
        );
    });
});
