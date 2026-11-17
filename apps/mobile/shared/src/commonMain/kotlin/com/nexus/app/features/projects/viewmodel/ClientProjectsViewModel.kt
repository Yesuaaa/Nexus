package com.nexus.app.features.projects.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nexus.app.features.projects.api.ProjectsRepository
import com.nexus.app.features.projects.model.ClientProjectSummary
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

const val PROJECT_PAGE_SIZE = 10

data class ClientProjectsState(
    val rawProjects: List<ClientProjectSummary> = emptyList(),
    val query: String = "",
    val filter: String = "ALL",
    val sort: String = "NEWEST",
    val page: Int = 1,
    val loading: Boolean = false,
    val error: String? = null,
    val selectedProject: ClientProjectSummary? = null
) {
    val activeCount: Int
        get() = rawProjects.count { it.status == "IN_PROGRESS" || it.status == "ON_HOLD" }

    val completedCount: Int
        get() = rawProjects.count { it.status == "COMPLETED" }

    val deliverableCount: Int
        get() = rawProjects.sumOf { it.deliverableCount }

    val visibleProjects: List<ClientProjectSummary>
        get() {
            val normalized = query.trim().lowercase()
            return rawProjects
                .filter { project ->
                    val matchesFilter = when (filter) {
                        "ALL" -> true
                        "ACTIVE" -> project.status == "IN_PROGRESS" || project.status == "ON_HOLD"
                        else -> project.status == filter
                    }
                    val searchable = listOfNotNull(
                        project.name,
                        project.request?.service?.name,
                        project.request?.referenceNumber
                    ).joinToString(" ").lowercase()

                    matchesFilter && (normalized.isEmpty() || searchable.contains(normalized))
                }
                .sortedWith { first, second ->
                    val diff = second.updatedAt.compareTo(first.updatedAt)
                    if (sort == "NEWEST") diff else -diff
                }
        }

    val totalPages: Int
        get() = maxOf(1, (visibleProjects.size + PROJECT_PAGE_SIZE - 1) / PROJECT_PAGE_SIZE)

    val currentPage: Int
        get() = page.coerceIn(1, totalPages)

    val paginatedProjects: List<ClientProjectSummary>
        get() {
            val pageStart = (currentPage - 1) * PROJECT_PAGE_SIZE
            return visibleProjects.drop(pageStart).take(PROJECT_PAGE_SIZE)
        }

    val fromItem: Int
        get() = if (visibleProjects.isEmpty()) 0 else (currentPage - 1) * PROJECT_PAGE_SIZE + 1

    val toItem: Int
        get() = minOf(currentPage * PROJECT_PAGE_SIZE, visibleProjects.size)
}

class ClientProjectsViewModel(private val repository: ProjectsRepository) : ViewModel() {
    private val mutable = MutableStateFlow(ClientProjectsState())
    val state = mutable.asStateFlow()

    init {
        load()
    }

    fun load() {
        if (mutable.value.loading) return
        mutable.update { it.copy(loading = true, error = null) }
        viewModelScope.launch {
            try {
                val projects = repository.listClientProjects()
                mutable.update { it.copy(rawProjects = projects, loading = false) }
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                mutable.update { it.copy(error = e.message ?: "Couldn't load your projects.", loading = false) }
            }
        }
    }

    fun onQueryChange(query: String) {
        mutable.update { it.copy(query = query, page = 1) }
    }

    fun onFilterChange(filter: String) {
        mutable.update { it.copy(filter = filter, page = 1) }
    }

    fun onSortChange(sort: String) {
        mutable.update { it.copy(sort = sort, page = 1) }
    }

    fun onPageChange(page: Int) {
        val total = mutable.value.totalPages
        mutable.update { it.copy(page = page.coerceIn(1, total)) }
    }

    fun selectProject(project: ClientProjectSummary?) {
        mutable.update { it.copy(selectedProject = project) }
    }
}

