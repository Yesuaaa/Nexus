package com.nexus.app.features.conversations.components

import com.nexus.app.core.components.NexusDialogButton
import com.nexus.app.core.components.NexusAlertDialog
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.ui.Alignment
import androidx.compose.ui.platform.LocalUriHandler
import com.nexus.app.features.conversations.model.ConversationMeeting
import kotlinx.coroutines.launch
import kotlinx.datetime.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Assignment
import androidx.compose.material.icons.outlined.Event
import androidx.compose.material.icons.outlined.ReceiptLong
import androidx.compose.material.icons.outlined.RocketLaunch
import androidx.compose.material.icons.outlined.VerifiedUser
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nexus.app.core.theme.NexusButtonShape
import com.nexus.app.features.workflow.model.ClientWorkflow
import com.nexus.app.features.workflow.model.WorkflowFile

private fun formatWorkflowTimestamp(value: String): String = runCatching {
    Instant.parse(value).toLocalDateTime(TimeZone.currentSystemDefault()).let {
        "${it.date} ${it.hour.toString().padStart(2, '0')}:${it.minute.toString().padStart(2, '0')}"
    }
}.getOrDefault(value)

/** Forms are keyed by booking and record so drafts never bleed into another thread. */
@Composable
fun ChatWorkflowForms(
    workflow: ClientWorkflow,
    busy: Boolean,
    selectedFileId: String?,
    action: (String, Map<String, String>) -> Unit,
    onDetails: () -> Unit,
    onDocuments: () -> Unit,
    onFile: (WorkflowFile) -> Unit,
    onOpenProject: ((String) -> Unit)? = null,
) {
    val writable = workflow.permissions.isClient && workflow.state !in setOf(
        "PENDING_REVIEW", "CANCELLED", "DECLINED", "ACTIVE_PROJECT", "ON_HOLD"
    )
    val primaryColors = ButtonDefaults.buttonColors(
        containerColor = ConversationStyle.Navy, contentColor = Color.White,
        disabledContainerColor = ConversationStyle.Navy.copy(alpha = .5f),
        disabledContentColor = Color.White.copy(alpha = .7f)
    )
    workflow.requirements.forEach { requirement ->
        key(workflow.request.id, requirement.id) {
            var response by rememberSaveable(requirement.submission) { mutableStateOf(requirement.submission.orEmpty()) }
            DocumentFrame(requirement.title, Icons.Outlined.Assignment, humanStatus(requirement.status), requirement.status == "COMPLETED") {
                requirement.details?.takeIf { it.isNotBlank() }?.let { Text(it, fontSize = 13.sp, color = ConversationStyle.Ink) }
                if (writable && requirement.status !in setOf("SUBMITTED", "COMPLETED")) {
                    OutlinedTextField(response, { response = it.take(4000) }, modifier = Modifier.fillMaxWidth(),
                        enabled = !busy, label = { Text("Your response") }, shape = NexusButtonShape)
                    Button(shape = NexusButtonShape, colors = primaryColors,
                        enabled = !busy && (response.isNotBlank() || selectedFileId != null),
                        onClick = { action("SUBMIT_REQUIREMENT", buildMap {
                            put("requirementId", requirement.id)
                            put("submission", response)
                            selectedFileId?.let { put("fileId", it) }
                        }) }) { Text("Submit requirement") }
                } else requirement.submission?.let { Text(it, fontSize = 13.sp, color = ConversationStyle.Ink) }
            }
        }
    }
    workflow.consultations.filter { it.status == "SCHEDULED" }.forEach { consultation ->
        DocumentFrame("Scheduled consultation", Icons.Outlined.Event) {
            Text(consultation.startsAt, fontSize = 13.sp, color = ConversationStyle.Ink)
            Text(consultation.location, fontSize = 13.sp, color = ConversationStyle.Muted)
            OutlinedButton(shape = NexusButtonShape, enabled = !busy, onClick = onDetails) { Text("View details and reschedule") }
        }
    }
    workflow.quotations.maxByOrNull { it.version }?.let { quote ->
        key(workflow.request.id, quote.id) {
            var note by rememberSaveable { mutableStateOf("") }
            var confirmed by rememberSaveable(quote.id) { mutableStateOf(true) }
            var confirmDecision by remember { mutableStateOf<String?>(null) }
            val expired = runCatching { Instant.parse(quote.validUntil) <= Clock.System.now() }.getOrDefault(false)
            DocumentFrame("Quotation v${quote.version}", Icons.Outlined.ReceiptLong, humanStatus(quote.status), quote.status == "ACCEPTED") {
                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text("Reference number", fontSize = 11.sp, color = ConversationStyle.Muted)
                    Text(workflow.request.referenceNumber ?: workflow.request.id, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = ConversationStyle.Navy)
                }
                Text("${quote.currency} ${quote.total}", fontSize = 20.sp, fontWeight = FontWeight.SemiBold, color = ConversationStyle.Navy)
                Text(quote.scope, fontSize = 13.sp, color = ConversationStyle.Ink)
                quote.deliverables.forEach { Text("- $it", fontSize = 13.sp, color = ConversationStyle.Ink) }
                if (quote.lineItems.isNotEmpty()) {
                    HorizontalDivider(color = ConversationStyle.Divider)
                    Row(Modifier.fillMaxWidth()) {
                        Text("Item", Modifier.weight(1f), fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = ConversationStyle.Muted)
                        Text("Qty", Modifier.width(40.dp), fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = ConversationStyle.Muted, textAlign = TextAlign.End)
                        Text("Unit price", Modifier.width(96.dp), fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = ConversationStyle.Muted, textAlign = TextAlign.End)
                    }
                    quote.lineItems.forEach { item ->
                        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
                            Text(item.description, Modifier.weight(1f), fontSize = 12.sp, color = ConversationStyle.Ink)
                            Text(item.quantity.toString(), Modifier.width(40.dp), fontSize = 12.sp, color = ConversationStyle.Ink, textAlign = TextAlign.End)
                            Text("${quote.currency} ${displayAmount(item.unitPrice)}", Modifier.width(96.dp), fontSize = 12.sp, color = ConversationStyle.Ink, textAlign = TextAlign.End)
                        }
                    }
                    HorizontalDivider(color = ConversationStyle.Divider)
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("Total", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = ConversationStyle.Ink)
                        Text("${quote.currency} ${displayAmount(quote.total)}", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = ConversationStyle.Ink)
                    }
                }
                Text(quote.timeline, fontSize = 12.sp, color = ConversationStyle.Muted)
                Text(quote.paymentTerms, fontSize = 12.sp, color = ConversationStyle.Muted)
                if (quote.paymentDue.isNotBlank()) {
                    Text("Due before commencement: ${quote.currency} ${displayAmount(quote.paymentDue)}", fontSize = 12.sp, color = ConversationStyle.Ink)
                }
                if (quote.validUntil.isNotBlank()) {
                    Text(
                        "Valid until: ${formatWorkflowTimestamp(quote.validUntil)}" + if (expired && quote.status == "SENT") " · Expired" else "",
                        fontSize = 12.sp,
                        color = if (expired && quote.status == "SENT") MaterialTheme.colorScheme.error else ConversationStyle.Muted,
                    )
                }
                quote.decisionNote?.takeIf { it.isNotBlank() }?.let { decisionNote ->
                    Surface(color = ConversationStyle.Background, shape = RoundedCornerShape(6.dp)) {
                        Text(decisionNote, Modifier.fillMaxWidth().padding(10.dp), fontSize = 12.sp, color = ConversationStyle.Ink)
                    }
                }
                if (writable && workflow.state == "CLIENT_APPROVAL" && quote.status == "SENT" && !expired) {
                    OutlinedTextField(note, { note = it.take(2000) }, modifier = Modifier.fillMaxWidth(),
                        enabled = !busy, label = { Text("Decision note") }, shape = NexusButtonShape)
                    Row(verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Checkbox(
                            checked = confirmed,
                            onCheckedChange = { confirmed = it },
                            enabled = !busy,
                            colors = CheckboxDefaults.colors(checkedColor = ConversationStyle.Navy),
                        )
                        Text(
                            "I have reviewed this quotation and confirm my selected decision. Only these buttons record formal approval.",
                            fontSize = 11.sp,
                            lineHeight = 16.sp,
                            color = ConversationStyle.Muted,
                            modifier = Modifier.padding(top = 6.dp),
                        )
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        listOf("ACCEPT", "REVISE", "DECLINE").forEach { decision ->
                            TextButton(shape = NexusButtonShape,
                                enabled = !busy && confirmed && (decision == "ACCEPT" || note.isNotBlank()),
                                onClick = { confirmDecision = decision }) { Text(humanStatus(decision), fontSize = 12.sp) }
                        }
                    }
                }
            }
            confirmDecision?.let { decision ->
                NexusAlertDialog(onDismissRequest = { confirmDecision = null },
                    title = { Text("${humanStatus(decision)} quotation?") },
                    text = { Text("Apply this decision to quotation v${quote.version} for ${workflow.request.title}.") },
                    confirmButton = { NexusDialogButton(enabled = !busy, onClick = {
                        confirmDecision = null
                        action("RESPOND_QUOTATION", mapOf("quotationId" to quote.id, "decision" to decision, "note" to note))
                    }) { Text("Confirm") } },
                    dismissButton = { NexusDialogButton(onClick = { confirmDecision = null }, destructive = true) { Text("Cancel") } })
            }
        }
    }
    workflow.approval?.let { approval ->
        val acceptedQuote = workflow.quotations.find { it.id == approval.quotationId }
        DocumentFrame("Quotation formally accepted", Icons.Outlined.VerifiedUser, "Approved", complete = true) {
            Text(
                "You accepted quotation version ${acceptedQuote?.version ?: "—"} for ${approval.currency} ${displayAmount(approval.amount)}.",
                fontSize = 13.sp,
                lineHeight = 20.sp,
                color = ConversationStyle.Ink,
            )
            if (approval.approvedAt.isNotBlank()) {
                Text(
                    "${formatWorkflowTimestamp(approval.approvedAt)} · Formal approval recorded",
                    fontSize = 11.sp,
                    color = ConversationStyle.Muted,
                )
            }
        }
    }
    WorkflowDocumentCards(workflow, onFile)
    if (workflow.agreement != null || workflow.payment != null) {
        OutlinedButton(shape = NexusButtonShape, enabled = !busy, onClick = onDocuments) { Text("Review agreement and payment forms") }
    }
    if (workflow.state == "ACTIVE_PROJECT" && workflow.project != null) {
        val activeProject = workflow.project
        DocumentFrame("Your project is active", Icons.Outlined.RocketLaunch, "Active project", complete = true) {
            Text(activeProject.name, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = ConversationStyle.Ink)
            Text(
                "Your consultation history and approved documents remain available in this conversation.",
                fontSize = 13.sp,
                lineHeight = 20.sp,
                color = ConversationStyle.Muted,
            )
            if (onOpenProject != null) {
                Button(
                    onClick = { onOpenProject(activeProject.id) },
                    shape = NexusButtonShape,
                    colors = primaryColors,
                ) {
                    Text("View Project")
                }
            }
        }
    }
    Surface(shape = RoundedCornerShape(12.dp), color = Color.White, border = BorderStroke(1.dp, Color(0xFFD8E1EF))) {
        Text(workflow.nextAction, Modifier.padding(12.dp), fontSize = 12.sp, color = ConversationStyle.Muted)
    }
}


