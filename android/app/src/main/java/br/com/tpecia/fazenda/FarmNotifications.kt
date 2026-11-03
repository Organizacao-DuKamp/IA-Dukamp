package br.com.tpecia.fazenda
import android.Manifest
import android.app.*
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.os.Build
import android.annotation.SuppressLint
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat

object FarmNotifications {
    const val NORMAL = "farm-task-reminders-v1"
    const val ALARM = "farm-task-alarms-v1"
    const val SYNC = "farm-task-sync-v1"
    const val FOREGROUND_ID = 77
    fun channels(context: Context) {
        val manager = context.getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(NotificationChannel(NORMAL, "Lembretes das tarefas", NotificationManager.IMPORTANCE_HIGH).apply {
            description = "Aviso no horário de cada tarefa agendada"; enableVibration(true)
        })
        manager.createNotificationChannel(NotificationChannel(ALARM, "Alarmes da fazenda", NotificationManager.IMPORTANCE_HIGH).apply {
            description = "Som de alarme, com ações para parar ou adiar"; enableVibration(false)
            setSound(null, AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).build()); lockscreenVisibility = Notification.VISIBILITY_PRIVATE
        })
        manager.createNotificationChannel(NotificationChannel(SYNC, "Atualização dos lembretes", NotificationManager.IMPORTANCE_LOW).apply {
            setSound(null, null); enableVibration(false)
        })
    }
    fun allowed(context: Context, channel: String? = null): Boolean {
        val manager = context.getSystemService(NotificationManager::class.java)
        return (Build.VERSION.SDK_INT < 33 || ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) &&
            manager.areNotificationsEnabled() && (channel == null || manager.getNotificationChannel(channel)?.importance != NotificationManager.IMPORTANCE_NONE)
    }
    fun fullScreen(context: Context) = Build.VERSION.SDK_INT < 34 || context.getSystemService(NotificationManager::class.java).canUseFullScreenIntent()
    fun open(context: Context) = PendingIntent.getActivity(context, 1, Intent(context, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE)
    fun action(context: Context, key: String, action: String): PendingIntent = PendingIntent.getService(context, action.hashCode(),
        Intent(context, AlarmService::class.java).setAction(action).putExtra("key", key).setData(android.net.Uri.parse("tpec://action/$key/$action")),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    fun alarm(context: Context, key: String, title: String, count: Int = 1): Notification {
        val screen = PendingIntent.getActivity(context, 0,
            Intent(context, AlarmActivity::class.java).setData(android.net.Uri.parse("tpec://screen/$key")).putExtra("key", key),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val builder = NotificationCompat.Builder(context, ALARM).setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title).setContentText(if (count > 1) "$count lembretes da fazenda" else "Chegou a hora da sua tarefa")
            .setCategory(NotificationCompat.CATEGORY_ALARM).setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE).setOngoing(true).setOnlyAlertOnce(true).setContentIntent(screen)
            .addAction(0, "Parar alarme", action(context, key, "stop")).addAction(0, "Adiar 10 minutos", action(context, key, "snooze"))
        if (fullScreen(context)) builder.setFullScreenIntent(screen, true)
        return builder.build()
    }
    @SuppressLint("MissingPermission") // Runtime and channel permissions are checked in allowed().
    fun normal(context: Context, key: String, title: String) {
        if (!allowed(context, NORMAL)) return
        val notification = NotificationCompat.Builder(context, NORMAL).setSmallIcon(R.drawable.ic_notification).setContentTitle(title)
            .setContentText("Toque para abrir sua fazenda").setContentIntent(open(context)).setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH).setVisibility(NotificationCompat.VISIBILITY_PRIVATE).build()
        context.getSystemService(NotificationManager::class.java).notify(key, 1, notification)
    }
}
