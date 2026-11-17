import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config();

export interface AppConfig {
  port: number;
  nodeEnv: string;
  isProduction: boolean;
  currentAppVersion: string;
  sqliteDbPath: string;
  appSecretEnv: string;
  adminPasswordEnv: string;
  telegramBotToken: string;
  telegramChatId: string;
  appUrl: string;
}

export const config: AppConfig = {
  port: Number(process.env.PORT || 3000),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  currentAppVersion: (process.env.CURRENT_APP_VERSION || '1.0.0').trim(),
  sqliteDbPath: path.resolve(process.cwd(), process.env.SQLITE_DB_PATH || './data/sayan_mode.db'),
  appSecretEnv: (process.env.APP_SECRET || '').trim(),
  adminPasswordEnv: (process.env.ADMIN_PASSWORD || '').trim(),
  telegramBotToken: (process.env.TELEGRAM_BOT_TOKEN || '').trim(),
  telegramChatId: (process.env.TELEGRAM_CHAT_ID || '').trim(),
  appUrl: (process.env.APP_URL || '').trim(),
};

export const LOCKOUT_MAX_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
export const DEFAULT_KEY_VALIDITY_HOURS = 72;
export const USER_SESSION_MAX_AGE_MS = 72 * 60 * 60 * 1000;
export const ADMIN_SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;
