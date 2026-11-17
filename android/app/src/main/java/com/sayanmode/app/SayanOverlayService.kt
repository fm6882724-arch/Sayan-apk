package com.sayanmode.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.PixelFormat
import android.os.Build
import android.os.IBinder
import android.provider.Settings
import android.view.Gravity
import android.view.LayoutInflater
import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
import android.view.WindowManager
import android.widget.Button
import android.widget.CheckBox
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.SeekBar
import android.widget.TextView
import androidx.core.app.NotificationCompat
import org.json.JSONObject
import kotlin.math.abs
import kotlin.math.roundToInt

/**
 * Native Android floating overlay service rendering a draggable SAYAN crown tab
 * and an expandable compact neon-purple/black interface-only panel.
 *
 * SAFETY: Strictly UI toggles and visual status indicators only. Does not inject into,
 * read, modify, or control any game process, memory, or gameplay.
 */
class SayanOverlayService : Service() {

    companion object {
        const val ACTION_START_OR_UPDATE = "com.sayanmode.app.ACTION_START_OR_UPDATE"
        const val ACTION_SYNC_PREFS = "com.sayanmode.app.ACTION_SYNC_PREFS"
        const val ACTION_STOP = "com.sayanmode.app.ACTION_STOP"

        const val EXTRA_USER_ID = "extra_user_id"
        const val EXTRA_EXPIRES_AT = "extra_expires_at"
        const val EXTRA_PREFS_JSON = "extra_prefs_json"

        private const val CHANNEL_ID = "sayan_overlay_channel"
        private const val NOTIFICATION_ID = 4107
        private const val PREFS_NAME = "sayan_overlay_ui_prefs"
    }

    private lateinit var windowManager: WindowManager
    private var crownTabView: View? = null
    private var panelView: OverlayRootLayout? = null

    private lateinit var tabParams: WindowManager.LayoutParams
    private lateinit var panelParams: WindowManager.LayoutParams

    private var isExpanded = false
    private var userId: String = "SAYAN FF"
    private var expiresAtMillis: Long = 0L

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        createNotificationChannel()
        startForegroundCompat()

        if (!Settings.canDrawOverlays(this)) {
            stopSelf()
            return
        }

