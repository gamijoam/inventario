import React from 'react';
import Switch from './ui/Switch';
import { Loader2 } from 'lucide-react';

interface ModuleToggleProps {
    label: string;
    value: boolean;
    onChange: (newValue: boolean) => Promise<void>;
    isLoading?: boolean;
    disabled?: boolean;
}

const ModuleToggle: React.FC<ModuleToggleProps> = ({
    label,
    value,
    onChange,
    isLoading = false,
    disabled = false
}) => {
    const handleChange = async () => {
        if (isLoading || disabled) return;
        await onChange(!value);
    };

    return (
        <div className="flex items-center justify-between py-2">
            <span className="text-sm text-gray-700 font-medium">{label}</span>
            <div className="flex items-center gap-2">
                {isLoading && <Loader2 className="h-4 w-4 animate-spin text-blue-600" />}
                <Switch
                    checked={value}
                    onChange={handleChange}
                    disabled={disabled || isLoading}
                />
            </div>
        </div>
    );
};

export default ModuleToggle;
