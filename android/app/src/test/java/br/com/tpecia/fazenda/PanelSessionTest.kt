package br.com.tpecia.fazenda

import org.junit.Assert.*
import org.junit.Test

class PanelSessionTest {
    private val id = "00000000-0000-4000-8000-000000000001"
    @Test fun acknowledgesOnlyAfterCookiesAreWritten() {
        val calls = mutableListOf<String>()
        PanelSession.persist(id, { calls.add("disk") }, { calls.add(it) })
        assertEquals(listOf("disk", id), calls)
    }
    @Test fun cannotAcknowledgeAFailedWriteOrInvalidMessage() {
        var acknowledged = false
        try { PanelSession.persist(id, { throw IllegalStateException("disk unavailable") }, { acknowledged = true }) }
        catch (_: IllegalStateException) { }
        assertFalse(acknowledged)
        PanelSession.persist("invalid", { fail("unexpected flush") }, { fail("unexpected acknowledgement") })
    }
    @Test fun relaunchRestoresTheFarmWithoutReusingTheOriginalLink() {
        val origin = "https://www.tpecia.com.br"
        val link = "$origin/painelfazenda#login=" + "a".repeat(64)
        assertEquals(link, PanelNavigation.launchUrl(link, false, origin))
        assertEquals("$origin/painelfazenda", PanelNavigation.launchUrl(link, true, origin))
        assertEquals("$origin/painelfazenda", PanelNavigation.launchUrl(null, false, origin))
        assertEquals("$origin/painelfazenda", PanelNavigation.launchUrl("https://evil.example/painelfazenda", false, origin))
    }
}
