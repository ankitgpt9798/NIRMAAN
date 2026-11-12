import { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthContext } from './AuthContext';
import { fetchCurrentAdmin, loginRequest } from '../services/authService';
import {
  AUTH_EXPIRED_EVENT,
  clearToken,
  forgetAdminDevice,
  getToken,
  isTokenStorageEvent,
  rememberAdminDevice,
  setToken,
} from '../services/authStorage';

// `notice` is a text key (shown translated on the login page), e.g. 'admin.auth.loggedOut'.
const SIGNED_OUT = { status: 'signed-out', admin: null, notice: '' };

const sessionNotice = (code) => (code === 'TOKEN_EXPIRED' ? 'admin.auth.sessionExpired' : 'admin.auth.sessionEnded');

function connectionNotice(error) {
  if (error?.code === 'ECONNABORTED') return 'admin.error.timeout';
  if (error?.request && !error?.response) return 'admin.error.network';
  return 'admin.error.generic';
}

export default function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => (getToken() ? { status: 'checking', admin: null, notice: '' } : SIGNED_OUT));
  const [verifyAttempt, setVerifyAttempt] = useState(0);

  // On load (and on "Try again"), confirm a saved token is still valid.
  useEffect(() => {
    if (!getToken()) return undefined;
    let active = true;
    fetchCurrentAdmin()
      .then((admin) => {
        if (!active) return;
        rememberAdminDevice();
        setAuth({ status: 'signed-in', admin, notice: '' });
      })
      .catch((error) => {
        if (!active) return;
        if (error.response?.status === 401) {
          setAuth({ ...SIGNED_OUT, notice: sessionNotice(error.response.data?.error?.code) });
        } else {
          setAuth({ status: 'error', admin: null, notice: connectionNotice(error) });
        }
      });
    return () => {
      active = false;
    };
  }, [verifyAttempt]);

  // Session ended on the server (any admin request got 401), or the owner
  // logged out in another tab.
  useEffect(() => {
    const onExpired = (event) => setAuth({ ...SIGNED_OUT, notice: sessionNotice(event.detail?.code) });
    const onStorage = (event) => {
      if (isTokenStorageEvent(event) && !getToken()) setAuth({ ...SIGNED_OUT, notice: 'admin.auth.loggedOutElsewhere' });
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const { token, admin } = await loginRequest(email, password);
    setToken(token);
    rememberAdminDevice(); // the customer website now shows the Admin button on this device
    setAuth({ status: 'signed-in', admin, notice: '' });
  }, []);

  // Logout also removes the Admin button from the customer website on this device.
  // (When a login merely expires, the button stays so the owner can log in again.)
  const logout = useCallback(() => {
    clearToken();
    forgetAdminDevice();
    setAuth({ ...SIGNED_OUT, notice: 'admin.auth.loggedOut' });
  }, []);

  const retry = useCallback(() => {
    setAuth((current) => ({ ...current, status: 'checking' }));
    setVerifyAttempt((n) => n + 1);
  }, []);

  const value = useMemo(() => ({ ...auth, login, logout, retry }), [auth, login, logout, retry]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
