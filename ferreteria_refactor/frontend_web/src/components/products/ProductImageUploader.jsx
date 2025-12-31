import { useState } from 'react';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import apiClient from '../../config/axios';
import clsx from 'clsx';

export default function ProductImageUploader({ productId, currentImageUrl, onImageUpdate }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  // Cache busting: add timestamp to force reload
  const getImageUrl = (url) => {
    if (!url) return null;
    return `${url}?v=${Date.now()}`;
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
        `/products/${productId}/image`,
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
        <div className="relative inline-block group">
          <div className="relative overflow-hidden rounded-2xl border border-slate-200 shadow-sm bg-slate-50">
            <img
              src={getImageUrl(currentImageUrl)}
              alt="Producto"
              className="w-full h-64 object-cover transition-transform duration-500 group-hover:scale-105"
              onError={(e) => {
                e.target.src = '/placeholder.png';
              }}
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
              <button
                onClick={handleDelete}
                disabled={uploading}
                className="bg-rose-500 text-white p-3 rounded-xl hover:bg-rose-600 disabled:opacity-50 transform hover:scale-110 transition-all shadow-lg"
                title="Eliminar imagen"
              >
                <X size={24} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Upload Area */
        <div
          className={clsx(
            "border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-300",
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
            className="cursor-pointer flex flex-col items-center"
          >
            {uploading ? (
              <div className="p-4 bg-indigo-50 rounded-full mb-3">
                <Upload className="animate-spin text-indigo-500" size={32} />
              </div>
            ) : (
              <div className={clsx(
                "p-4 rounded-full mb-3 transition-colors",
                dragActive ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500"
              )}>
                <ImageIcon size={32} />
              </div>
            )}
            <p className="mt-2 text-sm font-bold text-slate-700">
              {uploading ? 'Subiendo...' : 'Arrastra una imagen o haz clic aquí'}
            </p>
            <p className="text-xs text-slate-400 mt-1 font-medium">
              JPG, PNG o WebP (máx. 2MB)
            </p>
          </label>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-sm font-medium flex items-center">
          <X size={16} className="mr-2 flex-shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}
