package com.nexus.app.features.services.api

import com.nexus.app.core.network.RepositoryErrorKind
import com.nexus.app.core.network.RepositoryException
import com.nexus.app.features.booked_requests.api.BookedRequestsRepository
import com.nexus.app.features.booking.api.BookingRepository
import com.nexus.app.features.booking.model.RequestFilters
import com.nexus.app.features.services.model.CreateServiceRequestDto
import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.*
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.http.*
import io.ktor.http.content.TextContent
import io.ktor.serialization.kotlinx.json.json
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.test.runTest
import kotlinx.io.IOException
import kotlinx.serialization.json.*
import kotlin.test.*

class RepositoriesTest {
    private val headers = headersOf(HttpHeaders.ContentType, "application/json")
    private val key = "12345678-1234-4123-8123-123456789012"
    private val booking = CreateServiceRequestDto("s", " Goals ", " Requirements ", " Soon ")
    private val service = """{"id":"s","name":"Design","unknown":true,"pricingTemplate":{"amount":"1200.50","pricingModel":"FIXED","isPublic":true},"packages":[{"id":"p","name":"Basic","amount":null,"billingInterval":null}],"keyBenefits":[{"id":"b","title":"Quality"}],"departments":[{"id":"d","name":"Design"}]}"""
    private val record = """{"id":"r","service":{"id":"s","name":"Design"},"referenceNumber":null,"additionalDetails":null,"quotedPrice":"1234.50","preferredSpecialist":{"id":"e","fullName":"Alex","position":null}}"""

