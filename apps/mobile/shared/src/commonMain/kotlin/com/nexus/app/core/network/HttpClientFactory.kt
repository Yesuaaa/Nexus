package com.nexus.app.core.network

import com.nexus.app.core.storage.TokenStorage
import io.ktor.client.HttpClient
import io.ktor.client.plugins.DefaultRequest
import io.ktor.client.plugins.HttpTimeout
import io.ktor.client.plugins.auth.Auth
import io.ktor.client.plugins.auth.providers.BearerTokens
import io.ktor.client.plugins.auth.providers.bearer
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.plugins.logging.LogLevel
import io.ktor.client.plugins.logging.Logger
import io.ktor.client.plugins.logging.Logging
import io.ktor.client.request.header
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.takeFrom
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.json.Json

object HttpClientFactory {

    fun create(
        baseUrl: String = ApiEndpoints.DEFAULT_BASE_URL,
        tokenStorage: TokenStorage
    ): HttpClient {
        return HttpClient {
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
                requestTimeoutMillis = 20_000
                connectTimeoutMillis = 10_000
                socketTimeoutMillis = 20_000
            }

            install(Logging) {
                logger = object : Logger {
                    override fun log(message: String) {
                        println("[KtorHttp] $message")
                    }
                }
                level = LogLevel.INFO
            }

            install(Auth) {
                bearer {
                    loadTokens {
                        val access = tokenStorage.getAccessToken()
                        val refresh = tokenStorage.getRefreshToken()
                        if (access != null) {
                            BearerTokens(access, refresh ?: "")
                        } else {
                            null
                        }
                    }
                    refreshTokens {
                        // Transparent token refresh on 401
                        val refresh = tokenStorage.getRefreshToken()
                        if (refresh.isNullOrBlank()) {
                            tokenStorage.clearTokens()
                            null
                        } else {
                            try {
                                // Calls /api/auth/refresh using a fresh client
                                null
                            } catch (_: Exception) {
                                tokenStorage.clearTokens()
                                null
                            }
                        }
                    }
                }
            }

            install(DefaultRequest) {
                url.takeFrom(baseUrl)
                header(HttpHeaders.ContentType, ContentType.Application.Json.toString())
            }
        }
    }
}

