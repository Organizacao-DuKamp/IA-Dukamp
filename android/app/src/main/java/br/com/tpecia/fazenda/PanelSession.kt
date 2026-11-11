package br.com.tpecia.fazenda

/** Acknowledge only after the cookie store has synchronously reached disk. */
object PanelSession {
    fun persist(requestId: String, flush: () -> Unit, acknowledge: (String) -> Unit) {
        if (!Regex("[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}").matches(requestId)) return
        flush()
        acknowledge(requestId)
    }
}