@Composable
fun ConversationMeetingCard(
    meeting: ConversationMeeting,
    canAct: Boolean,
    busy: Boolean,
    error: String?,
    clearError: () -> Unit,
    requestReschedule: suspend (ConversationMeeting, String, String) -> Boolean,
) {
    var dialog by rememberSaveable(meeting.id) { mutableStateOf(false) }
    var proposed by rememberSaveable(meeting.id) { mutableStateOf("") }
    var reason by rememberSaveable(meeting.id) { mutableStateOf("") }
    var validation by remember(meeting.id) { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    val uriHandler = LocalUriHandler.current
    var linkError by remember(meeting.id) { mutableStateOf<String?>(null) }
    fun formatted(value: String): String = runCatching {
        Instant.parse(value).toLocalDateTime(TimeZone.currentSystemDefault()).let {
            "${it.date} ${it.hour.toString().padStart(2, '0')}:${it.minute.toString().padStart(2, '0')}"
        }
    }.getOrDefault(value)
    DocumentFrame("Consultation/meeting", Icons.Outlined.Event, humanStatus(meeting.status)) {
        Text(meeting.notes.ifBlank { "General meeting" }, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = ConversationStyle.Ink)
        Text("${formatted(meeting.startsAt)} ? ${formatted(meeting.endsAt)}", fontSize = 13.sp, color = ConversationStyle.Muted)
        val isLink = meeting.location.startsWith("https://", true) || meeting.location.startsWith("http://", true)
        if (isLink) TextButton(onClick = {
            linkError = runCatching { uriHandler.openUri(meeting.location) }.exceptionOrNull()?.let { "Unable to open this meeting link." }
        }) { Text("Join meeting: ${meeting.location}") }
        else Text(meeting.location, fontSize = 13.sp, color = ConversationStyle.Muted)
        linkError?.let { Text(it, color = MaterialTheme.colorScheme.error, fontSize = 12.sp) }
        if (meeting.bookings.isEmpty()) Text("General meeting ? No specific service", fontSize = 11.sp, color = ConversationStyle.Muted)
        else Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text("Related services", fontSize = 12.sp, color = ConversationStyle.Muted)
            meeting.bookings.forEach { related ->
                Surface(shape = RoundedCornerShape(6.dp), color = ConversationStyle.Notice) {
                    Text("${related.booking.service.name} ? ${related.booking.referenceNumber ?: related.booking.id}",
                        Modifier.padding(8.dp), fontSize = 11.sp, color = ConversationStyle.Navy)
                }
            }
        }
        meeting.proposedStartsAt?.let {
            Text("Reschedule requested: ${formatted(it)}", fontSize = 13.sp, color = ConversationStyle.Navy)
            meeting.rescheduleNote?.let { note -> Text(note, fontSize = 13.sp) }
            Text("The existing schedule remains until the department head confirms a change.", fontSize = 12.sp, color = ConversationStyle.Muted)
        }
        if (canAct && meeting.status == "SCHEDULED") OutlinedButton(shape = NexusButtonShape,
            enabled = !busy && meeting.proposedStartsAt == null,
            onClick = { clearError(); validation = null; dialog = true }) { Text("Request reschedule") }
    }
    if (dialog && canAct && meeting.status == "SCHEDULED") NexusAlertDialog(
        onDismissRequest = { if (!busy) dialog = false },
        title = { Text("Request reschedule") },
        text = {
            Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Propose a new time in your local time zone. The current schedule remains until confirmed.", fontSize = 13.sp)
                OutlinedTextField(proposed, { proposed = it; validation = null }, Modifier.fillMaxWidth(),
                    enabled = !busy, label = { Text("Proposed date and time") }, placeholder = { Text("YYYY-MM-DD HH:mm") }, singleLine = true)
                OutlinedTextField(reason, { reason = it.take(2000) }, Modifier.fillMaxWidth(),
                    enabled = !busy, label = { Text("Reason for rescheduling") }, minLines = 2, maxLines = 4)
                (validation ?: error)?.let { Text(it, color = MaterialTheme.colorScheme.error, fontSize = 12.sp) }
            }
        },
        confirmButton = {
            NexusDialogButton(enabled = !busy && proposed.isNotBlank() && reason.isNotBlank(), onClick = {
                val instant = runCatching {
                    LocalDateTime.parse(proposed.trim().replace(' ', 'T')).toInstant(TimeZone.currentSystemDefault())
                }.getOrNull()
                if (instant == null) validation = "Enter a valid date and time (YYYY-MM-DD HH:mm)."
                else if (instant <= Clock.System.now()) validation = "Choose a future date and time."
                else scope.launch {
                    if (requestReschedule(meeting, instant.toString(), reason)) {
                        dialog = false; proposed = ""; reason = ""
                    }
                }
            }) { Text(if (busy) "Sending?" else "Send request") }
        },
        dismissButton = { NexusDialogButton(enabled = !busy, onClick = { dialog = false }) { Text("Cancel") } },
    )
}
