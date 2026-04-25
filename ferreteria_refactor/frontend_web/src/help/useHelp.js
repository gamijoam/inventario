import { useState } from 'react';

/**
 * Hook para controlar el drawer de ayuda.
 * Uso: const { isOpen, open, close } = useHelp();
 */
export const useHelp = () => {
    const [isOpen, setIsOpen] = useState(false);
    return {
        isOpen,
        open:  () => setIsOpen(true),
        close: () => setIsOpen(false),
        toggle: () => setIsOpen(o => !o),
    };
};
