import React, { useState, useEffect } from 'react';
import restaurantService from '../../services/restaurantService';
import { RefreshCw, Plus } from 'lucide-react';
import OrderModal from './components/OrderModal';

const TableMap = () => {
    const [tables, setTables] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedZone, setSelectedZone] = useState('ALL');
    const [zones, setZones] = useState([]);

    const fetchTables = async () => {
        setLoading(true);
        try {
            const data = await restaurantService.getTables();
            setTables(data);

            // Extract unique zones
            const uniqueZones = [...new Set(data.map(t => t.zone))];
            setZones(uniqueZones);
        } catch (error) {
            console.error("Error fetching tables:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTables();
    }, []);

    const [selectedTable, setSelectedTable] = useState(null);

    const handleTableClick = (table) => {
        setSelectedTable(table);
    };

    const handleCloseModal = () => {
        setSelectedTable(null);
    };

    const handleUpdateMap = () => {
        // Refresh tables to show new status (e.g. Red for occupied)
        fetchTables();
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'AVAILABLE': return 'bg-green-100 border-green-500 text-green-800 hover:bg-green-200';
            case 'OCCUPIED': return 'bg-red-100 border-red-500 text-red-800 hover:bg-red-200';
            case 'RESERVED': return 'bg-yellow-100 border-yellow-500 text-yellow-800 hover:bg-yellow-200';
            case 'CLEANING': return 'bg-blue-100 border-blue-500 text-blue-800 hover:bg-blue-200';
            default: return 'bg-gray-100 border-gray-400 text-gray-800';
        }
    };

    const filteredTables = selectedZone === 'ALL'
        ? tables
        : tables.filter(t => t.zone === selectedZone);

    return (
        <div className="p-6 h-screen flex flex-col bg-gray-50">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    🍽️ Mapa de Mesas
                </h1>
                <div className="flex gap-2">
                    <button
                        onClick={fetchTables}
                        className="p-2 rounded bg-white border border-gray-300 shadow-sm hover:bg-gray-50 text-gray-600 transition-colors"
                        title="Actualizar"
                    >
                        <RefreshCw size={20} />
                    </button>

                    <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 transition w-full sm:w-auto justify-center">
                        <Plus size={18} />
                        <span className="hidden sm:inline">Nueva Mesa</span>
                    </button>
                </div>
            </div>

            {/* Zone Filter */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
                <button
                    onClick={() => setSelectedZone('ALL')}
                    className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${selectedZone === 'ALL'
                        ? 'bg-gray-800 text-white shadow-md'
                        : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                        }`}
                >
                    Todas las Zonas
                </button>
                {zones.map(zone => (
                    <button
                        key={zone}
                        onClick={() => setSelectedZone(zone)}
                        className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${selectedZone === zone
                            ? 'bg-gray-800 text-white shadow-md'
                            : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                            }`}
                    >
                        {zone}
                    </button>
                ))}
            </div>

            {/* Grid */}
            {loading ? (
                <div className="flex-1 flex justify-center items-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 overflow-y-auto pb-20">
                    {filteredTables.map(table => (
                        <div
                            key={table.id}
                            onClick={() => handleTableClick(table)}
                            className={`
                aspect-square rounded-2xl border-2 flex flex-col justify-center items-center cursor-pointer shadow-sm transition-all transform hover:scale-105 hover:shadow-md
                ${getStatusColor(table.status)}
              `}
                        >
                            <span className="text-3xl font-bold mb-1">{table.name}</span>
                            <span className="text-xs uppercase font-semibold opacity-75">{table.status}</span>
                            <div className="mt-2 text-xs flex items-center opacity-60">
                                👤 {table.capacity}
                            </div>
                        </div>
                    ))}

                    {filteredTables.length === 0 && (
                        <div className="col-span-full py-12 text-center text-gray-400">
                            No hay mesas en esta zona.
                        </div>
                    )}
                </div>
            )}
            {selectedTable && (
                <OrderModal
                    table={selectedTable}
                    onClose={handleCloseModal}
                    onUpdate={handleUpdateMap}
                />
            )}
        </div>
    );
};

export default TableMap;
