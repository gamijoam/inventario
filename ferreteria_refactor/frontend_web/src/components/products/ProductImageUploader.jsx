import { useState } from 'react';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import apiClient from '../../config/axios';
import { BASE_API_URL, API_ROOT_URL } from '../../config/constants';
import noImgPlaceholder from '../../assets/no-img.svg';
import clsx from 'clsx';

export default function ProductImageUploader({ productId, currentImageUrl, onImageUpdate }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  // Cache busting: add timestamp to force reload + cross-domain support
  const getImageUrl = (url) => {
    if (!url) return null;
    const isAbsolute = url.startsWith('http');
    const fullUrl = isAbsolute ? url : `${API_ROOT_URL}${url}`;
    return `${fullUrl}${fullUrl.includes('?') ? '&' : '?'}v=${Date.now()}`;
  };



  const handleUpload = async (file) => {
    if (!file) return;

    // Validate using filesize (2MB max)
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

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleUpload(e.target.files[0]);
    }
  };

  return (
    <div className="space-y-4">
      {/* Preview */}
      {currentImageUrl ? (
        <div className="relative group overflow-hidden rounded-2xl border border-slate-200 shadow-sm bg-slate-50 flex items-center justify-center min-h-[160px]">
          <img
            src={getImageUrl(currentImageUrl)}
            alt="Producto"
            className="max-w-full max-h-64 object-contain transition-transform duration-500 group-hover:scale-105"
            onError={(e) => {
              e.target.src = noImgPlaceholder;
            }}
          />
          {/* Overlay with Actions */}
          <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3 backdrop-blur-[2px]">
            <div className="flex gap-2">
              <label
                htmlFor="image-upload-change"
                className="cursor-pointer bg-white text-slate-900 px-4 py-2 rounded-xl hover:bg-slate-100 transition-all font-bold text-sm flex items-center gap-2 shadow-xl"
              >
                <Upload size={16} /> Cambiar
                <input
                  type="file"
                  id="image-upload-change"
                  accept="image/*"
                  onChange={handleFileInput}
                  className="hidden"
                  disabled={uploading}
                />
              </label>
              <button
                onClick={handleDelete}
                disabled={uploading}
                className="bg-rose-500 text-white p-2 rounded-xl hover:bg-rose-600 disabled:opacity-50 transition-all shadow-xl"
                title="Eliminar imagen"
              >
                <X size={20} />
              </button>
            </div>
          </div>
          {uploading && (
            <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
              <Upload className="animate-spin text-indigo-500" size={32} />
            </div>
          )}
        </div>
      ) : (
        /* Upload Area */
        <div
          className={clsx(
            "border-2 border-dashed rounded-2xl p-6 text-center transition-all duration-300 min-h-[160px] flex items-center justify-center",
            dragActive
              ? 'border-indigo-500 bg-indigo-50/50 scale-[1.02]'
              : 'border-slate-300 hover:border-indigo-300 hover:bg-slate-50'
          )}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            type="file"
            id="image-upload"
            accept="image/*"
            onChange={handleFileInput}
            className="hidden"
            disabled={uploading}
          />
          <label
            htmlFor="image-upload"
            className="cursor-pointer flex flex-col items-center w-full"
          >
            {uploading ? (
              <div className="p-4 bg-indigo-50 rounded-full mb-2">
                <Upload className="animate-spin text-indigo-500" size={32} />
              </div>
            ) : (
              <div className={clsx(
                "p-3 rounded-full mb-2 transition-colors",
                dragActive ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 text-slate-400"
              )}>
                <ImageIcon size={28} />
              </div>
            )}
            <p className="text-xs font-bold text-slate-700">
              {uploading ? 'Subiendo...' : 'Subir Imagen'}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5 font-medium">
              JPG, PNG o WebP
            </p>
          </label>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-3 py-2 rounded-xl text-[11px] font-medium flex items-center">
          <X size={14} className="mr-2 flex-shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}
