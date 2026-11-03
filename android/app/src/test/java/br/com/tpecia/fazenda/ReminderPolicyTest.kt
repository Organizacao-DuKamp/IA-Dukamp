package br.com.tpecia.fazenda
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class ReminderPolicyTest {
    private val due = "2026-11-04T01:00:00Z"
    private val now = ReminderPolicy.time(due)
    private fun reminder(key: String = "one") = JSONObject().put("key", key).put("dueAt", due).put("title", "Dar ração").put("id", key)
    private fun state() = JSONObject().put("enabled", true).put("propertyId", "farm-a").put("version", 4)
        .put("serverNow", "2026-11-03T12:00:00Z").put("sessionExpiresAt", "2027-01-01T00:00:00Z")
        .put("reminders", JSONArray().put(reminder())).put("activeKeys", JSONArray().put("one"))
    @Test fun `night reminder never fires early or twice`() {
        val s = state(); assertFalse(ReminderPolicy.mayFire(s, "one", now, now - 1)); assertTrue(ReminderPolicy.mayFire(s, "one", now, now))
        s.put("delivered", JSONObject().put("one", now)); assertFalse(ReminderPolicy.mayFire(s, "one", now, now + 2000))
    }
    @Test fun `closed session and overdue tasks cannot ring`() {
        val s = state(); assertFalse(ReminderPolicy.mayFire(s, "one", now, now + ReminderPolicy.GRACE_MS + 1))
        s.put("sessionExpiresAt", "2026-11-03T01:00:00Z"); assertFalse(ReminderPolicy.mayFire(s, "one", now, now))
        s.put("enabled", false); assertFalse(ReminderPolicy.mayFire(s, "one", now, now))
    }
    @Test fun `late snapshot cannot restore a cancelled task`() {
        val s = state(); assertNull(ReminderPolicy.reconcile(s, state().put("version", 3)))
        val result = ReminderPolicy.reconcile(s, state().put("version", 5).put("reminders", JSONArray()).put("activeKeys", JSONArray()))!!
        assertEquals(0, result.getJSONArray("reminders").length()); assertFalse(ReminderPolicy.mayFire(result, "one", now, now))
    }
    @Test fun `snooze survives only while original task stays active`() {
        val s = state().put("snoozes", JSONObject().put("one", now + 600000)).put("delivered", JSONObject().put("one", now))
        val snapshot = state().put("version", 5).put("reminders", JSONArray())
        val kept = ReminderPolicy.reconcile(s, snapshot)!!; assertEquals(1, kept.getJSONArray("reminders").length())
        assertFalse(ReminderPolicy.mayFire(kept, "one", now, now)); assertTrue(ReminderPolicy.mayFire(kept, "one", now + 600000, now + 600000))
        assertEquals(0, ReminderPolicy.reconcile(kept, snapshot.put("activeKeys", JSONArray()))!!.getJSONArray("reminders").length())
    }
    @Test fun `switching farms clears old snoozes and deliveries`() {
        val s = state().put("snoozes", JSONObject().put("one", now + 600000)).put("delivered", JSONObject().put("one", now))
        val other = state().put("propertyId", "farm-b").put("version", 1).put("reminders", JSONArray()).put("activeKeys", JSONArray())
        val result = ReminderPolicy.reconcile(s, other)!!
        assertEquals(0, result.getJSONObject("snoozes").length()); assertEquals(0, result.getJSONObject("delivered").length()); assertEquals(0, result.getJSONArray("reminders").length())
    }
    @Test fun `same version older request cannot overwrite newer synchronization`() {
        assertNull(ReminderPolicy.reconcile(state().put("serverNow", "2026-11-03T13:00:00Z"), state()))
    }
}
