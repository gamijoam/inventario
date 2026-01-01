import React, { useState, useEffect } from 'react';
import { X, ArrowRight } from 'lucide-react';
import restaurantService from '../../../services/restaurantService';
import toast from 'react-hot-toast';

const MoveTableModal = ({ isOpen, onClose, orderId, currentTableName, onMoveSuccess }) => {
    const [tables, setTables] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isOpen) {
            loadTables();
        }
    }, [isOpen]);

    const loadTables = async () => {
        setLoading(true);
        try {
            const data = await restaurantService.getTables();
            // Filter only AVAILABLE tables
            const available = data.filter(t => t.status === 'AVAILABLE');
            setTables(available);
        } catch (error) {
            toast.error("Error cargando mesas disponibles");
        } finally {
            setLoading(false);
        }
    };

    const handleMove = async (targetTable) => {
        if (!confirm(`¿Mover orden de ${currentTableName} a ${targetTable.name}?`)) return;

        try {
            await restaurantService.moveOrder(orderId, targetTable.id);
            toast.success(`Orden movida a ${targetTable.name}`);
            onMoveSuccess(); // Parent should reload map
            onClose();
        } catch (error) {
            console.error(error);
            toast.error("Error al mover la mesa");
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[80vh]">
                <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-2xl">
                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <ArrowRight className="text-blue-600" /> Mover Mesa {currentTableName}
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full"><X size={20} /></button>
                </div>

                <div className="p-4 overflow-y-auto flex-1">
                    {loading ? (
                        <div className="text-center py-8">Cargando mesas libras...</div>
                    ) : tables.length === 0 ? (
                        <div className="text-center py-8 text-gray-500 italic">No hay otras mesas disponibles</div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {tables.map(table => (
                                <button
                                    key={table.id}
                                    onClick={() => handleMove(table)}
                                    className="p-4 bg-green-50 border border-green-200 rounded-xl hover:bg-green-100 hover:shadow-md transition flex flex-col items-center gap-2"
                                >
                                    <span className="font-bold text-green-800">{table.name}</span>
                                    <span className="text-xs text-green-600">{table.zone}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MoveTableModal;
