import type { Language } from '../types/panel';

export interface TranslationStrings {
  brandSubtitle: string;
  keyLoginTitleWhite: string;
  keyLoginTitleAccent: string;
  enterYourKey: string;
  showKey: string;
  hideKey: string;
  rememberKey: string;
  enterValidKeyPrompt: string;
  loginButton: string;
  loggingIn: string;
  poweredBy: string;
  poweredByBrand: string;

  // Dashboard Tabs (strictly 4)
  tabAimMode: string;
  tabEspMode: string;
  tabBypassMode: string;
  tabSettings: string;

  // Sidebar / Status
  userLabel: string;
  timeLabel: string;
  statusLabel: string;
  statusOnline: string;
  statusOffline: string;
  panelTitle: string;

  // AIM MODE controls
  enableFunctions: string;
  aimbotLegit: string;
  aimbotRage: string;
  aimbotShoulder: string;
  aimbotSilent: string;
  noRecoil: string;

  // ESP MODE controls
  espLine: string;
  espBox: string;
  espName: string;
  espHealth: string;
  espDistance: string;
  espColor: string;

  // BYPASS MODE controls
  onlineBypassStatus: string;
  offlineBypassStatus: string;

  // Actions & Modals
  resetAll: string;
  resetConfirmTitle: string;
  resetConfirmDesc: string;
  confirmReset: string;
  cancel: string;

  // Settings
  settingsTitle: string;
  languageLabel: string;
  english: string;
  hindi: string;
  accountInfoTitle: string;
  keyExpiresAt: string;
  appVersionLabel: string;
  deviceModelLabel: string;
  androidVersionLabel: string;
  visualNotice: string;
  telegramFeedbackTitle: string;
  feedbackPlaceholder: string;
  sendFeedback: string;
  sendingFeedback: string;
  feedbackSentSuccess: string;
  feedbackSavedLocalOnly: string;
  logoutButton: string;

  // Admin
  adminLoginTitle: string;
  adminSetupTitle: string;
  adminSetupDesc: string;
  adminPasswordPlaceholder: string;
  adminConfirmPlaceholder: string;
  adminLoginBtn: string;
  adminSetupBtn: string;
  adminConsoleTitle: string;
  adminTabKeys: string;
  adminTabHistory: string;
  adminTabAudit: string;
  adminTabFeedback: string;
  adminCreateKey: string;
  adminUserIdPlaceholder: string;
  adminGenerate72h: string;
  adminCopyKey: string;
  adminCopied: string;
  adminShareWhatsApp: string;
  adminExtend72h: string;
  adminRevoke: string;
  adminViewHistory: string;
  adminClose: string;
  adminLogout: string;
  adminNotProdReady: string;

  // Game Selection
  selectGameTitle: string;
  selectGameSubtitle: string;
  freeFireIndia: string;
  freeFireMax: string;
  launchOrStoreHint: string;
}

