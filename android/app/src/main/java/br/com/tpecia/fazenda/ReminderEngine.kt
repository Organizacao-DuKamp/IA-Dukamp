package br.com.tpecia.fazenda
import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.annotation.SuppressLint
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant

object ReminderEngine {
    fun exact(context: Context) = Build.VERSION.SDK_INT < 31 || context.getSystemService(AlarmManager::class.java).canScheduleExactAlarms()
    private fun intent(context: Context, key: String, target: Long, flags: Int = PendingIntent.FLAG_UPDATE_CURRENT) = PendingIntent.getBroadcast(context, 0,
        Intent(context, AlarmReceiver::class.java).setAction("br.com.tpecia.ALARM").setData(Uri.parse("tpec://alarm/$key"))
            .putExtra("key", key).putExtra("target", target), flags or PendingIntent.FLAG_IMMUTABLE)
    fun cancel(context: Context, key: String, clearNotification: Boolean = true) {
        // FLAG_UPDATE_CURRENT here used to overwrite the target of an alarm
        // already being delivered, turning a valid receiver intent into target=0.
        intent(context, key, 0, PendingIntent.FLAG_NO_CREATE)?.let {
            context.getSystemService(AlarmManager::class.java).cancel(it)
        }
        if (clearNotification) context.getSystemService(android.app.NotificationManager::class.java).cancel(key, 1)
    }
    @SuppressLint("ScheduleExactAlarm", "MissingPermission") // Guarded by exact() and a SecurityException fallback.
    private fun schedule(context: Context, key: String, target: Long, mode: String) {
        val alarms = context.getSystemService(AlarmManager::class.java)
        val at = maxOf(target, System.currentTimeMillis() + 500); val action = intent(context, key, target)!!
        try {
            if (exact(context)) {
                if (mode == "alarm") {
                    val show = PendingIntent.getActivity(context, 0, Intent(context, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE)
                    alarms.setAlarmClock(AlarmManager.AlarmClockInfo(at, show), action)
                } else alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, action)
            } else alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, action)
        } catch (_: SecurityException) { alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, action) }
    }
    fun reschedule(context: Context) = synchronized(DeviceStore.lock) {
        val state = DeviceStore.read(context); val now = System.currentTimeMillis()
        for (reminder in ReminderPolicy.objects(state.optJSONArray("reminders"))) {
            val key = reminder.getString("key"); val target = ReminderPolicy.target(state, reminder)
            if (state.optBoolean("enabled") && ReminderPolicy.time(state.optString("sessionExpiresAt")) > now &&
                target >= now - ReminderPolicy.LOCAL_GRACE_MS && state.optJSONObject("delivered")?.optLong(key, -1) != target)
                schedule(context, key, target, state.optString("mode", "notification"))
        }
    }
    fun apply(context: Context, snapshot: JSONObject, token: String, generation: String) = synchronized(DeviceStore.lock) {
        val old = DeviceStore.read(context)
        if (old.optString("token") != token || old.optString("generation") != generation || !old.optBoolean("enabled")) return@synchronized
        val next = ReminderPolicy.reconcile(old, snapshot) ?: return@synchronized
        next.put("lastSync", Instant.now().toString()).remove("syncError")
        val keys = ReminderPolicy.objects(next.optJSONArray("reminders")).map { it.getString("key") }.toSet()
        val active = snapshot.getJSONArray("activeKeys").let { array -> (0 until array.length()).map { array.getString(it) }.toSet() } + keys
        for (reminder in ReminderPolicy.objects(old.optJSONArray("reminders"))) {
            val key = reminder.getString("key")
            if (!keys.contains(key)) cancel(context, key, clearNotification = !active.contains(key))
        }
        old.optJSONObject("delivered")?.keys()?.forEach { key -> if (!active.contains(key)) cancel(context, key) }
        DeviceStore.write(context, next)
        context.sendBroadcast(Intent("br.com.tpecia.TASKS_CHANGED").setPackage(context.packageName))
        reschedule(context)
    }
    fun clear(context: Context) = synchronized(DeviceStore.lock) {
        val old = DeviceStore.read(context)
        for (item in ReminderPolicy.objects(old.optJSONArray("reminders"))) cancel(context, item.getString("key"))
        old.optJSONObject("delivered")?.keys()?.forEach { key -> cancel(context, key) }
        DeviceStore.write(context, JSONObject()); context.stopService(Intent(context, AlarmService::class.java)); ReminderWorker.cancel(context)
    }
    fun claim(context: Context, key: String, target: Long): JSONObject? = synchronized(DeviceStore.lock) {
        val state = DeviceStore.read(context)
        if (!ReminderPolicy.mayFire(state, key, target, System.currentTimeMillis())) return@synchronized null
        val delivered = state.optJSONObject("delivered") ?: JSONObject(); delivered.put(key, target)
        state.put("delivered", delivered); DeviceStore.write(context, state)
        ReminderPolicy.objects(state.getJSONArray("reminders")).find { it.getString("key") == key }
    }
    fun snooze(context: Context, key: String) = synchronized(DeviceStore.lock) {
        val state = DeviceStore.read(context)
        if (!state.optBoolean("enabled") || ReminderPolicy.objects(state.optJSONArray("reminders")).none { it.getString("key") == key }) return@synchronized
        val target = System.currentTimeMillis() + 10 * 60_000
        val snoozes = state.optJSONObject("snoozes") ?: JSONObject()
        state.put("snoozes", snoozes.put(key, target)); DeviceStore.write(context, state)
        schedule(context, key, target, state.optString("mode"))
    }
    fun test(context: Context) = synchronized(DeviceStore.lock) {
        val state = DeviceStore.read(context); if (!state.optBoolean("enabled")) return@synchronized
        val at = System.currentTimeMillis() + 5000; val key = ReminderPolicy.TEST_KEY
        val reminders = JSONArray(ReminderPolicy.objects(state.optJSONArray("reminders")).filter { it.optString("key") != key })
        reminders.put(JSONObject().put("key", key).put("id", "test").put("title", "Teste de lembrete da TPEC-IA").put("dueAt", Instant.ofEpochMilli(at).toString()))
        state.put("reminders", reminders); DeviceStore.write(context, state); schedule(context, key, at, state.optString("mode"))
    }
}
