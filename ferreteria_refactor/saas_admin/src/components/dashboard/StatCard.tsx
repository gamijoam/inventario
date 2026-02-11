import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface StatCardProps {
    title: string;
    value: string | number;
    icon: LucideIcon;
    trend?: string;
    trendType?: 'positive' | 'negative' | 'neutral';
    color?: 'blue' | 'green' | 'purple' | 'orange' | 'red';
    className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
    title,
    value,
    icon: Icon,
    trend,
    trendType = 'neutral',
    color = 'blue',
    className
}) => {

    const colorStyles = {
        blue: 'bg-blue-50 text-blue-600 border-blue-100',
        green: 'bg-green-50 text-green-600 border-green-100',
        purple: 'bg-purple-50 text-purple-600 border-purple-100',
        orange: 'bg-orange-50 text-orange-600 border-orange-100',
        red: 'bg-rose-50 text-rose-600 border-rose-100',
    };

    const trendColor = {
        positive: 'text-green-600',
        negative: 'text-red-600',
        neutral: 'text-gray-500'
    };

    return (
        <div className={twMerge("bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow", className)}>
            <div className="flex items-start justify-between">
                <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-1">{title}</h3>
                    <div className="text-2xl font-bold text-gray-900">{value}</div>
                    {trend && (
                        <div className={`text-xs mt-2 font-medium ${trendColor[trendType]}`}>
                            {trend}
                        </div>
                    )}
                </div>
                <div className={clsx("p-3 rounded-lg border", colorStyles[color])}>
                    <Icon size={24} />
                </div>
            </div>
        </div>
    );
};
