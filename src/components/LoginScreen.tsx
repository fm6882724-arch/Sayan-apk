import React, { useEffect, useRef, useState } from 'react';
import {
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  LogIn,
  Minus,
  ShieldCheck,
  X,
} from 'lucide-react';
import { translations } from '../i18n/translations';
import type { Language, PanelPreferences, UserProfile } from '../types/panel';
import { ApiError, loginWithKey } from '../utils/api';
import {
  clearRememberedKey,
  loadRememberedKey,
  saveRememberedKey,
  saveUserSessionToken,
} from '../utils/secureStorage';
import { PurpleCheckbox, SayanCrown, SayanWordmark } from './SayanBranding';

interface LoginScreenProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
  onLoginSuccess: (user: UserProfile, prefs: PanelPreferences) => void;
  onOpenAdmin: () => void;
  initialNotice?: string | null;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  language,
  onLanguageChange,
  onLoginSuccess,
  onOpenAdmin,
  initialNotice,
}) => {
  const t = translations[language];
  const [keyInput, setKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [rememberKey, setRememberKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(initialNotice || null);
  const [lockSeconds, setLockSeconds] = useState<number>(0);
  const crownTapCountRef = useRef(0);
  const crownTapResetTimerRef = useRef<number | null>(null);
  const [compactInfo, setCompactInfo] = useState(false);

  useEffect(() => {
    if (initialNotice) {
      setErrorMsg(initialNotice);
    }
  }, [initialNotice]);

  useEffect(() => {
    let mounted = true;
    loadRememberedKey().then((saved) => {
      if (mounted && saved) {
        setKeyInput(saved);
        setRememberKey(true);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (lockSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setLockSeconds((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [lockSeconds]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        onOpenAdmin();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onOpenAdmin]);

  useEffect(() => {
    return () => {
      if (crownTapResetTimerRef.current !== null) {
        window.clearTimeout(crownTapResetTimerRef.current);
      }
    };
  }, []);

  const handleCrownTap = () => {
    if (crownTapResetTimerRef.current !== null) {
      window.clearTimeout(crownTapResetTimerRef.current);
      crownTapResetTimerRef.current = null;
    }

    const next = crownTapCountRef.current + 1;
    if (next >= 5) {
      crownTapCountRef.current = 0;
      onOpenAdmin();
      return;
    }

    crownTapCountRef.current = next;
    crownTapResetTimerRef.current = window.setTimeout(() => {
      crownTapCountRef.current = 0;
      crownTapResetTimerRef.current = null;
    }, 4000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || lockSeconds > 0) return;

    const trimmed = keyInput.trim();
    if (!trimmed) {
      setErrorMsg(t.enterValidKeyPrompt);
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const result = await loginWithKey(trimmed);
      saveUserSessionToken(result.token);
      if (rememberKey) {
        await saveRememberedKey(trimmed);
      } else {
        clearRememberedKey();
      }
      onLoginSuccess(result.user, {
        ...result.preferences,
        language,
      });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'KEY_EXPIRED') {
          setErrorMsg(language === 'hi' ? 'कुंजी समाप्त हो गई — KEY EXPIRED.' : 'KEY EXPIRED.');
        } else if (err.code === 'KEY_REVOKED') {
          setErrorMsg(language === 'hi' ? 'कुंजी रद्द कर दी गई — KEY REVOKED.' : 'KEY REVOKED.');
        } else if (err.code === 'INVALID_KEY' || err.status === 401) {
          const left =
            typeof err.attemptsRemaining === 'number'
              ? language === 'hi'
                ? ` (${err.attemptsRemaining} प्रयास शेष)`
                : ` (${err.attemptsRemaining} attempt(s) remaining)`
              : '';
          setErrorMsg(
            language === 'hi' ? `अमान्य कुंजी (INVALID KEY)${left}` : `INVALID KEY${left}`,
          );
        } else if (err.code === 'OUTDATED_VERSION') {
          setErrorMsg(
            language === 'hi'
              ? 'पुराना संस्करण कुंजी अमान्य है। नई कुंजी का उपयोग करें।'
              : err.message,
          );
        } else if (err.code === 'LOCKED' || err.status === 429) {
          setErrorMsg(
            language === 'hi'
              ? 'बहुत अधिक असफल प्रयास। अस्थायी रूप से लॉक किया गया।'
              : err.message,
          );
          if (err.remainingSeconds) {
            setLockSeconds(err.remainingSeconds);
          }
        } else if (err.status === 403) {
          setErrorMsg(
            language === 'hi'
              ? 'एक्सेस अस्वीकृत। कुंजी अमान्य, रद्द या समाप्त हो गई है।'
              : err.message || 'ACCESS DENIED. KEY EXPIRED OR REVOKED.',
          );
        } else {
          setErrorMsg(err.message);
        }
      } else {
        setErrorMsg(
          language === 'hi'
            ? 'प्रमाणीकरण सर्वर से संपर्क नहीं हो सका।'
            : 'Unable to reach authentication server.',
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const formatLockTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#040108] text-white flex flex-col justify-between">
      {/* Deep Purple-Black Atmospheric Background */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            'radial-gradient(circle at 22% 55%, rgba(168, 85, 247, 0.32) 0%, rgba(107, 33, 168, 0.16) 36%, transparent 64%), radial-gradient(circle at 78% 72%, rgba(217, 70, 239, 0.22) 0%, transparent 52%), linear-gradient(180deg, #06010c 0%, #030106 100%)',
        }}
      />

      {/* Left Anime Character Artwork Layer (Desktop & Tablet Landscape) */}
      <div className="pointer-events-none fixed inset-y-0 left-0 z-0 hidden md:block w-[42%] max-w-[560px] overflow-hidden">
        <img
          src="/assets/aistudio/file_000000002e7c8211b33b02ec511efa10_60537685.png"
          alt="SAYAN MODE Character"
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover object-[12%_50%] scale-105 opacity-90"
          style={{
            maskImage:
              'linear-gradient(to right, rgba(0,0,0,0.98) 0%, rgba(0,0,0,0.85) 55%, transparent 100%)',
            WebkitMaskImage:
              'linear-gradient(to right, rgba(0,0,0,0.98) 0%, rgba(0,0,0,0.85) 55%, transparent 100%)',
          }}
        />
        <div
          className="absolute inset-x-0 top-0 h-20"
          style={{
            background: 'linear-gradient(180deg, #05010a 0%, transparent 100%)',
          }}
        />
        <div
          className="absolute inset-x-0 bottom-0 h-24"
          style={{
            background: 'linear-gradient(0deg, #05010a 0%, transparent 100%)',
          }}
        />
      </div>

      {/* Mobile Portrait Character Banner Aura */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-0 h-64 md:hidden overflow-hidden opacity-45">
        <img
          src="/assets/aistudio/file_000000002e7c8211b33b02ec511efa10_60537685.png"
          alt="SAYAN MODE Character"
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover object-[15%_25%]"
          style={{
            maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.9) 0%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.9) 0%, transparent 100%)',
          }}
        />
      </div>

      {/* Top Bar */}
      <header className="relative z-20 flex items-center justify-between px-4 sm:px-8 pt-4">
        {/* Compact EN / Hindi Language Switcher */}
        <div className="flex items-center gap-1 rounded-md border border-fuchsia-500/40 bg-[#0b0316]/85 p-0.5 backdrop-blur-sm">
          <button
            type="button"
            onClick={() => onLanguageChange('en')}
            className={`px-2.5 py-1 text-xs font-display font-bold rounded transition-colors cursor-pointer ${
              language === 'en'
                ? 'bg-fuchsia-600 text-white shadow-[0_0_10px_rgba(217,0,255,0.6)]'
                : 'text-purple-200/75 hover:text-white'
            }`}
          >
            EN
          </button>
          <button
            type="button"
            onClick={() => onLanguageChange('hi')}
            className={`px-2.5 py-1 text-xs font-display font-bold rounded transition-colors cursor-pointer ${
              language === 'hi'
                ? 'bg-fuchsia-600 text-white shadow-[0_0_10px_rgba(217,0,255,0.6)]'
                : 'text-purple-200/75 hover:text-white'
            }`}
          >
            हिन्दी
          </button>
        </div>

        {/* Top-Right Window Control Capsule [ — | × ] + Discreet Hidden Admin Lock */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenAdmin}
            title="Admin"
            aria-label="Hidden Admin Login"
            className="flex h-8 w-8 items-center justify-center rounded-md text-fuchsia-300/20 hover:text-fuchsia-300/90 hover:bg-fuchsia-500/10 transition-colors cursor-pointer"
          >
            <Lock className="h-3.5 w-3.5" />
          </button>
          <div className="flex items-center rounded-lg border border-fuchsia-500/70 bg-[#0d041a]/90 shadow-[0_0_14px_rgba(217,0,255,0.45)] overflow-hidden">
            <button
              type="button"
              onClick={() => setCompactInfo((v) => !v)}
              aria-label="Toggle info"
              className="flex h-8 w-9 items-center justify-center text-white/90 hover:bg-fuchsia-500/20 transition-colors cursor-pointer"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="h-5 w-px bg-fuchsia-500/50" />
            <button
              type="button"
              onClick={() => {
                setKeyInput('');
                setErrorMsg(null);
              }}
              aria-label="Clear key input"
              className="flex h-8 w-9 items-center justify-center text-white/90 hover:bg-fuchsia-500/20 transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Center Main Layout */}
      <main className="relative z-10 flex-1 flex flex-col justify-center px-4 sm:px-8 py-4">
        <div className="mx-auto w-full max-w-5xl grid grid-cols-1 md:grid-cols-12 items-center gap-6">
          {/* Spacer column on md+ for Left Anime Character */}
          <div className="hidden md:block md:col-span-4 lg:col-span-4" />

          {/* Center Crown + SAYAN Branding + KEY LOGIN Card */}
          <div className="md:col-span-8 lg:col-span-6 flex flex-col items-center">
            <div className="flex flex-col items-center mb-3 sm:mb-4">
              <button
                type="button"
                onClick={handleCrownTap}
                className="flex flex-col items-center cursor-pointer select-none touch-manipulation focus:outline-none active:scale-[0.99] transition-transform"
                aria-label="SAYAN MODE Crown Logo"
              >
                <SayanCrown className="w-16 h-11 sm:w-20 sm:h-13 -mb-1 pointer-events-none" />
                <div className="pointer-events-none">
                  <SayanWordmark size="lg" />
                </div>
              </button>
              <div className="mt-1 flex items-center gap-3 w-full max-w-xs justify-center">
                <span className="h-[2px] flex-1 bg-gradient-to-r from-transparent via-fuchsia-400 to-fuchsia-200 shadow-[0_0_8px_#e879f9]" />
                <span className="font-display text-xs sm:text-sm font-bold italic tracking-[0.22em] text-slate-100 whitespace-nowrap">
                  {t.brandSubtitle}
                </span>
                <span className="h-[2px] flex-1 bg-gradient-to-l from-transparent via-fuchsia-400 to-fuchsia-200 shadow-[0_0_8px_#e879f9]" />
              </div>
            </div>

            {/* Chamfered Neon Login Box */}
            <form
              onSubmit={handleSubmit}
              className="w-full max-w-[460px] sayan-panel-border-active rounded-2xl p-5 sm:p-7 backdrop-blur-md"
              style={{
                clipPath:
                  'polygon(18px 0%, calc(100% - 18px) 0%, 100% 18px, 100% calc(100% - 18px), calc(100% - 18px) 100%, 18px 100%, 0% calc(100% - 18px), 0% 18px)',
              }}
            >
              {/* KEY LOGIN Header */}
              <div className="flex items-center justify-center gap-2.5 mb-5">
                <Lock className="h-7 w-7 text-fuchsia-500 fill-fuchsia-500/80 drop-shadow-[0_0_10px_rgba(217,0,255,0.9)]" />
                <h1 className="font-display text-2xl sm:text-3xl font-bold italic tracking-wider">
                  <span className="text-white">{t.keyLoginTitleWhite} </span>
                  <span className="text-fuchsia-400 sayan-text-glow">{t.keyLoginTitleAccent}</span>
                </h1>
              </div>

              {/* Enter Your Key Input */}
              <div className="relative flex items-center rounded-lg border-2 border-fuchsia-500/80 bg-[#0b0316]/95 shadow-[0_0_16px_rgba(192,38,211,0.35)] focus-within:border-fuchsia-300 focus-within:shadow-[0_0_22px_rgba(232,121,249,0.65)] transition-all">
                <KeyRound className="ml-3.5 h-5 w-5 shrink-0 text-white" />
                <input
                  type={showKey ? 'text' : 'password'}
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder={t.enterYourKey}
                  autoComplete="off"
                  spellCheck={false}
                  disabled={loading || lockSeconds > 0}
                  className="w-full bg-transparent px-3 py-3.5 text-base font-medium tracking-wider text-white placeholder:text-slate-400 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((s) => !s)}
                  aria-label={showKey ? t.hideKey : t.showKey}
                  className="mr-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-purple-200/80 hover:text-white hover:bg-fuchsia-500/20 transition-colors cursor-pointer"
                >
                  {showKey ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>

              {/* Remember Key Toggle & Status Prompt */}
              <div className="mt-3 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="max-w-[200px]">
                    <PurpleCheckbox
                      checked={rememberKey}
                      onChange={(checked) => {
                        setRememberKey(checked);
                        if (!checked) clearRememberedKey();
                      }}
                      label={t.rememberKey}
                    />
                  </div>
                  {lockSeconds > 0 && (
                    <span className="font-mono-tabular text-xs font-bold text-rose-400">
                      {formatLockTime(lockSeconds)}
                    </span>
                  )}
                </div>

                <div
                  className={`flex items-center justify-center gap-2 py-1 text-center text-sm font-medium ${
                    errorMsg ? 'text-rose-400' : 'text-fuchsia-300'
                  }`}
                >
                  <ShieldCheck
                    className={`h-4 w-4 shrink-0 ${
                      errorMsg ? 'text-rose-400' : 'text-fuchsia-400'
                    }`}
                  />
                  <span>{errorMsg || t.enterValidKeyPrompt}</span>
                </div>
              </div>

              {/* LOGIN Button */}
              <button
                type="submit"
                disabled={loading || lockSeconds > 0}
                className="mt-3 flex w-full items-center justify-center gap-3 rounded-xl py-3.5 px-6 font-display text-xl font-bold italic tracking-widest text-white sayan-login-btn transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed min-h-[52px]"
              >
                <LogIn className="h-6 w-6 stroke-[2.5]" />
                <span>{loading ? t.loggingIn : t.loginButton}</span>
              </button>

              {compactInfo && (
                <p className="mt-3 text-center text-xs text-purple-200/75">
                  {t.visualNotice}
                </p>
              )}
            </form>

            {/* Powered By Attribution */}
            <div className="mt-4 flex items-center gap-3 w-full max-w-[420px]">
              <span className="h-[1.5px] flex-1 bg-gradient-to-r from-transparent to-fuchsia-500/80" />
              <p className="text-xs sm:text-sm font-medium tracking-wide text-fuchsia-300">
                {t.poweredBy}{' '}
                <span className="font-display font-bold italic text-white">
                  {t.poweredByBrand}
                </span>
              </p>
              <span className="h-[1.5px] flex-1 bg-gradient-to-l from-transparent to-fuchsia-500/80" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
