import { Package } from 'lucide-react';

interface ProductImageProps {
  imageUrl?: string | null;
  alt: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses = {
  sm: 'w-12 h-12',
  md: 'w-16 h-16',
  lg: 'w-24 h-24',
  xl: 'w-48 h-48',
};

export function ProductImage({ imageUrl, alt, size = 'sm', className = '' }: ProductImageProps) {
  const sizeClass = sizeClasses[size];

  if (!imageUrl) {
    return (
      <div className={`${sizeClass} flex-shrink-0 bg-slate-100 rounded-lg flex items-center justify-center ${className}`}>
        <Package className="w-5 h-5 text-slate-600" />
      </div>
    );
  }

  return (
    <div className={`${sizeClass} flex-shrink-0 ${className}`}>
      <img
        src={imageUrl}
        alt={alt}
        className="w-full h-full object-cover rounded-lg border border-slate-200"
        onError={(e) => {
          const parent = e.currentTarget.parentElement;
          if (parent) {
            parent.innerHTML = '<div class="bg-slate-100 rounded-lg w-full h-full flex items-center justify-center"><svg class="w-5 h-5 text-slate-600" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7.5 4.27 9 5.15"></path><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"></path><path d="m3.3 7 8.7 5 8.7-5"></path><path d="M12 22V12"></path></svg></div>';
          }
        }}
      />
    </div>
  );
}
