package com.nexus.app.features.workflow.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nexus.app.core.files.LocalPlatformFiles
import com.nexus.app.features.conversations.api.ClientCommunicationRepository
import com.nexus.app.features.conversations.components.*
import com.nexus.app.features.conversations.model.History
import com.nexus.app.features.workflow.model.*
import com.nexus.app.features.workflow.viewmodel.WorkflowViewModel
import kotlinx.coroutines.CancellationException
import kotlinx.datetime.*
import org.koin.compose.koinInject
import org.koin.compose.viewmodel.koinViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WorkflowScreen(id: String, onBack: () -> Unit, conversationId: String? = null, initialDocuments: Boolean = false,
    viewModel: WorkflowViewModel = koinViewModel()) {
    val state by viewModel.state.collectAsState()
    val repository: ClientCommunicationRepository = koinInject()
    val platformFiles = LocalPlatformFiles.current
    var history by remember(conversationId) { mutableStateOf<History?>(null) }
    var selectedBooking by remember(id) { mutableStateOf(id) }
    var cancellationNote by remember(selectedBooking) { mutableStateOf("") }
    var decisionNote by remember(selectedBooking) { mutableStateOf("") }
    var paymentReference by remember(selectedBooking) { mutableStateOf("") }
    var confirmed by remember(selectedBooking) { mutableStateOf(false) }
    var cancelConfirm by remember { mutableStateOf(false) }
    var documents by remember { mutableStateOf(initialDocuments) }
    var proposedTime by remember { mutableStateOf("") }
    var rescheduleNote by remember { mutableStateOf("") }
    var scheduleError by remember { mutableStateOf<String?>(null) }
    var consultationDetails by remember { mutableStateOf<Consultation?>(null) }
    LaunchedEffect(selectedBooking) { viewModel.open(selectedBooking) }
    LaunchedEffect(conversationId, id) {
        try { history = repository.history(conversationId ?: id) }
        catch (error: CancellationException) { throw error }
        catch (_: Exception) { history = null }
    }
    val conversation = history?.conversation
    val workflow = state.workflow
    LazyColumn(Modifier.fillMaxSize().background(ConversationStyle.Background), contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        item {
            Row(Modifier.clickable(onClick = onBack).padding(bottom = 16.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Icon(Icons.AutoMirrored.Outlined.ArrowBack, null, Modifier.size(16.dp), tint = ConversationStyle.Navy)
                Text("Back to chat", color = ConversationStyle.Navy, fontSize = 14.sp)
            }
            Text("Conversation details", fontSize = 22.sp, lineHeight = 28.sp, fontWeight = FontWeight.SemiBold, color = ConversationStyle.Ink)
        }
        if (state.busy) item { LinearProgressIndicator(Modifier.fillMaxWidth(), color = ConversationStyle.Navy) }
        state.error?.let { error -> item {
            Text(error, color = MaterialTheme.colorScheme.error, fontSize = 12.sp)
            TextButton(onClick = { viewModel.open(selectedBooking) }, enabled = !state.busy) { Text("Refresh details") }
        } }
        if (state.pendingAction && !state.busy) item { TextButton(onClick = viewModel::retryAction) { Text("Confirm previous action") } }
        if (workflow != null) {
            item { DetailSection {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    ChatAvatar(conversation?.head?.fullName ?: workflow.request.department?.name ?: "EXP", conversation?.head?.imageUrl)
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(conversation?.head?.fullName ?: workflow.request.department?.name ?: "Department", fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = ConversationStyle.Ink)
                        Text("Department head", fontSize = 12.sp, color = ConversationStyle.Muted)
                    }
                }
                HorizontalDivider(color = ConversationStyle.Divider)
                MetadataRow("Client", "You")
                MetadataRow("Department", conversation?.department?.name ?: workflow.request.department?.name ?: "Not assigned")
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Status", Modifier.width(100.dp), fontSize = 12.sp, color = ConversationStyle.Muted)
                    WorkflowPill("Active", true)
                }
                MetadataRow("Manager", conversation?.head?.fullName ?: "Department head")
                MetadataRow("Bookings", (conversation?.bookings?.size ?: 1).toString())
            } }
            item { Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Booked services", fontSize = 16.sp, lineHeight = 24.sp, fontWeight = FontWeight.SemiBold, color = ConversationStyle.Ink)
                Text("Tap to choose a booking. The details below apply to it.", fontSize = 12.sp, lineHeight = 18.sp, color = ConversationStyle.Muted)
                val bookings = conversation?.bookings.orEmpty()
                if (bookings.isEmpty()) BookingOption(com.nexus.app.features.conversations.model.ConversationBooking(workflow.request.id, workflow.request.title,
                    workflow.request.serviceName, workflow.state, workflow.request.referenceNumber, workflow.state), true, {}, true)
                else bookings.forEach { booking ->
                    BookingOption(if (booking.id == selectedBooking) booking.copy(workflowState = workflow.state) else booking,
                        selectedBooking == booking.id, { if (!state.busy) selectedBooking = booking.id }, true)
                }
            } }
            item { DetailSection("Service details") {
                DetailValue("Service", workflow.request.serviceName)
                DetailValue("Package", workflow.request.packageName ?: "Standard service")
                DetailValue("Request reference", workflow.request.referenceNumber ?: workflow.request.id)
                HorizontalDivider(color = ConversationStyle.Divider)
                DetailValue("Project goals", workflow.request.goals)
                DetailValue("Submitted requirements", workflow.request.requirements)
                DetailValue("Expected timeline", workflow.request.expectedTimeline.ifBlank { "Not specified" })
            } }
            item { DetailSection("Requirements - ${workflow.requirements.count { it.status == "COMPLETED" }}/${workflow.requirements.size}") {
                if (workflow.requirements.isEmpty()) Text("No additional requirements requested.", fontSize = 12.sp, lineHeight = 18.sp, color = ConversationStyle.Muted)
                workflow.requirements.forEach { requirement ->
                    var submission by remember(requirement.id, requirement.submission) { mutableStateOf(requirement.submission.orEmpty()) }
                    Text(requirement.title, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = ConversationStyle.Ink)
                    if (requirement.details.isNotBlank()) Text(requirement.details, fontSize = 12.sp, lineHeight = 18.sp, color = ConversationStyle.Muted)
                    WorkflowPill(humanStatus(requirement.status), requirement.status == "COMPLETED")
                    if (workflow.state !in setOf("PENDING_REVIEW", "CANCELLED", "DECLINED", "ACTIVE_PROJECT", "ON_HOLD") && requirement.status !in setOf("COMPLETED", "SUBMITTED")) {
                        OutlinedTextField(submission, { submission = it.take(4000) }, Modifier.fillMaxWidth(), placeholder = { Text("Your response", fontSize = 14.sp) }, shape = RoundedCornerShape(6.dp))
                        OutlinedButton(onClick = { viewModel.action("SUBMIT_REQUIREMENT", buildMap { put("requirementId", requirement.id); put("submission", submission); state.selectedFileId?.let { put("fileId", it) } }) }, enabled = !state.busy && (submission.isNotBlank() || state.selectedFileId != null), shape = RoundedCornerShape(6.dp)) { Text("Submit requirement", fontSize = 12.sp) }
                    } else requirement.submission?.let { Text(it, fontSize = 14.sp, lineHeight = 21.sp) }
                }
            } }
            item { DetailSection("Commencement checklist") {
                val approved = workflow.state in setOf("AGREEMENT_PAYMENT_PENDING", "READY_FOR_ACTIVATION", "ACTIVE_PROJECT") || workflow.quotations.any { it.status == "ACCEPTED" }
                ChecklistRow("Client approval", if (approved) "Completed" else "Pending", approved)
                workflow.agreement?.let { agreement -> ChecklistRow("Agreement *", if (agreement.status == "APPROVED") "Completed" else humanStatus(agreement.status), agreement.status == "APPROVED") { documents = true } }
                workflow.payment?.let { payment -> ChecklistRow("Payment *", when (payment.status) { "VERIFIED" -> "Verified"; "SUBMITTED" -> "Pending review"; else -> "Pending" }, payment.status == "VERIFIED") { documents = true } }
                Text(workflow.nextAction, fontSize = 12.sp, lineHeight = 18.sp, color = ConversationStyle.Muted)
            } }
            if (workflow.state == "CLIENT_APPROVAL") items(workflow.quotations.takeLast(1), key = { it.id }) { quote ->
                DetailSection("Quotation v${quote.version}") {
                    Text(quote.currency + " " + quote.total, fontSize = 22.sp, color = ConversationStyle.Navy, fontWeight = FontWeight.SemiBold)
                    Text(quote.scope, fontSize = 14.sp, lineHeight = 21.sp)
                    quote.deliverables.forEach { Text("- $it", fontSize = 14.sp) }
                    Text(quote.timeline, fontSize = 12.sp, color = ConversationStyle.Muted)
                    Text(quote.paymentTerms, fontSize = 12.sp, color = ConversationStyle.Muted)
                    OutlinedTextField(decisionNote, { decisionNote = it.take(2000) }, label = { Text("Decision note") }, modifier = Modifier.fillMaxWidth())
                    Row { listOf("ACCEPT", "REVISE", "DECLINE").forEach { decision ->
                        TextButton(onClick = { viewModel.action("RESPOND_QUOTATION", mapOf("quotationId" to quote.id, "decision" to decision, "note" to decisionNote)) }, enabled = !state.busy && (decision == "ACCEPT" || decisionNote.isNotBlank())) { Text(humanStatus(decision), fontSize = 12.sp) }
                    } }
                }
            }
            if (workflow.consultations.isNotEmpty()) item { Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Scheduled consultation", fontSize = 16.sp, lineHeight = 24.sp, fontWeight = FontWeight.SemiBold, color = ConversationStyle.Ink)
                workflow.consultations.forEach { consultation -> ConsultationCard(consultation) { consultationDetails = consultation } }
            } }
            state.project?.let { project -> item { DetailSection(project.name) {
                Text(humanStatus(project.status), fontSize = 14.sp, color = ConversationStyle.Muted)
                Text("${project.milestones.count { it.completedAt != null }}/${project.milestones.size} milestones complete", fontSize = 12.sp)
                project.milestones.forEach { ChecklistRow(it.title, if (it.completedAt != null) "Completed" else "Pending", it.completedAt != null) }
            } } }
            if (workflow.state !in setOf("CANCELLED", "DECLINED", "ACTIVE_PROJECT", "PENDING_REVIEW")) item { DetailSection("Workflow controls") {
                Text("Cancellation reason", fontSize = 14.sp, color = ConversationStyle.Ink)
                OutlinedTextField(cancellationNote, { cancellationNote = it.take(2000) }, modifier = Modifier.fillMaxWidth().heightIn(min = 112.dp), shape = RoundedCornerShape(6.dp))
                Row(verticalAlignment = Alignment.Top) {
                    Checkbox(confirmed, { confirmed = it }, modifier = Modifier.size(36.dp), colors = CheckboxDefaults.colors(checkedColor = ConversationStyle.Navy))
                    Text("I confirm this cancellation will end the request workflow.", Modifier.padding(top = 4.dp), fontSize = 12.sp, lineHeight = 18.sp, color = ConversationStyle.Muted)
                }
                OutlinedButton(onClick = { cancelConfirm = true }, enabled = !state.busy && confirmed && cancellationNote.isNotBlank(), modifier = Modifier.fillMaxWidth().height(44.dp), shape = RoundedCornerShape(6.dp), border = BorderStroke(1.dp, Color(0xFFEF4444)), colors = ButtonDefaults.outlinedButtonColors(contentColor = Color(0xFFDC2626))) { Text("Cancel request", fontSize = 14.sp) }
            } }
        }
    }
    if (cancelConfirm) AlertDialog(onDismissRequest = { cancelConfirm = false }, title = { Text("Cancel this request?") }, text = { Text("This ends the selected request workflow.") },
        confirmButton = { TextButton(onClick = { cancelConfirm = false; viewModel.action("CANCEL", mapOf("note" to cancellationNote)) }) { Text("Cancel request") } },
        dismissButton = { TextButton(onClick = { cancelConfirm = false }) { Text("Keep request") } })
    consultationDetails?.let { consultation -> AlertDialog(onDismissRequest = { consultationDetails = null }, title = { Text("Consultation appointment") },
        text = { Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(appointmentDate(consultation.startsAt)); Text(consultation.location)
            if (consultation.notes.isNotBlank()) Text(consultation.notes)
            if (consultation.status == "SCHEDULED") {
                OutlinedTextField(proposedTime, { proposedTime = it }, label = { Text("Proposed date and time") }, placeholder = { Text("2026-11-06 09:00") })
                OutlinedTextField(rescheduleNote, { rescheduleNote = it.take(2000) }, label = { Text("Reason for rescheduling") })
                scheduleError?.let { Text(it, color = MaterialTheme.colorScheme.error, fontSize = 12.sp) }
            }
        } },
        confirmButton = {
            if (consultation.status == "SCHEDULED") TextButton(onClick = {
                val startsAt = runCatching { LocalDateTime.parse(proposedTime.trim().replace(' ', 'T')).toInstant(TimeZone.currentSystemDefault()).toString() }.getOrNull()
                if (startsAt == null) scheduleError = "Enter a valid date and time."
                else { viewModel.action("REQUEST_CONSULTATION_RESCHEDULE", mapOf("consultationId" to consultation.id, "startsAt" to startsAt, "note" to rescheduleNote)); consultationDetails = null }
            }, enabled = !state.busy && proposedTime.isNotBlank() && rescheduleNote.isNotBlank()) { Text("Request reschedule") }
        }, dismissButton = { TextButton(onClick = { consultationDetails = null }) { Text("Close") } }) }
    if (documents && workflow != null) ModalBottomSheet(onDismissRequest = { documents = false }, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true), containerColor = Color.White, dragHandle = null) {
        Column(Modifier.fillMaxWidth().heightIn(max = 640.dp).verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Agreement and payment", Modifier.weight(1f), fontSize = 22.sp, fontWeight = FontWeight.SemiBold, color = ConversationStyle.Ink)
                IconButton(onClick = { documents = false }) { Icon(Icons.Outlined.Close, "Close documents") }
            }
            Text(workflow.request.serviceName, fontSize = 14.sp, color = ConversationStyle.Muted)
            WorkflowDocumentCards(workflow) { file -> platformFiles?.let { viewModel.file(it, file, false) } }
            state.uploadProgress?.let { LinearProgressIndicator(progress = { it }, modifier = Modifier.fillMaxWidth()) }
            if (platformFiles != null && workflow.state !in setOf("PENDING_REVIEW", "CANCELLED", "DECLINED", "ON_HOLD")) OutlinedButton(onClick = { viewModel.upload(platformFiles) }, enabled = !state.busy, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(8.dp)) { Text("Attach signed agreement or payment evidence", fontSize = 12.sp) }
            workflow.files.forEach { file ->
                Row(Modifier.fillMaxWidth().clickable { viewModel.selectFile(file.id) }, verticalAlignment = Alignment.CenterVertically) {
                    RadioButton(state.selectedFileId == file.id, { viewModel.selectFile(file.id) })
                    Text(file.name, Modifier.weight(1f), fontSize = 12.sp)
                    if (platformFiles != null) IconButton(onClick = { viewModel.file(platformFiles, file, true) }, enabled = !state.busy) { Icon(Icons.Outlined.OpenInNew, "Preview ${file.name}", Modifier.size(18.dp)) }
                }
            }
            workflow.agreement?.let { agreement -> if (agreement.documentFileId != null && agreement.status == "PENDING" && workflow.state in setOf("AGREEMENT_PAYMENT_PENDING", "READY_FOR_ACTIVATION"))
                Button(onClick = { state.selectedFileId?.let { viewModel.action("SIGN_AGREEMENT", mapOf("fileId" to it)) } }, enabled = !state.busy && state.selectedFileId != null, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(8.dp)) { Text("Submit signed agreement") }
            }
            workflow.payment?.let { payment -> if (payment.status !in setOf("VERIFIED", "SUBMITTED") && workflow.state in setOf("AGREEMENT_PAYMENT_PENDING", "READY_FOR_ACTIVATION")) {
                OutlinedTextField(paymentReference, { paymentReference = it.take(200) }, label = { Text("Payment reference") }, modifier = Modifier.fillMaxWidth())
                Button(onClick = { state.selectedFileId?.let { viewModel.action("SUBMIT_PAYMENT", mapOf("fileId" to it, "reference" to paymentReference)) } }, enabled = !state.busy && state.selectedFileId != null && paymentReference.isNotBlank(), modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(8.dp)) { Text("Submit payment evidence") }
            } }
        }
    }
}

