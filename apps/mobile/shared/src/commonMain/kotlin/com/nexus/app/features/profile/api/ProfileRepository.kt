package com.nexus.app.features.profile.api

import com.nexus.app.features.auth.model.ApiErrorResponse
import com.nexus.app.features.profile.model.*
import com.nexus.app.core.files.SelectedFile
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.*
import io.ktor.client.statement.HttpResponse
import io.ktor.http.*
import kotlinx.coroutines.CancellationException
import kotlin.io.encoding.Base64

class ProfileRepository(private val client: HttpClient) {
    private suspend fun HttpResponse.check(): HttpResponse {
        if (!status.isSuccess()) {
            val message = try { body<ApiErrorResponse>().error } catch (e: CancellationException) { throw e }
                catch (_: Exception) { null }
            throw IllegalStateException(message ?: "Request failed (${status.value}). Please retry.")
        }
        return this
    }
    suspend fun profile(): Profile = client.get("/api/auth/profile").check().body()
    suspend fun save(details: PersonalDetails): Profile = client.patch("/api/auth/profile") { contentType(ContentType.Application.Json); setBody(details) }.check().body()
    suspend fun settings(): AccountSettings = client.get("/api/auth/settings").check().body()
    suspend fun preferences(value: Preferences): Preferences = client.patch("/api/auth/settings") { contentType(ContentType.Application.Json); setBody(value) }.check().body()
    suspend fun password(value: PasswordChange) { client.post("/api/auth/change-password") { contentType(ContentType.Application.Json); setBody(value) }.check() }
    suspend fun revoke(id: String) { client.delete("/api/auth/sessions/${id.encodeURLPathPart()}").check() }
    suspend fun revokeOthers() { client.post("/api/auth/sessions/revoke-others").check() }
    suspend fun upload(kind: String, file: SelectedFile): Profile {
        validateProfileImage(file)
        return client.post("/api/auth/profile/images") {
            contentType(ContentType.Application.Json)
            setBody(ImageUpload(kind, "data:${file.mimeType};base64,${Base64.encode(file.bytes)}"))
        }.check().body<ImageResult>().profile ?: error("Profile image was not returned. Please reload.")
    }
}

fun validateProfileImage(file: SelectedFile) {
    require(file.mimeType in setOf("image/jpeg", "image/png", "image/webp")) { "Choose a JPEG, PNG, or WebP image." }
    require(file.bytes.isNotEmpty() && file.bytes.size <= 2 * 1024 * 1024) { "Choose an image up to 2 MB." }
}
