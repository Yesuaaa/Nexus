package com.nexus.app.features.conversations.components

import com.nexus.app.core.theme.NexusButtonShape
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import coil3.compose.AsyncImage
import com.nexus.app.features.booking.model.SpecialistProfile

@Composable
fun SpecialistProfileSheet(profile: SpecialistProfile, department: String, onClose: () -> Unit, loading: Boolean = false, error: String? = null, onRetry: () -> Unit = {}) {
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
                    }
                }
                if (loading) LinearProgressIndicator(Modifier.fillMaxWidth().padding(horizontal = 20.dp), color = ConversationStyle.Navy)
                if (error != null) Column(Modifier.padding(20.dp)) {
                    Text(error, fontSize = 14.sp, lineHeight = 21.sp, color = ConversationStyle.Muted)
                    TextButton(shape = NexusButtonShape, onClick = onRetry) { Text("Try again", color = ConversationStyle.Navy) }
                }
                if (!loading && error == null) Column(Modifier.padding(horizontal = 20.dp), verticalArrangement = Arrangement.spacedBy(24.dp)) {
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
                            Surface(border = BorderStroke(1.dp, ConversationStyle.Divider), shape = RoundedCornerShape(8.dp)) {
                                Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                    project.thumbnailUrl?.let { AsyncImage(model = it, contentDescription = project.title, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxWidth().height(140.dp).clip(RoundedCornerShape(6.dp))) }
                                    Text(project.title, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = ConversationStyle.Ink)
                                    Text(project.summary, fontSize = 12.sp, lineHeight = 18.sp, color = ConversationStyle.Muted)
                                }
                            }
                        }
                    }
                    Spacer(Modifier.height(20.dp))
                }
            }
            HorizontalDivider(color = ConversationStyle.Divider)
            Column(Modifier.fillMaxWidth().padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                Text("View the specialist's background and featured work from your request conversation.", fontSize = 12.sp, lineHeight = 18.sp, color = ConversationStyle.Muted)
                OutlinedButton(onClick = onClose, modifier = Modifier.fillMaxWidth().height(48.dp), shape = NexusButtonShape, border = BorderStroke(1.dp, ConversationStyle.Border)) {
                    Text("Close profile", fontSize = 14.sp, color = ConversationStyle.Navy)
                }
            }
        }
    }
}
