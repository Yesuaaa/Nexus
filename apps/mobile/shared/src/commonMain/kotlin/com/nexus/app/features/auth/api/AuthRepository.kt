package com.nexus.app.features.auth.api

import com.nexus.app.core.network.ApiEndpoints
import com.nexus.app.core.storage.TokenStorage
import com.nexus.app.features.auth.model.ApiErrorResponse
import com.nexus.app.features.auth.model.AuthSession
import com.nexus.app.features.auth.model.AuthUser
import com.nexus.app.features.auth.model.CurrentUserResponse
import com.nexus.app.features.auth.model.LoginRequest
import com.nexus.app.features.auth.model.RegisterRequest
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.http.HttpStatusCode
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.isSuccess
import kotlinx.coroutines.CancellationException

class AuthRepository(
    private val client: HttpClient,
    private val tokenStorage: TokenStorage
) {
    suspend fun login(email: String, password: String): Result<AuthUser> = runCatching {
        completeAuthentication(
            client.post(ApiEndpoints.AUTH_LOGIN) {
                header(HttpHeaders.ContentType, ContentType.Application.Json.toString())
                setBody(LoginRequest(email = email.trim(), password = password))
            }
        )
    }

    suspend fun register(
        fullName: String,
        contactNumber: String,
        email: String,
        password: String
    ): Result<AuthUser> = runCatching {
        completeAuthentication(
            client.post(ApiEndpoints.AUTH_REGISTER) {
                header(HttpHeaders.ContentType, ContentType.Application.Json.toString())
                setBody(
                    RegisterRequest(
                        fullName = fullName.trim(),
                        contactNumber = contactNumber.trim(),
                        email = email.trim(),
                        password = password
                    )
                )
            }
        )
    }

    suspend fun currentUser(): Result<AuthUser> = runCatching {
        val response = client.get(ApiEndpoints.AUTH_ME) {
            tokenStorage.getAccessToken()?.let {
                header(HttpHeaders.Authorization, "Bearer $it")
            }
        }
        if (!response.status.isSuccess()) throw response.toAuthException()
        response.body<CurrentUserResponse>().user
    }

    suspend fun restoreSession(): Result<AuthUser?> {
        if (!tokenStorage.hasValidSession()) return Result.success(null)
        val result = currentUser()
        if (result.isFailure) clearSession()
        return result
    }

    suspend fun logout(): Result<Unit> {
        try {
            val token = tokenStorage.getAccessToken() ?: return Result.success(Unit)
            val response = client.post(ApiEndpoints.AUTH_LOGOUT) {
                header(HttpHeaders.Authorization, "Bearer $token")
            }
            return if (response.status.isSuccess() || response.status == HttpStatusCode.Unauthorized) {
                Result.success(Unit)
            } else {
                Result.failure(AuthRequestException("We couldn't confirm sign-out. Please try again later."))
            }
        } catch (error: CancellationException) {
            throw error
        } catch (_: Exception) {
            return Result.failure(AuthRequestException("We couldn't confirm sign-out. Please try again later."))
        } finally {
            clearSession()
        }
    }

    fun clearSession() {
        tokenStorage.clearTokens()
    }

    private suspend fun completeAuthentication(response: HttpResponse): AuthUser {
        if (!response.status.isSuccess()) throw response.toAuthException()
        val session = response.body<AuthSession>()
        tokenStorage.setTokens(session.token, session.refreshToken)
        return session.user
    }
}

class AuthRequestException(message: String, val status: Int? = null) : Exception(message)

private suspend fun HttpResponse.toAuthException(): AuthRequestException {
    val serverMessage = runCatching { body<ApiErrorResponse>().error }.getOrNull()
    val message = when (status) {
        HttpStatusCode.BadRequest -> "Check the information you entered."
        HttpStatusCode.Unauthorized -> "Invalid email or password."
        HttpStatusCode.Conflict -> "An account already uses this email address."
        HttpStatusCode.TooManyRequests -> "Too many attempts. Please try again later."
        else -> serverMessage?.takeIf { it.isNotBlank() }
            ?: "Authentication is currently unavailable."
    }
    return AuthRequestException(message, status.value)
}
