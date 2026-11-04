package com.nexus.app.features.auth.api

import com.nexus.app.core.network.ApiEndpoints
import com.nexus.app.core.network.HttpClientFactory
import com.nexus.app.core.storage.TokenStorage
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.client.request.get
import io.ktor.http.*
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.test.runTest
import kotlin.test.*

class SessionIsolationTest {
    private class Storage : TokenStorage {
        var access: String? = "account-a"
        var refresh: String? = "refresh-a"
        override fun getAccessToken() = access
        override fun getRefreshToken() = refresh
        override fun setTokens(accessToken: String, refreshToken: String?) {
            access = accessToken
            refresh = refreshToken
        }
        override fun clearTokens() { access = null; refresh = null }
        override fun hasValidSession() = access != null
    }
    private val json = headersOf(HttpHeaders.ContentType, "application/json")
    private val challenge = headersOf(HttpHeaders.WWWAuthenticate, "Bearer")
    private val sessionB = """
        {"token":"account-b","refreshToken":"refresh-b","expiresIn":900,
         "user":{"id":"b","email":"b@example.com","role":"USER","isActive":true}}
    """

    @Test
    fun failedServerLogoutThenLoginUsesOnlyTheNewAccountsBearer() = runTest {
        val storage = Storage()
        val headers = mutableListOf<String?>()
        val client = HttpClientFactory.create("http://test", storage, engine = MockEngine { request ->
            when (request.url.encodedPath) {
                ApiEndpoints.AUTH_LOGOUT -> throw IllegalStateException("Connection lost")
                ApiEndpoints.AUTH_LOGIN -> respond(sessionB, HttpStatusCode.OK, json)
                else -> {
                    headers += request.headers[HttpHeaders.Authorization]
                    respond("{}", HttpStatusCode.OK, json)
                }
            }
        })
        try {
            val repository = AuthRepository(client, storage)
            client.get(ApiEndpoints.CLIENT_SERVICES) // Prime Ktor's account-A cache.
            assertTrue(repository.logout().isFailure)
            assertFalse(storage.hasValidSession())
            client.get(ApiEndpoints.CLIENT_SERVICES)
            assertEquals("b", repository.login("b@example.com", "password").getOrThrow().id)
            client.get(ApiEndpoints.CLIENT_SERVICES)
            assertEquals(listOf<String?>("Bearer account-a", null, "Bearer account-b"), headers)
        } finally { client.close() }
    }

    @Test
    fun successfulLoginReplacesAnAlreadyCachedBearer() = runTest {
        val storage = Storage()
        val headers = mutableListOf<String?>()
        val client = HttpClientFactory.create("http://test", storage, engine = MockEngine { request ->
            if (request.url.encodedPath == ApiEndpoints.AUTH_LOGIN) respond(sessionB, HttpStatusCode.OK, json)
            else {
                headers += request.headers[HttpHeaders.Authorization]
                respond("{}", HttpStatusCode.OK, json)
            }
        })
        try {
            client.get(ApiEndpoints.CLIENT_SERVICES)
            assertEquals("b", AuthRepository(client, storage).login("b@example.com", "password").getOrThrow().id)
            client.get(ApiEndpoints.CLIENT_SERVICES)
            assertEquals(listOf<String?>("Bearer account-a", "Bearer account-b"), headers)
        } finally { client.close() }
    }

    @Test
    fun logoutAlsoClearsCacheWhenStorageWasAlreadyEmpty() = runTest {
        val storage = Storage()
        val headers = mutableListOf<String?>()
        val client = HttpClientFactory.create("http://test", storage, engine = MockEngine { request ->
            headers += request.headers[HttpHeaders.Authorization]
            respond("{}", HttpStatusCode.OK, json)
        })
        try {
            client.get(ApiEndpoints.CLIENT_SERVICES)
            storage.clearTokens()
            AuthRepository(client, storage).logout().getOrThrow()
            client.get(ApiEndpoints.CLIENT_SERVICES)
            assertEquals(listOf<String?>("Bearer account-a", null), headers)
        } finally { client.close() }
    }

