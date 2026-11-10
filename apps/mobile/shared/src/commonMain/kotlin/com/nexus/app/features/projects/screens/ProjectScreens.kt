package com.nexus.app.features.projects.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nexus.app.core.components.*
import com.nexus.app.core.files.LocalPlatformFiles
import com.nexus.app.core.theme.NexusColors
import com.nexus.app.core.theme.NexusButtonShape
import com.nexus.app.features.projects.model.*
import com.nexus.app.features.projects.viewmodel.ProjectsViewModel
import org.koin.compose.viewmodel.koinViewModel

@Composable
fun MyProjectsScreen(onNewRequest: () -> Unit, onProject: (String) -> Unit, viewModel: ProjectsViewModel = koinViewModel()) {
    val state by viewModel.state.collectAsState()
    var query by rememberSaveable { mutableStateOf("") }
    var status by rememberSaveable { mutableStateOf("ALL") }
    var sort by rememberSaveable { mutableStateOf("UPDATED") }
    var page by rememberSaveable { mutableStateOf(0) }
    ProjectLoadEffect("projects", viewModel::list)
    val statuses = listOf("ALL" to "All Statuses", "IN_PROGRESS" to "In progress", "ON_HOLD" to "On hold", "COMPLETED" to "Completed", "CANCELLED" to "Cancelled")
    val filtered = state.projects.filter { project ->
        (status == "ALL" || project.status == status) && listOf(project.name, project.request?.service?.name.orEmpty(), project.request?.referenceNumber.orEmpty()).any { it.contains(query.trim(), true) }
    }.let { projects -> if (sort == "NAME") projects.sortedBy { it.name.lowercase() } else projects.sortedByDescending { it.updatedAt } }
    val lastPage = ((filtered.size - 1) / 5).coerceAtLeast(0)
    val currentPage = page.coerceAtMost(lastPage)
    ProjectPage {
        ProjectCopy("Follow project progress and review work shared with you.")
        NexusButton("+  New Service Request", onNewRequest)
        Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf(
                Triple(state.projects.count { it.status in setOf("IN_PROGRESS", "ON_HOLD") }, "Active projects", "Currently underway"),
                Triple(state.projects.count { it.status == "COMPLETED" }, "Completed", "Finished projects"),
                Triple(state.projects.sumOf { it.deliverableCount }, "Shared deliverables", "Ready for your review"),
            ).forEach { (count, label, hint) ->
                Surface(Modifier.weight(1f).fillMaxHeight(), color = NexusColors.PrimaryBlue, shape = androidx.compose.foundation.shape.RoundedCornerShape(8.dp)) {
                    Column(Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                        Text(count.toString(), color = Color.White, fontSize = 26.sp, lineHeight = 30.sp, fontWeight = FontWeight.SemiBold)
                        Text(label, color = Color.White, fontSize = 13.sp, lineHeight = 17.sp, fontWeight = FontWeight.Medium)
                        Text(hint, modifier = Modifier.padding(top = 3.dp), color = Color.White, fontSize = 12.sp, lineHeight = 16.sp)
                    }
                }
            }
        }
        OutlinedTextField(
            query, { query = it; page = 0 },
            placeholder = { Text("Search project, service or reference", fontSize = 13.sp) },
            leadingIcon = { Icon(Icons.Outlined.Search, contentDescription = "Search projects", tint = NexusColors.TextSecondary) },
            singleLine = true, modifier = Modifier.fillMaxWidth(), shape = NexusButtonShape,
            colors = OutlinedTextFieldDefaults.colors(
                focusedContainerColor = Color.White, unfocusedContainerColor = Color.White,
                focusedBorderColor = NexusColors.PrimaryBlue, unfocusedBorderColor = NexusColors.Border,
            ),
        )
        NexusDropdown(statuses.first { it.first == status }.second, statuses, status, { status = it; page = 0 }, scrollable = false)
        NexusDropdown(if (sort == "NAME") "Project name" else "Most recently updated", listOf("UPDATED" to "Most recently updated", "NAME" to "Project name"), sort, { sort = it; page = 0 })
        ProjectFeedback(state, viewModel::list)
        if (!state.loading && state.error == null && filtered.isEmpty()) ProjectCard {
            ProjectTitle(if (state.projects.isEmpty()) "No projects yet" else "No matching projects")
            ProjectCopy(if (state.projects.isEmpty()) "Your projects will appear here once work begins." else "Try another search or status filter.")
        }
        filtered.drop(currentPage * 5).take(5).forEach { project ->
            ProjectCard {
                ProjectTitle(project.name)
                ProjectStatus(project.status)
                ProjectCopy(project.request?.referenceNumber ?: project.id)
                Text(project.request?.service?.name ?: "Project", fontSize = 14.sp, color = NexusColors.PrimaryBlue)
                ProjectCopy("${project.deliverableCount} shared deliverable${if (project.deliverableCount == 1) "" else "s"}")
                ProjectProgressBar(project.completedTasks, project.taskCount)
                ProjectCopy("Updated ${displayDate(project.updatedAt)}")
                NexusButton("View project  ›", { onProject(project.id) }, variant = NexusButtonVariant.OUTLINE)
            }
        }
        if (filtered.isNotEmpty()) {
            ProjectCopy("Showing ${currentPage * 5 + 1}–${minOf((currentPage + 1) * 5, filtered.size)} of ${filtered.size}")
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                TextButton({ page = currentPage - 1 }, enabled = currentPage > 0) { Text("Prev") }
                Text("${currentPage + 1}", color = NexusColors.PrimaryBlue)
                TextButton({ page = currentPage + 1 }, enabled = currentPage < lastPage) { Text("Next") }
            }
        }
    }
}

