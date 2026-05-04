import { useState, useRef, useCallback } from 'react';
import { Upload, X, Image as ImageIcon, Trash2, RefreshCw, Camera, RotateCw, Check, ZoomIn } from 'lucide-react';
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

  const rotate = () => {
    try { setRotation(r => (r + 90) % 360); }
    catch (e) { console.error(e); }
  };

  const handleConfirm = useCallback(async () => {
    try {
      const img = imgRef.current;
      if (!img) return;

      // Esperar a que la imagen tenga dimensiones reales
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      if (!w || !h) {
        // Si aún no cargó, esperar
        await new Promise(res => setTimeout(res, 300));
        return handleConfirm();
      }

      // Limitar resolución máxima para evitar OOM en tablets
      const MAX_SIZE = 1600;
      let drawW = w;
      let drawH = h;
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
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvasW, canvasH);
      ctx.translate(canvasW / 2, canvasH / 2);
      ctx.rotate(rad);
      ctx.scale(scale, scale);
      ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();

      canvas.toBlob(blob => {
        if (!blob) return;
        const file = new File([blob], 'edited.jpg', { type: 'image/jpeg' });
        onConfirm(file);
      }, 'image/jpeg', 0.88);
    } catch (err) {
      console.error('Error procesando imagen:', err);
      // Si falla el canvas (ej: CORS), cerrar editor sin cambios
      onCancel();
    }
  }, [rotation, scale, onConfirm, imgLoaded, src]);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-black text-slate-800 text-sm">Ajustar imagen</h3>
          <button onClick={onCancel} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-rose-500 rounded-xl hover:bg-rose-50 transition-all">
            <X size={16} />
          </button>
        </div>
        <div className="bg-slate-100 flex items-center justify-center overflow-hidden" style={{ height: 260 }}>
          <img
            ref={imgRef}
            src={src}
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
export default function ProductImageUploader({ productId, currentImageUrl, onImageUpdate }) {
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
  const handleDrop = (e) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) openEditor(e.dataTransfer.files[0]);
  };

  return (
    <div className="w-full">
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
          <img
            src={getImageUrl(currentImageUrl)}
            alt="Product"
            className="w-full h-full object-contain p-2 transition-transform duration-500 group-hover:scale-105 cursor-zoom-in"
            onClick={() => setLightbox(true)}
            onError={(e) => { e.target.src = noImgPlaceholder; }}
          />
          {/* Indicador zoom */}
          <div className="absolute top-2 left-2 bg-black/30 text-white rounded-lg p-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <ZoomIn size={14} />
          </div>
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-3">
            {/* Galería */}
            <label className="cursor-pointer bg-white text-slate-800 p-3 rounded-xl hover:bg-indigo-50 hover:text-indigo-600 transition-all shadow-xl" title="Galería">
              <RefreshCw size={20} className={cn(uploading && 'animate-spin')} />
              <input type="file" className="hidden" accept="image/*" onChange={(e) => openEditor(e.target.files[0])} disabled={uploading} />
            </label>
            {/* Cámara */}
            <label className="cursor-pointer bg-indigo-600 text-white p-3 rounded-xl hover:bg-indigo-700 transition-all shadow-xl" title="Tomar foto">
              <Camera size={20} />
              <input type="file" className="hidden" accept="image/*" capture="environment" onChange={(e) => openEditor(e.target.files[0])} disabled={uploading} />
            </label>
            {/* Eliminar */}
            <button onClick={handleDelete} disabled={uploading} className="bg-rose-500 text-white p-3 rounded-xl hover:bg-rose-600 transition-all shadow-xl">
              <Trash2 size={20} />
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
