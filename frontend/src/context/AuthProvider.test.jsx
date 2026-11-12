import { useLayoutEffect } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import AuthProvider from './AuthProvider';
import { useAuth } from './AuthContext';
import { fetchCurrentAdmin, loginRequest } from '../services/authService';
import { isAdminDevice } from '../services/authStorage';

vi.mock('../services/authService', () => ({ loginRequest: vi.fn(), fetchCurrentAdmin: vi.fn() }));

const ADMIN = { id: 'a1', name: 'Sample Owner', email: 'owner@test.local', role: 'admin' };
const latest = { current: null };
function Probe() {
  const auth = useAuth();
  useLayoutEffect(() => {
    latest.current = auth;
  });
  return <p>{auth.status}</p>;
}
const renderAuth = () => render(<AuthProvider><Probe /></AuthProvider>);

describe('owner’s-device marker (Admin button on the customer site)', () => {
  it('is set when the owner logs in on this device', async () => {
    loginRequest.mockResolvedValue({ token: 'tok', admin: ADMIN });
    renderAuth();
    expect(isAdminDevice()).toBe(false);
    await act(() => latest.current.login('owner@test.local', 'pw'));
    expect(screen.getByText('signed-in')).toBeInTheDocument();
    expect(window.localStorage.getItem('nirmaan.adminDevice')).toBe('1');
    expect(isAdminDevice()).toBe(true);
  });

  it('is removed by Logout, so the button disappears from this device', async () => {
    loginRequest.mockResolvedValue({ token: 'tok', admin: ADMIN });
    renderAuth();
    await act(() => latest.current.login('owner@test.local', 'pw'));
    act(() => latest.current.logout());
    expect(screen.getByText('signed-out')).toBeInTheDocument();
    expect(window.localStorage.getItem('nirmaan.adminToken')).toBeNull();
    expect(isAdminDevice()).toBe(false);
  });

  it('is set for an owner who was already logged in before this feature', async () => {
    window.localStorage.setItem('nirmaan.adminToken', 'existing-token');
    fetchCurrentAdmin.mockResolvedValue(ADMIN);
    renderAuth();
    await waitFor(() => expect(screen.getByText('signed-in')).toBeInTheDocument());
    expect(window.localStorage.getItem('nirmaan.adminDevice')).toBe('1');
  });

  it('stays when a login merely expires, so the owner can log in again from the button', async () => {
    window.localStorage.setItem('nirmaan.adminDevice', '1');
    window.localStorage.setItem('nirmaan.adminToken', 'expired-token');
    fetchCurrentAdmin.mockRejectedValue(Object.assign(new Error('expired'), { response: { status: 401, data: { error: { message: 'Your session has expired.' } } } }));
    renderAuth();
    await waitFor(() => expect(screen.getByText('signed-out')).toBeInTheDocument());
    expect(isAdminDevice()).toBe(true);
  });
});