    @Test
    fun offlineRestorationKeepsBothCredentials() = runTest {
        val storage = Storage()
        val client = HttpClientFactory.create("http://test", storage, engine = MockEngine {
            throw IllegalStateException("No connection")
        })
        try {
            assertTrue(AuthRepository(client, storage).restoreSession().isFailure)
            assertEquals("account-a", storage.access)
            assertEquals("refresh-a", storage.refresh)
        } finally { client.close() }
    }

    @Test
    fun temporaryServerErrorDuringRestorationKeepsCredentials() = runTest {
        val storage = Storage()
        val client = HttpClientFactory.create("http://test", storage, engine = MockEngine {
            respond("{}", HttpStatusCode.ServiceUnavailable, json)
        })
        try {
            assertTrue(AuthRepository(client, storage).restoreSession().isFailure)
            assertEquals("account-a", storage.access)
            assertEquals("refresh-a", storage.refresh)
        } finally { client.close() }
    }

    @Test
    fun refreshConnectionFailureIsNotMistakenForARejectedSession() = runTest {
        val storage = Storage()
        var expired = false
        val client = HttpClientFactory.create("http://test", storage, onSessionExpired = { expired = true },
            engine = MockEngine { request ->
                if (request.url.encodedPath == ApiEndpoints.AUTH_REFRESH) throw IllegalStateException("Offline")
                respond("", HttpStatusCode.Unauthorized, challenge)
            })
        try {
            assertTrue(AuthRepository(client, storage).restoreSession().isFailure)
            assertEquals("account-a", storage.access)
            assertEquals("refresh-a", storage.refresh)
            assertFalse(expired)
        } finally { client.close() }
    }

    @Test
    fun refreshServerFailureKeepsCredentials() = runTest {
        val storage = Storage()
        var expired = false
        val client = HttpClientFactory.create("http://test", storage, onSessionExpired = { expired = true },
            engine = MockEngine { request ->
                if (request.url.encodedPath == ApiEndpoints.AUTH_REFRESH)
                    respond("{}", HttpStatusCode.ServiceUnavailable, json)
                else respond("", HttpStatusCode.Unauthorized, challenge)
            })
        try {
            assertTrue(AuthRepository(client, storage).restoreSession().isFailure)
            assertEquals("account-a", storage.access)
            assertEquals("refresh-a", storage.refresh)
            assertFalse(expired)
        } finally { client.close() }
    }

    @Test
    fun cancelledRestorationPropagatesWithoutDeletingCredentials() = runTest {
        val storage = Storage()
        val client = HttpClientFactory.create("http://test", storage, engine = MockEngine {
            throw CancellationException("Screen closed")
        })
        try {
            assertFailsWith<CancellationException> { AuthRepository(client, storage).restoreSession() }
            assertEquals("account-a", storage.access)
            assertEquals("refresh-a", storage.refresh)
        } finally { client.close() }
    }

    @Test
    fun retryCanRestoreTheSameAccountAfterARefreshConnectionFailure() = runTest {
        val storage = Storage()
        var offline = true
        val client = HttpClientFactory.create("http://test", storage, engine = MockEngine { request ->
            when {
                request.url.encodedPath == ApiEndpoints.AUTH_REFRESH -> {
                    if (offline) throw IllegalStateException("Offline")
                    respond("""{"token":"restored-a","refreshToken":"rotated-a"}""", HttpStatusCode.OK, json)
                }
                request.headers[HttpHeaders.Authorization] == "Bearer restored-a" ->
                    respond("""{"user":{"id":"a","email":"a@example.com","role":"USER","isActive":true}}""",
                        HttpStatusCode.OK, json)
                else -> respond("", HttpStatusCode.Unauthorized, challenge)
            }
        })
        try {
            val repository = AuthRepository(client, storage)
            assertTrue(repository.restoreSession().isFailure)
            offline = false
            assertEquals("a", repository.restoreSession().getOrThrow()?.id)
            assertEquals("restored-a", storage.access)
            assertEquals("rotated-a", storage.refresh)
        } finally { client.close() }
    }

}
