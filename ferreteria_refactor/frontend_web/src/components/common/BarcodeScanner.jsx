import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Capacitor } from '@capacitor/core';
import { X, Camera } from 'lucide-react';

let BarcodeScanner;
try {
    BarcodeScanner = require('@capacitor-community/barcode-scanner').BarcodeScanner;
} catch (e) {
    BarcodeScanner = null;
}

const BarcodeScannerComponent = ({ onScanned, onClose }) => {
    const [hasPermission, setHasPermission] = useState(null);
    const [error, setError] = useState(null);
    const hiddenElementsRef = useRef([]);

    const stopScan = () => {
        if (BarcodeScanner && Capacitor.isNativePlatform()) {
            try {
                BarcodeScanner.showBackground();
                BarcodeScanner.stopScan();
            } catch (e) {
                console.warn("Error stopping scanner:", e);
            }
            hiddenElementsRef.current.forEach(({ el, prevDisplay }) => {
                el.style.display = prevDisplay;
            });
            hiddenElementsRef.current = [];
            document.body.style.backgroundColor = "";
            document.documentElement.style.backgroundColor = "";
            document.body.classList.remove('barcode-scanner-active');
        }
        onClose();
    };

    const startScan = async () => {
        if (!BarcodeScanner) return;
        try {
            const bodyChildren = document.body.children;
            hiddenElementsRef.current = [];
            for (let i = 0; i < bodyChildren.length; i++) {
                const child = bodyChildren[i];
                if (child.id !== 'barcode-scanner-portal') {
                    child.style.display = 'none';
                    hiddenElementsRef.current.push({ el: child, prevDisplay: child.style.display });
                }
            }
            document.body.classList.add('barcode-scanner-active');
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

    useEffect(() => {
        if (!Capacitor.isNativePlatform()) {
            setHasPermission(true);
            return;
        }

        const checkPermission = async () => {
            if (!BarcodeScanner) {
                setHasPermission(false);
                return;
            }
            try {
                const status = await BarcodeScanner.checkPermission({ force: true });
                if (status.granted) {
                    setHasPermission(true);
                    startScan();
                } else {
                    setHasPermission(false);
                }
            } catch (err) {
                setError(err.message);
                setHasPermission(false);
            }
        };

        checkPermission();
        return () => { stopScan(); };
    }, []);

    const scannerUI = (
        <div id="barcode-scanner-portal" className="fixed inset-0 z-[9999] flex flex-col justify-between pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] bg-transparent">
            <style>{`.barcode-scanner-active { background: transparent !important; }`}</style>

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

            {hasPermission === true && (
                <>
                    <div className="p-4 flex justify-between items-center bg-gradient-to-b from-black/50 to-transparent">
                        <div className="text-white font-bold drop-shadow-md text-lg">Escaneando...</div>
                        <button onClick={stopScan} className="p-3 bg-white/20 rounded-full text-white backdrop-blur-md border border-white/30 hover:bg-white/30 transition-all active:scale-95">
                            <X size={24} strokeWidth={3} />
                        </button>
                    </div>

                    <div className="flex-1 flex items-center justify-center">
                        <div className="w-72 h-48 border-2 border-white/30 rounded-2xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                            <div className="absolute left-4 right-4 h-0.5 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] top-1/2 -translate-y-1/2 animate-pulse"></div>
                        </div>
                    </div>

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