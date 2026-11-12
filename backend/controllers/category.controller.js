import * as categoryService from '../services/category.service.js';

export async function list(_req, res) {
  res.json({ success: true, data: { items: await categoryService.listCategories() } });
}

export async function create(req, res) {
  res.status(201).json({ success: true, data: await categoryService.createCategory(req.body) });
}

export async function update(req, res) {
  res.json({ success: true, data: await categoryService.updateCategory(req.params.id, req.body) });
}

export async function remove(req, res) {
  await categoryService.deleteCategory(req.params.id);
  res.json({ success: true, data: { id: req.params.id, deleted: true } });
}
