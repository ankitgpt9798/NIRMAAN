/**
 * Stores the admin login token in localStorage so the owner stays logged in
 * until the token expires (JWT_EXPIRES_IN, default 1 day) or they log out.
 * Storage can be unavailable (private mode, blocked site data), so every
 * access is guarded; the app then simply asks the owner to log in again.
 */
const TOKEN_KEY = 'nirmaan.adminToken';

export const AUTH_EXPIRED_EVENT = 'nirmaan:auth-expired';

export function getToken() {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Login still works for this page view; it just will not survive a reload.
  }
}

export function clearToken() {
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Nothing stored, nothing to clear.
  }
}

export function isTokenStorageEvent(event) {
  return event.key === TOKEN_KEY || event.key === null;
}

/**
 * "Owner's device" marker. It is set when the owner logs in on this phone or
 * computer, and removed by Logout. The customer website shows its Admin button
 * only where this marker (or a login) exists, so customers never see the button.
 * This is a convenience only: admin pages and data still require the password.
 */
const ADMIN_DEVICE_KEY = 'nirmaan.adminDevice';

export function rememberAdminDevice() {
  try {
    window.localStorage.setItem(ADMIN_DEVICE_KEY, '1');
  } catch {
    // Storage blocked: the owner can still open /admin directly.
  }
}

export function forgetAdminDevice() {
  try {
    window.localStorage.removeItem(ADMIN_DEVICE_KEY);
  } catch {
    // Nothing stored.
  }
}

export function isAdminDevice() {
  try {
    return window.localStorage.getItem(ADMIN_DEVICE_KEY) === '1' || Boolean(window.localStorage.getItem(TOKEN_KEY));
  } catch {
    return false;
  }
}

export function isAdminDeviceStorageEvent(event) {
  return event.key === ADMIN_DEVICE_KEY || event.key === TOKEN_KEY || event.key === null;
}
