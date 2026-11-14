package com.nexus.app.features.conversations.screens

import com.nexus.app.core.components.LocalNexusBottomPadding
import com.nexus.app.core.theme.NexusButtonShape
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.isActive
import androidx.lifecycle.repeatOnLifecycle
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
fun NotificationsScreen(
    onRequest: (String) -> Unit,
    viewModel: NotificationsViewModel = koinViewModel(),
    conversationsViewModel: ConversationsViewModel = koinViewModel()
) {
    val state by viewModel.state.collectAsState()
    val conversations by conversationsViewModel.state.collectAsState()
    val bookings = conversations.page.conversations.flatMap { it.bookings }.associateBy { it.id }
    val groups = remember(state.feed.notifications) {
        state.feed.notifications.groupBy { it.requestId }.values
            .map { it.sortedByDescending { notice -> notice.createdAt } }
            .sortedByDescending { it.first().createdAt }
    }
    var expanded by rememberSaveable { mutableStateOf<String?>(null) }
    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) { viewModel.refresh() }
    LazyColumn(Modifier.fillMaxSize().background(NexusColors.SurfaceLight).padding(horizontal = 20.dp),
        contentPadding = PaddingValues(bottom = LocalNexusBottomPadding.current),
        verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            Row(Modifier.fillMaxWidth().padding(vertical = 8.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically) {
                TextButton(shape = NexusButtonShape, onClick = viewModel::refresh,
                    contentPadding = PaddingValues(0.dp)) { Text("Refresh", fontSize = 14.sp) }
                TextButton(shape = NexusButtonShape, onClick = viewModel::readAll,
                    enabled = state.feed.unreadCount > 0,
                    contentPadding = PaddingValues(0.dp)) { Text("Mark all as read", fontSize = 14.sp) }
            }
        }
        item {
            if (state.loading) LinearProgressIndicator(Modifier.fillMaxWidth())
            state.error?.let { Text(it, color = NexusColors.ErrorRed, modifier = Modifier.padding(vertical = 12.dp)) }
        }
        if (!state.loading && groups.isEmpty()) item { Text("You're all caught up.", Modifier.padding(16.dp)) }
        items(groups, key = { it.first().requestId }) { updates ->
            val latest = updates.first()
            val unread = updates.any { it.readAt == null }
            val booking = bookings[latest.requestId]
            Surface(color = if (unread) Color(0xFFDFE6F2) else Color.White, shape = RoundedCornerShape(8.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, if (unread) Color(0xFFA7B5CF) else NexusColors.Border)) {
                Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Column(Modifier.fillMaxWidth().clickable { viewModel.openGroup(updates, onRequest) },
                        verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(booking?.title?.takeIf { it.isNotBlank() } ?: booking?.serviceName?.takeIf { it.isNotBlank() }
                            ?: "Service updates", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = NexusColors.PrimaryBlue)
                        booking?.referenceNumber?.let { Text(it, fontSize = 11.sp, color = NexusColors.TextSecondary) }
                        Text(latest.summary, fontSize = 14.sp,
                            fontWeight = if (unread) FontWeight.SemiBold else FontWeight.Normal,
                            color = NexusColors.TextPrimary)
                        Text(displayTime(latest.createdAt), fontSize = 12.sp, color = NexusColors.TextSecondary)
                    }
                    if (updates.size > 1) {
                        TextButton(onClick = { expanded = if (expanded == latest.requestId) null else latest.requestId },
                            contentPadding = PaddingValues(0.dp)) {
                            Text(if (expanded == latest.requestId) "Hide updates" else "${updates.size} updates - View all", fontSize = 12.sp)
                        }
                        if (expanded == latest.requestId) updates.drop(1).forEach { notification ->
                            HorizontalDivider(color = NexusColors.Border)
                            Column(Modifier.fillMaxWidth().clickable { viewModel.open(notification, onRequest) }.padding(vertical = 6.dp)) {
                                Text(notification.summary, fontSize = 13.sp,
                                    fontWeight = if (notification.readAt == null) FontWeight.SemiBold else FontWeight.Normal)
                                Text(displayTime(notification.createdAt), fontSize = 11.sp, color = NexusColors.TextSecondary)
                            }
                        }
                    }
                }
            }
        }
        item { Spacer(Modifier.height(20.dp)) }
    }
}

