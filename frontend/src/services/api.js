import axios from 'axios';
import { AUTH_EXPIRED_EVENT, clearToken, getToken } from './authStorage';

/**
 * Single Axios instance for all backend calls.
 * - Local development: VITE_API_URL is empty, so requests go to /api on the Vite
 *   dev server, which forwards them to Express.
 * - Production: VITE_API_URL is the deployed API, e.g. https://your-api.onrender.com/api
 */
const baseURL = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');

export const api = axios.create({
  baseURL,
  // Free hosting tiers can take up to a minute to wake up after being idle.
  timeout: 60_000,
  headers: { Accept: 'application/json' },
});

// The login token is sent only to admin endpoints and /auth/me - never to public
// endpoints, and never to /auth/login (a wrong password there is not an expired session).
const NEEDS_TOKEN = /^\/?(admin(\/|$)|auth\/me$)/;

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token && NEEDS_TOKEN.test(config.url || '')) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

// A 401 on a request that carried a token means the session ended (expired,
// password reset, account removed): forget the token and tell the app.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const sentToken = Boolean(error.config?.headers?.get?.('Authorization'));
    if (error.response?.status === 401 && sentToken) {
      clearToken();
      window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT, { detail: error.response.data?.error }));
    }
    return Promise.reject(error);
  },
);

/** Turns any Axios error into a short message suitable for showing to the user. */
export function getErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  if (error?.response?.data?.error?.message) return error.response.data.error.message;
  if (error?.code === 'ECONNABORTED') return 'The server is taking too long to respond. Please try again.';
  if (error?.request && !error?.response) return 'Cannot reach the server. Please check your internet connection.';
  return fallback;
}
