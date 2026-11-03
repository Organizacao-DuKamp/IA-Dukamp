package br.com.tpecia.fazenda
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant

object ReminderPolicy {
    const val GRACE_MS = 5 * 60_000L
    fun time(value: String): Long = try { Instant.parse(value).toEpochMilli() } catch (_: Exception) { 0 }
    fun objects(array: JSONArray?): List<JSONObject> = (0 until (array?.length() ?: 0)).map { array!!.getJSONObject(it) }
    fun reconcile(old: JSONObject, snapshot: JSONObject): JSONObject? {
        val same = old.optString("propertyId") == snapshot.getString("propertyId")
        if (same && (snapshot.getLong("version") < old.optLong("version", -1) || time(snapshot.getString("serverNow")) < time(old.optString("serverNow")))) return null
        val result = JSONObject(old.toString())
        val active = snapshot.getJSONArray("activeKeys").let { a -> (0 until a.length()).map { a.getString(it) }.toSet() }
        val reminders = objects(snapshot.getJSONArray("reminders")).associateBy { it.getString("key") }.toMutableMap()
        val snoozes = if (same) old.optJSONObject("snoozes") ?: JSONObject() else JSONObject()
        val keptSnoozes = JSONObject()
        if (same) for (item in objects(old.optJSONArray("reminders"))) {
            val key = item.getString("key")
            if (snoozes.has(key) && active.contains(key)) { reminders[key] = item; keptSnoozes.put(key, snoozes.getLong(key)) }
        }
        val delivered = JSONObject()
        if (same) old.optJSONObject("delivered")?.let { previous ->
            for (key in previous.keys()) if (active.contains(key)) delivered.put(key, previous.getLong(key))
        }
        for (key in listOf("propertyId", "propertyName", "version", "serverNow", "sessionExpiresAt", "pushConfigured", "hasMore"))
            if (snapshot.has(key)) result.put(key, snapshot.get(key))
        result.put("reminders", JSONArray(reminders.values.toList())).put("snoozes", keptSnoozes).put("delivered", delivered)
        return result
    }
    fun target(state: JSONObject, reminder: JSONObject): Long = state.optJSONObject("snoozes")
        ?.optLong(reminder.getString("key"), time(reminder.getString("dueAt"))) ?: time(reminder.getString("dueAt"))
    fun mayFire(state: JSONObject, key: String, expected: Long, now: Long): Boolean {
        if (!state.optBoolean("enabled") || time(state.optString("sessionExpiresAt")) <= now) return false
        val reminder = objects(state.optJSONArray("reminders")).find { it.optString("key") == key } ?: return false
        val target = target(state, reminder)
        return target == expected && target <= now && now - target <= GRACE_MS && state.optJSONObject("delivered")?.optLong(key, -1) != target
    }
}
