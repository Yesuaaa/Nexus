package com.nexus.app.features.conversations.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import com.nexus.app.features.conversations.model.ConversationBooking
import com.nexus.app.features.workflow.model.*

object ConversationStyle {
    val Navy = Color(0xFF203F8C)
    val Background = Color(0xFFF7F8FA)
    val Ink = Color(0xFF1A2233)
    val Muted = Color(0xFF52627A)
    val Border = Color(0xFFE1E4EA)
    val Divider = Color(0xFFEFEFEE)
    val Notice = Color(0xFFEDF1F9)
}

@Composable
fun ChatAvatar(name: String, image: String? = null, modifier: Modifier = Modifier) {
    Box(modifier.size(44.dp).clip(CircleShape).background(ConversationStyle.Notice), contentAlignment = Alignment.Center) {
        if (image != null) AsyncImage(model = image, contentDescription = name, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
        else Text(name.split(' ').filter { it.isNotBlank() }.take(2).map { it.first() }.joinToString(""), color = ConversationStyle.Navy, fontSize = 14.sp)
    }
}

@Composable
fun WorkflowPill(label: String, complete: Boolean = false) {
    Surface(color = if (complete) Color(0xFFEAF7EF) else Color(0xFFFFF6E7), shape = RoundedCornerShape(4.dp)) {
        Text(label, Modifier.padding(horizontal = 6.dp, vertical = 3.dp), fontSize = 11.sp, lineHeight = 13.sp,
            color = if (complete) Color(0xFF27815B) else Color(0xFF99651C), maxLines = 1)
    }
}

@Composable
fun SquareChatAction(icon: ImageVector, description: String, onClick: () -> Unit, enabled: Boolean = true) {
    Box(Modifier.size(44.dp).clip(RoundedCornerShape(8.dp)).background(if (enabled) ConversationStyle.Navy else ConversationStyle.Navy.copy(alpha = .5f))
        .clickable(enabled = enabled, onClick = onClick), contentAlignment = Alignment.Center) {
        Icon(icon, description, Modifier.size(20.dp), tint = Color.White)
    }
}

@Composable
fun DocumentFrame(title: String, icon: ImageVector, badge: String? = null, complete: Boolean = false, content: @Composable ColumnScope.() -> Unit) {
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(8.dp)).background(ConversationStyle.Navy).padding(4.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Row(Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Icon(icon, null, Modifier.size(20.dp), tint = Color.White)
            Text(title, Modifier.weight(1f), color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
            badge?.let { WorkflowPill(it, complete) }
        }
        Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(4.dp)).background(Color.White).padding(12.dp), verticalArrangement = Arrangement.spacedBy(16.dp), content = content)
    }
}

@Composable
fun WorkflowDocumentCards(workflow: ClientWorkflow, onFile: (WorkflowFile) -> Unit) {
    workflow.agreement?.let { agreement ->
        DocumentFrame("Agreement", Icons.Outlined.AssignmentTurnedIn) {
            workflow.files.filter { it.id == agreement.documentFileId || it.id == agreement.signedFileId }
                .forEach { file -> FileAttachmentCard(file) { onFile(file) } }
            Text(if (agreement.status == "APPROVED") "The agreement has been approved for project activation." else "An approved agreement is required before project activation.",
                color = ConversationStyle.Ink, fontSize = 14.sp, lineHeight = 21.sp)
        }
    }
    workflow.payment?.let { payment ->
        val verified = payment.status == "VERIFIED"
        DocumentFrame("Payment requirement", Icons.Outlined.CreditCard, if (verified) "Verified" else humanStatus(payment.status), verified) {
            Text((if (payment.currency == "PHP") "\u20B1" else payment.currency + " ") + displayAmount(payment.amount),
                color = ConversationStyle.Navy, fontSize = 22.sp, lineHeight = 28.sp, fontWeight = FontWeight.SemiBold)
            Text("Uploaded payment proof is reviewed by the department head or assigned verifier before project activation.", fontSize = 14.sp, lineHeight = 21.sp, color = ConversationStyle.Ink)
            Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(4.dp)).background(ConversationStyle.Notice).padding(12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Icon(Icons.Outlined.Info, null, Modifier.size(16.dp), tint = ConversationStyle.Navy)
                Text(if (verified) "Payment has been verified. Project activation will wait until the required agreement is approved too." else "Payment can be completed now. Project activation will wait until the required agreement is approved too.",
                    color = ConversationStyle.Muted, fontSize = 12.sp, lineHeight = 18.sp)
            }
            workflow.files.find { it.id == payment.proofFileId }?.let { file -> FileAttachmentCard(file) { onFile(file) } }
            payment.reference?.takeIf { it.isNotBlank() }?.let {
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("Reference", fontSize = 12.sp, color = ConversationStyle.Muted)
                    Text(it, fontSize = 12.sp, lineHeight = 18.sp, color = ConversationStyle.Ink)
                }
            }
            workflow.files.firstOrNull { it.id == payment.proofFileId }?.let { file -> FileAttachmentCard(file, { onFile(file) }) }
        }
    }
}

