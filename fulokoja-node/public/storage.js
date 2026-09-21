const STORAGE_KEY = 'fulokoja_lms_state_v1';
const memoryStore = new Map();

function getStorage() {
  if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
    return globalThis.localStorage;
  }
  return {
    getItem(key) {
      return memoryStore.has(key) ? memoryStore.get(key) : null;
    },
    setItem(key, value) {
      memoryStore.set(key, String(value));
    },
    removeItem(key) {
      memoryStore.delete(key);
    },
  };
}

function readStore() {
  try {
    const storage = getStorage();
    const raw = storage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    return {};
  }
}

function writeStore(nextState) {
  const storage = getStorage();
  storage.setItem(STORAGE_KEY, JSON.stringify(nextState));
}

export function getPersistedToken() {
  const store = readStore();
  return store.authToken ?? null;
}

export function setPersistedToken(token) {
  const store = readStore();
  store.authToken = token;
  writeStore(store);
}

export function clearPersistedToken() {
  const store = readStore();
  delete store.authToken;
  writeStore(store);
}

export function saveDraft(key, value) {
  const store = readStore();
  store.drafts = store.drafts ?? {};
  if (value === null || value === undefined || value === '') {
    delete store.drafts[key];
  } else {
    store.drafts[key] = value;
  }
  writeStore(store);
}

export function loadDraft(key) {
  const store = readStore();
  return store.drafts?.[key] ?? null;
}

export function saveContext(context) {
  const store = readStore();
  store.context = { ...(store.context ?? {}), ...context };
  writeStore(store);
}

export function loadContext() {
  const store = readStore();
  return store.context ?? {};
}

export function clearClientStorage() {
  const storage = getStorage();
  storage.removeItem(STORAGE_KEY);
}
