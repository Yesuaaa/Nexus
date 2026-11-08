package com.nexus.app.features.conversations.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.Send
import androidx.compose.material.icons.outlined.*
import androidx.compose.foundation.border
import com.nexus.app.features.conversations.components.*
import com.nexus.app.features.workflow.viewmodel.WorkflowViewModel
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import com.nexus.app.core.theme.NexusColors
import com.nexus.app.features.conversations.viewmodel.ConversationsViewModel
import com.nexus.app.features.notifications.viewmodel.NotificationsViewModel
import org.koin.compose.viewmodel.koinViewModel
import com.nexus.app.features.conversations.model.ConversationBooking
import com.nexus.app.features.conversations.model.conversationTimeline
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import kotlinx.datetime.toLocalDateTime
import kotlinx.coroutines.flow.first

@Composable
fun NotificationsScreen(onRequest: (String) -> Unit, viewModel: NotificationsViewModel = koinViewModel()) {
    val state by viewModel.state.collectAsState()
    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) { viewModel.refresh() }
    LazyColumn(Modifier.fillMaxSize().background(NexusColors.SurfaceLight).padding(horizontal = 20.dp)) {
        item { Row(Modifier.fillMaxWidth().padding(vertical = 16.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("Notifications", Modifier.weight(1f), fontSize = 22.sp, fontWeight = FontWeight.SemiBold)
            TextButton(onClick = viewModel::readAll, enabled = state.feed.unreadCount > 0) { Text("Mark all as read", fontSize = 12.sp) }
        } }
        item { if (state.loading) LinearProgressIndicator(Modifier.fillMaxWidth())
            state.error?.let { Text(it, color = NexusColors.ErrorRed, modifier = Modifier.padding(12.dp)) }
            TextButton(onClick = viewModel::refresh) { Text("Refresh") }
        }
        if (!state.loading && state.feed.notifications.isEmpty()) item { Text("You're all caught up.", Modifier.padding(16.dp)) }
        items(state.feed.notifications, key = { it.id }) { notification ->
            Surface(color = Color.White, shape = RoundedCornerShape(6.dp), border = androidx.compose.foundation.BorderStroke(1.dp, NexusColors.Border)) {
                Column(Modifier.fillMaxWidth().clickable { viewModel.open(notification, onRequest) }.padding(16.dp)) {
                    Text(notification.summary, fontSize = 14.sp, fontWeight = if (notification.readAt == null) FontWeight.SemiBold else FontWeight.Normal,
                        color = NexusColors.TextPrimary)
                    Spacer(Modifier.height(10.dp))
                    Text(displayTime(notification.createdAt), fontSize = 12.sp, color = NexusColors.TextSecondary)
                }
            }
        }
        item { Spacer(Modifier.height(20.dp)) }
    }
}

