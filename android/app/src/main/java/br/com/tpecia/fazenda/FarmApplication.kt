package br.com.tpecia.fazenda
import android.app.Application
class FarmApplication : Application() {
    override fun onCreate() { super.onCreate(); FarmNotifications.channels(this)
        if (DeviceStore.read(this).optBoolean("enabled")) ReminderWorker.periodic(this) }
}
