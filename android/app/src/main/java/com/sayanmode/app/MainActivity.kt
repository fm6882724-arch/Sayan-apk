package com.sayanmode.app

import android.annotation.SuppressLint
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView

    private var pendingUserId: String? = null
    private var pendingExpiresAt: Long = 0L
    private var pendingPrefsJson: String? = null
    private var pendingPackageToLaunch: String? = null

    private val overlayPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) {
        if (Settings.canDrawOverlays(this)) {
            startSayanOverlayService(
                pendingUserId ?: "SAYAN FF",
                pendingExpiresAt,
                pendingPrefsJson
            )
            pendingPackageToLaunch?.let { pkg ->
                packageManager.getLaunchIntentForPackage(pkg)?.let { launchIntent ->
                    launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    startActivity(launchIntent)
                }
            }
        }
        pendingPackageToLaunch = null
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.sayanWebView)
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            cacheMode = WebSettings.LOAD_DEFAULT
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
        }

        webView.addJavascriptInterface(SayanAndroidBridge(this), "SayanAndroid")

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(
                view: WebView?,
                request: WebResourceRequest?
            ): Boolean {
                val uri = request?.url ?: return false
                val scheme = uri.scheme?.lowercase() ?: return false
                if (scheme == "market" || (uri.host?.contains("play.google.com") == true)) {
                    startActivity(Intent(Intent.ACTION_VIEW, uri))
                    return true
                }
                return false
            }
        }

        webView.loadUrl(BuildConfig.SAYAN_WEB_URL)
    }

    fun promptOverlayPermission(
        userId: String?,
        expiresAt: Long,
        prefsJson: String?,
        packageToLaunch: String? = null
    ) {
        pendingUserId = userId
        pendingExpiresAt = expiresAt
        pendingPrefsJson = prefsJson
        pendingPackageToLaunch = packageToLaunch

        Toast.makeText(this, getString(R.string.overlay_permission_prompt), Toast.LENGTH_LONG).show()
        val intent = Intent(
            Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
            Uri.parse("package:$packageName")
        )
        overlayPermissionLauncher.launch(intent)
    }

    fun startSayanOverlayService(userId: String, expiresAt: Long, prefsJson: String?) {
        val intent = Intent(this, SayanOverlayService::class.java).apply {
            action = SayanOverlayService.ACTION_START_OR_UPDATE
            putExtra(SayanOverlayService.EXTRA_USER_ID, userId)
            putExtra(SayanOverlayService.EXTRA_EXPIRES_AT, expiresAt)
            if (prefsJson != null) {
                putExtra(SayanOverlayService.EXTRA_PREFS_JSON, prefsJson)
            }
        }
        ContextCompat.startForegroundService(this, intent)
    }
}
