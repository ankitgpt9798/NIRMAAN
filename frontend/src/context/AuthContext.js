import { createContext, useContext } from 'react';

/**
 * Admin login state, provided by <AuthProvider> (admin area only).
 * status: 'checking' | 'signed-in' | 'signed-out' | 'error'
 */
export const AuthContext = createContext(null);

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}
