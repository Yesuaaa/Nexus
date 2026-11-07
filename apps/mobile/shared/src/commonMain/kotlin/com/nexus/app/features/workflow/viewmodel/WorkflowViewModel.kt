package com.nexus.app.features.workflow.viewmodel

import com.nexus.app.core.files.*
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nexus.app.features.booking.model.newSubmissionKey
import com.nexus.app.features.conversations.api.CommunicationException
import com.nexus.app.features.workflow.api.WorkflowRepository
import com.nexus.app.features.workflow.model.*
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*

data class WorkflowState(val workflow: ClientWorkflow? = null, val project: ProjectWorkspace? = null,
    val attachmentOptions: List<ClientWorkflow> = emptyList(),
    val busy: Boolean = false, val pendingAction: Boolean = false, val uploadProgress: Float? = null, val selectedFileId: String? = null, val error: String? = null)
class WorkflowViewModel(private val repository: WorkflowRepository) : ViewModel() {
    private val mutable = MutableStateFlow(WorkflowState())
    val state = mutable.asStateFlow()
    private var id: String? = null
    private var job: Job? = null
    private var upload: Pair<SelectedFile, String>? = null
    private var uncertain: Triple<String, Map<String, String>, Pair<Int, String>>? = null
    fun open(requestId: String) {
        if (state.value.busy) return
        if (id != requestId) { uncertain = null; upload = null; mutable.value = WorkflowState() }
        id = requestId
        job?.cancel()
        job = viewModelScope.launch { execute {
            val workflow = repository.get(requestId)
            mutable.update { it.copy(workflow = workflow, project = null) }
            workflow.project?.let { project -> val workspace = repository.project(project.id); mutable.update { it.copy(project = workspace) } }
        } }
    }
    fun loadAttachmentOptions(requestIds: List<String>) {
        if (state.value.busy) return
        mutable.update { it.copy(attachmentOptions = emptyList(), busy = true) }
        job = viewModelScope.launch {
            execute {
                val options = requestIds.distinct().map { repository.get(it) }.filter { it.canAttachFile() }
                mutable.update { it.copy(attachmentOptions = options) }
            }
        }
    }
    fun retryAction() { uncertain?.let { action(it.first, it.second) } }
    fun upload(platform: PlatformFiles, targetRequestId: String? = id) {
        if (uncertain != null) { mutable.update { it.copy(error = "Confirm the previous action before uploading another file.") }; return }
        val requestId = targetRequestId ?: return
        if (state.value.busy) return
        if (id != requestId) { upload = null; id = requestId }
        mutable.update { it.copy(busy = true) }
        job = viewModelScope.launch { execute {
            val current = repository.get(requestId)
            mutable.update { it.copy(workflow = current, project = null) }
            if (!current.canAttachFile()) {
                throw IllegalStateException("Attachments are unavailable for this booking. Choose another eligible booking.")
            }
            val pending = upload ?: platform.select()?.let { it to newSubmissionKey() } ?: return@execute
            upload = pending
            val file = repository.upload(requestId, pending.first, pending.second) { value -> mutable.update { it.copy(uploadProgress = value) } }
            upload = null
            val workflow = repository.get(requestId)
            mutable.update { it.copy(workflow = workflow, selectedFileId = file.id, uploadProgress = null) }
        }; mutable.update { it.copy(uploadProgress = null) } }
    }
    fun selectFile(id: String) { mutable.update { it.copy(selectedFileId = id) } }
    fun file(platform: PlatformFiles, file: WorkflowFile, preview: Boolean) {
        val requestId = id ?: return
        if (state.value.busy) return
        mutable.update { it.copy(busy = true) }
        job = viewModelScope.launch { execute {
            val selected = repository.download(requestId, file)
            if (preview) platform.preview(selected) else platform.save(selected)
        } }
    }
    fun action(type: String, fields: Map<String, String> = emptyMap()) {
        val current = state.value.workflow ?: return
        val requestId = id ?: return
        if (state.value.busy || !current.permissions.isClient || current.version < 1) return
        val previous = uncertain
        if (previous != null && (previous.first != type || previous.second != fields)) {
            mutable.update { it.copy(error = "Confirm the previous action before starting a different action.") }; return
        }
        val key = previous?.third ?: (current.version to newSubmissionKey())
        uncertain = Triple(type, fields.toMap(), key)
        mutable.update { it.copy(busy = true, pendingAction = true) }
        job = viewModelScope.launch {
            execute {
                try {
                    val workflow = repository.action(requestId, key.first, key.second, type, fields)
                    uncertain = null
                    mutable.update { it.copy(workflow = workflow, pendingAction = false) }
                } catch (e: CommunicationException) {
                    if (e.status == 409) {
                        uncertain = null
                        mutable.update { it.copy(pendingAction = false) }
                        val workflow = repository.get(requestId)
                        mutable.update { it.copy(workflow = workflow) }
                        throw Exception("This request changed. Review the refreshed details before submitting again.")
                    }
                    if (e.status in 400..499) { uncertain = null; mutable.update { it.copy(pendingAction = false) } }
                    throw e
                }
            }
        }
    }
    private suspend fun execute(block: suspend () -> Unit) {
        mutable.update { it.copy(busy = true, error = null) }
        try { block() } catch (e: CancellationException) { throw e }
        catch (e: Exception) { mutable.update { it.copy(error = e.message) } }
        finally { mutable.update { it.copy(busy = false) } }
    }
}
