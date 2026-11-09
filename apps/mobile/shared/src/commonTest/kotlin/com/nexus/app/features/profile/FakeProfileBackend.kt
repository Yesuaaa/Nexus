package com.nexus.app.features.profile

import com.nexus.app.features.profile.api.ProfileRepository
import com.nexus.app.features.profile.model.*
import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.http.*
import io.ktor.http.content.TextContent
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

class FakeProfileBackend {
    var personalSaves = 0
    var passwordSaves = 0
    var revocations = 0
    var preferences = Preferences()
    var profileJson = """{"user":{"id":"client","email":"mobile@example.com","fullName":"Test Client","contactNumber":null,"role":"USER","isActive":true,"createdAt":"2026-10-01T00:00:00Z"}}"""
    val client = HttpClient(MockEngine { request ->
        val body = (request.body as? TextContent)?.text ?: ""
        val result = when (request.url.encodedPath) {
            "/api/auth/profile" -> {
                if (request.method == HttpMethod.Patch) {
                    val data = Json.decodeFromString<PersonalDetails>(body)
                    personalSaves++
                    profileJson = Json.encodeToString(Profile(com.nexus.app.features.auth.model.AuthUser("client", "mobile@example.com", data.fullName, data.contactNumber, "USER", true)))
                }
                profileJson
            }
            "/api/auth/settings" -> {
                if (request.method == HttpMethod.Patch) { preferences = Json.decodeFromString<Preferences>(body); Json.encodeToString(preferences) }
                else Json.encodeToString(AccountSettings(preferences, listOf(AccountSession("current", "Android", null, "2026-11-01T00:00:00Z", null, true)) + if (revocations == 0) listOf(AccountSession("other", "Windows - Chrome", "Manila", "2026-10-31T00:00:00Z", null, false)) else emptyList()))
            }
            "/api/auth/change-password" -> { passwordSaves++; "" }
            "/api/auth/sessions/other", "/api/auth/sessions/revoke-others" -> { revocations++; "" }
            else -> error("Unexpected account request: ${request.method} ${request.url}")
        }
        respond(result, if (result.isEmpty()) HttpStatusCode.NoContent else HttpStatusCode.OK, headersOf(HttpHeaders.ContentType, "application/json"))
    }) {
        install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true; encodeDefaults = true }) }
    }
    val repository = ProfileRepository(client)
}
