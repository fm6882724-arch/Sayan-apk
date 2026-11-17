# SAYAN MODE

Full-stack React + Node.js/Express + SQLite web application with an integrated native Android Studio wrapper (`android/`) for key-based authentication, a 4-tab visual control panel (`AIM MODE`, `ESP MODE`, `BYPASS MODE`, `SETTINGS`), **Free Fire India** / **Free Fire MAX** launcher cards, English & Hindi localization, and a hidden role-protected Admin Console.

> **Safety Notice:** All dashboard and floating overlay toggles/sliders/status indicators are **visual interface settings and simulated status indicators only**. No game-memory access, injection, aimbot, recoil modification, ESP rendering over gameplay, or anti-cheat bypass is implemented.

## Project Structure

- `src/` — React + TypeScript + Tailwind CSS frontend (`LoginScreen`, `DashboardScreen`, `AdminModal`, `SayanBranding`, `androidLauncher`).
- `server/` & `server.ts` — Node.js + Express API, `scrypt` admin password hashing, HMAC session tokens, SQLite schema/persistence (`better-sqlite3`), rate limiting, and optional Telegram feedback forwarding.
- `android/` — Native Android Studio (Kotlin / Gradle) wrapper project:
  - `android/app/src/main/AndroidManifest.xml` — Declares `SYSTEM_ALERT_WINDOW`, `FOREGROUND_SERVICE_SPECIAL_USE`, `INTERNET`, and `<queries>` for `com.dts.freefireindia` and `com.dts.freefiremax`.
  - `MainActivity.kt` — Hosts the authenticated SAYAN MODE WebView and manages `Settings.ACTION_MANAGE_OVERLAY_PERMISSION` prompts.
  - `SayanAndroidBridge.kt` — `@JavascriptInterface` (`window.SayanAndroid`) performing native package detection (`PackageManager.getPackageInfo`), direct game launching (`getLaunchIntentForPackage`), Google Play Store fallback when not installed, and overlay service lifecycle.
  - `SayanOverlayService.kt` & `OverlayRootLayout.kt` — Native `WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY` draggable SAYAN crown tab and expandable neon-purple/black floating panel with move, resize (`S`/`M`/`L` + corner grip), opacity slider, interface-only toggles, and Android Back-button collapse.
- `public/sayan-mode-source.zip` — Downloadable clean source archive (excludes `.env`, `node_modules`, `dist`, and local SQLite DB files).

## Environment Variables

Copy `.env.example` to `.env` before deploying:

```bash
cp .env.example .env
```

- `PORT` — HTTP server port (default `3000`).
- `NODE_ENV` — Set to `production` in production.
- `CURRENT_APP_VERSION` — Active key version (default `1.0.0`). Older-version keys are automatically rejected.
- `APP_SECRET` — Strong 64-character hex secret for HMAC token hashing.
- `ADMIN_PASSWORD` — Separate secure admin password (min 8 characters).
- `SQLITE_DB_PATH` — Path to SQLite database file (default `./data/sayan-mode.db`).
- `TELEGRAM_BOT_TOKEN` & `TELEGRAM_CHAT_ID` — Optional Telegram Bot credentials for feedback forwarding.

## Web Development & Production Build

```bash
npm install
npm run dev      # Starts Express + Vite dev middleware on port 3000
npm run build    # Builds Vite production bundle into dist/
npm start        # Runs Express production server
```

## Native Android Studio Build

1. Open the `android/` folder in **Android Studio**.
2. Set `SAYAN_WEB_URL` in `android/app/build.gradle.kts` to your deployed HTTPS server URL.
3. Build and run on a physical Android device (Android 8.0+ / API 26+) to test native features.

### Native Android Verification Status (Not Built/Tested in Web Sandbox)

Because this AI Studio workspace runs in a Linux/Node.js web runtime without the Android SDK or an emulator/device:
- **Gradle APK Compilation** (`android/` Kotlin & XML resources) has **not** been compiled or run through `gradlew assembleDebug` here.
- **Runtime Android Permissions & Overlay UX** (`Settings.ACTION_MANAGE_OVERLAY_PERMISSION`, `SayanOverlayService` drag/resize/transparency over Free Fire India / Free Fire MAX, hardware Back-button collapse, and `PackageManager.getLaunchIntentForPackage`) have **not** been executed on a physical Android device and must be tested after building in Android Studio.