@Composable
fun MessagesScreen(onConversation: (String) -> Unit, viewModel: ConversationsViewModel = koinViewModel()) {
    val state by viewModel.state.collectAsState()
    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) { viewModel.refresh(false) }
    LazyColumn(Modifier.fillMaxSize().background(NexusColors.SurfaceLight).padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item { Text("Messages", fontSize = 22.sp, fontWeight = FontWeight.SemiBold) }
        item { Text("Select a conversation", fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
            Text("Choose a department below to discuss all your bookings in one conversation.", fontSize = 12.sp, lineHeight = 18.sp, color = ConversationStyle.Muted) }
        item {
            if (state.loading) LinearProgressIndicator(Modifier.fillMaxWidth())
            state.error?.let {
                Text("Unable to load conversations. Please try again.", color = NexusColors.ErrorRed)
                TextButton(onClick = { viewModel.refresh(false) }, enabled = !state.loading) { Text("Retry") }
            }
        }
        if (!state.loading && state.error == null && state.page.conversations.isEmpty()) item {
            Text("No conversations yet.", color = NexusColors.TextSecondary)
        }
        items(state.page.conversations, key = { it.id }) { row ->
            Card(onClick = { onConversation(row.id) }, colors = CardDefaults.cardColors(containerColor = Color.White),
                border = androidx.compose.foundation.BorderStroke(1.dp, NexusColors.Border)) {
                Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                    ChatAvatar(row.acceptedDepartment?.head?.fullName ?: "EXP", row.acceptedDepartment?.head?.imageUrl)
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text(row.acceptedDepartment?.head?.fullName ?: row.acceptedDepartment?.name ?: row.title, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = ConversationStyle.Ink)
                        Text(row.service.name + if (row.bookings.size > 1) " - ${row.bookings.size} bookings" else "", fontSize = 12.sp, color = NexusColors.TextSecondary)
                        Text(row.lastMessage?.let { if (it.deletedAt != null) "Message deleted" else it.body.orEmpty() } ?: "Start a conversation", maxLines = 2, fontSize = 12.sp, lineHeight = 18.sp, color = ConversationStyle.Muted)
                    }
                    if (row.unreadCount > 0) Badge { Text(row.unreadCount.toString()) }
                    Text(" >", color = NexusColors.PrimaryBlue)
                }
            }
        }
        if (state.page.nextCursor != null) item { TextButton(onClick = { viewModel.refresh(more = true) }, enabled = !state.loading) { Text("Load more") } }
    }
}

