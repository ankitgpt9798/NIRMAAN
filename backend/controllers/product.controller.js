import * as productService from '../services/product.service.js';

export async function list(req, res) {
  res.json({ success: true, data: await productService.listProducts(req.validatedQuery) });
}

export async function get(req, res) {
  res.json({ success: true, data: await productService.getProduct(req.params.id) });
}

export async function create(req, res) {
  res.status(201).json({ success: true, data: await productService.createProduct(req.body) });
}

export async function update(req, res) {
  res.json({ success: true, data: await productService.updateProduct(req.params.id, req.body) });
}

export async function remove(req, res) {
  await productService.deleteProduct(req.params.id);
  res.json({ success: true, data: { id: req.params.id, deleted: true } });
}

export async function uploadImage(req, res) {
  res.json({ success: true, data: await productService.setProductImage(req.params.id, req.file.buffer) });
}

export async function removeImage(req, res) {
  res.json({ success: true, data: await productService.removeProductImage(req.params.id) });
}
