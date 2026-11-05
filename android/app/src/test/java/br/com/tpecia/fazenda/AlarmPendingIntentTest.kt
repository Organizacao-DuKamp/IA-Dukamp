package br.com.tpecia.fazenda

import android.app.AlarmManager
import android.app.Application
import android.app.PendingIntent
import android.content.Intent
import android.net.Uri
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28], application = Application::class)
class AlarmPendingIntentTest {
    @Test fun `cancelling an alarm cannot overwrite a target already in flight`() {
        val context = RuntimeEnvironment.getApplication()
        val target = System.currentTimeMillis() + 60_000
        val action = PendingIntent.getBroadcast(context, 0,
            Intent(context, AlarmReceiver::class.java).setAction("br.com.tpecia.ALARM")
                .setData(Uri.parse("tpec://alarm/one")).putExtra("key", "one").putExtra("target", target),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val manager = context.getSystemService(AlarmManager::class.java)
        manager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, target, action)
        ReminderEngine.cancel(context, "one")
        assertTrue(shadowOf(manager).scheduledAlarms.isEmpty())
        assertEquals(target, shadowOf(action).savedIntent.getLongExtra("target", -1))
    }
}
