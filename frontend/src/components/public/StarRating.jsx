import { Star } from 'lucide-react';

/** Five stars, filled up to `rating` (rounded). `label` is what screen readers hear. */
export default function StarRating({ rating, label, size = 'size-5' }) {
  const filled = Math.round(rating);
  return (
    <span role="img" aria-label={label} className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={`${size} ${n <= filled ? 'fill-amber-400 text-amber-500' : 'fill-transparent text-slate-300'}`} aria-hidden="true" />
      ))}
    </span>
  );
}
