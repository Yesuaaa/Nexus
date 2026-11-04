package com.nexus.app.core.network

import com.nexus.app.core.config.BuildInfo
import com.nexus.app.core.storage.TokenStorage
import io.ktor.client.HttpClient
import io.ktor.client.HttpClientConfig
import io.ktor.client.call.body
import io.ktor.client.engine.HttpClientEngine
import io.ktor.client.plugins.DefaultRequest
import io.ktor.client.plugins.HttpTimeout
import io.ktor.client.plugins.auth.Auth
import io.ktor.client.plugins.auth.authProvider
import io.ktor.client.plugins.auth.providers.BearerAuthProvider
import io.ktor.client.plugins.pluginOrNull
import io.ktor.client.plugins.auth.providers.BearerTokens
import io.ktor.client.plugins.auth.providers.bearer
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.plugins.logging.LogLevel
import io.ktor.client.plugins.logging.Logger
import io.ktor.client.plugins.logging.Logging
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.isSuccess
import io.ktor.http.takeFrom
import io.ktor.serialization.kotlinx.json.json
import kotlinx.coroutines.CancellationException
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

@Serializable
private data class RefreshRequest(val refreshToken: String)

// ASSUMPTION: confirm against apps/api/src/features/auth/auth.schema.ts
@Serializable
private data class RefreshResponse(val token: String, val refreshToken: String? = null)


/** Storage and Ktor hold separate copies of the bearer credentials. */
internal fun HttpClient.clearCachedBearerTokens() {
    if (pluginOrNull(Auth) != null) authProvider<BearerAuthProvider>()?.clearToken()
}

internal class SessionRefreshUnavailableException(cause: Throwable? = null) :
    Exception("Can't refresh your session right now. Check your connection and retry.", cause)

object HttpClientFactory {

    /**
     * @param onSessionExpired called when the refresh token is missing or rejected.
     * @param engine only for tests (MockEngine).
     */
    fun create(
        baseUrl: String = ApiEndpoints.DEFAULT_BASE_URL,
        tokenStorage: TokenStorage,
        onSessionExpired: () -> Unit = {},
        engine: HttpClientEngine? = null
    ): HttpClient =
        if (engine != null) {
            HttpClient(engine) { configure(baseUrl, tokenStorage, onSessionExpired) }
        } else {
            HttpClient { configure(baseUrl, tokenStorage, onSessionExpired) }
        }
}

private fun HttpClientConfig<*>.configure(
    baseUrl: String,
    tokenStorage: TokenStorage,
    onSessionExpired: () -> Unit
) {
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

    val expire = {
        tokenStorage.clearTokens()
        onSessionExpired()
    }

    install(Auth) {
        bearer {
            loadTokens {
                val access = tokenStorage.getAccessToken()
                if (access != null) BearerTokens(access, tokenStorage.getRefreshToken() ?: "") else null
            }
            refreshTokens {
                val refresh = tokenStorage.getRefreshToken()
                if (refresh.isNullOrBlank()) {
                    expire()
                    client.clearCachedBearerTokens()
                    return@refreshTokens null
                }
                val response = try {
                    client.post(ApiEndpoints.AUTH_REFRESH) {
                        markAsRefreshTokenRequest()
                        header(HttpHeaders.ContentType, ContentType.Application.Json.toString())
                        setBody(RefreshRequest(refresh))
                    }
                } catch (e: CancellationException) {
                    throw e
                } catch (error: Exception) {
                    // Do not turn a temporary refresh failure into a definitive resource 401.
                    throw SessionRefreshUnavailableException(error)
                }
                when {
                    response.status == HttpStatusCode.Unauthorized ||
                        response.status == HttpStatusCode.Forbidden -> {
                        expire()
                        client.clearCachedBearerTokens()
                        null
                    }
                    !response.status.isSuccess() -> throw SessionRefreshUnavailableException()
                    else -> response.body<RefreshResponse>().let {
                        val newRefresh = it.refreshToken ?: refresh
                        tokenStorage.setTokens(it.token, newRefresh)
                        BearerTokens(it.token, newRefresh)
                    }
                }
            }
            sendWithoutRequest { req ->
                val path = req.url.build().encodedPath
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
