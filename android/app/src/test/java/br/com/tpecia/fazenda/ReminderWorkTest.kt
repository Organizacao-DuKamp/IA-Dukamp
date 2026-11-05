package br.com.tpecia.fazenda

import android.app.Application
import androidx.work.Configuration
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkInfo
import androidx.work.WorkManager
import androidx.work.testing.SynchronousExecutor
import androidx.work.testing.WorkManagerTestInitHelper
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import java.util.concurrent.TimeUnit

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28], application = Application::class)
class ReminderWorkTest {
    private val context get() = RuntimeEnvironment.getApplication()
    private val work get() = WorkManager.getInstance(context)

    @Before fun setup() {
        WorkManagerTestInitHelper.initializeTestWorkManager(context,
            Configuration.Builder().setExecutor(SynchronousExecutor()).build())
    }

    @Test fun `due push completes independently of a blocked normal sync`() {
        val blocked = OneTimeWorkRequestBuilder<ReminderWorker>().setInitialDelay(10, TimeUnit.MINUTES).build()
        work.enqueueUniqueWork(ReminderWorker.SYNC_NAME, ExistingWorkPolicy.KEEP, blocked).result.get()
        ReminderWorker.now(context, urgent = true)
        val urgent = work.getWorkInfosForUniqueWork(ReminderWorker.URGENT_NAME).get().single()
        WorkManagerTestInitHelper.getTestDriver(context)!!.setAllConstraintsMet(urgent.id)
        // No device is enabled in this fixture, so the urgent job succeeds without HTTP.
        assertEquals(WorkInfo.State.SUCCEEDED, work.getWorkInfoById(urgent.id).get()!!.state)
        assertEquals(WorkInfo.State.ENQUEUED, work.getWorkInfoById(blocked.id).get()!!.state)
    }

    @Test fun `repeated normal signals do not append a growing dependency chain`() {
        val blocked = OneTimeWorkRequestBuilder<ReminderWorker>().setInitialDelay(10, TimeUnit.MINUTES).build()
        work.enqueueUniqueWork(ReminderWorker.SYNC_NAME, ExistingWorkPolicy.KEEP, blocked).result.get()
        repeat(4) { ReminderWorker.now(context) }
        assertEquals(listOf(blocked.id), work.getWorkInfosForUniqueWork(ReminderWorker.SYNC_NAME).get().map { it.id })
    }

    @Test fun `fresh urgent signal replaces an urgent job waiting for retry`() {
        val blocked = OneTimeWorkRequestBuilder<ReminderWorker>().setInitialDelay(10, TimeUnit.MINUTES).build()
        work.enqueueUniqueWork(ReminderWorker.URGENT_NAME, ExistingWorkPolicy.KEEP, blocked).result.get()
        ReminderWorker.now(context, urgent = true)
        assertEquals(WorkInfo.State.CANCELLED, work.getWorkInfoById(blocked.id).get()!!.state)
        assertTrue(work.getWorkInfosForUniqueWork(ReminderWorker.URGENT_NAME).get().any { it.id != blocked.id && it.state != WorkInfo.State.CANCELLED })
    }

    @Test fun `upgrade and logout remove legacy work and urgent syncs`() {
        val legacy = OneTimeWorkRequestBuilder<ReminderWorker>().setInitialDelay(10, TimeUnit.MINUTES).build()
        work.enqueueUniqueWork("farm-reminders-sync", ExistingWorkPolicy.KEEP, legacy).result.get()
        ReminderWorker.periodic(context)
        assertEquals(WorkInfo.State.CANCELLED, work.getWorkInfoById(legacy.id).get()!!.state)
        ReminderWorker.now(context, urgent = true)
        ReminderWorker.cancel(context)
        assertTrue(work.getWorkInfosForUniqueWork(ReminderWorker.URGENT_NAME).get().all { it.state.isFinished })
    }
}
