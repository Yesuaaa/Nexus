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
import com.nexus.app.features.projects.model.ProjectChatHistory
import com.nexus.app.features.projects.model.ProjectChatMessage
import com.nexus.app.features.projects.model.ProjectConversationPage
import com.nexus.app.features.projects.model.mergeProjectMessages
import com.nexus.app.features.projects.model.reconcileProjectPending
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

data class ConversationsState(
    val archived: Boolean = false, val page: ConversationPage = ConversationPage(),


    val meetingBusy: Boolean = false, val meetingError: String? = null,
    val selectedBookingId: String? = null,
    val selectedWorkflow: com.nexus.app.features.workflow.model.ClientWorkflow? = null,
    val loading: Boolean = false, val error: String? = null, val id: String? = null,
    val attachments: List<ConversationAttachment> = emptyList(), val attachmentError: String? = null,
    val history: History? = null, val messages: List<ChatMessage> = emptyList(),
    val pending: List<PendingMessage> = emptyList(), val reconnecting: Boolean = false, val profile: SpecialistProfile? = null, val profileLoading: Boolean = false, val profileError: String? = null,
    val projectPage: ProjectConversationPage = ProjectConversationPage(),
    val projectId: String? = null,
    val projectHistory: ProjectChatHistory? = null,
    val projectMessages: List<ProjectChatMessage> = emptyList(),
    val projectPending: List<PendingMessage> = emptyList(),
    val projectLoading: Boolean = false,
    val projectError: String? = null,
)
class ConversationsViewModel(private val repository: ClientCommunicationRepository, private val booking: BookingGateway? = null, private val workflows: WorkflowRepository? = null) : ViewModel() {
    private val mutable = MutableStateFlow(ConversationsState())
    val state = mutable.asStateFlow()
    private var listJob: Job? = null
    private var streamJob: Job? = null
    private val historyMutex = Mutex()
    private val projectMutex = Mutex()
    private var foreground = false
    fun closeProfile() { mutable.update { it.copy(profile = null, profileLoading = false, profileError = null) } }
    fun profile() {
        val current = state.value
        val id = current.id ?: return
        val head = current.history?.conversation?.head ?: return
        mutable.update { it.copy(profile = SpecialistProfile(head.specialistId ?: head.id, head.fullName ?: "Department head", imageUrl = head.imageUrl), profileLoading = true, profileError = null) }
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
    fun setArchived(archived: Boolean) {
        if (state.value.archived == archived && !state.value.loading && state.value.error == null) {
            refresh(archived = archived, more = false)
            return
        }
        refresh(archived = archived, more = false)
    }
    fun refresh(archived: Boolean = state.value.archived, more: Boolean = false) {
        val hasMoreRequests = state.value.page.nextCursor != null
        val hasMoreProjects = state.value.projectPage.nextCursor != null
        if (more && (state.value.loading || (!hasMoreRequests && !hasMoreProjects))) return
        listJob?.cancel()
        val reqBefore = if (more) state.value.page.nextCursor else null
        val projBefore = if (more) state.value.projectPage.nextCursor else null
        mutable.update { it.copy(archived = archived, loading = true, error = null) }
        listJob = viewModelScope.launch {
            try {
                coroutineScope {
                    val reqDeferred = if (!more || hasMoreRequests) {
                        async { repository.conversations(archived, reqBefore) }
                    } else null
                    val projDeferred = if (!more || hasMoreProjects) {
                        async { repository.projectConversations(archived, projBefore) }
                    } else null

                    val reqPage = reqDeferred?.await()
                    val projPage = projDeferred?.await()
                    mutable.update { current ->
                        val nextReqPage = if (reqPage != null) {
                            if (more) reqPage.copy(conversations = (current.page.conversations + reqPage.conversations).distinctBy { row -> row.id })
                            else reqPage
                        } else current.page
                        val nextProjPage = if (projPage != null) {
                            if (more) projPage.copy(conversations = (current.projectPage.conversations + projPage.conversations).distinctBy { row -> row.id })
                            else projPage
                        } else current.projectPage
                        current.copy(page = nextReqPage, projectPage = nextProjPage, loading = false)
                    }
                }
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) {
                mutable.update { it.copy(loading = false, error = e.message ?: "Unable to load conversations. Please try again.") }
            }
        }
    }
    fun clearMeetingError() { mutable.update { it.copy(meetingError = null) } }
    suspend fun requestMeetingReschedule(meeting: ConversationMeeting, startsAt: String, note: String): Boolean {
        val current = state.value
        val id = current.id ?: return false
        val history = current.history ?: return false
        if (current.meetingBusy || !history.canSend || history.archived || meeting.status != "SCHEDULED" || meeting.proposedStartsAt != null) return false
        mutable.update { it.copy(meetingBusy = true, meetingError = null) }
        return try {
            val saved = repository.requestMeetingReschedule(id, meeting, startsAt, note)
            if (state.value.id == id) mutable.update { latest ->
                latest.copy(history = latest.history?.let { loaded ->
                    loaded.copy(meetings = loaded.meetings.map { row -> if (row.id == saved.id) saved else row })
                })
            }
            true
        } catch (e: CancellationException) { throw e }
        catch (e: Exception) {
            if (state.value.id == id) mutable.update { it.copy(meetingError = e.message ?: "Unable to request a reschedule. Please retry.") }
            false
        } finally {
            if (state.value.id == id) mutable.update { it.copy(meetingBusy = false) }
        }
    }
    fun open(id: String) {
        streamJob?.cancel()
        mutable.update { if (it.id == id) it else it.copy(id = id, meetingBusy = false, meetingError = null, selectedBookingId = null, selectedWorkflow = null, reconnecting = false, history = null, attachments = emptyList(), attachmentError = null, messages = emptyList(), pending = emptyList(), error = null) }
        if (foreground) connect()
    }
    fun selectBooking(bookingId: String) {
        if (state.value.selectedBookingId == bookingId) return
        mutable.update { it.copy(selectedBookingId = bookingId, selectedWorkflow = null,
            history = it.history?.copy(selectedBookingId = bookingId),
            attachments = emptyList(), attachmentError = null) }
        refreshAttachments()
    }
    fun foreground(active: Boolean) {
        foreground = active
        streamJob?.cancel()
        if (active && state.value.id != null) connect()
        else if (active) refresh()
    }
    fun close() { streamJob?.cancel(); mutable.update { it.copy(id = null, history = null, attachments = emptyList(), attachmentError = null, messages = emptyList(), pending = emptyList()) }; refresh() }
    fun openProject(projectId: String) {
        mutable.update {
            if (it.projectId == projectId) it
            else it.copy(
                projectId = projectId,
                projectHistory = null,
                projectMessages = emptyList(),
                projectPending = emptyList(),
                projectError = null,
            )
        }
        refreshProject(projectId, older = false)
    }
    fun closeProject() {
        mutable.update {
            it.copy(
                projectId = null,
                projectHistory = null,
                projectMessages = emptyList(),
                projectPending = emptyList(),
                projectError = null,
            )
        }
        refresh()
    }
    fun refreshProject(projectId: String? = state.value.projectId, older: Boolean = false) {
        val targetId = projectId ?: return
        if (state.value.projectLoading) return
        val before = if (older) state.value.projectHistory?.nextCursor ?: return else null
        mutable.update { it.copy(projectId = targetId, projectLoading = true, projectError = null) }
        viewModelScope.launch {
            projectMutex.withLock {
                try {
                    val history = repository.projectHistory(targetId, before)
                    if (state.value.projectId != targetId) return@withLock
                    mutable.update { current ->
                        val messages = mergeProjectMessages(current.projectMessages, history.messages)
                        val nextCursor = if (older || current.projectHistory == null) history.nextCursor else current.projectHistory.nextCursor
                        current.copy(
                            projectHistory = history.copy(messages = messages, nextCursor = nextCursor),
                            projectMessages = messages,
                            projectPending = reconcileProjectPending(current.projectPending, messages),
                            projectError = null,
                        )
                    }
                    if (!older) {
                        try {
                            repository.readProject(targetId)
                            mutable.update { current ->
                                current.copy(
                                    projectPage = current.projectPage.copy(
                                        conversations = current.projectPage.conversations.map { row ->
                                            if (row.id == targetId) row.copy(unreadCount = 0) else row
                                        },
                                    ),
                                )
                            }
                        } catch (e: CancellationException) {
                            throw e
                        } catch (_: Exception) {
                            // Read receipt failures should not hide loaded messages.
                        }
                    }
                } catch (e: CancellationException) {
                    throw e
                } catch (e: CommunicationException) {
                    mutable.update {
                        it.copy(
                            projectHistory = if (e.status in setOf(401, 403, 404)) null else it.projectHistory,
                            projectError = e.message,
                        )
                    }
                } catch (e: Exception) {
                    mutable.update { it.copy(projectError = e.message ?: "Unable to load project messages.") }
                } finally {
                    mutable.update { it.copy(projectLoading = false) }
                }
            }
        }
    }
    fun sendProject(body: String) {
        val current = state.value
        val projectId = current.projectId ?: return
        if (body.isBlank() || body.length > 4000 || '\u0000' in body || current.projectHistory?.canSend != true) return
        val pending = PendingMessage(newSubmissionKey(), body.trim())
        mutable.update { it.copy(projectPending = it.projectPending + pending) }
        deliverProject(projectId, pending)
    }
    fun retryProject(pending: PendingMessage) {
        val current = state.value
        val projectId = current.projectId ?: return
        if (pending.failed && current.projectHistory?.canSend == true) {
            deliverProject(projectId, pending)
        }
    }
    private fun deliverProject(projectId: String, pending: PendingMessage) {
        mutable.update {
            it.copy(
                projectPending = it.projectPending.map { row ->
                    if (row.clientMessageId == pending.clientMessageId) row.copy(failed = false, failureReason = null) else row
                },
            )
        }
        viewModelScope.launch {
            try {
                val message = repository.sendProjectMessage(projectId, pending.body, pending.clientMessageId)
                if (state.value.projectId == projectId) {
                    mutable.update { current ->
                        val messages = mergeProjectMessages(current.projectMessages, listOf(message))
                        current.copy(
                            projectHistory = current.projectHistory?.copy(messages = messages),
                            projectMessages = messages,
                            projectPending = reconcileProjectPending(current.projectPending, messages),
                            projectPage = current.projectPage.copy(
                                conversations = current.projectPage.conversations.map { row ->
                                    if (row.id == projectId) {
                                        row.copy(
                                            lastMessage = message,
                                            updatedAt = if (message.createdAt > row.updatedAt) message.createdAt else row.updatedAt,
                                        )
                                    } else row
                                },
                            ),
                        )
                    }
                }
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                if (state.value.projectId == projectId) {
                    mutable.update { current ->
                        current.copy(
                            projectPending = current.projectPending.map { row ->
                                if (row.clientMessageId == pending.clientMessageId) {
                                    row.copy(
                                        failed = true,
                                        failureReason = (e as? CommunicationException)?.message
                                            ?: "Couldn't reach the server. Check your connection and retry.",
                                    )
                                } else row
                            },
                        )
                    }
                }
            }
        }
    }
    private fun connect() {
        val id = state.value.id ?: return
        streamJob = viewModelScope.launch {
            var backoff = 1000L
            while (isActive) {
                try {
                    reconcile(id)
                    mutable.update { it.copy(reconnecting = false, error = null) }
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
        val history = repository.history(id, before, state.value.selectedBookingId)
        if (state.value.id != id) return@withLock
        // Follow newest-page cursors until reaching known history after a long disconnect.
        var incoming = history.messages
        var cursor = history.nextCursor
        val oldestKnown = state.value.messages.firstOrNull()?.id
        while (!older && cursor != null && oldestKnown != null && incoming.none { it.id == oldestKnown }) {
            val page = repository.history(id, cursor, state.value.selectedBookingId)
            incoming = page.messages + incoming
            cursor = page.nextCursor
        }
        mutable.update {
            val messages = mergeMessages(it.messages, incoming)
            val selected = it.selectedBookingId?.takeIf { selected ->
                history.conversation?.bookings?.any { booking -> booking.id == selected } == true
            } ?: history.selectedBookingId
            it.copy(selectedBookingId = selected,
                history = history.copy(selectedBookingId = selected,
                    nextCursor = if (older) history.nextCursor else if (it.history != null) it.history.nextCursor else cursor),
                messages = messages, pending = reconcilePending(it.pending, messages), error = null)
        }
        refreshAttachments(id, state.value.history ?: history)
        // Read receipts must not turn successfully loaded messages into a connection error.
        try { repository.read(id) }
        catch (e: CancellationException) { throw e }
        catch (_: Exception) { /* Retry the receipt on the next history refresh. */ }
    }
    private suspend fun refreshAttachments(conversationId: String, history: History) {
        val gateway = workflows ?: return
        val selectedBookingId = state.value.selectedBookingId ?: history.selectedBookingId
        val ids = listOfNotNull(selectedBookingId)
        var selectedWorkflow: com.nexus.app.features.workflow.model.ClientWorkflow? = null
        val attachments = mutableListOf<ConversationAttachment>()
        var failed = false
        for (requestId in ids.distinct()) {
            try {
                val workflow = gateway.get(requestId)
                selectedWorkflow = workflow
                attachments += workflow.files.map { ConversationAttachment(requestId, workflow.request.serviceName, it) }
            } catch (e: CancellationException) { throw e }
            catch (_: Exception) { failed = true }
        }
        if (state.value.id == conversationId && state.value.selectedBookingId == selectedBookingId) mutable.update { it.copy(selectedWorkflow = if (failed) it.selectedWorkflow else selectedWorkflow, attachments = if (failed) it.attachments else attachments,
            attachmentError = if (failed) "Couldn't load attachments for this booking. Please retry." else null) }
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
        val pending = PendingMessage(newSubmissionKey(), body.trim(), bookingId = state.value.selectedBookingId)
        mutable.update { it.copy(pending = it.pending + pending) }
        deliver(pending)
    }
    fun retry(pending: PendingMessage) { if (pending.failed && state.value.history?.canSend == true) deliver(pending) }
    private fun deliver(pending: PendingMessage) {
        val id = state.value.id ?: return
        mutable.update { it.copy(pending = it.pending.map { row -> if (row.clientMessageId == pending.clientMessageId) row.copy(failed = false, failureReason = null) else row }) }
        viewModelScope.launch {
            try {
                val message = repository.send(id, SendMessage(pending.body, pending.clientMessageId, pending.bookingId))
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
