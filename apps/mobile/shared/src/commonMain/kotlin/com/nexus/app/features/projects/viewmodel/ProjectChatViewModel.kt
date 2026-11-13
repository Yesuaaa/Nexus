package com.nexus.app.features.projects.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nexus.app.features.booking.model.newSubmissionKey
import com.nexus.app.features.conversations.api.CommunicationException
import com.nexus.app.features.projects.api.ProjectsRepository
import com.nexus.app.features.projects.model.*
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import kotlinx.coroutines.flow.*

data class ProjectChatState(
    val history: ProjectChatHistory? = null, val loading: Boolean = false, val sending: Boolean = false,
    val error: String? = null, val pendingBody: String? = null, val sentCount: Int = 0,
)
class ProjectChatViewModel(private val repository: ProjectsRepository) : ViewModel() {
    private val mutable = MutableStateFlow(ProjectChatState())
    val state = mutable.asStateFlow()
    private var pendingKey: String? = null
    fun refresh(id: String, older: Boolean = false) {
        if (mutable.value.loading || mutable.value.sending) return
        val cursor = if (older) mutable.value.history?.nextCursor ?: return else null
        mutable.update { it.copy(loading = true, error = null) }
        viewModelScope.launch {
            try {
                val history = repository.history(id, cursor)
                mutable.update { current ->
                    val messages = (current.history?.messages.orEmpty() + history.messages).associateBy { it.id }.values.sortedWith(compareBy<ProjectChatMessage> { it.createdAt }.thenBy { it.id })
                    current.copy(history = history.copy(messages = messages, nextCursor = if (older || current.history == null) history.nextCursor else current.history.nextCursor))
                }
                if (!older) repository.markRead(id)
            } catch (e: CancellationException) { throw e }
            catch (e: CommunicationException) {
                mutable.update { it.copy(history = if (e.status in setOf(401, 403, 404)) null else it.history, error = e.message) }
            }
            catch (e: Exception) { mutable.update { it.copy(error = e.message ?: "Unable to load messages") } }
            finally { mutable.update { it.copy(loading = false) } }
        }
    }
    fun send(id: String, text: String) {
        if (mutable.value.loading || mutable.value.sending || mutable.value.history?.canSend != true) return
        val body = mutable.value.pendingBody ?: text.trim()
        if (body.isBlank() || body.length > 4000) return
        val key = pendingKey ?: newSubmissionKey().also { pendingKey = it }
        mutable.update { it.copy(sending = true, error = null, pendingBody = body) }
        viewModelScope.launch {
            try {
                val message = repository.send(id, body, key)
                pendingKey = null
                mutable.update { current ->
                    val history = current.history
                    val messages = (history?.messages.orEmpty() + message).distinctBy { it.id }.sortedWith(compareBy<ProjectChatMessage> { it.createdAt }.thenBy { it.id })
                    current.copy(history = history?.copy(messages = messages), pendingBody = null, sentCount = current.sentCount + 1)
                }
            } catch (e: CancellationException) { throw e }
            catch (e: CommunicationException) {
                if (e.status in 400..499) {
                    pendingKey = null
                    mutable.update { it.copy(pendingBody = null, history = it.history?.copy(canSend = false)) }
                }
                mutable.update { it.copy(error = e.message) }
            }
            catch (e: Exception) { mutable.update { it.copy(error = e.message ?: "Message could not be sent. Retry to confirm delivery.") } }
            finally { mutable.update { it.copy(sending = false) } }
        }
    }
}
