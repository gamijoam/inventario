import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { BarcodeScanner } from '@capacitor-community/barcode-scanner';
import { Capacitor } from '@capacitor/core';
import { X, Camera } from 'lucide-react';

const BarcodeScannerComponent = ({ onScanned, onClose }) => {
    const [hasPermission, setHasPermission] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!Capacitor.isNativePlatform()) {
            console.warn("BarcodeScanner solo funciona en dispositivos nativos.");
            // Simulación para web
            const simulatedScan = setTimeout(() => {
                onScanned("7501055311467");
            }, 2000);
            return () => clearTimeout(simulatedScan);
        }

        const checkPermission = async () => {
            try {
                const status = await BarcodeScanner.checkPermission({ force: true });
                if (status.granted) {
                    setHasPermission(true);
                    startScan();
                } else {
                    setHasPermission(false);
                }
            } catch (err) {
                console.error("Error checking camera permission:", err);
                setError(err.message);
                setHasPermission(false);
            }
        };

        checkPermission();

        return () => {
            stopScan();
        };
    }, []);

    const startScan = async () => {
        try {
            // Ocultar la app React
            document.querySelector('body').classList.add('barcode-scanner-active');

            // Hacer fondo transparente
            await BarcodeScanner.hideBackground();
            document.body.style.backgroundColor = "transparent";
            document.documentElement.style.backgroundColor = "transparent";

            const result = await BarcodeScanner.startScan();

            if (result.hasContent) {
                onScanned(result.content);
                stopScan();
            }
        } catch (err) {
            console.error("Error starting scan:", err);
            setError(err.message);
            stopScan();
        }
    };

    const stopScan = () => {
        if (Capacitor.isNativePlatform()) {
            BarcodeScanner.showBackground();
            BarcodeScanner.stopScan();
            document.body.style.backgroundColor = "";
            document.documentElement.style.backgroundColor = "";
            document.querySelector('body').classList.remove('barcode-scanner-active');
        }
        onClose();
    };

    // Renderizar en el body usando Portal para estar fuera de #root (si decidimos ocultar #root)
    // Nota: Aunque usemos Portal, si ocultamos #root con display:none, el portal sigue funcionando 
    // porque React mantiene su árbol, pero el nodo DOM del portal debe estar fuera de #root.
    // React Portals por defecto se montan en el nodo destino. Si el destino es document.body, 
    // y #root tiene display:none, el portal sigue visible siempre que sea hijo directo de body.

    // Contenido del Portal
    const scannerUI = (
        <div className="fixed inset-0 z-[9999] flex flex-col justify-between pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] bg-transparent">
            {/* Styles for hiding app content (keep mounted for Portal callbacks) */}
            <style>{`
                .barcode-scanner-active #root {
                    opacity: 0 !important;
                    pointer-events: none !important;
                }
                .barcode-scanner-active {
                    background: transparent !important;
                }
            `}</style>

            {/* Error State */}
            {hasPermission === false && (
                <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-6 text-white text-center">
                    <Camera size={48} className="text-red-500 mb-4" />
                    <h3 className="text-lg font-bold mb-2">Permiso denegado</h3>
                    <p className="mb-6 text-sm text-slate-300">
                        {error ? `Error: ${error}` : "Necesitamos acceso a la cámara para escanear códigos."}
                    </p>
                    <button onClick={stopScan} className="px-6 py-2 bg-slate-700 rounded-full font-bold">Cerrar</button>
                </div>
            )}

            {/* Scanning UI */}
            {hasPermission === true && (
                <>
                    {/* Header */}
                    <div className="p-4 flex justify-between items-center bg-gradient-to-b from-black/50 to-transparent">
                        <div className="text-white font-bold drop-shadow-md text-lg">Escaneando...</div>
                        <button
                            onClick={stopScan}
                            className="p-3 bg-white/20 rounded-full text-white backdrop-blur-md border border-white/30 hover:bg-white/30 transition-all active:scale-95"
                        >
                            <X size={24} strokeWidth={3} />
                        </button>
                    </div>

                    {/* Guía Visual (Cuadrado central) */}
                    <div className="flex-1 flex items-center justify-center">
                        <div className="w-72 h-48 border-2 border-white/30 rounded-2xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                            <div className="absolute inset-0 border-4 border-transparent border-t-indigo-500 border-r-indigo-500 rounded-tr-2xl w-12 h-12 right-0 top-0"></div>
                            <div className="absolute inset-0 border-4 border-transparent border-t-indigo-500 border-l-indigo-500 rounded-tl-2xl w-12 h-12 left-0 top-0"></div>
                            <div className="absolute inset-0 border-4 border-transparent border-b-indigo-500 border-r-indigo-500 rounded-br-2xl w-12 h-12 right-0 bottom-0"></div>
                            <div className="absolute inset-0 border-4 border-transparent border-b-indigo-500 border-l-indigo-500 rounded-bl-2xl w-12 h-12 left-0 bottom-0"></div>

                            {/* Línea de escaneo animada */}
                            <div className="absolute left-4 right-4 h-0.5 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] top-1/2 -translate-y-1/2 animate-pulse"></div>
                        </div>
                    </div>

                    {/* Footer / Instrucciones */}
                    <div className="p-10 text-center bg-gradient-to-t from-black/50 to-transparent">
                        <p className="text-white text-sm font-medium drop-shadow-md bg-black/40 px-6 py-3 rounded-full inline-block backdrop-blur-md border border-white/10">
                            Apunta la cámara al código de barras
                        </p>
                    </div>
                </>
            )}
        </div>
    );

    return createPortal(scannerUI, document.body);
};

export default BarcodeScannerComponent;