@Composable
fun MessagesScreen(onConversation: (String) -> Unit, viewModel: ConversationsViewModel = koinViewModel()) {
    val state by viewModel.state.collectAsState()
    val lifecycle = androidx.lifecycle.compose.LocalLifecycleOwner.current.lifecycle
    LaunchedEffect(viewModel, lifecycle) {
        lifecycle.repeatOnLifecycle(Lifecycle.State.RESUMED) {
            while (kotlinx.coroutines.currentCoroutineContext().isActive) {
                viewModel.refresh(false)
                kotlinx.coroutines.delay(15_000)
            }
        }
    }
    LazyColumn(Modifier.fillMaxSize().background(NexusColors.SurfaceLight).padding(horizontal = 20.dp),
        contentPadding = PaddingValues(top = 20.dp, bottom = 20.dp + LocalNexusBottomPadding.current), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item { Text("Select a conversation", fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
            Text("Choose a department below to discuss all your bookings in one conversation.", fontSize = 12.sp, lineHeight = 18.sp, color = ConversationStyle.Muted) }
        item {
            if (state.loading) LinearProgressIndicator(Modifier.fillMaxWidth())
            state.error?.let {
                Text("Unable to load conversations. Please try again.", color = NexusColors.ErrorRed)
                TextButton(shape = NexusButtonShape, onClick = { viewModel.refresh(false) }, enabled = !state.loading) { Text("Retry") }
            }
        }
        if (!state.loading && state.error == null && state.page.conversations.isEmpty()) item {
            Text("No conversations yet.", color = NexusColors.TextSecondary)
        }
        items(state.page.conversations, key = { it.id }) { row ->
            Card(onClick = { onConversation(row.id) }, colors = CardDefaults.cardColors(containerColor = Color.White),
                border = androidx.compose.foundation.BorderStroke(1.dp, NexusColors.Border)) {
                Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                    BadgedBox(badge = {
                        if (row.unreadCount > 0) Badge(containerColor = Color(0xFF3B82F6), modifier = Modifier.size(8.dp))
                    }) {
                        ChatAvatar(row.acceptedDepartment?.head?.fullName ?: "EXP", row.acceptedDepartment?.head?.imageUrl)
                    }
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text(row.acceptedDepartment?.head?.fullName ?: row.acceptedDepartment?.name ?: row.title, fontSize = 14.sp, fontWeight = if (row.unreadCount > 0) FontWeight.Bold else FontWeight.Medium, color = ConversationStyle.Ink, maxLines = 2, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis)
                        Text(row.service.name + if (row.bookings.size > 1) " - ${row.bookings.size} bookings" else "", fontSize = 12.sp, color = NexusColors.TextSecondary)
                        Text(row.lastMessage?.let { if (it.deletedAt != null) "Message deleted" else it.body.orEmpty() } ?: "Start a conversation", maxLines = 2, fontSize = 12.sp, lineHeight = 18.sp, color = ConversationStyle.Muted)
                    }
                    if (row.unreadCount > 0) Badge(containerColor = Color(0xFF3B82F6), contentColor = Color.White) { Text(row.unreadCount.toString()) }
                    Text(" >", color = NexusColors.PrimaryBlue)
                }
            }
        }
        if (state.page.nextCursor != null) item { TextButton(shape = NexusButtonShape, onClick = { viewModel.refresh(more = true) }, enabled = !state.loading) { Text("Load more") } }
    }
}

