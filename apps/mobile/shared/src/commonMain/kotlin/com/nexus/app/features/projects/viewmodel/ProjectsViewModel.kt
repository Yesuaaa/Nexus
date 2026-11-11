package com.nexus.app.features.projects.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nexus.app.core.files.PlatformFiles
import com.nexus.app.features.projects.api.ProjectsRepository
import com.nexus.app.features.projects.model.*
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import kotlinx.coroutines.flow.*

data class ProjectsState(
    val projects: List<ClientProjectSummary> = emptyList(), val events: List<CalendarEvent> = emptyList(),
    val project: ClientProject? = null, val loading: Boolean = false, val saving: Boolean = false,
    val error: String? = null, val success: String? = null,
)
class ProjectsViewModel(private val repository: ProjectsRepository) : ViewModel() {
    private val mutable = MutableStateFlow(ProjectsState())
    val state = mutable.asStateFlow()
    fun list() = load { val projects = repository.list(); mutable.update { it.copy(projects = projects) } }
    fun calendar() = load { val events = repository.calendar(); mutable.update { it.copy(events = events) } }
    fun open(id: String) {
        if (mutable.value.project?.id != id) mutable.update { it.copy(project = null) }
        load { val project = repository.get(id); mutable.update { it.copy(project = project) } }
    }
    fun clearFeedback() { mutable.update { it.copy(error = null, success = null) } }
    fun brief(id: String, name: String, description: String) = save("Project brief saved") { repository.brief(id, name, description) }
    fun request(id: String, cancellation: Boolean, details: String) = save("Project request sent") { repository.request(id, cancellation, details) }
    fun review(id: String, deliverableId: String, decision: String, note: String) = save("Deliverable review sent") { repository.review(id, deliverableId, decision, note) }
    fun file(id: String, deliverable: ClientDeliverable, platform: PlatformFiles, preview: Boolean) {
        if (mutable.value.saving) return
        mutable.update { it.copy(saving = true, error = null) }
        viewModelScope.launch {
            try {
                val file = repository.file(id, deliverable)
                if (preview) platform.preview(file) else platform.save(file)
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) { mutable.update { it.copy(error = e.message ?: "Unable to open file") } }
            finally { mutable.update { it.copy(saving = false) } }
        }
    }
    private fun load(block: suspend () -> Unit) {
        if (mutable.value.loading || mutable.value.saving) return
        mutable.update { it.copy(loading = true, error = null) }
        viewModelScope.launch {
            try { block() }
            catch (e: CancellationException) { throw e }
            catch (e: Exception) { mutable.update { it.copy(error = e.message ?: "Unable to load. Please retry.") } }
            finally { mutable.update { it.copy(loading = false) } }
        }
    }
    private fun save(message: String, block: suspend () -> ClientProject) {
        if (mutable.value.saving || mutable.value.loading) return
        mutable.update { it.copy(saving = true, error = null, success = null) }
        viewModelScope.launch {
            try {
                val project = block()
                mutable.update { it.copy(project = project, success = message) }
            } catch (e: CancellationException) { throw e }
            catch (e: Exception) { mutable.update { it.copy(error = e.message ?: "Unable to save. Please retry.") } }
            finally { mutable.update { it.copy(saving = false) } }
        }
    }
}
