import crypto from 'node:crypto';

const KEY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const SCRYPT_KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, SCRYPT_KEYLEN, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt}$${derived.toString('hex')}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') {
    return false;
  }
  const salt = parts[1];
  const expectedHex = parts[2];
  if (!salt || !expectedHex) {
    return false;
  }
  const expectedBuf = Buffer.from(expectedHex, 'hex');
  const derived = crypto.scryptSync(password, salt, expectedBuf.length, { N: 16384, r: 8, p: 1 });
  if (derived.length !== expectedBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(derived, expectedBuf);
}

export function deriveKeyBuffer(secretMaterial: string): Buffer {
  return crypto.createHash('sha256').update(secretMaterial).digest();
}

export function normalizeLicenseKey(rawKey: string): string {
  return rawKey.trim().toUpperCase();
}

export function hashKey(rawKey: string, secret: Buffer): string {
  return crypto.createHmac('sha256', secret).update(normalizeLicenseKey(rawKey)).digest('hex');
}

export function hashToken(rawToken: string, secret: Buffer): string {
  return crypto.createHmac('sha256', secret).update(rawToken).digest('hex');
}

export function encryptText(plaintext: string, secret: Buffer): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', secret, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptText(payload: string, secret: Buffer): string {
  const parts = payload.split(':');
  if (parts.length !== 3) {
    return '';
  }
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const ciphertext = Buffer.from(parts[2], 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', secret, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

export function generateLicenseKey(): string {
  const group = () => {
    let out = '';
    const bytes = crypto.randomBytes(4);
    for (let i = 0; i < 4; i++) {
      out += KEY_ALPHABET[bytes[i] % KEY_ALPHABET.length];
    }
    return out;
  };
  return `SAYAN-${group()}-${group()}-${group()}`;
}

export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function generateId(): string {
  return crypto.randomUUID();
}
