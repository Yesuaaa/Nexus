package com.nexus.app.features.profile

import com.nexus.app.core.files.SelectedFile
import com.nexus.app.core.session.SessionManager
import com.nexus.app.features.profile.api.*
import com.nexus.app.features.profile.model.*
import com.nexus.app.features.profile.screens.dateLabel
import com.nexus.app.features.profile.viewmodel.ProfileViewModel
import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.*
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.http.*
import io.ktor.http.content.TextContent
import io.ktor.serialization.kotlinx.json.json
import kotlinx.coroutines.*
import kotlinx.coroutines.test.*
import kotlinx.coroutines.flow.first
import kotlinx.serialization.json.Json
import kotlin.test.*

@OptIn(ExperimentalCoroutinesApi::class)
class ProfileRepositoryTest {
    @BeforeTest fun setup() = Dispatchers.setMain(UnconfinedTestDispatcher())
    @AfterTest fun cleanup() = Dispatchers.resetMain()
    @Test fun editsUpdateTheSharedSessionAndPreferencesPersist() = runTest {
        val backend = FakeProfileBackend()
        val session = SessionManager()
        val vm = ProfileViewModel(backend.repository, session)
        vm.state.first { !it.loading && !it.busy }
        var done = false
        vm.save(" Updated Client ", " 09123456789 ") { done = true }
        vm.state.first { !it.loading && !it.busy }
        assertTrue(done, vm.state.value.error)
        assertEquals("Updated Client", session.user.value?.fullName)
        assertEquals("09123456789", session.user.value?.contactNumber)
        assertEquals(1, backend.personalSaves)
        vm.preferences(Preferences("UTC", "YYYY-MM-DD", "24h", false))
        vm.state.first { !it.loading && !it.busy }
        assertEquals(backend.repository.settings().preferences, vm.state.value.settings?.preferences)
        assertFalse(vm.state.value.busy)
        backend.client.close()
    }
    @Test fun revokingOtherSessionsPreservesTheCurrentSession() = runTest {
        val backend = FakeProfileBackend()
        val vm = ProfileViewModel(backend.repository, SessionManager())
        vm.state.first { !it.loading && !it.busy }
        vm.revoke("other")
        vm.state.first { !it.loading && !it.busy }
        assertEquals(1, backend.revocations)
        assertTrue(vm.state.value.settings!!.sessions.single().current)
        backend.client.close()
    }
    @Test fun passwordAndSessionEndpointsAcceptNoContent() = runTest {
        val backend = FakeProfileBackend()
        backend.repository.password(PasswordChange("old", "new"))
        backend.repository.revokeOthers()
        assertEquals(1, backend.passwordSaves)
        assertEquals(1, backend.revocations)
        backend.client.close()
    }
    @Test fun backendValidationErrorsRemainVisible() = runTest {
        val client = HttpClient(MockEngine { respond("""{"error":"Current password is incorrect"}""", HttpStatusCode.BadRequest, headersOf(HttpHeaders.ContentType, "application/json")) }) { install(ContentNegotiation) { json() } }
        val exception = assertFailsWith<IllegalStateException> { ProfileRepository(client).password(PasswordChange("wrong", "new")) }
        assertEquals("Current password is incorrect", exception.message)
        client.close()
    }
    @Test fun imageUploadUsesTheExistingDataUrlContract() = runTest {
        val backend = FakeProfileBackend()
        val client = HttpClient(MockEngine { request ->
            assertEquals("/api/auth/profile/images", request.url.encodedPath)
            assertEquals(HttpMethod.Post, request.method)
            val payload = Json.decodeFromString<ImageUpload>((request.body as TextContent).text)
            assertEquals("avatar", payload.kind)
            assertEquals("data:image/png;base64,AQID", payload.dataUrl)
            respond("""{"profile":${backend.profileJson}}""", HttpStatusCode.OK, headersOf(HttpHeaders.ContentType, "application/json"))
        }) { install(ContentNegotiation) { json() } }
        assertEquals("client", ProfileRepository(client).upload("avatar", SelectedFile("photo.png", "image/png", byteArrayOf(1,2,3))).user.id)
        client.close(); backend.client.close()
    }
    @Test fun invalidImagesAreRejectedBeforeUploading() {
        assertFailsWith<IllegalArgumentException> { validateProfileImage(SelectedFile("document.pdf", "application/pdf", byteArrayOf(1))) }
        assertFailsWith<IllegalArgumentException> { validateProfileImage(SelectedFile("large.png", "image/png", ByteArray(2 * 1024 * 1024 + 1))) }
        assertFailsWith<IllegalArgumentException> { validateProfileImage(SelectedFile("empty.png", "image/png", byteArrayOf())) }
    }
    @Test fun datePreviewRespectsTimezoneAndDateFormat() {
        assertEquals("02/11/2026", dateLabel("2026-11-01T23:00:00Z", Preferences("Asia/Manila", "DD/MM/YYYY")))
        assertEquals("2026-11-01", dateLabel("2026-11-01T23:00:00Z", Preferences("UTC", "YYYY-MM-DD")))
    }
}
