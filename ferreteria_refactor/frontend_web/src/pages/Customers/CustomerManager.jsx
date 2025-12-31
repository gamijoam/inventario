import { useState, useEffect } from 'react';
import { Search, User, Edit2, Save, X, Plus, Trash2, Users, FileText, AlertTriangle } from 'lucide-react';
import apiClient from '../../config/axios';

const CustomerManager = () => {
    const [customers, setCustomers] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [financialStatus, setFinancialStatus] = useState(null);
    const [creditHistory, setCreditHistory] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);

    // Edit states
    const [editingCredit, setEditingCredit] = useState(false);
    const [editingTerms, setEditingTerms] = useState(false);
    const [tempCreditLimit, setTempCreditLimit] = useState(0);
    const [tempPaymentTerms, setTempPaymentTerms] = useState(15);

    // CRUD Modals
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [customerForm, setCustomerForm] = useState({
        name: '',
        id_number: '',
        phone: '',
        email: '',
        address: '',
        credit_limit: '',  // Changed from 0 to empty string
        payment_term_days: '',  // Changed from 15 to empty string
        is_blocked: false
    });

    // Helper to reset form
    const resetForm = () => {
        setCustomerForm({
            name: '',
            id_number: '',
            phone: '',
            email: '',
            address: '',
            credit_limit: '',
            payment_term_days: '',
            is_blocked: false
        });
    };

    useEffect(() => {
        fetchCustomers();
    }, []);

    useEffect(() => {
        if (selectedCustomer) {
            fetchFinancialStatus();
            fetchCreditHistory();
        }
    }, [selectedCustomer]);

    const fetchCustomers = async () => {
        try {
            const response = await apiClient.get('/customers', {
                params: { q: searchQuery, limit: 100 }
            });
            setCustomers(response.data);
        } catch (error) {
            console.error('Error fetching customers:', error);
        }
    };

    const fetchFinancialStatus = async () => {
        if (!selectedCustomer) return;
        setLoading(true);
        try {
            const response = await apiClient.get(`/customers/${selectedCustomer.id}/financial-status`);
            setFinancialStatus(response.data);
        } catch (error) {
            console.error('Error fetching financial status:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchCreditHistory = async () => {
        if (!selectedCustomer) return;
        try {
            const response = await apiClient.get('/returns/sales/search', {
                params: { limit: 50 }
            });
            const customerSales = response.data.filter(
                sale => sale.customer_id === selectedCustomer.id && sale.is_credit
            );
            setCreditHistory(customerSales);
        } catch (error) {
            console.error('Error fetching credit history:', error);
        }
    };

    const handleCreateCustomer = async () => {
        try {
            await apiClient.post('/customers', customerForm);
            alert('✅ Cliente creado exitosamente');
            setShowCreateModal(false);
            setCustomerForm({
                name: '',
                id_number: '',
                phone: '',
                email: '',
                address: '',
                credit_limit: 0,
                payment_term_days: 15,
                is_blocked: false
            });
            fetchCustomers();
        } catch (error) {
            alert('Error al crear cliente: ' + (error.response?.data?.detail || error.message));
        }
    };

    const handleEditCustomer = async () => {
        try {
            await apiClient.put(`/customers/${selectedCustomer.id}`, customerForm);
            alert('✅ Cliente actualizado');
            setShowEditModal(false);
            setSelectedCustomer({ ...selectedCustomer, ...customerForm });
            fetchCustomers();
            fetchFinancialStatus();
        } catch (error) {
            alert('Error al actualizar cliente');
        }
    };

    const handleDeleteCustomer = async (customerId) => {
        if (!confirm('¿Estás seguro de eliminar este cliente?')) return;
        try {
            await apiClient.delete(`/customers/${customerId}`);
            alert('✅ Cliente eliminado');
            if (selectedCustomer?.id === customerId) {
                setSelectedCustomer(null);
            }
            fetchCustomers();
        } catch (error) {
            alert('Error al eliminar cliente: ' + (error.response?.data?.detail || error.message));
        }
    };

    const handleUpdateCreditLimit = async () => {
        try {
            await apiClient.put(`/customers/${selectedCustomer.id}`, {
                ...selectedCustomer,
                credit_limit: tempCreditLimit
            });
            setSelectedCustomer({ ...selectedCustomer, credit_limit: tempCreditLimit });
            setEditingCredit(false);
            fetchFinancialStatus();
            alert('✅ Límite de crédito actualizado');
        } catch (error) {
            alert('Error al actualizar límite de crédito');
        }
    };

    const handleUpdatePaymentTerms = async () => {
        try {
            await apiClient.put(`/customers/${selectedCustomer.id}`, {
                ...selectedCustomer,
                payment_term_days: tempPaymentTerms
            });
            setSelectedCustomer({ ...selectedCustomer, payment_term_days: tempPaymentTerms });
            setEditingTerms(false);
            fetchFinancialStatus();
            alert('✅ Días de crédito actualizados');
        } catch (error) {
            alert('Error al actualizar días de crédito');
        }
    };

    const handleToggleBlock = async () => {
        try {
            const newBlockStatus = !selectedCustomer.is_blocked;
            await apiClient.put(`/customers/${selectedCustomer.id}`, {
                ...selectedCustomer,
                is_blocked: newBlockStatus
            });
            setSelectedCustomer({ ...selectedCustomer, is_blocked: newBlockStatus });
            fetchFinancialStatus();
            alert(newBlockStatus ? '🚫 Cliente bloqueado' : '✅ Cliente desbloqueado');
        } catch (error) {
            alert('Error al cambiar estado de bloqueo');
        }
    };

    const getInvoiceStatus = (sale) => {
        if (sale.paid) return { label: 'Pagada', color: 'text-green-600', bg: 'bg-green-100' };
        if (!sale.due_date) return { label: 'Pendiente', color: 'text-yellow-600', bg: 'bg-yellow-100' };

        const dueDate = new Date(sale.due_date);
        const now = new Date();
        const daysOverdue = Math.floor((now - dueDate) / (1000 * 60 * 60 * 24));

        if (daysOverdue > 0) {
            return { label: `Vencida (+${daysOverdue} días)`, color: 'text-red-600', bg: 'bg-red-100' };
        }

        return { label: 'A Tiempo', color: 'text-green-600', bg: 'bg-green-100' };
    };

    return (
        <div className="p-6">
            <div className="mb-6 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Gestión de Clientes</h1>
                    <p className="text-gray-600">Administra clientes y su salud financiera</p>
                </div>
                <button
                    onClick={() => {
                        resetForm();  // Reset form before opening
                        setShowCreateModal(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                >
                    <Plus size={20} />
                    Nuevo Cliente
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Left Panel - Customer List */}
                <div className={`bg-white rounded-lg shadow-md p-4 ${selectedCustomer ? 'hidden md:block' : 'block'} md:col-span-1`}>
                    <div className="mb-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 text-gray-400" size={20} />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    fetchCustomers();
                                }}
                                placeholder="Buscar cliente..."
                                className="w-full pl-10 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                    </div>

                    <div className="space-y-2 max-h-[600px] overflow-y-auto">
                        {customers.map(customer => (
                            <div
                                key={customer.id}
                                className={`p-3 rounded-lg cursor-pointer transition-colors ${selectedCustomer?.id === customer.id
                                    ? 'bg-blue-100 border-2 border-blue-500'
                                    : 'bg-gray-50 hover:bg-gray-100'
                                    }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center flex-1" onClick={() => setSelectedCustomer(customer)}>
                                        <User className="mr-2 text-gray-600" size={20} />
                                        <div>
                                            <p className="font-semibold text-gray-800">{customer.name}</p>
                                            <p className="text-xs text-gray-500">{customer.id_number || 'Sin ID'}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-1">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setCustomerForm(customer);
                                                setShowEditModal(true);
                                            }}
                                            className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteCustomer(customer.id);
                                            }}
                                            className="p-1 text-red-600 hover:bg-red-100 rounded"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right Panel - Customer Profile */}
                <div className={`md:col-span-2 ${!selectedCustomer ? 'hidden md:block' : 'block'}`}>
                    {!selectedCustomer ? (
                        <div className="bg-white rounded-lg shadow-md p-12 text-center">
                            <User className="mx-auto mb-4 text-gray-400" size={64} />
                            <p className="text-gray-600">Selecciona un cliente para ver su perfil</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Mobile Back Button */}
                            <button
                                onClick={() => setSelectedCustomer(null)}
                                className="md:hidden flex items-center text-gray-600 mb-2"
                            >
                                <Users className="mr-2" size={20} /> Volver a lista
                            </button>

                            {/* Header */}
                            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg shadow-lg p-6">
                                <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                                    <div>
                                        <h2 className="text-2xl font-bold mb-2">{selectedCustomer.name}</h2>
                                        <div className="space-y-1 text-blue-100">
                                            <p>📋 ID: {selectedCustomer.id_number || 'No registrado'}</p>
                                            <p>📞 Teléfono: {selectedCustomer.phone || 'No registrado'}</p>
                                            <p>📧 Email: {selectedCustomer.email || 'No registrado'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 w-full md:w-auto">
                                        <label className="flex items-center gap-2 bg-white/20 px-4 py-2 rounded-lg cursor-pointer w-full md:w-auto justify-center">
                                            <input
                                                type="checkbox"
                                                checked={selectedCustomer.is_blocked || false}
                                                onChange={handleToggleBlock}
                                                className="w-5 h-5"
                                            />
                                            <span className="font-medium">Bloquear Crédito</span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* Financial KPIs */}
                            {loading ? (
                                <div className="text-center p-8">Cargando estado financiero...</div>
                            ) : financialStatus && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Credit Limit */}
                                    <div className="bg-white rounded-lg shadow-md p-6">
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="text-sm text-gray-600">Límite de Crédito</p>
                                            {!editingCredit ? (
                                                <button
                                                    onClick={() => {
                                                        setEditingCredit(true);
                                                        setTempCreditLimit(financialStatus.credit_limit);
                                                    }}
                                                    className="text-blue-600 hover:text-blue-800"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                            ) : (
                                                <div className="flex gap-2">
                                                    <button onClick={handleUpdateCreditLimit} className="text-green-600">
                                                        <Save size={16} />
                                                    </button>
                                                    <button onClick={() => setEditingCredit(false)} className="text-red-600">
                                                        <X size={16} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        {editingCredit ? (
                                            <input
                                                type="number"
                                                value={tempCreditLimit}
                                                onChange={(e) => setTempCreditLimit(parseFloat(e.target.value))}
                                                className="w-full text-3xl font-bold text-blue-600 border-2 border-blue-300 rounded p-2"
                                                autoFocus
                                            />
                                        ) : (
                                            <p className="text-3xl font-bold text-blue-600">
                                                ${financialStatus.credit_limit.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                                            </p>
                                        )}
                                    </div>

                                    {/* Current Debt */}
                                    <div className="bg-white rounded-lg shadow-md p-6">
                                        <p className="text-sm text-gray-600 mb-2">Deuda Actual</p>
                                        <p className={`text-3xl font-bold ${financialStatus.total_debt > financialStatus.credit_limit * 0.8
                                            ? 'text-red-600'
                                            : 'text-gray-800'
                                            }`}>
                                            ${financialStatus.total_debt.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                                        </p>
                                    </div>

                                    {/* Available Credit */}
                                    <div className="bg-white rounded-lg shadow-md p-6">
                                        <p className="text-sm text-gray-600 mb-2">Cupo Disponible</p>
                                        <p className="text-3xl font-bold text-green-600">
                                            ${financialStatus.available_credit.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                                        </p>
                                    </div>

                                    {/* Payment Terms */}
                                    <div className="bg-white rounded-lg shadow-md p-6">
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="text-sm text-gray-600">Días de Crédito</p>
                                            {!editingTerms ? (
                                                <button
                                                    onClick={() => {
                                                        setEditingTerms(true);
                                                        setTempPaymentTerms(financialStatus.payment_term_days);
                                                    }}
                                                    className="text-blue-600 hover:text-blue-800"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                            ) : (
                                                <div className="flex gap-2">
                                                    <button onClick={handleUpdatePaymentTerms} className="text-green-600">
                                                        <Save size={16} />
                                                    </button>
                                                    <button onClick={() => setEditingTerms(false)} className="text-red-600">
                                                        <X size={16} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        {editingTerms ? (
                                            <input
                                                type="number"
                                                value={tempPaymentTerms}
                                                onChange={(e) => setTempPaymentTerms(parseInt(e.target.value))}
                                                className="w-full text-3xl font-bold text-purple-600 border-2 border-purple-300 rounded p-2"
                                                autoFocus
                                            />
                                        ) : (
                                            <p className="text-3xl font-bold text-purple-600">
                                                {financialStatus.payment_term_days} días
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Overdue Alert */}
                            {financialStatus && financialStatus.overdue_invoices > 0 && (
                                <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 flex items-center">
                                    <AlertTriangle className="text-red-600 mr-3" size={24} />
                                    <div>
                                        <p className="font-bold text-red-800">
                                            ⚠️ {financialStatus.overdue_invoices} Factura(s) Vencida(s)
                                        </p>
                                        <p className="text-red-600">
                                            Monto vencido: ${financialStatus.overdue_amount.toFixed(2)}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Credit History */}
                            <div className="bg-white rounded-lg shadow-md p-6">
                                <h3 className="text-xl font-bold text-gray-800 mb-4">Historial de Crédito</h3>
                                {/* Desktop Table */}
                                <div className="hidden md:block overflow-x-auto">
                                    <table className="w-full">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="text-left p-3 font-semibold text-gray-700">Factura</th>
                                                <th className="text-left p-3 font-semibold text-gray-700">Fecha</th>
                                                <th className="text-right p-3 font-semibold text-gray-700">Monto</th>
                                                <th className="text-left p-3 font-semibold text-gray-700">Vencimiento</th>
                                                <th className="text-center p-3 font-semibold text-gray-700">Estado</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {creditHistory.length === 0 ? (
                                                <tr>
                                                    <td colSpan="5" className="text-center p-8 text-gray-500">
                                                        No hay historial de crédito
                                                    </td>
                                                </tr>
                                            ) : (
                                                creditHistory.map(sale => {
                                                    const status = getInvoiceStatus(sale);
                                                    return (
                                                        <tr key={sale.id} className="hover:bg-gray-50">
                                                            <td className="p-3 font-medium">#{sale.id}</td>
                                                            <td className="p-3">
                                                                {new Date(sale.date).toLocaleDateString('es-ES')}
                                                            </td>
                                                            <td className="p-3 text-right font-bold">
                                                                ${sale.total_amount.toFixed(2)}
                                                            </td>
                                                            <td className="p-3">
                                                                {sale.due_date
                                                                    ? new Date(sale.due_date).toLocaleDateString('es-ES')
                                                                    : 'N/A'
                                                                }
                                                            </td>
                                                            <td className="p-3 text-center">
                                                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${status.bg} ${status.color}`}>
                                                                    {status.label}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Mobile Credit Cards */}
                                <div className="md:hidden space-y-3">
                                    {creditHistory.length === 0 ? (
                                        <div className="text-center p-8 text-gray-500">
                                            No hay historial de crédito
                                        </div>
                                    ) : (
                                        creditHistory.map(sale => {
                                            const status = getInvoiceStatus(sale);
                                            return (
                                                <div key={sale.id} className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div className="font-bold text-gray-800">#{sale.id}</div>
                                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${status.bg} ${status.color}`}>
                                                            {status.label}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between text-sm mb-1">
                                                        <span className="text-gray-500">Fecha:</span>
                                                        <span>{new Date(sale.date).toLocaleDateString('es-ES')}</span>
                                                    </div>
                                                    <div className="flex justify-between text-sm mb-2">
                                                        <span className="text-gray-500">Vence:</span>
                                                        <span>{sale.due_date ? new Date(sale.due_date).toLocaleDateString('es-ES') : 'N/A'}</span>
                                                    </div>
                                                    <div className="flex justify-end text-lg font-bold text-gray-800 pt-2 border-t border-gray-200">
                                                        ${sale.total_amount.toFixed(2)}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Create Customer Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold">Nuevo Cliente</h3>
                            <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="space-y-3">
                            <input
                                type="text"
                                placeholder="Nombre *"
                                value={customerForm.name}
                                onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                                className="w-full p-2 border rounded"
                            />
                            <input
                                type="text"
                                placeholder="RIF/Cédula"
                                value={customerForm.id_number}
                                onChange={(e) => setCustomerForm({ ...customerForm, id_number: e.target.value })}
                                className="w-full p-2 border rounded"
                            />
                            <input
                                type="text"
                                placeholder="Teléfono"
                                value={customerForm.phone}
                                onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                                className="w-full p-2 border rounded"
                            />
                            <input
                                type="email"
                                placeholder="Email"
                                value={customerForm.email}
                                onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                                className="w-full p-2 border rounded"
                            />
                            <input
                                type="number"
                                placeholder="Límite de Crédito"
                                value={customerForm.credit_limit}
                                onChange={(e) => setCustomerForm({ ...customerForm, credit_limit: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                                className="w-full p-2 border rounded"
                            />
                            <input
                                type="number"
                                placeholder="Días de Plazo"
                                value={customerForm.payment_term_days}
                                onChange={(e) => setCustomerForm({ ...customerForm, payment_term_days: e.target.value === '' ? '' : parseInt(e.target.value) })}
                                className="w-full p-2 border rounded"
                            />
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleCreateCustomer}
                                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                            >
                                Crear
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Customer Modal */}
            {showEditModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold">Editar Cliente</h3>
                            <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-600">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="space-y-3">
                            <input
                                type="text"
                                placeholder="Nombre *"
                                value={customerForm.name}
                                onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                                className="w-full p-2 border rounded"
                            />
                            <input
                                type="text"
                                placeholder="RIF/Cédula"
                                value={customerForm.id_number}
                                onChange={(e) => setCustomerForm({ ...customerForm, id_number: e.target.value })}
                                className="w-full p-2 border rounded"
                            />
                            <input
                                type="text"
                                placeholder="Teléfono"
                                value={customerForm.phone}
                                onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                                className="w-full p-2 border rounded"
                            />
                            <input
                                type="email"
                                placeholder="Email"
                                value={customerForm.email}
                                onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                                className="w-full p-2 border rounded"
                            />
                            {/* NEW: Add credit fields to edit modal */}
                            <input
                                type="number"
                                placeholder="Límite de Crédito"
                                value={customerForm.credit_limit}
                                onChange={(e) => setCustomerForm({ ...customerForm, credit_limit: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                                className="w-full p-2 border rounded"
                            />
                            <input
                                type="number"
                                placeholder="Días de Plazo"
                                value={customerForm.payment_term_days}
                                onChange={(e) => setCustomerForm({ ...customerForm, payment_term_days: e.target.value === '' ? '' : parseInt(e.target.value) })}
                                className="w-full p-2 border rounded"
                            />
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setShowEditModal(false)}
                                className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleEditCustomer}
                                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                            >
                                Guardar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomerManager;
