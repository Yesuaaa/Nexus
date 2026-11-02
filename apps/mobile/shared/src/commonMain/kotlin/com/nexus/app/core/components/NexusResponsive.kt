package com.nexus.app.core.components

import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

data class NexusLayout(val narrow: Boolean = false, val short: Boolean = false) {
    val gutter: Dp get() = if (narrow || short) 16.dp else 24.dp
    val gap: Dp get() = if (narrow || short) 12.dp else 16.dp
}

val LocalNexusLayout = staticCompositionLocalOf { NexusLayout() }

@Composable
fun NexusResponsive(content: @Composable () -> Unit) {
    BoxWithConstraints(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing.only(WindowInsetsSides.Horizontal))) {
        CompositionLocalProvider(
            LocalNexusLayout provides NexusLayout(maxWidth < 360.dp, maxHeight < 600.dp)
        ) {
            content()
        }
    }
}
