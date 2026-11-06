package com.nexus.app.features.workflow.api

import com.nexus.app.features.conversations.api.CommunicationException
import com.nexus.app.features.workflow.model.*
import com.nexus.app.core.files.*
import com.nexus.app.features.booking.model.newSubmissionKey
import io.ktor.client.plugins.onUpload
import io.ktor.client.statement.bodyAsBytes
import kotlin.io.encoding.Base64
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.*
import io.ktor.client.statement.HttpResponse
import io.ktor.http.isSuccess
import kotlinx.serialization.json.*

class WorkflowRepository(private val client: HttpClient) {
    private val json = Json { ignoreUnknownKeys = true }
    private suspend inline fun <reified T> HttpResponse.checked(): T {
        if (!status.isSuccess()) throw CommunicationException(status.value, body<JsonObject>()["error"]?.jsonPrimitive?.content ?: "Request failed")
        return body()
    }
    suspend fun upload(id: String, file: SelectedFile, uploadId: String, progress: (Float) -> Unit): WorkflowFile {
        validateFile(file)
        val response = client.post("/api/request-workflows/$id/files") {
            setBody(buildJsonObject { put("uploadId", uploadId); put("name", file.name); put("mimeType", file.mimeType); put("content", Base64.encode(file.bytes)) })
            onUpload { sent, total -> if (total != null && total > 0) progress((sent.toFloat() / total).coerceIn(0f, 1f)) }
        }.checked<JsonObject>()
        return json.decodeFromJsonElement<WorkflowFile>(response.getValue("file"))
    }
    suspend fun download(id: String, file: WorkflowFile): SelectedFile {
        val response = client.get("/api/request-workflows/$id/files/${file.id}")
        if (!response.status.isSuccess()) throw CommunicationException(response.status.value, "File is unavailable")
        return SelectedFile(file.name, file.mimeType, response.bodyAsBytes())
    }
    suspend fun get(id: String): ClientWorkflow = client.get("/api/request-workflows/$id").checked()
    suspend fun project(id: String): ProjectWorkspace = client.get("/api/projects/$id").checked()
    suspend fun action(id: String, version: Int, actionId: String, type: String, fields: Map<String, String>): ClientWorkflow =
        client.post("/api/request-workflows/$id/actions") {
            setBody(buildJsonObject {
                put("actionId", actionId); put("expectedVersion", version); put("type", type)
                fields.forEach { (key, value) -> put(key, value) }
            })
        }.checked()
}