@Composable
fun ChatScreen(
    id: String,
    userId: String,
    onBack: () -> Unit,
    onDetails: (String) -> Unit,
    onBooking: (String) -> Unit = onDetails,
    viewModel: ConversationsViewModel = koinViewModel(),
    selectedBookingId: String? = null
) {
    val state by viewModel.state.collectAsState()
    val workflowViewModel: WorkflowViewModel = koinViewModel()
    val workflowState by workflowViewModel.state.collectAsState()
    val files = com.nexus.app.core.files.LocalPlatformFiles.current
    var draft by rememberSaveable(id, state.selectedBookingId) { mutableStateOf("") }
    var tools by remember(id) { mutableStateOf(false) }
    var attachmentChooser by remember(id) { mutableStateOf(false) }
    var chooser by remember(id) { mutableStateOf(false) }
    val visibleMessages = state.messages.filter { it.booking == null || it.booking.id == state.selectedBookingId }
    val visiblePending = state.pending.filter { it.bookingId == null || it.bookingId == state.selectedBookingId }
    val timeline = remember(visibleMessages, state.attachments) { conversationTimeline(visibleMessages, state.attachments) }
    val list = key(state.selectedBookingId) { rememberLazyListState() }
    val conversation = state.history?.conversation
    val workflow = workflowState.workflow?.takeIf { it.request.id == state.selectedBookingId }
    val selectedBooking = conversation?.bookings?.find { it.id == state.selectedBookingId }
    fun openDetails() { state.history?.selectedBookingId?.let(onDetails) }

    LaunchedEffect(id, selectedBookingId) {
        viewModel.open(id)
        selectedBookingId?.let(viewModel::selectBooking)
        viewModel.foreground(true)
    }
    LaunchedEffect(state.selectedBookingId, state.selectedWorkflow?.version) {
        state.history?.selectedBookingId?.let { workflowViewModel.open(it) }
    }
    LaunchedEffect(workflowState.selectedFileId) {
        if (workflowState.selectedFileId != null) viewModel.refreshAttachments()
    }
    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) {
        viewModel.foreground(true)
        state.selectedBookingId?.let(workflowViewModel::open)
    }
    LifecycleEventEffect(Lifecycle.Event.ON_PAUSE) { viewModel.foreground(false) }
    DisposableEffect(id) { onDispose { viewModel.foreground(false) } }
    LaunchedEffect(state.selectedBookingId, timeline.lastOrNull()?.id, visiblePending.size) {
        if (timeline.isNotEmpty() || visiblePending.isNotEmpty()) {
            snapshotFlow { list.layoutInfo.totalItemsCount }.first { it > 0 }
            list.scrollToItem(list.layoutInfo.totalItemsCount - 1)
        }
    }


    Column(Modifier.fillMaxSize().imePadding().background(ConversationStyle.Background)) {
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
        selectedBooking?.let { booking ->
            Text(booking.title, Modifier.fillMaxWidth().background(Color.White).padding(horizontal = 20.dp, vertical = 8.dp),
                fontSize = 12.sp, color = ConversationStyle.Muted)
        }
        HorizontalDivider(color = ConversationStyle.Divider)
        LazyColumn(Modifier.weight(1f).fillMaxWidth(), state = list, contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp, Alignment.Bottom)) {
            if (state.reconnecting) item { Text("Reconnecting...", fontSize = 12.sp, color = ConversationStyle.Muted) }
            state.error?.let { error -> item { Text(error, color = NexusColors.ErrorRed, fontSize = 12.sp) } }
            workflow?.let { workflow ->
                item { Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    ChatWorkflowForms(workflow, workflowState.busy, workflowState.selectedFileId,
                        workflowViewModel::action, onDetails = { onDetails(workflow.request.id) },
                        onDocuments = { onBooking(workflow.request.id) },
                        onFile = { file -> files?.let { workflowViewModel.file(it, file, false) } })
                } }
                items(workflow.events.takeLast(3), key = { "event-${it.id}" }) { event ->
                    SystemEventRow(event.summary, event.summary.contains("verified", ignoreCase = true))
                }
            }
            if (state.history?.nextCursor != null) item { TextButton(shape = NexusButtonShape, onClick = viewModel::older) { Text("Load earlier messages", fontSize = 12.sp) } }
            state.attachmentError?.let { error -> item {
                Text(error, color = NexusColors.ErrorRed, fontSize = 12.sp)
                TextButton(shape = NexusButtonShape, onClick = viewModel::refreshAttachments) { Text("Retry attachments") }
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
                    Surface(shape = RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp,
                        bottomEnd = if (own) 6.dp else 16.dp, bottomStart = if (own) 16.dp else 6.dp),
                        color = if (message.deletedAt != null) Color(0xFFF6F8FC) else if (own) ConversationStyle.Navy else Color(0xFFDFE4EB),
                        border = if (message.deletedAt != null) androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFD8E1EF)) else null) {
                        Text(if (message.deletedAt != null) "Message deleted" else message.body.orEmpty(), Modifier.widthIn(max = 300.dp).padding(12.dp),
                            fontSize = 14.sp, lineHeight = 21.sp, color = if (message.deletedAt != null) ConversationStyle.Muted else if (own) Color.White else ConversationStyle.Ink)
                    }
                    if (message.booking == null && conversation?.bookings.orEmpty().size > 1) {
                        Text("Shared conversation", fontSize = 10.sp, color = ConversationStyle.Muted)
                    }
                    Text(displayTime(message.createdAt) + if (message.editedAt != null) " - Edited" else "", Modifier.padding(top = 4.dp), fontSize = 10.sp, color = ConversationStyle.Muted)
                }
            }
            items(visiblePending, key = { it.clientMessageId }) { pending ->
                Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.End) {
                    Surface(shape = RoundedCornerShape(8.dp), color = ConversationStyle.Notice) { Text(pending.body, Modifier.padding(12.dp), fontSize = 14.sp) }
                    if (pending.failed) {
                        pending.failureReason?.let { Text(it, color = NexusColors.ErrorRed, fontSize = 12.sp) }
                        TextButton(shape = NexusButtonShape, onClick = { viewModel.retry(pending) }) { Text("Send failed - Retry", fontSize = 12.sp) }
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
            if (workflowState.busy) LinearProgressIndicator(Modifier.fillMaxWidth(), color = ConversationStyle.Navy)
            workflowState.error?.let {
                Text(it, color = NexusColors.ErrorRed, fontSize = 12.sp)
                TextButton(shape = NexusButtonShape, enabled = !workflowState.busy,
                    onClick = { state.selectedBookingId?.let(workflowViewModel::open) }) { Text("Retry booking forms") }
            }
            if (workflowState.pendingAction && !workflowState.busy) {
                TextButton(shape = NexusButtonShape, onClick = workflowViewModel::retryAction) { Text("Confirm previous action") }
            }
            if (state.history?.canSend == true) {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    SquareChatAction(Icons.Outlined.Add, "Conversation tools", { tools = !tools })
                    Box(Modifier.weight(1f).heightIn(min = 48.dp).clip(RoundedCornerShape(16.dp)).background(Color(0xFFFAFAF9)).border(1.dp, Color(0xFFE8E9EB), RoundedCornerShape(16.dp)).padding(12.dp), contentAlignment = Alignment.CenterStart) {
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
                    TextButton(shape = NexusButtonShape, onClick = onRetry, enabled = !loading) { Text("Retry booking options") }
                } else if (attachment && !loading && bookings.isEmpty()) {
                    Text("No eligible bookings for attachments at the current stage.", fontSize = 14.sp, color = ConversationStyle.Muted)
                }
                bookings.forEach { booking -> BookingOption(booking, selected == booking.id, { selected = booking.id }) }
            }
        }
        HorizontalDivider(color = ConversationStyle.Divider)
        Row(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            OutlinedButton(onClick = onDismiss, modifier = Modifier.weight(1f).height(40.dp), shape = NexusButtonShape, border = androidx.compose.foundation.BorderStroke(1.dp, ConversationStyle.Border)) { Text("Cancel", color = ConversationStyle.Navy, fontSize = 14.sp) }
            Button(onClick = { selected?.let(onContinue) }, enabled = !loading && error == null && bookings.any { it.id == selected }, modifier = Modifier.weight(1f).height(40.dp), shape = NexusButtonShape,
                colors = ButtonDefaults.buttonColors(containerColor = ConversationStyle.Navy, disabledContainerColor = Color(0xFFE5E8EE), disabledContentColor = Color(0xFF9AA4B4))) { Text("Continue", fontSize = 14.sp) }
        }
    }
}

private fun displayTime(value: String): String = try {
    kotlinx.datetime.Instant.parse(value).toLocalDateTime(kotlinx.datetime.TimeZone.currentSystemDefault()).let {
        "${it.date} ${it.hour.toString().padStart(2, '0')}:${it.minute.toString().padStart(2, '0')}"
    }
} catch (_: IllegalArgumentException) { value }
