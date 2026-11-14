package com.nexus.app.features.projects.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
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
fun ProjectChatScreen(id: String, userId: String, onBack: () -> Unit, onDeliverables: () -> Unit, viewModel: ProjectChatViewModel = koinViewModel()) {
    val state by viewModel.state.collectAsState()
    var text by rememberSaveable(id) { mutableStateOf("") }
    val list = rememberLazyListState()
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    LaunchedEffect(id, lifecycle) {
        lifecycle.repeatOnLifecycle(Lifecycle.State.RESUMED) {
            while (isActive) { viewModel.refresh(id); delay(15_000) }
        }
    }
    LaunchedEffect(state.sentCount) { if (state.sentCount > 0) { text = ""; list.scrollToItem((state.history?.messages?.size ?: 0).coerceAtLeast(0)) } }
    Column(Modifier.fillMaxSize().background(NexusColors.SurfaceLight).imePadding().padding(horizontal = 20.dp)) {
        ProjectBack("Back to project", onBack)
        if (state.loading) LinearProgressIndicator(Modifier.fillMaxWidth(), color = NexusColors.PrimaryBlue)
        state.error?.let {
            Text(it, fontSize = 13.sp, color = NexusColors.ErrorRed)
            TextButton({ viewModel.refresh(id) }, enabled = !state.loading && !state.sending) { Text("Refresh messages") }
        }
        LazyColumn(Modifier.weight(1f).fillMaxWidth(), state = list, verticalArrangement = Arrangement.spacedBy(12.dp), contentPadding = PaddingValues(vertical = 16.dp)) {
            item {
                if (state.history?.nextCursor != null) TextButton({ viewModel.refresh(id, true) }, enabled = !state.loading && !state.sending) { Text("Load older messages") }
                if (state.history?.messages?.isEmpty() == true) ProjectCopy("No messages yet. Start a conversation with your project team.")
            }
            items(state.history?.messages.orEmpty(), key = { it.id }) { message ->
                val mine = message.sender.id == userId
                Column(Modifier.fillMaxWidth(), horizontalAlignment = if (mine) Alignment.End else Alignment.Start) {
                    ProjectCopy(message.sender.fullName ?: "Project team")
                    Surface(Modifier.widthIn(max = 320.dp), shape = RoundedCornerShape(12.dp), color = if (mine) NexusColors.SurfaceHover else NexusColors.Background) {
                        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            message.body?.let { Text(it, fontSize = 14.sp, color = NexusColors.TextPrimary) }
                            message.deliverable?.let { attachment ->
                                ProjectTitle(attachment.title)
                                ProjectCopy(attachment.fileName)
                                NexusButton("View deliverables", onDeliverables, variant = NexusButtonVariant.OUTLINE)
                            }
                        }
                    }
                    ProjectCopy("${displayDate(message.createdAt)} · ${calendarTime(message.createdAt)}")
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
}
