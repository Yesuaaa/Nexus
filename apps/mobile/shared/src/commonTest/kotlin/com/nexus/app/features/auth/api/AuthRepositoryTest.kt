package com.nexus.app.features.auth.api

import com.nexus.app.core.storage.TokenStorage
import com.nexus.app.features.auth.model.RegisterRequest
import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.HttpMethod
import io.ktor.http.headersOf
import io.ktor.http.content.TextContent
import io.ktor.serialization.kotlinx.json.json
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class AuthRepositoryTest {
    @Test
    fun loginStoresBackendTokenFields() = runBlocking {
        val storage = FakeTokenStorage()
        val repository = AuthRepository(
            testClient(
                MockEngine { request ->
                    assertEquals("/api/auth/login", request.url.encodedPath)
                    respond(
                        content = sessionResponse,
                        status = HttpStatusCode.OK,
                        headers = jsonHeaders
                    )
                }
            ),
            storage
        )

        val result = repository.login("CLIENT@EXAMPLE.COM", "ValidPassword1!")

        assertTrue(result.isSuccess)
        assertEquals("client@example.com", result.getOrThrow().email)
        assertEquals("access-token", storage.storedAccessToken)
        assertEquals("refresh-token", storage.storedRefreshToken)
    }

    @Test
    fun loginMapsUnauthorizedResponsesToSafeMessage() = runBlocking {
        val repository = AuthRepository(
            testClient(
                MockEngine {
                    respond(
                        content = "{\"error\":\"Invalid email or password\"}",
                        status = HttpStatusCode.Unauthorized,
                        headers = jsonHeaders
                    )
                }
            ),
            FakeTokenStorage()
        )

        val result = repository.login("client@example.com", "wrong")

        assertFalse(result.isSuccess)
        assertEquals("Invalid email or password.", result.exceptionOrNull()?.message)
    }

    @Test
    fun registrationSendsTheWebContractAndStoresTheReturnedSession() = runBlocking {
        val storage = FakeTokenStorage()
        testClient(MockEngine { request ->
            assertEquals("/api/auth/register", request.url.encodedPath)
            assertEquals(HttpMethod.Post, request.method)
            assertEquals(
                RegisterRequest("Client Dela Cruz", "09123456789", "CLIENT@EXAMPLE.COM", "ValidPassword1!"),
                Json.decodeFromString<RegisterRequest>((request.body as TextContent).text)
            )
            respond(sessionResponse, HttpStatusCode.Created, jsonHeaders)
        }).use { client ->
            val result = AuthRepository(client, storage).register(
                " Client Dela Cruz ", " 09123456789 ", " CLIENT@EXAMPLE.COM ", "ValidPassword1!"
            )
            assertTrue(result.isSuccess)
            assertEquals("USER", result.getOrThrow().role)
            assertTrue(result.getOrThrow().isActive)
            assertEquals("access-token", storage.getAccessToken())
            assertEquals("refresh-token", storage.getRefreshToken())
        }
    }

    @Test
    fun duplicateRegistrationDoesNotCreateALocalSession() = runBlocking {
        val storage = FakeTokenStorage()
        testClient(MockEngine {
            respond("{\"error\":\"Email is already registered\"}", HttpStatusCode.Conflict, jsonHeaders)
        }).use { client ->
            val result = AuthRepository(client, storage).register(
                "Client Dela Cruz", "09123456789", "client@example.com", "ValidPassword1!"
            )
            assertEquals("An account already uses this email address.", result.exceptionOrNull()?.message)
            assertFalse(storage.hasValidSession())
            assertEquals(null, storage.getRefreshToken())
        }
    }

    @Test
    fun sessionRestorationVerifiesTheStoredAccessTokenWithMe() = runBlocking {
        val storage = FakeTokenStorage().apply { setTokens("saved-access", "saved-refresh") }
        testClient(MockEngine { request ->
            assertEquals("/api/auth/me", request.url.encodedPath)
            assertEquals(HttpMethod.Get, request.method)
            assertEquals("Bearer saved-access", request.headers[HttpHeaders.Authorization])
            respond("""{"user":{"id":"client-id","email":"client@example.com","role":"USER","isActive":true}}""",
                HttpStatusCode.OK, jsonHeaders)
        }).use { client ->
            assertEquals("client-id", AuthRepository(client, storage).restoreSession().getOrThrow()?.id)
            assertEquals("saved-access", storage.getAccessToken())
            assertEquals("saved-refresh", storage.getRefreshToken())
        }
    }

    @Test
    fun rejectedRestorationClearsBothTokensInsteadOfEnteringTheApp() = runBlocking {
        val storage = FakeTokenStorage().apply { setTokens("expired", "saved-refresh") }
        testClient(MockEngine {
            respond("{\"error\":\"Invalid or expired session\"}", HttpStatusCode.Unauthorized, jsonHeaders)
        }).use { client ->
            assertTrue(AuthRepository(client, storage).restoreSession().isFailure)
            assertFalse(storage.hasValidSession())
            assertEquals(null, storage.getRefreshToken())
        }
    }

    @Test
    fun restoringWithoutTokensDoesNotMakeANetworkRequest() = runBlocking {
        testClient(MockEngine { error("No request should be made without a saved session") }).use { client ->
            assertEquals(null, AuthRepository(client, FakeTokenStorage()).restoreSession().getOrThrow())
        }
    }

    @Test
    fun logoutRevokesTheCurrentSessionAndClearsBothTokens() = runBlocking {
        val storage = FakeTokenStorage().apply {
            setTokens("current-access-token", "current-refresh-token")
        }
        testClient(MockEngine { request ->
            assertEquals("/api/auth/logout", request.url.encodedPath)
            assertEquals(HttpMethod.Post, request.method)
            assertEquals("Bearer current-access-token", request.headers[HttpHeaders.Authorization])
            assertEquals("current-refresh-token", storage.getRefreshToken())
            respond("", HttpStatusCode.NoContent)
        }).use { client ->
            val result = AuthRepository(client, storage).logout()
            assertTrue(result.isSuccess)
            assertEquals(null, storage.getAccessToken())
            assertEquals(null, storage.getRefreshToken())
        }
    }

    @Test
    fun logoutClearsLocalTokensWhenTheServerIsUnavailable() = runBlocking {
        val storage = FakeTokenStorage().apply { setTokens("access", "refresh") }
        testClient(MockEngine { throw IllegalStateException("Connection failed") }).use { client ->
            val result = AuthRepository(client, storage).logout()
            assertTrue(result.isFailure)
            assertFalse(storage.hasValidSession())
            assertEquals(null, storage.getRefreshToken())
        }
    }

    @Test
    fun logoutTreatsAnExpiredSessionAsAlreadySignedOut() = runBlocking {
        val storage = FakeTokenStorage().apply { setTokens("expired", "refresh") }
        testClient(MockEngine {
            respond("", HttpStatusCode.Unauthorized)
        }).use { client ->
            assertTrue(AuthRepository(client, storage).logout().isSuccess)
            assertFalse(storage.hasValidSession())
            assertEquals(null, storage.getRefreshToken())
        }
    }

    private fun testClient(engine: MockEngine): HttpClient = HttpClient(engine) {
        install(ContentNegotiation) {
            json(Json { ignoreUnknownKeys = true })
        }
    }

    private class FakeTokenStorage : TokenStorage {
        var storedAccessToken: String? = null
        var storedRefreshToken: String? = null

        override fun getAccessToken(): String? = storedAccessToken

        override fun getRefreshToken(): String? = storedRefreshToken

        override fun setTokens(accessToken: String, refreshToken: String?) {
            storedAccessToken = accessToken
            storedRefreshToken = refreshToken
        }

        override fun clearTokens() {
            storedAccessToken = null
            storedRefreshToken = null
        }

        override fun hasValidSession(): Boolean = storedAccessToken != null
    }

    private companion object {
        val jsonHeaders = headersOf(HttpHeaders.ContentType, ContentType.Application.Json.toString())
        const val sessionResponse = """
            {
              "token": "access-token",
              "refreshToken": "refresh-token",
              "expiresIn": 900,
              "user": {
                "id": "client-id",
                "email": "client@example.com",
                "fullName": "Client Dela Cruz",
                "contactNumber": "09123456789",
                "role": "USER",
                "isActive": true
              }
            }
        """
    }
}
