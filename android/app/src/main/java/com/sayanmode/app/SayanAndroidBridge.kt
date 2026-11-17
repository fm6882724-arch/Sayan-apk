package com.sayanmode.app

import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.webkit.JavascriptInterface

/**
 * Native JavaScript bridge exposed to the SAYAN MODE WebView as `window.SayanAndroid`.
 * Handles native Android package detection, direct game launching, Google Play Store
 * fallback (only when not installed), official overlay permission, and starting the floating UI.
 */
class SayanAndroidBridge(private val activity: MainActivity) {

    @JavascriptInterface
    fun isPackageInstalled(packageName: String): Boolean {
        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                activity.packageManager.getPackageInfo(
                    packageName,
                    PackageManager.PackageInfoFlags.of(0)
                )
            } else {
                @Suppress("DEPRECATION")
                activity.packageManager.getPackageInfo(packageName, 0)
            }
            true
        } catch (_: PackageManager.NameNotFoundException) {
            false
        }
    }

    @JavascriptInterface
    fun launchPackage(packageName: String): Boolean {
        val launchIntent = activity.packageManager.getLaunchIntentForPackage(packageName)
            ?: return false

        launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED)
        activity.runOnUiThread {
            activity.startActivity(launchIntent)
        }
        return true
    }

    @JavascriptInterface
    fun openPlayStore(packageName: String) {
        activity.runOnUiThread {
            val marketIntent = Intent(
                Intent.ACTION_VIEW,
                Uri.parse("market://details?id=$packageName")
            ).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            val webIntent = Intent(
                Intent.ACTION_VIEW,
                Uri.parse("https://play.google.com/store/apps/details?id=$packageName")
            ).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }

            try {
                activity.startActivity(marketIntent)
            } catch (_: Exception) {
                activity.startActivity(webIntent)
            }
        }
    }

    @JavascriptInterface
    fun hasOverlayPermission(): Boolean {
        return Settings.canDrawOverlays(activity)
    }

    @JavascriptInterface
    fun requestOverlayPermission() {
        activity.runOnUiThread {
            activity.promptOverlayPermission(null, 0L, null)
        }
    }

    @JavascriptInterface
    fun startOverlay(userId: String, expiresAtMillis: Double, prefsJson: String) {
        val expires = expiresAtMillis.toLong()
        activity.runOnUiThread {
            if (Settings.canDrawOverlays(activity)) {
                activity.startSayanOverlayService(userId, expires, prefsJson)
            } else {
                activity.promptOverlayPermission(userId, expires, prefsJson)
            }
        }
    }

    @JavascriptInterface
    fun launchGameWithOverlay(
        packageName: String,
        userId: String,
        expiresAtMillis: Double,
        prefsJson: String
    ) {
        val expires = expiresAtMillis.toLong()
        if (!isPackageInstalled(packageName)) {
            openPlayStore(packageName)
            return
        }

        activity.runOnUiThread {
            if (Settings.canDrawOverlays(activity)) {
                activity.startSayanOverlayService(userId, expires, prefsJson)
                launchPackage(packageName)
            } else {
                activity.promptOverlayPermission(userId, expires, prefsJson, packageName)
            }
        }
    }

    @JavascriptInterface
    fun syncPreferences(prefsJson: String) {
        if (!Settings.canDrawOverlays(activity)) return
        val intent = Intent(activity, SayanOverlayService::class.java).apply {
            action = SayanOverlayService.ACTION_SYNC_PREFS
            putExtra(SayanOverlayService.EXTRA_PREFS_JSON, prefsJson)
        }
        activity.startService(intent)
    }

    @JavascriptInterface
    fun stopOverlay() {
        val intent = Intent(activity, SayanOverlayService::class.java).apply {
            action = SayanOverlayService.ACTION_STOP
        }
        activity.startService(intent)
    }
}
