package com.nexus.app.features.projects.screens

import com.nexus.app.core.components.LocalNexusBottomPadding
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.FolderOpen
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nexus.app.core.components.*
import com.nexus.app.core.theme.NexusButtonShape
import com.nexus.app.core.theme.NexusColors
import com.nexus.app.features.projects.components.ClientProjectDetailsSheet
import com.nexus.app.features.projects.components.ProjectStatusPill
import com.nexus.app.features.projects.model.displayDate
import com.nexus.app.features.projects.viewmodel.ClientProjectsViewModel
import org.koin.compose.viewmodel.koinViewModel

@Composable
fun ClientProjectsScreen(
    onNewRequest: () -> Unit,
    onOpenProject: (String) -> Unit,
    onProjectChat: (String) -> Unit,
    modifier: Modifier = Modifier,
    viewModel: ClientProjectsViewModel = koinViewModel()
) {
    val state by viewModel.state.collectAsState()
    val scrollState = rememberScrollState()

    val statusOptions = listOf(
        "ALL" to "All Statuses",
        "ACTIVE" to "Active",
        "COMPLETED" to "Completed",
        "CANCELLED" to "Cancelled"
    )

    val sortOptions = listOf(
        "NEWEST" to "Latest",
        "OLDEST" to "Oldest"
    )

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(NexusColors.SurfaceLight)
            .imePadding()
            .verticalScroll(scrollState)
            .padding(start = 20.dp, end = 20.dp, top = 20.dp, bottom = 8.dp + LocalNexusBottomPadding.current),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text(
            text = "Follow project progress and review work shared with you.",
            fontSize = 13.sp,
            color = NexusColors.TextSecondary
        )

        // Action Button: + New Service Request
        NexusButton(
            text = "+  New Service Request",
            onClick = onNewRequest,
            modifier = Modifier.fillMaxWidth()
        )

        // 3 KPI Summary Cards
        Row(
            modifier = Modifier.fillMaxWidth().height(IntrinsicSize.Min),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            val kpis = listOf(
                Triple(state.activeCount, "Active projects", "Currently underway"),
                Triple(state.completedCount, "Completed", "Finished projects"),
                Triple(state.deliverableCount, "Shared deliverables", "Ready for your review")
            )
            kpis.forEach { (count, title, hint) ->
                Surface(
                    modifier = Modifier.weight(1f).fillMaxHeight(),
                    color = NexusColors.PrimaryBlue,
                    shape = RoundedCornerShape(10.dp)
                ) {
                    Column(
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 12.dp),
                        verticalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Text(
                            text = count.toString(),
                            color = Color.White,
                            fontSize = 24.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = title,
                            color = Color.White,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                        Text(
                            text = hint,
                            color = Color.White.copy(alpha = 0.85f),
                            fontSize = 10.sp,
                            lineHeight = 13.sp
                        )
                    }
                }
            }
        }

        // Search Bar
        NexusSearchField(state.query, viewModel::onQueryChange, "Search project, service or reference")

        // Dropdowns: Status Filter & Sort Order
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Box(modifier = Modifier.weight(1f)) {
                val currentStatusLabel = statusOptions.firstOrNull { it.first == state.filter }?.second ?: "All Statuses"
                NexusDropdown(
                    label = currentStatusLabel,
                    options = statusOptions,
                    selectedValue = state.filter,
                    onSelect = viewModel::onFilterChange,
                    scrollable = false
                )
            }
            Box(modifier = Modifier.weight(1f)) {
                val currentSortLabel = sortOptions.firstOrNull { it.first == state.sort }?.second ?: "Latest"
                NexusDropdown(
                    label = currentSortLabel,
                    options = sortOptions,
                    selectedValue = state.sort,
                    onSelect = viewModel::onSortChange,
                    scrollable = false
                )
            }
        }

        // Loading Indicator
        if (state.loading) {
            LinearProgressIndicator(
                modifier = Modifier.fillMaxWidth(),
                color = NexusColors.PrimaryBlue
            )
        }

        // Error Banner
        state.error?.let { err ->
            Surface(
                modifier = Modifier.fillMaxWidth(),
                color = Color(0xFFFEE2E2),
                shape = RoundedCornerShape(8.dp),
                border = BorderStroke(1.dp, Color(0xFFFECACA))
            ) {
                Row(
                    modifier = Modifier.padding(14.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = err,
                        color = Color(0xFF991B1B),
                        fontSize = 13.sp,
                        modifier = Modifier.weight(1f)
                    )
                    TextButton(onClick = viewModel::load) {
                        Text("Retry", color = NexusColors.PrimaryBlue)
                    }
                }
            }
        }

        // Empty State: No projects at all
        if (!state.loading && state.error == null && state.rawProjects.isEmpty()) {
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                color = Color.White,
                border = BorderStroke(1.dp, Color(0xFFE2E8F0))
            ) {
                Column(
                    modifier = Modifier.padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Surface(
                        color = Color(0xFFEDF2F9),
                        shape = RoundedCornerShape(24.dp),
                        modifier = Modifier.size(48.dp)
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Icon(
                                imageVector = Icons.Outlined.FolderOpen,
                                contentDescription = null,
                                tint = NexusColors.PrimaryBlue,
                                modifier = Modifier.size(24.dp)
                            )
                        }
                    }
                    Text(
                        text = "No projects yet",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = NexusColors.TextPrimary
                    )
                    Text(
                        text = "Once a booked service is activated, it will appear here with its progress and shared deliverables.",
                        fontSize = 12.sp,
                        color = NexusColors.TextSecondary,
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                        lineHeight = 18.sp
                    )
                    NexusButton(
                        text = "Book a service",
                        onClick = onNewRequest,
                        modifier = Modifier.padding(top = 6.dp)
                    )
                }
            }
        }

        // Empty State: Search / Filter matches nothing
        if (!state.loading && state.error == null && state.rawProjects.isNotEmpty() && state.visibleProjects.isEmpty()) {
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                color = Color.White,
                border = BorderStroke(1.dp, Color(0xFFE2E8F0))
            ) {
                Column(
                    modifier = Modifier.padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Text(
                        text = "No projects match",
                        fontSize = 15.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = NexusColors.TextPrimary
                    )
                    Text(
                        text = "Try another search or status filter.",
                        fontSize = 12.sp,
                        color = NexusColors.TextSecondary
                    )
                }
            }
        }

        // Project List Cards
        state.paginatedProjects.forEach { project ->
            val fraction = if (project.taskCount > 0) {
                (project.completedTasks.toFloat() / project.taskCount).coerceIn(0f, 1f)
            } else 0f
            val percent = (fraction * 100).toInt()

            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { viewModel.selectProject(project) },
                shape = RoundedCornerShape(10.dp),
                color = Color.White,
                border = BorderStroke(1.dp, NexusColors.Border)
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = project.name,
                            fontSize = 16.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = NexusColors.TextPrimary,
                            modifier = Modifier.weight(1f).padding(end = 8.dp)
                        )
                        ProjectStatusPill(project.status)
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = project.request?.service?.name ?: "Service Project",
                            modifier = Modifier.weight(1f).padding(end = 8.dp),
                            maxLines = 2,
                            overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Medium,
                            color = NexusColors.PrimaryBlue
                        )
                        Text(
                            text = project.request?.referenceNumber ?: project.id,
                            modifier = Modifier.weight(1f),
                            maxLines = 2,
                            overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
                            fontSize = 12.sp,
                            color = NexusColors.TextSecondary
                        )
                    }

                    Surface(
                        color = Color(0xFFF1F5F9),
                        shape = RoundedCornerShape(4.dp)
                    ) {
                        Text(
                            text = "${project.deliverableCount} shared deliverable${if (project.deliverableCount == 1) "" else "s"}",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Medium,
                            color = Color(0xFF475569),
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                        )
                    }

                    // Progress bar
                    Column(Modifier.fillMaxWidth().background(Color(0xFFE2ECFF), RoundedCornerShape(8.dp)).padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text = "Progress",
                                fontSize = 11.sp,
                                color = NexusColors.TextSecondary
                            )
                            Text(
                                text = "$percent%",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = NexusColors.PrimaryBlue
                            )
                        }
                        NexusProgressBar(fraction)
                        Text(
                            text = "${project.completedTasks} of ${project.taskCount} tasks complete",
                            fontSize = 10.sp,
                            color = NexusColors.TextSecondary
                        )
                    }

                    Text(
                        text = "Updated ${displayDate(project.updatedAt)}",
                        fontSize = 11.sp,
                        color = NexusColors.TextSecondary
                    )

                    NexusButton(
                        text = "View details  ›",
                        onClick = { viewModel.selectProject(project) },
                        variant = NexusButtonVariant.OUTLINE,
                        compact = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }
        }

        // Pagination Controls
        if (state.visibleProjects.isNotEmpty()) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 8.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Showing ${state.fromItem}–${state.toItem} of ${state.visibleProjects.size}",
                    fontSize = 12.sp,
                    color = NexusColors.TextSecondary
                )
                Row(
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    TextButton(
                        onClick = { viewModel.onPageChange(state.currentPage - 1) },
                        enabled = state.currentPage > 1
                    ) {
                        Text("Prev", fontSize = 12.sp)
                    }
                    Text(
                        text = "${state.currentPage} / ${state.totalPages}",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = NexusColors.PrimaryBlue
                    )
                    TextButton(
                        onClick = { viewModel.onPageChange(state.currentPage + 1) },
                        enabled = state.currentPage < state.totalPages
                    ) {
                        Text("Next", fontSize = 12.sp)
                    }
                }
            }
        }
    }

    // Quick-View Drawer / Bottom Sheet
    state.selectedProject?.let { selected ->
        ClientProjectDetailsSheet(
            project = selected,
            onDismiss = { viewModel.selectProject(null) },
            onOpenProject = onOpenProject,
            onProjectChat = onProjectChat
        )
    }
}

