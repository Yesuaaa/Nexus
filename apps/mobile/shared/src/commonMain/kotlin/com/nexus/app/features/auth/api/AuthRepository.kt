package com.nexus.app.features.auth.api

import com.nexus.app.core.network.ApiEndpoints
import com.nexus.app.core.network.clearCachedBearerTokens
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
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.isSuccess
import kotlinx.coroutines.CancellationException

private const val CLIENT_ROLE = "USER"
private const val CLIENT_ONLY_MESSAGE = "This app is only for client accounts."

class AuthRepository(
    private val client: HttpClient,
    private val tokenStorage: TokenStorage
) {
    suspend fun login(email: String, password: String): Result<AuthUser> = authResult {
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
    ): Result<AuthUser> = authResult {
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

    suspend fun currentUser(): Result<AuthUser> = authResult {
        val response = client.get(ApiEndpoints.AUTH_ME) {
            tokenStorage.getAccessToken()?.let {
                header(HttpHeaders.Authorization, "Bearer $it")
            }
        }
        if (!response.status.isSuccess()) throw response.toAuthException()
        val user = response.body<CurrentUserResponse>().user
        if (user.role != CLIENT_ROLE) throw AuthRequestException(CLIENT_ONLY_MESSAGE, 403)
        user
    }

    suspend fun restoreSession(): Result<AuthUser?> {
        if (!tokenStorage.hasValidSession()) {
            clearSession()
            return Result.success(null)
        }
        val result = currentUser()
        val error = result.exceptionOrNull()
        if (error is AuthRequestException && error.status in setOf(401, 403)) clearSession()
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
        client.clearCachedBearerTokens()
    }

    private suspend fun completeAuthentication(response: HttpResponse): AuthUser {
        if (!response.status.isSuccess()) throw response.toAuthException()
        val session = response.body<AuthSession>()
        // USER role enforcement: never store tokens for non-client accounts.
        if (session.user.role != CLIENT_ROLE) throw AuthRequestException(CLIENT_ONLY_MESSAGE, 403)
        tokenStorage.setTokens(session.token, session.refreshToken)
        client.clearCachedBearerTokens()
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

private suspend fun <T> authResult(block: suspend () -> T): Result<T> = try {
    Result.success(block())
} catch (error: CancellationException) {
    throw error
} catch (error: Exception) {
    Result.failure(error)
}
