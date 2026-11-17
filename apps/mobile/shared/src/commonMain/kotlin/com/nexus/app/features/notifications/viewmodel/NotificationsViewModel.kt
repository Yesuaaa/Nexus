package com.nexus.app.features.notifications.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nexus.app.features.conversations.api.ClientCommunicationRepository
import com.nexus.app.features.notifications.model.*
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*

data class NotificationsState(val feed: NotificationFeed = NotificationFeed(), val loading: Boolean = false, val error: String? = null)
class NotificationsViewModel(private val repository: ClientCommunicationRepository) : ViewModel() {
    private val mutable = MutableStateFlow(NotificationsState())
    val state = mutable.asStateFlow()
    private var refreshJob: Job? = null
    private var mutation: Job? = null
    fun reset() { refreshJob?.cancel(); mutation?.cancel(); mutable.value = NotificationsState() }
    fun refresh() {
        refreshJob?.cancel()
        refreshJob = viewModelScope.launch {
            mutable.update { it.copy(loading = true, error = null) }
            perform { val feed = repository.notifications(); mutable.update { it.copy(feed = feed) } }
            mutable.update { it.copy(loading = false) }
        }
    }
    fun readAll() {
        if (mutation?.isActive == true) return
        mutation = viewModelScope.launch { perform { repository.readAll(); refresh() } }
    }
    fun open(notification: WorkflowNotification, navigate: (String) -> Unit) {
        if (mutation?.isActive == true) return
        mutation = viewModelScope.launch { perform {
            repository.checkRequestAccess(notification.requestId)
            repository.readNotification(notification.id)
            refresh()
            navigate(notification.requestId)
        } }
    }
    fun openGroup(notifications: List<WorkflowNotification>, navigate: (String) -> Unit) {
        val latest = notifications.maxByOrNull { it.createdAt } ?: return
        if (mutation?.isActive == true) return
        mutation = viewModelScope.launch { perform {
            repository.checkRequestAccess(latest.requestId)
            notifications.filter { it.readAt == null }.forEach { repository.readNotification(it.id) }
            refresh()
            navigate(latest.requestId)
        } }
    }
    private suspend fun perform(block: suspend () -> Unit) {
        try { block() } catch (e: CancellationException) { throw e }
        catch (e: Exception) { mutable.update { it.copy(error = e.message ?: "Unable to load notifications") } }
    }
}
