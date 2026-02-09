import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface StatsCardProps {
    title: string;
    value: number | string;
    icon: LucideIcon;
    color?: string; // Tailwind text color class, e.g., 'text-blue-600'
    bgColor?: string; // Tailwind bg color class, e.g., 'bg-blue-100'
    trend?: {
        value: string;
        isPositive: boolean;
    };
}

const StatsCard: React.FC<StatsCardProps> = ({
    title,
    value,
    icon: Icon,
    color = 'text-blue-600',
    bgColor = 'bg-blue-100',
    trend
}) => {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col justify-between hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm font-medium text-gray-500">{title}</p>
                    <h3 className="text-2xl font-bold text-gray-900 mt-2">{value}</h3>
                </div>
                <div className={`p-3 rounded-lg ${bgColor}`}>
                    <Icon className={`w-6 h-6 ${color}`} />
                </div>
            </div>

            {trend && (
                <div className="mt-4 flex items-center text-sm">
                    <span className={`font-medium ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                        {trend.value}
                    </span>
                    <span className="text-gray-400 ml-2">vs. mes anterior</span>
                </div>
            )}
        </div>
    );
};

export default StatsCard;
