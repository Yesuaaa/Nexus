package com.nexus.app.features.conversations.components

import com.nexus.app.core.theme.NexusButtonShape
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.OpenInNew
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import coil3.compose.AsyncImage
import com.nexus.app.features.booking.model.SpecialistProfile
import com.nexus.app.features.booking.model.SpecialistProject
import io.ktor.http.URLProtocol
import io.ktor.http.Url

private fun safeHttpsUrl(value: String?): String? {
    val trimmed = value?.trim()?.takeIf { it.isNotEmpty() && it.startsWith("https://", ignoreCase = true) } ?: return null
    return runCatching {
        val url = Url(trimmed)
        if (url.protocol == URLProtocol.HTTPS && url.host.isNotBlank() && url.user.isNullOrEmpty() && url.password.isNullOrEmpty()) {
            url.toString()
        } else null
    }.getOrNull()
}

@Composable
fun SpecialistProfileSheet(
    profile: SpecialistProfile,
    department: String,
    onClose: () -> Unit,
    loading: Boolean = false,
    error: String? = null,
    onRetry: () -> Unit = {},
    allowSelection: Boolean = false,
    selected: Boolean = false,
    onChoose: (() -> Unit)? = null,
) {
    val uriHandler = LocalUriHandler.current
    var activeProject by remember(profile.id) { mutableStateOf<SpecialistProject?>(null) }
    val validSocialLinks = remember(profile.socialLinks) {
        profile.socialLinks.mapNotNull { link ->
            safeHttpsUrl(link.url)?.let { link.copy(url = it) }
        }
    }
    val firstName = profile.fullName.trim().split(Regex("\\s+")).firstOrNull()?.takeIf { it.isNotBlank() } ?: profile.fullName

    Dialog(onDismissRequest = onClose, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Column(Modifier.fillMaxSize().background(Color.White).systemBarsPadding()) {
            Column(Modifier.weight(1f).verticalScroll(rememberScrollState())) {
                Box(Modifier.fillMaxWidth().height(148.dp).background(ConversationStyle.Navy)) {
                    profile.bannerUrl?.let { AsyncImage(model = it, contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize()) }
                    Row(Modifier.fillMaxWidth().padding(start = 20.dp, end = 16.dp, top = 16.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text("SPECIALIST PROFILE", Modifier.weight(1f), color = Color.White, fontSize = 11.sp, letterSpacing = 1.3.sp, fontWeight = FontWeight.SemiBold)
                        IconButton(onClick = onClose, modifier = Modifier.size(44.dp).clip(CircleShape).background(Color.Black.copy(alpha = .14f))) { Icon(Icons.Outlined.Close, "Close profile", Modifier.size(20.dp), tint = Color.White) }
                    }
                }
                Box(Modifier.fillMaxWidth()) {
                    ChatAvatar(profile.fullName, profile.imageUrl, Modifier.padding(start = 20.dp).offset(y = (-40).dp).size(88.dp).border(4.dp, Color.White, CircleShape))
                    Column(Modifier.padding(start = 20.dp, end = 20.dp, top = 56.dp, bottom = 28.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Text(profile.fullName, fontSize = 22.sp, lineHeight = 28.sp, fontWeight = FontWeight.SemiBold, color = ConversationStyle.Ink)
                        Text(profile.position ?: "Specialist", fontSize = 14.sp, color = ConversationStyle.Muted)
                        Surface(color = ConversationStyle.Notice, shape = RoundedCornerShape(4.dp)) {
                            Text(profile.department?.name ?: department, Modifier.padding(horizontal = 8.dp, vertical = 4.dp), fontSize = 11.sp, color = ConversationStyle.Navy)
                        }
                        if (validSocialLinks.isNotEmpty()) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                                modifier = Modifier.fillMaxWidth(),
                            ) {
                                Text("Socials:", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = ConversationStyle.Muted)
                                validSocialLinks.forEach { link ->
                                    TextButton(
                                        onClick = { runCatching { uriHandler.openUri(link.url) } },
                                        shape = NexusButtonShape,
                                        contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp),
                                    ) {
                                        Text("${link.platform} profile", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = ConversationStyle.Navy)
                                        Spacer(Modifier.width(4.dp))
                                        Icon(Icons.Outlined.OpenInNew, null, Modifier.size(14.dp), tint = ConversationStyle.Navy)
                                    }
                                }
                            }
                        }
                    }
                }
                if (loading) LinearProgressIndicator(Modifier.fillMaxWidth().padding(horizontal = 20.dp), color = ConversationStyle.Navy)
                if (error != null) Column(Modifier.padding(20.dp)) {
                    Text(error, fontSize = 14.sp, lineHeight = 21.sp, color = ConversationStyle.Muted)
                    TextButton(shape = NexusButtonShape, onClick = onRetry) { Text("Try again", color = ConversationStyle.Navy) }
                }
                if (!loading && error == null) {
                    val selectedProject = activeProject
                    if (selectedProject != null) {
                        Column(Modifier.padding(horizontal = 20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                            TextButton(
                                onClick = { activeProject = null },
                                shape = NexusButtonShape,
                                contentPadding = PaddingValues(0.dp),
                            ) {
                                Icon(Icons.AutoMirrored.Outlined.ArrowBack, null, Modifier.size(16.dp), tint = ConversationStyle.Navy)
                                Spacer(Modifier.width(6.dp))
                                Text("Back to profile", fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = ConversationStyle.Navy)
                            }
                            selectedProject.thumbnailUrl?.let {
                                AsyncImage(
                                    model = it,
                                    contentDescription = selectedProject.title,
                                    contentScale = ContentScale.Crop,
                                    modifier = Modifier.fillMaxWidth().height(200.dp).clip(RoundedCornerShape(8.dp)),
                                )
                            }
                            Text(selectedProject.title, fontSize = 20.sp, fontWeight = FontWeight.Bold, color = ConversationStyle.Ink)
                            Text(
                                selectedProject.summary.ifBlank { "No project summary provided." },
                                fontSize = 14.sp,
                                lineHeight = 21.sp,
                                color = ConversationStyle.Muted,
                            )
                            if (selectedProject.contribution.isNotBlank()) {
                                Surface(color = ConversationStyle.Background, shape = RoundedCornerShape(8.dp)) {
                                    Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                        Text("CONTRIBUTION", fontSize = 11.sp, letterSpacing = 1.sp, fontWeight = FontWeight.Bold, color = ConversationStyle.Muted)
                                        Text(selectedProject.contribution, fontSize = 14.sp, lineHeight = 21.sp, color = ConversationStyle.Ink)
                                    }
                                }
                            }
                            safeHttpsUrl(selectedProject.projectUrl)?.let { projectUrl ->
                                OutlinedButton(
                                    onClick = { runCatching { uriHandler.openUri(projectUrl) } },
                                    shape = NexusButtonShape,
                                    border = BorderStroke(1.dp, ConversationStyle.Border),
                                ) {
                                    Text("View project", fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = ConversationStyle.Navy)
                                    Spacer(Modifier.width(6.dp))
                                    Icon(Icons.Outlined.OpenInNew, null, Modifier.size(16.dp), tint = ConversationStyle.Navy)
                                }
                            }
                            Spacer(Modifier.height(20.dp))
                        }
                    } else {
                        Column(Modifier.padding(horizontal = 20.dp), verticalArrangement = Arrangement.spacedBy(24.dp)) {
                            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                Text("ABOUT", fontSize = 11.sp, letterSpacing = 1.sp, color = ConversationStyle.Muted)
                                Text(profile.bio?.takeIf { it.isNotBlank() } ?: "No biography has been added yet.", fontSize = 14.sp, lineHeight = 21.sp, color = ConversationStyle.Muted)
                            }
                            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                Text("SPECIALTIES", fontSize = 11.sp, letterSpacing = 1.sp, color = ConversationStyle.Muted)
                                Text(profile.specialties.takeIf { it.isNotEmpty() }?.joinToString(", ") ?: "No specialties listed.", fontSize = 14.sp, lineHeight = 21.sp, color = ConversationStyle.Muted)
                            }
                            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                Text("Featured projects", fontSize = 16.sp, lineHeight = 24.sp, fontWeight = FontWeight.SemiBold, color = ConversationStyle.Ink)
                                if (profile.projects.isEmpty()) Surface(color = ConversationStyle.Background, border = BorderStroke(1.dp, ConversationStyle.Divider), shape = RoundedCornerShape(8.dp)) {
                                    Box(Modifier.fillMaxWidth().heightIn(min = 132.dp).padding(16.dp), contentAlignment = Alignment.CenterStart) {
                                        Text("No featured projects have been added yet.", fontSize = 14.sp, lineHeight = 21.sp, color = ConversationStyle.Muted)
                                    }
                                }
                                profile.projects.forEach { project ->
                                    Surface(
                                        modifier = Modifier.fillMaxWidth().clickable { activeProject = project },
                                        border = BorderStroke(1.dp, ConversationStyle.Divider),
                                        shape = RoundedCornerShape(8.dp),
                                    ) {
                                        Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                            project.thumbnailUrl?.let { AsyncImage(model = it, contentDescription = project.title, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxWidth().height(140.dp).clip(RoundedCornerShape(6.dp))) }
                                            Text(project.title, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = ConversationStyle.Ink)
                                            Text(project.summary.ifBlank { "Project details available in the full view." }, fontSize = 12.sp, lineHeight = 18.sp, color = ConversationStyle.Muted)
                                            Text("View project →", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = ConversationStyle.Navy)
                                        }
                                    }
                                }
                            }
                            Spacer(Modifier.height(20.dp))
                        }
                    }
                }
            }
            HorizontalDivider(color = ConversationStyle.Divider)
            Column(Modifier.fillMaxWidth().padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(
                    if (allowSelection) "Availability and project fit are reviewed by the department before a specialist is confirmed."
                    else "View the specialist's background and featured work from your request conversation.",
                    fontSize = 12.sp,
                    lineHeight = 18.sp,
                    color = ConversationStyle.Muted,
                )
                if (allowSelection && activeProject == null) {
                    Button(
                        onClick = { onChoose?.invoke(); onClose() },
                        enabled = !loading && error == null && !selected,
                        modifier = Modifier.fillMaxWidth().height(42.dp),
                        shape = NexusButtonShape,
                        colors = ButtonDefaults.buttonColors(containerColor = ConversationStyle.Navy, contentColor = Color.White),
                    ) {
                        Text(
                            if (selected) "Selected as preferred specialist"
                            else "Choose $firstName as preferred specialist",
                            fontSize = 13.sp,
                        )
                    }
                }
                OutlinedButton(onClick = onClose, modifier = Modifier.fillMaxWidth().height(40.dp), shape = NexusButtonShape, border = BorderStroke(1.dp, ConversationStyle.Border)) {
                    Text("Close profile", fontSize = 14.sp, color = ConversationStyle.Navy)
                }
            }
        }
    }
}
