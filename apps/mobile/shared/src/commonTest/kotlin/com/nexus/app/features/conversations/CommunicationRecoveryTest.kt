package com.nexus.app.features.conversations

import androidx.lifecycle.viewModelScope
import com.nexus.app.core.files.*
import com.nexus.app.features.conversations.api.*
import com.nexus.app.features.conversations.viewmodel.ConversationsViewModel
import com.nexus.app.features.notifications.model.WorkflowNotification
import com.nexus.app.features.notifications.viewmodel.NotificationsViewModel
import com.nexus.app.features.workflow.api.WorkflowRepository
import com.nexus.app.features.workflow.viewmodel.WorkflowViewModel
import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.*
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.plugins.defaultRequest
import io.ktor.http.*
import io.ktor.http.content.TextContent
import io.ktor.serialization.kotlinx.json.json
import kotlinx.coroutines.*
import kotlinx.coroutines.test.*
import kotlinx.coroutines.flow.first
import kotlinx.serialization.json.*
import kotlin.test.*

@OptIn(ExperimentalCoroutinesApi::class)
class CommunicationRecoveryTest {
    @BeforeTest fun setup() { Dispatchers.setMain(UnconfinedTestDispatcher()) }
    @AfterTest fun teardown() { Dispatchers.resetMain() }
    @Test fun failedSendRetriesWithTheSameIdAndOnlyOneVisibleMessage() = runTest {
        val bodies = mutableListOf<JsonObject>()
        val client = client { request ->
            when {
                request.url.encodedPath.endsWith("/messages") -> {
                    val body = Json.parseToJsonElement((request.body as TextContent).text).jsonObject
                    bodies.add(body)
                    if (bodies.size == 1) throw Exception("Temporary disconnect")
                    respond("""{"message":{"id":"server-id","body":"Hello","clientMessageId":${body.getValue("clientMessageId")},"sender":{"id":"client","fullName":"Client"}}}""", headers = jsonHeaders)
                }
                request.url.encodedPath.endsWith("/events") -> awaitCancellation()
                request.url.encodedPath.endsWith("/read") -> respond("{}", headers = jsonHeaders)
                else -> respond("""{"canSend":true,"archived":false,"messages":[]}""", headers = jsonHeaders)
            }
        }
        val vm = ConversationsViewModel(ClientCommunicationRepository(client))
        try {
            vm.open("request"); vm.foreground(true)
            vm.state.first { it.history?.canSend == true }
            vm.send("Hello")
            vm.state.first { it.pending.any { row -> row.failed } }
            assertTrue(vm.state.value.pending.single().failed)
            vm.retry(vm.state.value.pending.single())
            vm.state.first { it.messages.isNotEmpty() && it.pending.isEmpty() }
            assertEquals(bodies[0]["clientMessageId"], bodies[1]["clientMessageId"])
            assertEquals(1, vm.state.value.messages.size)
            assertTrue(vm.state.value.pending.isEmpty())
        } finally { vm.foreground(false); vm.viewModelScope.cancel(); client.close() }
    }
    @Test fun attachmentsLoadAcrossBookingsRefreshAndDownloadFromTheirOwnBooking() = runTest {
        var received = false
        var downloadPath = ""
        val client = client { request ->
            val path = request.url.encodedPath
            when {
                path.endsWith("/events") -> awaitCancellation()
                path.endsWith("/read") -> respond("{}", headers = jsonHeaders)
                path.contains("/files/") -> {
                    downloadPath = path
                    respond("document", headers = headersOf(HttpHeaders.ContentType, "text/plain"))
                }
                path.startsWith("/api/request-workflows/") -> {
                    val id = path.substringAfterLast('/')
                    val files = if (id == "second" && !received) "[]" else """[{"id":"file-$id","name":"brief.txt","mimeType":"text/plain","size":8,"uploaderId":"${if (id == "first") "client" else "head"}","createdAt":"2026-11-07T00:00:00Z"}]"""
                    respond("""{"request":{"id":"$id","serviceName":"Design"},"state":"CONSULTATION","version":1,"nextAction":"","permissions":{"isClient":true},"files":$files}""", headers = jsonHeaders)
                }
                else -> respond("""{"selectedBookingId":"first","conversation":{"bookings":[{"id":"first"},{"id":"second"}]},"messages":[]}""", headers = jsonHeaders)
            }
        }
        val vm = ConversationsViewModel(ClientCommunicationRepository(client), workflows = WorkflowRepository(client))
        try {
            vm.open("conversation"); vm.foreground(true)
            vm.state.first { it.attachments.size == 1 }
            assertEquals("client", vm.state.value.attachments.single().file.uploaderId)
            received = true
            vm.refreshAttachments()
            vm.state.first { it.attachments.size == 2 }
            val attachment = vm.state.value.attachments.first { it.requestId == "second" }
            assertEquals("head", attachment.file.uploaderId)
            assertEquals("document", vm.attachmentContent(attachment).bytes.decodeToString())
            assertEquals("/api/request-workflows/second/files/file-second", downloadPath)
            vm.open("other")
            assertTrue(vm.state.value.attachments.isEmpty())
        } finally { vm.foreground(false); vm.viewModelScope.cancel(); client.close() }
    }

