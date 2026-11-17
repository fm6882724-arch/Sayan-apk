import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.ts';
import { deriveKeyBuffer, hashPassword } from './security.ts';

const dbDir = path.dirname(config.sqliteDbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db = new Database(config.sqliteDbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS server_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS admin_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS license_keys (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    key_hash TEXT NOT NULL UNIQUE,
    key_ciphertext TEXT NOT NULL,
    app_version TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    revoked_at INTEGER,
    last_login_at INTEGER,
    last_active_at INTEGER,
    last_device_model TEXT,
    last_android_version TEXT,
    created_by_ip TEXT
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    token_hash TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL CHECK (role IN ('user', 'admin')),
    key_id TEXT,
    device_model TEXT,
    android_version TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at INTEGER NOT NULL,
    last_active_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    revoked_at INTEGER,
    FOREIGN KEY (key_id) REFERENCES license_keys(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS login_attempts (
    identifier TEXT PRIMARY KEY,
    attempts INTEGER NOT NULL DEFAULT 0,
    locked_until INTEGER,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS login_history (
    id TEXT PRIMARY KEY,
    key_id TEXT,
    user_id TEXT,
    device_model TEXT,
    android_version TEXT,
    app_version TEXT,
    ip_address TEXT,
    status TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    target_id TEXT,
    details TEXT NOT NULL,
    ip_address TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS user_preferences (
    key_id TEXT PRIMARY KEY,
    preferences_json TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (key_id) REFERENCES license_keys(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS feedback_messages (
    id TEXT PRIMARY KEY,
    key_id TEXT,
    user_id TEXT NOT NULL,
    message TEXT NOT NULL,
    telegram_sent INTEGER NOT NULL DEFAULT 0,
    telegram_error TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
  CREATE INDEX IF NOT EXISTS idx_sessions_key_id ON sessions(key_id);
  CREATE INDEX IF NOT EXISTS idx_login_history_key_id ON login_history(key_id);
  CREATE INDEX IF NOT EXISTS idx_login_history_created_at ON login_history(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
`);

let cachedSecretBuffer: Buffer | null = null;

export function getAppSecretBuffer(): Buffer {
  if (cachedSecretBuffer) {
    return cachedSecretBuffer;
  }
  const envSecret = config.appSecretEnv;
  const isPlaceholder =
    !envSecret || envSecret.includes('CHANGE_THIS') || envSecret.length < 16;

  if (!isPlaceholder) {
    cachedSecretBuffer = deriveKeyBuffer(envSecret);
    return cachedSecretBuffer;
  }

  const row = db
    .prepare('SELECT value FROM server_meta WHERE key = ?')
    .get('runtime_app_secret') as { value: string } | undefined;

  if (row?.value) {
    cachedSecretBuffer = deriveKeyBuffer(row.value);
    return cachedSecretBuffer;
  }

  const generated = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO server_meta (key, value, updated_at) VALUES (?, ?, ?)').run(
    'runtime_app_secret',
    generated,
    Date.now(),
  );
  cachedSecretBuffer = deriveKeyBuffer(generated);
  return cachedSecretBuffer;
}

export function isAppSecretConfiguredInEnv(): boolean {
  const envSecret = config.appSecretEnv;
  return Boolean(
    envSecret && !envSecret.includes('CHANGE_THIS') && envSecret.length >= 16,
  );
}

export function isAdminConfigured(): {
  configured: boolean;
  viaEnv: boolean;
} {
  if (config.adminPasswordEnv.length >= 8) {
    return { configured: true, viaEnv: true };
  }
  const row = db.prepare('SELECT id FROM admin_config WHERE id = 1').get() as
    | { id: number }
    | undefined;
  return { configured: Boolean(row), viaEnv: false };
}

export function ensureEnvAdminHashed(): string | null {
  if (config.adminPasswordEnv.length >= 8) {
    // Store or keep env-derived hash in memory only; verify against env directly via scrypt
    return hashPassword(config.adminPasswordEnv);
  }
  const row = db
    .prepare('SELECT password_hash FROM admin_config WHERE id = 1')
    .get() as { password_hash: string } | undefined;
  return row?.password_hash ?? null;
}

export function writeAuditLog(params: {
  actor: 'ADMIN' | 'SYSTEM' | 'USER';
  action: string;
  targetId?: string | null;
  details: string;
  ipAddress?: string | null;
}): void {
  db.prepare(
    `INSERT INTO audit_logs (id, actor, action, target_id, details, ip_address, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    crypto.randomUUID(),
    params.actor,
    params.action,
    params.targetId ?? null,
    params.details,
    params.ipAddress ?? null,
    Date.now(),
  );
}
