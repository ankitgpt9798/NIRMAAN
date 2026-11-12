import * as shopService from '../services/shop.service.js';

export async function get(_req, res) {
  res.json({ success: true, data: await shopService.getShopSettings() });
}

export async function update(req, res) {
  res.json({ success: true, data: await shopService.updateShopSettings(req.body) });
}

export async function uploadLogo(req, res) {
  res.json({ success: true, data: await shopService.setShopLogo(req.file.buffer) });
}

export async function removeLogo(_req, res) {
  res.json({ success: true, data: await shopService.removeShopLogo() });
}
