import * as publicService from '../services/public.service.js';

export async function shop(_req, res) {
  res.json({ success: true, data: await publicService.getPublicShop() });
}

export async function products(req, res) {
  res.json({ success: true, data: await publicService.listPublicProducts(req.validatedQuery) });
}

export async function product(req, res) {
  res.json({ success: true, data: await publicService.getPublicProduct(req.params.id) });
}

export async function categories(_req, res) {
  res.json({ success: true, data: { items: await publicService.listPublicCategories() } });
}
