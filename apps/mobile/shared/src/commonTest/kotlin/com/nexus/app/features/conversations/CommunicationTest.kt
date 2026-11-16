package com.nexus.app.features.conversations

import androidx.lifecycle.viewModelScope
import com.nexus.app.features.conversations.model.*
import com.nexus.app.features.conversations.api.*
import com.nexus.app.features.conversations.viewmodel.ConversationsViewModel
import com.nexus.app.features.help.model.filterFaqGroups
import com.nexus.app.features.help.model.helpFaqGroups
import com.nexus.app.features.workflow.api.WorkflowRepository
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
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
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
    private fun client(handler: MockRequestHandler) = HttpClient(MockEngine(handler)) {
        defaultRequest { contentType(ContentType.Application.Json) }
        install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true; encodeDefaults = true }) }
    }
}
