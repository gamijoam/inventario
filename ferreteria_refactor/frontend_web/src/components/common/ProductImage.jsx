import React, { useState } from 'react';
import { API_ROOT_URL } from '../../config/constants';
import noImgPlaceholder from '../../assets/no-img.svg';

/**
 * ProductImage Component
 * Handles cross-domain image URLs, cache busting, and provides a fallback placeholder.
 */
const ProductImage = ({ src, alt, className, iconSize = 24, updatedAt }) => {
    const [error, setError] = useState(false);

    // Cache busting with updated_at (or current time if not provided)
    const getVersionedUrl = (url) => {
        if (!updatedAt) return url;
        const timestamp = new Date(updatedAt).getTime();
        return `${url}${url.includes('?') ? '&' : '?'}v=${timestamp}`;
    };

    if (!src || error) {
        return (
            <img
                src={noImgPlaceholder}
                alt="Sin imagen"
                className={`${className} object-cover opacity-50 grayscale`}
            />
        );
    }

    // Prepend BASE_API_URL if it's not an absolute URL (doesn't start with http)
    const isAbsolute = src.startsWith('http');
    const fullUrl = isAbsolute ? src : `${API_ROOT_URL}${src}`;
    const finalUrl = getVersionedUrl(fullUrl);

    // Final class logic
    const imgClass = `${className || ''} ${className?.includes('object-') ? '' : 'object-cover'}`.trim();

    return (
        <img
            src={finalUrl}
            alt={alt || "Producto"}
            className={imgClass}
            onError={() => setError(true)}
            loading="lazy"
            decoding="async"
            draggable="false"
        />
    );
};

export default ProductImage;

