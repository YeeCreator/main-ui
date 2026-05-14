import type { WorkbenchDocument } from '../workspace/types';
import type { PersistenceAdapter } from './types';

export const createMemoryPersistenceAdapter = (initialDocument: WorkbenchDocument | null = null): PersistenceAdapter => {
  let storedDocument = initialDocument;

  return {
    async load() {
      return storedDocument ? structuredClone(storedDocument) : null;
    },
    async save(document) {
      storedDocument = structuredClone(document);
    },
    async clear() {
      storedDocument = null;
    },
  };
};

export const createLocalStoragePersistenceAdapter = (storageKey: string): PersistenceAdapter => ({
  async load() {
    if (typeof localStorage === 'undefined') {
      return null;
    }

    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as WorkbenchDocument;
    } catch {
      return null;
    }
  },
  async save(document) {
    if (typeof localStorage === 'undefined') {
      return;
    }

    localStorage.setItem(storageKey, JSON.stringify(document));
  },
  async clear() {
    if (typeof localStorage === 'undefined') {
      return;
    }

    localStorage.removeItem(storageKey);
  },
});