@Composable
fun ProjectScreen(id: String, overview: Boolean, onBack: () -> Unit, onOpen: () -> Unit, onEdit: () -> Unit,
    onRequest: () -> Unit, onChat: () -> Unit, initialTab: String = "OVERVIEW", viewModel: ProjectsViewModel = koinViewModel()) {
    val state by viewModel.state.collectAsState()
    var tab by rememberSaveable(initialTab) { mutableStateOf(initialTab) }
    val toast = LocalNexusToast.current
    LaunchedEffect(state.success) {
        state.success?.let { toast.show(it, "", ToastKind.SUCCESS); viewModel.clearFeedback() }
    }
    ProjectLoadEffect(id) { viewModel.open(id) }
    ProjectPage {
        ProjectBack("Back to My Projects", onBack)
        ProjectFeedback(state) { viewModel.open(id) }
        state.project?.let { project ->
            ProjectHeading(project.name)
            ProjectStatus(project.status)
            if (overview) {
                ProjectCopy(listOfNotNull(project.request?.service?.name, project.request?.referenceNumber).joinToString(" · "))
                OutlinedButton(
                    onClick = onEdit, modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp), shape = NexusButtonShape,
                    border = BorderStroke(1.dp, NexusColors.PrimaryBlue.copy(alpha = 0.45f)),
                    colors = ButtonDefaults.outlinedButtonColors(containerColor = Color.Transparent, contentColor = NexusColors.PrimaryBlue),
                ) { Text("Edit brief", fontSize = 15.sp, fontWeight = FontWeight.SemiBold) }
                NexusButton("+  New project request", onRequest, enabled = project.editable)
                if (project.cancellationPending) ProjectCopy("Updates are paused while your cancellation request is under review.")
                PrimaryTabRow(selectedTabIndex = if (tab == "OVERVIEW") 0 else 1, containerColor = Color.Transparent, contentColor = NexusColors.PrimaryBlue) {
                    listOf("OVERVIEW" to "Overview", "DELIVERABLES" to "Deliverables").forEach { (value, label) ->
                        Tab(selected = tab == value, onClick = { tab = value }, modifier = Modifier.heightIn(min = 56.dp), text = { Text(label, fontSize = 14.sp) })
                    }
                }
            } else ProjectProgressBar(project.progress.completed, project.progress.total)
            if (!overview || tab == "OVERVIEW") {
                ProjectCard {
                    if (overview) ProjectTitle("Project details")
                    ProjectField("Service", project.request?.service?.name ?: "—")
                    ProjectField("Request reference", project.request?.referenceNumber ?: project.request?.id ?: "—")
                    ProjectField("Status", statusLabel(project.status))
                    if (!overview) ProjectField("Deliverables", "${project.deliverables.size} shared deliverables")
                    ProjectField("Started", displayDate(project.startDate))
                    if (overview) ProjectProgressBar(project.progress.completed, project.progress.total)
                }
                ProjectCard { ProjectTitle("Project brief"); ProjectCopy(project.description?.takeIf { it.isNotBlank() } ?: "No project brief added yet.") }
                if (overview) ProjectCard {
                    ProjectTitle("Project requests")
                    ProjectCopy("Track scope changes and cancellation requests.")
                    if (project.changeRequests.isEmpty()) ProjectCopy("No project requests yet. Use ‘New project request’ above to ask the Department Head for a scope change or cancellation.")
                    project.changeRequests.forEach { request ->
                        HorizontalDivider(color = NexusColors.Border)
                        ProjectTitle(if (request.kind == "CANCELLATION") "Cancellation request" else "Change request")
                        ProjectStatus(request.status)
                        ProjectCopy(request.details)
                        ProjectCopy(displayDate(request.createdAt))
                        request.responseNote?.let { ProjectField("Department Head response", it) }
                    }
                }
            } else {
                if (project.deliverables.isEmpty()) ProjectCard { ProjectTitle("No shared deliverables yet"); ProjectCopy("Work shared by your project team will appear here.") }
                project.deliverables.forEach { deliverable -> DeliverableCard(project, deliverable, viewModel, state.saving) }
            }
            NexusButton("Project chat", onChat, variant = NexusButtonVariant.OUTLINE)
            if (!overview) NexusButton("Open project  ›", onOpen)
        }
    }
}

