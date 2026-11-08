package com.nexus.app.core.network

import com.nexus.app.features.booking.api.BookingApiException
import io.ktor.client.plugins.ResponseException
import io.ktor.client.plugins.HttpRequestTimeoutException
import kotlinx.coroutines.CancellationException
import kotlinx.io.IOException
import kotlinx.serialization.SerializationException

enum class RepositoryErrorKind {
    VALIDATION, UNAUTHORIZED, CONFLICT, SERVER, HTTP, NETWORK, DECODING, UNKNOWN
}

/** Inspect [kind] in ViewModels; [status] is present for HTTP failures. */
class RepositoryException(
    val kind: RepositoryErrorKind,
    message: String,
    val status: Int? = null,
    cause: Throwable? = null
) : Exception(message, cause)

internal suspend fun <T> repositoryResult(block: suspend () -> T): Result<T> = try {
    Result.success(block())
} catch (error: CancellationException) {
    throw error
} catch (error: Exception) {
    val status = when (error) {
        is BookingApiException -> error.status
        is ResponseException -> error.response.status.value
        else -> null
    }
    val kind = when {
        status == 400 -> RepositoryErrorKind.VALIDATION
        status == 401 -> RepositoryErrorKind.UNAUTHORIZED
        status == 409 -> RepositoryErrorKind.CONFLICT
        status != null && status >= 500 -> RepositoryErrorKind.SERVER
        status != null -> RepositoryErrorKind.HTTP
        error is IOException || error is ApiConnectionException ||
            error is SessionRefreshUnavailableException || error is HttpRequestTimeoutException -> RepositoryErrorKind.NETWORK
        error is SerializationException || error is io.ktor.serialization.JsonConvertException -> RepositoryErrorKind.DECODING
        else -> RepositoryErrorKind.UNKNOWN
    }
    Result.failure(RepositoryException(kind, error.message ?: "Request failed. Please retry.", status, error))
}
