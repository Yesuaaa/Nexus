package com.nexus.app.features.booking.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nexus.app.features.auth.viewmodel.AuthToast
import com.nexus.app.core.components.ToastKind
import com.nexus.app.features.booking.api.BookingGateway
import com.nexus.app.features.booking.api.BookingApiException
import com.nexus.app.features.booking.model.*
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

data class BookingState(
    val services: List<CatalogService> = emptyList(), val loading: Boolean = false,
    val error: String? = null, val search: String = "", val department: String = "",
    val service: CatalogService? = null, val details: CatalogService? = null,
    val step: Int = 1, val draft: BookingDraft = BookingDraft(),
    val packageSelected: Boolean = false, val fieldErrors: Map<String, String> = emptyMap(),
    val specialists: List<Specialist> = emptyList(), val specialistsLoading: Boolean = false,
    val specialistError: String? = null, val profile: SpecialistProfile? = null,
    val profileLoading: Boolean = false, val submitting: Boolean = false,
    val pendingSubmission: BookingDraft? = null, val receipt: RequestReceipt? = null
)

class BookingViewModel(private val repository: BookingGateway) : ViewModel() {
    private val mutableState = MutableStateFlow(BookingState())
    val state = mutableState.asStateFlow()
    private val events = MutableSharedFlow<AuthToast>(extraBufferCapacity = 4)
    val toasts = events.asSharedFlow()
    init { loadCatalog() }

    fun loadCatalog() {
        if (mutableState.value.loading) return
        mutableState.update { it.copy(loading = true, error = null) }
        viewModelScope.launch {
            try {
                val services = repository.services()
                mutableState.update { it.copy(services = services, loading = false) }
            }
            catch (e: CancellationException) { throw e }
            catch (e: Exception) { mutableState.update { it.copy(loading = false, error = message(e)) } }
        }
    }
    fun search(value: String) { mutableState.update { it.copy(search = value.take(100)) } }
    fun department(value: String) { mutableState.update { it.copy(department = value) } }
    fun showDetails(service: CatalogService) { mutableState.update { it.copy(details = service) } }
    fun closeDetails() { mutableState.update { it.copy(details = null) } }
    fun chooseService(service: CatalogService) {
        val current = mutableState.value
        if (current.submitting || current.pendingSubmission != null) return
        val same = current.service?.id == service.id && current.receipt == null
        mutableState.update { it.copy(service = service, details = null, step = 2, error = null,
            receipt = null, draft = if (same) it.draft else BookingDraft(serviceId = service.id),
            packageSelected = same && it.packageSelected, fieldErrors = emptyMap()) }
    }
    fun choosePackage(id: String?) {
        if (mutableState.value.pendingSubmission != null || mutableState.value.submitting) return
        val service = mutableState.value.service ?: return
        if (id != null && service.packages.none { it.id == id && it.isActive }) return
        mutableState.update { it.copy(draft = it.draft.copy(packageId = id), packageSelected = true) }
    }
    fun updateField(key: String, value: String) {
        if (mutableState.value.pendingSubmission != null || mutableState.value.submitting) return
        mutableState.update {
            val draft = when (key) {
                "goals" -> it.draft.copy(goals = value)
                "requirements" -> it.draft.copy(requirements = value)
                "expectedTimeline" -> it.draft.copy(expectedTimeline = value)
                "additionalDetails" -> it.draft.copy(additionalDetails = value)
                else -> it.draft
            }
            it.copy(draft = draft, fieldErrors = if (it.fieldErrors.isEmpty()) emptyMap() else draft.errors(), error = null)
        }
    }
    fun goTo(step: Int) {
        val current = mutableState.value
        if (current.submitting || current.pendingSubmission != null) return
        if (step == 3 && !current.packageSelected) return
        if (step == 4) {
            val errors = current.draft.errors()
            if (errors.isNotEmpty()) { mutableState.update { it.copy(fieldErrors = errors) }; return }
            loadSpecialists()
        }
        mutableState.update { it.copy(step = step, error = null) }
    }
    fun loadSpecialists() {
        val id = mutableState.value.service?.id ?: return
        if (mutableState.value.specialistsLoading) return
        mutableState.update { it.copy(specialistsLoading = true, specialistError = null) }
        viewModelScope.launch {
            try {
                val specialists = repository.specialists(id)
                mutableState.update {
                    if (it.service?.id != id) it else it.copy(specialists = specialists, specialistsLoading = false,
                        draft = if (specialists.any { s -> s.id == it.draft.preferredSpecialistId })
                            it.draft else it.draft.copy(preferredSpecialistId = null))
                }
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) { mutableState.update { it.copy(specialistsLoading = false, specialistError = message(e)) } }
        }
    }
    fun chooseSpecialist(id: String?) {
        val current = mutableState.value
        if (current.submitting || current.pendingSubmission != null) return
        if (id != null && current.specialists.none { it.id == id }) return
        mutableState.update { it.copy(draft = it.draft.copy(preferredSpecialistId = id)) }
    }
    fun showProfile(id: String) {
        val serviceId = mutableState.value.service?.id ?: return
        if (mutableState.value.profileLoading) return
        mutableState.update { it.copy(profileLoading = true) }
        viewModelScope.launch {
            try {
                val profile = repository.specialistProfile(serviceId, id)
                mutableState.update { it.copy(profile = profile, profileLoading = false) }
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) {
                mutableState.update { it.copy(profileLoading = false) }
                events.emit(AuthToast("Profile unavailable", message(e), ToastKind.ERROR))
            }
        }
    }
    fun closeProfile() { mutableState.update { it.copy(profile = null) } }
    fun submit() {
        val current = mutableState.value
        if (current.submitting || current.receipt != null || !current.packageSelected || current.service == null) return
        val draft = current.pendingSubmission ?: current.draft.normalized()
        val errors = draft.errors()
        if (errors.isNotEmpty()) { mutableState.update { it.copy(step = 3, fieldErrors = errors) }; return }
        mutableState.update { it.copy(submitting = true, pendingSubmission = draft, error = null) }
        viewModelScope.launch {
            try {
                val receipt = repository.submit(draft)
                mutableState.update { it.copy(submitting = false, pendingSubmission = null, receipt = receipt) }
                events.emit(AuthToast("Request submitted", "Your reference is ${receipt.referenceNumber ?: receipt.id}.", ToastKind.SUCCESS))
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) {
                val rejected = e is BookingApiException && e.status in setOf(400, 404, 409, 422)
                mutableState.update { it.copy(submitting = false, error = message(e),
                    pendingSubmission = if (rejected) null else draft) }
                events.emit(AuthToast("Couldn't submit request", message(e), ToastKind.ERROR))
            }
        }
    }
    fun newRequest() {
        if (mutableState.value.pendingSubmission != null || mutableState.value.submitting) return
        mutableState.update { BookingState(services = it.services) }
    }
}

internal fun message(error: Exception): String = if (error is BookingApiException)
    error.message ?: "Please retry." else "Can't reach the server. Check your connection and retry."
