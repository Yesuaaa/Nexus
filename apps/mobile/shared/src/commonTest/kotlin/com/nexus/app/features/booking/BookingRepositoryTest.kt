package com.nexus.app.features.booking

import com.nexus.app.features.booking.api.BookingRepository
import com.nexus.app.features.booking.model.*
import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.*
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.HttpRequestData
import io.ktor.http.*
import io.ktor.http.content.TextContent
import io.ktor.serialization.kotlinx.json.json
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.*
import kotlin.test.*

class BookingRepositoryTest {
    private fun client(handler: MockRequestHandler) = HttpClient(MockEngine(handler)) {
        install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true; encodeDefaults = true }) }
        expectSuccess = false
    }
    @Test fun cancellationUsesDirectEndpointBeforeAcceptance() = runTest {
        val paths = mutableListOf<String>()
        val client = client {
            paths += it.url.encodedPath
            assertEquals(HttpMethod.Post, it.method)
            respond("{}", HttpStatusCode.OK, headersOf(HttpHeaders.ContentType, "application/json"))
        }
        try {
            BookingRepository(client).cancel(RequestRecord("request", service = RequestService("s", "S")), "key")
            assertEquals(listOf("/api/client/service-requests/request/cancel"), paths)
        } finally { client.close() }
    }
    @Test fun acceptedCancellationReadsVersionAndReusesActionId() = runTest {
        val paths = mutableListOf<String>()
        var action: JsonObject? = null
        val client = client {
            paths += it.url.encodedPath
            if (it.method == HttpMethod.Post) action = Json.parseToJsonElement((it.body as TextContent).text).jsonObject
            respond(if (it.method == HttpMethod.Get) """{"version":7}""" else "{}",
                HttpStatusCode.OK, headersOf(HttpHeaders.ContentType, "application/json"))
        }
        try {
            BookingRepository(client).cancel(RequestRecord("request", acceptedDepartmentId = "dept",
                service = RequestService("s", "S")), "same-action")
            assertEquals(listOf("/api/request-workflows/request", "/api/request-workflows/request/actions"), paths)
            assertEquals("same-action", action?.get("actionId")?.jsonPrimitive?.content)
            assertEquals(7, action?.get("expectedVersion")?.jsonPrimitive?.int)
            assertEquals("CANCEL", action?.get("type")?.jsonPrimitive?.content)
        } finally { client.close() }
    }
    @Test fun historySearchFiltersAndSortAreUrlEncoded() = runTest {
        var request: HttpRequestData? = null
        val client = client {
            request = it
            respond("{}", HttpStatusCode.OK, headersOf(HttpHeaders.ContentType, "application/json"))
        }
        try {
            BookingRepository(client).requests(RequestFilters("Brand & web", "CLOSED", "asc", 3))
            assertEquals("Brand & web", request?.url?.parameters?.get("search"))
            assertEquals("3", request?.url?.parameters?.get("page"))
            assertEquals("CLOSED", request?.url?.parameters?.get("status"))
            assertEquals("asc", request?.url?.parameters?.get("sortOrder"))
        } finally { client.close() }
    }
}
