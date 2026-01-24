import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Smartphone, Shirt, ArrowRight } from 'lucide-react';
import { useConfig } from '../../context/ConfigContext';

const ServicesDashboard = () => {
    const navigate = useNavigate();
    const { modules } = useConfig();

    // Check Flags from Context
    const LAUNDRY_ENABLED = modules?.laundry;
    const TECH_ENABLED = modules?.services !== false; // Default true

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-center text-center md:text-left">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Servicios</h1>
                    <p className="text-gray-500 mt-2">Seleccione el tipo de orden que desea crear</p>
                </div>
                <button
                    onClick={() => navigate('/services/list')}
                    className="mt-4 md:mt-0 px-6 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 shadow-sm transition-all"
                >
                    Ver Bandeja de Entrada
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                {/* Tech Repair Card */}
                {/* Tech Repair Card */}
                {TECH_ENABLED && (
                    <div
                        onClick={() => navigate('/services/reception')} // Maps to existing Repair Form
                        className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 cursor-pointer hover:shadow-lg hover:border-blue-300 hover:-translate-y-1 transition-all group"
                    >
                        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-6 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                            <Smartphone size={32} />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">Servicio Técnico</h2>
                        <p className="text-gray-500 mb-6">
                            Reparación de celulares, tablets, laptops y otros dispositivos electrónicos.
                        </p>
                        <div className="flex items-center text-blue-600 font-medium group-hover:translate-x-2 transition-transform">
                            Nueva Orden <ArrowRight size={20} className="ml-2" />
                        </div>
                    </div>
                )}

                {/* Laundry Card (Conditional) */}
                {LAUNDRY_ENABLED && (
                    <div
                        onClick={() => navigate('/services/laundry')} // New Route
                        className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 cursor-pointer hover:shadow-lg hover:border-teal-300 hover:-translate-y-1 transition-all group"
                    >
                        <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mb-6 text-teal-600 group-hover:bg-teal-600 group-hover:text-white transition-colors">
                            <Shirt size={32} />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">Lavandería</h2>
                        <p className="text-gray-500 mb-6">
                            Recepción de prendas, edredones y servicio por kilo.
                        </p>
                        <div className="flex items-center text-teal-600 font-medium group-hover:translate-x-2 transition-transform">
                            Nueva Orden <ArrowRight size={20} className="ml-2" />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ServicesDashboard;