@Composable
private fun DeliverableCard(project: ClientProject, deliverable: ClientDeliverable, viewModel: ProjectsViewModel, busy: Boolean) {
    val platform = LocalPlatformFiles.current
    var note by rememberSaveable(deliverable.id) { mutableStateOf("") }
    val review = deliverable.clientReviews.firstOrNull()?.takeIf { it.workflowFileId == deliverable.workflowFile.id }
    ProjectCard {
        ProjectTitle(deliverable.title)
        deliverable.description?.let { ProjectCopy(it) }
        ProjectCopy(deliverable.workflowFile.name)
        ProjectCopy("Shared ${displayDate(deliverable.sentToClientAt)}")
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            NexusButton("Preview", { platform?.let { viewModel.file(project.id, deliverable, it, true) } }, Modifier.weight(1f), variant = NexusButtonVariant.OUTLINE, enabled = platform != null && !busy)
            NexusButton("Download", { platform?.let { viewModel.file(project.id, deliverable, it, false) } }, Modifier.weight(1f), variant = NexusButtonVariant.OUTLINE, enabled = platform != null && !busy)
        }
        if (review != null) {
            ProjectStatus(review.status)
            review.note?.let { ProjectCopy(it) }
        } else if (project.status != "CANCELLED") {
            NexusTextField(note, { if (it.length <= 2000) note = it }, "Review note", "Describe any revisions needed", singleLine = false, maxLines = 5, enabled = !busy)
            NexusButton("Approve deliverable", { viewModel.review(project.id, deliverable.id, "APPROVED", note) }, enabled = !busy)
            NexusButton("Request revision", { viewModel.review(project.id, deliverable.id, "REVISION_REQUESTED", note) }, variant = NexusButtonVariant.OUTLINE, enabled = !busy && note.trim().length >= 3)
        }
    }
}

