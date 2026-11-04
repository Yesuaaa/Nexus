# Services and booking data layer

Koin registers these repositories with the shared authenticated `HttpClient`:

- `features.services.api.ServicesRepository`: `getServices()`, `getServiceDetails(id)`, and `getSpecialists(serviceId)`.
- `features.booking.api.BookingRepository`: `submitBooking(request, submissionKey)` and `cancelRequest(requestId)`.
- `features.booked_requests.api.BookedRequestsRepository`: `getClientRequests()` and an overload accepting `RequestFilters` for pagination, search, status, and sort order.

All functions above are suspending and return Kotlin `Result`. Inject repositories into ViewModels and call them from `viewModelScope`. They share the existing token refresh/session expiration behavior; no HTTP setup belongs in a screen or ViewModel. Existing `BookingGateway` callers remain compatible.

```kotlin
import com.nexus.app.core.network.RepositoryException
import com.nexus.app.features.booking.model.newSubmissionKey
import com.nexus.app.features.services.model.CreateServiceRequestDto

// Keep this key with the draft. Reuse it for retries after a lost response.
val submissionKey = newSubmissionKey()
val request = CreateServiceRequestDto(
    serviceId = selectedServiceId,
    packageId = selectedPackageId,
    preferredSpecialistId = selectedSpecialistId,
    goals = goals,
    requirements = requirements,
    expectedTimeline = expectedTimeline,
)

viewModelScope.launch {
    bookingRepository.submitBooking(request, submissionKey).fold(
        onSuccess = { receipt -> /* show receipt.referenceNumber */ },
        onFailure = { error ->
            val failure = error as? RepositoryException
            // Use failure.kind to choose UI behavior; failure.message contains
            // the backend error when available, and failure.status is the HTTP code.
        },
    )
}
```

Generate a new UUID v4 key for a new booking. A retry of the same booking must retain both its key and payload. A changed payload with the old key can return `CONFLICT`. Repositories do not automatically retry writes.

`RepositoryException.kind` distinguishes `VALIDATION` (400), `UNAUTHORIZED` (401), `CONFLICT` (409), `SERVER` (5xx), other `HTTP` errors, `NETWORK`, `DECODING`, and `UNKNOWN`. Coroutine cancellation propagates rather than becoming a failed result.

`getClientRequests()` fetches page 1 (10 records); use the filter overload for subsequent pages. `BookedRequestsResponse.summary` contains account-wide `RequestKpisDto`, while `total` is the filtered result count. Monetary amounts are decimal strings to preserve precision. Nullable selections and undisclosed prices remain null. Specialist photos decode from the backend's `profileImageUrl` into `SpecialistDto.imageUrl`.

`cancelRequest` fetches the latest request before cancelling. Unaccepted requests use the client cancellation endpoint; accepted requests fetch the workflow version and submit a `CANCEL` action. A conflict should prompt refreshing the request. After a network failure during cancellation, refresh before deciding whether another action is needed.

DTOs live in `features.services.model` and `features.booked_requests.model`. Old model names in `features.booking.model` are compatibility aliases to the same serializable types.

Run offline tests from `apps/mobile`:

```powershell
./gradlew.bat :shared:testAndroidHostTest
```
