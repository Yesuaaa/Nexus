package com.nexus.app.features.conversations.api

import com.nexus.app.features.conversations.model.*
import com.nexus.app.features.notifications.model.NotificationFeed
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.client.plugins.timeout
import io.ktor.http.*
import io.ktor.utils.io.*
import kotlinx.serialization.Serializable

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
        client.get("/api/request-conversations") {
            parameter("view", if (archived) "archived" else "active")
            before?.let { parameter("before", it) }
        }.checked()
    suspend fun history(id: String, before: String? = null, bookingId: String? = null): History = client.get("/api/request-conversations/$id") {
        before?.let { parameter("before", it) }
        bookingId?.let { parameter("booking", it) }
    }.checked()
    suspend fun send(id: String, message: SendMessage): ChatMessage =
        client.post("/api/request-conversations/$id/messages") { setBody(message) }.checked<MessageResponse>().message
    suspend fun read(id: String) { client.patch("/api/request-conversations/$id/read").checked<kotlinx.serialization.json.JsonObject>() }
    suspend fun notifications(): NotificationFeed = client.get("/api/request-workflows/notifications").checked()
    suspend fun readNotification(id: String) { client.patch("/api/request-workflows/notifications/$id/read").checked<kotlinx.serialization.json.JsonObject>() }
    suspend fun readAll() { client.patch("/api/request-workflows/notifications/read-all").checked<kotlinx.serialization.json.JsonObject>() }
    suspend fun checkRequestAccess(id: String) { client.get("/api/request-workflows/$id").checked<kotlinx.serialization.json.JsonObject>() }
    /** The stream carries invalidations, never message bodies. Re-fetch history on connect and changes. */
    suspend fun events(id: String, changed: suspend () -> Unit) {
        client.prepareGet("/api/request-conversations/$id/events") {
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
