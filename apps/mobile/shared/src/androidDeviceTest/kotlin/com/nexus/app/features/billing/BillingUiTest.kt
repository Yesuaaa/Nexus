package com.nexus.app.features.billing

import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.*
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.v2.createComposeRule
import com.nexus.app.core.components.NexusTopAppBar
import com.nexus.app.core.files.*
import com.nexus.app.features.billing.api.BillingRepository
import com.nexus.app.features.billing.model.*
import com.nexus.app.features.billing.screens.BillingLogsScreen
import com.nexus.app.features.billing.viewmodel.BillingViewModel
import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.*
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.plugins.defaultRequest
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

class BillingUiTest {
    @get:Rule val compose = createComposeRule()

    @Test fun accountMenuPlacesBillingBetweenProfileAndSettings() {
        var clicks = 0
        compose.setContent { MaterialTheme { NexusTopAppBar("Dashboard", onBillingLogsClick = { clicks++ }) } }
        compose.onNodeWithContentDescription("Open account menu").performClick()
        val profile = compose.onNodeWithText("Profile").fetchSemanticsNode().boundsInRoot
        val billing = compose.onNodeWithText("Billing Logs").fetchSemanticsNode().boundsInRoot
        val settings = compose.onNodeWithText("Settings").fetchSemanticsNode().boundsInRoot
        assertTrue(profile.top < billing.top && billing.top < settings.top)
        compose.onNodeWithText("Billing Logs").performClick()
        compose.runOnIdle { assertEquals(1, clicks) }
    }

    @Test fun pendingSummaryShowsBreakdownAndNavigatesToPaymentAndChat() {
        val payment = BillingPayment("pending", "booking", "Website development", "30.03", "PENDING",
            bookingReference = "BK-123", approvedAt = "2026-11-13T00:00:00Z",
            lineItems = listOf(BillingLineItem("Design", 2, "10.01"), BillingLineItem("Hosting", 1, "10.01")))
        var pay: String? = null
        var chat: String? = null
        show(payment, onPay = { pay = it }, onChat = { chat = it })
        compose.waitUntil(10_000) { compose.onAllNodesWithText("Review").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText("Review").performClick()
        compose.onNodeWithText("Payment summary").assertIsDisplayed()
        compose.onNodeWithText("Quotation accepted on").assertExists()
        compose.onNodeWithText("Design").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("₱20.02").assertIsDisplayed()
        compose.onNodeWithText("Total due").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Pay ₱30.03").performScrollTo().performClick()
        compose.runOnIdle { assertEquals("booking", pay) }
        compose.onNodeWithText("Review").performClick()
        compose.onNodeWithText("Go to chats").performScrollTo().performClick()
        compose.runOnIdle { assertEquals("booking", chat) }
    }

    @Test fun sandboxReceiptDownloadsWithoutImagePreview() {
        val payment = BillingPayment("paid", "booking", "Website development", "30.03", "VERIFIED", sandbox = true,
            proofFile = BillingProofFile("receipt", "receipt.pdf", "application/pdf"))
        var saved: SelectedFile? = null
        val files = object : PlatformFiles {
            override suspend fun select(): SelectedFile? = null
            override suspend fun preview(file: SelectedFile) = Unit
            override suspend fun save(file: SelectedFile) { saved = file }
        }
        show(payment, files)
        compose.waitUntil(10_000) { compose.onAllNodesWithText("Test payment").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText("Test payment").performClick()
        compose.onNodeWithText("Sandbox receipt").assertIsDisplayed()
        compose.onNodeWithText("Test payment only. No money was charged.").assertIsDisplayed()
        compose.onNodeWithContentDescription("Enlarge payment proof").assertDoesNotExist()
        compose.onNodeWithText("Download receipt").performScrollTo().performClick()
        compose.waitUntil(10_000) { saved != null }
        compose.runOnIdle { assertEquals("receipt.pdf", saved?.name); assertArrayEquals(byteArrayOf(1, 2), saved?.bytes) }
    }

    @Test fun submittedImageProofExpandsAndCollapses() {
        val png = java.io.ByteArrayOutputStream().use { output ->
            val bitmap = android.graphics.Bitmap.createBitmap(2, 2, android.graphics.Bitmap.Config.ARGB_8888)
            bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, output)
            bitmap.recycle()
            output.toByteArray()
        }
        val payment = BillingPayment("submitted", "booking", "Design", "30.03", "SUBMITTED",
            proofFile = BillingProofFile("proof", "proof.png", "image/png"))
        show(payment, proofBytes = png)
        compose.waitUntil(10_000) { compose.onAllNodesWithText("Awaiting verification").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText("Awaiting verification").performClick()
        compose.onNodeWithText("Payment proof").assertIsDisplayed()
        compose.onNodeWithText("The team will verify your payment within 1 business day.").assertIsDisplayed()
        compose.waitUntil(10_000) { compose.onAllNodesWithContentDescription("Enlarge payment proof").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithContentDescription("Enlarge payment proof").performScrollTo().performClick()
        compose.onNodeWithContentDescription("Collapse payment proof").performScrollTo().assertIsDisplayed().performClick()
        compose.onNodeWithContentDescription("Enlarge payment proof").assertExists()
    }

    private fun show(payment: BillingPayment, files: PlatformFiles? = null, onPay: (String) -> Unit = {}, onChat: (String) -> Unit = {}, proofBytes: ByteArray = byteArrayOf(1, 2)) {
        val client = HttpClient(MockEngine { request ->
            if (request.url.encodedPath.endsWith("/billing")) respond(Json.encodeToString(listOf(payment)), headers = headersOf(HttpHeaders.ContentType, "application/json"))
            else respond(proofBytes)
        }) {
            install(ContentNegotiation) { json() }
            defaultRequest { url("https://nexus.test") }
        }
        compose.setContent {
            DisposableEffect(client) { onDispose { client.close() } }
            MaterialTheme {
                CompositionLocalProvider(LocalPlatformFiles provides files) {
                    BillingLogsScreen(onChat, onPay, remember { BillingViewModel(BillingRepository(client)) })
                }
            }
        }
    }
}