@Composable
fun ChatScreen(
    id: String,
    userId: String,
    onBack: () -> Unit,
    onDetails: (String) -> Unit,
    onBooking: (String) -> Unit = onDetails,
    viewModel: ConversationsViewModel = koinViewModel()
) {
    val state by viewModel.state.collectAsState()
    val workflowViewModel: WorkflowViewModel = koinViewModel()
    val workflowState by workflowViewModel.state.collectAsState()
    val files = com.nexus.app.core.files.LocalPlatformFiles.current
    var draft by rememberSaveable(id) { mutableStateOf("") }
    var tools by remember(id) { mutableStateOf(false) }
    var attachmentChooser by remember(id) { mutableStateOf(false) }
    var chooser by remember(id) { mutableStateOf(false) }
    val timeline = remember(state.messages, state.attachments) { conversationTimeline(state.messages, state.attachments) }
    val list = rememberLazyListState()
    val conversation = state.history?.conversation
    fun openDetails() { state.history?.selectedBookingId?.let(onDetails) }

    LaunchedEffect(id) { viewModel.open(id); viewModel.foreground(true) }
    LaunchedEffect(state.history?.selectedBookingId) {
        state.history?.selectedBookingId?.let { workflowViewModel.open(it) }
    }
    LaunchedEffect(workflowState.selectedFileId) {
        if (workflowState.selectedFileId != null) viewModel.refreshAttachments()
    }
    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) { viewModel.foreground(true) }
    LifecycleEventEffect(Lifecycle.Event.ON_PAUSE) { viewModel.foreground(false) }
    DisposableEffect(id) { onDispose { viewModel.foreground(false) } }
    LaunchedEffect(timeline.lastOrNull()?.id, state.pending.size) {
        if (timeline.isNotEmpty() || state.pending.isNotEmpty()) {
            snapshotFlow { list.layoutInfo.totalItemsCount }.first { it > 0 }
            list.scrollToItem(list.layoutInfo.totalItemsCount - 1)
        }
    }


    Column(Modifier.fillMaxSize().background(ConversationStyle.Background).imePadding()) {
        Row(Modifier.fillMaxWidth().height(60.dp).background(Color.White).padding(horizontal = 12.dp),
            verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onBack, modifier = Modifier.size(32.dp)) {
                Icon(Icons.AutoMirrored.Outlined.ArrowBack, "Back to messages", Modifier.size(20.dp), tint = ConversationStyle.Navy)
            }
            ChatAvatar(conversation?.head?.fullName ?: "EXP", modifier = Modifier.size(36.dp))
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Text(conversation?.head?.fullName ?: "Conversation", fontSize = 18.sp, lineHeight = 22.sp,
                    fontWeight = FontWeight.SemiBold, color = ConversationStyle.Ink, maxLines = 1, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis)
                Text("${conversation?.department?.name.orEmpty()} \u00B7 ${conversation?.bookings?.size ?: 0} bookings", fontSize = 12.sp, lineHeight = 18.sp, color = ConversationStyle.Muted, maxLines = 1)
            }
            IconButton(onClick = viewModel::profile, enabled = conversation?.head != null, modifier = Modifier.size(36.dp)) {
                Icon(Icons.Outlined.PersonOutline, "View specialist profile", Modifier.size(20.dp), tint = ConversationStyle.Navy)
            }
            IconButton(onClick = ::openDetails, modifier = Modifier.size(36.dp)) {
                Icon(Icons.Outlined.Info, "Conversation details", Modifier.size(20.dp), tint = ConversationStyle.Navy)
            }
        }
        HorizontalDivider(color = ConversationStyle.Divider)
        LazyColumn(Modifier.weight(1f).fillMaxWidth(), state = list, contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp, Alignment.Bottom)) {
            if (state.reconnecting) item { Text("Reconnecting...", fontSize = 12.sp, color = ConversationStyle.Muted) }
            state.error?.let { error -> item { Text(error, color = NexusColors.ErrorRed, fontSize = 12.sp) } }
            workflowState.workflow?.let { workflow ->
                item { Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    WorkflowDocumentCards(workflow) { file -> files?.let { workflowViewModel.file(it, file, false) } }
                } }
                items(workflow.events.takeLast(3), key = { "event-${it.id}" }) { event ->
                    SystemEventRow(event.summary, event.summary.contains("verified", ignoreCase = true))
                }
            }
            if (state.history?.nextCursor != null) item { TextButton(onClick = viewModel::older) { Text("Load earlier messages", fontSize = 12.sp) } }
            state.attachmentError?.let { error -> item {
                Text(error, color = NexusColors.ErrorRed, fontSize = 12.sp)
                TextButton(onClick = viewModel::refreshAttachments) { Text("Retry attachments") }
            } }
            items(timeline, key = { it.id }) { entry ->
                val attachment = entry.attachment
                if (attachment != null) {
                    ConversationAttachmentCard(attachment, attachment.file.uploaderId == userId,
                        load = { viewModel.attachmentContent(attachment) })
                    return@items
                }
                val message = entry.message ?: return@items
                val own = message.sender.id == userId
                Column(Modifier.fillMaxWidth(), horizontalAlignment = if (own) Alignment.End else Alignment.Start) {
                    Surface(shape = RoundedCornerShape(8.dp), color = if (own) ConversationStyle.Navy else Color.White,
                        border = if (own) null else androidx.compose.foundation.BorderStroke(1.dp, ConversationStyle.Divider)) {
                        Text(if (message.deletedAt != null) "Message deleted" else message.body.orEmpty(), Modifier.widthIn(max = 300.dp).padding(12.dp),
                            fontSize = 14.sp, lineHeight = 21.sp, color = if (own) Color.White else ConversationStyle.Ink)
                    }
                    Text(displayTime(message.createdAt) + if (message.editedAt != null) " - Edited" else "", Modifier.padding(top = 4.dp), fontSize = 10.sp, color = ConversationStyle.Muted)
                }
            }
            items(state.pending, key = { it.clientMessageId }) { pending ->
                Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.End) {
                    Surface(shape = RoundedCornerShape(8.dp), color = ConversationStyle.Notice) { Text(pending.body, Modifier.padding(12.dp), fontSize = 14.sp) }
                    if (pending.failed) {
                        pending.failureReason?.let { Text(it, color = NexusColors.ErrorRed, fontSize = 12.sp) }
                        TextButton(onClick = { viewModel.retry(pending) }) { Text("Send failed - Retry", fontSize = 12.sp) }
                    }
                    else Text("Sending...", fontSize = 11.sp, color = ConversationStyle.Muted)
                }
            }
        }
        HorizontalDivider(color = ConversationStyle.Divider)
        Column(Modifier.fillMaxWidth().background(Color.White).padding(start = 20.dp, end = 20.dp, top = 12.dp, bottom = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            if (tools) Surface(modifier = Modifier.widthIn(max = 285.dp).fillMaxWidth(), color = Color.White,
                shape = RoundedCornerShape(8.dp), border = androidx.compose.foundation.BorderStroke(1.dp, ConversationStyle.Border)) {
                Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("Conversation tools", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = ConversationStyle.Muted)
                    ConversationTool(Icons.Outlined.AttachFile, "Attach file", enabled = !workflowState.busy && state.history?.canSend == true) {
                        tools = false
                        attachmentChooser = true
                        workflowViewModel.loadAttachmentOptions(conversation?.bookings.orEmpty().filter { it.status !in listOf("CLOSED", "CANCELLED") }.map { it.id })
                    }
                    ConversationTool(Icons.Outlined.AssignmentTurnedIn, "Agreement and payment") { tools = false; chooser = true }
                }
            }
            workflowState.uploadProgress?.let { LinearProgressIndicator(progress = { it }, modifier = Modifier.fillMaxWidth(), color = ConversationStyle.Navy) }
            workflowState.error?.let { Text(it, color = NexusColors.ErrorRed, fontSize = 12.sp) }
            if (state.history?.canSend == true) {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    SquareChatAction(Icons.Outlined.Add, "Conversation tools", { tools = !tools })
                    Box(Modifier.weight(1f).heightIn(min = 48.dp).border(1.dp, ConversationStyle.Border, RoundedCornerShape(8.dp)).padding(12.dp), contentAlignment = Alignment.CenterStart) {
                        androidx.compose.foundation.text.BasicTextField(value = draft, onValueChange = { if (it.length <= 4000) draft = it },
                            modifier = Modifier.fillMaxWidth(), maxLines = 4, textStyle = androidx.compose.ui.text.TextStyle(fontSize = 14.sp, color = ConversationStyle.Ink),
                            decorationBox = { input -> if (draft.isEmpty()) Text("Write a message...", color = ConversationStyle.Muted, fontSize = 14.sp); input() })
                    }
                    SquareChatAction(Icons.AutoMirrored.Outlined.Send, "Send message", { viewModel.send(draft); draft = "" }, draft.isNotBlank())
                }
                Text("0/4000 \u00B7 Attachments up to 5 MB".replace("0/4000", "${draft.length}/4000"), fontSize = 11.sp, lineHeight = 18.sp, color = ConversationStyle.Muted)
            } else Text(if (state.history?.archived == true) "This conversation is read only." else "Messaging is unavailable.", fontSize = 12.sp, color = ConversationStyle.Muted)
        }
    }
    if (attachmentChooser) ConversationBookingSheet(
        workflowState.attachmentOptions.map { option -> ConversationBooking(
            id = option.request.id, title = option.request.title, serviceName = option.request.serviceName,
            referenceNumber = option.request.referenceNumber, workflowState = option.state,
        ) },
        onDismiss = { attachmentChooser = false },
        onContinue = { bookingId ->
            attachmentChooser = false
            if (files != null) workflowViewModel.upload(files, bookingId)
        },
        attachment = true,
        loading = workflowState.busy,
        error = workflowState.error,
        onRetry = { workflowViewModel.loadAttachmentOptions(conversation?.bookings.orEmpty().filter { it.status !in listOf("CLOSED", "CANCELLED") }.map { it.id }) },
    )
    if (chooser) ConversationBookingSheet(conversation?.bookings.orEmpty(), onDismiss = { chooser = false }, onContinue = { chooser = false; onBooking(it) })
    state.profile?.let { profile -> SpecialistProfileSheet(profile, conversation?.department?.name.orEmpty(), viewModel::closeProfile, state.profileLoading, state.profileError, viewModel::profile) }
}

