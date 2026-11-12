import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// jsdom does not implement scrolling or object URLs (used for photo previews).
window.scrollTo = vi.fn();
URL.createObjectURL = vi.fn(() => 'blob:preview');
URL.revokeObjectURL = vi.fn();

afterEach(async () => {
  cleanup();
  window.sessionStorage.clear(); // remembered language
  window.localStorage.clear(); // admin login token / owner's-device marker
  document.documentElement.lang = '';
  // Imported lazily: a static import here would load the real API client before
  // each test file's vi.mock() is registered, so the mocks would be bypassed.
  const { resetCatalogCache } = await import('../services/catalogCache');
  resetCatalogCache();
});
