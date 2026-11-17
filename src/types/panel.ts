export type Language = 'en' | 'hi';

export type DashboardTab = 'aim' | 'esp' | 'bypass' | 'settings';

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
  language: Language;
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

export interface UserProfile {
  keyId: string;
  userId: string;
  appVersion: string;
  expiresAt: number;
  lastLoginAt: number | null;
  lastActiveAt?: number | null;
  deviceModel: string;
  androidVersion: string;
}

export interface AdminStatus {
  needsSetup: boolean;
  configuredViaEnv: boolean;
  envSecretConfigured: boolean;
  productionReady: boolean;
  isProduction: boolean;
  telegramConfigured: boolean;
  currentAppVersion: string;
  isAuthenticated: boolean;
}

export interface AdminKeyRecord {
  id: string;
  userId: string;
  keyValue: string;
  appVersion: string;
  createdAt: number;
  expiresAt: number;
  revokedAt: number | null;
  lastLoginAt: number | null;
  lastActiveAt: number | null;
  deviceModel: string | null;
  androidVersion: string | null;
  activeSessions: number;
  status: 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'OUTDATED';
}

export interface LoginHistoryEntry {
  id: string;
  key_id?: string | null;
  user_id: string | null;
  device_model: string | null;
  android_version: string | null;
  app_version: string | null;
  ip_address: string | null;
  status: string;
  created_at: number;
}

export interface ActiveSessionEntry {
  id: string;
  device_model: string | null;
  android_version: string | null;
  ip_address: string | null;
  created_at: number;
  last_active_at: number;
  expires_at: number;
}

export interface AuditLogEntry {
  id: string;
  actor: string;
  action: string;
  target_id: string | null;
  details: string;
  ip_address: string | null;
  created_at: number;
}

export interface FeedbackEntry {
  id: string;
  key_id: string | null;
  user_id: string;
  message: string;
  telegram_sent: number;
  telegram_error: string | null;
  created_at: number;
}
