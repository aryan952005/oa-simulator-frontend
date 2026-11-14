import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { resetClock } from '../lib/clock';

// Monaco cannot run in jsdom. Every test gets a plain textarea instead (see StubEditor).
vi.mock('../components/CodeEditor', async () => ({ default: (await import('./StubEditor')).default }));

// Many test files run at once, so a slow machine can need longer than the 1 second default.
configure({ asyncUtilTimeout: 4000 });

// Newer Node versions ship an experimental global `localStorage` that has no methods unless a
// storage file is configured, and it hides jsdom's. If that has happened, use an in-memory Storage.
class MemoryStorage {
  #items = new Map();

  get length() {
    return this.#items.size;
  }

  key(index) {
    return [...this.#items.keys()][index] ?? null;
  }

  getItem(key) {
    const value = this.#items.get(String(key));
    return value === undefined ? null : value;
  }

  setItem(key, value) {
    this.#items.set(String(key), String(value));
  }

  removeItem(key) {
    this.#items.delete(String(key));
  }

  clear() {
    this.#items.clear();
  }
}

for (const name of ['localStorage', 'sessionStorage']) {
  if (typeof globalThis[name]?.setItem !== 'function') {
    const storage = new MemoryStorage();
    Object.defineProperty(globalThis, name, { value: storage, configurable: true, writable: true });
    if (typeof window !== 'undefined' && window !== globalThis) {
      Object.defineProperty(window, name, { value: storage, configurable: true, writable: true });
    }
  }
}

// The workspace needs a wide screen (FD8). jsdom's default window is only 1024 wide.
window.innerWidth = 1400;

afterEach(() => {
  cleanup();
  resetClock();
  window.innerWidth = 1400;
  localStorage.clear();
  sessionStorage.clear();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