@Composable
private fun ConversationTool(icon: androidx.compose.ui.graphics.vector.ImageVector, title: String, enabled: Boolean = true, onClick: () -> Unit) {
    Row(Modifier.fillMaxWidth().height(44.dp).clickable(enabled = enabled, onClick = onClick), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        Icon(icon, null, Modifier.size(18.dp), tint = ConversationStyle.Navy)
        Text(title, fontSize = 14.sp, color = ConversationStyle.Ink)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun ConversationBookingSheet(bookings: List<ConversationBooking>, onDismiss: () -> Unit, onContinue: (String) -> Unit, attachment: Boolean = false, loading: Boolean = false, error: String? = null, onRetry: () -> Unit = {}) {
    var selected by remember { mutableStateOf<String?>(null) }
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = Color.White, scrimColor = ConversationStyle.Ink.copy(alpha = .4f), shape = RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp), dragHandle = null) {
        Column(Modifier.fillMaxWidth().padding(start = 20.dp, end = 20.dp, top = 20.dp, bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(24.dp)) {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Row(verticalAlignment = Alignment.Top) {
                    Text(if (attachment) "Attach file:\nchoose a booking" else "Agreement and payment:\nchoose a booking", Modifier.weight(1f), fontSize = 22.sp, lineHeight = 28.sp, fontWeight = FontWeight.SemiBold, color = ConversationStyle.Ink)
                    IconButton(onClick = onDismiss, modifier = Modifier.size(32.dp)) { Icon(Icons.Outlined.Close, "Close booking chooser", Modifier.size(20.dp), tint = ConversationStyle.Muted) }
                }
                Text(if (attachment) "Share a brief, reference, or document for an eligible booking." else "Review a booking's agreement, signed documents, and payment requirements before work begins.", fontSize = 14.sp, lineHeight = 21.sp, color = ConversationStyle.Muted)
            }
            Column(Modifier.heightIn(max = 300.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Choose the service this tool applies to.", fontSize = 14.sp, color = ConversationStyle.Ink)
                if (loading) LinearProgressIndicator(Modifier.fillMaxWidth())
                if (error != null) {
                    Text(error, color = NexusColors.ErrorRed, fontSize = 12.sp)
                    TextButton(onClick = onRetry, enabled = !loading) { Text("Retry booking options") }
                } else if (attachment && !loading && bookings.isEmpty()) {
                    Text("No eligible bookings for attachments at the current stage.", fontSize = 14.sp, color = ConversationStyle.Muted)
                }
                bookings.forEach { booking -> BookingOption(booking, selected == booking.id, { selected = booking.id }) }
            }
        }
        HorizontalDivider(color = ConversationStyle.Divider)
        Row(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            OutlinedButton(onClick = onDismiss, modifier = Modifier.weight(1f).height(48.dp), shape = RoundedCornerShape(8.dp), border = androidx.compose.foundation.BorderStroke(1.dp, ConversationStyle.Border)) { Text("Cancel", color = ConversationStyle.Navy, fontSize = 14.sp) }
            Button(onClick = { selected?.let(onContinue) }, enabled = !loading && error == null && bookings.any { it.id == selected }, modifier = Modifier.weight(1f).height(48.dp), shape = RoundedCornerShape(8.dp),
                colors = ButtonDefaults.buttonColors(containerColor = ConversationStyle.Navy, disabledContainerColor = Color(0xFFE5E8EE), disabledContentColor = Color(0xFF9AA4B4))) { Text("Continue", fontSize = 14.sp) }
        }
    }
}

private fun displayTime(value: String): String = try {
    kotlinx.datetime.Instant.parse(value).toLocalDateTime(kotlinx.datetime.TimeZone.currentSystemDefault()).let {
        "${it.date} ${it.hour.toString().padStart(2, '0')}:${it.minute.toString().padStart(2, '0')}"
    }
} catch (_: IllegalArgumentException) { value }
