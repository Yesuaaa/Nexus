package com.nexus.app.features.conversations.components

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nexus.app.core.theme.NexusButtonShape
import com.nexus.app.features.conversations.model.Person
import com.nexus.app.features.projects.model.ProjectConversationDetails
import com.nexus.app.features.projects.model.displayDate
import com.nexus.app.features.projects.model.statusLabel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProjectConversationContext(
    project: ProjectConversationDetails, participants: List<Person>, userId: String,
    onDismiss: () -> Unit, onOpenProject: (String) -> Unit,
) {
    ModalBottomSheet(onDismissRequest = onDismiss, containerColor = Color.White,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
        Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp).padding(bottom = 24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Text("Conversation details", fontSize = 18.sp, fontWeight = FontWeight.SemiBold, color = ConversationStyle.Ink)
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                ChatAvatar(project.name)
                Column { Text(project.name, fontWeight = FontWeight.SemiBold); Text("Project team", fontSize = 12.sp, color = ConversationStyle.Muted) }
            }
            listOf(
                "Status" to statusLabel(project.status),
                "Service" to (project.serviceName?.takeIf { it.isNotBlank() } ?: "Not linked to a service"),
                "Reference" to (project.referenceNumber?.takeIf { it.isNotBlank() } ?: "Not provided"),
                "Started" to (project.startDate?.let { displayDate(it) } ?: "Not started"),
            ).forEach { (label, value) ->
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(label, Modifier.weight(1f), fontSize = 13.sp, color = ConversationStyle.Muted)
                    Text(value, Modifier.weight(2f), fontSize = 13.sp, color = ConversationStyle.Ink)
                }
            }
            HorizontalDivider(color = ConversationStyle.Divider)
            Text("Project brief", fontWeight = FontWeight.SemiBold)
            Text(project.description?.takeIf { it.isNotBlank() } ?: "No project brief provided.", fontSize = 13.sp, color = ConversationStyle.Muted)
            HorizontalDivider(color = ConversationStyle.Divider)
            Text("Participants", fontWeight = FontWeight.SemiBold)
            participants.distinctBy { it.id }.forEach { person ->
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    ChatAvatar(person.fullName ?: "Participant", person.imageUrl, Modifier.size(32.dp))
                    Text((person.fullName ?: "Participant") + if (person.id == userId) " (you)" else "", fontSize = 13.sp)
                }
            }
            Button(onClick = { onDismiss(); onOpenProject(project.id) }, modifier = Modifier.fillMaxWidth(), shape = NexusButtonShape,
                colors = ButtonDefaults.buttonColors(containerColor = ConversationStyle.Navy)) { Text("Open project") }
        }
    }
}
