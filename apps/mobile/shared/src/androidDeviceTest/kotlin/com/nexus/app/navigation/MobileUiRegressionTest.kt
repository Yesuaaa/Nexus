package com.nexus.app.navigation

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.requiredSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.unit.dp
import com.nexus.app.core.components.*
import com.nexus.app.features.auth.model.AuthUser
import com.nexus.app.features.profile.screens.ProfileScreen
import com.nexus.app.features.auth.screens.LoginScreen
import com.nexus.app.features.auth.viewmodel.AuthViewModel
import com.nexus.app.features.booking.FakeBookingGateway
import com.nexus.app.features.booking.viewmodel.BookingViewModel
import com.nexus.app.features.services.screens.ServicesScreen
import com.nexus.app.features.booked_requests.screens.BookedRequestsScreen
import com.nexus.app.features.booked_requests.viewmodel.RequestsViewModel
import org.junit.Rule
import org.junit.Test
import org.junit.Assert.assertEquals

class MobileUiRegressionTest {
    @get:Rule val compose = createComposeRule()
    private val user = AuthUser("client", "mobile@example.com", role = "USER", isActive = true)

    @Test fun attachmentChooserRequiresAnEligibleBooking() {
        var chosen: String? = null
        compose.setContent { MaterialTheme {
            com.nexus.app.features.conversations.screens.ConversationBookingSheet(
                bookings = listOf(com.nexus.app.features.conversations.model.ConversationBooking(
                    id = "eligible", serviceName = "Design", workflowState = "CONSULTATION")),
                onDismiss = {}, onContinue = { chosen = it }, attachment = true,
            )
        } }
        compose.onNodeWithText("Continue").assertIsNotEnabled()
        compose.onNodeWithText("Design").performClick()
        compose.onNodeWithText("Continue").assertIsEnabled().performClick()
        compose.runOnIdle { assertEquals("eligible", chosen) }
    }

    @Test fun attachmentChooserExplainsWhenNoBookingsAreEligible() {
        compose.setContent { MaterialTheme {
            com.nexus.app.features.conversations.screens.ConversationBookingSheet(
                bookings = emptyList(), onDismiss = {}, onContinue = {}, attachment = true,
            )
        } }
        compose.onNodeWithText("No eligible bookings for attachments at the current stage.").assertIsDisplayed()
        compose.onNodeWithText("Continue").assertIsNotEnabled()
    }

