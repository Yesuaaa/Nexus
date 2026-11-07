package com.nexus.app.features.conversations.viewmodel

import com.nexus.app.features.workflow.api.WorkflowRepository
import com.nexus.app.core.files.SelectedFile
import com.nexus.app.features.booking.api.BookingGateway
import com.nexus.app.features.booking.model.SpecialistProfile
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nexus.app.features.booking.model.newSubmissionKey
import com.nexus.app.features.conversations.api.*
import com.nexus.app.features.conversations.model.*
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

data class ConversationsState(
    val archived: Boolean = false, val page: ConversationPage = ConversationPage(),
    val loading: Boolean = false, val error: String? = null, val id: String? = null,
    val attachments: List<ConversationAttachment> = emptyList(), val attachmentError: String? = null,
    val history: History? = null, val messages: List<ChatMessage> = emptyList(),
    val pending: List<PendingMessage> = emptyList(), val reconnecting: Boolean = false, val profile: SpecialistProfile? = null, val profileLoading: Boolean = false, val profileError: String? = null
)
class ConversationsViewModel(private val repository: ClientCommunicationRepository, private val booking: BookingGateway? = null, private val workflows: WorkflowRepository? = null) : ViewModel() {
    private val mutable = MutableStateFlow(ConversationsState())
    val state = mutable.asStateFlow()
    private var listJob: Job? = null
    private var streamJob: Job? = null
    private val historyMutex = Mutex()
    private var foreground = false
    fun closeProfile() { mutable.update { it.copy(profile = null, profileLoading = false, profileError = null) } }
    fun profile() {
        val current = state.value
        val id = current.id ?: return
        val head = current.history?.conversation?.head ?: return
        mutable.update { it.copy(profile = SpecialistProfile(head.specialistId ?: head.id, head.fullName, imageUrl = head.imageUrl), profileLoading = true, profileError = null) }
        val specialistId = head.specialistId
        val gateway = booking
        if (specialistId == null || gateway == null) {
            mutable.update { it.copy(profileLoading = false, profileError = "This specialist's public profile is not available yet.") }
            return
        }
        viewModelScope.launch {
            try {
                val request = gateway.request(current.history.selectedBookingId ?: id)
                val profile = gateway.specialistProfile(request.service.id, specialistId)
                if (state.value.id == id && state.value.profile != null) mutable.update { it.copy(profile = profile, profileLoading = false) }
            } catch (error: CancellationException) { throw error }
            catch (_: Exception) { if (state.value.id == id && state.value.profile != null) mutable.update { it.copy(profileLoading = false, profileError = "Couldn't load this profile. Please try again.") } }
        }
    }
    fun refresh(archived: Boolean = state.value.archived, more: Boolean = false) {
        if (more && (state.value.loading || state.value.page.nextCursor == null)) return
        listJob?.cancel()
        val before = if (more) state.value.page.nextCursor else null
        mutable.update { it.copy(archived = archived, loading = true, error = null) }
        listJob = viewModelScope.launch {
            try {
                val page = repository.conversations(archived, before)
                mutable.update { it.copy(page = if (more) page.copy(conversations =
                    (it.page.conversations + page.conversations).distinctBy { row -> row.id }) else page, loading = false) }
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) { mutable.update { it.copy(loading = false, error = e.message) } }
        }
    }
    fun open(id: String) {
        streamJob?.cancel()
        mutable.update { if (it.id == id) it else it.copy(id = id, history = null, attachments = emptyList(), attachmentError = null, messages = emptyList(), pending = emptyList(), error = null) }
        if (foreground) connect()
    }
    fun foreground(active: Boolean) {
        foreground = active
        streamJob?.cancel()
        if (active && state.value.id != null) connect()
        else if (active) refresh()
    }
    fun close() { streamJob?.cancel(); mutable.update { it.copy(id = null, history = null, attachments = emptyList(), attachmentError = null, messages = emptyList(), pending = emptyList()) }; refresh() }
    private fun connect() {
        val id = state.value.id ?: return
        streamJob = viewModelScope.launch {
            var backoff = 1000L
            while (isActive) {
                try {
                    reconcile(id)
                    repository.events(id) {
                        reconcile(id)
                        mutable.update { it.copy(reconnecting = false) }
                        backoff = 1000L
                    }
                } catch (e: CancellationException) { throw e }
                catch (e: Exception) {
                    if (e is CommunicationException && e.status in setOf(401, 403, 404)) {
                        mutable.update { it.copy(history = null, attachments = emptyList(), attachmentError = null, messages = emptyList(), pending = emptyList(), error = e.message) }
                        return@launch
                    }
                    mutable.update { it.copy(error = "Connection interrupted. Retrying...") }
                }
                mutable.update { it.copy(reconnecting = true) }
                delay(backoff)
                backoff = (backoff * 2).coerceAtMost(30_000)
            }
        }
    }
    private suspend fun reconcile(id: String, older: Boolean = false) = historyMutex.withLock {
        val before = if (older) state.value.history?.nextCursor ?: return@withLock else null
        val history = repository.history(id, before)
        if (state.value.id != id) return@withLock
        // Follow newest-page cursors until reaching known history after a long disconnect.
        var incoming = history.messages
        var cursor = history.nextCursor
        val oldestKnown = state.value.messages.firstOrNull()?.id
        while (!older && cursor != null && oldestKnown != null && incoming.none { it.id == oldestKnown }) {
            val page = repository.history(id, cursor)
            incoming = page.messages + incoming
            cursor = page.nextCursor
        }
        mutable.update {
            val messages = mergeMessages(it.messages, incoming)
            it.copy(history = history.copy(nextCursor = if (older) history.nextCursor else cursor),
                messages = messages, pending = reconcilePending(it.pending, messages), error = null)
        }
        refreshAttachments(id, history)
        repository.read(id)
    }
    private suspend fun refreshAttachments(conversationId: String, history: History) {
        val gateway = workflows ?: return
        val ids = history.conversation?.bookings?.map { it.id }.orEmpty().ifEmpty { listOfNotNull(history.selectedBookingId) }
        val attachments = mutableListOf<ConversationAttachment>()
        var failed = false
        for (requestId in ids.distinct()) {
            try {
                val workflow = gateway.get(requestId)
                attachments += workflow.files.map { ConversationAttachment(requestId, workflow.request.serviceName, it) }
            } catch (e: CancellationException) { throw e }
            catch (_: Exception) { failed = true }
        }
        if (state.value.id == conversationId) mutable.update { it.copy(attachments = attachments,
            attachmentError = if (failed) "Some attachments couldn't be loaded. Please retry." else null) }
    }
    fun refreshAttachments() {
        val current = state.value
        val conversationId = current.id ?: return
        val history = current.history ?: return
        viewModelScope.launch { historyMutex.withLock { refreshAttachments(conversationId, history) } }
    }
    suspend fun attachmentContent(attachment: ConversationAttachment): SelectedFile =
        requireNotNull(workflows).download(attachment.requestId, attachment.file)
    fun older() { val id = state.value.id ?: return; viewModelScope.launch { attempt { reconcile(id, true) } } }
    fun send(body: String) {
        if (body.isBlank() || body.length > 4000 || '\u0000' in body || state.value.history?.canSend != true) return
        val pending = PendingMessage(newSubmissionKey(), body.trim())
        mutable.update { it.copy(pending = it.pending + pending) }
        deliver(pending)
    }
    fun retry(pending: PendingMessage) { if (pending.failed && state.value.history?.canSend == true) deliver(pending) }
    private fun deliver(pending: PendingMessage) {
        val id = state.value.id ?: return
        mutable.update { it.copy(pending = it.pending.map { row -> if (row.clientMessageId == pending.clientMessageId) row.copy(failed = false, failureReason = null) else row }) }
        viewModelScope.launch {
            try {
                val message = repository.send(id, SendMessage(pending.body, pending.clientMessageId))
                if (state.value.id == id) mutable.update {
                    val messages = mergeMessages(it.messages, listOf(message))
                    it.copy(messages = messages, pending = reconcilePending(it.pending, messages))
                }
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) { if (state.value.id == id) mutable.update { it.copy(pending = it.pending.map { row ->
                if (row.clientMessageId == pending.clientMessageId) row.copy(
                    failed = true,
                    failureReason = (e as? CommunicationException)?.message
                        ?: "Couldn't reach the server. Check your connection and retry.",
                ) else row }) } }
        }
    }
    private suspend fun attempt(block: suspend () -> Unit) {
        try { block() } catch (e: CancellationException) { throw e }
        catch (e: Exception) { mutable.update { it.copy(error = e.message) } }
    }
}
