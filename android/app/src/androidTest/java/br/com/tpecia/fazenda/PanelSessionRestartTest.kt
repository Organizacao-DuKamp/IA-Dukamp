package br.com.tpecia.fazenda

import android.content.Context
import android.content.Intent
import android.os.Process
import android.view.View
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.WebView
import android.widget.TextView
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.webkit.WebViewFeature
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/** The shell runner force-stops the application between these test methods.
 * Real Android Keystore, disk preferences and WebView CookieManager; no backend. */
@RunWith(AndroidJUnit4::class)
class PanelSessionRestartTest {
    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private val context get() = instrumentation.targetContext
    private val url = BuildConfig.PANEL_ORIGIN + PanelSession.PATH
    private val token = "a".repeat(64) // Synthetic test credential, never sent to the server.
    private val checkpoint get() = context.getSharedPreferences("session-test", Context.MODE_PRIVATE)

    private fun ui(block: () -> Unit) = instrumentation.runOnMainSync(block)
    private fun asynchronous(block: (() -> Unit) -> Unit) {
        val done = CountDownLatch(1)
        ui { block { done.countDown() } }
        assertTrue("WebView operation timed out", done.await(15, TimeUnit.SECONDS))
    }
    private fun clearCookies() = asynchronous { done ->
        CookieManager.getInstance().removeAllCookies { CookieManager.getInstance().flush(); done() }
    }
    private fun setCookie(value: String) = asynchronous { done ->
        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setCookie(url, PanelSession.cookie(value)) {
            assertTrue("Cookie was rejected", it); done()
        }
    }
    private fun assertCookie(expected: String?) = ui {
        assertEquals(expected, PanelSession.token(CookieManager.getInstance().getCookie(url)))
    }
    private fun checkpointProcess() {
        assertTrue(checkpoint.edit().putInt("pid", Process.myPid()).commit())
    }
    private fun assertNewProcess() {
        assertNotEquals("Test must run after process death", checkpoint.getInt("pid", -1), Process.myPid())
        checkpointProcess()
    }

    @Test fun prepare() {
        ui { assertTrue("Update Android System WebView before testing authentication", WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) }
        clearCookies()
        PanelSessionVault(context).clear()
        setCookie(token)
        ui { assertTrue(PanelSessionCookies(context).capture(authenticated = true)) }
        assertEquals(token, PanelSessionVault(context).read())
        val stored = context.getSharedPreferences("farm-session", Context.MODE_PRIVATE).getString("encrypted", "")!!
        assertFalse("Credential must be encrypted on disk", stored.contains(token))
        // Disabling reminders uses a separate store and cannot remove the farm login.
        ReminderEngine.clear(context)
        assertEquals(token, PanelSessionVault(context).read())
        checkpointProcess()
    }

    /** API 28's stock image has an obsolete WebView that cannot run the bridge.
     * Verify the app blocks it, rather than weakening secure-cookie settings. */
    @Test fun unsupportedWebViewIsBlocked() {
        ui { assertFalse(WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) }
        val activity = instrumentation.startActivitySync(Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        ui {
            fun descendants(view: View): List<View> = listOf(view) +
                if (view is ViewGroup) (0 until view.childCount).flatMap { descendants(view.getChildAt(it)) } else emptyList()
            val views = descendants(activity.window.decorView)
            assertTrue(views.filterIsInstance<TextView>().any { it.text.toString().startsWith("Atualize o Android System WebView") })
            assertTrue(views.filterIsInstance<WebView>().all { it.url == null })
            activity.finish()
        }
    }

    @Test fun recoverAfterProcessDeath() {
        assertNewProcess()
        assertEquals(token, PanelSessionVault(context).read())
        // Reproduce the reported missing WebView cookie, even on WebViews that retained it.
        clearCookies()
        assertCookie(null)
        asynchronous { done -> PanelSessionCookies(context).restore(done) }
        assertCookie(token)
    }

    @Test fun logout() {
        assertNewProcess()
        val session = PanelSessionCookies(context)
        asynchronous { done -> session.restore(done) }
        assertCookie(token)
        asynchronous { done ->
            session.forget(done)
            assertFalse("Background callback must not resurrect logout", session.capture())
        }
        assertNull(PanelSessionVault(context).read())
        assertCookie(null)
    }

    @Test fun stayLoggedOut() {
        assertNewProcess()
        asynchronous { done -> PanelSessionCookies(context).restore(done) }
        assertCookie(null)
        assertNull(PanelSessionVault(context).read())
    }

    @Test fun replaceSessionAndExpire() {
        assertNewProcess()
        val session = PanelSessionCookies(context)
        // A surviving cookie from the old APK is migrated before the page loads.
        setCookie(token)
        asynchronous { done -> session.restore(done) }
        assertEquals(token, PanelSessionVault(context).read())
        asynchronous { done -> session.forget(done) }
        val replacement = "b".repeat(64)
        setCookie(replacement)
        ui { assertTrue(session.capture(authenticated = true)) }
        clearCookies()
        asynchronous { done -> session.restore(done) }
        assertCookie(replacement)
        val future = System.currentTimeMillis() + (PanelSession.MAX_AGE_SECONDS + 60L) * 1000L
        assertNull(PanelSessionVault(context) { future }.read())
        assertNull(PanelSessionVault(context).read())
        clearCookies()
        asynchronous { done -> session.restore(done) }
        assertCookie(null)
    }
}
