package com.nexus.app.features.projects.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nexus.app.core.components.*
import com.nexus.app.core.theme.NexusColors
import com.nexus.app.features.projects.model.*
import com.nexus.app.features.projects.viewmodel.ProjectsState

@Composable
internal fun ProjectPage(content: @Composable ColumnScope.() -> Unit) {
    Column(Modifier.fillMaxSize().background(NexusColors.SurfaceLight).imePadding()
        .verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(18.dp), content = content)
}
@Composable
internal fun ProjectCard(content: @Composable ColumnScope.() -> Unit) {
    Surface(Modifier.fillMaxWidth(), shape = RoundedCornerShape(8.dp), color = Color.White, border = BorderStroke(1.dp, NexusColors.Border)) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp), content = content)
    }
}
@Composable
internal fun ProjectHeading(text: String) { Text(text, fontSize = 22.sp, fontWeight = FontWeight.SemiBold, color = NexusColors.TextPrimary) }
@Composable
internal fun ProjectTitle(text: String) { Text(text, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = NexusColors.TextPrimary) }
@Composable
internal fun ProjectCopy(text: String) { Text(text, fontSize = 13.sp, lineHeight = 20.sp, color = NexusColors.TextSecondary) }
@Composable
internal fun ProjectField(label: String, value: String) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(label, fontSize = 11.sp, color = NexusColors.TextSecondary)
        Text(value, fontSize = 14.sp, color = NexusColors.TextPrimary)
    }
}
@Composable
internal fun ProjectStatus(status: String) {
    val active = status in setOf("IN_PROGRESS", "ON_HOLD", "PENDING")
    Surface(color = if (active) NexusColors.StatusPendingBg else NexusColors.SurfaceHover, shape = RoundedCornerShape(4.dp)) {
        Text(statusLabel(status), Modifier.padding(horizontal = 10.dp, vertical = 5.dp), fontSize = 11.sp,
            color = if (active) NexusColors.StatusPendingText else NexusColors.PrimaryBlue)
    }
}
@Composable
internal fun ProjectProgressBar(completed: Int, total: Int) {
    val fraction = progressFraction(completed, total)
    Surface(color = NexusColors.SurfaceLight, shape = RoundedCornerShape(8.dp), border = BorderStroke(1.dp, NexusColors.Border)) {
        Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("Overall progress", fontSize = 12.sp, color = NexusColors.TextPrimary)
                Text("${(fraction * 100).toInt()}%", fontSize = 12.sp, color = NexusColors.PrimaryBlue)
            }
            LinearProgressIndicator(progress = { fraction }, modifier = Modifier.fillMaxWidth().height(5.dp), color = NexusColors.PrimaryBlue, trackColor = NexusColors.Border)
            ProjectCopy("$completed of $total tasks complete")
        }
    }
}
@Composable
internal fun ProjectFeedback(state: ProjectsState, retry: () -> Unit) {
    if (state.loading) LinearProgressIndicator(Modifier.fillMaxWidth(), color = NexusColors.PrimaryBlue)
    state.error?.let { error ->
        ProjectCard {
            Text(error, color = NexusColors.ErrorRed, fontSize = 13.sp)
            TextButton(onClick = retry, enabled = !state.loading && !state.saving) { Text("Retry") }
        }
    }
}
@Composable
internal fun ProjectBack(label: String, onBack: () -> Unit, enabled: Boolean = true) {
    TextButton(onClick = onBack, enabled = enabled, contentPadding = PaddingValues(0.dp)) { Text("←  $label", fontSize = 13.sp, color = NexusColors.PrimaryBlue) }
}

@Composable
internal fun ProjectTextArea(value: String, onValueChange: (String) -> Unit, label: String,
    placeholder: String = "", enabled: Boolean = true, isError: Boolean = false) {
    OutlinedTextField(value, onValueChange, Modifier.fillMaxWidth(), label = { Text(label, fontSize = 13.sp) },
        placeholder = { Text(placeholder, fontSize = 13.sp) }, enabled = enabled, isError = isError,
        minLines = 8, maxLines = 18, shape = RoundedCornerShape(8.dp),
        colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = NexusColors.PrimaryBlue,
            unfocusedBorderColor = NexusColors.Border, focusedContainerColor = Color.White, unfocusedContainerColor = Color.White))
}

/** Reload on returning from an editor or another app, without replacing local form drafts. */
@Composable
internal fun ProjectLoadEffect(key: String, load: () -> Unit) {
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    val currentLoad by rememberUpdatedState(load)
    LaunchedEffect(key, lifecycle) {
        lifecycle.repeatOnLifecycle(Lifecycle.State.RESUMED) { currentLoad() }
    }
}
