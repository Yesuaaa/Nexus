package com.nexus.app.features.profile.screens

import com.nexus.app.core.components.LocalNexusBottomPadding
import com.nexus.app.core.components.NexusDialogButton
import com.nexus.app.core.components.NexusAlertDialog
import com.nexus.app.core.theme.NexusButtonShape
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.ScrollState
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInParent
import kotlinx.coroutines.flow.filterNotNull
import kotlinx.coroutines.flow.first
import kotlin.math.roundToInt
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.compose.*
import coil3.compose.AsyncImage
import com.nexus.app.core.components.NexusDropdown
import com.nexus.app.core.components.LocalNexusToast
import com.nexus.app.core.components.ToastKind
import com.nexus.app.core.files.LocalPlatformFiles
import com.nexus.app.core.files.SelectedFile
import com.nexus.app.core.theme.NexusColors
import com.nexus.app.features.auth.model.AuthUser
import com.nexus.app.features.profile.api.validateProfileImage
import com.nexus.app.features.profile.model.*
import com.nexus.app.features.profile.viewmodel.ProfileViewModel
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.datetime.*
import org.koin.compose.viewmodel.koinViewModel

private val pageBackground = Color(0xFFF7F8FA)
private val ink = Color(0xFF1A2233)
private val muted = Color(0xFF52627A)
private val blue = NexusColors.PrimaryBlue

@Composable
fun ProfileScreen(
    user: AuthUser,
    initialSettings: Boolean = false, onEditingChange: (Boolean) -> Unit = {},
    viewModel: ProfileViewModel = koinViewModel(),
    onTitleChange: (String) -> Unit = {}
) {
    val state by viewModel.state.collectAsState()
    val nav = rememberNavController()
    val entry by nav.currentBackStackEntryAsState()
    val editor = entry?.destination?.route in setOf("details", "images", "password")
    LaunchedEffect(entry?.destination?.route) {
        onTitleChange(if (entry?.destination?.route == "settings" ||
            (entry == null && initialSettings)) "Settings" else "Profile")
    }
    LaunchedEffect(editor) { onEditingChange(editor) }
    DisposableEffect(Unit) { onDispose { onEditingChange(false) } }
    var signOutAfterPassword by rememberSaveable { mutableStateOf(false) }
    val toast = LocalNexusToast.current
    LaunchedEffect(state.message) {
        state.message?.let { toast.show(it, "Your account is up to date.", ToastKind.SUCCESS); viewModel.clearFeedback() }
    }
    val profile = state.profile
    val preferences = state.settings?.preferences ?: Preferences()
    Column(Modifier.fillMaxSize().background(if (editor) Color.White else pageBackground)) {
        if (state.error != null && entry?.destination?.route != "password") {
            Surface(color = NexusColors.ErrorLightBg, modifier = Modifier.fillMaxWidth()) {
                Column(Modifier.padding(12.dp)) {
                    Text(state.error!!, color = NexusColors.ErrorRed)
                    TextButton(shape = NexusButtonShape, onClick = { viewModel.reload() }, enabled = !state.loading && !state.busy) { Text("Retry loading account") }
                }
            }
        }
        if (state.loading) LinearProgressIndicator(Modifier.fillMaxWidth(), color = blue)
        NavHost(nav, startDestination = if (initialSettings) "settings" else "overview", modifier = Modifier.weight(1f)) {
            composable("overview") {
                AccountPage {
                    val account = profile?.user ?: user
                    ProfileIdentity(profile, account, preferences, { nav.navigate("images") }, { nav.navigate("details") })
                    AccountCard {
                        CardHeading("About", { nav.navigate("details") })
                        Hint("Manage your contact details and account information from your profile.")
                    }
                    AccountCard {
                        CardHeading("Contact information", { nav.navigate("details") })
                        Detail(Icons.Outlined.Email, "Email", account.email)
                        HorizontalDivider(color = NexusColors.Border)
                        Detail(Icons.Outlined.Phone, "Contact number", account.contactNumber?.takeIf { it.isNotBlank() } ?: "Not provided")
                    }
                    AccountCard {
                        CardHeading("Account security")
                        Detail(Icons.Outlined.VerifiedUser, "", "Keep your account protected with a strong password.")
                        Action("Change password", { nav.navigate("password") }, outlined = true)
                        HorizontalDivider(color = NexusColors.Border)
                        account.createdAt?.let { Detail(Icons.Outlined.CalendarMonth, "Joined", dateLabel(it, preferences)) }
                    }
                    Action("Settings", { nav.navigate("settings") }, outlined = true)
                }
            }
            composable("details") {
                Editor("Personal details", "Keep your name and contact information up to date.", "My profile", state.busy, { nav.popBackStack() }) {
                    if (profile != null) PersonalForm(profile, state.busy) { name, contact -> viewModel.save(name, contact) { nav.popBackStack() } }
                }
            }
            composable("images") {
                Editor("Profile photo & banner", "Choose your images, review the previews, then save your changes.", "My profile", state.busy, { nav.popBackStack() }) {
                    if (profile != null) ImageForm(profile, state.busy, { nav.popBackStack() }, viewModel::images)
                }
            }
            composable("password") {
                Editor("Password & security", "Use at least 12 characters. Mix uppercase, lowercase, numbers, and symbols.", "account", state.busy, { nav.popBackStack() }) {
                    PasswordForm(state.busy, state.error, viewModel::clearFeedback) { current, next -> viewModel.password(current, next) { nav.popBackStack(); signOutAfterPassword = true } }
                }
            }
            composable("settings") {
                SettingsContent(state.settings, state.busy, { nav.navigate("password") }, viewModel::preferences, viewModel::revoke)
            }
        }
    }
    if (signOutAfterPassword) NexusAlertDialog(
        onDismissRequest = { if (!state.busy) signOutAfterPassword = false },
        title = { Text("Sign out other devices?") },
        text = { Text("Your password was changed. Sign out all other devices so they need to use your new password. This device will stay signed in.") },
        confirmButton = {
            NexusDialogButton(enabled = !state.busy, destructive = true, onClick = { viewModel.revoke(); signOutAfterPassword = false }) { Text("Sign out", maxLines = 1, softWrap = false) }
        },
        dismissButton = { NexusDialogButton(enabled = !state.busy, onClick = { signOutAfterPassword = false }) { Text("Keep signed in") } }
    )
}

