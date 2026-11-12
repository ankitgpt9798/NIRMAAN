import { getShopQrCode } from '../services/qr.service.js';

export async function get(_req, res) {
  res.json({ success: true, data: await getShopQrCode() });
}
