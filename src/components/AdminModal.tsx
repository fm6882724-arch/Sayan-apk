import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Clock,
  Copy,
  Eye,
  EyeOff,
  History,
  KeyRound,
  Lock,
  LogOut,
  MessageSquare,
  Plus,
  RefreshCw,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  X,
} from 'lucide-react';
import { translations } from '../i18n/translations';
import type {
  ActiveSessionEntry,
  AdminKeyRecord,
  AdminStatus,
  AuditLogEntry,
  FeedbackEntry,
  Language,
  LoginHistoryEntry,
} from '../types/panel';
import {
  ApiError,
  bootstrapAdminPassword,
  createAdminKey,
  extendAdminKey,
  fetchAdminAuditLogs,
  fetchAdminFeedback,
  fetchAdminKeys,
  fetchAdminStatus,
  fetchGlobalLoginHistory,
  fetchKeyHistory,
  loginAdmin,
  logoutAdmin,
  revokeAdminKey,
} from '../utils/api';
import { clearAdminSessionToken, saveAdminSessionToken } from '../utils/secureStorage';

interface AdminModalProps {
  open: boolean;
  language: Language;
  onClose: () => void;
}

type AdminSection = 'keys' | 'history' | 'audit' | 'feedback';

function formatDate(ts: number | null): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleString();
}

function formatCountdownShort(expiresAt: number): string {
  const diff = expiresAt - Date.now();
  if (diff <= 0) return 'EXPIRED';
  const hrs = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  return `${hrs}h ${mins}m left`;
}

