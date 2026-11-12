import * as authService from '../services/auth.service.js';

export async function login(req, res) {
  const result = await authService.login(req.body.email, req.body.password);
  res.json({ success: true, data: result });
}

export function me(req, res) {
  res.json({ success: true, data: { admin: req.admin } });
}
