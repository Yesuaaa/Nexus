package com.nexus.app.features.projects.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Info
import com.nexus.app.features.conversations.components.ProjectConversationContext
import com.nexus.app.features.conversations.components.ChatMessageBubble
import com.nexus.app.features.conversations.components.ConversationStyle
import kotlinx.coroutines.flow.first
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import com.nexus.app.core.components.NexusButton
import com.nexus.app.core.components.NexusButtonVariant
import com.nexus.app.core.theme.NexusColors
import com.nexus.app.features.projects.model.*
import com.nexus.app.features.projects.viewmodel.ProjectChatViewModel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import org.koin.compose.viewmodel.koinViewModel

@Composable
fun ProjectChatScreen(id: String, userId: String, onBack: () -> Unit, onDeliverables: () -> Unit, viewModel: ProjectChatViewModel = koinViewModel(), onOpenProject: (String) -> Unit = { onBack() }) {
    val state by viewModel.state.collectAsState()
    var text by rememberSaveable(id) { mutableStateOf("") }
    var showDetails by rememberSaveable(id) { mutableStateOf(false) }
    val list = rememberLazyListState()
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    LaunchedEffect(id, lifecycle) {
        lifecycle.repeatOnLifecycle(Lifecycle.State.RESUMED) {
            while (isActive) { viewModel.refresh(id); delay(15_000) }
        }
    }
    LaunchedEffect(state.sentCount) { if (state.sentCount > 0) text = "" }
    LaunchedEffect(id, state.history?.messages?.lastOrNull()?.id, state.sentCount) {
        val count = state.history?.messages?.size ?: 0
        if (count > 0) {
            // The list includes its history/empty-state row before the messages.
            snapshotFlow { list.layoutInfo.totalItemsCount }.first { it >= count + 1 }
            list.scrollToItem(count)
        }
    }
    Column(Modifier.fillMaxSize().background(NexusColors.SurfaceLight).imePadding().padding(horizontal = 20.dp)) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.weight(1f)) { ProjectBack("Back to project", onBack) }
            IconButton(onClick = { showDetails = true }, enabled = state.history?.project != null) {
                Icon(Icons.Outlined.Info, "Show project details", tint = NexusColors.PrimaryBlue)
            }
        }
        val projectTitle = state.history?.project?.name?.takeIf { it.isNotBlank() }
            ?: state.history?.conversation?.fullName?.takeIf { it.isNotBlank() }
        val participantsSubtitle = state.history?.participants
            ?.mapNotNull { it.fullName?.takeIf(String::isNotBlank) }
            ?.takeIf { it.isNotEmpty() }
            ?.joinToString(", ")
        if (projectTitle != null) {
            ProjectTitle(projectTitle)
        }
        if (participantsSubtitle != null) {
            ProjectCopy(participantsSubtitle)
        }
        if (state.loading) LinearProgressIndicator(Modifier.fillMaxWidth(), color = NexusColors.PrimaryBlue)
        state.error?.let {
            Text(it, fontSize = 13.sp, color = NexusColors.ErrorRed)
            TextButton({ viewModel.refresh(id) }, enabled = !state.loading && !state.sending) { Text("Refresh messages") }
        }
        LazyColumn(Modifier.weight(1f).fillMaxWidth(), state = list, verticalArrangement = Arrangement.spacedBy(16.dp, Alignment.Bottom), contentPadding = PaddingValues(vertical = 16.dp)) {
            item {
                if (state.history?.nextCursor != null) TextButton({ viewModel.refresh(id, true) }, enabled = !state.loading && !state.sending) { Text("Load older messages") }
                if (state.history?.messages?.isEmpty() == true) ProjectCopy("No messages yet. Start a conversation with your project team.")
            }
            items(state.history?.messages.orEmpty(), key = { it.id }) { message ->
                val mine = message.sender.id == userId
                Column(Modifier.fillMaxWidth(), horizontalAlignment = if (mine) Alignment.End else Alignment.Start) {
                    Text(message.sender.fullName ?: "Project team", Modifier.padding(bottom = 4.dp),
                        fontSize = 11.sp, color = ConversationStyle.Muted)
                    ChatMessageBubble(own = mine) {
                        message.body?.let { Text(it) }
                        message.deliverable?.let { attachment ->
                            Surface(color = ConversationStyle.Notice, contentColor = ConversationStyle.Ink,
                                shape = androidx.compose.foundation.shape.RoundedCornerShape(8.dp)) {
                                Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                    ProjectTitle(attachment.title)
                                    ProjectCopy(attachment.fileName)
                                    NexusButton("View deliverables", onDeliverables, variant = NexusButtonVariant.OUTLINE)
                                }
                            }
                        }
                    }
                    Text("${displayDate(message.createdAt)} · ${calendarTime(message.createdAt)}",
                        Modifier.padding(top = 4.dp), fontSize = 10.sp, color = ConversationStyle.Muted)
                }
            }
        }
        if (state.history?.canSend == true) {
            OutlinedTextField(text, { if (it.length <= 4000) text = it }, Modifier.fillMaxWidth(), placeholder = { Text("Message your project team") }, maxLines = 5, enabled = !state.sending && state.pendingBody == null)
            NexusButton(if (state.pendingBody != null && !state.sending) "Retry sending message" else "Send", { viewModel.send(id, text) }, Modifier.padding(vertical = 10.dp), enabled = !state.loading && (text.isNotBlank() || state.pendingBody != null), loading = state.sending)
        } else if (state.history != null) {
            ProjectCopy(if (state.history?.archived == true) "This project chat is archived and read-only." else "Messaging is available once staff are assigned to your project.")
        }
    }
    if (showDetails) state.history?.let { history ->
        history.project?.let { project ->
            ProjectConversationContext(project, history.participants, userId,
                onDismiss = { showDetails = false }, onOpenProject = onOpenProject)
        }
    }
}
