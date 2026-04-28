import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Camera, SwitchCamera } from 'lucide-react';

const BarcodeScannerComponent = ({ onScanned, onClose }) => {
    const [error, setError]                     = useState(null);
    const [isStarting, setIsStarting]           = useState(true);
    const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
    const [facingBack, setFacingBack]           = useState(true);
    const videoRef      = useRef(null);
    const controlsRef   = useRef(null);
    const hasScannedRef = useRef(false);
    const mountedRef    = useRef(true);

    /* ── stop helper ─────────────────────────────────────────── */
    const stopScanner = useCallback(() => {
        const controls = controlsRef.current;
        controlsRef.current = null;
        if (controls) {
            try { controls.stop(); } catch { /* ignore */ }
        }
    }, []);

    /* ── start helper ────────────────────────────────────────── */
    const startScanner = useCallback(async (useBackCamera) => {
        stopScanner();
        if (!mountedRef.current || !videoRef.current) return;

        try {
            const { BrowserMultiFormatReader } = await import('@zxing/browser');
            const { DecodeHintType, BarcodeFormat } = await import('@zxing/library');

            const hints = new Map();
            hints.set(DecodeHintType.POSSIBLE_FORMATS, [
                BarcodeFormat.EAN_13,
                BarcodeFormat.EAN_8,
                BarcodeFormat.CODE_128,
                BarcodeFormat.CODE_93,
                BarcodeFormat.CODE_39,
                BarcodeFormat.UPC_A,
                BarcodeFormat.UPC_E,
                BarcodeFormat.ITF,
                BarcodeFormat.QR_CODE,
            ]);

            const reader = new BrowserMultiFormatReader(hints, {
                delayBetweenScanAttempts: 100,
                delayBetweenScanSuccess: 300,
                tryPlayVideoTimeout: 10000,
            });

            const controls = await reader.decodeFromConstraints(
                {
                    video: {
                        facingMode: useBackCamera ? 'environment' : 'user',
                        width: { ideal: 1280 },
                        height: { ideal: 720 },
                    },
                },
                videoRef.current,
                (result, err) => {
                    if (result && !hasScannedRef.current) {
                        hasScannedRef.current = true;
                        if (navigator.vibrate) navigator.vibrate([80, 40, 80]);
                        stopScanner();
                        if (mountedRef.current) onScanned(result.getText().trim());
                    }
                }
            );

            if (!mountedRef.current) {
                try { controls.stop(); } catch { /* ignore */ }
                return;
            }
            controlsRef.current = controls;
            setIsStarting(false);

            if (!hasMultipleCameras) {
                try {
                    const { BrowserMultiFormatReader: BMR } = await import('@zxing/browser');
                    const devices = await BMR.listVideoInputDevices();
                    if (mountedRef.current && devices.length > 1) setHasMultipleCameras(true);
                } catch { /* ignore */ }
            }

        } catch (err) {
            if (!mountedRef.current) return;
            const msg = String(err);
            if (msg.includes('NotAllowedError') || msg.includes('Permission')) {
                setError('Permiso de cámara denegado. Habilitarlo en la configuración del navegador.');
            } else if (msg.includes('NotFoundError')) {
                if (useBackCamera) { setFacingBack(false); startScanner(false); return; }
                setError('No se encontró cámara en este dispositivo.');
            } else if (msg.includes('NotReadableError') || msg.includes('Could not start video')) {
                setError('La cámara está siendo usada por otra app. Ciérrala y reintenta.');
            } else {
                setError(`Error de cámara: ${err?.message || err}`);
            }
            setIsStarting(false);
        }
    }, [onScanned, stopScanner, hasMultipleCameras]);

    /* ── mount ───────────────────────────────────────────────── */
    useEffect(() => {
        mountedRef.current = true;
        const init = async () => {
            try {
                const { BrowserMultiFormatReader } = await import('@zxing/browser');
                const devices = await BrowserMultiFormatReader.listVideoInputDevices();
                if (mountedRef.current) setHasMultipleCameras(devices.length > 1);
            } catch { /* still proceed */ }
            if (mountedRef.current) startScanner(true);
        };
        init();
        return () => { mountedRef.current = false; stopScanner(); };
    }, []);

    /* ── handlers ────────────────────────────────────────────── */
    const handleSwitchCamera = () => {
        const next = !facingBack;
        setFacingBack(next);
        setIsStarting(true);
        hasScannedRef.current = false;
        startScanner(next).catch(() => {});
    };

    const handleClose = () => {
        mountedRef.current = false;
        stopScanner();
        onClose();
    };

    /* ── render ──────────────────────────────────────────────── */
    return createPortal(
        <div className="fixed inset-0 bg-black flex flex-col" style={{ zIndex: 99999 }}>

            {/* Header */}
            <div className="relative flex items-center justify-between px-4 bg-black/90"
                style={{ zIndex: 2, paddingTop: 'max(12px, env(safe-area-inset-top))', paddingBottom: 12 }}>
                <span className="text-white font-semibold text-base">
                    {isStarting ? 'Iniciando cámara…' : 'Escanear código'}
                </span>
                <div className="flex items-center gap-3">
                    {hasMultipleCameras && (
                        <button type="button"
                            onClick={handleSwitchCamera}
                            onTouchStart={(e) => { e.preventDefault(); handleSwitchCamera(); }}
                            className="w-10 h-10 flex items-center justify-center text-white bg-white/20 active:bg-white/40 rounded-full">
                            <SwitchCamera size={20} />
                        </button>
                    )}
                    <button type="button"
                        onClick={handleClose}
                        onTouchStart={(e) => { e.preventDefault(); handleClose(); }}
                        className="w-10 h-10 flex items-center justify-center text-white bg-red-500/90 active:bg-red-600 rounded-full">
                        <X size={22} strokeWidth={2.5} />
                    </button>
                </div>
            </div>

            {/* Camera area */}
            <div className="flex-1 relative overflow-hidden bg-black">
                {error ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                        <Camera size={56} className="text-red-400 mb-4" />
                        <h3 className="text-white font-bold text-lg mb-2">Cámara no disponible</h3>
                        <p className="text-slate-400 text-sm mb-6 max-w-xs">{error}</p>
                        <button type="button" onClick={handleClose}
                            className="px-6 py-2.5 bg-white/10 active:bg-white/30 text-white rounded-full font-medium">
                            Cerrar
                        </button>
                    </div>
                ) : (
                    <>
                        <video
                            ref={videoRef}
                            className="w-full h-full object-contain"
                            autoPlay
                            muted
                            playsInline
                        />

                        {!isStarting && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="relative" style={{ width: '85%', maxWidth: 340, height: 110 }}>
                                    <div className="absolute top-0 left-0 w-7 h-7 border-t-[3px] border-l-[3px] border-white rounded-tl-sm" />
                                    <div className="absolute top-0 right-0 w-7 h-7 border-t-[3px] border-r-[3px] border-white rounded-tr-sm" />
                                    <div className="absolute bottom-0 left-0 w-7 h-7 border-b-[3px] border-l-[3px] border-white rounded-bl-sm" />
                                    <div className="absolute bottom-0 right-0 w-7 h-7 border-b-[3px] border-r-[3px] border-white rounded-br-sm" />
                                    <div className="absolute inset-x-0 top-1/2 h-px bg-red-400/60" />
                                </div>
                            </div>
                        )}

                        {isStarting && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3" style={{ zIndex: 1 }}>
                                <div className="w-10 h-10 border-[3px] border-white/20 border-t-white rounded-full animate-spin" />
                                <p className="text-white/60 text-sm">Abriendo cámara…</p>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Footer */}
            <div className="relative px-4 py-3 bg-black/90 text-center"
                style={{ zIndex: 2, paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
                <p className="text-white/60 text-xs">
                    Coloca el código de barras dentro del recuadro
                </p>
            </div>
        </div>,
        document.body
    );
};

export default BarcodeScannerComponent;