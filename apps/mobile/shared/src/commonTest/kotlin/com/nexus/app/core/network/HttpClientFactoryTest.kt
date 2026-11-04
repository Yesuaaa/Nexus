package com.nexus.app.core.network

import com.nexus.app.core.storage.TokenStorage
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.client.request.get
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.headersOf
import kotlinx.coroutines.runBlocking
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue
import kotlin.test.assertFailsWith
import kotlinx.io.IOException

class HttpClientFactoryTest {
    @Test
    fun connectionFailureIncludesConfiguredEndpointAndStartupCommand() = runBlocking {
        val engine = MockEngine { throw IOException("Connection refused") }
        val client = HttpClientFactory.create("http://10.0.2.2:3001", FakeStorage(), engine = engine)
        try {
            val error = assertFailsWith<ApiConnectionException> {
                client.get(ApiEndpoints.AUTH_LOGIN)
            }
            assertEquals(
                "Cannot reach API at http://10.0.2.2:3001. Ensure backend is running via `pnpm dev:mobile`.",
                error.message
            )
        } finally {
            client.close()
        }
    }

    private val json = headersOf(HttpHeaders.ContentType, ContentType.Application.Json.toString())
    private val challenge = headersOf(HttpHeaders.WWWAuthenticate, "Bearer")

    private class FakeStorage : TokenStorage {
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

    @Test
    fun expiredAccessTokenIsRefreshedOnceAndTheRequestRetried() = runBlocking {
        val storage = FakeStorage().apply { setTokens("old", "r1") }
        var refreshCalls = 0
        val engine = MockEngine { req ->
            if (req.url.encodedPath == ApiEndpoints.AUTH_REFRESH) {
                refreshCalls++
                respond("""{"token":"new","refreshToken":"r2"}""", HttpStatusCode.OK, json)
            } else if (req.headers[HttpHeaders.Authorization] == "Bearer new") {
                respond("""{"ok":true}""", HttpStatusCode.OK, json)
            } else {
                respond("", HttpStatusCode.Unauthorized, challenge)
            }
        }
        val client = HttpClientFactory.create("http://test", storage, engine = engine)
        val res = client.get(ApiEndpoints.CLIENT_SERVICES)
        assertEquals(HttpStatusCode.OK, res.status)
        assertEquals(1, refreshCalls)
        assertEquals("new", storage.getAccessToken())
        assertEquals("r2", storage.getRefreshToken())
        client.close()
    }

    @Test
    fun rejectedRefreshClearsTokensAndSignalsExpiry() = runBlocking {
        val storage = FakeStorage().apply { setTokens("old", "r1") }
        var expired = false
        val engine = MockEngine { req ->
            if (req.url.encodedPath == ApiEndpoints.AUTH_REFRESH) {
                respond("""{"error":"expired"}""", HttpStatusCode.Unauthorized, json)
            } else {
                respond("", HttpStatusCode.Unauthorized, challenge)
            }
        }
        val client = HttpClientFactory.create(
            "http://test", storage, onSessionExpired = { expired = true }, engine = engine
        )
        client.get(ApiEndpoints.CLIENT_SERVICES)
        assertTrue(expired)
        assertFalse(storage.hasValidSession())
        assertEquals(null, storage.getRefreshToken())
        client.close()
    }

    @Test
    fun missingRefreshTokenExpiresTheSession() = runBlocking {
        val storage = FakeStorage().apply { setTokens("old", null) }
        var expired = false
        val engine = MockEngine { respond("", HttpStatusCode.Unauthorized, challenge) }
        val client = HttpClientFactory.create(
            "http://test", storage, onSessionExpired = { expired = true }, engine = engine
        )
        client.get(ApiEndpoints.CLIENT_SERVICES)
        assertTrue(expired)
        assertFalse(storage.hasValidSession())
        client.close()
    }
}
