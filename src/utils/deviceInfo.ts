declare const __CLIENT_APP_VERSION__: string;

export interface ClientDeviceInfo {
  deviceModel: string;
  androidVersion: string;
  appVersion: string;
}

export const CLIENT_APP_VERSION: string = __CLIENT_APP_VERSION__ || '1.0.0';

interface NavigatorUAData {
  platform?: string;
  mobile?: boolean;
  getHighEntropyValues?: (hints: string[]) => Promise<{
    model?: string;
    platform?: string;
    platformVersion?: string;
  }>;
}

export async function getClientDeviceInfo(): Promise<ClientDeviceInfo> {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const uaData = (navigator as Navigator & { userAgentData?: NavigatorUAData }).userAgentData;

  let deviceModel = 'Web Browser';
  let androidVersion = 'N/A';

  const androidMatch = ua.match(/Android\s+([0-9.]+)/i);
  if (androidMatch) {
    androidVersion = `Android ${androidMatch[1]}`;
    const modelMatch = ua.match(/Android\s+[0-9.]+;\s*([^;)]+?)(?:\s+Build\/|[;)])/i);
    if (modelMatch && modelMatch[1]) {
      deviceModel = modelMatch[1].trim();
    } else {
      deviceModel = 'Android Device';
    }
  } else if (/iPhone|iPad|iPod/i.test(ua)) {
    const iosMatch = ua.match(/OS\s+([0-9_]+)/i);
    androidVersion = iosMatch ? `iOS ${iosMatch[1].replace(/_/g, '.')}` : 'iOS';
    deviceModel = /iPad/i.test(ua) ? 'iPad' : 'iPhone';
  } else if (/Windows/i.test(ua)) {
    androidVersion = 'Windows';
    deviceModel = 'Windows PC';
  } else if (/Macintosh|Mac OS X/i.test(ua)) {
    androidVersion = 'macOS';
    deviceModel = 'Mac';
  } else if (/Linux/i.test(ua)) {
    androidVersion = 'Linux';
    deviceModel = 'Linux Desktop';
  }

  if (uaData?.getHighEntropyValues) {
    try {
      const high = await uaData.getHighEntropyValues(['model', 'platform', 'platformVersion']);
      if (high.model && high.model.trim()) {
        deviceModel = high.model.trim();
      }
      if (high.platform === 'Android' && high.platformVersion) {
        androidVersion = `Android ${high.platformVersion}`;
      }
    } catch {
      // Ignore permission or unsupported high-entropy hint errors
    }
  }

  return {
    deviceModel,
    androidVersion,
    appVersion: CLIENT_APP_VERSION,
  };
}