@Composable
private fun DetailSection(title: String? = null, content: @Composable ColumnScope.() -> Unit) {
    var expanded by remember(title) { mutableStateOf(true) }
    Surface(color = Color.White, border = BorderStroke(1.dp, ConversationStyle.Divider), shape = RoundedCornerShape(8.dp)) {
        Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            if (title != null) Row(Modifier.fillMaxWidth().clickable { expanded = !expanded }, verticalAlignment = Alignment.CenterVertically) {
                Text(title, Modifier.weight(1f), fontSize = 16.sp, lineHeight = 24.sp, fontWeight = FontWeight.SemiBold, color = ConversationStyle.Ink)
                Icon(if (expanded) Icons.Outlined.KeyboardArrowUp else Icons.Outlined.KeyboardArrowDown, if (expanded) "Collapse $title" else "Expand $title", Modifier.size(16.dp), tint = ConversationStyle.Muted)
            }
            if (expanded) content()
        }
    }
}

@Composable
private fun MetadataRow(label: String, value: String) {
    Row(verticalAlignment = Alignment.Top) {
        Text(label, Modifier.width(100.dp), fontSize = 12.sp, lineHeight = 21.sp, color = ConversationStyle.Muted)
        Text(value, fontSize = 14.sp, lineHeight = 21.sp, color = ConversationStyle.Ink)
    }
}

