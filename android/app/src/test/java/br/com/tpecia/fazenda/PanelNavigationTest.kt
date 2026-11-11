package br.com.tpecia.fazenda

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PanelNavigationTest {
    private val origin = "https://www.tpecia.com.br"

    @Test fun keepsPanelAndItsQueryAndFragmentInsideApp() {
        listOf("/painelfazenda", "/painelfazenda/", "/painelfazenda?tab=tasks#reminders", "/painelfazenda#login=" + "a".repeat(64), "/painelfazenda#invite=" + "b".repeat(64)).forEach {
            assertTrue(it, PanelNavigation.allows(origin + it, origin))
        }
    }

    @Test fun keepsLandingOtherPagesAndUntrustedUrlsOutsideApp() {
        listOf(origin, "$origin/", "$origin/admin", "$origin/painelfazenda/outro",
            "$origin/painelfazenda-extra", "http://www.tpecia.com.br/painelfazenda",
            "https://www.tpecia.com.br.evil.example/painelfazenda",
            "https://evil.example/painelfazenda", "https://user@www.tpecia.com.br/painelfazenda",
            "https://www.tpecia.com.br:444/painelfazenda", "javascript:alert(1)", "invalid url"
        ).forEach { assertFalse(it, PanelNavigation.allows(it, origin)) }
    }
}
