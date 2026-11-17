import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import {
  ADMIN_SESSION_MAX_AGE_MS,
  DEFAULT_KEY_VALIDITY_HOURS,
  LOCKOUT_DURATION_MS,
  LOCKOUT_MAX_ATTEMPTS,
  USER_SESSION_MAX_AGE_MS,
  config,
} from './config.ts';
import {
  db,
  getAppSecretBuffer,
  isAdminConfigured,
  isAppSecretConfiguredInEnv,
  writeAuditLog,
} from './db.ts';
import {
  decryptText,
  encryptText,
  generateId,
  generateLicenseKey,
  generateSessionToken,
  hashKey,
  hashPassword,
  hashToken,
  verifyPassword,
} from './security.ts';
import { isTelegramConfigured, sendTelegramFeedback } from './telegram.ts';

export interface PanelPreferences {
  enableFunctions: boolean;
  aimbotLegit: boolean;
  aimbotRage: boolean;
  aimbotShoulder: boolean;
  aimbotSilent: boolean;
  noRecoil: boolean;
  espLine: boolean;
  espBox: boolean;
  espName: boolean;
  espHealth: boolean;
  espDistance: boolean;
  espColor: number;
  onlineBypassStatus: boolean;
  offlineBypassStatus: boolean;
  language: 'en' | 'hi';
}

export const DEFAULT_PREFERENCES: PanelPreferences = {
  enableFunctions: true,
  aimbotLegit: false,
  aimbotRage: false,
  aimbotShoulder: false,
  aimbotSilent: false,
  noRecoil: false,
  espLine: false,
  espBox: false,
  espName: false,
  espHealth: false,
  espDistance: false,
  espColor: 0,
  onlineBypassStatus: false,
  offlineBypassStatus: false,
  language: 'en',
};

interface KeyRow {
  id: string;
  user_id: string;
  key_hash: string;
  key_ciphertext: string;
  app_version: string;
  created_at: number;
  expires_at: number;
  revoked_at: number | null;
  last_login_at: number | null;
  last_active_at: number | null;
  last_device_model: string | null;
  last_android_version: string | null;
  created_by_ip: string | null;
}

interface SessionRow {
  id: string;
  token_hash: string;
  role: 'user' | 'admin';
  key_id: string | null;
  device_model: string | null;
  android_version: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: number;
  last_active_at: number;
  expires_at: number;
  revoked_at: number | null;
}

interface AuthenticatedRequest extends Request {
  userSession?: SessionRow;
  userKey?: KeyRow;
  adminSession?: SessionRow;
}

const envAdminPasswordHash =
  config.adminPasswordEnv.length >= 8 ? hashPassword(config.adminPasswordEnv) : null;

function getClientIp(req: Request): string {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) {
    return xff.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function getCookieSecureFlag(req: Request): boolean {
  if (req.secure) return true;
  const proto = req.headers['x-forwarded-proto'];
  return typeof proto === 'string' && proto.includes('https');
}

function extractToken(req: Request, cookieName: string): string | null {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }
  const cookieVal = req.cookies?.[cookieName];
  if (typeof cookieVal === 'string' && cookieVal.trim()) {
    return cookieVal.trim();
  }
  return null;
}

function checkLockout(identifier: string): {
  locked: boolean;
  remainingSeconds: number;
  attempts: number;
} {
  const now = Date.now();
  const row = db
    .prepare('SELECT attempts, locked_until FROM login_attempts WHERE identifier = ?')
    .get(identifier) as { attempts: number; locked_until: number | null } | undefined;

  if (!row) {
    return { locked: false, remainingSeconds: 0, attempts: 0 };
  }

  if (row.locked_until && row.locked_until > now) {
    return {
      locked: true,
      remainingSeconds: Math.ceil((row.locked_until - now) / 1000),
      attempts: row.attempts,
    };
  }

  if (row.locked_until && row.locked_until <= now) {
    db.prepare('DELETE FROM login_attempts WHERE identifier = ?').run(identifier);
    return { locked: false, remainingSeconds: 0, attempts: 0 };
  }

  return { locked: false, remainingSeconds: 0, attempts: row.attempts };
}