@Composable
fun ProjectFormScreen(id: String, edit: Boolean, onBack: () -> Unit, viewModel: ProjectsViewModel = koinViewModel()) {
    val state by viewModel.state.collectAsState()
    var name by rememberSaveable(id) { mutableStateOf<String?>(null) }
    var brief by rememberSaveable(id) { mutableStateOf<String?>(null) }
    var details by rememberSaveable(id) { mutableStateOf("") }
    var kind by rememberSaveable(id) { mutableStateOf("CHANGE") }
    val toast = LocalNexusToast.current
    ProjectLoadEffect(id) { viewModel.open(id) }
    LaunchedEffect(state.success) {
        state.success?.let { toast.show(it, "", ToastKind.SUCCESS); viewModel.clearFeedback(); onBack() }
    }
    ProjectPage {
        ProjectBack("Back to project", onBack, !state.saving)
        ProjectHeading(if (edit) "Edit project brief" else "Request a project change")
        ProjectCopy(if (edit) "Keep the project name and goals up to date." else "Tell the Department Head what should change. They'll review it and respond here.")
        ProjectFeedback(state) { viewModel.open(id) }
        state.project?.let { project ->
            val currentName = name ?: project.name
            val currentBrief = brief ?: project.description.orEmpty()
            val pending = project.changeRequests.any { it.kind == kind && it.status == "PENDING" }
            val detailsLimit = if (kind == "CANCELLATION") 2000 else 4000
            if (!project.editable) ProjectCopy(
                when {
                    project.cancellationPending -> "This brief is read-only while your cancellation request is under review."
                    project.status == "COMPLETED" -> "This project is completed. Its brief is read-only. Briefs can only be edited while a project is in progress or on hold."
                    project.status == "CANCELLED" -> "This project is cancelled. Its brief is read-only."
                    else -> "This brief is read-only. Briefs can only be edited while a project is in progress or on hold."
                }
            )
            if (edit) {
                NexusTextField(currentName, { if (it.length <= 160) name = it }, "Project name", enabled = !state.saving && project.editable)
                ProjectTextArea(currentBrief, { if (it.length <= 6000) brief = it }, "Project brief", enabled = !state.saving && project.editable)
                ProjectCopy("${currentBrief.length}/6,000")
                NexusButton("Cancel", onBack, variant = NexusButtonVariant.OUTLINE, enabled = !state.saving)
                NexusButton("Save brief", { viewModel.brief(id, currentName, currentBrief) }, enabled = !state.loading && project.editable && currentName.trim().length in 2..160 && currentBrief.length <= 6000, loading = state.saving)
            } else {
                ProjectCard {
                    ProjectField("Request type", "Choose what you need")
                    NexusDropdown(if (kind == "CHANGE") "Request a change" else "Request cancellation", listOf("CHANGE" to "Request a change", "CANCELLATION" to "Request cancellation"), kind, { kind = it }, enabled = !state.saving && project.editable)
                    if (pending) ProjectCopy("You already have this type of request under review.")
                    ProjectTextArea(details, { if (it.length <= detailsLimit) details = it }, if (kind == "CHANGE") "What needs to change?" else "Why do you need to cancel?", "Describe your request and why it is needed.", enabled = !state.saving && project.editable && !pending, isError = details.length > detailsLimit)
                    ProjectCopy("${details.length}/$detailsLimit · Minimum 10 characters")
                }
                NexusButton("Keep project", onBack, variant = NexusButtonVariant.OUTLINE, enabled = !state.saving)
                NexusButton(if (kind == "CHANGE") "Send change request" else "Send cancellation request", { viewModel.request(id, kind == "CANCELLATION", details) }, enabled = !state.loading && project.editable && !pending && details.trim().length in 10..detailsLimit, loading = state.saving)
            }
        }
    }
}
