package com.nexus.app.features.booked_requests.screens

import com.nexus.app.core.components.NexusDialogButton
import com.nexus.app.core.components.NexusAlertDialog
import com.nexus.app.core.theme.NexusButtonShape
import androidx.compose.foundation.background
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nexus.app.core.components.LocalNexusToast
import com.nexus.app.core.components.NexusButton
import com.nexus.app.core.components.StatusBadge
import com.nexus.app.core.theme.NexusColors
import com.nexus.app.features.booking.components.*
import com.nexus.app.features.booking.model.*
import com.nexus.app.features.booked_requests.viewmodel.RequestsViewModel
import org.koin.compose.viewmodel.koinViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BookedRequestsScreen(
    onNewRequestClick: () -> Unit = {},
    initialRequestId: String? = null,
    onBackFromDetails: (() -> Unit)? = null,
    modifier: Modifier = Modifier,
    viewModel: RequestsViewModel = koinViewModel()
) {
    val state by viewModel.state.collectAsState()
    val toast = LocalNexusToast.current
    var confirmCancellation by remember { mutableStateOf(false) }
    LaunchedEffect(viewModel) { viewModel.toasts.collect { toast.show(it.title, it.message, it.kind) } }
    LaunchedEffect(initialRequestId) {
        if (initialRequestId == null) viewModel.refresh() else viewModel.open(initialRequestId)
    }
    fun closeDetails() {
        if (state.cancelling) return
        confirmCancellation = false
        viewModel.close()
        onBackFromDetails?.invoke()
    }

    if (state.detailId != null) {
        val detail = state.detail
        LazyColumn(modifier.fillMaxSize().background(Color(0xFFF7F8FA)),
            contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 0.dp, bottom = 20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)) {
            item { TextButton(shape = NexusButtonShape, onClick = { closeDetails() }, enabled = !state.cancelling,
                contentPadding = PaddingValues(0.dp)) { Text("←  Back to booked requests") } }
            item { PageHeading("Request details", detail?.referenceNumber ?: state.detailId.orEmpty()) }
            if (state.detailLoading) item { LinearProgressIndicator(Modifier.fillMaxWidth()) }
            state.detailError?.let { item { RetryNotice(it) { viewModel.open(state.detailId!!) } } }
            if (detail != null) {
                item { BookingPanel(detail.title.ifBlank { detail.service.name }) {
                    StatusBadge(detail.status)
                    InfoLine("Reference", detail.referenceNumber ?: detail.id)
                    InfoLine("Service", detail.service.name)
                    InfoLine("Package", detail.packageName ?: "Standard service")
                    InfoLine("Preferred specialist", detail.preferredSpecialistName
                        ?: detail.preferredSpecialist?.fullName ?: "Department assignment")
                } }
                item { BookingPanel("Project requirements") {
                    InfoLine("Goals", detail.projectGoals)
                    InfoLine("Requirements", detail.projectRequirements)
                    InfoLine("Expected timeline", detail.expectedTimeline)
                    if (!detail.additionalDetails.isNullOrBlank()) InfoLine("Additional details", detail.additionalDetails)
                } }
                item { BookingPanel("Pricing & dates") {
                    InfoLine("Pricing at submission", detail.price())
                    InfoLine("Submitted", detail.createdAt.take(10))
                    InfoLine("Last updated", detail.updatedAt.take(10))
                } }
                if (detail.canCancel) item {
                    Button(onClick = { confirmCancellation = true },
                        shape = NexusButtonShape,
                        enabled = !state.cancelling && !state.detailLoading,
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.buttonColors(containerColor = NexusColors.ErrorRed, contentColor = Color.White, disabledContainerColor = NexusColors.ErrorRed.copy(alpha = 0.5f), disabledContentColor = Color.White.copy(alpha = 0.7f))) {
                        Text(if (state.cancelling) "Cancelling..." else "Cancel request")
                    }
                }
            }
        }
        if (confirmCancellation && detail != null) {
            NexusAlertDialog(onDismissRequest = { if (!state.cancelling) confirmCancellation = false },
                title = { Text("Cancel this request?") },
                text = { Text(if (detail.acceptedDepartmentId == null)
                    "This request has not been accepted by a department. It will be cancelled directly."
                    else "This will cancel the accepted request through its department workflow.") },
                confirmButton = { NexusDialogButton(onClick = { confirmCancellation = false; viewModel.cancel() }, enabled = !state.cancelling, destructive = true) { Text("Cancel request", maxLines = 1, softWrap = false) } },
                dismissButton = { NexusDialogButton(onClick = { confirmCancellation = false }) { Text("Keep request") } })
        }
    } else {
        PullToRefreshBox(isRefreshing = state.loading, onRefresh = { viewModel.refresh() },
            modifier = modifier.fillMaxSize().background(Color(0xFFF7F8FA))) {
            LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(20.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)) {
                item { Text("Track your requests, review project details, and follow their progress.", fontSize = 13.sp, lineHeight = 20.sp, color = NexusColors.TextSecondary) }
                item { NexusButton("+ New Service Request", onNewRequestClick) }
                item {
                    val summary = state.result.summary
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        listOf(summary.total to "Total requests", summary.pending to "Pending review",
                            summary.inProgress to "In review", summary.completed to "Closed").forEach { (count, label) ->
                            Column(Modifier.weight(1f).background(NexusColors.PrimaryBlue, RoundedCornerShape(8.dp)).padding(start = 8.dp, end = 4.dp, top = 12.dp, bottom = 12.dp)) {
                                Text(count.toString(), fontSize = 22.sp, fontWeight = FontWeight.SemiBold, color = Color.White)
                                Text(label, fontSize = 10.sp, color = Color.White)
                            }
                        }
                    }
                }
                item { OutlinedTextField(state.filters.search, viewModel::search,
                    modifier = Modifier.fillMaxWidth(),
                    placeholder = { Text("Search reference, service, or package", color = NexusColors.TextSecondary) },
                    leadingIcon = { Icon(Icons.Outlined.Search, "Search booked requests", tint = NexusColors.TextSecondary, modifier = Modifier.size(20.dp)) },
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedContainerColor = Color.White,
                        unfocusedContainerColor = Color.White,
                        disabledContainerColor = Color.White
                    ),
                    shape = RoundedCornerShape(10.dp),
                    singleLine = true) }
                item { Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterMenu(if (state.filters.status.isEmpty()) "All statuses" else statusLabel(state.filters.status),
                        listOf("" to "All statuses") + listOf("SUBMITTED", "UNDER_REVIEW", "AWAITING_CLIENT_INFO",
                            "READY_FOR_QUOTATION", "CLOSED", "CANCELLED").map { it to statusLabel(it) },
                        modifier = Modifier.weight(1f), onSelect = viewModel::status)
                    FilterMenu(if (state.filters.sortOrder == "desc") "Newest first" else "Oldest first",
                        listOf("desc" to "Newest first", "asc" to "Oldest first"), modifier = Modifier.weight(1f), onSelect = viewModel::sort)
                } }
                state.error?.let { item { RetryNotice(it) { viewModel.refresh() } } }
                if (!state.loading && state.error == null && state.result.requests.isEmpty()) item {
                    BookingPanel("No requests found") {
                        Text(if (state.filters.search.isBlank() && state.filters.status.isBlank())
                            "Your service requests will appear here after you submit a booking."
                            else "Try a different search or status filter.", fontSize = 13.sp, color = NexusColors.TextSecondary)
                    }
                }
                items(state.result.requests, key = { it.id }) { request ->
                    Card(onClick = { viewModel.open(request.id) }, enabled = !state.loading,
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        border = androidx.compose.foundation.BorderStroke(1.dp, NexusColors.Border)) {
                        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text(request.title.ifBlank { request.service.name }, modifier = Modifier.weight(1f),
                                    fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = NexusColors.HeaderDarkNavy)
                                Text("View", fontSize = 12.sp, color = NexusColors.PrimaryBlue)
                            }
                            Text(request.service.name + " · " + (request.packageName ?: "Standard service"),
                                fontSize = 12.sp, color = NexusColors.TextSecondary)
                            request.referenceNumber?.let { Text(it, fontSize = 11.sp, color = NexusColors.TextSecondary) }
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                StatusBadge(request.status)
                                Text(request.createdAt.take(10), fontSize = 11.sp, color = NexusColors.TextSecondary)
                            }
                        }
                    }
                }
                item {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("${state.result.total} results", fontSize = 12.sp, color = NexusColors.TextSecondary)
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            TextButton(shape = NexusButtonShape, onClick = { viewModel.page(state.filters.page - 1) },
                                enabled = !state.loading && state.filters.page > 1) { Text("Previous") }
                            TextButton(shape = NexusButtonShape, onClick = {}, enabled = false) { Text("${state.filters.page} / ${state.result.pages}") }
                            TextButton(shape = NexusButtonShape, onClick = { viewModel.page(state.filters.page + 1) },
                                enabled = !state.loading && state.filters.page < state.result.pages) { Text("Next") }
                        }
                    }
                }
            }
        }
    }
}