function recordFailedAttempt(identifier: string): {
  locked: boolean;
  attemptsRemaining: number;
  remainingSeconds: number;
} {
  const now = Date.now();
  const existing = db
    .prepare('SELECT attempts, locked_until FROM login_attempts WHERE identifier = ?')
    .get(identifier) as { attempts: number; locked_until: number | null } | undefined;

  const currentAttempts =
    existing && (!existing.locked_until || existing.locked_until <= now)
      ? existing.attempts
      : 0;
  const nextAttempts = currentAttempts + 1;

  if (nextAttempts >= LOCKOUT_MAX_ATTEMPTS) {
    const lockedUntil = now + LOCKOUT_DURATION_MS;
    db.prepare(
      `INSERT INTO login_attempts (identifier, attempts, locked_until, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(identifier) DO UPDATE SET attempts = excluded.attempts, locked_until = excluded.locked_until, updated_at = excluded.updated_at`,
    ).run(identifier, nextAttempts, lockedUntil, now);
    return {
      locked: true,
      attemptsRemaining: 0,
      remainingSeconds: Math.ceil(LOCKOUT_DURATION_MS / 1000),
    };
  }

  db.prepare(
    `INSERT INTO login_attempts (identifier, attempts, locked_until, updated_at)
     VALUES (?, ?, NULL, ?)
     ON CONFLICT(identifier) DO UPDATE SET attempts = excluded.attempts, locked_until = NULL, updated_at = excluded.updated_at`,
  ).run(identifier, nextAttempts, now);

  return {
    locked: false,
    attemptsRemaining: LOCKOUT_MAX_ATTEMPTS - nextAttempts,
    remainingSeconds: 0,
  };
}

function clearFailedAttempts(identifier: string): void {
  db.prepare('DELETE FROM login_attempts WHERE identifier = ?').run(identifier);
}

function sanitizePreferences(input: Partial<PanelPreferences> | null | undefined): PanelPreferences {
  const raw = input || {};
  const colorNum = Number(raw.espColor);
  const clampedColor = Number.isFinite(colorNum)
    ? Math.max(0, Math.min(360, Math.round(colorNum)))
    : 0;

  return {
    enableFunctions: Boolean(raw.enableFunctions),
    aimbotLegit: Boolean(raw.aimbotLegit),
    aimbotRage: Boolean(raw.aimbotRage),
    aimbotShoulder: Boolean(raw.aimbotShoulder),
    aimbotSilent: Boolean(raw.aimbotSilent),
    noRecoil: Boolean(raw.noRecoil),
    espLine: Boolean(raw.espLine),
    espBox: Boolean(raw.espBox),
    espName: Boolean(raw.espName),
    espHealth: Boolean(raw.espHealth),
    espDistance: Boolean(raw.espDistance),
    espColor: clampedColor,
    onlineBypassStatus: Boolean(raw.onlineBypassStatus),
    offlineBypassStatus: Boolean(raw.offlineBypassStatus),
    language: raw.language === 'hi' ? 'hi' : 'en',
  };
}

