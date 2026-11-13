package com.nexus.app.core.network

import com.nexus.app.core.config.BuildInfo
import com.nexus.app.core.session.SessionCoordinator
import com.nexus.app.core.storage.TokenStorage
import com.nexus.app.features.auth.api.SessionChangedException
import com.nexus.app.features.auth.model.CurrentUserResponse
import io.ktor.client.HttpClient
import io.ktor.client.HttpClientConfig
import io.ktor.client.call.body
import io.ktor.client.engine.HttpClientEngine
import io.ktor.client.plugins.DefaultRequest
import io.ktor.client.plugins.HttpResponseValidator
import io.ktor.client.plugins.HttpTimeout
import io.ktor.client.plugins.api.Send
import io.ktor.client.plugins.api.SendingRequest
import io.ktor.client.plugins.api.createClientPlugin
import io.ktor.client.plugins.auth.Auth
import io.ktor.client.plugins.auth.AuthCircuitBreaker
import io.ktor.client.plugins.auth.authProvider
import io.ktor.client.plugins.auth.providers.BearerAuthProvider
import io.ktor.client.plugins.auth.providers.BearerTokens
import io.ktor.client.plugins.auth.providers.bearer
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.plugins.logging.LogLevel
import io.ktor.client.plugins.logging.Logger
import io.ktor.client.plugins.logging.Logging
import io.ktor.client.plugins.pluginOrNull
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.isSuccess
import io.ktor.http.takeFrom
import io.ktor.serialization.kotlinx.json.json
import io.ktor.util.AttributeKey
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.sync.withLock
import kotlinx.io.IOException
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

@Serializable
private data class RefreshRequest(val refreshToken: String)

@Serializable
private data class RefreshResponse(val token: String, val refreshToken: String)


private val CoordinatorKey = AttributeKey<SessionCoordinator>("nexus-session")
internal val SessionGenerationKey = AttributeKey<Long>("nexus-session-generation")
private val ConfirmationKey = AttributeKey<Unit>("nexus-session-confirmation")

internal fun HttpClient.sessionCoordinator(storage: TokenStorage): SessionCoordinator =
    attributes.computeIfAbsent(CoordinatorKey) {
        SessionCoordinator(storage).also { coordinator ->
            coordinator.clearBearerCache = { clearCachedBearerTokens() }
        }
    }

/** Storage and Ktor hold separate copies of the bearer credentials. */
internal fun HttpClient.clearCachedBearerTokens() {
    if (pluginOrNull(Auth) != null) authProvider<BearerAuthProvider>()?.clearToken()
}

internal class SessionRefreshUnavailableException(cause: Throwable? = null) :
    Exception("Can't refresh your session right now. Check your connection and retry.", cause)

internal class ApiConnectionException(baseUrl: String, cause: Throwable) :
    Exception("Cannot reach API at ${baseUrl.trimEnd('/')}. Ensure backend is running via `pnpm dev:mobile`.", cause)

object HttpClientFactory {

    /**
     * @param onSessionExpired called once when authentication is confirmed rejected.
     * @param engine only for tests (MockEngine).
     */
    fun create(
        baseUrl: String = ApiEndpoints.DEFAULT_BASE_URL,
        tokenStorage: TokenStorage,
        onSessionExpired: () -> Unit = {},
        engine: HttpClientEngine? = null,
        coordinator: SessionCoordinator = SessionCoordinator(tokenStorage)
    ): HttpClient {
        coordinator.onExpired = onSessionExpired
        val client = if (engine != null) {
            HttpClient(engine) { configure(baseUrl, tokenStorage, coordinator) }
        } else {
            HttpClient { configure(baseUrl, tokenStorage, coordinator) }
        }
        client.attributes.put(CoordinatorKey, coordinator)
        coordinator.clearBearerCache = { client.clearCachedBearerTokens() }
        return client
    }
}

