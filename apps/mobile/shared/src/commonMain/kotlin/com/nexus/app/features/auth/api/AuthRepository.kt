package com.nexus.app.features.auth.api

import com.nexus.app.core.network.ApiEndpoints
import com.nexus.app.core.network.SessionGenerationKey
import com.nexus.app.core.network.sessionCoordinator
import com.nexus.app.core.session.SessionCoordinator
import com.nexus.app.core.storage.TokenStorage
import com.nexus.app.features.auth.model.ApiErrorResponse
import com.nexus.app.features.auth.model.AuthSession
import com.nexus.app.features.auth.model.AuthUser
import com.nexus.app.features.auth.model.CurrentUserResponse
import com.nexus.app.features.auth.model.LoginRequest
import com.nexus.app.features.auth.model.RegisterRequest
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.plugins.auth.AuthCircuitBreaker
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
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.withContext

private const val CLIENT_ROLE = "USER"
private const val CLIENT_ONLY_MESSAGE = "This app is only for client accounts."

sealed interface SessionRestoration {
    data object SignedOut : SessionRestoration
    data class VerifiedClient(val user: AuthUser) : SessionRestoration
    data class CachedOfflineClient(val user: AuthUser) : SessionRestoration
    data class TemporarilyUnavailable(val error: Throwable) : SessionRestoration
}

class AuthRepository(
    private val client: HttpClient,
    private val tokenStorage: TokenStorage,
    val coordinator: SessionCoordinator = client.sessionCoordinator(tokenStorage)
) {
    suspend fun login(email: String, password: String): Result<AuthUser> = authResult {
        val generation = coordinator.beginAuthentication()
        completeAuthentication(
            client.post(ApiEndpoints.AUTH_LOGIN) {
                attributes.put(SessionGenerationKey, generation)
                header(HttpHeaders.ContentType, ContentType.Application.Json.toString())
                setBody(LoginRequest(email = email.trim(), password = password))
            }, generation
        )
    }

    suspend fun register(
        fullName: String,
        contactNumber: String,
        email: String,
        password: String
    ): Result<AuthUser> = authResult {
        val generation = coordinator.beginAuthentication()
        completeAuthentication(
            client.post(ApiEndpoints.AUTH_REGISTER) {
                attributes.put(SessionGenerationKey, generation)
                header(HttpHeaders.ContentType, ContentType.Application.Json.toString())
                setBody(
                    RegisterRequest(
                        fullName = fullName.trim(),
                        contactNumber = contactNumber.trim(),
                        email = email.trim(),
                        password = password
                    )
                )
            }, generation
        )
    }

    suspend fun currentUser(): Result<AuthUser> = authResult {
        val generation = coordinator.generation
        val response = client.get(ApiEndpoints.AUTH_ME) {
            attributes.put(SessionGenerationKey, generation)
            tokenStorage.getAccessToken()?.let {
                header(HttpHeaders.Authorization, "Bearer $it")
            }
        }
        if (!response.status.isSuccess()) {
            if (response.status.value in setOf(401, 403)) coordinator.clear(generation, expired = true)
            throw response.toAuthException()
        }
        val user = response.body<CurrentUserResponse>().user
        if (user.role != CLIENT_ROLE || !user.isActive) {
            coordinator.clear(generation, expired = true)
            throw AuthRequestException(CLIENT_ONLY_MESSAGE, 403)
        }
        if (!coordinator.verified(generation, user)) throw SessionChangedException()
        user
    }

    suspend fun restoreClientSession(): SessionRestoration {
        val generation = coordinator.generation
        if (coordinator.manager.state.value.signedOut) return SessionRestoration.SignedOut
        if (!tokenStorage.hasValidSession()) {
            if (!coordinator.manager.state.value.signedOut) coordinator.clear(generation)
            return SessionRestoration.SignedOut
        }
        val result = currentUser()
        val error = result.exceptionOrNull()
        if (result.isSuccess) return SessionRestoration.VerifiedClient(result.getOrThrow())
        if (coordinator.generation != generation || error is SessionChangedException ||
            error is AuthRequestException && error.status in setOf(401, 403)) return SessionRestoration.SignedOut
        val cached = coordinator.restoreOffline(generation)
        return if (cached != null) SessionRestoration.CachedOfflineClient(cached)
        else SessionRestoration.TemporarilyUnavailable(error!!)
    }

    suspend fun restoreSession(): Result<AuthUser?> {
        val hadSession = tokenStorage.hasValidSession() && !coordinator.manager.state.value.signedOut
        return when (val restored = restoreClientSession()) {
            SessionRestoration.SignedOut ->
                if (hadSession) Result.failure(AuthRequestException("Invalid or expired session", 401))
                else Result.success(null)
            is SessionRestoration.VerifiedClient -> Result.success(restored.user)
            is SessionRestoration.CachedOfflineClient -> Result.success(restored.user)
            is SessionRestoration.TemporarilyUnavailable -> Result.failure(restored.error)
        }
    }

    suspend fun logout(): Result<Unit> {
        val (generation, token) = withContext(NonCancellable) { coordinator.beginLogout() }
        try {
            if (token == null) return Result.success(Unit)
            val response = client.post(ApiEndpoints.AUTH_LOGOUT) {
                attributes.put(SessionGenerationKey, generation)
                attributes.put(AuthCircuitBreaker, Unit)
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
            withContext(NonCancellable) { coordinator.clear(generation) }
        }
    }

    suspend fun clearSession() = coordinator.clear()

    private suspend fun completeAuthentication(response: HttpResponse, generation: Long): AuthUser {
        if (!response.status.isSuccess()) throw response.toAuthException()
        val session = response.body<AuthSession>()
        // USER role enforcement: never store tokens for non-client accounts.
        if (session.user.role != CLIENT_ROLE || !session.user.isActive) {
            coordinator.clear(generation)
            throw AuthRequestException(CLIENT_ONLY_MESSAGE, 403)
        }
        if (session.token.isBlank() || session.refreshToken.isBlank()) throw AuthRequestException("Authentication is currently unavailable.")
        if (!coordinator.authenticate(generation, session.token, session.refreshToken, session.user)) throw SessionChangedException()
        return session.user
    }
}

class AuthRequestException(message: String, val status: Int? = null) : Exception(message)

internal class SessionChangedException : Exception("The session changed. Please try again.")

private suspend fun HttpResponse.toAuthException(): AuthRequestException {
    val serverMessage = try { body<ApiErrorResponse>().error }
        catch (e: CancellationException) { throw e }
        catch (_: Exception) { null }
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
