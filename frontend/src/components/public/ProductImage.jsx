import { useState } from 'react';
import { Package } from 'lucide-react';
import { imageSrcSet, resizedImageUrl } from '../../utils/media';

/**
 * Lazy-loaded product photo in a fixed-size box, or a simple icon when there is
 * no photo. `sizes` tells the browser how wide the photo is shown, so it can
 * download a small copy for list thumbnails and a larger one for the product page.
 */
export default function ProductImage({ image, alt, className = '', eager = false, noImageLabel, sizes = '(min-width: 640px) 300px, 96px' }) {
  const [failed, setFailed] = useState(false);
  const url = resizedImageUrl(image?.url, 400);
  const srcSet = imageSrcSet(image?.url);

  return (
    <div className={`flex items-center justify-center overflow-hidden ${url && !failed ? 'bg-slate-100' : 'bg-linear-to-br from-brand-50 to-slate-100'} ${className}`}>
      {url && !failed ? (
        <img
          src={url}
          srcSet={srcSet}
          sizes={srcSet ? sizes : undefined}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          width="400"
          height="400"
          onError={() => setFailed(true)}
          className="size-full object-cover"
        />
      ) : (
        <Package className="size-1/3 max-h-12 max-w-12 text-brand-300" role="img" aria-label={noImageLabel} />
      )}
    </div>
  );
}
