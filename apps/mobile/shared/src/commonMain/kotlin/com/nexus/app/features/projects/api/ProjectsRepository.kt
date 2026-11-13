package com.nexus.app.features.projects.api

import com.nexus.app.core.files.SelectedFile
import com.nexus.app.core.network.ApiEndpoints
import com.nexus.app.features.conversations.api.CommunicationException
import com.nexus.app.features.projects.model.*
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.*
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsBytes
import io.ktor.http.isSuccess
import kotlinx.serialization.json.*

class ProjectsRepository(private val client: HttpClient) {
    private suspend inline fun <reified T> HttpResponse.checked(): T {
        if (!status.isSuccess()) {
            val message = try { body<JsonObject>()["error"]?.jsonPrimitive?.content } catch (e: kotlinx.coroutines.CancellationException) { throw e } catch (_: Exception) { null }
            throw CommunicationException(status.value, message ?: "Unable to complete the request. Please try again.")
        }
        return body()
    }
    suspend fun listClientProjects(): List<ClientProjectSummary> = client.get(ApiEndpoints.CLIENT_PROJECTS).checked()
    suspend fun list(): List<ClientProjectSummary> = listClientProjects()
    suspend fun calendar(): List<CalendarEvent> = client.get(ApiEndpoints.CLIENT_CALENDAR).checked()
    suspend fun get(id: String): ClientProject = client.get("/api/projects/$id").checked()
    suspend fun brief(id: String, name: String, description: String): ClientProject = client.patch("/api/projects/$id/brief") {
        setBody(buildJsonObject { put("name", name.trim()); put("description", description.trim()) })
    }.checked()
    suspend fun request(id: String, cancellation: Boolean, details: String): ClientProject =
        client.post("/api/projects/$id/${if (cancellation) "cancellation-requests" else "change-requests"}") {
            setBody(buildJsonObject { put("details", details.trim()) })
        }.checked()
    suspend fun review(id: String, deliverableId: String, decision: String, note: String): ClientProject =
        client.post("/api/projects/$id/deliverables/$deliverableId/review") {
            setBody(buildJsonObject { put("decision", decision); put("note", note.trim()) })
        }.checked()
    suspend fun file(id: String, deliverable: ClientDeliverable): SelectedFile {
        val response = client.get("/api/projects/$id/deliverables/${deliverable.id}/file")
        if (!response.status.isSuccess()) throw CommunicationException(response.status.value, "This deliverable is unavailable. Refresh the project and try again.")
        return SelectedFile(deliverable.workflowFile.name, deliverable.workflowFile.mimeType, response.bodyAsBytes())
    }
    suspend fun history(id: String, before: String? = null): ProjectChatHistory = client.get("/api/project-conversations/$id") {
        before?.let { parameter("before", it) }
    }.checked()
    suspend fun send(id: String, body: String, key: String): ProjectChatMessage = client.post("/api/project-conversations/$id/messages") {
        setBody(buildJsonObject { put("body", body); put("clientMessageId", key) })
    }.checked<ProjectMessageResponse>().message
    suspend fun markRead(id: String) { client.patch("/api/project-conversations/$id/read").checked<JsonObject>() }
}
