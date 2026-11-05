package br.com.tpecia.fazenda
import android.app.Service
import android.app.NotificationManager
import android.content.Intent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.IntentFilter
import android.media.*
import android.os.*
import org.json.JSONObject
import androidx.core.content.ContextCompat

class AlarmService : Service() {
    private var player: MediaPlayer? = null
    private var focus: AudioFocusRequest? = null
    private val pending = linkedMapOf<String, JSONObject>()
    private val handler = Handler(Looper.getMainLooper())
    private var wake: PowerManager.WakeLock? = null
    private val timeout = Runnable { next() }
    companion object { @Volatile var activeKey: String? = null }
    private val changes = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            val state = DeviceStore.read(this@AlarmService)
            if (!state.optBoolean("enabled") || state.optString("mode") != "alarm") { stopSelf(); return }
            val keys = ReminderPolicy.objects(state.optJSONArray("reminders")).map { it.getString("key") }.toSet()
            for (key in pending.keys.toList()) if (key != activeKey && !keys.contains(key)) pending.remove(key)
            val current = activeKey
            if (current != null && !keys.contains(current)) next()
        }
    }
    override fun onCreate() {
        super.onCreate(); ContextCompat.registerReceiver(this, changes, IntentFilter("br.com.tpecia.TASKS_CHANGED"), ContextCompat.RECEIVER_NOT_EXPORTED)
    }
    override fun onBind(intent: Intent?) = null
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val key = intent?.getStringExtra("key")
        if (intent?.action in setOf("stop", "snooze")) {
            if (key == activeKey) { if (intent?.action == "snooze") ReminderEngine.snooze(this, key!!); next() }
            else if (pending.isEmpty()) stopSelf()
            return START_NOT_STICKY
        }
        val state = DeviceStore.read(this)
        val reminder = ReminderPolicy.objects(state.optJSONArray("reminders")).find { it.optString("key") == key }
        if (!state.optBoolean("enabled") || reminder == null || !FarmNotifications.allowed(this, FarmNotifications.ALARM)) {
            if (pending.isEmpty()) stopSelf(); return START_NOT_STICKY
        }
        pending[key!!] = reminder
        if (activeKey == null) { activeKey = key; ring() }
        publish(); return START_NOT_STICKY
    }
    private fun publish() {
        val key = activeKey ?: return; val task = pending[key] ?: return
        startForeground(FarmNotifications.FOREGROUND_ID, FarmNotifications.alarm(this, key, task.getString("title"), pending.size))
    }
    private fun ring() {
        publish()
        wake = getSystemService(PowerManager::class.java).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "tpec:task-alarm").apply { acquire(5 * 60_000L) }
        val attributes = AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build()
        val audio = getSystemService(AudioManager::class.java)
        focus = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT).setAudioAttributes(attributes)
            .setOnAudioFocusChangeListener { change -> if (change == AudioManager.AUDIOFOCUS_LOSS) next() }.build()
        audio.requestAudioFocus(focus!!)
        val sounded = startSound(attributes)
        synchronized(DeviceStore.lock) {
            val state = DeviceStore.read(this)
            if (sounded) state.remove("alarmError")
            else state.put("alarmError", "O som do alarme não pôde ser reproduzido. Confira as configurações de som do celular e teste novamente.")
            DeviceStore.write(this, state)
        }
        if (!sounded) activeKey?.let { key -> pending[key]?.let { FarmNotifications.normal(this, key, it.getString("title")) } }
        @Suppress("DEPRECATION")
        (getSystemService(VIBRATOR_SERVICE) as Vibrator).vibrate(VibrationEffect.createWaveform(longArrayOf(0, 600, 500), 0))
        handler.removeCallbacks(timeout); handler.postDelayed(timeout, 5 * 60_000L)
    }
    private fun startSound(attributes: AudioAttributes): Boolean {
        val tones = listOfNotNull(
            RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM),
            RingtoneManager.getActualDefaultRingtoneUri(this, RingtoneManager.TYPE_ALARM),
            android.net.Uri.parse("android.resource://$packageName/${R.raw.task_alarm_fallback}")
        ).distinct()
        for (tone in tones) {
            val candidate = MediaPlayer()
            try {
                candidate.setAudioAttributes(attributes); candidate.setDataSource(this, tone)
                candidate.isLooping = true; candidate.prepare(); candidate.start()
                player = candidate; return true
            } catch (_: Exception) { candidate.release() }
        }
        return false
    }
    private fun next() {
        val old = activeKey; if (old != null) pending.remove(old)
        stopAudio(); activeKey = pending.keys.firstOrNull()
        if (activeKey == null) { stopForeground(STOP_FOREGROUND_REMOVE); stopSelf() } else ring()
        sendBroadcast(Intent("br.com.tpecia.ALARM_CHANGED").setPackage(packageName))
    }
    private fun stopAudio() {
        handler.removeCallbacks(timeout); player?.release(); player = null
        focus?.let { getSystemService(AudioManager::class.java).abandonAudioFocusRequest(it) }; focus = null
        @Suppress("DEPRECATION")
        (getSystemService(VIBRATOR_SERVICE) as Vibrator).cancel()
        if (wake?.isHeld == true) wake?.release(); wake = null
    }
    override fun onDestroy() {
        unregisterReceiver(changes); stopAudio(); pending.clear(); activeKey = null
        getSystemService(NotificationManager::class.java).cancel(FarmNotifications.FOREGROUND_ID)
        sendBroadcast(Intent("br.com.tpecia.ALARM_CHANGED").setPackage(packageName)); super.onDestroy()
    }
}
