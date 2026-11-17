import type React from 'react';

export type GameChoiceId = 'india' | 'max';

export interface GameLaunchConfig {
  id: GameChoiceId;
  titleKey: 'freeFireIndia' | 'freeFireMax';
  packageId: string;
  marketUrl: string;
  playStoreUrl: string;
  intentUrl: string;
  imageSrc: string;
  cropStyle: React.CSSProperties;
}

export const GAME_LAUNCH_CONFIGS: GameLaunchConfig[] = [
  {
    id: 'india',
    titleKey: 'freeFireIndia',
    packageId: 'com.dts.freefireindia',
    marketUrl: 'market://details?id=com.dts.freefireindia',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.dts.freefireindia',
    intentUrl:
      'intent://#Intent;package=com.dts.freefireindia;action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;S.browser_fallback_url=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Dcom.dts.freefireindia;end',
    imageSrc: '/assets/aistudio/IMG_20261117_195118_b3435036.jpg',
    cropStyle: {
      position: 'absolute',
      width: '980.82%',
      height: '180.82%',
      left: '-195.89%',
      top: '-28.77%',
      maxWidth: 'none',
    },
  },
  {
    id: 'max',
    titleKey: 'freeFireMax',
    packageId: 'com.dts.freefiremax',
    marketUrl: 'market://details?id=com.dts.freefiremax',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.dts.freefiremax',
    intentUrl:
      'intent://#Intent;package=com.dts.freefiremax;action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;S.browser_fallback_url=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Dcom.dts.freefiremax;end',
    imageSrc: '/assets/aistudio/IMG_20261117_195109_3d011ac5.jpg',
    cropStyle: {
      position: 'absolute',
      width: '786.81%',
      height: '189.01%',
      left: '-154.40%',
      top: '-34.07%',
      maxWidth: 'none',
    },
  },
];

interface NativeAndroidBridge {
  isPackageInstalled?: (packageName: string) => boolean;
  isAppInstalled?: (packageName: string) => boolean;
  launchPackage?: (packageName: string) => boolean | void;
  launchApp?: (packageName: string) => boolean | void;
  openApp?: (packageName: string) => boolean | void;
  openPlayStore?: (packageName: string) => void;
  launchOrOpenPlayStore?: (packageName: string, playStoreUrl: string) => void;
  launchGameWithOverlay?: (
    packageName: string,
    userId: string,
    expiresAtMillis: number,
    prefsJson: string,
  ) => void;
  syncPreferences?: (prefsJson: string) => void;
}

interface CapacitorAppLauncherPlugin {
  canOpenUrl?: (options: { url: string }) => Promise<{ value: boolean }>;
  openUrl?: (options: { url: string }) => Promise<{ completed?: boolean }>;
}

interface WindowWithNativeBridges extends Window {
  SayanAndroid?: NativeAndroidBridge;
  AndroidBridge?: NativeAndroidBridge;
  Android?: NativeAndroidBridge;
  NativeBridge?: NativeAndroidBridge;
  Capacitor?: {
    isNativePlatform?: () => boolean;
    Plugins?: {
      AppLauncher?: CapacitorAppLauncherPlugin;
    };
  };
}

function getNativeBridge(): NativeAndroidBridge | null {
  if (typeof window === 'undefined') return null;
  const w = window as WindowWithNativeBridges;
  return w.SayanAndroid || w.AndroidBridge || w.Android || w.NativeBridge || null;
}

function getCapacitorAppLauncher(): CapacitorAppLauncherPlugin | null {
  if (typeof window === 'undefined') return null;
  const w = window as WindowWithNativeBridges;
  return w.Capacitor?.Plugins?.AppLauncher || null;
}

export function hasNativeAndroidLauncher(): boolean {
  const bridge = getNativeBridge();
  if (
    bridge &&
    (typeof bridge.launchGameWithOverlay === 'function' ||
      typeof bridge.launchOrOpenPlayStore === 'function' ||
      typeof bridge.launchPackage === 'function' ||
      typeof bridge.launchApp === 'function' ||
      typeof bridge.openApp === 'function')
  ) {
    return true;
  }
  const cap = getCapacitorAppLauncher();
  return Boolean(cap && typeof cap.openUrl === 'function');
}

export function syncNativeOverlayPreferences(prefs: unknown): void {
  const bridge = getNativeBridge();
  if (bridge && typeof bridge.syncPreferences === 'function') {
    try {
      bridge.syncPreferences(JSON.stringify(prefs));
    } catch {
      // Ignore bridge error
    }
  }
}

function openPlayStoreListing(game: GameLaunchConfig, bridge: NativeAndroidBridge | null): void {
  if (bridge && typeof bridge.openPlayStore === 'function') {
    bridge.openPlayStore(game.packageId);
    return;
  }
  const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
  window.location.assign(isAndroid ? game.marketUrl : game.playStoreUrl);
}

/**
 * Directly launches the installed Android game via native package detection and launch intents,
 * and starts the native SAYAN MODE floating overlay when supported by the Android host.
 * Only opens the official Google Play Store listing if the package is confirmed not installed.
 * Returns true if a native bridge handled the tap.
 */
export function launchGameNatively(
  game: GameLaunchConfig,
  overlayContext?: { userId: string; expiresAt: number; preferences: unknown },
): boolean {
  const bridge = getNativeBridge();

  if (bridge) {
    // 1. Native Android WebView bridge with integrated overlay permission + floating window
    if (typeof bridge.launchGameWithOverlay === 'function' && overlayContext) {
      bridge.launchGameWithOverlay(
        game.packageId,
        overlayContext.userId,
        overlayContext.expiresAt,
        JSON.stringify(overlayContext.preferences),
      );
      return true;
    }

    // 2. Direct combined native handler
    if (typeof bridge.launchOrOpenPlayStore === 'function') {
      bridge.launchOrOpenPlayStore(game.packageId, game.playStoreUrl);
      return true;
    }

    const checkInstalled = bridge.isPackageInstalled || bridge.isAppInstalled;
    const launchFn = bridge.launchPackage || bridge.launchApp || bridge.openApp;

    // 3. Explicit native package detection first — never redirect to Play Store if installed
    if (typeof checkInstalled === 'function') {
      const installed = Boolean(checkInstalled.call(bridge, game.packageId));
      if (installed) {
        if (typeof launchFn === 'function') {
          launchFn.call(bridge, game.packageId);
          return true;
        }
      } else {
        openPlayStoreListing(game, bridge);
        return true;
      }
    }

    // 4. Launch method returning boolean indicating whether package launch succeeded
    if (typeof launchFn === 'function') {
      const launched = launchFn.call(bridge, game.packageId);
      if (launched === false) {
        openPlayStoreListing(game, bridge);
      }
      return true;
    }
  }

  // 5. Capacitor AppLauncher plugin support in native Android builds
  const capLauncher = getCapacitorAppLauncher();
  if (capLauncher && typeof capLauncher.openUrl === 'function') {
    void (async () => {
      try {
        if (typeof capLauncher.canOpenUrl === 'function') {
          const check = await capLauncher.canOpenUrl({ url: game.packageId });
          if (check?.value) {
            await capLauncher.openUrl!({ url: game.packageId });
            return;
          }
          await capLauncher.openUrl!({ url: game.playStoreUrl });
          return;
        }
        await capLauncher.openUrl!({ url: game.packageId });
      } catch {
        await capLauncher.openUrl?.({ url: game.playStoreUrl }).catch(() => undefined);
      }
    })();
    return true;
  }

  return false;
}
