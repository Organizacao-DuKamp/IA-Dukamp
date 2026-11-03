package br.com.tpecia.fazenda
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.content.ContextCompat
class AlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != "br.com.tpecia.ALARM") return
        val key = intent.getStringExtra("key") ?: return
        val alarm = DeviceStore.read(context).optString("mode") == "alarm"
        if (!FarmNotifications.allowed(context, if (alarm) FarmNotifications.ALARM else FarmNotifications.NORMAL)) return
        val reminder = ReminderEngine.claim(context, key, intent.getLongExtra("target", -1)) ?: return
        if (alarm) {
            try { ContextCompat.startForegroundService(context, Intent(context, AlarmService::class.java).putExtra("key", key)) }
            catch (_: Exception) { FarmNotifications.normal(context, key, reminder.getString("title")) }
        } else FarmNotifications.normal(context, key, reminder.getString("title"))
        ReminderWorker.now(context)
    }
}