@Composable
private fun DetailValue(label: String, value: String) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(label, fontSize = 12.sp, lineHeight = 18.sp, color = ConversationStyle.Muted)
        Text(value.ifBlank { "Not specified" }, fontSize = 14.sp, lineHeight = 21.sp, color = ConversationStyle.Ink)
    }
}

@Composable
private fun ChecklistRow(label: String, status: String, complete: Boolean, onClick: (() -> Unit)? = null) {
    Row(Modifier.fillMaxWidth().then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier).padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        Icon(if (complete) Icons.Outlined.CheckCircle else Icons.Outlined.Schedule, null, Modifier.size(18.dp), tint = if (complete) Color(0xFF27815B) else Color(0xFFB48432))
        Text(label, Modifier.weight(1f), fontSize = 14.sp, color = ConversationStyle.Ink)
        WorkflowPill(status, complete)
    }
}

@Composable
private fun ConsultationCard(consultation: Consultation, onDetails: () -> Unit) {
    Column(Modifier.fillMaxWidth().background(ConversationStyle.Navy, RoundedCornerShape(8.dp)).padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Icon(Icons.Outlined.Event, null, Modifier.size(20.dp), tint = Color.White)
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("Consultation appointment", fontSize = 16.sp, lineHeight = 24.sp, fontWeight = FontWeight.SemiBold, color = Color.White)
                Text("Confirmed schedule", fontSize = 12.sp, color = Color.White.copy(alpha = .8f))
            }
        }
        Surface(color = Color.White.copy(alpha = .12f), border = BorderStroke(1.dp, Color.White.copy(alpha = .35f)), shape = RoundedCornerShape(12.dp)) {
            Text(consultation.status, Modifier.padding(horizontal = 10.dp, vertical = 4.dp), fontSize = 11.sp, color = Color.White)
        }
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Icon(Icons.Outlined.CalendarToday, null, Modifier.size(18.dp), tint = Color.White)
            Text(appointmentDate(consultation.startsAt) + "\n" + appointmentTime(consultation.startsAt) + " - " + appointmentTime(consultation.endsAt), fontSize = 14.sp, lineHeight = 21.sp, color = Color.White)
        }
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Icon(Icons.Outlined.LocationOn, null, Modifier.size(18.dp), tint = Color.White)
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("Location", fontSize = 12.sp, color = Color.White.copy(alpha = .8f))
                Text(consultation.location, fontSize = 14.sp, color = Color.White)
            }
        }
        Button(onClick = onDetails, modifier = Modifier.fillMaxWidth().height(44.dp), colors = ButtonDefaults.buttonColors(containerColor = Color.White, contentColor = ConversationStyle.Navy), shape = RoundedCornerShape(6.dp)) {
            Icon(Icons.Outlined.Videocam, null, Modifier.size(16.dp)); Spacer(Modifier.width(8.dp)); Text("View details and reschedule", fontSize = 14.sp)
        }
    }
}
private fun appointmentDate(value: String): String = try { Instant.parse(value).toLocalDateTime(TimeZone.currentSystemDefault()).date.toString() } catch (_: IllegalArgumentException) { value.take(10) }
private fun appointmentTime(value: String): String = try { Instant.parse(value).toLocalDateTime(TimeZone.currentSystemDefault()).let { "${it.hour.toString().padStart(2, '0')}:${it.minute.toString().padStart(2, '0')}" } } catch (_: IllegalArgumentException) { value }
