package br.com.tpecia.fazenda

import java.net.URI

/** Restrict the app document to the farm panel, retaining query strings and fragments. */
object PanelNavigation {
    fun allows(url: String, origin: String): Boolean = try {
        val target = URI(url)
        val site = URI(origin)
        target.scheme == "https" && target.host == site.host &&
            target.userInfo == null && (target.port == -1 || target.port == 443) &&
            target.rawPath in setOf("/painelfazenda", "/painelfazenda/")
    } catch (_: Exception) { false }
}
