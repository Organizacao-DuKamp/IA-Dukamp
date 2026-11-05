package br.com.tpecia.fazenda
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
class FarmMessagingService : FirebaseMessagingService() {
    override fun onMessageReceived(message: RemoteMessage) {
        if (message.data["app"] != "tpec-farm" || !DeviceStore.read(this).optBoolean("enabled")) return
        ReminderWorker.now(this, message.data["kind"] == "reminder" || message.priority == RemoteMessage.PRIORITY_HIGH)
    }
    override fun onNewToken(token: String) {
        synchronized(DeviceStore.lock) {
            val state = DeviceStore.read(this)
            if (state.optBoolean("enabled")) { state.put("pendingFcmToken", token); DeviceStore.write(this, state) }
        }; ReminderWorker.now(this)
    }
}
