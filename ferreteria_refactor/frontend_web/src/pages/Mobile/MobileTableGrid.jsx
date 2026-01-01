import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import restaurantService from '../../services/restaurantService';
import { Users, Utensils, UserCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';

const MobileTableGrid = () => {
    const [tables, setTables] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeZone, setActiveZone] = useState('ALL');
    const navigate = useNavigate();
    const { user } = useAuth();

    useEffect(() => {
        loadTables();
        const interval = setInterval(loadTables, 10000); // Poll every 10s
        return () => clearInterval(interval);
    }, []);

    const loadTables = async () => {
        try {
            const data = await restaurantService.getTables();
            setTables(data);
            setLoading(false);
        } catch (error) {
            console.error(error);
            // toast.error("Error cargando mesas");
        }
    };

    const handleTableClick = (table) => {
        navigate(`/mobile/order/${table.id}`);
    };

    const zones = ['ALL', ...new Set(tables.map(t => t.zone).filter(Boolean))];
    const filteredTables = activeZone === 'ALL'
        ? tables
        : tables.filter(t => t.zone === activeZone);

    if (loading) return <div className="p-8 text-center text-gray-500">Cargando mesas...</div>;

    return (
        <div className="flex flex-col h-full bg-gray-100">
            {/* Zone Filter */}
            <div className="bg-white p-3 shadow-sm flex gap-2 overflow-x-auto whitespace-nowrap sticky top-0 z-[5]">
                {zones.map(zone => (
                    <button
                        key={zone}
                        onClick={() => setActiveZone(zone)}
                        className={`px-4 py-2 rounded-full text-sm font-bold transition ${activeZone === zone
                                ? 'bg-blue-600 text-white shadow'
                                : 'bg-gray-100 text-gray-600 border border-gray-200'
                            }`}
                    >
                        {zone === 'ALL' ? 'Todas' : zone}
                    </button>
                ))}
            </div>

            <div className="p-4 flex-1 overflow-y-auto">
                <div className="grid grid-cols-2 gap-4 pb-20">
                    {filteredTables.map(table => {
                        const isOccupied = table.status === 'OCCUPIED';

                        return (
                            <button
                                key={table.id}
                                onClick={() => handleTableClick(table)}
                                className={`
                                    relative p-4 rounded-xl shadow-sm text-left transition-all active:scale-95 h-32 flex flex-col justify-between border-2
                                    ${isOccupied
                                        ? 'bg-white border-red-200'
                                        : 'bg-white border-green-200'}
                                `}
                            >
                                <div className="flex justify-between items-start">
                                    <span className={`font-bold text-2xl ${isOccupied ? 'text-red-600' : 'text-green-600'}`}>
                                        {table.name}
                                    </span>
                                    {isOccupied && <Utensils size={20} className="text-red-500" />}
                                </div>

                                <div className="text-sm text-gray-400 font-medium truncate">
                                    {table.zone || 'General'}
                                </div>

                                <div className={`
                                    self-start px-2 py-1 rounded text-xs font-bold flex items-center gap-1
                                    ${isOccupied ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}
                                `}>
                                    {isOccupied ? 'OCUPADA' : 'LIBRE'}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default MobileTableGrid;
