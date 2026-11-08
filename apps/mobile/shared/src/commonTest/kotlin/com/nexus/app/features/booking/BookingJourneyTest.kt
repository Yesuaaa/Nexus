package com.nexus.app.features.booking

import com.nexus.app.features.booking.api.*
import com.nexus.app.features.booking.model.*
import com.nexus.app.features.booking.viewmodel.BookingViewModel
import com.nexus.app.features.booked_requests.viewmodel.RequestsViewModel
import kotlinx.coroutines.*
import kotlinx.coroutines.test.*
import kotlin.test.*

internal class FakeBookingGateway : BookingGateway {
    val service = CatalogService("service", "Design", packages = listOf(ServicePackage("pkg", "Standard")))
    val record = RequestRecord("request", service = RequestService("service", "Design"))
    var submission: suspend (BookingDraft) -> RequestReceipt = { RequestReceipt("request") }
    var cancellation: suspend () -> Unit = {}
    val submissions = mutableListOf<BookingDraft>()
    val filters = mutableListOf<RequestFilters>()
    var cancellations = 0
    var listFailure = false
    var details: suspend (String) -> RequestRecord = { record.copy(id = it) }
    val actionIds = mutableListOf<String>()
    override suspend fun services() = listOf(service)
    override suspend fun service(id: String) = service
    override suspend fun specialists(serviceId: String) = listOf(Specialist("eligible", "Alex"))
    override suspend fun specialistProfile(serviceId: String, specialistId: String) = SpecialistProfile(specialistId, "Alex")
    override suspend fun submit(draft: BookingDraft): RequestReceipt { submissions += draft; return submission(draft) }
    override suspend fun requests(filters: RequestFilters): RequestsPage {
        this.filters += filters
        if (listFailure) throw Exception("Connection lost")
        return RequestsPage(listOf(record), total = 21, page = filters.page, summary = RequestSummary(total = 21))
    }
    override suspend fun request(id: String) = details(id)
    override suspend fun cancel(request: RequestRecord, actionId: String) { cancellations++; actionIds += actionId; cancellation() }
}

@OptIn(ExperimentalCoroutinesApi::class)
class BookingJourneyTest {
    @BeforeTest fun setup() = Dispatchers.setMain(UnconfinedTestDispatcher())
    @AfterTest fun teardown() = Dispatchers.resetMain()