export const translations: Record<Language, TranslationStrings> = {
  en: {
    brandSubtitle: 'SAYAN MODE',
    keyLoginTitleWhite: 'KEY',
    keyLoginTitleAccent: 'LOGIN',
    enterYourKey: 'Enter Your Key...',
    showKey: 'Show key',
    hideKey: 'Hide key',
    rememberKey: 'Remember Key',
    enterValidKeyPrompt: 'Enter Valid Key to Access',
    loginButton: 'LOGIN',
    loggingIn: 'VERIFYING...',
    poweredBy: 'Powered by',
    poweredByBrand: 'SAYAN FF',

    tabAimMode: 'AIM MODE',
    tabEspMode: 'ESP MODE',
    tabBypassMode: 'BYPASS MODE',
    tabSettings: 'SETTINGS',

    userLabel: 'User:',
    timeLabel: 'Time:',
    statusLabel: 'Status:',
    statusOnline: 'ONLINE',
    statusOffline: 'OFFLINE',
    panelTitle: 'SAYAN FF PANEL',

    enableFunctions: 'Enable Functions',
    aimbotLegit: 'Aimbot Legit',
    aimbotRage: 'Aimbot Rage',
    aimbotShoulder: 'Aimbot Shoulder',
    aimbotSilent: 'Aimbot Silent',
    noRecoil: 'No Recoil',

    espLine: 'ESP Line',
    espBox: 'ESP Box',
    espName: 'ESP Name',
    espHealth: 'ESP Health',
    espDistance: 'ESP Distance',
    espColor: 'ESP Color:',

    onlineBypassStatus: 'Online Bypass Status',
    offlineBypassStatus: 'Offline Bypass Status',

    resetAll: 'RESET ALL',
    resetConfirmTitle: 'Confirm Reset All',
    resetConfirmDesc:
      'Are you sure you want to reset all AIM MODE, ESP MODE, BYPASS MODE toggles and ESP Color back to 0?',
    confirmReset: 'YES, RESET ALL',
    cancel: 'CANCEL',

    settingsTitle: 'SETTINGS',
    languageLabel: 'Language',
    english: 'English',
    hindi: 'हिन्दी (Hindi)',
    accountInfoTitle: 'Session & Key Details',
    keyExpiresAt: 'Key Expiry',
    appVersionLabel: 'App Version',
    deviceModelLabel: 'Device Model',
    androidVersionLabel: 'OS / Android',
    visualNotice: 'Interface settings and simulated status indicators only.',
    telegramFeedbackTitle: 'Telegram Feedback',
    feedbackPlaceholder: 'Write feedback or report an issue...',
    sendFeedback: 'SEND FEEDBACK',
    sendingFeedback: 'SENDING...',
    feedbackSentSuccess: 'Feedback sent to Telegram.',
    feedbackSavedLocalOnly: 'Feedback saved on server (Telegram Bot not configured in .env).',
    logoutButton: 'LOGOUT',

    adminLoginTitle: 'ADMIN ACCESS',
    adminSetupTitle: 'INITIALIZE ADMIN PASSWORD',
    adminSetupDesc:
      'ADMIN_PASSWORD is not set in environment. Set a secure admin password (min 8 chars) to enable admin login.',
    adminPasswordPlaceholder: 'Enter Admin Password...',
    adminConfirmPlaceholder: 'Confirm Admin Password...',
    adminLoginBtn: 'UNLOCK ADMIN',
    adminSetupBtn: 'SAVE ADMIN PASSWORD',
    adminConsoleTitle: 'SAYAN MODE ADMIN',
    adminTabKeys: 'Keys',
    adminTabHistory: 'Login History',
    adminTabAudit: 'Audit History',
    adminTabFeedback: 'Feedback',
    adminCreateKey: 'Create 72h Access Key',
    adminUserIdPlaceholder: 'User ID (e.g. SAYAN FF)',
    adminGenerate72h: 'CREATE 72H KEY',
    adminCopyKey: 'Copy Key',
    adminCopied: 'Copied',
    adminShareWhatsApp: 'WhatsApp',
    adminExtend72h: '+72h Extend',
    adminRevoke: 'Revoke',
    adminViewHistory: 'History',
    adminClose: 'Close',
    adminLogout: 'Admin Logout',
    adminNotProdReady:
      'Backend environment check: configure ADMIN_PASSWORD and APP_SECRET in server environment before production deployment.',

    selectGameTitle: 'SELECT GAME',
    selectGameSubtitle: 'Choose your Free Fire edition to launch and open the panel',
    freeFireIndia: 'FREE FIRE INDIA',
    freeFireMax: 'FREE FIRE MAX',
    launchOrStoreHint: 'Launches installed app or opens Google Play Store',
  },
  hi: {
    brandSubtitle: 'सायन मोड',
    keyLoginTitleWhite: 'कुंजी',
    keyLoginTitleAccent: 'लॉगिन',
    enterYourKey: 'अपनी कुंजी दर्ज करें...',
    showKey: 'कुंजी दिखाएं',
    hideKey: 'कुंजी छुपाएं',
    rememberKey: 'कुंजी याद रखें',
    enterValidKeyPrompt: 'एक्सेस के लिए वैध कुंजी दर्ज करें',
    loginButton: 'लॉगिन',
    loggingIn: 'सत्यापित हो रहा है...',
    poweredBy: 'द्वारा संचालित',
    poweredByBrand: 'SAYAN FF',

    tabAimMode: 'ऐम मोड',
    tabEspMode: 'ईएसपी मोड',
    tabBypassMode: 'बायपास मोड',
    tabSettings: 'सेटिंग्स',

    userLabel: 'यूज़र:',
    timeLabel: 'समय:',
    statusLabel: 'स्थिति:',
    statusOnline: 'ऑनलाइन',
    statusOffline: 'ऑफ़लाइन',
    panelTitle: 'SAYAN FF PANEL',

    enableFunctions: 'फ़ंक्शन सक्षम करें',
    aimbotLegit: 'ऐमबॉट लेजिट',
    aimbotRage: 'ऐमबॉट रेज',
    aimbotShoulder: 'ऐमबॉट शोल्डर',
    aimbotSilent: 'ऐमबॉट साइलेंट',
    noRecoil: 'नो रिकॉइल',

    espLine: 'ईएसपी लाइन',
    espBox: 'ईएसपी बॉक्स',
    espName: 'ईएसपी नाम',
    espHealth: 'ईएसपी स्वास्थ्य',
    espDistance: 'ईएसपी दूरी',
    espColor: 'ईएसपी रंग:',

    onlineBypassStatus: 'ऑनलाइन बायपास स्थिति',
    offlineBypassStatus: 'ऑफ़लाइन बायपास स्थिति',

    resetAll: 'सभी रीसेट करें',
    resetConfirmTitle: 'रीसेट की पुष्टि करें',
    resetConfirmDesc:
      'क्या आप वाकई सभी ऐम मोड, ईएसपी मोड, बायपास मोड विकल्प और ईएसपी रंग को 0 पर रीसेट करना चाहते हैं?',
    confirmReset: 'हाँ, सभी रीसेट करें',
    cancel: 'रद्द करें',

    settingsTitle: 'सेटिंग्स',
    languageLabel: 'भाषा',
    english: 'English',
    hindi: 'हिन्दी (Hindi)',
    accountInfoTitle: 'सत्र और कुंजी विवरण',
    keyExpiresAt: 'कुंजी समाप्ति',
    appVersionLabel: 'ऐप संस्करण',
    deviceModelLabel: 'डिवाइस मॉडल',
    androidVersionLabel: 'ओएस / एंड्रॉइड',
    visualNotice: 'केवल विज़ुअल इंटरफ़ेस सेटिंग्स और सिम्युलेटेड स्थिति संकेतक।',
    telegramFeedbackTitle: 'टेलीग्राम फ़ीडबैक',
    feedbackPlaceholder: 'फ़ीडबैक लिखें या समस्या बताएं...',
    sendFeedback: 'फ़ीडबैक भेजें',
    sendingFeedback: 'भेजा जा रहा है...',
    feedbackSentSuccess: 'फ़ीडबैक टेलीग्राम पर भेज दिया गया।',
    feedbackSavedLocalOnly: 'फ़ीडबैक सर्वर पर सहेजा गया (टेलीग्राम बॉट कॉन्फ़िगर नहीं है)।',
    logoutButton: 'लॉगआउट',

    adminLoginTitle: 'एडमिन एक्सेस',
    adminSetupTitle: 'एडमिन पासवर्ड सेट करें',
    adminSetupDesc:
      'पर्यावरण में ADMIN_PASSWORD सेट नहीं है। एडमिन लॉगिन सक्षम करने के लिए कम से कम 8 अक्षरों का पासवर्ड सेट करें।',
    adminPasswordPlaceholder: 'एडमिन पासवर्ड दर्ज करें...',
    adminConfirmPlaceholder: 'एडमिन पासवर्ड की पुष्टि करें...',
    adminLoginBtn: 'एडमिन खोलें',
    adminSetupBtn: 'एडमिन पासवर्ड सहेजें',
    adminConsoleTitle: 'सायन मोड एडमिन',
    adminTabKeys: 'कुंजियाँ',
    adminTabHistory: 'लॉगिन इतिहास',
    adminTabAudit: 'ऑडिट इतिहास',
    adminTabFeedback: 'फ़ीडबैक',
    adminCreateKey: '72 घंटे की एक्सेस कुंजी बनाएं',
    adminUserIdPlaceholder: 'यूज़र आईडी (जैसे SAYAN FF)',
    adminGenerate72h: '72 घंटे कुंजी बनाएं',
    adminCopyKey: 'कुंजी कॉपी करें',
    adminCopied: 'कॉपी हो गई',
    adminShareWhatsApp: 'व्हाट्सऐप',
    adminExtend72h: '+72 घंटे बढ़ाएं',
    adminRevoke: 'रद्द करें',
    adminViewHistory: 'इतिहास',
    adminClose: 'बंद करें',
    adminLogout: 'एडमिन लॉगआउट',
    adminNotProdReady:
      'प्रोडक्शन परिनियोजन से पहले सर्वर वातावरण में ADMIN_PASSWORD और APP_SECRET कॉन्फ़िगर करें।',

    selectGameTitle: 'गेम चुनें',
    selectGameSubtitle: 'लॉन्च करने और पैनल खोलने के लिए अपना Free Fire संस्करण चुनें',
    freeFireIndia: 'FREE FIRE INDIA',
    freeFireMax: 'FREE FIRE MAX',
    launchOrStoreHint: 'इंस्टॉल किया गया ऐप खोलता है या Google Play Store पर ले जाता है',
  },
};