function getKeyPreferences(keyId: string): PanelPreferences {
  const row = db
    .prepare('SELECT preferences_json FROM user_preferences WHERE key_id = ?')
    .get(keyId) as { preferences_json: string } | undefined;
  if (!row) {
    return { ...DEFAULT_PREFERENCES };
  }
  try {
    return sanitizePreferences(JSON.parse(row.preferences_json));
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

function requireUserSession(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const token = extractToken(req, 'sayan_session');
  if (!token) {
    res.status(401).json({ error: 'Authentication required.', code: 'UNAUTHENTICATED' });
    return;
  }

  const secret = getAppSecretBuffer();
  const tokenHash = hashToken(token, secret);
  const now = Date.now();

  const session = db
    .prepare(
      `SELECT * FROM sessions WHERE token_hash = ? AND role = 'user' AND revoked_at IS NULL`,
    )
    .get(tokenHash) as SessionRow | undefined;

  if (!session || session.expires_at <= now || !session.key_id) {
    res.status(401).json({ error: 'Session expired or invalid.', code: 'SESSION_INVALID' });
    return;
  }

  const keyRow = db
    .prepare('SELECT * FROM license_keys WHERE id = ?')
    .get(session.key_id) as KeyRow | undefined;

  if (!keyRow) {
    res.status(401).json({ error: 'Key not found.', code: 'KEY_NOT_FOUND' });
    return;
  }

  if (keyRow.revoked_at !== null) {
    res.status(403).json({ error: 'KEY REVOKED.', code: 'KEY_REVOKED' });
    return;
  }

  if (keyRow.app_version !== config.currentAppVersion) {
    res.status(403).json({
      error: `OUTDATED KEY VERSION. PLEASE USE v${config.currentAppVersion}.`,
      code: 'OUTDATED_VERSION',
    });
    return;
  }

  if (keyRow.expires_at <= now) {
    res.status(403).json({ error: 'KEY EXPIRED.', code: 'KEY_EXPIRED' });
    return;
  }

  db.prepare('UPDATE sessions SET last_active_at = ? WHERE id = ?').run(now, session.id);
  db.prepare('UPDATE license_keys SET last_active_at = ? WHERE id = ?').run(now, keyRow.id);

  req.userSession = session;
  req.userKey = keyRow;
  next();
}

function requireAdminSession(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const token = extractToken(req, 'sayan_admin_session');
  if (!token) {
    res.status(401).json({ error: 'Admin authentication required.', code: 'ADMIN_UNAUTHENTICATED' });
    return;
  }

  const secret = getAppSecretBuffer();
  const tokenHash = hashToken(token, secret);
  const now = Date.now();

  const session = db
    .prepare(
      `SELECT * FROM sessions WHERE token_hash = ? AND role = 'admin' AND revoked_at IS NULL`,
    )
    .get(tokenHash) as SessionRow | undefined;

  if (!session || session.expires_at <= now) {
    res.status(401).json({ error: 'Admin session expired or invalid.', code: 'ADMIN_SESSION_INVALID' });
    return;
  }

  db.prepare('UPDATE sessions SET last_active_at = ? WHERE id = ?').run(now, session.id);
  req.adminSession = session;
  next();
}

function getKeyStatus(row: KeyRow, now: number): 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'OUTDATED' {
  if (row.revoked_at !== null) return 'REVOKED';
  if (row.app_version !== config.currentAppVersion) return 'OUTDATED';
  if (row.expires_at <= now) return 'EXPIRED';
  return 'ACTIVE';
}

export function createApiRouter(): express.Router {
  const router = express.Router();

  router.get('/health', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      appVersion: config.currentAppVersion,
      serverTime: Date.now(),
    });
  });

  // User Key Authentication
  router.post('/auth/login', (req: Request, res: Response) => {
    const ip = getClientIp(req);
    const attemptScope = `user:${ip}`;
    const lockState = checkLockout(attemptScope);

    if (lockState.locked) {
      res.status(429).json({
        error: `Too many failed attempts. Locked for ${Math.ceil(lockState.remainingSeconds / 60)}m.`,
        code: 'LOCKED',
        remainingSeconds: lockState.remainingSeconds,
      });
      return;
    }

    const rawKey = typeof req.body?.key === 'string' ? req.body.key.trim() : '';
    const clientAppVersion =
      typeof req.body?.appVersion === 'string'
        ? req.body.appVersion.trim()
        : config.currentAppVersion;
    const deviceModel =
      typeof req.body?.deviceModel === 'string' && req.body.deviceModel.trim()
        ? req.body.deviceModel.trim().slice(0, 120)
        : 'Web Client';
    const androidVersion =
      typeof req.body?.androidVersion === 'string' && req.body.androidVersion.trim()
        ? req.body.androidVersion.trim().slice(0, 64)
        : 'N/A';

    if (!rawKey) {
      res.status(400).json({ error: 'Enter a valid key.', code: 'EMPTY_KEY' });
      return;
    }

    if (clientAppVersion !== config.currentAppVersion) {
      console.warn(
        `[AUTH] Login rejected (403 OUTDATED_VERSION): client=${clientAppVersion} server=${config.currentAppVersion} ip=${ip}`,
      );
      db.prepare(
        `INSERT INTO login_history (id, key_id, user_id, device_model, android_version, app_version, ip_address, status, created_at)
         VALUES (?, NULL, NULL, ?, ?, ?, ?, 'OUTDATED_VERSION', ?)`,
      ).run(generateId(), deviceModel, androidVersion, clientAppVersion, ip, Date.now());
      res.status(403).json({
        error: `OUTDATED APP VERSION (${clientAppVersion}). PLEASE USE v${config.currentAppVersion}.`,
        code: 'OUTDATED_VERSION',
      });
      return;
    }

    const secret = getAppSecretBuffer();
    const hashed = hashKey(rawKey, secret);
    const keyRow = db
      .prepare('SELECT * FROM license_keys WHERE key_hash = ?')
      .get(hashed) as KeyRow | undefined;

    const now = Date.now();

    if (!keyRow) {
      const fail = recordFailedAttempt(attemptScope);
      db.prepare(
        `INSERT INTO login_history (id, key_id, user_id, device_model, android_version, app_version, ip_address, status, created_at)
         VALUES (?, NULL, NULL, ?, ?, ?, ?, ?, ?)`,
      ).run(
        generateId(),
        deviceModel,
        androidVersion,
        clientAppVersion,
        ip,
        fail.locked ? 'LOCKED' : 'INVALID',
        now,
      );

      if (fail.locked) {
        writeAuditLog({
          actor: 'SYSTEM',
          action: 'USER_LOGIN_LOCKOUT',
          details: `IP ${ip} locked out after ${LOCKOUT_MAX_ATTEMPTS} invalid key attempts.`,
          ipAddress: ip,
        });
        res.status(429).json({
          error: 'Too many failed attempts. Temporarily locked for 15 minutes.',
          code: 'LOCKED',
          remainingSeconds: fail.remainingSeconds,
        });
        return;
      }

      console.warn(
        `[AUTH] Login rejected (401 INVALID_KEY): remaining=${fail.attemptsRemaining} ip=${ip}`,
      );
      res.status(401).json({
        error: `INVALID KEY (${fail.attemptsRemaining} attempt(s) remaining).`,
        code: 'INVALID_KEY',
        attemptsRemaining: fail.attemptsRemaining,
      });
      return;
    }

    if (keyRow.app_version !== config.currentAppVersion) {
      console.warn(
        `[AUTH] Login rejected (403 OUTDATED_VERSION): keyVersion=${keyRow.app_version} server=${config.currentAppVersion} userId=${keyRow.user_id}`,
      );
      db.prepare(
        `INSERT INTO login_history (id, key_id, user_id, device_model, android_version, app_version, ip_address, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'OUTDATED_VERSION', ?)`,
      ).run(
        generateId(),
        keyRow.id,
        keyRow.user_id,
        deviceModel,
        androidVersion,
        keyRow.app_version,
        ip,
        now,
      );
      res.status(403).json({
        error: `OUTDATED KEY VERSION (v${keyRow.app_version}). PLEASE REQUEST A v${config.currentAppVersion} KEY.`,
        code: 'OUTDATED_VERSION',
      });
      return;
    }

    if (keyRow.revoked_at !== null) {
      console.warn(`[AUTH] Login rejected (403 KEY_REVOKED): userId=${keyRow.user_id}`);
      db.prepare(
        `INSERT INTO login_history (id, key_id, user_id, device_model, android_version, app_version, ip_address, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'REVOKED', ?)`,
      ).run(
        generateId(),
        keyRow.id,
        keyRow.user_id,
        deviceModel,
        androidVersion,
        keyRow.app_version,
        ip,
        now,
      );
      res.status(403).json({ error: 'KEY REVOKED.', code: 'KEY_REVOKED' });
      return;
    }

    if (keyRow.expires_at <= now) {
      console.warn(`[AUTH] Login rejected (403 KEY_EXPIRED): userId=${keyRow.user_id}`);
      db.prepare(
        `INSERT INTO login_history (id, key_id, user_id, device_model, android_version, app_version, ip_address, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'EXPIRED', ?)`,
      ).run(
        generateId(),
        keyRow.id,
        keyRow.user_id,
        deviceModel,
        androidVersion,
        keyRow.app_version,
        ip,
        now,
      );
      res.status(403).json({ error: 'KEY EXPIRED.', code: 'KEY_EXPIRED' });
      return;
    }

    // Valid key: reset attempts and create session (supports unlimited simultaneous devices!)
    clearFailedAttempts(attemptScope);
    const sessionToken = generateSessionToken();
    const tokenHash = hashToken(sessionToken, secret);
    const sessionExpiresAt = Math.min(keyRow.expires_at, now + USER_SESSION_MAX_AGE_MS);
    const userAgent = String(req.headers['user-agent'] || '').slice(0, 240);

    db.prepare(
      `INSERT INTO sessions (id, token_hash, role, key_id, device_model, android_version, ip_address, user_agent, created_at, last_active_at, expires_at, revoked_at)
       VALUES (?, ?, 'user', ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
    ).run(
      generateId(),
      tokenHash,
      keyRow.id,
      deviceModel,
      androidVersion,
      ip,
      userAgent,
      now,
      now,
      sessionExpiresAt,
    );

    db.prepare(
      `UPDATE license_keys
       SET last_login_at = ?, last_active_at = ?, last_device_model = ?, last_android_version = ?
       WHERE id = ?`,
    ).run(now, now, deviceModel, androidVersion, keyRow.id);

    db.prepare(
      `INSERT INTO login_history (id, key_id, user_id, device_model, android_version, app_version, ip_address, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'SUCCESS', ?)`,
    ).run(
      generateId(),
      keyRow.id,
      keyRow.user_id,
      deviceModel,
      androidVersion,
      keyRow.app_version,
      ip,
      now,
    );

    res.cookie('sayan_session', sessionToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: getCookieSecureFlag(req),
      maxAge: Math.max(1000, sessionExpiresAt - now),
      path: '/',
    });

    const preferences = getKeyPreferences(keyRow.id);
    res.json({
      token: sessionToken,
      user: {
        keyId: keyRow.id,
        userId: keyRow.user_id,
        appVersion: keyRow.app_version,
        expiresAt: keyRow.expires_at,
        lastLoginAt: now,
        deviceModel,
        androidVersion,
      },
      preferences,
    });
  });

  router.get('/auth/me', requireUserSession, (req: AuthenticatedRequest, res: Response) => {
    const keyRow = req.userKey!;
    const session = req.userSession!;
    res.json({
      user: {
        keyId: keyRow.id,
        userId: keyRow.user_id,
        appVersion: keyRow.app_version,
        expiresAt: keyRow.expires_at,
        lastLoginAt: keyRow.last_login_at,
        lastActiveAt: Date.now(),
        deviceModel: session.device_model || keyRow.last_device_model || 'Web Client',
        androidVersion: session.android_version || keyRow.last_android_version || 'N/A',
      },
      preferences: getKeyPreferences(keyRow.id),
    });
  });

  router.post('/auth/heartbeat', requireUserSession, (req: AuthenticatedRequest, res: Response) => {
    const keyRow = req.userKey!;
    const session = req.userSession!;
    const now = Date.now();
    const deviceModel =
      typeof req.body?.deviceModel === 'string' && req.body.deviceModel.trim()
        ? req.body.deviceModel.trim().slice(0, 120)
        : session.device_model;
    const androidVersion =
      typeof req.body?.androidVersion === 'string' && req.body.androidVersion.trim()
        ? req.body.androidVersion.trim().slice(0, 64)
        : session.android_version;

    db.prepare(
      'UPDATE sessions SET last_active_at = ?, device_model = ?, android_version = ? WHERE id = ?',
    ).run(now, deviceModel, androidVersion, session.id);

    db.prepare(
      'UPDATE license_keys SET last_active_at = ?, last_device_model = ?, last_android_version = ? WHERE id = ?',
    ).run(now, deviceModel, androidVersion, keyRow.id);

    res.json({
      ok: true,
      serverTime: now,
      expiresAt: keyRow.expires_at,
    });
  });

  router.post('/auth/logout', (req: Request, res: Response) => {
    const token = extractToken(req, 'sayan_session');
    if (token) {
      const tokenHash = hashToken(token, getAppSecretBuffer());
      db.prepare('UPDATE sessions SET revoked_at = ? WHERE token_hash = ?').run(
        Date.now(),
        tokenHash,
      );
    }
    res.clearCookie('sayan_session', { path: '/' });
    res.json({ ok: true });
  });

  // Panel Visual Preferences
  router.get('/preferences', requireUserSession, (req: AuthenticatedRequest, res: Response) => {
    res.json({ preferences: getKeyPreferences(req.userKey!.id) });
  });

  router.put('/preferences', requireUserSession, (req: AuthenticatedRequest, res: Response) => {
    const clean = sanitizePreferences(req.body);
    const now = Date.now();
    db.prepare(
      `INSERT INTO user_preferences (key_id, preferences_json, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key_id) DO UPDATE SET preferences_json = excluded.preferences_json, updated_at = excluded.updated_at`,
    ).run(req.userKey!.id, JSON.stringify(clean), now);

    res.json({ preferences: clean });
  });

  // Telegram Feedback Submission (User)
  router.post('/feedback', requireUserSession, async (req: AuthenticatedRequest, res: Response) => {
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    if (message.length < 3 || message.length > 1000) {
      res.status(400).json({ error: 'Feedback must be between 3 and 1000 characters.' });
      return;
    }

    const keyRow = req.userKey!;
    const session = req.userSession!;
    const now = Date.now();
    const feedbackId = generateId();

    const tgResult = await sendTelegramFeedback({
      userId: keyRow.user_id,
      message,
      deviceModel: session.device_model || undefined,
      androidVersion: session.android_version || undefined,
    });

    db.prepare(
      `INSERT INTO feedback_messages (id, key_id, user_id, message, telegram_sent, telegram_error, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      feedbackId,
      keyRow.id,
      keyRow.user_id,
      message,
      tgResult.sent ? 1 : 0,
      tgResult.error || null,
      now,
    );

    writeAuditLog({
      actor: 'USER',
      action: 'FEEDBACK_SUBMITTED',
      targetId: keyRow.id,
      details: `User ${keyRow.user_id} submitted feedback (telegramSent=${tgResult.sent}).`,
      ipAddress: getClientIp(req),
    });

    res.json({
      ok: true,
      id: feedbackId,
      telegramConfigured: tgResult.configured,
      telegramSent: tgResult.sent,
      telegramError: tgResult.error || null,
    });
  });

  // Admin Status & Auth
  router.get('/admin/status', (req: Request, res: Response) => {
    const adminCfg = isAdminConfigured();
    const envSecretOk = isAppSecretConfiguredInEnv();
    const productionReady =
      adminCfg.configured && (adminCfg.viaEnv || !config.isProduction) && envSecretOk;

    let isAuthenticated = false;
    const token = extractToken(req, 'sayan_admin_session');
    if (token) {
      const tokenHash = hashToken(token, getAppSecretBuffer());
      const session = db
        .prepare(
          `SELECT id, expires_at FROM sessions WHERE token_hash = ? AND role = 'admin' AND revoked_at IS NULL`,
        )
        .get(tokenHash) as { id: string; expires_at: number } | undefined;
      if (session && session.expires_at > Date.now()) {
        isAuthenticated = true;
      }
    }

    res.json({
      needsSetup: !adminCfg.configured,
      configuredViaEnv: adminCfg.viaEnv,
      envSecretConfigured: envSecretOk,
      productionReady,
      isProduction: config.isProduction,
      telegramConfigured: isTelegramConfigured(),
      currentAppVersion: config.currentAppVersion,
      isAuthenticated,
    });
  });

  // One-time initial admin password setup if ADMIN_PASSWORD is not set in .env
  router.post('/admin/bootstrap', (req: Request, res: Response) => {
    const adminCfg = isAdminConfigured();
    if (adminCfg.configured) {
      res.status(403).json({ error: 'Admin password is already configured.' });
      return;
    }

    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (password.length < 8 || password.length > 128) {
      res.status(400).json({ error: 'Admin password must be between 8 and 128 characters.' });
      return;
    }

    const now = Date.now();
    const passwordHash = hashPassword(password);
    db.prepare(
      `INSERT INTO admin_config (id, password_hash, created_at, updated_at) VALUES (1, ?, ?, ?)`,
    ).run(passwordHash, now, now);

    const ip = getClientIp(req);
    writeAuditLog({
      actor: 'SYSTEM',
      action: 'ADMIN_BOOTSTRAPPED',
      details: 'Initial separate admin password configured.',
      ipAddress: ip,
    });

    res.json({ ok: true });
  });

  router.post('/admin/login', (req: Request, res: Response) => {
    const ip = getClientIp(req);
    const attemptScope = `admin:${ip}`;
    const lockState = checkLockout(attemptScope);

    if (lockState.locked) {
      res.status(429).json({
        error: `Too many failed admin attempts. Locked for ${Math.ceil(lockState.remainingSeconds / 60)}m.`,
        code: 'LOCKED',
        remainingSeconds: lockState.remainingSeconds,
      });
      return;
    }

    const adminCfg = isAdminConfigured();
    if (!adminCfg.configured) {
      res.status(412).json({
        error: 'Admin password not initialized yet.',
        code: 'ADMIN_NEEDS_SETUP',
      });
      return;
    }

    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    let valid = false;

    if (envAdminPasswordHash) {
      valid = verifyPassword(password, envAdminPasswordHash);
    } else {
      const row = db
        .prepare('SELECT password_hash FROM admin_config WHERE id = 1')
        .get() as { password_hash: string } | undefined;
      if (row) {
        valid = verifyPassword(password, row.password_hash);
      }
    }

    if (!valid) {
      const fail = recordFailedAttempt(attemptScope);
      writeAuditLog({
        actor: 'SYSTEM',
        action: fail.locked ? 'ADMIN_LOGIN_LOCKOUT' : 'ADMIN_LOGIN_FAILED',
        details: `Failed admin login attempt from ${ip}.`,
        ipAddress: ip,
      });

      if (fail.locked) {
        res.status(429).json({
          error: 'Too many failed attempts. Locked for 15 minutes.',
          code: 'LOCKED',
          remainingSeconds: fail.remainingSeconds,
        });
        return;
      }

      res.status(401).json({
        error: `Invalid admin password. ${fail.attemptsRemaining} attempt(s) remaining.`,
        attemptsRemaining: fail.attemptsRemaining,
      });
      return;
    }

    clearFailedAttempts(attemptScope);
    const secret = getAppSecretBuffer();
    const sessionToken = generateSessionToken();
    const tokenHash = hashToken(sessionToken, secret);
    const now = Date.now();
    const expiresAt = now + ADMIN_SESSION_MAX_AGE_MS;

    db.prepare(
      `INSERT INTO sessions (id, token_hash, role, key_id, device_model, android_version, ip_address, user_agent, created_at, last_active_at, expires_at, revoked_at)
       VALUES (?, ?, 'admin', NULL, 'Admin Console', 'Web', ?, ?, ?, ?, ?, NULL)`,
    ).run(
      generateId(),
      tokenHash,
      ip,
      String(req.headers['user-agent'] || '').slice(0, 240),
      now,
      now,
      expiresAt,
    );

    writeAuditLog({
      actor: 'ADMIN',
      action: 'ADMIN_LOGIN',
      details: 'Admin logged into management console.',
      ipAddress: ip,
    });

    res.cookie('sayan_admin_session', sessionToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: getCookieSecureFlag(req),
      maxAge: ADMIN_SESSION_MAX_AGE_MS,
      path: '/',
    });

    res.json({ token: sessionToken, expiresAt });
  });

  router.post('/admin/logout', (req: Request, res: Response) => {
    const token = extractToken(req, 'sayan_admin_session');
    if (token) {
      const tokenHash = hashToken(token, getAppSecretBuffer());
      db.prepare('UPDATE sessions SET revoked_at = ? WHERE token_hash = ?').run(
        Date.now(),
        tokenHash,
      );
    }
    res.clearCookie('sayan_admin_session', { path: '/' });
    res.json({ ok: true });
  });

  // Admin Key Management
  router.get('/admin/keys', requireAdminSession, (_req: AuthenticatedRequest, res: Response) => {
    const secret = getAppSecretBuffer();
    const now = Date.now();
    const rows = db
      .prepare(
        `SELECT k.*,
          (SELECT COUNT(*) FROM sessions s WHERE s.key_id = k.id AND s.revoked_at IS NULL AND s.expires_at > ?) AS active_sessions
         FROM license_keys k
         ORDER BY k.created_at DESC`,
      )
      .all(now) as Array<KeyRow & { active_sessions: number }>;

    const keys = rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      keyValue: decryptText(row.key_ciphertext, secret),
      appVersion: row.app_version,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      revokedAt: row.revoked_at,
      lastLoginAt: row.last_login_at,
      lastActiveAt: row.last_active_at,
      deviceModel: row.last_device_model,
      androidVersion: row.last_android_version,
      activeSessions: row.active_sessions,
      status: getKeyStatus(row, now),
    }));

    res.json({ keys });
  });

  router.post('/admin/keys', requireAdminSession, (req: AuthenticatedRequest, res: Response) => {
    const userIdRaw = typeof req.body?.userId === 'string' ? req.body.userId.trim() : '';
    const userId = userIdRaw ? userIdRaw.slice(0, 64) : `SAYAN-${Math.floor(1000 + Math.random() * 9000)}`;
    const requestedHours = Number(req.body?.hours);
    const hours =
      Number.isFinite(requestedHours) && requestedHours >= 1 && requestedHours <= 8760
        ? requestedHours
        : DEFAULT_KEY_VALIDITY_HOURS;

    const secret = getAppSecretBuffer();
    const rawKey = generateLicenseKey();
    const keyHash = hashKey(rawKey, secret);
    const keyCipher = encryptText(rawKey, secret);
    const now = Date.now();
    const expiresAt = now + hours * 60 * 60 * 1000;
    const id = generateId();
    const ip = getClientIp(req);

    db.prepare(
      `INSERT INTO license_keys (id, user_id, key_hash, key_ciphertext, app_version, created_at, expires_at, revoked_at, last_login_at, last_active_at, last_device_model, last_android_version, created_by_ip)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, ?)`,
    ).run(id, userId, keyHash, keyCipher, config.currentAppVersion, now, expiresAt, ip);

    writeAuditLog({
      actor: 'ADMIN',
      action: 'KEY_CREATED',
      targetId: id,
      details: `Created ${hours}h key for userId="${userId}" (v${config.currentAppVersion}).`,
      ipAddress: ip,
    });

    res.status(201).json({
      key: {
        id,
        userId,
        keyValue: rawKey,
        appVersion: config.currentAppVersion,
        createdAt: now,
        expiresAt,
        revokedAt: null,
        lastLoginAt: null,
        lastActiveAt: null,
        deviceModel: null,
        androidVersion: null,
        activeSessions: 0,
        status: 'ACTIVE',
      },
    });
  });

  router.post(
    '/admin/keys/:id/extend',
    requireAdminSession,
    (req: AuthenticatedRequest, res: Response) => {
      const keyId = req.params.id;
      const requestedHours = Number(req.body?.hours);
      const hours =
        Number.isFinite(requestedHours) && requestedHours >= 1 && requestedHours <= 8760
          ? requestedHours
          : DEFAULT_KEY_VALIDITY_HOURS;

      const row = db
        .prepare('SELECT * FROM license_keys WHERE id = ?')
        .get(keyId) as KeyRow | undefined;

      if (!row) {
        res.status(404).json({ error: 'Key not found.' });
        return;
      }

      const now = Date.now();
      const baseTime = Math.max(now, row.expires_at);
      const nextExpiresAt = baseTime + hours * 60 * 60 * 1000;

      db.prepare('UPDATE license_keys SET expires_at = ? WHERE id = ?').run(nextExpiresAt, keyId);

      writeAuditLog({
        actor: 'ADMIN',
        action: 'KEY_EXTENDED',
        targetId: keyId,
        details: `Extended key for userId="${row.user_id}" by +${hours}h.`,
        ipAddress: getClientIp(req),
      });

      res.json({ ok: true, expiresAt: nextExpiresAt });
    },
  );

  router.post(
    '/admin/keys/:id/revoke',
    requireAdminSession,
    (req: AuthenticatedRequest, res: Response) => {
      const keyId = req.params.id;
      const row = db
        .prepare('SELECT * FROM license_keys WHERE id = ?')
        .get(keyId) as KeyRow | undefined;

      if (!row) {
        res.status(404).json({ error: 'Key not found.' });
        return;
      }

      const now = Date.now();
      db.prepare('UPDATE license_keys SET revoked_at = ? WHERE id = ?').run(now, keyId);
      db.prepare('UPDATE sessions SET revoked_at = ? WHERE key_id = ? AND revoked_at IS NULL').run(
        now,
        keyId,
      );

      writeAuditLog({
        actor: 'ADMIN',
        action: 'KEY_REVOKED',
        targetId: keyId,
        details: `Revoked key for userId="${row.user_id}" and terminated active sessions.`,
        ipAddress: getClientIp(req),
      });

      res.json({ ok: true, revokedAt: now });
    },
  );

  router.get(
    '/admin/keys/:id/history',
    requireAdminSession,
    (req: AuthenticatedRequest, res: Response) => {
      const keyId = req.params.id;
      const history = db
        .prepare(
          `SELECT id, user_id, device_model, android_version, app_version, ip_address, status, created_at
           FROM login_history
           WHERE key_id = ?
           ORDER BY created_at DESC
           LIMIT 100`,
        )
        .all(keyId);

      const sessions = db
        .prepare(
          `SELECT id, device_model, android_version, ip_address, created_at, last_active_at, expires_at
           FROM sessions
           WHERE key_id = ? AND revoked_at IS NULL AND expires_at > ?
           ORDER BY last_active_at DESC`,
        )
        .all(keyId, Date.now());

      res.json({ history, activeSessions: sessions });
    },
  );

  router.get('/admin/history', requireAdminSession, (_req: AuthenticatedRequest, res: Response) => {
    const history = db
      .prepare(
        `SELECT id, key_id, user_id, device_model, android_version, app_version, ip_address, status, created_at
         FROM login_history
         ORDER BY created_at DESC
         LIMIT 150`,
      )
      .all();
    res.json({ history });
  });

  router.get('/admin/audit', requireAdminSession, (_req: AuthenticatedRequest, res: Response) => {
    const logs = db
      .prepare(
        `SELECT id, actor, action, target_id, details, ip_address, created_at
         FROM audit_logs
         ORDER BY created_at DESC
         LIMIT 200`,
      )
      .all();
    res.json({ logs });
  });

  router.get(
    '/admin/feedback',
    requireAdminSession,
    (_req: AuthenticatedRequest, res: Response) => {
      const messages = db
        .prepare(
          `SELECT id, key_id, user_id, message, telegram_sent, telegram_error, created_at
           FROM feedback_messages
           ORDER BY created_at DESC
           LIMIT 100`,
        )
        .all();
      res.json({ messages });
    },
  );

  return router;
}
