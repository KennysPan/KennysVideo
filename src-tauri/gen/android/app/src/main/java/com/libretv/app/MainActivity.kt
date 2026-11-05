package com.libretv.app

import android.content.pm.ActivityInfo
import android.os.Bundle
import android.os.Build
import android.net.Uri
import android.view.WindowManager
import android.view.KeyEvent
import android.webkit.WebView
import androidx.activity.OnBackPressedCallback
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat

class MainActivity : TauriActivity() {
    private var browser: WebView? = null
    private var playerFullscreen = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            window.attributes = window.attributes.apply {
                layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
            }
        }
        window.statusBarColor = android.graphics.Color.rgb(15, 22, 34)
        window.navigationBarColor = android.graphics.Color.rgb(15, 22, 34)
        val content = findViewById<android.view.View>(android.R.id.content)
        content.setBackgroundColor(android.graphics.Color.rgb(15, 22, 34))
        window.decorView.setBackgroundColor(android.graphics.Color.rgb(15, 22, 34))
        ViewCompat.setOnApplyWindowInsetsListener(content) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            val keyboard = insets.getInsets(WindowInsetsCompat.Type.ime())
            if (playerFullscreen) view.setPadding(0, 0, 0, keyboard.bottom)
            else view.setPadding(bars.left, bars.top, bars.right, maxOf(bars.bottom, keyboard.bottom))
            // Video fills the window; only interactive controls avoid the camera cutout.
            val cutout = insets.getInsets(WindowInsetsCompat.Type.displayCutout())
            browser?.evaluateJavascript("""
                (() => {
                    const root = document.documentElement;
                    const scale = window.devicePixelRatio || 1;
                    root.style.setProperty('--android-cutout-left', (${cutout.left} / scale) + 'px');
                    root.style.setProperty('--android-cutout-right', (${cutout.right} / scale) + 'px');
                    root.style.setProperty('--android-cutout-bottom', (${cutout.bottom} / scale) + 'px');
                })()
            """.trimIndent(), null)
            insets
        }
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                handleAppBack()
            }
        })
    }

    override fun onWebViewCreate(webView: WebView) {
        super.onWebViewCreate(webView)
        browser = webView
        webView.setBackgroundColor(android.graphics.Color.rgb(15, 22, 34))
    }

    // Consume Back before WebView/Wry can change history or handle video fullscreen.
    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (event.keyCode == KeyEvent.KEYCODE_BACK) {
            if (event.action == KeyEvent.ACTION_UP && !event.isCanceled) handleAppBack()
            return true
        }
        return super.dispatchKeyEvent(event)
    }

    private fun handleAppBack() {
        val web = browser
        if (web == null) { moveTaskToBack(true); return }
        web.evaluateJavascript("Boolean(window.handleAndroidBack && window.handleAndroidBack())") { handled ->
            if (handled != "true") {
                val url = Uri.parse(web.url ?: "")
                val home = url.host == "tauri.localhost" && (url.path == "/" || url.path == "/index.html")
                if (!home && web.canGoBack()) web.goBack() else moveTaskToBack(true)
            }
        }
    }

    fun setPlayerFullscreen(fullscreen: Boolean) {
        playerFullscreen = fullscreen
        val background = if (fullscreen) android.graphics.Color.BLACK else android.graphics.Color.rgb(15, 22, 34)
        findViewById<android.view.View>(android.R.id.content).setBackgroundColor(background)
        window.decorView.setBackgroundColor(background)
        browser?.setBackgroundColor(background)
        requestedOrientation = if (fullscreen) ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE else ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
        applySystemBars()
        if (fullscreen) window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        else window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }

    private fun applySystemBars() {
        val controller = WindowCompat.getInsetsController(window, window.decorView)
        controller.isAppearanceLightStatusBars = false
        controller.isAppearanceLightNavigationBars = false
        controller.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        if (playerFullscreen) controller.hide(WindowInsetsCompat.Type.systemBars())
        else controller.show(WindowInsetsCompat.Type.systemBars())
        ViewCompat.requestApplyInsets(findViewById<android.view.View>(android.R.id.content))
    }

    override fun onResume() { super.onResume(); window.decorView.post { applySystemBars() } }

    override fun onPause() {
        browser?.evaluateJavascript("document.querySelectorAll('video').forEach(video => video.pause())", null)
        super.onPause()
    }
}
