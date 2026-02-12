import { useState } from 'react';
import { Upload, X, Image as ImageIcon, Trash2, RefreshCw } from 'lucide-react';
import apiClient from '../../config/axios';
import { API_ROOT_URL } from '../../config/constants';
import noImgPlaceholder from '../../assets/no-img.svg';
import { cn } from '../../lib/utils';

export default function ProductImageUploader({ productId, currentImageUrl, onImageUpdate }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  const getImageUrl = (url) => {
    if (!url) return null;
    const isAbsolute = url.startsWith('http');
    const fullUrl = isAbsolute ? url : `${API_ROOT_URL}${url}`;
    return `${fullUrl}${fullUrl.includes('?') ? '&' : '?'}v=${Date.now()}`;
  };

  const handleUpload = async (file) => {
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setError('La imagen es muy pesada (máximo 2MB)');
      return;
    }

    if (!file.type.startsWith('image/')) {
      setError('El archivo debe ser una imagen');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await apiClient.post(
        `/products/upload-image`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' }
        }
      );

      if (response.data.success) {
        onImageUpdate(response.data.image_url);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al subir la imagen');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!productId) {
      onImageUpdate(null);
      return;
    }
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
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleUpload(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="w-full">
      {currentImageUrl ? (
        <div className="relative group rounded-2xl border-2 border-slate-100 bg-white overflow-hidden aspect-square flex items-center justify-center transition-all hover:border-indigo-200 hover:shadow-lg">
          <img
            src={getImageUrl(currentImageUrl)}
            alt="Product"
            className="w-full h-full object-contain p-2 transition-transform duration-500 group-hover:scale-105"
            onError={(e) => { e.target.src = noImgPlaceholder; }}
          />

          {/* Action Overlay */}
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-3">
            <label className="cursor-pointer bg-white text-slate-800 p-3 rounded-xl hover:bg-indigo-50 hover:text-indigo-600 transition-all shadow-xl">
              <RefreshCw size={20} className={cn(uploading && "animate-spin")} />
              <input type="file" className="hidden" accept="image/*" onChange={(e) => handleUpload(e.target.files[0])} disabled={uploading} />
            </label>
            <button
              onClick={handleDelete}
              disabled={uploading}
              className="bg-rose-500 text-white p-3 rounded-xl hover:bg-rose-600 transition-all shadow-xl"
            >
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
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={cn(
            "relative rounded-2xl border-2 border-dashed aspect-square flex flex-col items-center justify-center transition-all cursor-pointer group",
            dragActive
              ? "border-indigo-500 bg-indigo-50/50 scale-[0.98]"
              : "border-slate-200 bg-slate-50/50 hover:border-indigo-300 hover:bg-white"
          )}
        >
          <input
            type="file"
            className="absolute inset-0 opacity-0 cursor-pointer"
            accept="image/*"
            disabled={uploading}
            onChange={(e) => handleUpload(e.target.files[0])}
          />

          <div className={cn(
            "w-16 h-16 rounded-full flex items-center justify-center transition-all mb-4",
            dragActive ? "bg-indigo-600 text-white scale-110" : "bg-white text-slate-400 border border-slate-100 group-hover:scale-110 group-hover:text-indigo-500 group-hover:border-indigo-100"
          )}>
            <ImageIcon size={32} />
          </div>

          <p className="text-xs font-bold text-slate-600 uppercase tracking-tighter">Arrastra una imagen</p>
          <p className="text-[10px] text-slate-400 mt-1">o haz clic para buscar</p>

          {uploading && (
            <div className="absolute inset-0 bg-white/60 backdrop-blur-sm rounded-2xl flex items-center justify-center">
              <Upload className="animate-spin text-indigo-600" size={32} />
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="mt-3 p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-2 animate-in slide-in-from-top-1">
          <X size={14} className="text-rose-500 mt-0.5 flex-shrink-0" />
          <p className="text-[10px] font-bold text-rose-600 leading-tight">{error}</p>
        </div>
      )}
    </div>
  );
}