@Composable
fun FileAttachmentCard(file: WorkflowFile, onDownload: () -> Unit) {
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(8.dp)).background(ConversationStyle.Background).border(1.dp, ConversationStyle.Divider, RoundedCornerShape(8.dp)).padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Icon(Icons.Outlined.Description, null, Modifier.size(20.dp), tint = ConversationStyle.Navy)
            Text(file.name, color = ConversationStyle.Navy, fontSize = 12.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
        }
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text("File \u00B7 ${maxOf(1, file.size / 1024)} KB", Modifier.weight(1f), fontSize = 12.sp, color = ConversationStyle.Muted)
            Box(Modifier.size(36.dp).clip(RoundedCornerShape(6.dp)).background(Color.White).border(1.dp, ConversationStyle.Border, RoundedCornerShape(6.dp)).clickable(onClick = onDownload), contentAlignment = Alignment.Center) {
                Icon(Icons.Outlined.FileDownload, "Download ${file.name}", Modifier.size(20.dp), tint = ConversationStyle.Navy)
            }
        }
    }
}

@Composable
fun SystemEventRow(summary: String, complete: Boolean = false) {
    Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(6.dp)).background(ConversationStyle.Notice).padding(12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Icon(if (complete) Icons.Outlined.DoneAll else Icons.Outlined.Info, null, Modifier.size(16.dp), tint = ConversationStyle.Navy)
        Text(summary, color = ConversationStyle.Muted, fontSize = 12.sp, lineHeight = 18.sp)
    }
}

@Composable
fun BookingOption(booking: ConversationBooking, selected: Boolean, onClick: () -> Unit, showProgress: Boolean = false) {
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(8.dp))
        .background(if (selected) ConversationStyle.Notice else Color.White)
        .border(1.dp, if (selected) ConversationStyle.Navy else ConversationStyle.Border, RoundedCornerShape(8.dp))
        .clickable(onClick = onClick).padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            if (!showProgress) RadioMark(selected)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                Row {
                    Text(booking.serviceName.ifBlank { booking.title }, Modifier.weight(1f), fontSize = 14.sp, lineHeight = 20.sp, color = ConversationStyle.Navy)
                    if (showProgress) RadioMark(selected)
                }
                Text(booking.referenceNumber ?: booking.id, fontSize = 12.sp, lineHeight = 18.sp, color = ConversationStyle.Muted)
                if (showProgress) {
                    Text(humanStatus(booking.workflowState), fontSize = 12.sp, color = ConversationStyle.Ink)
                    WorkflowPill(humanStatus(booking.status), booking.status == "CLOSED")
                }
            }
        }
        if (showProgress) LinearProgressIndicator(progress = { workflowProgress(booking.workflowState) }, modifier = Modifier.fillMaxWidth().height(4.dp), color = ConversationStyle.Navy, trackColor = ConversationStyle.Divider)
    }
}

@Composable
private fun RadioMark(selected: Boolean) {
    Box(Modifier.size(20.dp).border(1.5.dp, if (selected) ConversationStyle.Navy else Color(0xFFA5AEBD), CircleShape), contentAlignment = Alignment.Center) {
        if (selected) Box(Modifier.size(12.dp).background(ConversationStyle.Navy, CircleShape))
    }
}

fun humanStatus(value: String): String = value.lowercase().replace('_', ' ').replaceFirstChar { it.uppercase() }
fun workflowProgress(value: String): Float = when (value) {
    "CONSULTATION" -> .2f
    "QUOTATION_PENDING", "REVISION_REQUESTED" -> .35f
    "CLIENT_APPROVAL" -> .5f
    "AGREEMENT_PAYMENT_PENDING" -> .65f
    "READY_FOR_ACTIVATION" -> .85f
    "ACTIVE_PROJECT" -> 1f
    else -> 0f
}

private fun displayAmount(value: String): String {
    val parts = value.split('.', limit = 2)
    return parts[0].reversed().chunked(3).joinToString(",").reversed() + "." + (parts.getOrNull(1) ?: "00").padEnd(2, '0')
}
