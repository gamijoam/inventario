import { useEffect, useRef } from 'react';

/**
 * Hook para detectar escaneo de códigos de barras desde pistolas USB (HID)
 * 
 * @param {Function} onScan - Callback que se ejecuta cuando se detecta un código válido
 * @param {Object} options - Configuración opcional
 * @param {number} options.minLength - Longitud mínima del código (default: 3)
 * @param {number} options.maxTimeBetweenKeys - Tiempo máximo entre teclas en ms (default: 50)
 * @param {number} options.timeoutAfterEnter - Tiempo de espera después de Enter en ms (default: 100)
 * @param {boolean} options.ignoreIfFocused - Ignorar si hay un input enfocado (default: false)
 */
const useBarcodeScanner = (onScan, options = {}) => {
    const {
        minLength = 3,
        maxTimeBetweenKeys = 50,
        timeoutAfterEnter = 100,
        ignoreIfFocused = false,
        enabled = true // New option
    } = options;

    const bufferRef = useRef('');
    const lastKeyTimeRef = useRef(0);
    const timeoutRef = useRef(null);

    useEffect(() => {
        const handleKeyDown = (event) => {
            if (!enabled) return; // Skip if disabled

            const currentTime = Date.now();
            const timeSinceLastKey = currentTime - lastKeyTimeRef.current;

            // OPCIONAL: Ignorar si el usuario está escribiendo en un input/textarea
            if (ignoreIfFocused) {
                const activeElement = document.activeElement;
                const isInputFocused = activeElement && (
                    activeElement.tagName === 'INPUT' ||
                    activeElement.tagName === 'TEXTAREA' ||
                    activeElement.isContentEditable
                );

                // Si hay un input enfocado Y el tiempo entre teclas es lento (>100ms), es escritura manual
                if (isInputFocused && timeSinceLastKey > 100) {
                    return;
                }
            }

            // Si pasó mucho tiempo desde la última tecla, resetear buffer
            if (timeSinceLastKey > maxTimeBetweenKeys && bufferRef.current.length > 0) {
                bufferRef.current = '';
            }

            // Detectar ENTER (fin de escaneo)
            if (event.key === 'Enter') {
                event.preventDefault();

                const scannedCode = bufferRef.current.trim();

                // Validar longitud mínima
                if (scannedCode.length >= minLength) {
                    console.log('🔍 Código escaneado:', scannedCode);

                    // Ejecutar callback después de un pequeño delay
                    // (para asegurar que el buffer esté completo)
                    setTimeout(() => {
                        onScan(scannedCode);
                    }, timeoutAfterEnter);
                } else {
                    console.log('⚠️ Código muy corto, ignorado:', scannedCode);
                }

                // Limpiar buffer
                bufferRef.current = '';
                lastKeyTimeRef.current = 0;
                return;
            }

            // Ignorar teclas especiales (Shift, Ctrl, Alt, etc.)
            if (event.key.length > 1 && event.key !== 'Enter') {
                return;
            }

            // Acumular caracteres en el buffer
            bufferRef.current += event.key;
            lastKeyTimeRef.current = currentTime;

            // Auto-limpiar buffer después de un tiempo sin actividad
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            timeoutRef.current = setTimeout(() => {
                if (bufferRef.current.length > 0) {
                    console.log('⏱️ Buffer expirado, limpiando:', bufferRef.current);
                    bufferRef.current = '';
                }
            }, 500);
        };

        // Escuchar eventos globales
        window.addEventListener('keydown', handleKeyDown);

        // Cleanup
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [onScan, minLength, maxTimeBetweenKeys, timeoutAfterEnter, ignoreIfFocused, enabled]);
};

export default useBarcodeScanner;