    private fun client(handler: MockRequestHandler) = HttpClient(MockEngine(handler)) {
        install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true; encodeDefaults = true }) }
        expectSuccess = false
    }

    @Test fun catalogAndDetailsDecodeNestedDataAndIgnoreFutureFields() = runTest {
        val paths = mutableListOf<String>()
        val client = client {
            paths += it.url.encodedPath
            assertEquals(HttpMethod.Get, it.method)
            respond(if (paths.size == 1) """{"services":[$service]}""" else """{"service":$service}""", HttpStatusCode.OK, headers)
        }
        try {
            val repository = ServicesRepository(client)
            val catalog = repository.getServices().getOrThrow()
            val detail = repository.getServiceDetails("s /?#").getOrThrow()
            assertEquals(catalog.single(), detail)
            assertEquals("1200.50", detail.pricingTemplate?.amount)
            assertNull(detail.packages.single().amount)
            assertEquals("Quality", detail.keyBenefits.single().title)
            assertEquals("Design", detail.departments.single().name)
            assertEquals(listOf("/api/client/services", "/api/client/services/s%20%2F%3F%23"), paths)
        } finally { client.close() }
    }

    @Test fun specialistsDecodeBackendPhotoField() = runTest {
        val client = client {
            assertEquals("/api/client/services/s/specialists", it.url.encodedPath)
            respond("""{"specialists":[{"id":"e","fullName":"Alex","profileImageUrl":"/photo.png","department":null}]}""", HttpStatusCode.OK, headers)
        }
        try {
            assertEquals("/photo.png", ServicesRepository(client).getSpecialists("s").getOrThrow().single().imageUrl)
        } finally { client.close() }
    }

    @Test fun historyDecodesKpisPaginationAndNullableFields() = runTest {
        val client = client {
            assertEquals("/api/client/service-requests", it.url.encodedPath)
            assertEquals("2", it.url.parameters["page"])
            assertEquals("Brand & web", it.url.parameters["search"])
            respond("""{"requests":[$record],"total":11,"page":2,"pageSize":10,"summary":{"total":20,"pending":5,"inProgress":7,"completed":6,"cancelled":2}}""", HttpStatusCode.OK, headers)
        }
        try {
            val page = BookedRequestsRepository(client).getClientRequests(RequestFilters(page = 2, search = "Brand & web")).getOrThrow()
            assertEquals(2, page.pages)
            assertEquals(20, page.summary.total)
            assertEquals(5, page.summary.pending)
            assertEquals(7, page.summary.inProgress)
            assertEquals(6, page.summary.completed)
            assertEquals(2, page.summary.cancelled)
            assertNull(page.requests.single().referenceNumber)
            assertEquals("1234.50", page.requests.single().quotedPrice)
            assertEquals("Alex", page.requests.single().preferredSpecialist?.fullName)
        } finally { client.close() }
    }

    @Test fun bookingCanRecoverFromLostResponseUsingSameSubmissionKey() = runTest {
        val bodies = mutableListOf<JsonObject>()
        val client = client {
            assertEquals(HttpMethod.Post, it.method)
            assertEquals("/api/client/service-requests", it.url.encodedPath)
            assertEquals(ContentType.Application.Json, it.body.contentType)
            bodies += Json.parseToJsonElement((it.body as TextContent).text).jsonObject
            if (bodies.size == 1) throw IOException("Connection lost")
            respond("""{"serviceRequest":{"id":"r","referenceNumber":"SR-1","status":"SUBMITTED","createdAt":"2026-11-04T00:00:00Z"}}""", HttpStatusCode.Created, headers)
        }
        try {
            val repository = BookingRepository(client)
            assertEquals(RepositoryErrorKind.NETWORK, assertIs<RepositoryException>(repository.submitBooking(booking, key).exceptionOrNull()).kind)
            assertEquals(1, bodies.size) // No automatic replay of writes.
            val receipt = repository.submitBooking(booking, key).getOrThrow()
            assertEquals("SR-1", receipt.referenceNumber)
            assertEquals("SUBMITTED", receipt.status)
            assertEquals("2026-11-04T00:00:00Z", receipt.createdAt)
            assertEquals(bodies.first(), bodies.last())
            assertEquals(key, bodies.last()["submissionKey"]?.jsonPrimitive?.content)
            assertEquals(JsonNull, bodies.last()["packageId"])
            assertEquals(JsonNull, bodies.last()["preferredSpecialistId"])
            assertEquals("Goals", bodies.last()["goals"]?.jsonPrimitive?.content)
        } finally { client.close() }
    }

    @Test fun everyPublicOperationMapsHttpFailures() = runTest {
        val statuses = mapOf(400 to RepositoryErrorKind.VALIDATION, 401 to RepositoryErrorKind.UNAUTHORIZED,
            409 to RepositoryErrorKind.CONFLICT, 500 to RepositoryErrorKind.SERVER)
        for ((status, kind) in statuses) {
            val client = client { respond("""{"error":"Backend message"}""", HttpStatusCode.fromValue(status), headers) }
            try {
                val services = ServicesRepository(client)
                val bookings = BookingRepository(client)
                val results = listOf(services.getServices(), services.getServiceDetails("s"), services.getSpecialists("s"),
                    bookings.submitBooking(booking, key), bookings.cancelRequest("r"),
                    BookedRequestsRepository(client).getClientRequests())
                results.forEach { result ->
                    val error = assertIs<RepositoryException>(result.exceptionOrNull())
                    assertEquals(kind, error.kind)
                    assertEquals(status, error.status)
                    assertEquals("Backend message", error.message)
                }
            } finally { client.close() }
        }
    }

    @Test fun malformedErrorBodyPreservesHttpStatus() = runTest {
        val client = client { respond("<html>Unavailable</html>", HttpStatusCode.InternalServerError, headers) }
        try {
            val error = assertIs<RepositoryException>(ServicesRepository(client).getServices().exceptionOrNull())
            assertEquals(RepositoryErrorKind.SERVER, error.kind)
            assertEquals(500, error.status)
        } finally { client.close() }
    }

    @Test fun malformedSuccessIsDecodingFailureAndNextReadRecovers() = runTest {
        var calls = 0
        val client = client {
            calls++
            respond(if (calls == 1) """{"services":[{"name":"Missing id"}]}""" else """{"services":[]}""", HttpStatusCode.OK, headers)
        }
        try {
            val repository = ServicesRepository(client)
            assertEquals(RepositoryErrorKind.DECODING, assertIs<RepositoryException>(repository.getServices().exceptionOrNull()).kind)
            assertEquals(emptyList(), repository.getServices().getOrThrow())
        } finally { client.close() }
    }

    @Test fun historyReadRecoversAfterNetworkFailure() = runTest {
        var calls = 0
        val client = client {
            if (++calls == 1) throw IOException("Offline")
            respond("""{"requests":[],"total":0,"page":1,"pageSize":10,"summary":{"total":0}}""", HttpStatusCode.OK, headers)
        }
        try {
            val repository = BookedRequestsRepository(client)
            assertEquals(RepositoryErrorKind.NETWORK, assertIs<RepositoryException>(repository.getClientRequests().exceptionOrNull()).kind)
            assertTrue(repository.getClientRequests().getOrThrow().requests.isEmpty())
        } finally { client.close() }
    }

    @Test fun coroutineCancellationPropagates() = runTest {
        val client = client { throw CancellationException("ViewModel cleared") }
        try {
            assertFailsWith<CancellationException> { ServicesRepository(client).getServices() }
        } finally { client.close() }
    }

    @Test fun cancelByIdUsesCurrentAcceptanceState() = runTest {
        for (accepted in listOf(false, true)) {
            val paths = mutableListOf<String>()
            val client = client {
                paths += it.url.encodedPath
                val response = when (paths.size) {
                    1 -> """{"serviceRequest":${record.dropLast(1)},"acceptedDepartmentId":${if (accepted) "\"d\"" else "null"}}}"""
                    2 -> if (accepted) """{"version":7}""" else ""
                    else -> {
                        val body = Json.parseToJsonElement((it.body as TextContent).text).jsonObject
                        assertEquals("CANCEL", body["type"]?.jsonPrimitive?.content)
                        assertEquals(7, body["expectedVersion"]?.jsonPrimitive?.int)
                        assertFalse(body["actionId"]?.jsonPrimitive?.content.isNullOrBlank())
                        ""
                    }
                }
                assertEquals(if (paths.size == 1 || (accepted && paths.size == 2)) HttpMethod.Get else HttpMethod.Post, it.method)
                respond(response, if (response.isEmpty()) HttpStatusCode.NoContent else HttpStatusCode.OK, headers)
            }
            try {
                assertEquals(Unit, BookingRepository(client).cancelRequest("r").getOrThrow())
                assertEquals(if (accepted) listOf("/api/service-requests/r", "/api/request-workflows/r", "/api/request-workflows/r/actions")
                    else listOf("/api/service-requests/r", "/api/client/service-requests/r/cancel"), paths)
            } finally { client.close() }
        }
    }
}
