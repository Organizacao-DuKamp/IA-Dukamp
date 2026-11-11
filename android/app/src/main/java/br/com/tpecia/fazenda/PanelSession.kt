package br.com.tpecia.fazenda

/** Acknowledge only after the cookie store has synchronously reached disk. */
object PanelSession {
    const val NAME = "tpec_farm_app_session"
    const val PATH = "/api/public/farm-panel"
    const val MAX_AGE_SECONDS = 31536000
    fun validToken(value: String) = Regex("[a-f0-9]{64}").matches(value)
    fun token(header: String?): String? = header?.split(";")?.map { it.trim() }
        ?.firstOrNull { it.startsWith("$NAME=") }?.removePrefix("$NAME=")?.takeIf { validToken(it) }
    fun cookie(token: String, age: Int = MAX_AGE_SECONDS): String {
        require(validToken(token) || (token.isEmpty() && age == 0))
        return "$NAME=$token; Path=$PATH; HttpOnly; Secure; SameSite=Strict; Max-Age=$age"
    }
    fun persist(requestId: String, flush: () -> Unit, acknowledge: (String) -> Unit) {
        if (!Regex("[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}").matches(requestId)) return
        flush()
        acknowledge(requestId)
    }
}
