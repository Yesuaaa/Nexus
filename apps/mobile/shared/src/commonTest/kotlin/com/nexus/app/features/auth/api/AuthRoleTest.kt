package com.nexus.app.features.auth.api

import com.nexus.app.core.storage.TokenStorage
import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.headersOf
import io.ktor.serialization.kotlinx.json.json
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class AuthRoleTest {
    private val jsonHeaders = headersOf(HttpHeaders.ContentType, ContentType.Application.Json.toString())

    private class Storage : TokenStorage {
        var access: String? = null
        var refresh: String? = null
        override fun getAccessToken() = access
        override fun getRefreshToken() = refresh
        override fun setTokens(accessToken: String, refreshToken: String?) {
            access = accessToken
            refresh = refreshToken
        }
        override fun clearTokens() {
            access = null
            refresh = null
        }
        override fun hasValidSession() = access != null
    }

    private fun client(engine: MockEngine) = HttpClient(engine) {
        install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) }
    }

    private fun session(role: String) = """
        {"token":"a","refreshToken":"r","expiresIn":900,
         "user":{"id":"1","email":"x@y.com","role":"$role","isActive":true}}
    """

    @Test
    fun nonClientLoginIsRejectedAndNothingIsStored() = runBlocking {
        val storage = Storage()
        client(MockEngine { respond(session("ADMIN"), HttpStatusCode.OK, jsonHeaders) }).use {
            val result = AuthRepository(it, storage).login("x@y.com", "pw")
            assertTrue(result.isFailure)
            assertEquals("This app is only for client accounts.", result.exceptionOrNull()?.message)
            assertFalse(storage.hasValidSession())
        }
    }

    @Test
    fun restoringANonClientSessionClearsTokens() = runBlocking {
        val storage = Storage().apply { setTokens("a", "r") }
        client(MockEngine {
            respond(
                """{"user":{"id":"1","email":"x@y.com","role":"ADMIN","isActive":true}}""",
                HttpStatusCode.OK, jsonHeaders
            )
        }).use {
            assertTrue(AuthRepository(it, storage).restoreSession().isFailure)
            assertFalse(storage.hasValidSession())
        }
    }
}