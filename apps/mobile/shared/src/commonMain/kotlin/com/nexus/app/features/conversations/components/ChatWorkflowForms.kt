package com.nexus.app.features.conversations.components

import com.nexus.app.core.components.NexusDialogButton
import com.nexus.app.core.components.NexusAlertDialog
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Assignment
import androidx.compose.material.icons.outlined.Event
import androidx.compose.material.icons.outlined.ReceiptLong
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nexus.app.core.theme.NexusButtonShape
import com.nexus.app.features.workflow.model.ClientWorkflow
import com.nexus.app.features.workflow.model.WorkflowFile

/** Forms are keyed by booking and record so drafts never bleed into another thread. */
@Composable
fun ChatWorkflowForms(
    workflow: ClientWorkflow,
    busy: Boolean,
    selectedFileId: String?,
    action: (String, Map<String, String>) -> Unit,
    onDetails: () -> Unit,
    onDocuments: () -> Unit,
    onFile: (WorkflowFile) -> Unit
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
            var confirmDecision by remember { mutableStateOf<String?>(null) }
            DocumentFrame("Quotation v${quote.version}", Icons.Outlined.ReceiptLong, humanStatus(quote.status), quote.status == "ACCEPTED") {
                Text("${quote.currency} ${quote.total}", fontSize = 20.sp, fontWeight = FontWeight.SemiBold, color = ConversationStyle.Navy)
                Text(quote.scope, fontSize = 13.sp, color = ConversationStyle.Ink)
                quote.deliverables.forEach { Text("- $it", fontSize = 13.sp, color = ConversationStyle.Ink) }
                Text(quote.timeline, fontSize = 12.sp, color = ConversationStyle.Muted)
                Text(quote.paymentTerms, fontSize = 12.sp, color = ConversationStyle.Muted)
                if (writable && workflow.state == "CLIENT_APPROVAL" && quote.status == "SENT") {
                    OutlinedTextField(note, { note = it.take(2000) }, modifier = Modifier.fillMaxWidth(),
                        enabled = !busy, label = { Text("Decision note") }, shape = NexusButtonShape)
                    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        listOf("ACCEPT", "REVISE", "DECLINE").forEach { decision ->
                            TextButton(shape = NexusButtonShape,
                                enabled = !busy && (decision == "ACCEPT" || note.isNotBlank()),
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
    WorkflowDocumentCards(workflow, onFile)
    if (workflow.agreement != null || workflow.payment != null) {
        OutlinedButton(shape = NexusButtonShape, enabled = !busy, onClick = onDocuments) { Text("Review agreement and payment forms") }
    }
    Surface(shape = RoundedCornerShape(12.dp), color = Color.White, border = BorderStroke(1.dp, Color(0xFFD8E1EF))) {
        Text(workflow.nextAction, Modifier.padding(12.dp), fontSize = 12.sp, color = ConversationStyle.Muted)
    }
}