export const AdminModal: React.FC<AdminModalProps> = ({ open, language, onClose }) => {
  const t = translations[language];
  const [status, setStatus] = useState<AdminStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);

  // Auth inputs
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // Console state
  const [section, setSection] = useState<AdminSection>('keys');
  const [keys, setKeys] = useState<AdminKeyRecord[]>([]);
  const [globalHistory, setGlobalHistory] = useState<LoginHistoryEntry[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [feedbackList, setFeedbackList] = useState<FeedbackEntry[]>([]);
  const [newUserId, setNewUserId] = useState('');
  const [creatingKey, setCreatingKey] = useState(false);
  const [createdBanner, setCreatedBanner] = useState<AdminKeyRecord | null>(null);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Per-key history drawer
  const [selectedKeyHistory, setSelectedKeyHistory] = useState<{
    record: AdminKeyRecord;
    history: LoginHistoryEntry[];
    activeSessions: ActiveSessionEntry[];
  } | null>(null);

  const loadConsoleData = useCallback(async () => {
    try {
      const [kRes, hRes, aRes, fRes] = await Promise.all([
        fetchAdminKeys(),
        fetchGlobalLoginHistory(),
        fetchAdminAuditLogs(),
        fetchAdminFeedback(),
      ]);
      setKeys(kRes.keys);
      setGlobalHistory(hRes.history);
      setAuditLogs(aRes.logs);
      setFeedbackList(fRes.messages);
      setActionError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        clearAdminSessionToken();
        setStatus((prev) => (prev ? { ...prev, isAuthenticated: false } : prev));
      } else {
        setActionError(err instanceof Error ? err.message : 'Failed to load admin data.');
      }
    }
  }, []);

  const checkStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const st = await fetchAdminStatus();
      setStatus(st);
      if (st.isAuthenticated) {
        await loadConsoleData();
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Unable to reach admin API.');
    } finally {
      setLoadingStatus(false);
    }
  }, [loadConsoleData]);

  useEffect(() => {
    if (open) {
      setAuthError(null);
      setActionError(null);
      setCreatedBanner(null);
      checkStatus();
    } else {
      setPassword('');
      setConfirmPassword('');
    }
  }, [open, checkStatus]);

  if (!open) return null;

  const handleBootstrap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setAuthError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setAuthError('Passwords do not match.');
      return;
    }
    setAuthLoading(true);
    setAuthError(null);
    try {
      await bootstrapAdminPassword(password);
      const loginRes = await loginAdmin(password);
      saveAdminSessionToken(loginRes.token);
      setPassword('');
      setConfirmPassword('');
      await checkStatus();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Setup failed.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setAuthLoading(true);
    setAuthError(null);
    try {
      const loginRes = await loginAdmin(password);
      saveAdminSessionToken(loginRes.token);
      setPassword('');
      await checkStatus();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Admin login failed.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAdminLogout = async () => {
    await logoutAdmin().catch(() => undefined);
    clearAdminSessionToken();
    setSelectedKeyHistory(null);
    setStatus((prev) => (prev ? { ...prev, isAuthenticated: false } : prev));
  };

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creatingKey) return;
    setCreatingKey(true);
    setActionError(null);
    try {
      const res = await createAdminKey(newUserId.trim() || 'SAYAN FF', 72);
      setCreatedBanner(res.key);
      setNewUserId('');
      await loadConsoleData();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to create key.');
    } finally {
      setCreatingKey(false);
    }
  };

  const handleExtend = async (keyId: string) => {
    try {
      await extendAdminKey(keyId, 72);
      await loadConsoleData();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to extend key.');
    }
  };

  const handleRevoke = async (keyId: string) => {
    try {
      await revokeAdminKey(keyId);
      if (createdBanner?.id === keyId) {
        setCreatedBanner(null);
      }
      await loadConsoleData();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to revoke key.');
    }
  };

  const handleCopyKey = async (record: AdminKeyRecord) => {
    try {
      await navigator.clipboard.writeText(record.keyValue);
      setCopiedKeyId(record.id);
      window.setTimeout(() => setCopiedKeyId((cur) => (cur === record.id ? null : cur)), 2000);
    } catch {
      setActionError('Clipboard permission denied.');
    }
  };

  const handleOpenKeyHistory = async (record: AdminKeyRecord) => {
    try {
      const res = await fetchKeyHistory(record.id);
      setSelectedKeyHistory({
        record,
        history: res.history,
        activeSessions: res.activeSessions,
      });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to load key history.');
    }
  };

  const buildWhatsAppHref = (record: AdminKeyRecord) => {
    const msg = [
      '*SAYAN MODE ACCESS KEY*',
      `User ID: ${record.userId}`,
      `Key: ${record.keyValue}`,
      `Version: v${record.appVersion}`,
      `Expires: ${new Date(record.expiresAt).toLocaleString()}`,
    ].join('\n');
    return `https://wa.me/?text=${encodeURIComponent(msg)}`;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 sm:p-5 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="Admin Console"
    >
      <div className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl sayan-panel-border-active bg-[#07020e]">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-fuchsia-500/40 px-4 sm:px-6 py-3.5">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="h-6 w-6 text-fuchsia-400" />
            <h2 className="font-display text-lg sm:text-xl font-bold tracking-wider text-white">
              {t.adminConsoleTitle}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {status?.isAuthenticated && (
              <button
                type="button"
                onClick={handleAdminLogout}
                className="flex items-center gap-1.5 rounded-lg border border-rose-500/50 bg-rose-950/50 px-3 py-1.5 font-display text-xs font-bold text-rose-200 hover:bg-rose-900/60 cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>{t.adminLogout}</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label={t.adminClose}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-fuchsia-500/50 text-purple-200 hover:bg-fuchsia-500/20 hover:text-white cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {loadingStatus && !status ? (
            <div className="py-12 text-center font-display text-sm text-purple-200">
              Loading...
            </div>
          ) : !status?.isAuthenticated ? (
            /* Admin Login or One-Time Setup Form */
            <div className="mx-auto max-w-md py-4">
              {status?.needsSetup ? (
                <form onSubmit={handleBootstrap} className="space-y-4">
                  <div className="text-center">
                    <Lock className="mx-auto mb-2 h-8 w-8 text-fuchsia-400" />
                    <h3 className="font-display text-xl font-bold text-white">
                      {t.adminSetupTitle}
                    </h3>
                    <p className="mt-1 text-xs text-purple-200/80">{t.adminSetupDesc}</p>
                  </div>

                  <div className="relative">
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={t.adminPasswordPlaceholder}
                      className="w-full rounded-xl border border-fuchsia-500/60 bg-[#0d041a] px-4 py-3 pr-11 text-sm text-white focus:border-fuchsia-300 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass((v) => !v)}
                      className="absolute right-2.5 top-2.5 p-1 text-purple-300 hover:text-white cursor-pointer"
                    >
                      {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>

                  <input
                    type={showPass ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder={t.adminConfirmPlaceholder}
                    className="w-full rounded-xl border border-fuchsia-500/60 bg-[#0d041a] px-4 py-3 text-sm text-white focus:border-fuchsia-300 focus:outline-none"
                  />

                  {authError && (
                    <p className="text-center text-xs font-medium text-rose-400">{authError}</p>
                  )}

                  <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full sayan-login-btn rounded-xl py-3 font-display text-base font-bold tracking-wider text-white cursor-pointer"
                  >
                    {t.adminSetupBtn}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleAdminLogin} className="space-y-4">
                  <div className="text-center">
                    <Lock className="mx-auto mb-2 h-8 w-8 text-fuchsia-400" />
                    <h3 className="font-display text-xl font-bold text-white">
                      {t.adminLoginTitle}
                    </h3>
                  </div>

                  <div className="relative">
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={t.adminPasswordPlaceholder}
                      className="w-full rounded-xl border border-fuchsia-500/60 bg-[#0d041a] px-4 py-3 pr-11 text-sm text-white focus:border-fuchsia-300 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass((v) => !v)}
                      className="absolute right-2.5 top-2.5 p-1 text-purple-300 hover:text-white cursor-pointer"
                    >
                      {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>

                  {authError && (
                    <p className="text-center text-xs font-medium text-rose-400">{authError}</p>
                  )}

                  <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full sayan-login-btn rounded-xl py-3 font-display text-base font-bold tracking-wider text-white cursor-pointer"
                  >
                    {t.adminLoginBtn}
                  </button>
                </form>
              )}
            </div>
          ) : (
            /* Authenticated Admin Console */
            <div className="space-y-4">
              {!status.productionReady && (
                <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/50 bg-amber-950/35 p-3 text-xs text-amber-200">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                  <span>{t.adminNotProdReady}</span>
                </div>
              )}

              {/* Admin Navigation Tabs */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      { id: 'keys', label: t.adminTabKeys, icon: <KeyRound className="h-4 w-4" /> },
                      {
                        id: 'history',
                        label: t.adminTabHistory,
                        icon: <History className="h-4 w-4" />,
                      },
                      {
                        id: 'audit',
                        label: t.adminTabAudit,
                        icon: <ShieldCheck className="h-4 w-4" />,
                      },
                      {
                        id: 'feedback',
                        label: t.adminTabFeedback,
                        icon: <MessageSquare className="h-4 w-4" />,
                      },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSection(item.id)}
                      className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 font-display text-xs sm:text-sm font-bold cursor-pointer transition-all ${
                        section === item.id ? 'sayan-tab-active text-white' : 'sayan-tab-inactive text-purple-200'
                      }`}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={loadConsoleData}
                  className="flex items-center gap-1.5 rounded-lg border border-fuchsia-500/40 bg-[#120624] px-3 py-2 font-display text-xs font-bold text-fuchsia-200 hover:bg-fuchsia-500/20 cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>v{status.currentAppVersion}</span>
                </button>
              </div>

              {actionError && (
                <p className="rounded-lg border border-rose-500/40 bg-rose-950/40 px-3 py-2 text-xs text-rose-300">
                  {actionError}
                </p>
              )}

              {/* KEYS MANAGEMENT (No User Search per requirement) */}
              {section === 'keys' && (
                <div className="space-y-4">
                  <form
                    onSubmit={handleCreateKey}
                    className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 rounded-xl border border-fuchsia-500/40 bg-[#0d041a] p-3"
                  >
                    <input
                      type="text"
                      value={newUserId}
                      onChange={(e) => setNewUserId(e.target.value)}
                      placeholder={t.adminUserIdPlaceholder}
                      maxLength={64}
                      className="flex-1 rounded-lg border border-fuchsia-500/40 bg-[#05010a] px-3.5 py-2.5 text-sm text-white placeholder:text-slate-400 focus:border-fuchsia-300 focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={creatingKey}
                      className="sayan-login-btn flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 font-display text-sm font-bold text-white cursor-pointer whitespace-nowrap min-h-[42px]"
                    >
                      <Plus className="h-4 w-4" />
                      <span>{t.adminGenerate72h}</span>
                    </button>
                  </form>

                  {createdBanner && (
                    <div className="rounded-xl border border-emerald-500/50 bg-emerald-950/30 px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="space-y-0.5">
                        <p className="font-display font-bold text-emerald-300">
                          72h Key Created · {createdBanner.userId} · {createdBanner.status}
                        </p>
                        <p className="font-mono-tabular text-sm font-bold text-white break-all">
                          {createdBanner.keyValue}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyKey(createdBanner)}
                        className="flex items-center gap-1.5 rounded-lg border border-emerald-400/50 bg-emerald-900/50 px-3 py-1.5 font-bold text-white hover:bg-emerald-800/60 cursor-pointer"
                      >
                        {copiedKeyId === createdBanner.id ? (
                          <Check className="h-3.5 w-3.5 text-emerald-300" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                        <span>
                          {copiedKeyId === createdBanner.id ? t.adminCopied : t.adminCopyKey}
                        </span>
                      </button>
                    </div>
                  )}

                  <div className="space-y-3">
                    {keys.length === 0 ? (
                      <p className="py-8 text-center text-sm text-purple-200/70">
                        No login keys generated yet.
                      </p>
                    ) : (
                      keys.map((rec) => (
                        <div
                          key={rec.id}
                          className="rounded-xl border border-fuchsia-500/35 bg-[#0c0318]/90 p-3.5 sm:p-4 space-y-3"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-display text-base font-bold text-white">
                                  {rec.userId}
                                </span>
                                <span
                                  className={`text-xs font-display font-bold ${
                                    rec.status === 'ACTIVE'
                                      ? 'text-[#00ff33]'
                                      : rec.status === 'REVOKED'
                                        ? 'text-rose-400'
                                        : 'text-amber-300'
                                  }`}
                                >
                                  · {rec.status}
                                </span>
                                <span className="text-xs text-purple-300/80">
                                  · v{rec.appVersion}
                                </span>
                                <span className="text-xs text-purple-300/80">
                                  · {rec.activeSessions} device(s)
                                </span>
                              </div>
                              <p className="font-mono-tabular text-sm font-bold tracking-wider text-fuchsia-300 break-all">
                                {rec.keyValue}
                              </p>
                            </div>

                            {/* Actions: Copy, WhatsApp Share, Extend, Revoke, History */}
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleCopyKey(rec)}
                                className="flex items-center gap-1.5 rounded-lg border border-fuchsia-500/45 bg-[#150728] px-3 py-1.5 text-xs font-bold text-white hover:bg-fuchsia-500/25 cursor-pointer"
                              >
                                {copiedKeyId === rec.id ? (
                                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5" />
                                )}
                                <span>
                                  {copiedKeyId === rec.id ? t.adminCopied : t.adminCopyKey}
                                </span>
                              </button>

                              <a
                                href={buildWhatsAppHref(rec)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 rounded-lg border border-emerald-500/45 bg-emerald-950/40 px-3 py-1.5 text-xs font-bold text-emerald-200 hover:bg-emerald-900/50"
                              >
                                <Share2 className="h-3.5 w-3.5" />
                                <span>{t.adminShareWhatsApp}</span>
                              </a>

                              {rec.status !== 'REVOKED' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleExtend(rec.id)}
                                    className="flex items-center gap-1 rounded-lg border border-purple-400/45 bg-purple-950/50 px-3 py-1.5 text-xs font-bold text-purple-100 hover:bg-purple-800/50 cursor-pointer"
                                  >
                                    <Clock className="h-3.5 w-3.5" />
                                    <span>{t.adminExtend72h}</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleRevoke(rec.id)}
                                    className="rounded-lg border border-rose-500/50 bg-rose-950/40 px-3 py-1.5 text-xs font-bold text-rose-200 hover:bg-rose-900/50 cursor-pointer"
                                  >
                                    {t.adminRevoke}
                                  </button>
                                </>
                              )}

                              <button
                                type="button"
                                onClick={() => handleOpenKeyHistory(rec)}
                                className="flex items-center gap-1 rounded-lg border border-fuchsia-500/35 bg-[#090212] px-3 py-1.5 text-xs font-bold text-fuchsia-200 hover:bg-fuchsia-500/20 cursor-pointer"
                              >
                                <History className="h-3.5 w-3.5" />
                                <span>{t.adminViewHistory}</span>
                              </button>
                            </div>
                          </div>

                          {/* Metadata Grid: Expiry, Last Login, Last Active, Device Model, Android Version */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 border-t border-fuchsia-500/20 pt-2.5 text-xs text-slate-300">
                            <div>
                              <span className="text-purple-300/75 block">Expiry</span>
                              <span className="font-mono-tabular text-white">
                                {formatCountdownShort(rec.expiresAt)} ({formatDate(rec.expiresAt)})
                              </span>
                            </div>
                            <div>
                              <span className="text-purple-300/75 block">Last Login</span>
                              <span className="font-mono-tabular text-white">
                                {formatDate(rec.lastLoginAt)}
                              </span>
                            </div>
                            <div>
                              <span className="text-purple-300/75 block">Last Active</span>
                              <span className="font-mono-tabular text-white">
                                {formatDate(rec.lastActiveAt)}
                              </span>
                            </div>
                            <div>
                              <span className="text-purple-300/75 block">Device Model</span>
                              <span className="text-white">{rec.deviceModel || '—'}</span>
                            </div>
                            <div>
                              <span className="text-purple-300/75 block">Android Version</span>
                              <span className="text-white">{rec.androidVersion || '—'}</span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* GLOBAL LOGIN HISTORY */}
              {section === 'history' && (
                <div className="overflow-x-auto rounded-xl border border-fuchsia-500/35">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#120624] font-display text-purple-200">
                      <tr>
                        <th className="px-3 py-2.5">User ID</th>
                        <th className="px-3 py-2.5">Status</th>
                        <th className="px-3 py-2.5">Device Model</th>
                        <th className="px-3 py-2.5">Android</th>
                        <th className="px-3 py-2.5">IP</th>
                        <th className="px-3 py-2.5">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-fuchsia-500/20">
                      {globalHistory.map((h) => (
                        <tr key={h.id} className="hover:bg-fuchsia-500/5">
                          <td className="px-3 py-2 font-semibold text-white">
                            {h.user_id || 'Unknown'}
                          </td>
                          <td
                            className={`px-3 py-2 font-bold ${
                              h.status === 'SUCCESS' ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {h.status}
                          </td>
                          <td className="px-3 py-2 text-slate-200">{h.device_model || '—'}</td>
                          <td className="px-3 py-2 text-slate-200">{h.android_version || '—'}</td>
                          <td className="px-3 py-2 font-mono-tabular text-slate-300">
                            {h.ip_address || '—'}
                          </td>
                          <td className="px-3 py-2 font-mono-tabular text-slate-300">
                            {formatDate(h.created_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ADMIN AUDIT HISTORY */}
              {section === 'audit' && (
                <div className="space-y-2">
                  {auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="rounded-xl border border-fuchsia-500/30 bg-[#0b0316] px-3.5 py-2.5 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-1.5"
                    >
                      <div>
                        <span className="font-display font-bold text-fuchsia-300">
                          {log.actor} · {log.action}
                        </span>
                        <p className="text-slate-200 mt-0.5">{log.details}</p>
                      </div>
                      <span className="font-mono-tabular text-slate-400 shrink-0">
                        {formatDate(log.created_at)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* TELEGRAM FEEDBACK LIST */}
              {section === 'feedback' && (
                <div className="space-y-2.5">
                  <p className="text-xs text-purple-200/80">
                    Telegram Bot Delivery:{' '}
                    <span
                      className={
                        status.telegramConfigured
                          ? 'font-bold text-emerald-400'
                          : 'font-bold text-amber-300'
                      }
                    >
                      {status.telegramConfigured ? 'Configured' : 'Not Configured in .env'}
                    </span>
                  </p>
                  {feedbackList.length === 0 ? (
                    <p className="py-6 text-center text-sm text-purple-200/70">
                      No feedback messages yet.
                    </p>
                  ) : (
                    feedbackList.map((fb) => (
                      <div
                        key={fb.id}
                        className="rounded-xl border border-fuchsia-500/35 bg-[#0b0316] p-3.5 text-xs space-y-1"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-display font-bold text-white">{fb.user_id}</span>
                          <span className="font-mono-tabular text-slate-400">
                            {formatDate(fb.created_at)} ·{' '}
                            <span
                              className={fb.telegram_sent ? 'text-emerald-400' : 'text-amber-300'}
                            >
                              {fb.telegram_sent
                                ? 'Telegram Sent'
                                : fb.telegram_error || 'Stored Locally'}
                            </span>
                          </span>
                        </div>
                        <p className="text-sm text-slate-100">{fb.message}</p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Per-Key Login History & Active Devices Sub-Modal */}
      {selectedKeyHistory && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-2xl max-h-[82vh] flex flex-col rounded-2xl sayan-panel-border-active bg-[#090212] overflow-hidden">
            <div className="flex items-center justify-between border-b border-fuchsia-500/35 px-5 py-3">
              <div className="flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-fuchsia-400" />
                <h3 className="font-display text-base font-bold text-white">
                  {selectedKeyHistory.record.userId} — Login History & Active Devices
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedKeyHistory(null)}
                className="p-1 text-purple-200 hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
              <div>
                <p className="font-display font-bold text-fuchsia-300 mb-1.5">
                  Active Devices ({selectedKeyHistory.activeSessions.length})
                </p>
                {selectedKeyHistory.activeSessions.length === 0 ? (
                  <p className="text-slate-400">No active device sessions.</p>
                ) : (
                  <div className="space-y-1.5">
                    {selectedKeyHistory.activeSessions.map((s) => (
                      <div
                        key={s.id}
                        className="rounded-lg border border-fuchsia-500/25 bg-[#05010a] px-3 py-2 flex flex-wrap justify-between gap-2"
                      >
                        <span className="text-white font-semibold">
                          {s.device_model || 'Web'} ({s.android_version || 'N/A'})
                        </span>
                        <span className="font-mono-tabular text-slate-300">
                          {s.ip_address} · Last active {formatDate(s.last_active_at)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <p className="font-display font-bold text-fuchsia-300 mb-1.5">
                  Login History ({selectedKeyHistory.history.length})
                </p>
                <div className="space-y-1.5">
                  {selectedKeyHistory.history.map((h) => (
                    <div
                      key={h.id}
                      className="rounded-lg border border-fuchsia-500/20 bg-[#05010a] px-3 py-2 flex flex-wrap justify-between gap-2"
                    >
                      <span
                        className={
                          h.status === 'SUCCESS'
                            ? 'font-bold text-emerald-400'
                            : 'font-bold text-rose-400'
                        }
                      >
                        {h.status} · {h.device_model || '—'} ({h.android_version || '—'})
                      </span>
                      <span className="font-mono-tabular text-slate-400">
                        {h.ip_address} · {formatDate(h.created_at)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
