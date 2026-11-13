package com.nexus.app.features.projects.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nexus.app.core.components.NexusButton
import com.nexus.app.core.components.NexusButtonVariant
import com.nexus.app.core.theme.NexusButtonShape
import com.nexus.app.core.theme.NexusColors
import com.nexus.app.features.projects.model.ClientProjectSummary
import com.nexus.app.features.projects.model.displayDate
import com.nexus.app.features.projects.model.statusLabel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ClientProjectDetailsSheet(
    project: ClientProjectSummary,
    onDismiss: () -> Unit,
    onOpenProject: (String) -> Unit,
    onProjectChat: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val percent = if (project.taskCount > 0) {
        ((project.completedTasks.toFloat() / project.taskCount) * 100).toInt().coerceIn(0, 100)
    } else 0
    val fraction = if (project.taskCount > 0) {
        (project.completedTasks.toFloat() / project.taskCount).coerceIn(0f, 1f)
    } else 0f

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        shape = RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp),
        containerColor = Color.White,
        tonalElevation = 0.dp,
        dragHandle = {
            Surface(
                modifier = Modifier.padding(top = 10.dp, bottom = 4.dp),
                color = Color(0xFFD1D5DB),
                shape = RoundedCornerShape(2.dp)
            ) {
                Box(Modifier.size(width = 36.dp, height = 4.dp))
            }
        },
        modifier = modifier
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
        ) {
            // Header
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 12.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "Project details",
                        fontSize = 20.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = NexusColors.HeaderDarkNavy
                    )
                    Text(
                        text = "Review project progress and shared deliverables.",
                        fontSize = 12.sp,
                        color = NexusColors.TextSecondary,
                        modifier = Modifier.padding(top = 2.dp)
                    )
                }
                IconButton(
                    onClick = onDismiss,
                    modifier = Modifier.size(32.dp)
                ) {
                    Icon(
                        imageVector = Icons.Outlined.Close,
                        contentDescription = "Close details",
                        tint = NexusColors.TextSecondary,
                        modifier = Modifier.size(20.dp)
                    )
                }
            }

            HorizontalDivider(color = Color(0xFFECEEF1))

            // Body
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f, fill = false)
                    .verticalScroll(rememberScrollState())
                    .padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Project Name & Status
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        text = project.name,
                        fontSize = 17.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = NexusColors.TextPrimary
                    )
                    ProjectStatusPill(project.status)
                }

                // Progress Card
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = Color(0xFFF8FAFD),
                    border = BorderStroke(1.dp, Color(0xFFE4E9F0)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier.padding(14.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "Project progress",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = NexusColors.TextPrimary
                            )
                            Text(
                                text = "$percent%",
                                fontSize = 13.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = NexusColors.PrimaryBlue
                            )
                        }
                        LinearProgressIndicator(
                            progress = { fraction },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(6.dp),
                            color = NexusColors.PrimaryBlue,
                            trackColor = Color(0xFFDFE6EF),
                            gapSize = 0.dp
                        )
                        Text(
                            text = "${project.completedTasks} of ${project.taskCount} tasks complete",
                            fontSize = 11.sp,
                            color = NexusColors.TextSecondary
                        )
                    }
                }

                // Metadata Grid
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(0.dp)
                ) {
                    val metadata = listOf(
                        "Service" to (project.request?.service?.name ?: "Project"),
                        "Request reference" to (project.request?.referenceNumber ?: project.id),
                        "Deliverables" to "${project.deliverableCount} ${if (project.deliverableCount == 1) "deliverable" else "deliverables"}",
                        "Started" to if (project.startDate != null) displayDate(project.startDate) else "Not started",
                        "Last updated" to displayDate(project.updatedAt)
                    )
                    metadata.forEach { (label, value) ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .border(
                                    BorderStroke(0.5.dp, Color(0xFFECEEF1))
                                )
                                .padding(vertical = 10.dp, horizontal = 4.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = label,
                                fontSize = 12.sp,
                                color = NexusColors.TextSecondary
                            )
                            Text(
                                text = value,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Medium,
                                color = NexusColors.TextPrimary
                            )
                        }
                    }
                }

                // Project Brief
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(
                        text = "Project brief",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = NexusColors.TextPrimary
                    )
                    Text(
                        text = project.description?.takeIf { it.isNotBlank() } ?: "No project brief provided.",
                        fontSize = 12.sp,
                        lineHeight = 18.sp,
                        color = NexusColors.TextSecondary
                    )
                }
            }

            HorizontalDivider(color = Color(0xFFECEEF1))

            // Actions Footer
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 14.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                if (project.startDate != null) {
                    Box(modifier = Modifier.weight(1f)) {
                        NexusButton(
                            text = "Project chat",
                            onClick = {
                                onDismiss()
                                onProjectChat(project.id)
                            },
                            variant = NexusButtonVariant.OUTLINE,
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                }
                Box(modifier = Modifier.weight(1f)) {
                    NexusButton(
                        text = "Open project",
                        onClick = {
                            onDismiss()
                            onOpenProject(project.id)
                        },
                        variant = NexusButtonVariant.PRIMARY,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }
        }
    }
}

@Composable
fun ProjectStatusPill(status: String, modifier: Modifier = Modifier) {
    val (bgColor, textColor) = when (status) {
        "IN_PROGRESS" -> Color(0xFFFEF3C7) to Color(0xFF92400E)
        "COMPLETED" -> Color(0xFFDCFCE7) to Color(0xFF166534)
        "CANCELLED" -> Color(0xFFFEE2E2) to Color(0xFF991B1B)
        "ON_HOLD" -> Color(0xFFFFEDD5) to Color(0xFF9A3412)
        else -> Color(0xFFF1F5F9) to Color(0xFF475569)
    }
    Surface(
        color = bgColor,
        shape = RoundedCornerShape(6.dp),
        modifier = modifier
    ) {
        Text(
            text = statusLabel(status),
            modifier = Modifier.padding(horizontal = 9.dp, vertical = 4.dp),
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            color = textColor
        )
    }
}

