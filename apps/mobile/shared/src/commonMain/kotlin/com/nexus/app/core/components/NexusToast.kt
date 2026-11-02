package com.nexus.app.core.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateContentSize
import androidx.compose.animation.core.MutableTransitionState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalAccessibilityManager
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay

enum class ToastKind { SUCCESS, ERROR, INFO }

data class NexusToast(val id: Long, val title: String, val description: String, val kind: ToastKind)

class NexusToastState {
    var current by mutableStateOf<NexusToast?>(null)
        private set
    private var sequence = 0L

    fun show(title: String, description: String = "", kind: ToastKind = ToastKind.INFO) {
        current = NexusToast(++sequence, title, description, kind)
    }

    fun dismiss() { current = null }
}

val LocalNexusToast = staticCompositionLocalOf<NexusToastState> {
    error("NexusFeedback must wrap the app")
}

@Composable
fun NexusFeedback(content: @Composable () -> Unit) {
    val state = remember { NexusToastState() }
    val incoming = state.current
    // Retain the card until its exit transition finishes.
    var displayed by remember { mutableStateOf<NexusToast?>(null) }
    var expanded by remember { mutableStateOf(false) }
    val visibility = remember { MutableTransitionState(false) }
    val accessibility = LocalAccessibilityManager.current

    LaunchedEffect(incoming?.id) {
        if (incoming == null) {
            expanded = false
            delay(180)
            visibility.targetState = false
        } else {
            displayed = incoming
            expanded = false
            visibility.targetState = true
            delay(150)
            expanded = true
            val duration = accessibility?.calculateRecommendedTimeoutMillis(
                originalTimeoutMillis = if (incoming.kind == ToastKind.ERROR) 6000L else 4000L,
                containsIcons = true,
                containsText = true,
                containsControls = true
            ) ?: 6000L
            delay(duration)
            if (state.current?.id == incoming.id) state.dismiss()
        }
    }
    LaunchedEffect(visibility.isIdle, visibility.currentState, incoming?.id) {
        if (visibility.isIdle && !visibility.currentState && incoming == null) displayed = null
    }

    CompositionLocalProvider(LocalNexusToast provides state) {
        Box(Modifier.fillMaxSize()) {
            content()
            AnimatedVisibility(
                visibleState = visibility,
                enter = fadeIn(tween(180)) +
                    slideInVertically(spring(dampingRatio = 0.8f, stiffness = 450f)) { -it / 3 } +
                    scaleIn(spring(dampingRatio = 0.75f, stiffness = 450f), initialScale = 0.9f),
                exit = fadeOut(tween(160)) +
                    slideOutVertically(tween(200)) { -it / 3 } +
                    scaleOut(tween(200), targetScale = 0.9f),
                // Keep the language label and portal header unobstructed.
                modifier = Modifier.align(Alignment.TopCenter).statusBarsPadding()
                    .padding(start = 16.dp, end = 16.dp, top = 72.dp)
            ) {
                displayed?.let { toast ->
                    BoxWithConstraints(
                        Modifier.widthIn(max = 350.dp).fillMaxWidth(),
                        contentAlignment = Alignment.TopCenter
                    ) {
                        val cardWidth = maxWidth
                        Surface(
                            modifier = Modifier.animateContentSize(
                                animationSpec = spring(dampingRatio = 0.8f, stiffness = 450f),
                                alignment = Alignment.TopCenter
                            ).semantics { liveRegion = LiveRegionMode.Polite },
                            shape = RoundedCornerShape(20.dp),
                            color = Color(0xFF253F8C),
                            shadowElevation = 8.dp
                        ) {
                            Column {
                                Row(
                                    Modifier.then(if (expanded) Modifier.width(cardWidth) else Modifier)
                                        .padding(start = 14.dp, end = 2.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                                ) {
                                    Icon(
                                        imageVector = when (toast.kind) {
                                            ToastKind.SUCCESS -> Icons.Outlined.CheckCircle
                                            ToastKind.ERROR -> Icons.Outlined.ErrorOutline
                                            ToastKind.INFO -> Icons.Outlined.Info
                                        },
                                        contentDescription = null,
                                        tint = when (toast.kind) {
                                            ToastKind.SUCCESS -> Color(0xFF86EFAC)
                                            ToastKind.ERROR -> Color(0xFFFDA4AF)
                                            ToastKind.INFO -> Color(0xFF93C5FD)
                                        },
                                        modifier = Modifier.size(24.dp)
                                    )
                                    Text(
                                        toast.title, color = Color.White, fontSize = 14.sp,
                                        fontWeight = FontWeight.Bold,
                                        modifier = if (expanded) Modifier.weight(1f) else
                                            Modifier.widthIn(max = (cardWidth - 108.dp).coerceAtLeast(0.dp))
                                    )
                                    IconButton(onClick = state::dismiss) {
                                        Icon(Icons.Outlined.Close, contentDescription = "Dismiss notification", tint = Color.White)
                                    }
                                }
                                AnimatedVisibility(
                                    visible = expanded && toast.description.isNotBlank(),
                                    enter = expandVertically(
                                        spring(dampingRatio = 0.8f, stiffness = 450f),
                                        expandFrom = Alignment.Top
                                    ) + fadeIn(tween(220, delayMillis = 80)),
                                    exit = shrinkVertically(tween(160), shrinkTowards = Alignment.Top) + fadeOut(tween(100))
                                ) {
                                    Text(
                                        toast.description, color = Color(0xFFD4E0F8), fontSize = 13.sp,
                                        modifier = Modifier.width(cardWidth).padding(start = 16.dp, end = 16.dp, bottom = 16.dp)
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
