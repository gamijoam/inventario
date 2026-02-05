import React, { useState } from 'react';
import { BASE_API_URL } from '../../config/constants';
import noImgPlaceholder from '../../assets/no-img.svg';

/**
 * ProductImage Component
 * Handles cross-domain image URLs, cache busting, and provides a fallback placeholder.
 */
const ProductImage = ({ src, alt, className, iconSize = 24, updatedAt }) => {
    const [error, setError] = useState(false);

    // Cache busting with updated_at (or current time if not provided)
    const getVersionedUrl = (url) => {
        const timestamp = updatedAt ? new Date(updatedAt).getTime() : Date.now();
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
    const fullUrl = isAbsolute ? src : `${BASE_API_URL}${src}`;
    const finalUrl = getVersionedUrl(fullUrl);

    return (
        <img
            src={finalUrl}
            alt={alt || "Producto"}
            className={`${className} object-cover`}
            onError={() => setError(true)}
            loading="lazy"
        />
    );
};

export default ProductImage;

