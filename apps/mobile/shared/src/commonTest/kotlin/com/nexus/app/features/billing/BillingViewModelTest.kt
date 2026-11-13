package com.nexus.app.features.billing

import com.nexus.app.core.files.PlatformFiles
import com.nexus.app.core.files.SelectedFile
import com.nexus.app.features.billing.api.BillingRepository
import com.nexus.app.features.billing.model.BillingPayment
import com.nexus.app.features.billing.model.BillingProofFile
import com.nexus.app.features.billing.viewmodel.BillingViewModel
import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.headersOf
import io.ktor.serialization.kotlinx.json.json
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kotlinx.serialization.json.Json
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertContentEquals
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

@OptIn(ExperimentalCoroutinesApi::class)
class BillingViewModelTest {
    @BeforeTest
    fun setup() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @AfterTest
    fun cleanup() {
        Dispatchers.resetMain()
    }

    private fun createClient(
        billingJson: String = "[]",
        billingStatus: HttpStatusCode = HttpStatusCode.OK,
        fileBytes: ByteArray = byteArrayOf(1, 2, 3, 4),
        fileStatus: HttpStatusCode = HttpStatusCode.OK
    ): HttpClient {
        val engine = MockEngine { request ->
            when {
                request.url.encodedPath == "/api/request-workflows/billing" -> respond(
                    content = billingJson,
                    status = billingStatus,
                    headers = headersOf(HttpHeaders.ContentType, ContentType.Application.Json.toString())
                )
                request.url.encodedPath.startsWith("/api/request-workflows/") &&
                    request.url.encodedPath.contains("/files/") -> respond(
                    content = fileBytes,
                    status = fileStatus,
                    headers = headersOf(HttpHeaders.ContentType, ContentType.Image.PNG.toString())
                )
                else -> respond(
                    content = """{"error":"Not found"}""",
                    status = HttpStatusCode.NotFound,
                    headers = headersOf(HttpHeaders.ContentType, ContentType.Application.Json.toString())
                )
            }
        }
        return HttpClient(engine) {
            install(ContentNegotiation) {
                json(Json { ignoreUnknownKeys = true })
            }
        }
    }

    @Test
    fun loadSeparatesDueSortedByApprovedAtAndHistory() = runTest {
        val json = """
            [
              {
                "id": "p-later",
                "requestId": "req-2",
                "serviceName": "Tax Filing",
                "bookingReference": "BK-002",
                "amount": "2500.00",
                "currency": "PHP",
                "status": "PENDING",
                "approvedAt": "2026-11-12T10:00:00.000Z"
              },
              {
                "id": "p-verified",
                "requestId": "req-3",
                "serviceName": "Audit",
                "bookingReference": "BK-003",
                "amount": "5000.00",
                "currency": "PHP",
                "status": "VERIFIED",
                "verifiedAt": "2026-11-05T08:00:00.000Z"
              },
              {
                "id": "p-earlier",
                "requestId": "req-1",
                "serviceName": "Bookkeeping",
                "bookingReference": "BK-001",
                "amount": "1500.00",
                "currency": "PHP",
                "status": "PENDING",
                "approvedAt": "2026-11-10T10:00:00.000Z"
              }
            ]
        """.trimIndent()

        val client = createClient(billingJson = json)
        val vm = BillingViewModel(BillingRepository(client))
        vm.load()
        vm.state.first { !it.loading }

        assertNull(vm.state.value.error)
        assertEquals(listOf("p-earlier", "p-later"), vm.state.value.due.map { it.id })
        assertEquals(listOf("p-verified"), vm.state.value.history.map { it.id })
        client.close()
    }

    @Test
    fun loadSurfacesErrorOnFailure() = runTest {
        val client = createClient(
            billingJson = """{"error":"Unauthorized"}""",
            billingStatus = HttpStatusCode.Unauthorized
        )
        val vm = BillingViewModel(BillingRepository(client))
        vm.load()
        vm.state.first { !it.loading }

        assertEquals("Unauthorized", vm.state.value.error)
        assertTrue(vm.state.value.due.isEmpty())
        assertTrue(vm.state.value.history.isEmpty())
        client.close()
    }

    @Test
    fun selectPaymentLoadsImageProofPreviewAndSkipsSandbox() = runTest {
        val imageBytes = byteArrayOf(10, 20, 30)
        val client = createClient(fileBytes = imageBytes)
        val vm = BillingViewModel(BillingRepository(client))

        val normalPayment = BillingPayment(
            id = "p-1",
            requestId = "req-1",
            serviceName = "Bookkeeping",
            amount = "1500.00",
            status = "SUBMITTED",
            sandbox = false,
            proofFile = BillingProofFile(id = "f-1", name = "proof.png", mimeType = "image/png")
        )
        vm.selectPayment(normalPayment)
        vm.state.first { !it.proofPreviewLoading }

        assertNotNull(vm.state.value.proofPreview)
        assertContentEquals(imageBytes, vm.state.value.proofPreview!!.bytes)
        assertFalse(vm.state.value.proofExpanded)
        vm.toggleProofExpanded()
        assertTrue(vm.state.value.proofExpanded)

        val sandboxPayment = normalPayment.copy(id = "p-2", status = "VERIFIED", sandbox = true)
        vm.selectPayment(sandboxPayment)
        assertNull(vm.state.value.proofPreview)
        assertFalse(vm.state.value.proofPreviewLoading)

        client.close()
    }

    @Test
    fun downloadProofSavesFileViaPlatformFiles() = runTest {
        val pdfBytes = byteArrayOf(37, 80, 68, 70)
        val client = createClient(fileBytes = pdfBytes)
        val vm = BillingViewModel(BillingRepository(client))
        val saved = mutableListOf<SelectedFile>()
        val fakePlatform = object : PlatformFiles {
            override suspend fun select(): SelectedFile? = null
            override suspend fun save(file: SelectedFile) {
                saved += file
            }
            override suspend fun preview(file: SelectedFile) {}
        }

        val payment = BillingPayment(
            id = "p-1",
            requestId = "req-1",
            serviceName = "Advisory",
            amount = "3000.00",
            status = "VERIFIED",
            sandbox = true,
            proofFile = BillingProofFile(id = "f-1", name = "receipt.pdf", mimeType = "application/pdf")
        )
        vm.selectPayment(payment)
        vm.downloadProof(fakePlatform)
        vm.state.first { !it.downloading }

        assertNull(vm.state.value.downloadError)
        assertEquals(1, saved.size)
        assertEquals("receipt.pdf", saved.first().name)
        assertContentEquals(pdfBytes, saved.first().bytes)
        client.close()
    }
}
