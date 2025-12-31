import { useState } from 'react';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import apiClient from '../../config/axios';

export default function ProductImageUploader({ productId, currentImageUrl, onImageUpdate }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  // Cache busting: add timestamp to force reload
  const getImageUrl = (url) => {
    if (!url) return null;
    // Use relative path - works in both dev and production
    return `${url}?v=${Date.now()}`;
  };

  const handleUpload = async (file) => {
    if (!file) return;

    // Validate file size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      setError('La imagen es muy pesada (máximo 2MB)');
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('El archivo debe ser una imagen');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      // Use apiClient which already has /api/v1 prefix
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
      // Use apiClient which already has /api/v1 prefix
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
        <div className="relative inline-block">
          <img
            src={getImageUrl(currentImageUrl)}
            alt="Producto"
            className="w-64 h-64 object-cover rounded-lg border-2 border-gray-200"
            onError={(e) => {
              e.target.src = '/placeholder.png'; // Fallback
            }}
          />
          <button
            onClick={handleDelete}
            disabled={uploading}
            className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full hover:bg-red-600 disabled:opacity-50"
            title="Eliminar imagen"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        /* Upload Area */
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
            }`}
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
              <Upload className="animate-spin text-blue-500" size={48} />
            ) : (
              <ImageIcon className="text-gray-400" size={48} />
            )}
            <p className="mt-2 text-sm text-gray-600">
              {uploading ? 'Subiendo...' : 'Arrastra una imagen o haz clic para seleccionar'}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              JPG, PNG o WebP (máx. 2MB)
            </p>
          </label>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}
    </div>
  );
}