private fun HttpClientConfig<*>.configure(
    baseUrl: String,
    tokenStorage: TokenStorage,
    coordinator: SessionCoordinator
) {
    HttpResponseValidator {
        handleResponseExceptionWithRequest { error, _ ->
            if (error is IOException) {
                throw ApiConnectionException(baseUrl, error)
            }
        }
    }

    install(ContentNegotiation) {
        json(
            Json {
                ignoreUnknownKeys = true
                isLenient = true
                encodeDefaults = true
                prettyPrint = false
            }
        )
    }

    install(HttpTimeout) {
        connectTimeoutMillis = 15_000
        requestTimeoutMillis = 30_000
    }

    // Debug builds only. INFO level logs no bodies; Authorization and Cookie are redacted.
    if (BuildInfo.isDebug) {
        install(Logging) {
            logger = object : Logger {
                override fun log(message: String) {
                    println("[KtorHttp] $message")
                }
            }
            level = LogLevel.INFO
            sanitizeHeader { it.equals(HttpHeaders.Authorization, true) || it.equals(HttpHeaders.Cookie, true) }
        }
    }

    // Wrap the bearer plugin so only its final resource 401 needs session confirmation.
    install(createClientPlugin("SessionBoundary") {
        onRequest { request, _ ->
            if (!request.attributes.contains(SessionGenerationKey)) request.attributes.put(SessionGenerationKey, coordinator.generation)
            if (request.url.build().encodedPath in setOf(ApiEndpoints.AUTH_LOGIN, ApiEndpoints.AUTH_REGISTER, ApiEndpoints.AUTH_LOGOUT)) {
                request.attributes.put(AuthCircuitBreaker, Unit)
            }
        }
        on(SendingRequest) { request, _ ->
            if (request.attributes[SessionGenerationKey] != coordinator.generation) {
                client.clearCachedBearerTokens()
                throw SessionChangedException()
            }
            // clearToken() can race with Ktor finishing a suspended cache update. Storage
            // remains authoritative even if that older callback briefly repopulates its cache.
            if (request.url.build().encodedPath !in setOf(ApiEndpoints.AUTH_LOGIN, ApiEndpoints.AUTH_REGISTER,
                    ApiEndpoints.AUTH_REFRESH, ApiEndpoints.AUTH_LOGOUT)) {
                val access = tokenStorage.getAccessToken().takeUnless { coordinator.manager.state.value.signedOut }
                val expected = access?.let { "Bearer $it" }
                if (request.headers[HttpHeaders.Authorization] != expected) {
                    client.clearCachedBearerTokens()
                    request.headers.remove(HttpHeaders.Authorization)
                    if (expected != null) request.headers.append(HttpHeaders.Authorization, expected)
                }
            }
        }
        on(Send) { request ->
            val call = proceed(request)
            val generation = request.attributes[SessionGenerationKey]
            if (generation != coordinator.generation) {
                client.clearCachedBearerTokens()
                // A confirmed expiry still returns its original auth response to callers.
                if (coordinator.manager.state.value.notice == null) throw SessionChangedException()
                return@on call
            }
            if (call.response.status != HttpStatusCode.Unauthorized ||
                request.attributes.contains(ConfirmationKey) ||
                request.url.build().encodedPath in setOf(ApiEndpoints.AUTH_ME, ApiEndpoints.AUTH_LOGIN,
                    ApiEndpoints.AUTH_REGISTER, ApiEndpoints.AUTH_REFRESH, ApiEndpoints.AUTH_LOGOUT) ||
                !tokenStorage.hasValidSession()) return@on call
            val confirmation = try {
                client.get(ApiEndpoints.AUTH_ME) {
                    attributes.put(SessionGenerationKey, generation)
                    attributes.put(ConfirmationKey, Unit)
                    attributes.put(AuthCircuitBreaker, Unit)
                    header(HttpHeaders.Authorization, "Bearer ${tokenStorage.getAccessToken()}")
                }
            } catch (e: CancellationException) { throw e }
              catch (e: Exception) { throw SessionRefreshUnavailableException(e) }
            when {
                confirmation.status.value in setOf(401, 403) -> coordinator.clear(generation, expired = true)
                confirmation.status.isSuccess() -> {
                    val user = try { confirmation.body<CurrentUserResponse>().user }
                        catch (e: CancellationException) { throw e }
                        catch (e: Exception) { throw SessionRefreshUnavailableException(e) }
                    if (user.role != "USER" || !user.isActive) coordinator.clear(generation, expired = true)
                    else coordinator.verified(generation, user)
                }
                else -> throw SessionRefreshUnavailableException()
            }
            call
        }
    })

    install(Auth) {
        bearer {
            loadTokens {
                if (coordinator.manager.state.value.signedOut) return@loadTokens null
                val access = tokenStorage.getAccessToken()
                if (access != null) BearerTokens(access, tokenStorage.getRefreshToken() ?: "") else null
            }
            refreshTokens {
                val generation = response.call.request.attributes[SessionGenerationKey]
                coordinator.refresh.withLock {
                    if (generation != coordinator.generation) return@withLock null
                    // A delayed 401 for an older token reuses the rotation already persisted.
                    val access = tokenStorage.getAccessToken() ?: return@withLock null
                    if (response.call.request.headers[HttpHeaders.Authorization] != "Bearer $access") {
                        return@withLock BearerTokens(access, tokenStorage.getRefreshToken())
                    }
                    val refresh = tokenStorage.getRefreshToken()?.takeIf { it.isNotBlank() }
                        ?: return@withLock null
                    val refreshed = try {
                        client.post(ApiEndpoints.AUTH_REFRESH) {
                            markAsRefreshTokenRequest()
                            attributes.put(SessionGenerationKey, generation)
                            header(HttpHeaders.ContentType, ContentType.Application.Json.toString())
                            setBody(RefreshRequest(refresh))
                        }
                    } catch (e: CancellationException) { throw e }
                      catch (e: Exception) { throw SessionRefreshUnavailableException(e) }
                    when {
                        refreshed.status.value in setOf(401, 403) -> {
                            coordinator.clear(generation, expired = true)
                            null
                        }
                        !refreshed.status.isSuccess() -> throw SessionRefreshUnavailableException()
                        else -> {
                            val tokens = try { refreshed.body<RefreshResponse>() }
                                catch (e: CancellationException) { throw e }
                                catch (e: Exception) { throw SessionRefreshUnavailableException(e) }
                            if (tokens.token.isBlank() || tokens.refreshToken.isBlank()) throw SessionRefreshUnavailableException()
                            if (!coordinator.rotate(generation, tokens.token, tokens.refreshToken)) return@withLock null
                            BearerTokens(tokens.token, tokens.refreshToken)
                        }
                    }
                }
            }
            sendWithoutRequest { req ->
                val path = req.url.build().encodedPath
                !req.attributes.contains(AuthCircuitBreaker) &&
                    path != ApiEndpoints.AUTH_LOGIN &&
                    path != ApiEndpoints.AUTH_REGISTER &&
                    path != ApiEndpoints.AUTH_REFRESH
            }
        }
    }

    install(DefaultRequest) {
        url.takeFrom(baseUrl)
        header(HttpHeaders.ContentType, ContentType.Application.Json.toString())
    }
}
