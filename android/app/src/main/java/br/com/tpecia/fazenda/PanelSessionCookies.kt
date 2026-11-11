package br.com.tpecia.fazenda

import android.content.Context
import android.webkit.CookieManager

/** Call on the WebView thread. No credential ever crosses the JavaScript bridge. */
class PanelSessionCookies(context: Context) {
    private val vault = PanelSessionVault(context)
    private val cookies get() = CookieManager.getInstance()
    private val url = BuildConfig.PANEL_ORIGIN + PanelSession.PATH
    private var forgetting = false

    fun capture(authenticated: Boolean = false): Boolean {
        if (authenticated) forgetting = false
        if (forgetting) return false
        val token = PanelSession.token(cookies.getCookie(url)) ?: return false
        vault.write(token)
        cookies.flush()
        return true
    }

    /** This callback must precede loadUrl, including when WebView lost its jar. */
    fun restore(ready: () -> Unit) {
        // Retain a surviving cookie when upgrading an earlier APK.
        if (PanelSession.token(cookies.getCookie(url)) != null) {
            capture(); ready(); return
        }
        val token = vault.read()
        if (token == null) { ready(); return }
        cookies.setCookie(url, PanelSession.cookie(token)) { accepted ->
            if (accepted) cookies.flush()
            ready()
        }
    }

    fun forgetBackup() {
        forgetting = true
        vault.clear()
    }

    fun forget(ready: () -> Unit) {
        // Commit the removal first: process death must not restore a logged-out session.
        forgetBackup()
        cookies.setCookie(url, PanelSession.cookie("", 0)) {
            cookies.flush()
            ready()
        }
    }
}
