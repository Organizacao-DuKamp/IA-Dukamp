package br.com.tpecia.fazenda

import org.junit.Assert.*
import org.junit.Test

class PanelFilesTest {
    @Test fun photoPickerOnlyAdvertisesRequestedImages() {
        assertEquals(listOf("image/jpeg", "image/png", "image/webp"), PanelFiles.acceptTypes(listOf("image/jpeg,image/png,image/webp")))
    }
    @Test fun pdfAndExcelAreSupportedTogetherAndDeduplicated() {
        assertEquals(listOf("application/pdf", "application/vnd.ms-excel"), PanelFiles.acceptTypes(listOf("application/pdf", "application/vnd.ms-excel", "application/pdf")))
        assertTrue(PanelFiles.mimeTypes.contains("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
    }
    @Test fun extensionOnlyOrEmptyInputsUseSafeDocumentTypes() {
        assertEquals(PanelFiles.mimeTypes, PanelFiles.acceptTypes(listOf(".pdf,.xlsx,.xls")))
        assertEquals(PanelFiles.mimeTypes, PanelFiles.acceptTypes(emptyList()))
        assertFalse(PanelFiles.acceptTypes(listOf("application/javascript,text/html")).contains("text/html"))
    }
}
