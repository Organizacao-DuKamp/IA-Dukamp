package br.com.tpecia.fazenda
import android.app.Activity
import android.content.*
import android.graphics.Color
import android.os.Bundle
import android.os.Build
import android.view.Gravity
import android.view.WindowManager
import android.widget.*
import androidx.core.content.ContextCompat

class AlarmActivity : Activity() {
    private var key = ""
    private val changes = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) { if (AlarmService.activeKey != key) finish() }
    }
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (Build.VERSION.SDK_INT >= 27) { setShowWhenLocked(true); setTurnScreenOn(true) }
        else { @Suppress("DEPRECATION")
            window.addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON) }
        ContextCompat.registerReceiver(this, changes, IntentFilter("br.com.tpecia.ALARM_CHANGED"), ContextCompat.RECEIVER_NOT_EXPORTED)
        show(intent)
    }
    override fun onNewIntent(intent: Intent) { super.onNewIntent(intent); setIntent(intent); show(intent) }
    private fun show(intent: Intent) {
        key = intent.getStringExtra("key") ?: ""; val state = DeviceStore.read(this)
        val task = ReminderPolicy.objects(state.optJSONArray("reminders")).find { it.optString("key") == key }
        if (task == null || !state.optBoolean("enabled")) { finish(); return }
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER
            setPadding(28.dp, 48.dp, 28.dp, 48.dp); setBackgroundColor(Color.rgb(6, 78, 59))
        }
        fun text(value: String, size: Float) = TextView(this).apply {
            text = value; textSize = size; setTextColor(Color.WHITE); gravity = Gravity.CENTER; setPadding(0, 12.dp, 0, 12.dp)
        }
        layout.addView(text("TPEC-IA · HORA DA TAREFA", 16f)); layout.addView(text(task.getString("title"), 32f))
        layout.addView(text(state.optString("propertyName", "Minha fazenda"), 20f))
        fun button(label: String, action: () -> Unit) {
            layout.addView(Button(this).apply { text = label; textSize = 18f; isAllCaps = false; minHeight = 64.dp; setOnClickListener { action() } },
                LinearLayout.LayoutParams(-1, -2).apply { topMargin = 16.dp })
        }
        button("Parar alarme") { act("stop") }
        button("Me lembrar em 10 minutos") { act("snooze") }
        button("Abrir minha fazenda") { act("stop"); startActivity(Intent(this, MainActivity::class.java)) }
        layout.addView(text("Parar o som não conclui a tarefa.", 14f)); setContentView(layout)
    }
    private fun act(action: String) { startService(Intent(this, AlarmService::class.java).setAction(action).putExtra("key", key)); finish() }
    private val Int.dp get() = (this * resources.displayMetrics.density).toInt()
    override fun onDestroy() { unregisterReceiver(changes); super.onDestroy() }
}
