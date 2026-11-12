import { api } from './api';

export async function loginRequest(email, password) {
  const response = await api.post('/auth/login', { email, password });
  return response.data.data; // { token, expiresAt, admin }
}

export async function fetchCurrentAdmin() {
  const response = await api.get('/auth/me');
  return response.data.data.admin;
}
