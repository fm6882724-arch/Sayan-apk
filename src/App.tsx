import { useCallback, useEffect, useState } from 'react';
import { AdminModal } from './components/AdminModal';
import { DashboardScreen } from './components/DashboardScreen';
import { LoginScreen } from './components/LoginScreen';
import { DEFAULT_PREFERENCES } from './types/panel';
import type { Language, PanelPreferences, UserProfile } from './types/panel';
import { ApiError, fetchCurrentSession, logoutUser } from './utils/api';
import {
  clearUserSessionToken,
  getUserSessionToken,
  loadLanguagePreference,
  saveLanguagePreference,
} from './utils/secureStorage';

export default function App() {
  const [checkingSession, setCheckingSession] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [preferences, setPreferences] = useState<PanelPreferences>(() => ({
    ...DEFAULT_PREFERENCES,
    language: loadLanguagePreference(),
  }));
  const [loginNotice, setLoginNotice] = useState<string | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    const token = getUserSessionToken();
    if (!token) {
      // Also check HttpOnly cookie session
      fetchCurrentSession()
        .then((res) => {
          if (!mounted) return;
          setUser(res.user);
          setPreferences(res.preferences);
          saveLanguagePreference(res.preferences.language);
        })
        .catch(() => {
          // Not authenticated — stay on login screen
        })
        .finally(() => {
          if (mounted) setCheckingSession(false);
        });
      return () => {
        mounted = false;
      };
    }

    fetchCurrentSession()
      .then((res) => {
        if (!mounted) return;
        setUser(res.user);
        setPreferences(res.preferences);
        saveLanguagePreference(res.preferences.language);
      })
      .catch((err) => {
        if (!mounted) return;
        clearUserSessionToken();
        if (err instanceof ApiError && err.code === 'KEY_EXPIRED') {
          setLoginNotice('KEY EXPIRED.');
        } else if (err instanceof ApiError && err.message) {
          setLoginNotice(err.message);
        }
      })
      .finally(() => {
        if (mounted) setCheckingSession(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const handleLanguageChange = useCallback((lang: Language) => {
    saveLanguagePreference(lang);
    setPreferences((prev) => ({ ...prev, language: lang }));
  }, []);

  const handleLoginSuccess = useCallback((nextUser: UserProfile, nextPrefs: PanelPreferences) => {
    setLoginNotice(null);
    setUser(nextUser);
    setPreferences(nextPrefs);
    saveLanguagePreference(nextPrefs.language);
  }, []);

  const handlePreferencesChange = useCallback((next: PanelPreferences) => {
    setPreferences(next);
    saveLanguagePreference(next.language);
  }, []);

  const handleLogout = useCallback(async (notice?: string) => {
    await logoutUser().catch(() => undefined);
    clearUserSessionToken();
    setUser(null);
    setLoginNotice(notice || null);
  }, []);

  if (checkingSession) {
    return (
      <div className="min-h-screen w-full bg-[#040108] flex items-center justify-center text-fuchsia-300 font-display text-lg tracking-widest">
        SAYAN MODE...
      </div>
    );
  }

  return (
    <>
      {user ? (
        <DashboardScreen
          user={user}
          preferences={preferences}
          onPreferencesChange={handlePreferencesChange}
          onLogout={handleLogout}
        />
      ) : (
        <LoginScreen
          language={preferences.language}
          onLanguageChange={handleLanguageChange}
          onLoginSuccess={handleLoginSuccess}
          onOpenAdmin={() => setAdminOpen(true)}
          initialNotice={loginNotice}
        />
      )}

      <AdminModal
        open={adminOpen}
        language={preferences.language}
        onClose={() => setAdminOpen(false)}
      />
    </>
  );
}
