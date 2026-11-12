import { History, Images, IndianRupee, LayoutDashboard, MessageSquareText, Package, QrCode, Settings, Tags } from 'lucide-react';

/** Admin menu (labels are text keys, shown in the chosen language). */
export const ADMIN_NAV = [
  { path: 'dashboard', labelKey: 'admin.nav.dashboard', icon: LayoutDashboard },
  { path: 'products', labelKey: 'admin.nav.products', icon: Package },
  { path: 'categories', labelKey: 'admin.nav.categories', icon: Tags },
  { path: 'prices', labelKey: 'admin.nav.prices', icon: IndianRupee },
  { path: 'price-history', labelKey: 'admin.nav.priceHistory', icon: History },
  { path: 'reviews', labelKey: 'admin.nav.reviews', icon: MessageSquareText },
  { path: 'gallery', labelKey: 'admin.nav.gallery', icon: Images },
  { path: 'qr-code', labelKey: 'admin.nav.qrCode', icon: QrCode },
  { path: 'settings', labelKey: 'admin.nav.settings', icon: Settings },
];