    @Test fun accessDeniedNotificationNeverNavigates() = runTest {
        val client = client { respond("""{"error":"Not found"}""", HttpStatusCode.NotFound, jsonHeaders) }
        val vm = NotificationsViewModel(ClientCommunicationRepository(client))
        var navigated = false
        try {
            vm.open(WorkflowNotification("notification", "private-request", "Update", "now")) { navigated = true }
            vm.state.first { it.error != null }
            assertFalse(navigated)
            assertNotNull(vm.state.value.error)
        } finally { vm.viewModelScope.cancel(); client.close() }
    }
    @Test fun staleWorkflowRefreshesWithoutReplayingAction() = runTest {
        var posts = 0
        var reads = 0
        val client = client { request ->
            if (request.method == HttpMethod.Post) {
                posts++
                respond("""{"error":"Stale version"}""", HttpStatusCode.Conflict, jsonHeaders)
            } else {
                reads++
                respond("""{"request":{"id":"request"},"state":"CONSULTATION","version":$reads,"nextAction":"Review","permissions":{"isClient":true}}""", headers = jsonHeaders)
            }
        }
        val vm = WorkflowViewModel(WorkflowRepository(client))
        try {
            vm.open("request")
            vm.state.first { (it.workflow != null || it.error != null) && !it.busy }
            assertNotNull(vm.state.value.workflow, vm.state.value.error)
            vm.action("CANCEL", mapOf("note" to "Cancel"))
            vm.state.first { it.error != null && !it.busy }
            assertEquals(1, posts)
            assertEquals(2, reads)
            assertEquals(2, vm.state.value.workflow?.version)
            assertTrue(vm.state.value.error!!.contains("changed"))
        } finally { vm.viewModelScope.cancel(); client.close() }
    }
    @Test fun fileValidationRejectsOversizedAndMismatchedFiles() {
        assertFailsWith<IllegalArgumentException> { validateFile(SelectedFile("photo.pdf", "image/png", byteArrayOf(1))) }
        assertFailsWith<IllegalArgumentException> { validateFile(SelectedFile("a.txt", "text/plain", ByteArray(5 * 1024 * 1024 + 1))) }
        assertFailsWith<IllegalArgumentException> { validateFile(SelectedFile("../a.txt", "text/plain", byteArrayOf(1))) }
        validateFile(SelectedFile("a.txt", "text/plain", byteArrayOf(65)))
    }
    private val jsonHeaders = headersOf(HttpHeaders.ContentType, "application/json")
    private fun client(handler: MockRequestHandler) = HttpClient(MockEngine(handler)) {
        defaultRequest { contentType(ContentType.Application.Json) }
        install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true; encodeDefaults = true }) }
    }
}