    @Test fun sentAndReceivedAttachmentsShowFileCardsAndImagePreview() {
        val png = java.io.ByteArrayOutputStream().use { output ->
            val bitmap = android.graphics.Bitmap.createBitmap(2, 2, android.graphics.Bitmap.Config.ARGB_8888)
            bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, output)
            bitmap.recycle()
            output.toByteArray()
        }
        compose.setContent { MaterialTheme {
            androidx.compose.foundation.layout.Column {
                com.nexus.app.features.conversations.components.ConversationAttachmentCard(
                    com.nexus.app.features.conversations.model.ConversationAttachment("booking", "Design",
                        com.nexus.app.features.workflow.model.WorkflowFile("image", "photo.png", "image/png", png.size)), own = true,
                    load = { com.nexus.app.core.files.SelectedFile("photo.png", "image/png", png) })
                com.nexus.app.features.conversations.components.ConversationAttachmentCard(
                    com.nexus.app.features.conversations.model.ConversationAttachment("other", "Consultation",
                        com.nexus.app.features.workflow.model.WorkflowFile("document", "proposal.pdf", "application/pdf", 2048)), own = false,
                    load = { error("Non-image documents should not be automatically downloaded") })
            }
        } }
        compose.onNodeWithText("photo.png").assertIsDisplayed()
        compose.onNodeWithContentDescription("Preview of photo.png").assertExists()
        compose.onNodeWithText("proposal.pdf").assertIsDisplayed()
        compose.onNodeWithContentDescription("Download proposal.pdf").assertExists()
    }

    @Test fun headerExposesChatBetweenNotificationAndProfile() {
        var chats = 0
        compose.setContent { MaterialTheme { NexusTopAppBar(onChatClick = { chats++ }, notificationUnread = 6) } }
        val notification = compose.onNodeWithContentDescription("Notifications").fetchSemanticsNode().boundsInRoot
        val chat = compose.onNodeWithContentDescription("Messages").fetchSemanticsNode().boundsInRoot
        val profile = compose.onNodeWithContentDescription("Open account menu").fetchSemanticsNode().boundsInRoot
        org.junit.Assert.assertTrue(notification.left < chat.left && chat.left < profile.left)
        compose.onNodeWithContentDescription("Messages").performClick()
        compose.runOnIdle { assertEquals(1, chats) }
    }

    @Test fun emptyLoginShowsValidationWithoutMakingANetworkCall() {
        var calls = 0
        compose.setContent {
            MaterialTheme {
                CompositionLocalProvider(LocalNexusToast provides remember { NexusToastState() }) {
                    val vm = remember { AuthViewModel { _, _ -> calls++; Result.success(user) } }
                    LoginScreen(onLoggedIn = {}, viewModel = vm)
                }
            }
        }
        // The header also has a Sign In mode switch; the final button submits the form.
        compose.onAllNodesWithText("Sign In").onLast().performClick()
        compose.onAllNodesWithText("Email address is required.").onFirst().assertExists()
        compose.onNodeWithText("Password is required.").assertExists()
        compose.runOnIdle { assertEquals(0, calls) }
    }

    @Test fun catalogSearchShowsEmptyStateAndResetRestoresResults() {
        compose.setContent {
            MaterialTheme {
                CompositionLocalProvider(LocalNexusToast provides remember { NexusToastState() }) {
                    ServicesScreen(viewModel = remember { BookingViewModel(FakeBookingGateway()) })
                }
            }
        }
        compose.onNodeWithText("Search services").performScrollTo().performTextInput("nonexistent")
        compose.onNodeWithText("No services found").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Reset and refresh").performScrollTo().performClick()
        compose.onNodeWithText("Design").performScrollTo().assertIsDisplayed()
    }

    @Test fun requestCancellationRequiresConfirmationAndCanBeDismissed() {
        val repo = FakeBookingGateway()
        compose.setContent {
            MaterialTheme {
                CompositionLocalProvider(LocalNexusToast provides remember { NexusToastState() }) {
                    BookedRequestsScreen(initialRequestId = "request",
                        viewModel = remember { RequestsViewModel(repo) })
                }
            }
        }
        compose.onNode(hasScrollToIndexAction()).performScrollToNode(hasText("Cancel request"))
        compose.onNodeWithText("Cancel request").performClick()
        compose.onNodeWithText("Cancel this request?").assertIsDisplayed()
        compose.onNodeWithText("Keep request").performClick()
        compose.onNodeWithText("Cancel this request?").assertDoesNotExist()
        compose.runOnIdle { assertEquals(0, repo.cancellations) }
        compose.onNodeWithText("Cancel request").performClick()
        compose.onNode(hasText("Cancel request") and hasAnyAncestor(isDialog())).performClick()
        compose.runOnIdle { assertEquals(1, repo.cancellations) }
    }

    @androidx.compose.runtime.Composable
    private fun AccountUnderTest(backend: com.nexus.app.features.profile.FakeProfileBackend, settings: Boolean = false) {
        com.nexus.app.core.theme.NexusTheme {
            CompositionLocalProvider(LocalNexusToast provides remember { NexusToastState() }) {
                val vm = remember { com.nexus.app.features.profile.viewmodel.ProfileViewModel(backend.repository, com.nexus.app.core.session.SessionManager()) }
                ProfileScreen(user, initialSettings = settings, viewModel = vm)
            }
        }
    }

    private fun screenshot(name: String) {
        if (androidx.test.platform.app.InstrumentationRegistry.getArguments().getString("screenshots") != "true") return
        compose.waitForIdle()
        val instrumentation = androidx.test.platform.app.InstrumentationRegistry.getInstrumentation()
        val resolver = instrumentation.targetContext.contentResolver
        val values = android.content.ContentValues().apply {
            put(android.provider.MediaStore.Images.Media.DISPLAY_NAME, "nexus-$name.png")
            put(android.provider.MediaStore.Images.Media.MIME_TYPE, "image/png")
            put(android.provider.MediaStore.Images.Media.RELATIVE_PATH, "Pictures/Nexus")
        }
        val uri = requireNotNull(resolver.insert(android.provider.MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values))
        resolver.openOutputStream(uri)!!.use { instrumentation.uiAutomation.takeScreenshot().compress(android.graphics.Bitmap.CompressFormat.PNG, 100, it) }
    }
    @Test fun compactProfileEditsDetailsAndReturnsToOverview() {
        val backend = com.nexus.app.features.profile.FakeProfileBackend()
        compose.setContent { Box(Modifier.requiredSize(320.dp, 600.dp)) { AccountUnderTest(backend) } }
        compose.waitUntil(10_000) { compose.onAllNodesWithText("Test Client").fetchSemanticsNodes().isNotEmpty() }
        screenshot("profile")
        compose.onNodeWithText("Edit profile").performScrollTo().performClick()
        compose.onNodeWithText("Personal details").assertIsDisplayed()
        screenshot("personal-details")
        compose.onAllNodes(hasSetTextAction()).onFirst().performTextReplacement("Updated Client")
        compose.onNodeWithText("Save personal details").performScrollTo().performClick()
        compose.waitUntil(10_000) { backend.personalSaves == 1 && compose.onAllNodesWithText("My profile").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText("My profile").assertIsDisplayed()
        compose.onNodeWithText("Updated Client").assertIsDisplayed()
        backend.client.close()
    }

    @Test fun profileImageEditorCanBeCancelledWithoutUploading() {
        val backend = com.nexus.app.features.profile.FakeProfileBackend()
        compose.setContent { AccountUnderTest(backend) }
        compose.waitUntil(10_000) { compose.onAllNodesWithText("Test Client").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText("Edit banner").performClick()
        compose.onNodeWithText("Profile photo & banner").assertIsDisplayed()
        screenshot("profile-images")
        compose.onNodeWithText("Save changes").performScrollTo().assertIsNotEnabled()
        compose.onNodeWithContentDescription("Close editor").performScrollTo().performClick()
        compose.onNodeWithText("My profile").assertIsDisplayed()
        backend.client.close()
    }

    @Test fun settingsSessionSignOutRequiresConfirmation() {
        val backend = com.nexus.app.features.profile.FakeProfileBackend()
        compose.setContent { AccountUnderTest(backend, settings = true) }
        compose.waitUntil(10_000) { compose.onAllNodesWithText("Windows - Chrome").fetchSemanticsNodes().isNotEmpty() }
        screenshot("security")
        compose.onNodeWithText("Sign out").performScrollTo().performClick()
        compose.onNodeWithText("Sign out this device?").assertIsDisplayed()
        compose.onNodeWithText("Cancel").performClick()
        compose.runOnIdle { assertEquals(0, backend.revocations) }
        screenshot("security")
        compose.onNodeWithText("Sign out").performScrollTo().performClick()
        compose.onNode(hasText("Sign out") and hasAnyAncestor(isDialog())).performClick()
        compose.waitUntil(10_000) { backend.revocations == 1 }
        backend.client.close()
    }

    @Test fun settingsPreferencesPersistAndPasswordMismatchStaysLocal() {
        val backend = com.nexus.app.features.profile.FakeProfileBackend()
        compose.setContent { AccountUnderTest(backend, settings = true) }
        compose.onNodeWithText("Preferences").performClick()
        compose.waitUntil(10_000) { compose.onAllNodesWithText("Date and time").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText("Save preferences").assertIsNotEnabled()
        screenshot("preferences")
        compose.onAllNodesWithText("12-hour (AM/PM)").onFirst().performScrollTo().performClick()
        compose.onNodeWithText("24-hour").performClick()
        compose.onNodeWithText("Save preferences").performScrollTo().performClick()
        compose.waitUntil(10_000) { backend.preferences.timeFormat == "24h" && compose.onAllNodesWithText("Saving...").fetchSemanticsNodes().isEmpty() }
        compose.onNodeWithText("Security").performScrollTo().performClick()
        compose.onAllNodesWithText("Change password").onFirst().performScrollTo().performClick()
        screenshot("password")
        compose.onAllNodes(hasSetTextAction())[0].performTextInput("CurrentPassword1!")
        compose.onAllNodes(hasSetTextAction())[1].performTextInput("DifferentPassword1!")
        compose.onAllNodes(hasSetTextAction())[2].performTextInput("MismatchPassword1!")
        compose.onNodeWithText("Update password").performScrollTo().performClick()
        compose.onNodeWithText("Passwords do not match.").performScrollTo().assertIsDisplayed()
        compose.runOnIdle { assertEquals(0, backend.passwordSaves) }
        backend.client.close()
    }

    @Test fun accountMenuShowsIdentityAndDispatchesSettingsAndLogout() {
        var settings = 0
        var logouts = 0
        compose.setContent { MaterialTheme { NexusTopAppBar(accountName = "Test Client", accountEmail = "mobile@example.com", onSettingsClick = { settings++ }, onLogoutClick = { logouts++ }) } }
        compose.onNodeWithContentDescription("Open account menu").performClick()
        compose.onNodeWithText("mobile@example.com").assertIsDisplayed()
        screenshot("account-menu")
        compose.onNodeWithText("Settings").performClick()
        compose.runOnIdle { assertEquals(1, settings) }
        compose.onNodeWithContentDescription("Open account menu").performClick()
        compose.onNodeWithText("Log out").performClick()
        compose.runOnIdle { assertEquals(1, logouts) }
    }
    @Test fun compactLandscapeTabsDispatchEveryDestination() {
        val selected = mutableListOf<BottomTab>()
        compose.setContent {
            MaterialTheme {
                CompositionLocalProvider(LocalNexusLayout provides NexusLayout(short = true)) {
                    Box(Modifier.requiredSize(640.dp, 64.dp)) {
                        NexusBottomBar(BottomTab.DASHBOARD, { selected += it })
                    }
                }
            }
        }
        BottomTab.entries.forEach { compose.onNodeWithText(it.label).assertIsDisplayed().performClick() }
        compose.runOnIdle { assertEquals(BottomTab.entries.toList(), selected) }
    }

    @Test fun loadingPrimaryActionRejectsRepeatedTaps() {
        var clicks = 0
        compose.setContent { MaterialTheme { NexusButton("Submit", { clicks++ }, loading = true) } }
        compose.onNode(hasClickAction()).assertIsNotEnabled().performClick()
        compose.runOnIdle { assertEquals(0, clicks) }
    }
}
