package com.nexus.app.core.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp
import androidx.compose.ui.text.font.FontFamily
import org.jetbrains.compose.resources.Font
import nexusmobile.shared.generated.resources.Res
import nexusmobile.shared.generated.resources.inter

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
    val inter = FontFamily(Font(Res.font.inter))
    val typography = NexusTypography.copy(
        headlineLarge = NexusTypography.headlineLarge.copy(fontFamily = inter),
        headlineMedium = NexusTypography.headlineMedium.copy(fontFamily = inter),
        titleLarge = NexusTypography.titleLarge.copy(fontFamily = inter),
        titleMedium = NexusTypography.titleMedium.copy(fontFamily = inter),
        titleSmall = NexusTypography.titleSmall.copy(fontFamily = inter),
        bodyLarge = NexusTypography.bodyLarge.copy(fontFamily = inter),
        bodyMedium = NexusTypography.bodyMedium.copy(fontFamily = inter),
        bodySmall = NexusTypography.bodySmall.copy(fontFamily = inter),
        labelLarge = NexusTypography.labelLarge.copy(fontFamily = inter),
        labelMedium = NexusTypography.labelMedium.copy(fontFamily = inter),
        labelSmall = NexusTypography.labelSmall.copy(fontFamily = inter)
    )
    MaterialTheme(
        colorScheme = LightColorScheme,
        typography = typography,
        shapes = NexusShapes,
        content = content
    )
}

