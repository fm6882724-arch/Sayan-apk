const REMEMBER_STORAGE_KEY = 'sayan_mode_remember_v1';
const USER_TOKEN_KEY = 'sayan_mode_session_token';
const ADMIN_TOKEN_KEY = 'sayan_mode_admin_token';
const LANG_STORAGE_KEY = 'sayan_mode_lang';
const IDB_NAME = 'sayan_mode_keystore';
const IDB_STORE = 'keys';
const IDB_KEY_ID = 'aes_key';

function openKeyDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(IDB_STORE)) {
        req.result.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getOrCreateAesKey(): Promise<CryptoKey> {
  const db = await openKeyDb();
  const existing = await new Promise<CryptoKey | undefined>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const getReq = tx.objectStore(IDB_STORE).get(IDB_KEY_ID);
    getReq.onsuccess = () => resolve(getReq.result as CryptoKey | undefined);
    getReq.onerror = () => reject(getReq.error);
  });

  if (existing) {
    db.close();
    return existing;
  }

  const generated = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(generated, IDB_KEY_ID);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  db.close();
  return generated;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

export async function saveRememberedKey(rawKey: string): Promise<void> {
  const trimmed = rawKey.trim();
  if (!trimmed) {
    clearRememberedKey();
    return;
  }

  try {
    if (window.crypto?.subtle && window.indexedDB) {
      const aesKey = await getOrCreateAesKey();
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encoded = new TextEncoder().encode(trimmed);
      const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, encoded);
      localStorage.setItem(
        REMEMBER_STORAGE_KEY,
        JSON.stringify({
          v: 2,
          iv: bytesToBase64(iv),
          ct: bytesToBase64(new Uint8Array(cipherBuf)),
        }),
      );
      return;
    }
  } catch {
    // Fallback if WebCrypto/IndexedDB is unavailable
  }

  localStorage.setItem(
    REMEMBER_STORAGE_KEY,
    JSON.stringify({ v: 1, b64: btoa(unescape(encodeURIComponent(trimmed))) }),
  );
}

export async function loadRememberedKey(): Promise<string> {
  const raw = localStorage.getItem(REMEMBER_STORAGE_KEY);
  if (!raw) return '';

  try {
    const parsed = JSON.parse(raw) as { v: number; iv?: string; ct?: string; b64?: string };
    if (parsed.v === 2 && parsed.iv && parsed.ct && window.crypto?.subtle && window.indexedDB) {
      const aesKey = await getOrCreateAesKey();
      const iv = base64ToBytes(parsed.iv);
      const ct = base64ToBytes(parsed.ct);
      const plainBuf = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
        aesKey,
        ct.buffer as ArrayBuffer,
      );
      return new TextDecoder().decode(plainBuf);
    }
    if (parsed.v === 1 && parsed.b64) {
      return decodeURIComponent(escape(atob(parsed.b64)));
    }
  } catch {
    localStorage.removeItem(REMEMBER_STORAGE_KEY);
  }

  return '';
}

export function clearRememberedKey(): void {
  localStorage.removeItem(REMEMBER_STORAGE_KEY);
}

export function saveUserSessionToken(token: string): void {
  sessionStorage.setItem(USER_TOKEN_KEY, token);
}

export function getUserSessionToken(): string | null {
  return sessionStorage.getItem(USER_TOKEN_KEY);
}

export function clearUserSessionToken(): void {
  sessionStorage.removeItem(USER_TOKEN_KEY);
}

export function saveAdminSessionToken(token: string): void {
  sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
}

export function getAdminSessionToken(): string | null {
  return sessionStorage.getItem(ADMIN_TOKEN_KEY);
}

export function clearAdminSessionToken(): void {
  sessionStorage.removeItem(ADMIN_TOKEN_KEY);
}

export function saveLanguagePreference(lang: 'en' | 'hi'): void {
  localStorage.setItem(LANG_STORAGE_KEY, lang);
}

export function loadLanguagePreference(): 'en' | 'hi' {
  const val = localStorage.getItem(LANG_STORAGE_KEY);
  return val === 'hi' ? 'hi' : 'en';
}
