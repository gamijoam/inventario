import React, { useState, useEffect, useRef } from 'react';
import { Search, User, X, Check } from 'lucide-react';

const CustomerSearch = ({ customers, selectedCustomer, onSelect, disabled = false }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(0);
    const inputRef = useRef(null);
    const dropdownRef = useRef(null);

    // Filter customers based on search term
    const filteredCustomers = customers.filter(c => {
        const term = searchTerm.toLowerCase();
        return (
            c.name.toLowerCase().includes(term) ||
            (c.id_number && c.id_number.toLowerCase().includes(term)) ||
            (c.phone && c.phone.includes(term))
        );
    });

    // Update internal search term when selection changes externally
    useEffect(() => {
        if (selectedCustomer) {
            setSearchTerm(selectedCustomer.name);
        } else {
            setSearchTerm('');
        }
    }, [selectedCustomer]);

    // Click outside to close
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
                // If text doesn't match selection, revert or clear?
                // For now, if no selection is made, keep term but close dropdown
                // Or better: revert to selectedCustomer name if exists
                if (selectedCustomer) {
                    setSearchTerm(selectedCustomer.name);
                } else {
                    setSearchTerm('');
                }
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [selectedCustomer]);

    const handleKeyDown = (e) => {
        if (disabled) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightedIndex(prev =>
                prev < filteredCustomers.length - 1 ? prev + 1 : prev
            );
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedIndex(prev => prev > 0 ? prev - 1 : 0);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (isOpen && filteredCustomers.length > 0) {
                handleSelect(filteredCustomers[highlightedIndex]);
            }
        } else if (e.key === 'Escape') {
            setIsOpen(false);
        }
    };

    const handleSelect = (customer) => {
        onSelect(customer);
        setSearchTerm(customer.name);
        setIsOpen(false);
    };

    const handleClear = (e) => {
        e.stopPropagation();
        onSelect(null);
        setSearchTerm('');
        inputRef.current?.focus();
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className={`h-5 w-5 ${selectedCustomer ? 'text-blue-500' : 'text-gray-400'}`} />
                </div>

                <input
                    ref={inputRef}
                    type="text"
                    className={`
                        w-full pl-10 pr-10 py-3 border rounded-lg outline-none transition-all
                        ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white focus:ring-2 focus:ring-blue-500'}
                        ${selectedCustomer
                            ? 'border-blue-500 text-blue-900 font-semibold'
                            : 'border-gray-300 text-gray-900'
                        }
                    `}
                    placeholder="Buscar cliente (Nombre, ID, Teléfono)..."
                    value={searchTerm}
                    onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setIsOpen(true);
                        setHighlightedIndex(0);
                        if (!e.target.value) {
                            onSelect(null); // Clear selection if text cleared
                        }
                    }}
                    onFocus={() => setIsOpen(true)}
                    onKeyDown={handleKeyDown}
                    disabled={disabled}
                />

                {selectedCustomer ? (
                    <button
                        onClick={handleClear}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-red-500"
                        title="Limpiar selección"
                    >
                        <X size={18} />
                    </button>
                ) : (
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-gray-400" />
                    </div>
                )}
            </div>

            {/* Dropdown Results */}
            {isOpen && !disabled && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                    {filteredCustomers.length > 0 ? (
                        <ul>
                            {filteredCustomers.map((customer, index) => (
                                <li
                                    key={customer.id}
                                    onClick={() => handleSelect(customer)}
                                    className={`
                                        px-4 py-3 cursor-pointer border-b border-gray-50 last:border-0 flex justify-between items-center group
                                        ${index === highlightedIndex ? 'bg-blue-50' : 'hover:bg-gray-50'}
                                    `}
                                >
                                    <div>
                                        <div className={`font-medium ${index === highlightedIndex ? 'text-blue-700' : 'text-gray-800'}`}>
                                            {customer.name}
                                        </div>
                                        <div className="text-xs text-gray-500 flex gap-2">
                                            {customer.id_number && (
                                                <span className="bg-gray-100 px-1.5 rounded">{customer.id_number}</span>
                                            )}
                                            {customer.phone && (
                                                <span>📞 {customer.phone}</span>
                                            )}
                                        </div>
                                    </div>

                                    {selectedCustomer?.id === customer.id && (
                                        <Check size={16} className="text-blue-600" />
                                    )}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="p-4 text-center text-gray-500 text-sm">
                            <p>No se encontraron clientes.</p>
                            {searchTerm && (
                                <p className="text-xs mt-1">Prueba con "Nuevo Cliente"</p>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default CustomerSearch;
