import React, { useState, useEffect } from 'react';
import { extractPublicDomain, getOfficialLogoUrl, getFallbackLogoUrl } from '@/lib/brand-fetcher';
import type { BrandInfo } from '@/types/vault';

export interface BrandAvatarProps {
  brand?: BrandInfo | null;
  url?: string | null;
  domain?: string | null;
  name?: string;
  brandColor?: string | null;
  customIconBase64?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const BrandAvatar: React.FC<BrandAvatarProps> = ({
  brand,
  url,
  domain,
  name = 'Service',
  brandColor,
  customIconBase64,
  size = 'md',
  className = '',
}) => {
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<boolean>(false);
  const [fallbackAttempted, setFallbackAttempted] = useState<boolean>(false);

  const sizeClasses = {
    sm: 'w-7 h-7 text-xs rounded-lg',
    md: 'w-10 h-10 text-sm rounded-xl',
    lg: 'w-14 h-14 text-lg rounded-2xl',
    xl: 'w-20 h-20 text-2xl rounded-3xl',
  }[size];

  const imageSizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-9 h-9',
    xl: 'w-14 h-14',
  }[size];

  // Resolve valid public domain from domain, url, or brand keywords
  const brandDomain = brand?.domain_keywords?.[0] || (brand?.slug ? `${brand.slug}.com` : undefined);
  const targetDomain = domain || url || brandDomain || '';
  const validDomain = extractPublicDomain(targetDomain);
  const effectiveColor = brandColor || brand?.brand_color;

  useEffect(() => {
    setLoadError(false);
    setFallbackAttempted(false);

    if (customIconBase64) {
      setImgSrc(customIconBase64);
    } else if (validDomain) {
      setImgSrc(getOfficialLogoUrl(validDomain));
    } else {
      setImgSrc(null);
    }
  }, [validDomain, customIconBase64]);

  const handleImageError = () => {
    if (!fallbackAttempted && validDomain) {
      setFallbackAttempted(true);
      setImgSrc(getFallbackLogoUrl(validDomain));
    } else {
      setLoadError(true);
    }
  };

  // Generate consistent Apple-style monogram fallback
  const monogram = (name.trim().charAt(0) || 'V').toUpperCase();

  // If we have an image and no permanent loading error
  if (imgSrc && !loadError) {
    return (
      <div
        className={`relative flex items-center justify-center shrink-0 overflow-hidden bg-white dark:bg-slate-900 border border-black/5 dark:border-white/10 shadow-sm transition-all duration-200 ${sizeClasses} ${className}`}
        style={effectiveColor ? { borderColor: `${effectiveColor}40` } : {}}
      >
        <img
          src={imgSrc}
          alt={name}
          className={`${imageSizes} object-contain transition-transform duration-200 hover:scale-105`}
          onError={handleImageError}
          loading="lazy"
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
        />
      </div>
    );
  }

  // Fallback monogram avatar with Apple subtle gradient
  return (
    <div
      className={`relative flex items-center justify-center shrink-0 font-bold uppercase tracking-wider select-none shadow-sm transition-all duration-200 ${sizeClasses} ${className}`}
      style={{
        backgroundColor: effectiveColor || '#6366f1',
        backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.2) 0%, rgba(0,0,0,0.15) 100%)',
        color: '#ffffff',
      }}
    >
      <span>{monogram}</span>
    </div>
  );
};
