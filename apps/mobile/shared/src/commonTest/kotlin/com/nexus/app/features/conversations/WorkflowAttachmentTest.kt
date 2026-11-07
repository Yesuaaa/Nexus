package com.nexus.app.features.conversations

import com.nexus.app.core.files.*
import com.nexus.app.features.workflow.api.WorkflowRepository
import com.nexus.app.features.workflow.viewmodel.WorkflowViewModel
import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.*
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.plugins.defaultRequest
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.json
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.*
import kotlinx.serialization.json.Json
import kotlin.test.*

@OptIn(ExperimentalCoroutinesApi::class)
class WorkflowAttachmentTest {
    @BeforeTest fun setup() = Dispatchers.setMain(UnconfinedTestDispatcher())
    @AfterTest fun cleanup() = Dispatchers.resetMain()

    @Test fun fetchesEligibleBookingsAndUploadsToChosenBooking() = runTest {
        val uploads = mutableListOf<String>()
        val client = client { request ->
            val path = request.url.encodedPath
            if (request.method == HttpMethod.Post) {
                uploads += path
                respond("""{"file":{"id":"file","name":"brief.txt","mimeType":"text/plain","size":5}}""", headers = headers)
            } else {
                val id = path.substringAfterLast('/')
                respond(workflow(id, if (id == "default") "ON_HOLD" else "CONSULTATION"), headers = headers)
            }
        }
        client.use {
            val vm = WorkflowViewModel(WorkflowRepository(it))
            vm.open("default")
            vm.state.first { state -> !state.busy }
            vm.loadAttachmentOptions(listOf("default", "chosen"))
            vm.state.first { state -> !state.busy }
            assertEquals(listOf("chosen"), vm.state.value.attachmentOptions.map { option -> option.request.id })
            vm.upload(files, "chosen")
            vm.state.first { state -> !state.busy }
            assertEquals(listOf("/api/request-workflows/chosen/files"), uploads)
            assertEquals("chosen", vm.state.value.workflow?.request?.id)
            assertEquals("file", vm.state.value.selectedFileId)
            assertNull(vm.state.value.error)
        }
    }

    @Test fun rechecksStageBeforeOpeningFilePicker() = runTest {
        var stage = "CONSULTATION"
        var picks = 0
        client { request ->
            assertEquals(HttpMethod.Get, request.method)
            respond(workflow("chosen", stage), headers = headers)
        }.use {
            val vm = WorkflowViewModel(WorkflowRepository(it))
            vm.loadAttachmentOptions(listOf("chosen"))
            vm.state.first { state -> !state.busy }
            assertEquals(1, vm.state.value.attachmentOptions.size)
            stage = "ON_HOLD"
            vm.upload(object : PlatformFiles by files {
                override suspend fun select(): SelectedFile? { picks++; return files.select() }
            }, "chosen")
            vm.state.first { state -> !state.busy }
            assertEquals(0, picks)
            assertEquals("ON_HOLD", vm.state.value.workflow?.state)
            assertNotNull(vm.state.value.error)
            assertFalse(vm.state.value.busy)
        }
    }

    private val headers = headersOf(HttpHeaders.ContentType, "application/json")
    private fun workflow(id: String, stage: String) = """{"request":{"id":"$id"},"state":"$stage","version":1,"nextAction":"","permissions":{"isClient":true}}"""
    private val files = object : PlatformFiles {
        override suspend fun select() = SelectedFile("brief.txt", "text/plain", "brief".encodeToByteArray())
        override suspend fun save(file: SelectedFile) = Unit
        override suspend fun preview(file: SelectedFile) = Unit
    }
    private fun client(handler: MockRequestHandler) = HttpClient(MockEngine(handler)) {
        defaultRequest { contentType(ContentType.Application.Json) }
        install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) }
    }
}
