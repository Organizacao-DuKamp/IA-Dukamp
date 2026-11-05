package br.com.tpecia.fazenda
import android.content.Context
import androidx.work.*
import java.util.concurrent.TimeUnit

class ReminderWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
    override fun getForegroundInfo(): ForegroundInfo = ForegroundInfo(78,
        androidx.core.app.NotificationCompat.Builder(applicationContext, FarmNotifications.SYNC)
            .setSmallIcon(R.drawable.ic_notification).setContentTitle("Atualizando lembretes da fazenda").setOngoing(true).setSilent(true).build())
    override fun doWork(): Result {
        val state = DeviceStore.read(applicationContext)
        if (!state.optBoolean("enabled") || state.optBoolean("registering") || state.optString("token").isBlank()) return Result.success()
        return try {
            val pendingToken = state.optString("pendingFcmToken")
            if (pendingToken.isNotBlank()) {
                FarmApi.request("PUT", token = state.getString("token"), body = org.json.JSONObject().put("fcmToken", pendingToken))
                synchronized(DeviceStore.lock) {
                    val current = DeviceStore.read(applicationContext)
                    if (current.optString("token") == state.optString("token") && current.optString("pendingFcmToken") == pendingToken) {
                        current.remove("pendingFcmToken"); current.put("pushAvailable", true).put("fcmToken", pendingToken); DeviceStore.write(applicationContext, current)
                    }
                }
            }
            val snapshot = FarmApi.request(token = state.getString("token"))
            ReminderEngine.apply(applicationContext, snapshot, state.getString("token"), state.getString("generation")); Result.success()
        } catch (_: SessionRevoked) {
            synchronized(DeviceStore.lock) {
                if (DeviceStore.read(applicationContext).optString("token") == state.optString("token")) ReminderEngine.clear(applicationContext)
            }; Result.success()
        } catch (_: Exception) {
            synchronized(DeviceStore.lock) {
                val current = DeviceStore.read(applicationContext)
                if (current.optString("token") == state.optString("token") && current.optString("generation") == state.optString("generation")) {
                    current.put("syncError", "Não foi possível atualizar os horários em segundo plano. Confira a conexão e toque em Atualizar.")
                    DeviceStore.write(applicationContext, current)
                }
            }
            if (runAttemptCount < 4) Result.retry() else Result.failure()
        }
    }
    companion object {
        private const val periodicName = "farm-reminders-periodic"
        internal const val SYNC_NAME = "farm-reminders-sync-v2"
        internal const val URGENT_NAME = "farm-reminders-urgent"
        fun periodic(context: Context) {
            WorkManager.getInstance(context).cancelUniqueWork("farm-reminders-sync")
            val request = PeriodicWorkRequestBuilder<ReminderWorker>(15, TimeUnit.MINUTES)
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()).build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(periodicName, ExistingPeriodicWorkPolicy.KEEP, request)
        }
        fun now(context: Context, urgent: Boolean = false) {
            val request = OneTimeWorkRequestBuilder<ReminderWorker>()
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
            if (urgent) request.setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST)
            // A due push must not inherit a previous sync's network backoff or constraints.
            // Normal signals are coalesced; a fresh due signal replaces an older urgent retry.
            WorkManager.getInstance(context).enqueueUniqueWork(
                if (urgent) URGENT_NAME else SYNC_NAME,
                if (urgent) ExistingWorkPolicy.REPLACE else ExistingWorkPolicy.KEEP,
                request.build())
        }
        fun cancel(context: Context) {
            WorkManager.getInstance(context).cancelUniqueWork(periodicName)
            WorkManager.getInstance(context).cancelUniqueWork(SYNC_NAME)
            WorkManager.getInstance(context).cancelUniqueWork(URGENT_NAME)
            WorkManager.getInstance(context).cancelUniqueWork("farm-reminders-sync")
        }
    }
}
