import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Clock,
  Crosshair,
  ExternalLink,
  LogOut,
  RotateCcw,
  Send,
  Settings,
  ShieldHalf,
  Star,
  User,
} from 'lucide-react';
import { translations } from '../i18n/translations';
import { DEFAULT_PREFERENCES } from '../types/panel';
import type { DashboardTab, PanelPreferences, UserProfile } from '../types/panel';
import { ApiError, savePreferences, sendHeartbeat, submitFeedback } from '../utils/api';
import { FlameEmblem, PurpleCheckbox, SayanCrown, SayanWordmark } from './SayanBranding';
import {
  GAME_LAUNCH_CONFIGS,
  hasNativeAndroidLauncher,
  launchGameNatively,
  syncNativeOverlayPreferences,
  type GameChoiceId,
  type GameLaunchConfig,
} from '../utils/androidLauncher';

interface DashboardScreenProps {
  user: UserProfile;
  preferences: PanelPreferences;
  onPreferencesChange: (next: PanelPreferences) => void;
  onLogout: (notice?: string) => void;
}

function formatRemainingCountdown(expiresAt: number, now: number): string {
  const diffMs = Math.max(0, expiresAt - now);
  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  user,
  preferences,
  onPreferencesChange,
  onLogout,
}) => {
  const t = translations[preferences.language];
  const [activeTab, setActiveTab] = useState<DashboardTab>('aim');
  const [selectedGame, setSelectedGame] = useState<GameChoiceId | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [isOnline, setIsOnline] = useState(true);
  const [showResetModal, setShowResetModal] = useState(false);

  const isAndroid = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    return /Android/i.test(navigator.userAgent);
  }, []);

  const handleGameCardClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    game: GameLaunchConfig,
  ) => {
    setSelectedGame(game.id);
    if (
      hasNativeAndroidLauncher() &&
      launchGameNatively(game, {
        userId: user.userId,
        expiresAt: user.expiresAt,
        preferences,
      })
    ) {
      e.preventDefault();
    }
  };

  // Telegram feedback state in SETTINGS
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackSending, setFeedbackSending] = useState(false);
  const [feedbackNotice, setFeedbackNotice] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  const saveTimerRef = useRef<number | null>(null);

  // Live 1s countdown & expiry enforcement
  useEffect(() => {
    const timer = window.setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (user.expiresAt <= current) {
        onLogout('KEY EXPIRED.');
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [user.expiresAt, onLogout]);

  // Periodic backend heartbeat to update last_active_at & verify key validity
  useEffect(() => {
    let active = true;
    const pulse = async () => {
      try {
        await sendHeartbeat();
        if (active) setIsOnline(true);
      } catch (err) {
        if (!active) return;
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          onLogout(err.message);
          return;
        }
        setIsOnline(false);
      }
    };

    const interval = window.setInterval(pulse, 25000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [onLogout]);

  const updatePref = <K extends keyof PanelPreferences>(key: K, value: PanelPreferences[K]) => {
    const next: PanelPreferences = { ...preferences, [key]: value };
    onPreferencesChange(next);
    syncNativeOverlayPreferences(next);

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => {
      savePreferences(next).catch((err) => {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          onLogout(err.message);
        }
      });
    }, 180);
  };

  const handleConfirmReset = async () => {
    const resetState: PanelPreferences = {
      ...DEFAULT_PREFERENCES,
      enableFunctions: false,
      espColor: 0,
      language: preferences.language,
    };
    onPreferencesChange(resetState);
    syncNativeOverlayPreferences(resetState);
    setShowResetModal(false);
    try {
      await savePreferences(resetState);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        onLogout(err.message);
      }
    }
  };

  const handleSendFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = feedbackText.trim();
    if (trimmed.length < 3 || feedbackSending) return;

    setFeedbackSending(true);
    setFeedbackNotice(null);
    try {
      const res = await submitFeedback(trimmed);
      setFeedbackText('');
      setFeedbackNotice({
        ok: true,
        text: res.telegramSent ? t.feedbackSentSuccess : t.feedbackSavedLocalOnly,
      });
    } catch (err) {
      setFeedbackNotice({
        ok: false,
        text: err instanceof Error ? err.message : 'Failed to send feedback.',
      });
    } finally {
      setFeedbackSending(false);
    }
  };

  const remainingFormatted = formatRemainingCountdown(user.expiresAt, now);

  const tabs: Array<{ id: DashboardTab; label: string; icon: React.ReactNode }> = [
    { id: 'aim', label: t.tabAimMode, icon: <Crosshair className="h-5 w-5" /> },
    { id: 'esp', label: t.tabEspMode, icon: <Star className="h-5 w-5 fill-current" /> },
    { id: 'bypass', label: t.tabBypassMode, icon: <ShieldHalf className="h-5 w-5" /> },
    { id: 'settings', label: t.tabSettings, icon: <Settings className="h-5 w-5" /> },
  ];

  const isSettingsTab = activeTab === 'settings';
  const colorHue = preferences.espColor;

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-[#040108] text-white flex flex-col">
      {/* Neon Purple Perimeter & Atmospheric Background */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            'radial-gradient(circle at 12% 15%, rgba(192, 38, 211, 0.28) 0%, transparent 42%), radial-gradient(circle at 86% 78%, rgba(217, 0, 255, 0.25) 0%, transparent 48%), radial-gradient(circle at 50% 50%, rgba(88, 28, 135, 0.14) 0%, #040108 74%)',
        }}
      />

      {/* Outer Neon Glow Border Frame */}
      <div className="relative z-10 flex-1 flex flex-col mx-auto w-full max-w-[1440px] min-w-0 p-2 sm:p-4 lg:p-5">
        <div className="flex-1 flex flex-col min-w-0 rounded-2xl border border-fuchsia-500/45 bg-[#05010a]/85 p-2.5 sm:p-5 shadow-[0_0_32px_rgba(192,38,211,0.3)] backdrop-blur-sm">
          {/* Top Row: Crown + SAYAN Logo + 4 Tabs */}
          <header className="flex flex-col lg:flex-row items-center justify-between gap-3 sm:gap-4 pb-3 sm:pb-4 min-w-0">
            <div className="flex flex-col sm:flex-row items-center justify-between w-full lg:w-auto gap-2.5 min-w-0">
              <div className="flex flex-col items-center shrink-0">
                <SayanCrown className="w-11 h-7 sm:w-14 sm:h-9 -mb-1" />
                <SayanWordmark size="md" />
              </div>

              {/* Mobile Status Strip (shown < lg where left sidebar is hidden — zero horizontal overflow) */}
              <div className="grid lg:hidden grid-cols-3 items-center gap-1.5 w-full sm:w-auto rounded-xl sayan-panel-border px-2.5 py-2 text-[11px] sm:text-xs min-w-0">
                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] text-slate-300 leading-tight">{t.userLabel}</span>
                  <span className="font-display font-bold text-fuchsia-300 truncate">
                    {user.userId}
                  </span>
                </div>
                <div className="flex flex-col items-center min-w-0 border-x border-fuchsia-500/25 px-1.5">
                  <span className="text-[10px] text-slate-300 leading-tight">{t.timeLabel}</span>
                  <span className="font-mono-tabular font-bold text-fuchsia-200 whitespace-nowrap">
                    {remainingFormatted}
                  </span>
                </div>
                <div className="flex flex-col items-end min-w-0">
                  <span className="text-[10px] text-slate-300 leading-tight">{t.statusLabel}</span>
                  <span
                    className={`flex items-center gap-1 font-display font-bold whitespace-nowrap ${
                      isOnline ? 'text-[#00ff33]' : 'text-rose-400'
                    }`}
                  >
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${
                        isOnline ? 'bg-[#00ff33]' : 'bg-rose-500'
                      }`}
                    />
                    {isOnline ? t.statusOnline : t.statusOffline}
                  </span>
                </div>
              </div>
            </div>

            {/* EXACTLY FOUR TABS */}
            <nav
              aria-label="Dashboard Modes"
              className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 w-full lg:flex-1 lg:max-w-[920px] min-w-0"
            >
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center justify-center gap-1.5 sm:gap-2 rounded-xl px-2.5 sm:px-3 py-2.5 sm:py-3 font-display text-xs sm:text-sm md:text-base font-bold tracking-wider text-white transition-all duration-150 whitespace-nowrap min-w-0 min-h-[44px] cursor-pointer ${
                      isActive ? 'sayan-tab-active' : 'sayan-tab-inactive'
                    }`}
                  >
                    <span className="shrink-0">{tab.icon}</span>
                    <span className="truncate">{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </header>

          {/* Main Dashboard Grid */}
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch min-w-0">
            {/* Left Sidebar Column (Desktop/Landscape — matches Screenshot 2) */}
            <aside className="hidden lg:flex lg:col-span-3 flex-col justify-between gap-3">
              <div className="flex flex-col gap-3">
                {/* User Card */}
                <div className="sayan-panel-border rounded-2xl px-4 py-3.5 flex items-center gap-3.5">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-[#07020e] shadow-[0_0_12px_rgba(255,255,255,0.5)]">
                    <User className="h-8 w-8 fill-current" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-display text-base font-medium text-white leading-tight">
                      {t.userLabel}
                    </p>
                    <p className="font-display text-xl font-bold text-fuchsia-400 sayan-text-glow truncate">
                      {user.userId}
                    </p>
                  </div>
                </div>

                {/* Time Card */}
                <div className="sayan-panel-border rounded-2xl px-4 py-3.5 flex items-center gap-3.5">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-[#07020e] shadow-[0_0_12px_rgba(255,255,255,0.5)]">
                    <Clock className="h-8 w-8 stroke-[2.5]" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-display text-base font-medium text-white leading-tight">
                      {t.timeLabel}
                    </p>
                    <p className="font-mono-tabular text-xl font-bold text-fuchsia-400 sayan-text-glow">
                      {remainingFormatted}
                    </p>
                  </div>
                </div>

                {/* Status Card */}
                <div className="sayan-panel-border rounded-2xl px-4 py-3.5 flex items-center gap-3.5">
                  <div
                    className={`h-12 w-12 shrink-0 rounded-full ${
                      isOnline
                        ? 'bg-[#00e600] shadow-[0_0_16px_rgba(0,255,51,0.8)]'
                        : 'bg-rose-500 shadow-[0_0_16px_rgba(244,63,94,0.8)]'
                    }`}
                  />
                  <div className="min-w-0">
                    <p className="font-display text-base font-medium text-white leading-tight">
                      {t.statusLabel}
                    </p>
                    <p
                      className={`font-display text-xl font-extrabold tracking-wide ${
                        isOnline ? 'text-[#00ff33] sayan-green-glow' : 'text-rose-400'
                      }`}
                    >
                      {isOnline ? t.statusOnline : t.statusOffline}
                    </p>
                  </div>
                </div>
              </div>

              {/* Bottom Left Flame Emblem + SAYAN FF PANEL v1.0 */}
              <div className="flex items-center gap-2.5 px-2 py-2 mt-auto">
                <FlameEmblem className="w-11 h-13 shrink-0" />
                <div className="leading-tight">
                  <p className="font-display text-lg font-extrabold tracking-wide text-fuchsia-400 sayan-text-glow">
                    {t.panelTitle}
                  </p>
                  <p className="font-display text-base font-bold text-white">
                    v{user.appVersion}
                  </p>
                </div>
              </div>
            </aside>

            {/* Main Workspace Area */}
            {isSettingsTab ? (
              /* SETTINGS TAB VIEW */
              <section className="lg:col-span-9 flex flex-col justify-between gap-4">
                <div className="sayan-panel-border-active rounded-2xl p-4 sm:p-6 flex flex-col gap-5">
                  <div className="flex items-center justify-between border-b border-fuchsia-500/35 pb-3">
                    <div className="flex items-center gap-2.5">
                      <Settings className="h-6 w-6 text-white" />
                      <h2 className="font-display text-xl font-bold tracking-wider text-white">
                        {t.settingsTitle}
                      </h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => onLogout()}
                      className="flex items-center gap-2 rounded-lg border border-rose-500/60 bg-rose-950/50 px-3.5 py-2 font-display text-sm font-bold text-rose-200 hover:bg-rose-900/60 transition-colors cursor-pointer"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>{t.logoutButton}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Language & Key Info */}
                    <div className="flex flex-col gap-4">
                      <div>
                        <p className="font-display text-sm font-bold uppercase tracking-wider text-fuchsia-300 mb-2">
                          {t.languageLabel}
                        </p>
                        <div className="grid grid-cols-2 gap-2.5">
                          <button
                            type="button"
                            onClick={() => updatePref('language', 'en')}
                            className={`rounded-xl px-4 py-2.5 font-display text-sm font-bold transition-all cursor-pointer min-h-[44px] ${
                              preferences.language === 'en'
                                ? 'sayan-tab-active text-white'
                                : 'sayan-tab-inactive text-purple-200'
                            }`}
                          >
                            {t.english}
                          </button>
                          <button
                            type="button"
                            onClick={() => updatePref('language', 'hi')}
                            className={`rounded-xl px-4 py-2.5 font-display text-sm font-bold transition-all cursor-pointer min-h-[44px] ${
                              preferences.language === 'hi'
                                ? 'sayan-tab-active text-white'
                                : 'sayan-tab-inactive text-purple-200'
                            }`}
                          >
                            {t.hindi}
                          </button>
                        </div>
                      </div>

                      <div className="rounded-xl border border-fuchsia-500/35 bg-[#090212]/90 p-4 space-y-2 text-sm">
                        <p className="font-display text-sm font-bold uppercase tracking-wider text-fuchsia-300">
                          {t.accountInfoTitle}
                        </p>
                        <div className="flex justify-between gap-2 min-w-0">
                          <span className="text-slate-300 shrink-0">{t.userLabel}</span>
                          <span className="font-semibold text-white truncate">{user.userId}</span>
                        </div>
                        <div className="flex justify-between gap-2 min-w-0">
                          <span className="text-slate-300 shrink-0">{t.keyExpiresAt}:</span>
                          <span className="font-mono-tabular text-fuchsia-200 text-right break-all">
                            {new Date(user.expiresAt).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between gap-2 min-w-0">
                          <span className="text-slate-300 shrink-0">{t.appVersionLabel}:</span>
                          <span className="font-mono-tabular text-white">v{user.appVersion}</span>
                        </div>
                        <div className="flex justify-between gap-2 min-w-0">
                          <span className="text-slate-300 shrink-0">{t.deviceModelLabel}:</span>
                          <span className="text-white truncate">
                            {user.deviceModel}
                          </span>
                        </div>
                        <div className="flex justify-between gap-2 min-w-0">
                          <span className="text-slate-300 shrink-0">{t.androidVersionLabel}:</span>
                          <span className="text-white truncate">{user.androidVersion}</span>
                        </div>
                        <p className="pt-2 border-t border-fuchsia-500/20 text-xs text-purple-200/70">
                          {t.visualNotice}
                        </p>
                      </div>
                    </div>

                    {/* Telegram Feedback Integration */}
                    <form
                      onSubmit={handleSendFeedback}
                      className="rounded-xl border border-fuchsia-500/35 bg-[#090212]/90 p-4 flex flex-col justify-between gap-3"
                    >
                      <div>
                        <p className="font-display text-sm font-bold uppercase tracking-wider text-fuchsia-300 mb-2">
                          {t.telegramFeedbackTitle}
                        </p>
                        <textarea
                          rows={5}
                          value={feedbackText}
                          onChange={(e) => setFeedbackText(e.target.value)}
                          placeholder={t.feedbackPlaceholder}
                          maxLength={1000}
                          className="w-full rounded-lg border border-fuchsia-500/50 bg-[#05010a] p-3 text-sm text-white placeholder:text-slate-400 focus:border-fuchsia-300 focus:outline-none resize-none"
                        />
                        {feedbackNotice && (
                          <p
                            className={`mt-2 text-xs font-medium ${
                              feedbackNotice.ok ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {feedbackNotice.text}
                          </p>
                        )}
                      </div>

                      <button
                        type="submit"
                        disabled={feedbackSending || feedbackText.trim().length < 3}
                        className="flex items-center justify-center gap-2 rounded-xl py-2.5 px-4 font-display text-sm font-bold tracking-wider text-white sayan-login-btn cursor-pointer disabled:opacity-50 min-h-[44px]"
                      >
                        <Send className="h-4 w-4" />
                        <span>{feedbackSending ? t.sendingFeedback : t.sendFeedback}</span>
                      </button>
                    </form>
                  </div>
                </div>

                {/* Bottom RESET ALL Row */}
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowResetModal(true)}
                    className="sayan-tab-inactive flex items-center justify-center gap-3 rounded-xl px-8 py-3 font-display text-base sm:text-lg font-bold tracking-wider text-white cursor-pointer min-h-[48px]"
                  >
                    <RotateCcw className="h-5 w-5" />
                    <span>{t.resetAll}</span>
                  </button>
                </div>
              </section>
            ) : (
              /* MODE PANELS (Matches Screenshot 2 on Desktop/Landscape; Focused Tab on Mobile Portrait) */
              <section className="lg:col-span-9 flex flex-col justify-between gap-4 min-w-0">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 flex-1 min-w-0">
                  {/* Center Column: AIM MODE + ESP MODE */}
                  <div className="md:col-span-6 lg:col-span-7 flex flex-col gap-4 min-w-0">
                    {/* AIM MODE Panel */}
                    <div
                      className={`${
                        activeTab === 'aim' ? 'block sayan-panel-border-active' : 'hidden md:block sayan-panel-border'
                      } rounded-2xl p-4 sm:p-5 transition-all`}
                    >
                      <div className="flex items-center gap-2.5 pb-2.5 mb-2 border-b border-fuchsia-400/35">
                        <Crosshair className="h-6 w-6 text-white" />
                        <h2 className="font-display text-xl font-bold tracking-wider text-white">
                          {t.tabAimMode}
                        </h2>
                      </div>
                      <div className="flex flex-col">
                        <PurpleCheckbox
                          checked={preferences.enableFunctions}
                          onChange={(val) => updatePref('enableFunctions', val)}
                          label={t.enableFunctions}
                        />
                        <PurpleCheckbox
                          checked={preferences.aimbotLegit}
                          onChange={(val) => updatePref('aimbotLegit', val)}
                          label={t.aimbotLegit}
                        />
                        <PurpleCheckbox
                          checked={preferences.aimbotRage}
                          onChange={(val) => updatePref('aimbotRage', val)}
                          label={t.aimbotRage}
                        />
                        <PurpleCheckbox
                          checked={preferences.aimbotShoulder}
                          onChange={(val) => updatePref('aimbotShoulder', val)}
                          label={t.aimbotShoulder}
                        />
                        <PurpleCheckbox
                          checked={preferences.aimbotSilent}
                          onChange={(val) => updatePref('aimbotSilent', val)}
                          label={t.aimbotSilent}
                        />
                        <PurpleCheckbox
                          checked={preferences.noRecoil}
                          onChange={(val) => updatePref('noRecoil', val)}
                          label={t.noRecoil}
                        />
                      </div>
                    </div>

                    {/* FREE FIRE INDIA & FREE FIRE MAX Game Selection Cards directly below AIM MODE */}
                    <div
                      className={`${
                        activeTab === 'aim' ? 'grid' : 'hidden md:grid'
                      } grid-cols-1 sm:grid-cols-2 gap-3 min-w-0`}
                    >
                      {GAME_LAUNCH_CONFIGS.map((game) => {
                        const isSelected = selectedGame === game.id;
                        return (
                          <a
                            key={game.id}
                            href={isAndroid ? game.intentUrl : game.playStoreUrl}
                            target={isAndroid ? undefined : '_blank'}
                            rel={isAndroid ? undefined : 'noopener noreferrer'}
                            onClick={(e) => handleGameCardClick(e, game)}
                            className={`group flex items-center gap-3 rounded-2xl p-3 sm:p-3.5 transition-all duration-150 cursor-pointer min-w-0 ${
                              isSelected
                                ? 'sayan-panel-border-active'
                                : 'sayan-panel-border hover:border-fuchsia-300 hover:shadow-[0_0_22px_rgba(217,0,255,0.55)]'
                            }`}
                          >
                            <div className="relative h-14 w-14 sm:h-16 sm:w-16 shrink-0 overflow-hidden rounded-xl border-2 border-fuchsia-400/80 bg-[#0b0316] shadow-[0_0_14px_rgba(217,0,255,0.45)] group-hover:border-fuchsia-200 transition-colors">
                              <img
                                src={game.imageSrc}
                                alt={t[game.titleKey]}
                                draggable={false}
                                style={game.cropStyle}
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-display text-sm sm:text-base font-bold italic tracking-wider text-white group-hover:text-fuchsia-200 truncate">
                                {t[game.titleKey]}
                              </p>
                              <p className="mt-0.5 flex items-center gap-1 text-[11px] text-fuchsia-300/85">
                                <ExternalLink className="h-3 w-3 shrink-0" />
                                <span className="truncate">{t.launchOrStoreHint}</span>
                              </p>
                            </div>
                          </a>
                        );
                      })}
                    </div>

                    {/* ESP MODE Panel */}
                    <div
                      className={`${
                        activeTab === 'esp' ? 'block sayan-panel-border-active' : 'hidden md:block sayan-panel-border'
                      } rounded-2xl p-4 sm:p-5 transition-all`}
                    >
                      <div className="flex items-center gap-2.5 pb-2.5 mb-2 border-b border-fuchsia-400/35">
                        <Star className="h-6 w-6 text-white fill-white" />
                        <h2 className="font-display text-xl font-bold tracking-wider text-white">
                          {t.tabEspMode}
                        </h2>
                      </div>
                      <div className="flex flex-col">
                        <PurpleCheckbox
                          checked={preferences.espLine}
                          onChange={(val) => updatePref('espLine', val)}
                          label={t.espLine}
                        />
                        <PurpleCheckbox
                          checked={preferences.espBox}
                          onChange={(val) => updatePref('espBox', val)}
                          label={t.espBox}
                        />
                        <PurpleCheckbox
                          checked={preferences.espName}
                          onChange={(val) => updatePref('espName', val)}
                          label={t.espName}
                        />
                        <PurpleCheckbox
                          checked={preferences.espHealth}
                          onChange={(val) => updatePref('espHealth', val)}
                          label={t.espHealth}
                        />
                        <PurpleCheckbox
                          checked={preferences.espDistance}
                          onChange={(val) => updatePref('espDistance', val)}
                          label={t.espDistance}
                        />
                      </div>

                      {/* ESP Color: 0 with empty dark rectangular color box */}
                      <div className="mt-3 flex flex-wrap sm:flex-nowrap items-center gap-3 pt-1 min-w-0">
                        <label
                          htmlFor="esp-color-range"
                          className="font-display text-base sm:text-lg font-medium text-white whitespace-nowrap shrink-0"
                        >
                          {t.espColor}{' '}
                          <span className="font-mono-tabular font-bold text-white ml-1">
                            {colorHue}
                          </span>
                        </label>
                        <div className="relative flex-1 min-w-[140px] max-w-[240px] h-6 rounded-[3px] border border-fuchsia-500/35 bg-[#1b1622] overflow-hidden">
                          {colorHue > 0 && (
                            <div
                              className="h-full transition-all duration-75"
                              style={{
                                width: `${Math.max(6, (colorHue / 360) * 100)}%`,
                                background: `linear-gradient(90deg, #d900ff 0%, hsl(${colorHue}, 95%, 60%) 100%)`,
                              }}
                            />
                          )}
                          <input
                            id="esp-color-range"
                            type="range"
                            min={0}
                            max={360}
                            value={colorHue}
                            onChange={(e) => updatePref('espColor', Number(e.target.value))}
                            aria-label="ESP Color"
                            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: BYPASS MODE + Clean Vector Crown Signature */}
                  <div className="md:col-span-6 lg:col-span-5 flex flex-col justify-between gap-4 min-w-0">
                    {/* BYPASS MODE Panel */}
                    <div
                      className={`${
                        activeTab === 'bypass'
                          ? 'block sayan-panel-border-active'
                          : 'hidden md:block sayan-panel-border'
                      } rounded-2xl p-4 sm:p-5 transition-all`}
                    >
                      <div className="flex items-center gap-2.5 pb-2.5 mb-2 border-b border-fuchsia-400/35">
                        <ShieldHalf className="h-6 w-6 text-white" />
                        <h2 className="font-display text-xl font-bold tracking-wider text-white">
                          {t.tabBypassMode}
                        </h2>
                      </div>
                      <div className="flex flex-col">
                        <PurpleCheckbox
                          checked={preferences.onlineBypassStatus}
                          onChange={(val) => updatePref('onlineBypassStatus', val)}
                          label={t.onlineBypassStatus}
                        />
                        <PurpleCheckbox
                          checked={preferences.offlineBypassStatus}
                          onChange={(val) => updatePref('offlineBypassStatus', val)}
                          label={t.offlineBypassStatus}
                        />
                      </div>
                    </div>

                    {/* Clean Vector SAYAN Aura (No static screenshot image) */}
                    <div
                      className="hidden md:flex relative flex-1 min-h-[190px] items-center justify-center overflow-hidden rounded-2xl pointer-events-none select-none"
                      style={{
                        background:
                          'radial-gradient(circle at 55% 58%, rgba(192, 38, 211, 0.24) 0%, rgba(126, 34, 206, 0.1) 45%, transparent 75%)',
                      }}
                    >
                      <div className="flex flex-col items-center opacity-85">
                        <SayanCrown className="w-20 h-13 -mb-2" />
                        <SayanWordmark size="lg" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Action Row: RESET ALL ONLY (No ENABLE ALL per requirement) */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex lg:hidden items-center gap-2">
                    <FlameEmblem className="w-7 h-9" />
                    <span className="font-display text-sm font-bold text-fuchsia-400">
                      {t.panelTitle} v{user.appVersion}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowResetModal(true)}
                    className="ml-auto sayan-tab-inactive flex items-center justify-center gap-3 rounded-xl px-8 sm:px-10 py-3 font-display text-base sm:text-lg font-bold tracking-wider text-white transition-all hover:border-fuchsia-400 cursor-pointer min-h-[48px]"
                  >
                    <RotateCcw className="h-5 w-5" />
                    <span>{t.resetAll}</span>
                  </button>
                </div>
              </section>
            )}
          </div>
        </div>
      </div>

      {/* RESET ALL Confirmation Popup */}
      {showResetModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-confirm-title"
        >
          <div className="w-full max-w-md sayan-panel-border-active rounded-2xl p-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-fuchsia-400 bg-fuchsia-600/25">
              <RotateCcw className="h-6 w-6 text-fuchsia-300" />
            </div>
            <h3
              id="reset-confirm-title"
              className="font-display text-xl font-bold tracking-wide text-white"
            >
              {t.resetConfirmTitle}
            </h3>
            <p className="mt-2 text-sm text-purple-100/85">{t.resetConfirmDesc}</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="sayan-tab-inactive rounded-xl px-4 py-2.5 font-display text-sm font-bold text-white cursor-pointer min-h-[44px]"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                className="sayan-login-btn rounded-xl px-4 py-2.5 font-display text-sm font-bold text-white cursor-pointer min-h-[44px]"
              >
                {t.confirmReset}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
