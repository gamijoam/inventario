import { render, screen } from '@testing-library/react';
import ServiceCard from '../components/ServiceCard';

describe('ServiceCard Component', () => {
    const mockOrder = {
        id: 1,
        ticket_number: 'SRV-001',
        status: 'IN_PROGRESS',
        brand: 'Samsung',
        model: 'A52',
        problem_description: 'Batería muerta',
        customer: { name: 'Juan Pérez', phone: '04121234567' },
        details: [
            { quantity: 1, unit_price: 40 },
            { quantity: 2, unit_price: 20 }
        ],
        payments: [
            { amount: 30 }
        ],
        created_at: '2026-03-31T10:00:00Z'
    };

    test('renders ticket number', () => {
        render(<ServiceCard order={mockOrder} />);
        expect(screen.getByText('SRV-001')).toBeInTheDocument();
    });

    test('displays customer name', () => {
        render(<ServiceCard order={mockOrder} />);
        expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
    });

    test('shows device info', () => {
        render(<ServiceCard order={mockOrder} />);
        expect(screen.getByText(/Samsung A52/i)).toBeInTheDocument();
    });

    test('displays problem description', () => {
        render(<ServiceCard order={mockOrder} />);
        expect(screen.getByText('Batería muerta')).toBeInTheDocument();
    });

    test('calculates correct total', () => {
        render(<ServiceCard order={mockOrder} />);
        // Total = 1*40 + 2*20 = 80
        expect(screen.getByText(/80/)).toBeInTheDocument();
    });

    test('calculates payment progress correctly', () => {
        render(<ServiceCard order={mockOrder} />);
        // Paid: 30, Total: 80, Percentage: 37%
        expect(screen.getByText(/37/)).toBeInTheDocument();
    });

    test('shows status badge', () => {
        render(<ServiceCard order={mockOrder} />);
        expect(screen.getByText('Reparando')).toBeInTheDocument();
    });

    test('calls onOpen when Ver button clicked', () => {
        const onOpen = jest.fn();
        const { getByText } = render(
            <ServiceCard order={mockOrder} onOpen={onOpen} />
        );
        getByText('Ver').click();
        expect(onOpen).toHaveBeenCalledWith(mockOrder.id);
    });

    test('handles empty details gracefully', () => {
        const orderNoDetails = { ...mockOrder, details: [] };
        render(<ServiceCard order={orderNoDetails} />);
        expect(screen.getByText('SRV-001')).toBeInTheDocument();
    });

    test('displays unpaid status correctly', () => {
        const unpaidOrder = { ...mockOrder, payments: [] };
        render(<ServiceCard order={unpaidOrder} />);
        // Should show 0% or "sin pagos"
        expect(screen.getByText(/0/)).toBeInTheDocument();
    });
});
