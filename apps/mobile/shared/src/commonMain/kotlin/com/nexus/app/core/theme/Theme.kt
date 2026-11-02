package com.nexus.app.core.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp

private val LightColorScheme = lightColorScheme(
    primary = NexusColors.PrimaryBlue,
    onPrimary = NexusColors.TextWhite,
    primaryContainer = NexusColors.SurfaceHover,
    onPrimaryContainer = NexusColors.PrimaryBlue,
    secondary = NexusColors.AccentCyan,
    onSecondary = NexusColors.TextWhite,
    background = NexusColors.Background,
    onBackground = NexusColors.TextPrimary,
    surface = NexusColors.Background,
    onSurface = NexusColors.TextPrimary,
    surfaceVariant = NexusColors.SurfaceLight,
    onSurfaceVariant = NexusColors.TextSecondary,
    outline = NexusColors.Border,
    error = NexusColors.ErrorRed
)

val NexusShapes = Shapes(
    small = RoundedCornerShape(8.dp),
    medium = RoundedCornerShape(12.dp),
    large = RoundedCornerShape(16.dp)
)

@Composable
fun NexusTheme(
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = LightColorScheme,
        typography = NexusTypography,
        shapes = NexusShapes,
        content = content
    )
}

