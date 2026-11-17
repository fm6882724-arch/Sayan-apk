import type {
  ActiveSessionEntry,
  AdminKeyRecord,
  AdminStatus,
  AuditLogEntry,
  FeedbackEntry,
  LoginHistoryEntry,
  PanelPreferences,
  UserProfile,
} from '../types/panel';
import { getClientDeviceInfo } from './deviceInfo';
import { getAdminSessionToken, getUserSessionToken } from './secureStorage';

export class ApiError extends Error {
  status: number;
  code?: string;
  remainingSeconds?: number;
  attemptsRemaining?: number;

  constructor(
    message: string,
    status: number,
    extra?: { code?: string; remainingSeconds?: number; attemptsRemaining?: number },
  ) {
    super(message);
    this.status = status;
    this.code = extra?.code;
    this.remainingSeconds = extra?.remainingSeconds;
    this.attemptsRemaining = extra?.attemptsRemaining;
  }
}

function getFriendlyErrorMessage(
  status: number,
  data: Record<string, unknown>,
  isAdminPath: boolean,
): string {
  const code = typeof data.code === 'string' ? data.code : undefined;
  if (code === 'KEY_EXPIRED') return 'KEY EXPIRED.';
  if (code === 'KEY_REVOKED') return 'KEY REVOKED.';
  if (code === 'INVALID_KEY') {
    return typeof data.error === 'string' && data.error.trim() ? data.error : 'INVALID KEY';
  }
  if (typeof data.error === 'string' && data.error.trim()) {
    return data.error;
  }
  if (status === 401) return isAdminPath ? 'INVALID ADMIN PASSWORD' : 'INVALID KEY';
  if (status === 403) return 'ACCESS DENIED. KEY EXPIRED OR REVOKED.';
  if (status === 429) return 'TOO MANY FAILED ATTEMPTS. PLEASE WAIT.';
  if (status === 400) return 'ENTER A VALID KEY.';
  if (status >= 500) return 'SERVER ERROR. PLEASE TRY AGAIN.';
  return 'AUTHENTICATION FAILED. PLEASE TRY AGAIN.';
}

async function request<T>(
  path: string,
  options: RequestInit & { authScope?: 'user' | 'admin' } = {},
): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }

  if (options.authScope === 'user') {
    const token = getUserSessionToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  } else if (options.authScope === 'admin') {
    const token = getAdminSessionToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(path, {
    ...options,
    headers,
    credentials: 'include',
  });

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const isAdminPath = options.authScope === 'admin' || path.startsWith('/api/admin');
    throw new ApiError(getFriendlyErrorMessage(res.status, data, isAdminPath), res.status, {
      code: typeof data.code === 'string' ? data.code : undefined,
      remainingSeconds:
        typeof data.remainingSeconds === 'number' ? data.remainingSeconds : undefined,
      attemptsRemaining:
        typeof data.attemptsRemaining === 'number' ? data.attemptsRemaining : undefined,
    });
  }

  return data as T;
}

export async function loginWithKey(key: string): Promise<{
  token: string;
  user: UserProfile;
  preferences: PanelPreferences;
}> {
  const device = await getClientDeviceInfo();
  return request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      key,
      appVersion: device.appVersion,
      deviceModel: device.deviceModel,
      androidVersion: device.androidVersion,
    }),
  });
}

export async function fetchCurrentSession(): Promise<{
  user: UserProfile;
  preferences: PanelPreferences;
}> {
  return request('/api/auth/me', { authScope: 'user' });
}

export async function sendHeartbeat(): Promise<{
  ok: boolean;
  serverTime: number;
  expiresAt: number;
}> {
  const device = await getClientDeviceInfo();
  return request('/api/auth/heartbeat', {
    method: 'POST',
    authScope: 'user',
    body: JSON.stringify({
      deviceModel: device.deviceModel,
      androidVersion: device.androidVersion,
    }),
  });
}

export async function logoutUser(): Promise<void> {
  await request('/api/auth/logout', { method: 'POST', authScope: 'user' });
}

export async function savePreferences(
  prefs: PanelPreferences,
): Promise<{ preferences: PanelPreferences }> {
  return request('/api/preferences', {
    method: 'PUT',
    authScope: 'user',
    body: JSON.stringify(prefs),
  });
}

export async function submitFeedback(message: string): Promise<{
  ok: boolean;
  telegramConfigured: boolean;
  telegramSent: boolean;
  telegramError: string | null;
}> {
  return request('/api/feedback', {
    method: 'POST',
    authScope: 'user',
    body: JSON.stringify({ message }),
  });
}

// Admin API
export async function fetchAdminStatus(): Promise<AdminStatus> {
  return request('/api/admin/status', { authScope: 'admin' });
}

export async function bootstrapAdminPassword(password: string): Promise<{ ok: boolean }> {
  return request('/api/admin/bootstrap', {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
}

export async function loginAdmin(password: string): Promise<{ token: string; expiresAt: number }> {
  return request('/api/admin/login', {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
}

export async function logoutAdmin(): Promise<void> {
  await request('/api/admin/logout', { method: 'POST', authScope: 'admin' });
}

export async function fetchAdminKeys(): Promise<{ keys: AdminKeyRecord[] }> {
  return request('/api/admin/keys', { authScope: 'admin' });
}

export async function createAdminKey(
  userId: string,
  hours = 72,
): Promise<{ key: AdminKeyRecord }> {
  return request('/api/admin/keys', {
    method: 'POST',
    authScope: 'admin',
    body: JSON.stringify({ userId, hours }),
  });
}

export async function extendAdminKey(
  keyId: string,
  hours = 72,
): Promise<{ ok: boolean; expiresAt: number }> {
  return request(`/api/admin/keys/${encodeURIComponent(keyId)}/extend`, {
    method: 'POST',
    authScope: 'admin',
    body: JSON.stringify({ hours }),
  });
}

export async function revokeAdminKey(keyId: string): Promise<{ ok: boolean; revokedAt: number }> {
  return request(`/api/admin/keys/${encodeURIComponent(keyId)}/revoke`, {
    method: 'POST',
    authScope: 'admin',
  });
}

export async function fetchKeyHistory(keyId: string): Promise<{
  history: LoginHistoryEntry[];
  activeSessions: ActiveSessionEntry[];
}> {
  return request(`/api/admin/keys/${encodeURIComponent(keyId)}/history`, {
    authScope: 'admin',
  });
}

export async function fetchGlobalLoginHistory(): Promise<{ history: LoginHistoryEntry[] }> {
  return request('/api/admin/history', { authScope: 'admin' });
}

export async function fetchAdminAuditLogs(): Promise<{ logs: AuditLogEntry[] }> {
  return request('/api/admin/audit', { authScope: 'admin' });
}

export async function fetchAdminFeedback(): Promise<{ messages: FeedbackEntry[] }> {
  return request('/api/admin/feedback', { authScope: 'admin' });
}
