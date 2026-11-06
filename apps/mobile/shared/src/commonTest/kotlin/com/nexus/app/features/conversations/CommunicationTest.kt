package com.nexus.app.features.conversations

import com.nexus.app.features.conversations.model.*
import com.nexus.app.features.conversations.api.*
import com.nexus.app.features.workflow.api.WorkflowRepository
import io.ktor.client.plugins.defaultRequest
import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.*
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.*
import io.ktor.http.*
import io.ktor.http.content.TextContent
import io.ktor.serialization.kotlinx.json.json
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.*
import kotlin.test.*

class CommunicationTest {
    @Test fun ambiguousSendReconcilesByStableClientId() {
        val pending = PendingMessage("client-id", "Hello", failed = true)
        val message = ChatMessage("server-id", "Hello", "client-id", "2026-11-06T00:00:00Z")
        val merged = mergeMessages(listOf(message), listOf(message.copy(editedAt = "now")))
        assertEquals(1, merged.size)
        assertEquals("now", merged.single().editedAt)
        assertTrue(reconcilePending(listOf(pending), merged).isEmpty())
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
    private fun client(handler: MockRequestHandler) = HttpClient(MockEngine(handler)) {
        defaultRequest { contentType(ContentType.Application.Json) }
        install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true; encodeDefaults = true }) }
    }
}
