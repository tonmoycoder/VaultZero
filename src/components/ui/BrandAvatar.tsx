import React from 'react';
import type { BrandInfo } from '@/types/vault';

interface BrandAvatarProps {
  brand?: BrandInfo | null;
  slug?: string | null;
  name?: string;
  brandColor?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const BrandAvatar: React.FC<BrandAvatarProps> = ({
  brand,
  slug,
  name = 'Service',
  brandColor,
  size = 'md',
  className = '',
}) => {
  const sizeClasses = {
    sm: 'w-7 h-7 text-xs rounded-md',
    md: 'w-10 h-10 text-sm rounded-xl',
    lg: 'w-14 h-14 text-lg rounded-2xl',
    xl: 'w-20 h-20 text-2xl rounded-3xl',
  }[size];

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-8 h-8',
    xl: 'w-11 h-11',
  }[size];

  const bgColor = brandColor || brand?.brand_color || '#3b82f6';
  const textColor = brand?.text_color || '#ffffff';

  if (brand?.svg_icon) {
    return (
      <div
        className={`flex items-center justify-center shadow-md font-semibold shrink-0 transition-transform duration-200 ${sizeClasses} ${className}`}
        style={{ backgroundColor: bgColor, color: textColor }}
        dangerouslySetInnerHTML={{
          __html: brand.svg_icon.replace(
            '<svg ',
            `<svg class="${iconSizes}" `
          ),
        }}
      />
    );
  }

  // Fallback to crisp initial letters
  const initials = (name || slug || 'V')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className={`flex items-center justify-center shadow-md font-bold shrink-0 transition-transform duration-200 ${sizeClasses} ${className}`}
      style={{ backgroundColor: bgColor, color: textColor }}
    >
      <span>{initials}</span>
    </div>
  );
};

