import * as priceService from '../services/price.service.js';

export async function updatePrice(req, res) {
  res.json({ success: true, data: await priceService.updatePrice(req.params.id, req.body, req.admin.id) });
}

export async function history(req, res) {
  res.json({ success: true, data: await priceService.listPriceHistory(req.validatedQuery) });
}
