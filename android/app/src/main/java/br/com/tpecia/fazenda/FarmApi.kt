package br.com.tpecia.fazenda
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.io.ByteArrayOutputStream
import java.util.concurrent.Executors

class SessionRevoked : Exception()
object FarmApi {
    val executor = Executors.newSingleThreadExecutor()
    const val path = "/api/public/farm-panel/app"
    fun request(method: String = "GET", token: String? = null, cookie: String? = null, body: JSONObject? = null): JSONObject {
        val connection = URL(BuildConfig.PANEL_ORIGIN + path).openConnection() as HttpURLConnection
        try {
            connection.requestMethod = method; connection.connectTimeout = 7000; connection.readTimeout = 7000; connection.instanceFollowRedirects = false
            connection.setRequestProperty("Cache-Control", "no-store"); connection.setRequestProperty("Origin", BuildConfig.PANEL_ORIGIN)
            connection.setRequestProperty("X-TPEC-Panel", "1"); connection.setRequestProperty("X-TPEC-Panel-Mode", "installed")
            token?.let { connection.setRequestProperty("Authorization", "Bearer $it") }; cookie?.let { connection.setRequestProperty("Cookie", it) }
            if (body != null) { connection.doOutput = true; connection.setRequestProperty("Content-Type", "application/json")
                connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) } }
            if (connection.responseCode == 401 || connection.responseCode == 403) throw SessionRevoked()
            check(connection.responseCode in 200..299) { "sync_unavailable" }
            val bytes = connection.inputStream.use { input ->
                val output = ByteArrayOutputStream(); val buffer = ByteArray(8192); var count = input.read(buffer)
                while (count != -1) { check(output.size() + count <= 2 * 1024 * 1024); output.write(buffer, 0, count); count = input.read(buffer) }
                output.toByteArray()
            }
            return JSONObject(String(bytes, Charsets.UTF_8))
        } finally { connection.disconnect() }
    }
}
