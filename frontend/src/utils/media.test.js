import { describe, expect, it } from 'vitest';
import { imageSrcSet, resizedImageUrl } from './media';

const CLOUDINARY = 'https://res.cloudinary.com/demo/image/upload/c_limit,h_800,w_800/f_auto,q_auto/v1/nirmaan/products/abc';

describe('responsive image URLs', () => {
  it('asks Cloudinary for a smaller copy', () => {
    expect(resizedImageUrl(CLOUDINARY, 200)).toBe('https://res.cloudinary.com/demo/image/upload/c_limit,h_200,w_200/f_auto,q_auto/v1/nirmaan/products/abc');
  });

  it('offers 200, 400 and 800 px versions to the browser', () => {
    expect(imageSrcSet(CLOUDINARY)).toBe(
      [200, 400, 800].map((w) => `https://res.cloudinary.com/demo/image/upload/c_limit,h_${w},w_${w}/f_auto,q_auto/v1/nirmaan/products/abc ${w}w`).join(', '),
    );
  });

  it('leaves images stored on the server unchanged', () => {
    expect(resizedImageUrl('/uploads/products/abc.jpg', 200)).toBe('/uploads/products/abc.jpg');
    expect(imageSrcSet('/uploads/products/abc.jpg')).toBeUndefined();
    expect(resizedImageUrl('', 200)).toBe('');
    expect(imageSrcSet(undefined)).toBeUndefined();
  });
});
