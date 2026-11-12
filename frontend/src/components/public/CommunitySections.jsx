import GallerySection from './GallerySection';
import ReviewsSection from './ReviewsSection';
import ShopPhotoSection from './ShopPhotoSection';

/**
 * Everything below the product list: shop photo, photo gallery and customer reviews.
 * Loaded as a separate small file after the prices, so the price list opens as fast
 * as before on slow mobile data.
 */
export default function CommunitySections({ shop }) {
  return (
    <>
      <ShopPhotoSection shop={shop} />
      <GallerySection />
      <ReviewsSection />
    </>
  );
}
