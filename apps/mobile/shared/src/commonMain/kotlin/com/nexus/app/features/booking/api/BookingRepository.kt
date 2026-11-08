package com.nexus.app.features.booking.api

import com.nexus.app.core.network.ApiEndpoints
import com.nexus.app.core.network.repositoryResult
import com.nexus.app.features.services.model.CreateServiceRequestDto
import com.nexus.app.features.services.model.BookingReceiptDto
import kotlinx.coroutines.CancellationException
import com.nexus.app.features.auth.model.ApiErrorResponse
import com.nexus.app.features.booking.model.*
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.*
import io.ktor.client.statement.HttpResponse
import io.ktor.http.isSuccess
import io.ktor.http.ContentType
import io.ktor.http.contentType
import io.ktor.http.encodeURLPathPart
import kotlinx.serialization.Serializable

interface BookingGateway {
    suspend fun services(): List<CatalogService>
    suspend fun service(id: String): CatalogService
    suspend fun specialists(serviceId: String): List<Specialist>
    suspend fun specialistProfile(serviceId: String, specialistId: String): SpecialistProfile
    suspend fun submit(draft: BookingDraft): RequestReceipt
    suspend fun requests(filters: RequestFilters): RequestsPage
    suspend fun request(id: String): RequestRecord
    suspend fun cancel(request: RequestRecord, actionId: String)
}
class BookingApiException(message: String, val status: Int) : Exception(message)

@Serializable private data class CatalogResponse(val services: List<CatalogService>)
@Serializable private data class ServiceResponse(val service: CatalogService)
@Serializable private data class SpecialistsResponse(val specialists: List<Specialist>)
@Serializable private data class ProfileResponse(val specialist: SpecialistProfile)
@Serializable private data class ReceiptResponse(val serviceRequest: RequestReceipt)
@Serializable private data class DetailResponse(val serviceRequest: RequestRecord)
@Serializable private data class WorkflowVersion(val version: Int)
@Serializable private data class CancelAction(
    val actionId: String, val expectedVersion: Int,
    val type: String = "CANCEL", val note: String = "Cancelled by the client from the mobile app."
)

class BookingRepository(private val client: HttpClient) : BookingGateway {
    /** Reuse submissionKey (UUID v4) after a transport failure; writes are never automatically retried. */
    suspend fun submitBooking(request: CreateServiceRequestDto, submissionKey: String): Result<BookingReceiptDto> =
        repositoryResult {
            submit(BookingDraft(
                serviceId = request.serviceId, packageId = request.packageId,
                preferredSpecialistId = request.preferredSpecialistId, submissionKey = submissionKey,
                goals = request.goals, requirements = request.requirements,
                expectedTimeline = request.expectedTimeline, additionalDetails = request.additionalDetails
            ))
        }

    /** Fetch current acceptance state before choosing the backend cancellation route. */
    suspend fun cancelRequest(requestId: String): Result<Unit> = repositoryResult {
        cancel(request(requestId), newSubmissionKey())
    }

    override suspend fun services() = checked(client.get(ApiEndpoints.CLIENT_SERVICES)).body<CatalogResponse>().services.filter { it.isActive }
    override suspend fun service(id: String) = checked(client.get(ApiEndpoints.clientServiceDetails(id.encodeURLPathPart()))).body<ServiceResponse>().service
    override suspend fun specialists(serviceId: String) = checked(client.get(ApiEndpoints.clientServiceSpecialists(serviceId.encodeURLPathPart()))).body<SpecialistsResponse>().specialists
    override suspend fun specialistProfile(serviceId: String, specialistId: String) =
        checked(client.get("/api/services/${serviceId.encodeURLPathPart()}/specialists/${specialistId.encodeURLPathPart()}"))
            .body<ProfileResponse>().specialist
    override suspend fun submit(draft: BookingDraft) = checked(client.post(ApiEndpoints.CLIENT_SERVICE_REQUESTS) {
        contentType(ContentType.Application.Json)
        setBody(draft.normalized())
    }).body<ReceiptResponse>().serviceRequest
    override suspend fun requests(filters: RequestFilters) = checked(client.get(ApiEndpoints.CLIENT_SERVICE_REQUESTS) {
        parameter("page", filters.page)
        parameter("search", filters.search)
        parameter("status", filters.status)
        parameter("sortOrder", filters.sortOrder)
    }).body<RequestsPage>()
    override suspend fun request(id: String) = checked(client.get("/api/service-requests/${id.encodeURLPathPart()}"))
        .body<DetailResponse>().serviceRequest
    override suspend fun cancel(request: RequestRecord, actionId: String) {
        if (request.acceptedDepartmentId == null) {
            checked(client.post(ApiEndpoints.cancelServiceRequest(request.id.encodeURLPathPart())))
        } else {
            val path = "/api/request-workflows/${request.id.encodeURLPathPart()}"
            val version = checked(client.get(path)).body<WorkflowVersion>().version
            checked(client.post("$path/actions") {
                contentType(ContentType.Application.Json)
                setBody(CancelAction(actionId, version))
            })
        }
    }
    private suspend fun checked(response: HttpResponse): HttpResponse {
        if (!response.status.isSuccess()) {
            val message = try {
                response.body<ApiErrorResponse>().error
            } catch (error: CancellationException) {
                throw error
            } catch (_: Exception) {
                null
            }
            throw BookingApiException(message ?: "Request failed. Please retry.", response.status.value)
        }
        return response
    }
}
