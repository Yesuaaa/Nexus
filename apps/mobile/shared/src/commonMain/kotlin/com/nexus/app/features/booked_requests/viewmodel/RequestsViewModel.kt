package com.nexus.app.features.booked_requests.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nexus.app.features.auth.viewmodel.AuthToast
import com.nexus.app.features.booking.api.BookingGateway
import com.nexus.app.features.booking.model.*
import com.nexus.app.features.booking.viewmodel.message
import com.nexus.app.core.components.ToastKind
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*

data class RequestsState(
    val filters: RequestFilters = RequestFilters(), val result: RequestsPage = RequestsPage(),
    val loading: Boolean = false, val error: String? = null,
    val detail: RequestRecord? = null, val detailId: String? = null,
    val detailLoading: Boolean = false, val detailError: String? = null,
    val cancelling: Boolean = false
)
class RequestsViewModel(private val repository: BookingGateway) : ViewModel() {
    private val mutableState = MutableStateFlow(RequestsState())
    val state = mutableState.asStateFlow()
    private val events = MutableSharedFlow<AuthToast>(extraBufferCapacity = 4)
    val toasts = events.asSharedFlow()
    private var listJob: Job? = null
    private var detailJob: Job? = null
    private val actionIds = mutableMapOf<String, String>()
    init { refresh() }
    fun search(value: String) = filter(mutableState.value.filters.copy(search = value.take(100), page = 1), true)
    fun status(value: String) = filter(mutableState.value.filters.copy(status = value, page = 1))
    fun sort(value: String) = filter(mutableState.value.filters.copy(sortOrder = value, page = 1))
    fun page(value: Int) {
        if (value in 1..mutableState.value.result.pages) filter(mutableState.value.filters.copy(page = value))
    }
    private fun filter(filters: RequestFilters, debounce: Boolean = false) {
        mutableState.update { it.copy(filters = filters) }
        refresh(debounce)
    }
    fun refresh(debounce: Boolean = false) {
        listJob?.cancel()
        val filters = mutableState.value.filters
        mutableState.update { it.copy(loading = true, error = null) }
        listJob = viewModelScope.launch {
            if (debounce) delay(300)
            try {
                val result = repository.requests(filters)
                mutableState.update { it.copy(result = result, loading = false) }
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) { mutableState.update { it.copy(loading = false, error = message(e)) } }
        }
    }
    fun open(id: String) {
        if (mutableState.value.cancelling) return
        detailJob?.cancel()
        mutableState.update { it.copy(detailId = id, detail = if (it.detail?.id == id) it.detail else null,
            detailLoading = true, detailError = null) }
        detailJob = viewModelScope.launch {
            try {
                val detail = repository.request(id)
                mutableState.update { it.copy(detail = detail, detailLoading = false) }
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) { mutableState.update { it.copy(detailLoading = false, detailError = message(e)) } }
        }
    }
    fun close() {
        if (mutableState.value.cancelling) return
        detailJob?.cancel()
        mutableState.update { it.copy(detailId = null, detail = null, detailError = null, detailLoading = false) }
    }
    fun cancel() {
        val current = mutableState.value
        val detail = current.detail ?: return
        if (current.cancelling || current.detailLoading || !detail.canCancel) return
        mutableState.update { it.copy(cancelling = true, detailError = null) }
        val actionId = actionIds.getOrPut(detail.id) { newSubmissionKey() }
        viewModelScope.launch {
            try {
                repository.cancel(detail, actionId)
                mutableState.update { it.copy(cancelling = false, detail = detail.copy(status = "CANCELLED")) }
                events.emit(AuthToast("Request cancelled", "Your request has been cancelled.", ToastKind.SUCCESS))
                refresh()
                open(detail.id)
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) {
                mutableState.update { it.copy(cancelling = false, detailError = message(e)) }
                events.emit(AuthToast("Couldn't cancel request", message(e) + " Refresh the request before retrying.", ToastKind.ERROR))
            }
        }
    }
}
