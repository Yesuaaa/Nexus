package com.nexus.app.features.conversations.api

import com.nexus.app.core.network.ApiEndpoints
import com.nexus.app.features.conversations.model.*
import com.nexus.app.features.notifications.model.NotificationFeed
import com.nexus.app.features.projects.model.ProjectChatHistory
import com.nexus.app.features.projects.model.ProjectChatMessage
import com.nexus.app.features.projects.model.ProjectConversationPage
import com.nexus.app.features.projects.model.ProjectMessageResponse
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.client.plugins.timeout
import io.ktor.http.*
import io.ktor.utils.io.*
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.*


class CommunicationException(val status: Int, message: String) : Exception(message)
@Serializable private data class ErrorBody(val error: String = "Request failed. Please retry.")
class ClientCommunicationRepository(private val client: HttpClient) {
    private suspend inline fun <reified T> HttpResponse.checked(): T {
        if (!status.isSuccess()) {
            val message = try { body<ErrorBody>().error } catch (e: kotlinx.coroutines.CancellationException) { throw e }
                catch (_: Exception) { "Request failed. Please retry." }
            throw CommunicationException(status.value, message)
        }
        return body()
    }
    suspend fun conversations(archived: Boolean, before: String? = null): ConversationPage =
        client.get(ApiEndpoints.CONVERSATIONS) {
            parameter("view", if (archived) "archived" else "active")
            before?.let { parameter("before", it) }
        }.checked()
    suspend fun requestMeetingReschedule(id: String, meeting: ConversationMeeting, startsAt: String, note: String): ConversationMeeting =
        client.patch("/api/request-conversations/$id/meetings/${meeting.id}") {
            setBody(buildJsonObject {
                put("type", "REQUEST_RESCHEDULE")
                put("expectedVersion", meeting.version)
                put("startsAt", startsAt)
                put("note", note.trim())
            })
        }.checked<MeetingResponse>().meeting
    suspend fun history(id: String, before: String? = null, bookingId: String? = null): History = client.get("/api/request-conversations/$id") {
        before?.let { parameter("before", it) }
        bookingId?.let { parameter("booking", it) }
    }.checked()
    suspend fun send(id: String, message: SendMessage): ChatMessage =
        client.post(ApiEndpoints.sendConversationMessage(id)) { setBody(message) }.checked<MessageResponse>().message
    suspend fun read(id: String) { client.patch(ApiEndpoints.markConversationRead(id)).checked<kotlinx.serialization.json.JsonObject>() }
    suspend fun projectConversations(archived: Boolean = false, before: String? = null): ProjectConversationPage =
        client.get(ApiEndpoints.PROJECT_CONVERSATIONS) {
            parameter("view", if (archived) "archived" else "active")
            before?.let { parameter("before", it) }
        }.checked()
    suspend fun projectHistory(id: String, before: String? = null): ProjectChatHistory =
        client.get(ApiEndpoints.projectConversationMessages(id)) {
            before?.let { parameter("before", it) }
        }.checked()
    suspend fun sendProjectMessage(id: String, body: String, clientMessageId: String): ProjectChatMessage =
        client.post(ApiEndpoints.sendProjectConversationMessage(id)) {
            setBody(SendMessage(body = body, clientMessageId = clientMessageId))
        }.checked<ProjectMessageResponse>().message
    suspend fun readProject(id: String) {
        client.patch(ApiEndpoints.markProjectConversationRead(id)).checked<kotlinx.serialization.json.JsonObject>()
    }
    suspend fun notifications(): NotificationFeed = client.get("/api/request-workflows/notifications").checked()
    suspend fun readNotification(id: String) { client.patch("/api/request-workflows/notifications/$id/read").checked<kotlinx.serialization.json.JsonObject>() }
    suspend fun readAll() { client.patch("/api/request-workflows/notifications/read-all").checked<kotlinx.serialization.json.JsonObject>() }
    suspend fun checkRequestAccess(id: String) { client.get("/api/request-workflows/$id").checked<kotlinx.serialization.json.JsonObject>() }
    /** The stream carries invalidations, never message bodies. Re-fetch history on connect and changes. */
    suspend fun events(id: String, changed: suspend () -> Unit) {
        client.prepareGet(ApiEndpoints.conversationStream(id)) {
            timeout { requestTimeoutMillis = 70_000; socketTimeoutMillis = 35_000 }
            accept(ContentType.Text.EventStream)
        }.execute { response ->
            if (!response.status.isSuccess()) throw CommunicationException(response.status.value, "Conversation unavailable")
            val channel = response.bodyAsChannel()
            while (!channel.isClosedForRead) {
                val line = channel.readUTF8Line() ?: break
                when (line) {
                    "event: access-revoked" -> throw CommunicationException(403, "Conversation access ended")
                    "event: reconnecting" -> return@execute
                    "event: connected", "event: messages-changed" -> changed()
                }
            }
        }
    }
}
