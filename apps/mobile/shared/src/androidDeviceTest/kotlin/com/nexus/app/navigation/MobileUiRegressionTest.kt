package com.nexus.app.navigation

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.requiredSize
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.DisposableEffect
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
import com.nexus.app.features.booking.api.BookingGateway
import com.nexus.app.features.booking.model.*
import com.nexus.app.features.booking.viewmodel.BookingViewModel
import com.nexus.app.features.conversations.api.ClientCommunicationRepository
import com.nexus.app.features.conversations.components.ChatWorkflowForms
import com.nexus.app.features.projects.api.ProjectsRepository
import com.nexus.app.features.projects.screens.ProjectScreen
import com.nexus.app.features.projects.viewmodel.ProjectsViewModel
import com.nexus.app.features.services.screens.ServicesScreen
import com.nexus.app.features.booked_requests.screens.BookedRequestsScreen
import com.nexus.app.features.booked_requests.viewmodel.RequestsViewModel
import com.nexus.app.features.help.screens.HelpScreen
import com.nexus.app.features.workflow.api.WorkflowRepository
import com.nexus.app.features.workflow.model.*
import com.nexus.app.features.workflow.screens.WorkflowScreen
import com.nexus.app.features.workflow.viewmodel.WorkflowViewModel
import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.*
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.plugins.defaultRequest
import io.ktor.http.*
import io.ktor.http.content.TextContent
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Rule
import org.junit.Test
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue

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
        compose.setContent { MaterialTheme { NexusTopAppBar(title = "Dashboard", onChatClick = { chats++ }, notificationUnread = 6) } }
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
        compose.waitUntil(10_000) { backend.personalSaves == 1 && compose.onAllNodesWithText("Updated Client").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText("Edit profile").assertIsDisplayed()
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
        compose.onNodeWithText("Edit profile").assertIsDisplayed()
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
        compose.setContent { MaterialTheme { NexusTopAppBar(title = "Dashboard", accountName = "Test Client", accountEmail = "mobile@example.com", onSettingsClick = { settings++ }, onLogoutClick = { logouts++ }) } }
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

    @Test fun helpScreenDisplaysFaqsFiltersSearchAndNavigatesToMessages() {
        var openedMessages = 0
        compose.setContent {
            MaterialTheme {
                HelpScreen(onOpenMessages = { openedMessages++ })
            }
        }
        compose.onNodeWithText("Bookings and requests").assertIsDisplayed()
        compose.onNodeWithText("Choose a service or package from the Services page.").assertIsDisplayed()
        compose.onNodeWithText("What does my request status mean?").performScrollTo().performClick()
        compose.onNodeWithText("Pending review").assertIsDisplayed()
        compose.onNodeWithText("Under review").assertIsDisplayed()
        compose.onNodeWithText("Open messages").performScrollTo().performClick()
        compose.runOnIdle { assertEquals(1, openedMessages) }

        compose.onNode(hasSetTextAction()).performTextInput("unmatched-faq-query")
        compose.onNodeWithText("No results for “unmatched-faq-query” found.").assertIsDisplayed()
    }

    @Test fun requestDetailsOpenInMessagesDispatchesRequestId() {
        val repo = FakeBookingGateway()
        var openedRequestId: String? = null
        compose.setContent {
            MaterialTheme {
                CompositionLocalProvider(LocalNexusToast provides remember { NexusToastState() }) {
                    BookedRequestsScreen(
                        initialRequestId = "request",
                        onOpenMessages = { openedRequestId = it },
                        viewModel = remember { RequestsViewModel(repo) },
                    )
                }
            }
        }
        compose.onNode(hasScrollToIndexAction()).performScrollToNode(hasText("Open in Messages"))
        compose.onNodeWithText("Open in Messages").performClick()
        compose.runOnIdle { assertEquals("request", openedRequestId) }
    }

    @Test fun servicesCatalogPaginatesAtEightPerPageAndShowsTotalCount() {
        val nineServices = (1..9).map { index ->
            CatalogService(
                id = "service-$index",
                name = "Service $index",
                description = "Description $index",
                packages = listOf(ServicePackage("pkg-$index", "Starter")),
            )
        }
        val repo = object : BookingGateway by FakeBookingGateway() {
            override suspend fun services() = nineServices
        }
        compose.setContent {
            MaterialTheme {
                CompositionLocalProvider(LocalNexusToast provides remember { NexusToastState() }) {
                    ServicesScreen(viewModel = remember { BookingViewModel(repo) })
                }
            }
        }
        compose.waitUntil(10_000) { compose.onAllNodesWithText("Service 1").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText("All services (9)").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Service 9").assertDoesNotExist()
        compose.onNode(hasScrollToIndexAction()).performScrollToNode(hasText("Showing 1–8 of 9 services"))
        compose.onNodeWithText("Showing 1–8 of 9 services").assertIsDisplayed()
        compose.onNode(hasScrollToIndexAction()).performScrollToNode(hasText("Next"))
        compose.onNodeWithText("Next").performClick()
        compose.waitUntil(10_000) { compose.onAllNodesWithText("Service 9").fetchSemanticsNodes().isNotEmpty() }
        compose.onNode(hasScrollToIndexAction()).performScrollToNode(hasText("Showing 9–9 of 9 services"))
        compose.onNodeWithText("Showing 9–9 of 9 services").assertIsDisplayed()
        compose.onNode(hasScrollToIndexAction()).performScrollToNode(hasText("Previous"))
        compose.onNodeWithText("Previous").performClick()
        compose.waitUntil(10_000) { compose.onAllNodesWithText("Service 1").fetchSemanticsNodes().isNotEmpty() }
    }

    @Test fun switchingServicesWithFilledDraftRequiresConfirmation() {
        val serviceA = CatalogService("svc-a", "Service Alpha", packages = listOf(ServicePackage("pkg-a", "Starter")))
        val serviceB = CatalogService("svc-b", "Service Beta", packages = listOf(ServicePackage("pkg-b", "Pro")))
        val repo = object : BookingGateway by FakeBookingGateway() {
            override suspend fun services() = listOf(serviceA, serviceB)
            override suspend fun service(id: String) = if (id == "svc-a") serviceA else serviceB
        }
        val vm = BookingViewModel(repo)
        compose.setContent {
            MaterialTheme {
                CompositionLocalProvider(LocalNexusToast provides remember { NexusToastState() }) {
                    ServicesScreen(viewModel = vm)
                }
            }
        }
        compose.waitUntil(10_000) { compose.onAllNodesWithText("Service Alpha").fetchSemanticsNodes().isNotEmpty() }
        compose.runOnIdle {
            vm.chooseService(serviceA)
            vm.choosePackage("pkg-a")
            vm.updateField("goals", "Launch mobile campaign")
            vm.goTo(1)
        }
        compose.waitUntil(10_000) { compose.onAllNodesWithText("Service Beta").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText("Service Beta").performScrollTo().performClick()
        compose.waitUntil(10_000) { compose.onAllNodesWithText("Continue  \u2192").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText("Continue  \u2192").performScrollTo().performClick()

        compose.onNodeWithText("Start with a different service?").assertIsDisplayed()
        compose.onNodeWithText("Keep current draft").performClick()
        compose.onNodeWithText("Start with a different service?").assertDoesNotExist()
        compose.runOnIdle { assertEquals("svc-a", vm.state.value.service?.id) }

        compose.onNodeWithText("Service Beta").performScrollTo().performClick()
        compose.waitUntil(10_000) { compose.onAllNodesWithText("Continue  \u2192").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText("Continue  \u2192").performScrollTo().performClick()
        compose.onNodeWithText("Change service").performClick()
        compose.waitUntil(10_000) { vm.state.value.service?.id == "svc-b" }
        compose.onNodeWithText("Service Beta").performScrollTo().assertIsDisplayed()
    }

    @Test fun step4SpecialistProfileSheetShowsSocialsPortfolioAndSelection() {
        val service = CatalogService("svc-1", "Brand Design", packages = listOf(ServicePackage("pkg-1", "Starter")))
        val richProfile = SpecialistProfile(
            id = "spec-1",
            fullName = "Alex Rivera",
            position = "Principal Designer",
            bio = "10 years crafting product experiences.",
            specialties = listOf("UI Systems", "Mobile UX"),
            socialLinks = listOf(SpecialistSocialLink("LinkedIn", "https://linkedin.com/in/alex")),
            projects = listOf(
                SpecialistProject(
                    id = "port-1",
                    title = "Nexus Mobile Rebrand",
                    summary = "Unified design system across Android and iOS.",
                    contribution = "Led design tokens and component architecture.",
                    projectUrl = "https://exp.test/work/nexus",
                ),
            ),
        )
        val repo = object : BookingGateway by FakeBookingGateway() {
            override suspend fun services() = listOf(service)
            override suspend fun specialists(serviceId: String) = listOf(Specialist("spec-1", "Alex Rivera", "Principal Designer"))
            override suspend fun specialistProfile(serviceId: String, specialistId: String) = richProfile
        }
        val vm = BookingViewModel(repo)
        compose.setContent {
            MaterialTheme {
                CompositionLocalProvider(LocalNexusToast provides remember { NexusToastState() }) {
                    ServicesScreen(viewModel = vm)
                }
            }
        }
        compose.runOnIdle {
            vm.chooseService(service)
            vm.choosePackage("pkg-1")
            vm.updateField("goals", "Redesign")
            vm.updateField("requirements", "Design system")
            vm.updateField("expectedTimeline", "4 weeks")
            vm.goTo(4)
        }
        compose.waitUntil(10_000) { compose.onAllNodesWithText("View profile").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText("View profile").performScrollTo().performClick()

        compose.waitUntil(10_000) { compose.onAllNodesWithText("LinkedIn profile").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText("LinkedIn profile").assertIsDisplayed()
        compose.onNodeWithText("View project →").performScrollTo().performClick()
        compose.onNodeWithText("CONTRIBUTION").assertIsDisplayed()
        compose.onNodeWithText("Led design tokens and component architecture.").assertIsDisplayed()
        compose.onNodeWithText("Back to profile").performClick()

        compose.onNodeWithText("Choose Alex as preferred specialist").performClick()
        compose.runOnIdle { assertEquals("spec-1", vm.state.value.draft.preferredSpecialistId) }
    }

    @Test fun projectOverviewExposesNotesTeamTabsAndDeliverableDetails() {
        val client = HttpClient(MockEngine {
            respond(
                """{
                    "id":"proj-1",
                    "name":"Brand Launch",
                    "description":"Complete visual identity and launch kit.",
                    "status":"IN_PROGRESS",
                    "startDate":"2026-11-01T00:00:00Z",
                    "createdAt":"2026-11-01T00:00:00Z",
                    "request":{"id":"req-1","referenceNumber":"SR-2026-101","service":{"name":"Brand Design"}},
                    "progress":{"completed":2,"total":4},
                    "deliverables":[{
                        "id":"deliv-1",
                        "title":"Brand Guidelines v1",
                        "description":"Typography and color palette PDF.",
                        "sentToClientAt":"2026-11-10T00:00:00Z",
                        "workflowFile":{"id":"file-1","name":"guidelines.pdf","mimeType":"application/pdf","size":2048},
                        "clientReviews":[]
                    }],
                    "changeRequests":[]
                }""",
                headers = headersOf(HttpHeaders.ContentType, "application/json"),
            )
        }) {
            install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) }
            defaultRequest { url("https://nexus.test") }
        }
        compose.setContent {
            DisposableEffect(client) { onDispose { client.close() } }
            MaterialTheme {
                CompositionLocalProvider(LocalNexusToast provides remember { NexusToastState() }) {
                    val vm = remember { ProjectsViewModel(ProjectsRepository(client)) }
                    ProjectScreen(
                        id = "proj-1",
                        overview = true,
                        onBack = {},
                        onOpen = {},
                        onEdit = {},
                        onRequest = {},
                        onChat = {},
                        viewModel = vm,
                    )
                }
            }
        }
        compose.waitUntil(10_000) { compose.onAllNodesWithText("Brand Launch").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText("Latest notes").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Project team").performScrollTo().assertIsDisplayed()

        compose.onNodeWithText("Notes").performScrollTo().performClick()
        compose.onNodeWithText("Notes and project context shared with you.").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Complete visual identity and launch kit.").performScrollTo().assertIsDisplayed()

        compose.onNodeWithText("Team").performScrollTo().performClick()
        compose.onNodeWithText("People assigned to this project.").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("No team member assigned yet.").performScrollTo().assertIsDisplayed()

        compose.onNodeWithText("Deliverables").performScrollTo().performClick()
        compose.onNodeWithText("View deliverable details").performScrollTo().performClick()
        compose.onNodeWithText(".pdf").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("application/pdf").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("2 KB").performScrollTo().assertIsDisplayed()

        compose.onNodeWithText("Approve deliverable").performScrollTo().performClick()
        compose.onNodeWithText("Approve this deliverable?").assertIsDisplayed()
        compose.onNodeWithText("Cancel").performClick()
        compose.onNodeWithText("Approve this deliverable?").assertDoesNotExist()
    }

    @Test fun chatWorkflowFormsRenderQuotationBreakdownApprovalAndActiveProject() {
        val pendingApprovalWorkflow = ClientWorkflow(
            request = WorkflowRequest(id = "req-1", title = "Brand Package", referenceNumber = "SR-2026-200"),
            state = "CLIENT_APPROVAL",
            version = 3,
            nextAction = "Review and respond to the quotation.",
            permissions = ClientPermissions(isClient = true),
            quotations = listOf(
                Quotation(
                    id = "q-1",
                    version = 2,
                    status = "SENT",
                    scope = "Brand discovery and UI kit",
                    total = "45000.00",
                    currency = "PHP",
                    timeline = "4 weeks",
                    paymentTerms = "50% before kickoff",
                    validUntil = "2099-12-31T00:00:00Z",
                    lineItems = listOf(
                        QuotationLineItem("Brand Discovery", 1, "15000.00"),
                        QuotationLineItem("UI Kit", 2, "15000.00"),
                    ),
                    paymentDue = "22500.00",
                ),
            ),
        )
        val activeWorkflow = pendingApprovalWorkflow.copy(
            state = "ACTIVE_PROJECT",
            quotations = listOf(
                pendingApprovalWorkflow.quotations.single().copy(
                    status = "ACCEPTED",
                    lineItems = listOf(QuotationLineItem("Launch Scope", 1, "45000.00")),
                    paymentDue = "",
                ),
            ),
            approval = WorkflowApproval("q-1", "45000.00", "PHP", "2026-11-15T10:00:00Z", "client-1"),
            project = WorkflowProject("proj-99", "Brand Launch Workspace", "IN_PROGRESS"),
        )
        var openedProjectId: String? = null
        compose.setContent {
            MaterialTheme {
                Column(Modifier.verticalScroll(rememberScrollState())) {
                    ChatWorkflowForms(
                        workflow = pendingApprovalWorkflow,
                        busy = false,
                        selectedFileId = null,
                        action = { _, _ -> },
                        onDetails = {},
                        onDocuments = {},
                        onFile = {},
                    )
                    ChatWorkflowForms(
                        workflow = activeWorkflow,
                        busy = false,
                        selectedFileId = null,
                        action = { _, _ -> },
                        onDetails = {},
                        onDocuments = {},
                        onFile = {},
                        onOpenProject = { openedProjectId = it },
                    )
                }
            }
        }
        compose.onNodeWithText("Brand Discovery").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Due before commencement: PHP 22,500.00").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Accept").performScrollTo().assertIsEnabled()
        compose.onNode(isToggleable()).performScrollTo().performClick()
        compose.onNodeWithText("Accept").performScrollTo().assertIsNotEnabled()

        compose.onNodeWithText("Quotation formally accepted").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Your project is active").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("View Project").performScrollTo().performClick()
        compose.runOnIdle { assertEquals("proj-99", openedProjectId) }
    }

    @Test fun xenditSandboxCheckoutSubmitsAndDisplaysVerifiedBanner() {
        val dispatchedActions = mutableListOf<String>()
        val pendingJson = """{
            "request":{"id":"req-pay","title":"Web Build","serviceName":"Web Development"},
            "state":"AGREEMENT_PAYMENT_PENDING",
            "version":4,
            "nextAction":"Complete payment to continue.",
            "permissions":{"isClient":true},
            "payment":{"status":"PENDING","amount":"15000.00","currency":"PHP"}
        }"""
        val verifiedJson = """{
            "request":{"id":"req-pay","title":"Web Build","serviceName":"Web Development"},
            "state":"READY_FOR_ACTIVATION",
            "version":5,
            "nextAction":"Ready for project activation.",
            "permissions":{"isClient":true},
            "payment":{"status":"VERIFIED","amount":"15000.00","currency":"PHP","reference":"XENDIT-SANDBOX-999"}
        }"""
        val client = HttpClient(MockEngine { request ->
            val path = request.url.encodedPath
            when {
                path.endsWith("/actions") -> {
                    val body = Json.parseToJsonElement((request.body as TextContent).text).jsonObject
                    dispatchedActions += body.getValue("type").jsonPrimitive.content
                    respond(verifiedJson, headers = headersOf(HttpHeaders.ContentType, "application/json"))
                }
                path.startsWith("/api/request-workflows/") ->
                    respond(pendingJson, headers = headersOf(HttpHeaders.ContentType, "application/json"))
                else -> respond("{}", headers = headersOf(HttpHeaders.ContentType, "application/json"))
            }
        }) {
            install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) }
            defaultRequest { contentType(ContentType.Application.Json); url("https://nexus.test") }
        }
        compose.setContent {
            DisposableEffect(client) { onDispose { client.close() } }
            MaterialTheme {
                val vm = remember { WorkflowViewModel(WorkflowRepository(client)) }
                val commRepo = remember { ClientCommunicationRepository(client) }
                WorkflowScreen(
                    id = "req-pay",
                    onBack = {},
                    initialDocuments = true,
                    viewModel = vm,
                    repository = commRepo,
                )
            }
        }
        compose.waitUntil(10_000) { compose.onAllNodesWithText("Pay securely").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText("Test mode").assertIsDisplayed()
        compose.onNodeWithText("4000 0000 0000 0002").performScrollTo().assertIsDisplayed()

        compose.onNodeWithText("Submit payment proof instead").performScrollTo().performClick()
        compose.onNodeWithText("Payment reference").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Use sandbox card checkout instead").performScrollTo().performClick()

        compose.onNodeWithText("Pay PHP 15,000.00").performScrollTo().performClick()
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("Payment successful. Your sandbox card payment was automatically verified.")
                .fetchSemanticsNodes().isNotEmpty()
        }
        compose.runOnIdle { assertEquals(listOf("COMPLETE_SANDBOX_PAYMENT"), dispatchedActions) }
        assertTrue(dispatchedActions.contains("COMPLETE_SANDBOX_PAYMENT"))
    }
}
