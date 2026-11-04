package br.com.tpecia.fazenda
import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.os.*
import android.provider.Settings
import android.view.View
import android.webkit.*
import android.widget.*
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import com.google.firebase.FirebaseApp
import com.google.firebase.messaging.FirebaseMessaging
import org.json.JSONObject
import java.security.SecureRandom
import java.util.UUID

class MainActivity : ComponentActivity() {
    private lateinit var web: WebView
    private lateinit var progress: ProgressBar
    private lateinit var offline: LinearLayout
    private val network = FarmApi.executor
    private val notifications = registerForActivityResult(ActivityResultContracts.RequestPermission()) { publish() }
    private fun trusted(uri: Uri) = uri.scheme == "https" && uri.host == Uri.parse(BuildConfig.PANEL_ORIGIN).host && (uri.port == -1 || uri.port == 443) && uri.userInfo == null
    private val panelUrl get() = BuildConfig.PANEL_ORIGIN + "/painelfazenda"
    private fun panelUrl(url: String) = PanelNavigation.allows(url, BuildConfig.PANEL_ORIGIN)
    private fun inPanel() = web.url?.let { panelUrl(it) } == true
    private fun openOutsidePanel(uri: Uri) {
        if (uri.scheme !in setOf("https", "http", "whatsapp", "mailto", "tel")) return
        try { startActivity(Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE)) }
        catch (_: Exception) { publish("Não foi possível abrir este link.") }
    }
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState); WindowCompat.setDecorFitsSystemWindows(window, false)
        val root = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setBackgroundColor(Color.WHITE) }
        ViewCompat.setOnApplyWindowInsetsListener(root) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            val keyboard = insets.getInsets(WindowInsetsCompat.Type.ime())
            view.setPadding(bars.left, bars.top, bars.right, maxOf(bars.bottom, keyboard.bottom)); WindowInsetsCompat.CONSUMED
        }
        progress = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal); root.addView(progress, LinearLayout.LayoutParams(-1, 6))
        offline = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL; setPadding(32, 60, 32, 32); visibility = View.GONE
            addView(TextView(this@MainActivity).apply { text = "Não foi possível abrir sua fazenda. Confira sua conexão e tente novamente."; textSize = 20f })
            addView(Button(this@MainActivity).apply { text = "Tentar novamente"; setOnClickListener { web.loadUrl(panelUrl) } })
        }
        root.addView(offline); web = WebView(this); root.addView(web, LinearLayout.LayoutParams(-1, 0, 1f)); setContentView(root)
        with(web.settings) { javaScriptEnabled = true; domStorageEnabled = true; allowFileAccess = false; allowContentAccess = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW; javaScriptCanOpenWindowsAutomatically = false; setSupportMultipleWindows(false); safeBrowsingEnabled = true }
        CookieManager.getInstance().setAcceptCookie(true); CookieManager.getInstance().setAcceptThirdPartyCookies(web, false)
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            offline.visibility = View.VISIBLE; (offline.getChildAt(0) as TextView).text = "Atualize o Android System WebView na Play Store para usar o aplicativo com segurança."
            web.visibility = View.GONE; return
        }
        WebViewCompat.addWebMessageListener(web, "TpecAndroid", setOf(BuildConfig.PANEL_ORIGIN)) { _, message, origin, mainFrame, _ ->
            if (mainFrame && trusted(origin) && inPanel()) try { command(JSONObject(message.data ?: "{}")) }
            catch (_: Exception) { publish("Não foi possível realizar essa ação. Tente novamente.") }
        }
        web.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView, value: Int) { progress.progress = value; progress.visibility = if (value == 100) View.GONE else View.VISIBLE }
        }
        web.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                if (!request.isForMainFrame) return !trusted(request.url)
                if (panelUrl(request.url.toString())) return false
                openOutsidePanel(request.url)
                return true
            }
            override fun onPageStarted(view: WebView, url: String, favicon: android.graphics.Bitmap?) {
                if (!panelUrl(url)) {
                    view.stopLoading(); openOutsidePanel(Uri.parse(url)); view.loadUrl(panelUrl); return
                }
                offline.visibility = View.GONE; web.visibility = View.VISIBLE
            }
            override fun doUpdateVisitedHistory(view: WebView, url: String, isReload: Boolean) {
                // Client-side router transitions do not call shouldOverrideUrlLoading.
                if (!panelUrl(url)) {
                    view.stopLoading(); openOutsidePanel(Uri.parse(url)); view.loadUrl(panelUrl)
                }
            }
            override fun onPageFinished(view: WebView, url: String) { CookieManager.getInstance().flush(); publish() }
            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                if (request.isForMainFrame) { offline.visibility = View.VISIBLE; web.visibility = View.GONE }
            }
        }
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() { if (web.canGoBack()) web.goBack() else finish() }
        })
        web.loadUrl(panelUrl)
    }
    private fun command(message: JSONObject) {
        when (message.optString("type")) {
            "status" -> publish()
            "connect" -> if (message.optString("mode") in setOf("alarm", "notification")) connect(message.getString("mode"))
            "sync" -> sync()
            "disconnect" -> {
                val old = DeviceStore.read(this); ReminderEngine.clear(this); publish(); val token = old.optString("token")
                if (token.isNotEmpty()) network.execute { try { FarmApi.request("DELETE", token) } catch (_: Exception) { /* Revocation is independently rechecked by the server. */ } }
            }
            "test" -> { ReminderEngine.test(this); publish() }
            "permission" -> permission(message.optString("permission"))
        }
    }
    private fun connect(mode: String) {
        val state = synchronized(DeviceStore.lock) {
            DeviceStore.read(this).apply {
                if (optString("token").isEmpty()) put("token", ByteArray(32).also { SecureRandom().nextBytes(it) }.joinToString("") { "%02x".format(it) })
                put("generation", UUID.randomUUID().toString()).put("enabled", true).put("mode", mode).put("registering", true)
                DeviceStore.write(this@MainActivity, this)
            }
        }
        permission("notifications", onlyInitial = true)
        val cookie = CookieManager.getInstance().getCookie(BuildConfig.PANEL_ORIGIN + "/api/public/farm-panel")
            ?.split(";")?.map { it.trim() }?.find { it.matches(Regex("tpec_farm_app_session=[a-f0-9]{64}")) }
        val register: (String?) -> Unit = { fcm -> network.execute {
            try {
                if (cookie == null) throw SessionRevoked()
                val snapshot = FarmApi.request("POST", cookie = cookie, body = JSONObject().put("token", state.getString("token"))
                    .put("fcmToken", fcm ?: JSONObject.NULL).put("mode", mode))
                synchronized(DeviceStore.lock) {
                    val current = DeviceStore.read(this)
                    if (current.optString("generation") == state.optString("generation")) {
                        current.put("pushAvailable", fcm != null).put("registering", false); DeviceStore.write(this, current)
                    }
                }
                ReminderEngine.apply(this, snapshot, state.getString("token"), state.getString("generation")); ReminderWorker.periodic(this); publish()
            } catch (_: SessionRevoked) { invalidate(state); publish("Entre novamente na sua fazenda para ativar os lembretes.") }
            catch (_: Exception) {
                synchronized(DeviceStore.lock) {
                    val current = DeviceStore.read(this)
                    if (current.optString("generation") == state.optString("generation")) {
                        current.put("registering", false); if (!current.has("lastSync")) current.put("enabled", false); DeviceStore.write(this, current)
                    }
                }; publish("Não foi possível salvar os lembretes. Confira sua conexão e tente novamente.")
            }
        } }
        if (FirebaseApp.getApps(this).isNotEmpty()) FirebaseMessaging.getInstance().token.addOnCompleteListener { register(if (it.isSuccessful) it.result else null) }
        else register(null)
    }
    private fun invalidate(expected: JSONObject) = synchronized(DeviceStore.lock) {
        if (DeviceStore.read(this).optString("generation") == expected.optString("generation")) ReminderEngine.clear(this)
    }
    private fun sync() {
        val state = DeviceStore.read(this)
        if (!state.optBoolean("enabled") || state.optBoolean("registering") || state.optString("token").isEmpty()) { publish(); return }
        network.execute {
            try { val snapshot = FarmApi.request(token = state.getString("token"))
                ReminderEngine.apply(this, snapshot, state.getString("token"), state.getString("generation")); publish()
            } catch (_: SessionRevoked) { invalidate(state); publish("Seu acesso mudou. Entre novamente na fazenda.") }
            catch (_: Exception) { publish("Sem conexão para atualizar. Os horários já salvos continuam no celular.") }
        }
    }
    private fun permission(kind: String, onlyInitial: Boolean = false) {
        try {
            when (kind) {
                "notifications" -> {
                    val state = DeviceStore.read(this)
                    val denied = Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
                    if (denied && (!state.optBoolean("askedNotifications") || shouldShowRequestPermissionRationale(Manifest.permission.POST_NOTIFICATIONS))) {
                        state.put("askedNotifications", true); DeviceStore.write(this, state); notifications.launch(Manifest.permission.POST_NOTIFICATIONS)
                    } else if (!onlyInitial) startActivity(Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, packageName))
                }
                "exact" -> if (Build.VERSION.SDK_INT >= 31 && !ReminderEngine.exact(this)) startActivity(Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:$packageName")))
                "fullscreen" -> if (Build.VERSION.SDK_INT >= 34 && !FarmNotifications.fullScreen(this)) startActivity(Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, Uri.parse("package:$packageName")))
            }
        } catch (_: Exception) { publish("Abra as configurações do celular e permita os avisos da TPEC-IA.") }
    }
    private fun publish(error: String? = null) {
        if (!::web.isInitialized || isDestroyed) return
        val state = DeviceStore.read(this)
        val detail = JSONObject().put("enabled", state.optBoolean("enabled")).put("mode", state.optString("mode", "alarm"))
            .put("notifications", FarmNotifications.allowed(this, if (state.optString("mode") == "alarm") FarmNotifications.ALARM else FarmNotifications.NORMAL))
            .put("exactAlarms", ReminderEngine.exact(this)).put("fullScreen", FarmNotifications.fullScreen(this))
            .put("pushAvailable", state.optBoolean("pushAvailable")).put("hasMore", state.optBoolean("hasMore"))
            .put("pushConfigured", state.optBoolean("pushConfigured")).put("scheduled", ReminderPolicy.objects(state.optJSONArray("reminders")).count {
                val target = ReminderPolicy.target(state, it)
                target >= System.currentTimeMillis() && state.optJSONObject("delivered")?.optLong(it.getString("key"), -1) != target
            })
        if (state.has("lastSync")) detail.put("lastSync", state.getString("lastSync")); if (error != null) detail.put("error", error)
        runOnUiThread { if (!isDestroyed && inPanel()) web.evaluateJavascript("window.dispatchEvent(new CustomEvent('tpec:android',{detail:$detail}));", null) }
    }
    override fun onResume() { super.onResume(); if (::web.isInitialized) { ReminderEngine.reschedule(this); sync() } }
    override fun onDestroy() { if (::web.isInitialized) web.destroy(); super.onDestroy() }
}