    private fun ready(repository: FakeBookingGateway): BookingViewModel {
        val vm = BookingViewModel(repository)
        vm.chooseService(repository.service)
        vm.choosePackage("pkg")
        vm.updateField("goals", "Grow our business")
        vm.updateField("requirements", "A brand identity and a website")
        vm.updateField("expectedTimeline", "Within six weeks")
        vm.goTo(4)
        return vm
    }
    @Test fun submissionKeyIsV4AndNewDraftGetsNewKey() {
        val first = BookingDraft()
        assertTrue(Regex("^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$").matches(first.submissionKey))
        assertNotEquals(first.submissionKey, BookingDraft().submissionKey)
    }
    @Test fun networkRetryReusesFrozenPayloadAndKey() {
        val repo = FakeBookingGateway()
        repo.submission = { throw Exception("Connection lost after server accepted") }
        val vm = ready(repo)
        val original = vm.state.value.draft
        vm.submit()
        assertEquals(original.normalized(), vm.state.value.pendingSubmission)
        vm.updateField("goals", "Changed while ambiguous")
        vm.choosePackage(null)
        assertEquals(original, vm.state.value.draft)
        repo.submission = { RequestReceipt("same-request") }
        vm.submit()
        assertEquals(2, repo.submissions.size)
        assertEquals(repo.submissions[0], repo.submissions[1])
        assertEquals("same-request", vm.state.value.receipt?.id)
    }
    @Test fun repeatedSubmitTapsMakeOneMutation() {
        val deferred = CompletableDeferred<RequestReceipt>()
        val repo = FakeBookingGateway()
        repo.submission = { deferred.await() }
        val vm = ready(repo)
        vm.submit(); vm.submit(); vm.submit()
        assertEquals(1, repo.submissions.size)
        assertTrue(vm.state.value.submitting)
        deferred.complete(RequestReceipt("request"))
        vm.submit()
        assertEquals(1, repo.submissions.size)
    }
    @Test fun requiredAndLengthErrorsBlockReviewAndSubmission() {
        val repo = FakeBookingGateway()
        val vm = BookingViewModel(repo)
        vm.chooseService(repo.service); vm.choosePackage("pkg"); vm.goTo(3); vm.goTo(4)
        assertEquals(3, vm.state.value.step)
        assertEquals(setOf("goals", "requirements", "expectedTimeline"), vm.state.value.fieldErrors.keys)
        vm.submit()
        assertTrue(repo.submissions.isEmpty())
        assertNotNull(BookingDraft(goals = "x".repeat(2001)).errors()["goals"])
        assertNotNull(BookingDraft(requirements = "x".repeat(5001)).errors()["requirements"])
        assertNotNull(BookingDraft(expectedTimeline = "x".repeat(301)).errors()["expectedTimeline"])
        assertNotNull(BookingDraft(additionalDetails = "x".repeat(5001)).errors()["additionalDetails"])
    }
    @Test fun draftSurvivesStepChangesAndOnlyEligibleSpecialistsCanBeChosen() {
        val repo = FakeBookingGateway()
        val vm = ready(repo)
        val key = vm.state.value.draft.submissionKey
        vm.chooseSpecialist("ineligible")
        assertNull(vm.state.value.draft.preferredSpecialistId)
        vm.chooseSpecialist("eligible")
        vm.goTo(3); vm.goTo(2); vm.goTo(3); vm.goTo(4)
        assertEquals("eligible", vm.state.value.draft.preferredSpecialistId)
        assertEquals("Grow our business", vm.state.value.draft.goals)
        assertEquals(key, vm.state.value.draft.submissionKey)
    }
    @Test fun explicitValidationRejectionAllowsCorrectingDraft() {
        val repo = FakeBookingGateway()
        repo.submission = { throw BookingApiException("Please clarify your goals", 400) }
        val vm = ready(repo)
        vm.submit()
        assertNull(vm.state.value.pendingSubmission)
        vm.updateField("goals", "Corrected goals")
        assertEquals("Corrected goals", vm.state.value.draft.goals)
        assertNull(vm.state.value.receipt)
    }
    @Test fun hiddenPricingNeverLeaksAmount() {
        assertEquals("Contact for pricing", Pricing(pricingModel = "FIXED", amount = "99999").label())
        assertEquals("Contact for pricing", ServicePackage("p", "Hidden", pricingModel = "FIXED", amount = "88888").price())
        assertEquals("PHP 500 / hour", priceLabel("HOURLY", "500", "PHP", null))
    }
    @Test fun historyPassesFiltersAndPageToServer() {
        val repo = FakeBookingGateway()
        val vm = RequestsViewModel(repo)
        vm.status("CANCELLED")
        vm.sort("asc")
        vm.page(2)
        assertEquals(RequestFilters(status = "CANCELLED", sortOrder = "asc", page = 2), repo.filters.last())
        assertEquals(21, vm.state.value.result.summary.total)
        vm.status("")
        assertEquals(1, repo.filters.last().page)
    }
    @Test fun repeatedCancellationTapsMakeOneMutation() {
        val repo = FakeBookingGateway()
        val deferred = CompletableDeferred<Unit>()
        repo.cancellation = { deferred.await() }
        val vm = RequestsViewModel(repo)
        vm.open("request"); vm.cancel(); vm.cancel()
        assertEquals(1, repo.cancellations)
        assertTrue(vm.state.value.cancelling)
        deferred.complete(Unit)
        assertFalse(vm.state.value.cancelling)
    }
    @Test fun recoverableListFailureKeepsPreviousResults() {
        val repo = FakeBookingGateway()
        val vm = RequestsViewModel(repo)
        assertEquals(21, vm.state.value.result.total)
        repo.listFailure = true
        vm.refresh()
        assertNotNull(vm.state.value.error)
        assertEquals(21, vm.state.value.result.total)
        assertEquals(3, vm.state.value.result.pages)
        assertFalse(RequestRecord("closed", status = "CLOSED", service = RequestService("s", "S")).canCancel)
        assertFalse(RequestRecord("cancelled", status = "CANCELLED", service = RequestService("s", "S")).canCancel)
    }
}
