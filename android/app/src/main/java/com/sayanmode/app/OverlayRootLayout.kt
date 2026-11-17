package com.sayanmode.app

import android.content.Context
import android.util.AttributeSet
import android.view.KeyEvent
import android.widget.FrameLayout

/**
 * Root container for the expanded floating SAYAN MODE panel.
 * Intercepts Android's Back button while expanded so the overlay collapses cleanly.
 */
class OverlayRootLayout @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : FrameLayout(context, attrs, defStyleAttr) {

    var onBackPressed: (() -> Unit)? = null

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (event.keyCode == KeyEvent.KEYCODE_BACK && event.action == KeyEvent.ACTION_UP) {
            onBackPressed?.invoke()
            return true
        }
        return super.dispatchKeyEvent(event)
    }
}
