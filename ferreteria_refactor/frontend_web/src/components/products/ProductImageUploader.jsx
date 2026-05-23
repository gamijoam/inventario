import { useState, useRef, useCallback } from 'react';
import { Upload, X, Image as ImageIcon, Trash2, RefreshCw, Camera, RotateCw, Check, ZoomIn, Sparkles, Undo2 } from 'lucide-react';
import apiClient from '../../config/axios';
import { API_ROOT_URL } from '../../config/constants';
import noImgPlaceholder from '../../assets/no-img.svg';
import { cn } from '../../lib/utils';

// ─── Editor: rotación + zoom ──────────────────────────────────────────────────
const ImageEditor = ({ src, onConfirm, onCancel }) => {
  const [rotation, setRotation] = useState(0);
  const [scale, setScale] = useState(1);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [editorError, setEditorError] = useState(false);
  const imgRef = useRef(null);

  // ── Eliminar fondo (IA) ────────────────────────────────────────────
  const [processedSrc, setProcessedSrc] = useState(null);   // dataURL del PNG sin fondo
  const [originalSrc, setOriginalSrc]   = useState(src);    // fuente original para restaurar
  const [bgRemoving, setBgRemoving]     = useState(false);
  const [bgError, setBgError]           = useState(null);

  const currentSrc = processedSrc || originalSrc;

  const handleRemoveBackground = async () => {
    if (bgRemoving) return;
    setBgRemoving(true);
    setBgError(null);
    try {
      // 1) Aplicar primero la rotación/zoom actual a un canvas
      const img = imgRef.current;
      if (!img) throw new Error('No hay imagen');
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      if (!w || !h) throw new Error('Imagen sin dimensiones');

      const MAX_SIZE = 1280;  // Limitar para que rembg sea rápido
      let drawW = w, drawH = h;
      if (Math.max(w, h) > MAX_SIZE) {
        const r = MAX_SIZE / Math.max(w, h);
        drawW = Math.round(w * r);
        drawH = Math.round(h * r);
      }
      const canvas = document.createElement('canvas');
      const rad = (rotation * Math.PI) / 180;
      const sin = Math.abs(Math.sin(rad));
      const cos = Math.abs(Math.cos(rad));
      canvas.width  = Math.ceil(drawW * cos + drawH * sin);
      canvas.height = Math.ceil(drawW * sin + drawH * cos);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(rad);
      ctx.scale(scale, scale);
      ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);

      // 2) Canvas → Blob → enviar al backend
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob(b => b ? resolve(b) : reject(new Error('Canvas vacío')),
                      'image/png', 0.92);
      });
      const formData = new FormData();
      formData.append('file', blob, 'preview.png');

      const apiClientMod = await import('../../config/axios');
      const r = await apiClientMod.default.post('/products/remove-background', formData, {
        responseType: 'blob',
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000,
      });

      // 3) Convertir blob → dataURL para mostrar en el preview
      const reader = new FileReader();
      reader.onload = e => {
        setProcessedSrc(e.target.result);
        // Resetear rotación y zoom para que el resultado se vea bien
        setRotation(0);
        setScale(1);
      };
      reader.readAsDataURL(r.data);
    } catch (e) {
      const msg = e?.response?.status === 503
        ? 'El servicio de eliminar fondo no está disponible'
        : (e?.response?.data instanceof Blob
            ? 'Error al procesar la imagen'
            : (e?.message || 'Error al eliminar fondo'));
      setBgError(msg);
    } finally {
      setBgRemoving(false);
    }
  };

  const handleRestoreBackground = () => {
    setProcessedSrc(null);
    setBgError(null);
  };

  const rotate = () => {
    try { setRotation(r => (r + 90) % 360); }
    catch (e) { console.error(e); }
  };

  const handleConfirm = useCallback(async () => {
    try {
      const img = imgRef.current;
      if (!img) return;

      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      if (!w || !h) {
        await new Promise(res => setTimeout(res, 300));
        return handleConfirm();
      }

      const MAX_SIZE = 1600;
      let drawW = w, drawH = h;
      if (Math.max(w, h) > MAX_SIZE) {
        const ratio = MAX_SIZE / Math.max(w, h);
        drawW = Math.round(w * ratio);
        drawH = Math.round(h * ratio);
      }

      const canvas = document.createElement('canvas');
      const rad = (rotation * Math.PI) / 180;
      const sin = Math.abs(Math.sin(rad));
      const cos = Math.abs(Math.cos(rad));
      const canvasW = Math.ceil(drawW * cos + drawH * sin);
      const canvasH = Math.ceil(drawW * sin + drawH * cos);
      if (canvasW <= 0 || canvasH <= 0 || canvasW > 4000 || canvasH > 4000) return;

      canvas.width = canvasW;
      canvas.height = canvasH;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.save();
      // Si la imagen tiene fondo eliminado (processedSrc), NO pintamos fondo blanco
      // (preservamos transparencia). Para originales, sí pintamos blanco.
      if (!processedSrc) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvasW, canvasH);
      } else {
        ctx.clearRect(0, 0, canvasW, canvasH);
      }
      ctx.translate(canvasW / 2, canvasH / 2);
      ctx.rotate(rad);
      ctx.scale(scale, scale);
      ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();

      // Si hay transparencia (bg removido), exportar como PNG. Si no, JPEG.
      const mime = processedSrc ? 'image/png' : 'image/jpeg';
      const ext  = processedSrc ? 'png'        : 'jpg';
      canvas.toBlob(blob => {
        if (!blob) return;
        const file = new File([blob], `edited.${ext}`, { type: mime });
        onConfirm(file);
      }, mime, 0.92);
    } catch (err) {
      console.error('Error procesando imagen:', err);
      onCancel();
    }
  }, [rotation, scale, onConfirm, imgLoaded, processedSrc]);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-black text-slate-800 text-sm">Ajustar imagen</h3>
          <button onClick={onCancel} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-rose-500 rounded-xl hover:bg-rose-50 transition-all">
            <X size={16} />
          </button>
        </div>
        <div
          className={`flex items-center justify-center overflow-hidden ${processedSrc ? 'bg-[length:20px_20px] bg-[linear-gradient(45deg,#e2e8f0_25%,transparent_25%,transparent_75%,#e2e8f0_75%),linear-gradient(45deg,#e2e8f0_25%,transparent_25%,transparent_75%,#e2e8f0_75%)] bg-[position:0_0,10px_10px] bg-white' : 'bg-slate-100'}`}
          style={{ height: 260 }}>
          <img
            ref={imgRef}
            src={currentSrc}
            alt="Preview"
            crossOrigin="anonymous"
            onLoad={() => setImgLoaded(true)}
            style={{ transform: `rotate(${rotation}deg) scale(${scale})`, maxWidth: '80%', maxHeight: '80%', objectFit: 'contain', transition: 'transform 0.3s ease', flexShrink: 0 }}
          />
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest w-16">Rotar</span>
            <button onClick={rotate} className="flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-bold text-xs rounded-xl transition-all">
              <RotateCw size={14} /> 90°
            </button>
            <span className="text-xs text-slate-400 font-mono">{rotation}°</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest w-16">Zoom</span>
            <input type="range" min="0.5" max="2" step="0.05" value={scale} onChange={e => setScale(parseFloat(e.target.value))} className="flex-1 accent-indigo-600" />
            <span className="text-xs text-slate-400 font-mono w-10">{(scale * 100).toFixed(0)}%</span>
          </div>

          {/* Eliminar fondo (IA) */}
          <div className="pt-2 border-t border-slate-100">
            {!processedSrc ? (
              <button
                onClick={handleRemoveBackground}
                disabled={!imgLoaded || bgRemoving}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-bold text-xs hover:from-purple-600 hover:to-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
              >
                {bgRemoving ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    Procesando con IA... (puede tardar unos segundos)
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    Eliminar fondo con IA
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={handleRestoreBackground}
                disabled={bgRemoving}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl border-2 border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition-all"
              >
                <Undo2 size={14} />
                Restaurar fondo original
              </button>
            )}
            {bgError && (
              <p className="mt-2 text-[10px] text-rose-600 text-center font-semibold">{bgError}</p>
            )}
            {processedSrc && !bgError && (
              <p className="mt-2 text-[10px] text-emerald-600 text-center font-bold">
                ✨ Fondo eliminado. El cuadriculado indica transparencia.
              </p>
            )}
          </div>
        </div>
        <div className="px-5 pb-5 flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-2xl border-2 border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-all">Cancelar</button>
          <button onClick={handleConfirm} disabled={!imgLoaded} className="flex-1 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black text-sm flex items-center justify-center gap-2 transition-all" onError={() => setEditorError(true)}>
            <Check size={16} /> Usar foto
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Uploader principal ───────────────────────────────────────────────────────
export default function ProductImageUploader({ productId, currentImageUrl, currentImageOriginalUrl, onImageUpdate, onOriginalUpdate }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [editSrc, setEditSrc] = useState(null);
  const [lightbox, setLightbox] = useState(false);

  const getImageUrl = (url) => {
    if (!url) return null;
    const isAbsolute = url.startsWith('http');
    const fullUrl = isAbsolute ? url : `${API_ROOT_URL}${url}`;
    return `${fullUrl}${fullUrl.includes('?') ? '&' : '?'}v=${Date.now()}`;
  };

  const openEditor = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('El archivo debe ser una imagen'); return; }
    const reader = new FileReader();
    reader.onload = (e) => setEditSrc(e.target.result);
    reader.readAsDataURL(file);
  };

  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    setError(null);
    setEditSrc(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await apiClient.post('/products/upload-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (response.data.success) onImageUpdate(response.data.image_url);
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al subir la imagen');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!productId) { onImageUpdate(null); return; }
    if (!confirm('¿Eliminar la imagen del producto?')) return;
    setUploading(true);
    setError(null);
    try {
      await apiClient.delete(`/products/${productId}/image`);
      onImageUpdate(null);
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al eliminar la imagen');
    } finally {
      setUploading(false);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  };
  // ── Modal "Sin fondo" sobre imagen YA cargada ─────────────────────────
  const [bgModalOpen, setBgModalOpen]     = useState(false);
  const [bgModalLoading, setBgModalLoading] = useState(false);
  const [bgModalError, setBgModalError]   = useState(null);
  const [bgPreviewNew, setBgPreviewNew]   = useState(null);     // URL nueva (procesada)
  const [bgPreviewOld, setBgPreviewOld]   = useState(null);     // URL anterior (original)

  const handleOpenBgModal = async () => {
    if (!productId) {
      setBgModalError('Guarda primero el producto para procesar la imagen');
      setBgModalOpen(true);
      return;
    }
    setBgModalOpen(true);
    setBgModalLoading(true);
    setBgModalError(null);
    setBgPreviewNew(null);
    setBgPreviewOld(currentImageUrl);
    try {
      const r = await apiClient.post(`/products/${productId}/remove-background-on-existing`);
      const data = r.data || {};
      setBgPreviewNew(data.image_url);
      setBgPreviewOld(data.image_url_original);
      // Aplicar al form (preview en vivo)
      if (onImageUpdate) onImageUpdate(data.image_url);
      if (onOriginalUpdate) onOriginalUpdate(data.image_url_original);
    } catch (e) {
      const msg = e?.response?.data?.detail || 'Error al procesar la imagen';
      setBgModalError(msg);
    } finally {
      setBgModalLoading(false);
    }
  };

  const handleAcceptBg = () => {
    // Ya está aplicado en el form; solo cerramos el modal
    setBgModalOpen(false);
  };

  const handleCancelBg = async () => {
    // Si hubo cambio efectivo (bgPreviewNew y bgPreviewOld), revertimos
    if (productId && bgPreviewNew && bgPreviewOld) {
      try {
        const r = await apiClient.post(`/products/${productId}/restore-background`);
        if (onImageUpdate) onImageUpdate(r.data.image_url);
        if (onOriginalUpdate) onOriginalUpdate(null);
      } catch {}
    }
    setBgModalOpen(false);
    setBgPreviewNew(null);
    setBgPreviewOld(null);
    setBgModalError(null);
  };

  const handleRestoreOriginal = async () => {
    if (!productId || !currentImageOriginalUrl) return;
    if (!confirm('¿Restaurar la imagen original (con fondo)?')) return;
    setUploading(true);
    try {
      const r = await apiClient.post(`/products/${productId}/restore-background`);
      if (onImageUpdate) onImageUpdate(r.data.image_url);
      if (onOriginalUpdate) onOriginalUpdate(null);
    } catch (e) {
      setError(e?.response?.data?.detail || 'Error al restaurar la imagen');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) openEditor(e.dataTransfer.files[0]);
  };

  return (
    <div className="w-full">
      {/* Modal "Sin fondo" sobre imagen YA cargada — Antes/Después */}
      {bgModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
             onClick={handleCancelBg}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden"
               onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="text-purple-500" size={18} />
                <h3 className="font-black text-slate-800 text-base">Eliminar fondo con IA</h3>
              </div>
              <button onClick={handleCancelBg}
                      className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-rose-500 rounded-xl hover:bg-rose-50 transition-all">
                <X size={16} />
              </button>
            </div>

            {bgModalError ? (
              <div className="p-8">
                <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start gap-3">
                  <X size={18} className="text-rose-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-rose-700 font-semibold">{bgModalError}</p>
                </div>
              </div>
            ) : (
              <div className="p-6">
                <div className="grid grid-cols-2 gap-4">
                  {/* Antes */}
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 text-center">Original</p>
                    <div className="aspect-square bg-slate-50 rounded-2xl border-2 border-slate-100 overflow-hidden flex items-center justify-center">
                      {bgPreviewOld ? (
                        <img src={getImageUrl(bgPreviewOld)} alt="Original"
                             className="w-full h-full object-contain p-2" />
                      ) : (
                        <ImageIcon className="text-slate-300" size={40} />
                      )}
                    </div>
                  </div>
                  {/* Después */}
                  <div>
                    <p className="text-[10px] font-black text-purple-500 uppercase tracking-widest mb-2 text-center">Sin fondo</p>
                    <div className="aspect-square rounded-2xl border-2 border-purple-200 overflow-hidden flex items-center justify-center bg-[length:20px_20px] bg-[linear-gradient(45deg,#e2e8f0_25%,transparent_25%,transparent_75%,#e2e8f0_75%),linear-gradient(45deg,#e2e8f0_25%,transparent_25%,transparent_75%,#e2e8f0_75%)] bg-[position:0_0,10px_10px] bg-white">
                      {bgModalLoading ? (
                        <div className="flex flex-col items-center gap-3">
                          <RefreshCw className="text-purple-500 animate-spin" size={32} />
                          <p className="text-xs font-bold text-purple-600">Procesando con IA...</p>
                          <p className="text-[10px] text-slate-400">Puede tardar unos segundos</p>
                        </div>
                      ) : bgPreviewNew ? (
                        <img src={getImageUrl(bgPreviewNew)} alt="Sin fondo"
                             className="w-full h-full object-contain p-2" />
                      ) : (
                        <ImageIcon className="text-slate-300" size={40} />
                      )}
                    </div>
                  </div>
                </div>

                {bgPreviewNew && !bgModalLoading && (
                  <p className="text-center text-[11px] text-emerald-600 font-bold mt-3">
                    ✨ Fondo eliminado. El cuadriculado representa transparencia.
                  </p>
                )}
              </div>
            )}

            <div className="px-6 pb-6 flex gap-3">
              <button onClick={handleCancelBg}
                      disabled={bgModalLoading}
                      className="flex-1 py-2.5 rounded-2xl border-2 border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 disabled:opacity-50 transition-all">
                Cancelar
              </button>
              <button onClick={handleAcceptBg}
                      disabled={bgModalLoading || !bgPreviewNew || bgModalError}
                      className="flex-1 py-2.5 rounded-2xl bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-sm flex items-center justify-center gap-2 transition-all shadow-lg">
                <Check size={16} /> Usar sin fondo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && currentImageUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setLightbox(false)}
        >
          <button onClick={() => setLightbox(false)} className="absolute top-4 right-4 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-2xl flex items-center justify-center text-white transition-all">
            <X size={20} />
          </button>
          <img
            src={getImageUrl(currentImageUrl)}
            alt="Vista ampliada"
            className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl"
            style={{ maxHeight: '90vh', maxWidth: '90vw' }}
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}

      {editSrc && <ImageEditor src={editSrc} onConfirm={handleUpload} onCancel={() => setEditSrc(null)} />}

      {currentImageUrl ? (
        <div className="relative group rounded-2xl border-2 border-slate-100 bg-white overflow-hidden aspect-square flex items-center justify-center transition-all hover:border-indigo-200 hover:shadow-lg">
          {/* Click en imagen → lightbox */}
          <img
            src={getImageUrl(currentImageUrl)}
            alt="Product"
            className="w-full h-full object-contain p-2 transition-transform duration-500 group-hover:scale-105 cursor-zoom-in"
            onClick={() => setLightbox(true)}
            onError={(e) => { e.target.src = noImgPlaceholder; }}
          />

          {/* Botón ver grande — esquina superior izquierda */}
          <button
            onClick={() => setLightbox(true)}
            className="absolute top-2 left-2 bg-black/40 hover:bg-black/70 text-white rounded-xl p-1.5 opacity-0 group-hover:opacity-100 transition-all z-10"
            title="Ver imagen grande"
          >
            <ZoomIn size={14} />
          </button>

          {/* Botones editar — esquina inferior, no cubren toda la imagen */}
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-3 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
            {/* Galería */}
            <label className="cursor-pointer bg-white text-slate-700 px-3 py-1.5 rounded-xl text-[11px] font-bold hover:bg-indigo-50 hover:text-indigo-600 transition-all shadow flex items-center gap-1.5" title="Galería">
              <RefreshCw size={13} className={cn(uploading && 'animate-spin')} /> Galería
              <input type="file" className="hidden" accept="image/*" onChange={(e) => openEditor(e.target.files[0])} disabled={uploading} />
            </label>
            {/* Cámara */}
            <label className="cursor-pointer bg-indigo-600 text-white px-3 py-1.5 rounded-xl text-[11px] font-bold hover:bg-indigo-700 transition-all shadow flex items-center gap-1.5" title="Tomar foto">
              <Camera size={13} /> Foto
              <input type="file" className="hidden" accept="image/*" capture="environment" onChange={(e) => openEditor(e.target.files[0])} disabled={uploading} />
            </label>
            {/* Sin fondo / Restaurar */}
            {!currentImageOriginalUrl ? (
              <button
                onClick={handleOpenBgModal}
                disabled={uploading || !productId}
                title={!productId ? 'Guarda primero el producto' : 'Eliminar el fondo de esta imagen'}
                className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white px-3 py-1.5 rounded-xl text-[11px] font-bold hover:from-purple-600 hover:to-indigo-600 transition-all shadow flex items-center gap-1.5 disabled:opacity-50"
              >
                <Sparkles size={13} /> Sin fondo
              </button>
            ) : (
              <button
                onClick={handleRestoreOriginal}
                disabled={uploading}
                title="Restaurar imagen original (con fondo)"
                className="bg-amber-500 text-white px-3 py-1.5 rounded-xl text-[11px] font-bold hover:bg-amber-600 transition-all shadow flex items-center gap-1.5"
              >
                <Undo2 size={13} /> Restaurar
              </button>
            )}
            {/* Eliminar */}
            <button onClick={handleDelete} disabled={uploading} className="bg-rose-500 text-white px-3 py-1.5 rounded-xl text-[11px] font-bold hover:bg-rose-600 transition-all shadow flex items-center gap-1.5">
              <Trash2 size={13} /> Borrar
            </button>
          </div>
          {uploading && (
            <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center">
              <div className="flex flex-col items-center gap-2">
                <Upload className="animate-bounce text-indigo-600" size={32} />
                <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">Subiendo</span>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
          className={cn('relative rounded-2xl border-2 border-dashed aspect-square flex flex-col items-center justify-center transition-all gap-3',
            dragActive ? 'border-indigo-500 bg-indigo-50/50 scale-[0.98]' : 'border-slate-200 bg-slate-50/50')}>

          <div className={cn('w-14 h-14 rounded-2xl flex items-center justify-center transition-all', dragActive ? 'bg-indigo-600 text-white' : 'bg-white text-slate-400 border border-slate-100')}>
            <ImageIcon size={28} />
          </div>
          <p className="text-xs font-bold text-slate-600">Arrastra o selecciona</p>

          <div className="flex gap-2">
            {/* Galería */}
            <label className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-[11px] font-bold cursor-pointer hover:border-indigo-300 hover:text-indigo-600 transition-all shadow-sm">
              <Upload size={13} /> Galería
              <input type="file" className="hidden" accept="image/*" disabled={uploading} onChange={(e) => openEditor(e.target.files[0])} />
            </label>
            {/* Cámara trasera en tablet/móvil */}
            <label className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white rounded-xl text-[11px] font-bold cursor-pointer hover:bg-indigo-700 transition-all shadow-sm">
              <Camera size={13} /> Cámara
              <input type="file" className="hidden" accept="image/*" capture="environment" disabled={uploading} onChange={(e) => openEditor(e.target.files[0])} />
            </label>
          </div>

          {uploading && (
            <div className="absolute inset-0 bg-white/60 backdrop-blur-sm rounded-2xl flex items-center justify-center">
              <Upload className="animate-spin text-indigo-600" size={32} />
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="mt-3 p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-2">
          <X size={14} className="text-rose-500 mt-0.5 shrink-0" />
          <p className="text-[10px] font-bold text-rose-600 leading-tight">{error}</p>
        </div>
      )}
    </div>
  );
}