@Composable private fun AccountPage(scrollState: ScrollState = rememberScrollState(), content: @Composable ColumnScope.() -> Unit) {
    Column(Modifier.fillMaxSize().verticalScroll(scrollState).padding(start = 20.dp, end = 20.dp, top = 20.dp, bottom = 8.dp + LocalNexusBottomPadding.current), verticalArrangement = Arrangement.spacedBy(20.dp)) {
        content()
    }
}
@Composable private fun AccountCard(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    Surface(modifier.fillMaxWidth(), shape = RoundedCornerShape(6.dp), color = Color.White, border = BorderStroke(1.dp, NexusColors.Border)) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp), content = content)
    }
}
@Composable private fun CardHeading(title: String, edit: (() -> Unit)? = null) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(title, Modifier.weight(1f), fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = ink)
        if (edit != null) IconButton(onClick = edit, modifier = Modifier.size(32.dp)) { Icon(Icons.Outlined.Edit, "Edit $title", tint = blue, modifier = Modifier.size(18.dp)) }
    }
}
@Composable private fun Hint(text: String) { Text(text, fontSize = 12.sp, lineHeight = 18.sp, color = muted) }
@Composable private fun Detail(icon: ImageVector, label: String, value: String) {
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Icon(icon, null, tint = muted, modifier = Modifier.size(18.dp))
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            if (label.isNotBlank()) Text(label, fontSize = 11.sp, color = muted)
            Text(value, fontSize = 13.sp, color = ink)
        }
    }
}
@Composable private fun Action(text: String, click: () -> Unit, enabled: Boolean = true, outlined: Boolean = false) {
    if (outlined) OutlinedButton(onClick = click, enabled = enabled, modifier = Modifier.fillMaxWidth(), shape = NexusButtonShape, border = BorderStroke(1.dp, NexusColors.Border)) { Text(text, color = if (enabled) blue else muted, fontSize = 13.sp) }
    else Button(onClick = click, enabled = enabled, modifier = Modifier.fillMaxWidth(), shape = NexusButtonShape, colors = ButtonDefaults.buttonColors(containerColor = blue)) { Text(text, color = Color.White, fontSize = 13.sp) }
}
@Composable private fun ProfileIdentity(profile: Profile?, user: AuthUser, preferences: Preferences, images: () -> Unit, edit: () -> Unit) {
    Surface(shape = RoundedCornerShape(6.dp), color = Color.White, border = BorderStroke(1.dp, NexusColors.Border)) {
        Column {
            Box(Modifier.fillMaxWidth().height(148.dp).background(blue)) {
                if (profile?.bannerUrl != null) AsyncImage(profile.bannerUrl, "Cover banner", Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
                else {
                    Box(Modifier.size(180.dp).offset(160.dp, 60.dp).background(Color.White.copy(alpha = .05f), CircleShape))
                    Box(Modifier.size(150.dp).offset(240.dp, (-40).dp).background(Color.White.copy(alpha = .05f), CircleShape))
                }
                TextButton(shape = NexusButtonShape, onClick = images, modifier = Modifier.align(Alignment.TopEnd).padding(8.dp), colors = ButtonDefaults.textButtonColors(contentColor = Color.White)) {
                    Icon(Icons.Outlined.PhotoCamera, null, Modifier.size(14.dp)); Spacer(Modifier.width(6.dp)); Text("Edit banner", color = Color.White, fontSize = 11.sp)
                }
            }
            Column(Modifier.padding(horizontal = 16.dp).offset(y = (-36).dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Box {
                    Box(Modifier.size(84.dp).clip(CircleShape).background(Color(0xFFE9EFF9)).clickable(onClick = images), contentAlignment = Alignment.Center) {
                        if (profile?.imageUrl != null) AsyncImage(profile.imageUrl, "Profile picture", Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
                        else Text((user.fullName ?: user.email).take(1).uppercase(), fontSize = 28.sp, color = blue)
                    }
                    IconButton(onClick = images, modifier = Modifier.align(Alignment.BottomEnd).size(32.dp).background(Color.White, CircleShape)) { Icon(Icons.Outlined.PhotoCamera, "Edit profile photo", Modifier.size(16.dp), tint = blue) }
                }
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(user.fullName ?: "Your profile", fontWeight = FontWeight.SemiBold, color = ink)
                    Surface(color = Color(0xFFE9EFF9), shape = RoundedCornerShape(4.dp)) { Text(roleLabel(user.role), Modifier.padding(horizontal = 6.dp, vertical = 2.dp), fontSize = 10.sp, color = blue) }
                }
                Hint(if (user.role == "USER") "Client at EXP Digital Solutions" else "EXP Digital Solutions")
                user.createdAt?.let { Detail(Icons.Outlined.CalendarMonth, "", "Member since ${dateLabel(it, preferences)}") }
                Action("Edit profile", edit, enabled = profile != null)
            }
        }
    }
}
private fun roleLabel(role: String) = when (role) { "USER" -> "Client"; "SUPERADMIN" -> "Superadmin"; "ADMIN" -> "Admin"; "STAFF" -> "Staff"; else -> role }

@Composable private fun Editor(title: String, description: String, backLabel: String, busy: Boolean, back: () -> Unit, content: @Composable ColumnScope.() -> Unit) {
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).imePadding().padding(horizontal = 20.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            TextButton(shape = NexusButtonShape, onClick = back, enabled = !busy, contentPadding = PaddingValues(0.dp)) { Icon(Icons.AutoMirrored.Outlined.ArrowBack, null, Modifier.size(16.dp)); Spacer(Modifier.width(6.dp)); Text("Back to $backLabel", color = blue, fontSize = 12.sp) }
            Spacer(Modifier.weight(1f))
            IconButton(onClick = back, enabled = !busy) { Icon(Icons.Outlined.Close, "Close editor", tint = blue, modifier = Modifier.size(18.dp)) }
        }
        Text(title, fontSize = 20.sp, fontWeight = FontWeight.SemiBold, color = ink)
        Hint(description)
        content()
    }
}
@Composable private fun Field(label: String, value: String, change: (String) -> Unit, enabled: Boolean = true, readOnly: Boolean = false, password: Boolean = false, error: String? = null, onBlur: () -> Unit = {}) {
    var visible by remember { mutableStateOf(false) }
    var wasFocused by remember { mutableStateOf(false) }
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Row(Modifier.fillMaxWidth()) { Text(label, Modifier.weight(1f), fontSize = 12.sp, color = ink); if (readOnly) Hint("Read-only") }
        OutlinedTextField(value, change, Modifier.fillMaxWidth().onFocusChanged {
            if (wasFocused && !it.isFocused) onBlur()
            wasFocused = it.isFocused
        }, isError = error != null,
            supportingText = if (error != null) { { Text(error, color = NexusColors.ErrorRed, fontSize = 11.sp) } } else null,
            enabled = enabled, readOnly = readOnly, singleLine = true, shape = RoundedCornerShape(6.dp),
            visualTransformation = if (password && !visible) PasswordVisualTransformation() else VisualTransformation.None,
            trailingIcon = if (password) { { IconButton(onClick = { visible = !visible }) { Icon(if (visible) Icons.Outlined.VisibilityOff else Icons.Outlined.Visibility, if (visible) "Hide $label" else "Show $label", Modifier.size(18.dp)) } } }
                else if (readOnly) { { Icon(Icons.Outlined.Lock, "Read-only", Modifier.size(16.dp)) } } else null)
    }
}
@Composable private fun PersonalForm(profile: Profile, busy: Boolean, save: (String, String) -> Unit) {
    var name by rememberSaveable(profile.user.id) { mutableStateOf(profile.user.fullName ?: "") }
    var contact by rememberSaveable(profile.user.id) { mutableStateOf(profile.user.contactNumber ?: "") }
    var error by remember { mutableStateOf<String?>(null) }
    Field("Full name", name, { name = it }, !busy)
    Field("Contact number", contact, { contact = it }, !busy)
    Field("Email address", profile.user.email, {}, readOnly = true)
    Hint("Contact an administrator to change your email address.")
    Field("Account role", roleLabel(profile.user.role), {}, readOnly = true)
    error?.let { Text(it, color = NexusColors.ErrorRed, fontSize = 12.sp) }
    Action(if (busy) "Saving..." else "Save personal details", {
        error = when { name.trim().length !in 2..100 -> "Enter a full name between 2 and 100 characters."
            contact.isNotBlank() && !Regex("\\+?[0-9][0-9\\s-]{6,19}").matches(contact.trim()) -> "Enter a valid contact number."
            else -> null }
        if (error == null) save(name, contact)
    }, !busy)
}
@Composable private fun ImageForm(profile: Profile, busy: Boolean, cancel: () -> Unit, save: (SelectedFile?, SelectedFile?, (String) -> Unit, () -> Unit) -> Unit) {
    var avatar by remember { mutableStateOf<SelectedFile?>(null) }
    var banner by remember { mutableStateOf<SelectedFile?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var selecting by remember { mutableStateOf(false) }
    val files = LocalPlatformFiles.current
    val scope = rememberCoroutineScope()
    listOf("avatar", "banner").forEach { kind ->
        val isAvatar = kind == "avatar"
        val draft = if (isAvatar) avatar else banner
        AccountCard {
            CardHeading(if (isAvatar) "Profile picture" else "Cover banner")
            val modifier = if (isAvatar) Modifier.size(96.dp).clip(CircleShape) else Modifier.fillMaxWidth().height(132.dp).clip(RoundedCornerShape(6.dp))
            Box(modifier.background(Color(0xFFE9EFF9)), contentAlignment = Alignment.Center) {
                val image: Any? = draft?.bytes ?: if (isAvatar) profile.imageUrl else profile.bannerUrl
                if (image != null) AsyncImage(image, if (isAvatar) "Profile picture preview" else "Banner preview", Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
                else Icon(if (isAvatar) Icons.Outlined.PersonOutline else Icons.Outlined.AddPhotoAlternate, null, tint = muted)
            }
            OutlinedButton(onClick = {
                selecting = true
                scope.launch {
                    try { files?.selectImage()?.let { validateProfileImage(it); if (isAvatar) avatar = it else banner = it }; error = null }
                    catch (e: CancellationException) { throw e }
                    catch (e: Exception) { error = e.message }
                    finally { selecting = false }
                }
            }, enabled = !busy && !selecting && files != null, shape = NexusButtonShape) { Icon(Icons.Outlined.AddPhotoAlternate, null, Modifier.size(16.dp)); Spacer(Modifier.width(6.dp)); Text("Change image", fontSize = 12.sp) }
            Hint("JPEG, PNG, or WebP - up to 2 MB - ${if (isAvatar) "a square image works best." else "a wide image works best."}")
            draft?.let { Hint("Selected: ${it.name}") }
        }
    }
    error?.let { Text(it, color = NexusColors.ErrorRed) }
    Action("Cancel", cancel, !busy && !selecting, outlined = true)
    Action(if (busy) "Saving..." else "Save changes", { save(avatar, banner, { if (it == "avatar") avatar = null else banner = null }, cancel) }, !busy && !selecting && (avatar != null || banner != null))
}
@Composable private fun PasswordForm(busy: Boolean, serverError: String?, clearServerError: () -> Unit, save: (String, String) -> Unit) {
    // Passwords deliberately stay out of saved instance state.
    var current by remember { mutableStateOf("") }
    var next by remember { mutableStateOf("") }
    var confirm by remember { mutableStateOf("") }
    var currentTouched by remember { mutableStateOf(false) }
    var nextTouched by remember { mutableStateOf(false) }
    var confirmTouched by remember { mutableStateOf(false) }
    var submitted by remember { mutableStateOf(false) }
    var choice by remember { mutableStateOf(false) }
    val currentError = when {
        current.isEmpty() -> "Enter your current password."
        current.encodeToByteArray().size > 1024 -> "Current password is too long."
        else -> null
    }
    val nextError = when {
        next.isEmpty() -> "Enter a new password."
        next.length < 12 -> "Use at least 12 characters."
        next.encodeToByteArray().size > 1024 -> "Password must not exceed 1024 bytes."
        !next.any(Char::isUpperCase) -> "Add at least one uppercase letter."
        !next.any(Char::isLowerCase) -> "Add at least one lowercase letter."
        !next.any(Char::isDigit) -> "Add at least one number."
        next.all(Char::isLetterOrDigit) -> "Add at least one special character."
        next == current -> "Choose a password different from your current password."
        else -> null
    }
    val confirmError = when {
        confirm.isEmpty() -> "Confirm your new password."
        confirm != next -> "Passwords do not match."
        else -> null
    }
    val serverCurrentError = serverError?.takeIf { it.contains("current password", ignoreCase = true) }
    Field("Current password", current, { current = it; clearServerError() }, !busy, password = true,
        error = serverCurrentError ?: currentError.takeIf { submitted || currentTouched }, onBlur = { currentTouched = true })
    Field("New password", next, { next = it; clearServerError() }, !busy, password = true,
        error = nextError.takeIf { submitted || nextTouched }, onBlur = { nextTouched = true })
    Field("Confirm new password", confirm, { confirm = it; clearServerError() }, !busy, password = true,
        error = confirmError.takeIf { submitted || confirmTouched }, onBlur = { confirmTouched = true })
    if (serverError != null && serverCurrentError == null) Text(serverError, color = NexusColors.ErrorRed, fontSize = 12.sp)
    Action(if (busy) "Updating..." else "Update password", {
        submitted = true
        if (currentError == null && nextError == null && confirmError == null) choice = true
    }, !busy)
    if (choice) NexusAlertDialog(onDismissRequest = { choice = false }, title = { Text("Update password?") },
        text = { Text("Your password will change. You can manage other signed-in devices in Settings > Security.") },
        confirmButton = { NexusDialogButton(onClick = { choice = false; save(current, next) }) { Text("Update password") } },
        dismissButton = { NexusDialogButton(onClick = { choice = false }, destructive = true) { Text("Cancel") } })
}
@Composable private fun SettingsContent(settings: AccountSettings?, busy: Boolean, password: () -> Unit, save: (Preferences) -> Unit, revoke: (String?) -> Unit) {
    var tab by rememberSaveable { mutableStateOf(0) }
    val scrollState = rememberScrollState()
    var sectionTarget by remember { mutableStateOf("sessions") }
    var sectionRequest by remember { mutableStateOf(0) }
    var sessionsOffset by remember(tab) { mutableStateOf<Int?>(null) }
    LaunchedEffect(sectionRequest) {
        if (sectionRequest > 0) {
            val offset = if (sectionTarget == "sessions") {
                snapshotFlow { sessionsOffset }.filterNotNull().first()
            } else 0
            scrollState.scrollTo(offset.coerceAtLeast(0))
        }
    }
    val saved = settings?.preferences ?: Preferences()
    var draft by remember(saved) { mutableStateOf(saved) }
    var revokeTarget by remember { mutableStateOf<AccountSession?>(null) }
    var revokeAll by remember { mutableStateOf(false) }
    AccountPage(scrollState) {
        Hint("Manage your security, notifications, and preferences.")
        PrimaryTabRow(selectedTabIndex = tab, containerColor = Color.Transparent, contentColor = blue) {
            listOf("Security", "Notifications", "Preferences").forEachIndexed { index, title ->
                Tab(selected = tab == index, onClick = { tab = index }, text = { Text(title, fontSize = 12.sp) })
            }
        }
        if (settings == null) { Hint("Loading account settings..."); return@AccountPage }
        when (tab) {
            0 -> {
                AccountCard {
                    Detail(Icons.Outlined.Key, "Password", "Keep your account password secure and up to date.")
                    Action("Change password", password, !busy, outlined = true)
                }
                AccountCard(Modifier.onGloballyPositioned { sessionsOffset = it.positionInParent().y.roundToInt() }) {
                    CardHeading("Active sessions")
                    Hint("Review where you're signed in and manage your active sessions.")
                    if (settings.sessions.isEmpty()) Hint("No active sessions to display.")
                    settings.sessions.forEach { session ->
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                Icon(Icons.Outlined.Devices, null, Modifier.size(18.dp), tint = muted)
                                Text(session.device, Modifier.weight(1f), fontSize = 12.sp, color = ink)
                                if (session.current) Surface(color = Color(0xFFE9EFF9), shape = RoundedCornerShape(4.dp)) { Text("Current session", Modifier.padding(4.dp), color = blue, fontSize = 12.sp) }
                            }
                            Hint(session.location ?: "Location unavailable")
                            Hint("Signed in ${dateLabel(session.createdAt, saved)}")
                            session.lastActiveAt?.let { Hint("Last active ${dateLabel(it, saved)}") }
                            if (!session.current) Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                                Button(onClick = { revokeTarget = session }, enabled = !busy, shape = NexusButtonShape, colors = ButtonDefaults.buttonColors(containerColor = NexusColors.ErrorRed, contentColor = Color.White, disabledContainerColor = NexusColors.ErrorRed.copy(alpha = 0.5f), disabledContentColor = Color.White.copy(alpha = 0.7f))) { Text("Sign out", fontSize = 12.sp) }
                            }
                            HorizontalDivider(color = NexusColors.Border)
                        }
                    }
                    Button(onClick = { revokeAll = true }, enabled = !busy && settings.sessions.any { !it.current },
                        modifier = Modifier.fillMaxWidth(), shape = NexusButtonShape,
                        colors = ButtonDefaults.buttonColors(containerColor = NexusColors.ErrorRed, contentColor = Color.White,
                            disabledContainerColor = NexusColors.ErrorRed.copy(alpha = .5f), disabledContentColor = Color.White.copy(alpha = .7f))) {
                        Text("Sign out all other sessions", fontSize = 13.sp)
                    }
                    Hint("Your current session will stay signed in.")
                }
            }
            1 -> AccountCard {
                CardHeading("Notifications")
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) { Text("Workflow updates", color = ink, fontSize = 14.sp); Hint("Get notified about activity on your requests.") }
                    Switch(checked = draft.workflowNotifications, onCheckedChange = { draft = draft.copy(workflowNotifications = it) }, enabled = !busy)
                }
                Action(if (busy) "Saving..." else "Save notifications", { save(draft) }, !busy && draft != saved)
            }
            2 -> AccountCard {
                CardHeading("Date and time")
                Hint("Choose how dates and times appear in your account and notifications.")
                Selector("Time zone", draft.timeZone, (listOf(saved.timeZone, "Asia/Manila", "Asia/Shanghai", "Asia/Singapore", "Asia/Tokyo", "UTC", "America/New_York", "America/Los_Angeles", "Europe/London", "Australia/Sydney")).distinct(), !busy) { draft = draft.copy(timeZone = it) }
                Selector("Date format", draft.dateFormat, listOf("MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"), !busy) { draft = draft.copy(dateFormat = it) }
                Selector("Time format", draft.timeFormat, listOf("12h", "24h"), !busy) { draft = draft.copy(timeFormat = it) }
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    OutlinedButton(onClick = { draft = saved }, enabled = !busy && draft != saved, modifier = Modifier.weight(1f), shape = NexusButtonShape) { Text("Cancel") }
                    Button(onClick = { save(draft) }, enabled = !busy && draft != saved, modifier = Modifier.weight(1f), shape = NexusButtonShape, colors = ButtonDefaults.buttonColors(containerColor = blue)) { Text(if (busy) "Saving..." else "Save preferences", color = Color.White, fontSize = 12.sp) }
                }
            }
        }
        AccountCard {
            CardHeading("Account shortcuts")
            Shortcut(Icons.Outlined.Key, "Change password", "Update your account password.", password)
            Shortcut(Icons.Outlined.Devices, "Active sessions", "Manage your signed-in devices.") { tab = 0; sectionTarget = "sessions"; sectionRequest++ }
            Shortcut(Icons.Outlined.NotificationsNone, "Notification settings", "Change which updates you receive.") { tab = 1; sectionTarget = "notifications"; sectionRequest++ }
        }
        AccountCard {
            CardHeading(if (tab == 0) "Account protection" else "Your preferences")
            if (tab == 0) {
                Hint("Active sessions"); Text(settings.sessions.size.toString(), color = ink, fontSize = 13.sp)
                Hint("This session"); Text(settings.sessions.firstOrNull { it.current }?.device ?: "Unknown device", color = ink, fontSize = 13.sp)
                Hint("After changing your password, you can review and sign out other devices above.")
            } else {
                Hint("Time zone"); Text(draft.timeZone, color = ink, fontSize = 13.sp)
                Hint("Date format"); Text(draft.dateFormat, color = ink, fontSize = 13.sp)
                Hint("Time format"); Text(if (draft.timeFormat == "12h") "12-hour (AM/PM)" else "24-hour", color = ink, fontSize = 13.sp)
            }
        }
        if (tab == 2) AccountCard {
            CardHeading("Time preview")
            var now by remember { mutableStateOf(Clock.System.now()) }
            LaunchedEffect(Unit) { while (true) { now = Clock.System.now(); delay(1000) } }
            val local = now.toLocalDateTime(TimeZone.of(draft.timeZone))
            val hour = if (draft.timeFormat == "24h") local.hour else ((local.hour + 11) % 12 + 1)
            val suffix = if (draft.timeFormat == "12h") if (local.hour >= 12) " PM" else " AM" else ""
            Text("${hour.toString().padStart(2, '0')}:${local.minute.toString().padStart(2, '0')}$suffix", color = ink, fontSize = 26.sp, fontWeight = FontWeight.SemiBold)
            Hint(dateLabel(now.toString(), draft)); Hint(draft.timeZone)
        }
    }
    if (revokeTarget != null || revokeAll) NexusAlertDialog(
        onDismissRequest = { revokeTarget = null; revokeAll = false },
        title = { Text("Sign out ${if (revokeAll) "other sessions" else "this device"}?") },
        text = { Text("${revokeTarget?.device ?: "Other devices"} will need to sign in again. Your current session will stay signed in.") },
        confirmButton = { NexusDialogButton(destructive = true, onClick = { revoke(revokeTarget?.id); revokeTarget = null; revokeAll = false }) { Text("Sign out", maxLines = 1, softWrap = false) } },
        dismissButton = { NexusDialogButton(onClick = { revokeTarget = null; revokeAll = false }) { Text("Cancel") } }
    )
}
@Composable private fun Shortcut(icon: ImageVector, title: String, description: String, click: () -> Unit) {
    Row(Modifier.fillMaxWidth().clickable(onClick = click).padding(vertical = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Icon(icon, null, Modifier.size(18.dp), tint = muted)
        Column(Modifier.weight(1f)) { Text(title, fontSize = 13.sp, color = ink); Hint(description) }
        Icon(Icons.Outlined.ChevronRight, null, Modifier.size(16.dp), tint = muted)
    }
}
@Composable private fun Selector(label: String, value: String, values: List<String>, enabled: Boolean, change: (String) -> Unit) {
    fun display(item: String) = when (item) { "12h" -> "12-hour (AM/PM)"; "24h" -> "24-hour"; else -> item }
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(label, fontSize = 12.sp, color = ink)
        NexusDropdown(display(value), values.map { it to display(it) }, value, change, Modifier.fillMaxWidth(), enabled)
    }
}
internal fun dateLabel(value: String, preferences: Preferences): String = try {
    val date = Instant.parse(value).toLocalDateTime(TimeZone.of(preferences.timeZone)).date
    val month = date.monthNumber.toString().padStart(2, '0')
    val day = date.dayOfMonth.toString().padStart(2, '0')
    when (preferences.dateFormat) { "DD/MM/YYYY" -> "$day/$month/${date.year}"; "YYYY-MM-DD" -> "${date.year}-$month-$day"; else -> "$month/$day/${date.year}" }
} catch (_: IllegalArgumentException) { "Unavailable" }
