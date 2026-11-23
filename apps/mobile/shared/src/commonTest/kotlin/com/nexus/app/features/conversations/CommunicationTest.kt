package com.nexus.app.features.conversations

import androidx.lifecycle.viewModelScope
import com.nexus.app.features.conversations.model.*
import com.nexus.app.features.conversations.api.*
import com.nexus.app.features.conversations.viewmodel.ConversationsViewModel
import com.nexus.app.features.booking.model.RequestRecord
import com.nexus.app.features.booking.model.RequestService
import com.nexus.app.features.booking.model.statusLabel
import com.nexus.app.features.help.model.filterFaqGroups
import com.nexus.app.features.help.model.helpFaqGroups
import com.nexus.app.features.notifications.model.NotificationFeed
import com.nexus.app.features.notifications.model.WorkflowNotification
import com.nexus.app.features.notifications.viewmodel.NotificationsViewModel
import com.nexus.app.features.workflow.api.WorkflowRepository
import com.nexus.app.features.workflow.model.isVerifiedSandboxPayment
import io.ktor.client.plugins.defaultRequest
import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.*
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.*
import io.ktor.http.*
import io.ktor.http.content.TextContent
import io.ktor.serialization.kotlinx.json.json
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.yield
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.json.*
import kotlin.test.*

