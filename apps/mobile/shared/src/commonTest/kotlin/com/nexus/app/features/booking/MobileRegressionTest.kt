package com.nexus.app.features.booking

import com.nexus.app.features.booked_requests.viewmodel.RequestsViewModel
import kotlinx.coroutines.*
import kotlinx.coroutines.test.*
import kotlin.test.*

@OptIn(ExperimentalCoroutinesApi::class)
class MobileRegressionTest {
    @BeforeTest fun setup() = Dispatchers.setMain(StandardTestDispatcher())
    @AfterTest fun teardown() = Dispatchers.resetMain()

    @Test fun searchDebouncesAndOnlySendsTheLatestValue() = runTest {
        val repo = FakeBookingGateway()
        val vm = RequestsViewModel(repo)
        advanceUntilIdle()
        vm.page(2)
        advanceUntilIdle()
        vm.search("old")
        advanceTimeBy(150)
        vm.search("latest & query")
        advanceTimeBy(299)
        assertEquals(2, repo.filters.size)
        advanceUntilIdle()
        assertEquals("latest & query", repo.filters.last().search)
        assertEquals(1, repo.filters.last().page)
        assertFalse(vm.state.value.loading)
    }

    @Test fun searchLimitsLengthAndInvalidPagesDoNotFetch() = runTest {
        val repo = FakeBookingGateway()
        val vm = RequestsViewModel(repo)
        advanceUntilIdle()
        vm.page(0); vm.page(4)
        advanceUntilIdle()
        assertEquals(1, repo.filters.size)
        vm.search("x".repeat(101))
        advanceUntilIdle()
        assertEquals(100, repo.filters.last().search.length)
    }

    @Test fun closingAnInFlightDetailDoesNotReopenItWhenNetworkCompletes() = runTest {
        val repo = FakeBookingGateway()
        val deferred = CompletableDeferred<Unit>()
        repo.details = { deferred.await(); repo.record }
        val vm = RequestsViewModel(repo)
        vm.open("request")
        runCurrent()
        assertTrue(vm.state.value.detailLoading)
        vm.close()
        deferred.complete(Unit)
        advanceUntilIdle()
        assertNull(vm.state.value.detail)
        assertNull(vm.state.value.detailId)
        assertFalse(vm.state.value.detailLoading)
    }

    @Test fun changingDetailCancelsThePreviousAccountRecordLoad() = runTest {
        val repo = FakeBookingGateway()
        val deferred = CompletableDeferred<Unit>()
        repo.details = { id -> if (id == "first") deferred.await(); repo.record.copy(id = id) }
        val vm = RequestsViewModel(repo)
        vm.open("first"); runCurrent()
        vm.open("second"); advanceUntilIdle()
        deferred.complete(Unit); advanceUntilIdle()
        assertEquals("second", vm.state.value.detail?.id)
        assertEquals("second", vm.state.value.detailId)
    }

    @Test fun failedDetailsCanBeRetriedWithoutLeavingTheScreen() = runTest {
        val repo = FakeBookingGateway()
        repo.details = { throw Exception("Offline") }
        val vm = RequestsViewModel(repo)
        vm.open("request"); advanceUntilIdle()
        assertNotNull(vm.state.value.detailError)
        assertFalse(vm.state.value.detailLoading)
        repo.details = { repo.record }
        vm.open("request"); advanceUntilIdle()
        assertNull(vm.state.value.detailError)
        assertEquals("request", vm.state.value.detail?.id)
    }

    @Test fun cancellationRetryReusesItsIdempotencyKey() = runTest {
        val repo = FakeBookingGateway()
        repo.cancellation = { throw Exception("Response lost") }
        val vm = RequestsViewModel(repo)
        vm.open("request"); advanceUntilIdle()
        vm.cancel(); advanceUntilIdle()
        assertNotNull(vm.state.value.detailError)
        assertFalse(vm.state.value.cancelling)
        repo.cancellation = {}
        repo.details = { repo.record.copy(status = "CANCELLED") }
        vm.cancel(); advanceUntilIdle()
        assertEquals(2, repo.actionIds.size)
        assertEquals(repo.actionIds.first(), repo.actionIds.last())
        assertEquals("CANCELLED", vm.state.value.detail?.status)
        vm.cancel(); advanceUntilIdle()
        assertEquals(2, repo.cancellations)
    }

    @Test fun cancellationLocksDetailNavigationUntilTheResponse() = runTest {
        val repo = FakeBookingGateway()
        val deferred = CompletableDeferred<Unit>()
        repo.cancellation = { deferred.await() }
        val vm = RequestsViewModel(repo)
        vm.open("request"); advanceUntilIdle()
        vm.cancel(); runCurrent()
        vm.close(); vm.open("other")
        assertEquals("request", vm.state.value.detailId)
        deferred.complete(Unit); advanceUntilIdle()
        assertFalse(vm.state.value.cancelling)
    }
}