        initViews()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent == null) return START_STICKY

        when (intent.action) {
            ACTION_STOP -> {
                stopSelf()
                return START_NOT_STICKY
            }
            ACTION_START_OR_UPDATE, ACTION_SYNC_PREFS -> {
                intent.getStringExtra(EXTRA_USER_ID)?.let { userId = it }
                val exp = intent.getLongExtra(EXTRA_EXPIRES_AT, 0L)
                if (exp > 0L) expiresAtMillis = exp
                intent.getStringExtra(EXTRA_PREFS_JSON)?.let { applyPrefsJson(it) }
                updateStatusHeader()
            }
        }
        return START_STICKY
    }

    private fun startForegroundCompat() {
        val launchIntent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification: Notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_sayan_crown)
            .setContentTitle(getString(R.string.overlay_notification_title))
            .setContentText(getString(R.string.overlay_notification_text))
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            getString(R.string.overlay_channel_name),
            NotificationManager.IMPORTANCE_LOW
        )
        val manager = getSystemService(NotificationManager::class.java)
        manager?.createNotificationChannel(channel)
    }

    private fun dp(value: Int): Int =
        (value * resources.displayMetrics.density).roundToInt()

    private fun initViews() {
        val inflater = LayoutInflater.from(this)
        val overlayType = WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY

        tabParams = WindowManager.LayoutParams(
            dp(54),
            dp(54),
            overlayType,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = dp(18)
            y = dp(140)
        }

        panelParams = WindowManager.LayoutParams(
            dp(300),
            WindowManager.LayoutParams.WRAP_CONTENT,
            overlayType,
            WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
                WindowManager.LayoutParams.FLAG_WATCH_OUTSIDE_TOUCH,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = dp(24)
            y = dp(90)
        }

        val crown = inflater.inflate(R.layout.overlay_crown_tab, null)
        val panel = inflater.inflate(R.layout.overlay_panel, null) as OverlayRootLayout
        panel.visibility = View.GONE
        panel.onBackPressed = { collapsePanel() }

        setupCrownTouch(crown)
        setupPanelInteractions(panel)

        crownTabView = crown
        panelView = panel

        windowManager.addView(crown, tabParams)
        windowManager.addView(panel, panelParams)
        loadStoredToggles()
        updateStatusHeader()
    }

    private fun setupCrownTouch(crown: View) {
        val touchSlop = ViewConfiguration.get(this).scaledTouchSlop
        var initialX = 0
        var initialY = 0
        var initialTouchX = 0f
        var initialTouchY = 0f
        var moved = false

        crown.setOnTouchListener { _, event ->
            when (event.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    initialX = tabParams.x
                    initialY = tabParams.y
                    initialTouchX = event.rawX
                    initialTouchY = event.rawY
                    moved = false
                    true
                }
                MotionEvent.ACTION_MOVE -> {
                    val dx = (event.rawX - initialTouchX).roundToInt()
                    val dy = (event.rawY - initialTouchY).roundToInt()
                    if (abs(dx) > touchSlop || abs(dy) > touchSlop) {
                        moved = true
                    }
                    tabParams.x = initialX + dx
                    tabParams.y = initialY + dy
                    windowManager.updateViewLayout(crown, tabParams)
                    true
                }
                MotionEvent.ACTION_UP -> {
                    if (!moved) {
                        expandPanel()
                    }
                    true
                }
                else -> false
            }
        }
    }

    private fun setupPanelInteractions(panel: OverlayRootLayout) {
        val dragHeader = panel.findViewById<View>(R.id.overlayDragHeader)
        val btnCollapse = panel.findViewById<Button>(R.id.btnCollapseOverlay)
        val btnClose = panel.findViewById<Button>(R.id.btnCloseOverlay)

        val tabAim = panel.findViewById<Button>(R.id.tabAimBtn)
        val tabEsp = panel.findViewById<Button>(R.id.tabEspBtn)
        val tabBypass = panel.findViewById<Button>(R.id.tabBypassBtn)

        val sectionAim = panel.findViewById<LinearLayout>(R.id.sectionAim)
        val sectionEsp = panel.findViewById<LinearLayout>(R.id.sectionEsp)
        val sectionBypass = panel.findViewById<LinearLayout>(R.id.sectionBypass)

        val scrollContent = panel.findViewById<ScrollView>(R.id.overlayScrollContent)
        val seekOpacity = panel.findViewById<SeekBar>(R.id.seekOpacity)
        val txtOpacity = panel.findViewById<TextView>(R.id.txtOpacityLabel)
        val btnSmall = panel.findViewById<Button>(R.id.btnSizeSmall)
        val btnMedium = panel.findViewById<Button>(R.id.btnSizeMedium)
        val btnLarge = panel.findViewById<Button>(R.id.btnSizeLarge)
        val btnReset = panel.findViewById<Button>(R.id.btnResetOverlay)
        val resizeGrip = panel.findViewById<View>(R.id.overlayResizeGrip)

        val seekEspColor = panel.findViewById<SeekBar>(R.id.seekEspColor)
        val txtEspColor = panel.findViewById<TextView>(R.id.txtEspColorValue)

        // Move floating panel by dragging its header
        var startX = 0
        var startY = 0
        var touchX = 0f
        var touchY = 0f
        dragHeader.setOnTouchListener { _, event ->
            when (event.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    startX = panelParams.x
                    startY = panelParams.y
                    touchX = event.rawX
                    touchY = event.rawY
                    true
                }
                MotionEvent.ACTION_MOVE -> {
                    panelParams.x = startX + (event.rawX - touchX).roundToInt()
                    panelParams.y = startY + (event.rawY - touchY).roundToInt()
                    windowManager.updateViewLayout(panel, panelParams)
                    true
                }
                else -> false
            }
        }

        // Collapse / Close controls
        btnCollapse.setOnClickListener { collapsePanel() }
        btnClose.setOnClickListener { stopSelf() }

        // Mode tabs
        fun selectTab(mode: String) {
            sectionAim.visibility = if (mode == "aim") View.VISIBLE else View.GONE
            sectionEsp.visibility = if (mode == "esp") View.VISIBLE else View.GONE
            sectionBypass.visibility = if (mode == "bypass") View.VISIBLE else View.GONE

            tabAim.setBackgroundResource(
                if (mode == "aim") R.drawable.bg_sayan_pill_active else R.drawable.bg_sayan_pill_inactive
            )
            tabEsp.setBackgroundResource(
                if (mode == "esp") R.drawable.bg_sayan_pill_active else R.drawable.bg_sayan_pill_inactive
            )
            tabBypass.setBackgroundResource(
                if (mode == "bypass") R.drawable.bg_sayan_pill_active else R.drawable.bg_sayan_pill_inactive
            )
        }
        tabAim.setOnClickListener { selectTab("aim") }
        tabEsp.setOnClickListener { selectTab("esp") }
        tabBypass.setOnClickListener { selectTab("bypass") }

        // Transparency slider (25%..100%)
        seekOpacity.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(seekBar: SeekBar?, progress: Int, fromUser: Boolean) {
                val pct = 25 + progress
                panel.alpha = pct / 100f
                txtOpacity.text = "Opacity $pct%"
            }
            override fun onStartTrackingTouch(seekBar: SeekBar?) = Unit
            override fun onStopTrackingTouch(seekBar: SeekBar?) = Unit
        })

        // ESP Color slider (interface-only)
        seekEspColor.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(seekBar: SeekBar?, progress: Int, fromUser: Boolean) {
                txtEspColor.text = "ESP Color: $progress"
                if (fromUser) saveToggleInt("espColor", progress)
            }
            override fun onStartTrackingTouch(seekBar: SeekBar?) = Unit
            override fun onStopTrackingTouch(seekBar: SeekBar?) = Unit
        })

        // Quick resize presets (S / M / L)
        fun applySize(widthDp: Int, heightDp: Int, active: Button) {
            panelParams.width = dp(widthDp)
            scrollContent.layoutParams = scrollContent.layoutParams.apply {
                height = dp(heightDp)
            }
            windowManager.updateViewLayout(panel, panelParams)

            listOf(btnSmall, btnMedium, btnLarge).forEach { btn ->
                btn.setBackgroundResource(
                    if (btn == active) R.drawable.bg_sayan_pill_active else R.drawable.bg_sayan_pill_inactive
                )
            }
        }
        btnSmall.setOnClickListener { applySize(250, 145, btnSmall) }
        btnMedium.setOnClickListener { applySize(300, 195, btnMedium) }
        btnLarge.setOnClickListener { applySize(350, 250, btnLarge) }

        // Corner drag resize grip
        var baseWidth = 0
        var baseHeight = 0
        var downRawX = 0f
        var downRawY = 0f
        resizeGrip.setOnTouchListener { _, event ->
            when (event.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    baseWidth = panelParams.width
                    baseHeight = scrollContent.layoutParams.height
                    downRawX = event.rawX
                    downRawY = event.rawY
                    true
                }
                MotionEvent.ACTION_MOVE -> {
                    val newW = (baseWidth + (event.rawX - downRawX).roundToInt())
                        .coerceIn(dp(240), dp(420))
                    val newH = (baseHeight + (event.rawY - downRawY).roundToInt())
                        .coerceIn(dp(120), dp(340))
                    panelParams.width = newW
                    scrollContent.layoutParams = scrollContent.layoutParams.apply {
                        height = newH
                    }
                    windowManager.updateViewLayout(panel, panelParams)
                    true
                }
                else -> false
            }
        }

        // Persist interface-only checkbox states
        val checkPairs = listOf(
            R.id.chkEnableFunctions to "enableFunctions",
            R.id.chkAimbotLegit to "aimbotLegit",
            R.id.chkAimbotRage to "aimbotRage",
            R.id.chkAimbotShoulder to "aimbotShoulder",
            R.id.chkAimbotSilent to "aimbotSilent",
            R.id.chkNoRecoil to "noRecoil",
            R.id.chkEspLine to "espLine",
            R.id.chkEspBox to "espBox",
            R.id.chkEspName to "espName",
            R.id.chkEspHealth to "espHealth",
            R.id.chkEspDistance to "espDistance",
            R.id.chkOnlineBypass to "onlineBypassStatus",
            R.id.chkOfflineBypass to "offlineBypassStatus"
        )
        checkPairs.forEach { (id, key) ->
            panel.findViewById<CheckBox>(id).setOnCheckedChangeListener { _, isChecked ->
                saveToggleBool(key, isChecked)
            }
        }

        // RESET ALL visual toggles
        btnReset.setOnClickListener {
            checkPairs.forEach { (id, key) ->
                panel.findViewById<CheckBox>(id).isChecked = false
                saveToggleBool(key, false)
            }
            seekEspColor.progress = 0
            saveToggleInt("espColor", 0)
        }
    }

    private fun expandPanel() {
        val crown = crownTabView ?: return
        val panel = panelView ?: return
        isExpanded = true
        crown.visibility = View.GONE
        panel.visibility = View.VISIBLE
        panel.requestFocus()
    }

    private fun collapsePanel() {
        val crown = crownTabView ?: return
        val panel = panelView ?: return
        isExpanded = false
        panel.visibility = View.GONE
        crown.visibility = View.VISIBLE
    }

    private fun updateStatusHeader() {
        val panel = panelView ?: return
        val statusText = panel.findViewById<TextView>(R.id.overlayStatusText)
        statusText.text = "$userId • ONLINE"
    }

    private fun saveToggleBool(key: String, value: Boolean) {
        getSharedPreferences(PREFS_NAME, MODE_PRIVATE).edit().putBoolean(key, value).apply()
    }

    private fun saveToggleInt(key: String, value: Int) {
        getSharedPreferences(PREFS_NAME, MODE_PRIVATE).edit().putInt(key, value).apply()
    }

    private fun applyPrefsJson(jsonStr: String) {
        try {
            val json = JSONObject(jsonStr)
            val editor = getSharedPreferences(PREFS_NAME, MODE_PRIVATE).edit()
            val boolKeys = listOf(
                "enableFunctions", "aimbotLegit", "aimbotRage", "aimbotShoulder",
                "aimbotSilent", "noRecoil", "espLine", "espBox", "espName",
                "espHealth", "espDistance", "onlineBypassStatus", "offlineBypassStatus"
            )
            boolKeys.forEach { k ->
                if (json.has(k)) editor.putBoolean(k, json.optBoolean(k, false))
            }
            if (json.has("espColor")) {
                editor.putInt("espColor", json.optInt("espColor", 0).coerceIn(0, 360))
            }
            editor.apply()
            loadStoredToggles()
        } catch (_: Exception) {
        }
    }

    private fun loadStoredToggles() {
        val panel = panelView ?: return
        val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        val map = listOf(
            R.id.chkEnableFunctions to ("enableFunctions" to true),
            R.id.chkAimbotLegit to ("aimbotLegit" to false),
            R.id.chkAimbotRage to ("aimbotRage" to false),
            R.id.chkAimbotShoulder to ("aimbotShoulder" to false),
            R.id.chkAimbotSilent to ("aimbotSilent" to false),
            R.id.chkNoRecoil to ("noRecoil" to false),
            R.id.chkEspLine to ("espLine" to false),
            R.id.chkEspBox to ("espBox" to false),
            R.id.chkEspName to ("espName" to false),
            R.id.chkEspHealth to ("espHealth" to false),
            R.id.chkEspDistance to ("espDistance" to false),
            R.id.chkOnlineBypass to ("onlineBypassStatus" to false),
            R.id.chkOfflineBypass to ("offlineBypassStatus" to false)
        )
        map.forEach { (id, pair) ->
            panel.findViewById<CheckBox>(id).isChecked = prefs.getBoolean(pair.first, pair.second)
        }
        val colorVal = prefs.getInt("espColor", 0).coerceIn(0, 360)
        panel.findViewById<SeekBar>(R.id.seekEspColor).progress = colorVal
        panel.findViewById<TextView>(R.id.txtEspColorValue).text = "ESP Color: $colorVal"
    }

    override fun onDestroy() {
        crownTabView?.let { runCatching { windowManager.removeView(it) } }
        panelView?.let { runCatching { windowManager.removeView(it) } }
        crownTabView = null
        panelView = null
        super.onDestroy()
    }
}
