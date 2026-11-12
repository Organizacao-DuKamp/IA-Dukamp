package br.com.tpecia.fazenda

/** MIME hints for the system document picker. Server-side readers still validate content and size. */
object PanelFiles {
    val mimeTypes = listOf(
        "application/pdf", "image/jpeg", "image/png", "image/webp", "image/gif",
        "text/csv", "text/tab-separated-values", "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    fun acceptTypes(raw: List<String>): List<String> {
        val selected = raw.flatMap { it.split(",") }.map { it.trim() }
            .filter { it in mimeTypes || it == "image/*" }.distinct()
        return selected.ifEmpty { mimeTypes }
    }
}
