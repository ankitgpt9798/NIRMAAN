import { useEffect, useState } from 'react';
import { isAdminDevice, isAdminDeviceStorageEvent } from '../services/authStorage';

/** True on the shop owner's phone/computer (logged in there before); false for customers. */
export function useAdminDevice() {
  const [adminDevice, setAdminDevice] = useState(isAdminDevice);

  // Logging in or out in another tab updates this page too.
  useEffect(() => {
    const onStorage = (event) => {
      if (isAdminDeviceStorageEvent(event)) setAdminDevice(isAdminDevice());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return adminDevice;
}