@OptIn(ExperimentalCoroutinesApi::class)
class CommunicationTest {
    @BeforeTest fun setup() { Dispatchers.setMain(UnconfinedTestDispatcher()) }
    @AfterTest fun teardown() { Dispatchers.resetMain() }
    @Test fun ambiguousSendReconcilesByStableClientId() {
        val pending = PendingMessage("client-id", "Hello", failed = true)
        val message = ChatMessage("server-id", "Hello", "client-id", "2026-11-06T00:00:00Z")
        val merged = mergeMessages(listOf(message), listOf(message.copy(editedAt = "now")))
        assertEquals(1, merged.size)
        assertEquals("now", merged.single().editedAt)
        assertTrue(reconcilePending(listOf(pending), merged).isEmpty())
    }
    @Test fun attachmentTimelineInterleavesMessagesAndDeduplicatesFiles() {
        val file = com.nexus.app.features.workflow.model.WorkflowFile("file", "brief.pdf", "application/pdf", 100, "head", "2026-11-07T00:01:00Z")
        val attachment = ConversationAttachment("booking", "Design", file)
        val entries = conversationTimeline(listOf(
            ChatMessage("after", createdAt = "2026-11-07T00:02:00Z"),
            ChatMessage("before", createdAt = "2026-11-07T00:00:00Z"),
        ), listOf(attachment, attachment))
        assertEquals(listOf("message-before", "file-booking-file", "message-after"), entries.map { it.id })
    }
    @Test fun historyPagesSortAndDeduplicate() {
        val older = ChatMessage("a", "Earlier", createdAt = "2026-11-05")
        val newer = ChatMessage("b", "Later", createdAt = "2026-11-06")
        assertEquals(listOf(older, newer), mergeMessages(listOf(newer), listOf(older, newer)))
    }
    @Test fun conversationsUseAuthoritativeViewAndCursor() = runTest {
        var path = ""
        val client = client { request ->
            path = request.url.encodedPath
            assertEquals("archived", request.url.parameters["view"])
            assertEquals("cursor", request.url.parameters["before"])
            respond("""{"conversations":[],"nextCursor":null,"unreadCount":3}""", headers = headersOf(HttpHeaders.ContentType, "application/json"))
        }
        client.use { assertEquals(3, ClientCommunicationRepository(it).conversations(true, "cursor").unreadCount) }
        assertEquals("/api/request-conversations", path)
    }
    @Test fun workflowUsesExpectedVersionAndActionIdWithoutAutomaticReplay() = runTest {
        var calls = 0
        val client = client { request ->
            calls++
            val body = Json.parseToJsonElement((request.body as TextContent).text).jsonObject
            assertEquals(7, body.getValue("expectedVersion").jsonPrimitive.int)
            assertEquals("stable-action", body.getValue("actionId").jsonPrimitive.content)
            respond("""{"error":"Stale version"}""", HttpStatusCode.Conflict, headersOf(HttpHeaders.ContentType, "application/json"))
        }
        client.use {
            val error = assertFailsWith<CommunicationException> { WorkflowRepository(it).action("request", 7, "stable-action", "CANCEL", mapOf("note" to "Cancelled")) }
            assertEquals(409, error.status)
        }
        assertEquals(1, calls)
    }
    @Test fun notificationDenialCannotBecomeEmptySuccess() = runTest {
        client { respond("""{"error":"Notification not found"}""", HttpStatusCode.NotFound, headersOf(HttpHeaders.ContentType, "application/json")) }.use {
            assertEquals(404, assertFailsWith<CommunicationException> { ClientCommunicationRepository(it).readNotification("hidden") }.status)
        }
    }
    @Test fun helpContentFiltersByQuestionAnswerAndStatusBadgeLabel() {
        assertEquals(2, helpFaqGroups.size)
        val statusQuestion = helpFaqGroups.first().questions.first { it.statuses.isNotEmpty() }
        assertEquals(listOf("SUBMITTED", "UNDER_REVIEW"), statusQuestion.statuses)

        val byStatusLabel = filterFaqGroups("Pending review")
        assertEquals(1, byStatusLabel.size)
        assertEquals("What does my request status mean?", byStatusLabel.single().questions.single().title)

        val byQuotation = filterFaqGroups("reschedule")
        assertEquals(1, byQuotation.size)
        assertEquals("Quotations and consultations", byQuotation.single().title)

        assertTrue(filterFaqGroups("nonexistent-topic-xyz").isEmpty())
    }
    @Test fun workflowNotificationsDeserializeNullableAndDefaultRoutingFields() {
        val feed = Json.decodeFromString<NotificationFeed>(
            """{"notifications":[{"id":"project-notice","requestId":null,"summary":"Project activated","createdAt":"2026-11-17T00:00:00Z","type":"PROJECT_ACTIVATED","entityId":"project-1"}],"unreadCount":1}"""
        )
        val project = feed.notifications.single()
        assertNull(project.requestId)
        assertEquals("PROJECT_ACTIVATED", project.type)
        assertEquals("project-1", project.entityId)

        val legacy = Json.decodeFromString<WorkflowNotification>(
            """{"id":"legacy-notice","summary":"Request updated","createdAt":"2026-11-17T00:00:00Z"}"""
        )
        assertNull(legacy.requestId)
        assertNull(legacy.type)
        assertNull(legacy.entityId)
    }
    @Test fun projectNotificationsRouteByEntityIdWithoutRequestAccessChecks() = runTest {
        val reads = mutableListOf<String>()
        val requestAccessChecks = mutableListOf<String>()
        val client = client { request ->
            val path = request.url.encodedPath
            when {
                request.method == HttpMethod.Patch && path.endsWith("/read") -> {
                    reads.add(path)
                    respond("""{"ok":true}""", headers = jsonHeaders)
                }
                path == "/api/request-workflows/notifications" ->
                    respond("""{"notifications":[],"unreadCount":0}""", headers = jsonHeaders)
                path.startsWith("/api/request-workflows/") -> {
                    requestAccessChecks.add(path)
                    respond("{}", headers = jsonHeaders)
                }
                else -> error("Unexpected path: $path")
            }
        }
        val vm = NotificationsViewModel(ClientCommunicationRepository(client))
        val types = listOf(
            "PROJECT_ACTIVATED",
            "PROJECT_CANCELLATION_REQUESTED",
            "PROJECT_CANCELLATION_APPROVED",
            "PROJECT_CANCELLATION_DECLINED",
        )
        try {
            types.forEachIndexed { index, type ->
                val projectId = "project-$index"
                val navigated = CompletableDeferred<String>()
                var requestTarget: String? = null
                vm.open(
                    WorkflowNotification(
                        id = "notice-$index",
                        summary = "Project update",
                        createdAt = "2026-11-17T00:00:0${index}Z",
                        type = type,
                        entityId = projectId,
                    ),
                    onProject = { navigated.complete(it) },
                    onRequest = { requestTarget = it },
                )
                assertEquals(projectId, navigated.await())
                assertNull(requestTarget)
                yield()
            }

            val groupedNavigation = CompletableDeferred<String>()
            vm.openGroup(
                listOf(
                    WorkflowNotification(
                        id = "group-older",
                        summary = "Cancellation requested",
                        createdAt = "2026-11-17T01:00:00Z",
                        type = "PROJECT_CANCELLATION_REQUESTED",
                        entityId = "project-group",
                    ),
                    WorkflowNotification(
                        id = "group-latest",
                        summary = "Cancellation approved",
                        createdAt = "2026-11-17T02:00:00Z",
                        type = "PROJECT_CANCELLATION_APPROVED",
                        entityId = "project-group",
                    ),
                ),
                onProject = { groupedNavigation.complete(it) },
                onRequest = { fail("Project groups must not use request routing") },
            )
            assertEquals("project-group", groupedNavigation.await())
            assertTrue(reads.any { it.endsWith("/group-older/read") })
            assertTrue(reads.any { it.endsWith("/group-latest/read") })
            assertTrue(requestAccessChecks.isEmpty())
        } finally {
            vm.viewModelScope.cancel()
            client.close()
        }
    }
    @Test fun requestNotificationsStillCheckAccessBeforeNavigation() = runTest {
        val calls = mutableListOf<String>()
        val client = client { request ->
            val path = request.url.encodedPath
            when {
                path == "/api/request-workflows/request-1" -> {
                    calls.add("access")
                    respond("{}", headers = jsonHeaders)
                }
                request.method == HttpMethod.Patch && path.endsWith("/notice-1/read") -> {
                    calls.add("read")
                    respond("""{"ok":true}""", headers = jsonHeaders)
                }
                path == "/api/request-workflows/notifications" ->
                    respond("""{"notifications":[],"unreadCount":0}""", headers = jsonHeaders)
                else -> error("Unexpected path: $path")
            }
        }
        val vm = NotificationsViewModel(ClientCommunicationRepository(client))
        val navigated = CompletableDeferred<String>()
        try {
            vm.open(WorkflowNotification("notice-1", "request-1", "Update", "now")) {
                navigated.complete(it)
            }
            assertEquals("request-1", navigated.await())
            assertEquals(listOf("access", "read"), calls)
        } finally {
            vm.viewModelScope.cancel()
            client.close()
        }
    }
    @Test fun unroutableNotificationDoesNotReadOrNavigate() = runTest {
        var repositoryCalled = false
        val client = client {
            repositoryCalled = true
            respond("{}", headers = jsonHeaders)
        }
        val vm = NotificationsViewModel(ClientCommunicationRepository(client))
        var navigated = false
        try {
            vm.open(WorkflowNotification(id = "orphan", summary = "Update", createdAt = "now")) {
                navigated = true
            }
            vm.state.first { it.error != null }
            assertEquals("Unable to open notification", vm.state.value.error)
            assertFalse(repositoryCalled)
            assertFalse(navigated)
        } finally {
            vm.viewModelScope.cancel()
            client.close()
        }
    }
    @Test fun activatedAndConcludedStatusesUseLatestLifecycleRules() {
        assertEquals("Activated", statusLabel("ACTIVATED"))
        assertEquals("Concluded", statusLabel("CONCLUDED"))

        val service = RequestService("service", "Service")
        setOf("CANCELLED", "CLOSED", "CONCLUDED", "ACTIVATED").forEach { status ->
            assertFalse(RequestRecord(status.lowercase(), status = status, service = service).canCancel)
        }
        assertTrue(RequestRecord("review", status = "UNDER_REVIEW", service = service).canCancel)
    }
    @Test fun projectConversationsToggleActiveArchivedAndSendMessages() = runTest {
        val seenViews = mutableListOf<String>()
        var readCalled = false
        val client = client { request ->
            val path = request.url.encodedPath
            when {
                path == "/api/request-conversations" -> {
                    val view = request.url.parameters["view"] ?: "active"
                    respond("""{"conversations":[{"id":"req-1","title":"Website","status":"ACTIVE"}],"nextCursor":null,"unreadCount":1}""", headers = headersOf(HttpHeaders.ContentType, "application/json"))
                }
                path == "/api/project-conversations" -> {
                    val view = request.url.parameters["view"] ?: "active"
                    seenViews.add(view)
                    val archived = view == "archived"
                    respond(
                        """{"conversations":[{"id":"proj-$view","name":"Project $view","archived":$archived,"isGroup":true,"participants":[{"id":"staff-1","fullName":"Lead Dev"}],"updatedAt":"2026-11-16T00:00:00Z","unreadCount":${if (archived) 0 else 2}}],"nextCursor":null,"unreadCount":${if (archived) 0 else 2}}""",
                        headers = headersOf(HttpHeaders.ContentType, "application/json"),
                    )
                }
                path == "/api/project-conversations/proj-active" -> {
                    respond(
                        """{"canSend":true,"archived":false,"conversation":{"fullName":"Project active","position":"Project group chat"},"participants":[{"id":"staff-1","fullName":"Lead Dev"}],"messages":[]}""",
                        headers = headersOf(HttpHeaders.ContentType, "application/json"),
                    )
                }
                path == "/api/project-conversations/proj-active/read" -> {
                    readCalled = true
                    respond("""{"ok":true,"unreadCount":0,"conversationUnreadCount":0}""", headers = headersOf(HttpHeaders.ContentType, "application/json"))
                }
                path == "/api/project-conversations/proj-active/messages" -> {
                    val body = Json.parseToJsonElement((request.body as TextContent).text).jsonObject
                    val clientId = body.getValue("clientMessageId").jsonPrimitive.content
                    val text = body.getValue("body").jsonPrimitive.content
                    respond(
                        """{"message":{"id":"msg-1","body":"$text","clientMessageId":"$clientId","createdAt":"2026-11-16T01:00:00Z","sender":{"id":"client","fullName":"Client"}}}""",
                        HttpStatusCode.Created,
                        headersOf(HttpHeaders.ContentType, "application/json"),
                    )
                }
                else -> error("Unexpected path: $path")
            }
        }
        val vm = ConversationsViewModel(ClientCommunicationRepository(client))
        try {
            vm.refresh(archived = false)
            vm.state.first { !it.loading && it.projectPage.conversations.isNotEmpty() }
            assertEquals("proj-active", vm.state.value.projectPage.conversations.single().id)
            assertFalse(vm.state.value.archived)

            vm.setArchived(true)
            vm.state.first { !it.loading && it.archived && it.projectPage.conversations.firstOrNull()?.id == "proj-archived" }
            assertEquals(listOf("active", "archived"), seenViews)

            vm.openProject("proj-active")
            vm.state.first { !it.projectLoading && it.projectHistory?.canSend == true }
            assertTrue(readCalled)

            vm.sendProject("Milestone update check")
            vm.state.first { it.projectMessages.size == 1 && it.projectPending.isEmpty() }
            assertEquals("Milestone update check", vm.state.value.projectMessages.single().body)
        } finally {
            vm.viewModelScope.cancel()
            client.close()
        }
    }
    @Test fun xenditSandboxCardFormattingAndValidationRules() {
        assertEquals(
            "4000 0000 0000 0002",
            com.nexus.app.features.workflow.model.formatSandboxCardNumber("4000-0000-0000-0002-9999"),
        )
        assertEquals(
            "12/30",
            com.nexus.app.features.workflow.model.formatSandboxExpiry("12309"),
        )
        assertNull(
            com.nexus.app.features.workflow.model.validateSandboxCard(
                cardholder = "Nexus Test Customer",
                cardNumber = "4000 0000 0000 0002",
                expiry = "12/30",
                cvc = "123",
                todayYear = 2026,
                todayMonth = 11,
            ),
        )
        assertEquals(
            "Use the prefilled sandbox card number for this prototype.",
            com.nexus.app.features.workflow.model.validateSandboxCard(
                cardholder = "Nexus Test Customer",
                cardNumber = "4111 1111 1111 1111",
                expiry = "12/30",
                cvc = "123",
                todayYear = 2026,
                todayMonth = 11,
            ),
        )
        assertEquals(
            "Enter a valid expiry date in MM/YY format.",
            com.nexus.app.features.workflow.model.validateSandboxCard(
                cardholder = "Nexus Test Customer",
                cardNumber = "4000 0000 0000 0002",
                expiry = "13/30",
                cvc = "123",
                todayYear = 2026,
                todayMonth = 11,
            ),
        )
        assertEquals(
            "Enter a future expiry date.",
            com.nexus.app.features.workflow.model.validateSandboxCard(
                cardholder = "Nexus Test Customer",
                cardNumber = "4000 0000 0000 0002",
                expiry = "10/26",
                cvc = "123",
                todayYear = 2026,
                todayMonth = 11,
            ),
        )
        assertEquals(
            "Enter the 3-digit sandbox security code.",
            com.nexus.app.features.workflow.model.validateSandboxCard(
                cardholder = "Nexus Test Customer",
                cardNumber = "4000 0000 0000 0002",
                expiry = "12/30",
                cvc = "12",
                todayYear = 2026,
                todayMonth = 11,
            ),
        )
        assertEquals(
            "Enter the cardholder name.",
            com.nexus.app.features.workflow.model.validateSandboxCard(
                cardholder = "   ",
                cardNumber = "4000 0000 0000 0002",
                expiry = "12/30",
                cvc = "123",
                todayYear = 2026,
                todayMonth = 11,
            ),
        )

        val verifiedSandbox = com.nexus.app.features.workflow.model.Payment(
            status = "VERIFIED",
            amount = "15000.00",
            currency = "PHP",
            reference = "XENDIT-SANDBOX-12345",
        )
        val manualVerified = verifiedSandbox.copy(reference = "BANK-REF-001")
        assertTrue(verifiedSandbox.isVerifiedSandboxPayment())
        assertFalse(manualVerified.isVerifiedSandboxPayment())
    }
    @Test fun requestMeetingRescheduleSendsExpectedPatchPayload() = runTest {
        var patchPath = ""
        var patchBody: JsonObject? = null
        val client = client { request ->
            assertEquals(HttpMethod.Patch, request.method)
            patchPath = request.url.encodedPath
            patchBody = Json.parseToJsonElement((request.body as TextContent).text).jsonObject
            respond(
                """{"meeting":{"id":"meet-1","startsAt":"2026-11-25T09:00:00Z","endsAt":"2026-11-25T10:00:00Z","location":"https://meet.exp.test/room","notes":"Scope alignment","status":"SCHEDULED","version":3,"proposedStartsAt":"2026-11-26T14:00:00Z","rescheduleNote":"Need afternoon slot"}}""",
                headers = jsonHeaders,
            )
        }
        client.use {
            val meeting = ConversationMeeting(
                id = "meet-1",
                startsAt = "2026-11-25T09:00:00Z",
                endsAt = "2026-11-25T10:00:00Z",
                location = "https://meet.exp.test/room",
                notes = "Scope alignment",
                status = "SCHEDULED",
                version = 2,
            )
            val updated = ClientCommunicationRepository(it).requestMeetingReschedule(
                id = "conv-1",
                meeting = meeting,
                startsAt = "2026-11-26T14:00:00Z",
                note = "  Need afternoon slot  ",
            )
            assertEquals("/api/request-conversations/conv-1/meetings/meet-1", patchPath)
            assertEquals("REQUEST_RESCHEDULE", patchBody?.getValue("type")?.jsonPrimitive?.content)
            assertEquals(2, patchBody?.getValue("expectedVersion")?.jsonPrimitive?.int)
            assertEquals("2026-11-26T14:00:00Z", patchBody?.getValue("startsAt")?.jsonPrimitive?.content)
            assertEquals("Need afternoon slot", patchBody?.getValue("note")?.jsonPrimitive?.content)
            assertEquals(3, updated.version)
            assertEquals("2026-11-26T14:00:00Z", updated.proposedStartsAt)
            assertEquals("Need afternoon slot", updated.rescheduleNote)
        }
    }
    @Test fun quotationAndSpecialistProfileDeserializeExtendedParityFields() {
        val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }
        val workflow = json.decodeFromString<com.nexus.app.features.workflow.model.ClientWorkflow>(
            """{
                "request":{"id":"req-1","title":"Brand Redesign","referenceNumber":"SR-2026-0099","serviceName":"Branding"},
                "state":"AGREEMENT_PAYMENT_PENDING",
                "version":4,
                "nextAction":"Complete payment",
                "permissions":{"isClient":true},
                "quotations":[{
                    "id":"quote-1","version":2,"status":"ACCEPTED","scope":"Full brand identity",
                    "deliverables":["Logo","Guidelines"],"total":"45000.00","currency":"PHP",
                    "timeline":"4 weeks","paymentTerms":"50% downpayment","validUntil":"2026-12-31T00:00:00Z",
                    "lineItems":[{"description":"Brand Discovery","quantity":1,"unitPrice":"15000.00"},{"description":"Visual System","quantity":2,"unitPrice":"15000.00"}],
                    "paymentDue":"22500.00","decisionNote":"Approved by client"
                }],
                "approval":{"quotationId":"quote-1","amount":"45000.00","currency":"PHP","approvedAt":"2026-11-20T08:30:00Z","approvedById":"client-1"}
            }"""
        )
        val quote = workflow.quotations.single()
        assertEquals(2, quote.lineItems.size)
        assertEquals("Brand Discovery", quote.lineItems.first().description)
        assertEquals("22500.00", quote.paymentDue)
        assertEquals("Approved by client", quote.decisionNote)
        assertEquals("quote-1", workflow.approval?.quotationId)
        assertEquals("45000.00", workflow.approval?.amount)

        val profile = json.decodeFromString<com.nexus.app.features.booking.model.SpecialistProfile>(
            """{
                "id":"spec-1","fullName":"Maya Santos","position":"Lead Designer",
                "socialLinks":[{"platform":"LinkedIn","url":"https://linkedin.com/in/mayasantos"}],
                "projects":[{"id":"p-1","title":"Fintech App","summary":"Mobile UX","contribution":"Lead UI/UX","projectUrl":"https://exp.test/work/fintech"}]
            }"""
        )
        assertEquals(1, profile.socialLinks.size)
        assertEquals("LinkedIn", profile.socialLinks.single().platform)
        assertEquals("Lead UI/UX", profile.projects.single().contribution)
        assertEquals("https://exp.test/work/fintech", profile.projects.single().projectUrl)
    }
    private val jsonHeaders = headersOf(HttpHeaders.ContentType, "application/json")
    private fun client(handler: MockRequestHandler) = HttpClient(MockEngine(handler)) {
        defaultRequest { contentType(ContentType.Application.Json) }
        install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true; encodeDefaults = true }) }
    }
}
