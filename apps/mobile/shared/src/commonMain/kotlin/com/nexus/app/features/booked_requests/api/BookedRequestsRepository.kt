package com.nexus.app.features.booked_requests.api

import com.nexus.app.core.network.repositoryResult
import com.nexus.app.features.booked_requests.model.BookedRequestsResponse
import com.nexus.app.features.booking.api.BookingRepository
import com.nexus.app.features.booking.model.RequestFilters
import io.ktor.client.HttpClient

class BookedRequestsRepository(client: HttpClient) {
    private val gateway = BookingRepository(client)

    /** The first page and account-wide KPIs. Use the overload to load further pages. */
    suspend fun getClientRequests(): Result<BookedRequestsResponse> = getClientRequests(RequestFilters())

    suspend fun getClientRequests(filters: RequestFilters): Result<BookedRequestsResponse> =
        repositoryResult { gateway.requests(filters) }
}
