package com.nexus.app.core.components

import com.nexus.app.core.theme.NexusButtonShape
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nexus.app.core.theme.NexusColors

enum class NexusButtonVariant {
    PRIMARY,
    OUTLINE
}

@Composable
fun NexusButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    variant: NexusButtonVariant = NexusButtonVariant.PRIMARY,
    enabled: Boolean = true,
    loading: Boolean = false,
    compact: Boolean = false
) {
    val buttonModifier = modifier
        .fillMaxWidth()
        .heightIn(min = if (compact) 40.dp else 48.dp)

    if (variant == NexusButtonVariant.PRIMARY) {
        Button(
            onClick = onClick,
            modifier = buttonModifier,
            enabled = enabled && !loading,
            shape = NexusButtonShape,
            colors = ButtonDefaults.buttonColors(
                containerColor = NexusColors.PrimaryBlue,
                contentColor = Color.White,
                disabledContainerColor = NexusColors.PrimaryBlue.copy(alpha = 0.5f),
                disabledContentColor = Color.White.copy(alpha = 0.7f)
            )
        ) {
            ButtonContent(text = text, loading = loading, textColor = Color.White, compact = compact)
        }
    } else {
        OutlinedButton(
            onClick = onClick,
            modifier = buttonModifier,
            enabled = enabled && !loading,
            shape = NexusButtonShape,
            border = BorderStroke(1.dp, NexusColors.PrimaryBlue.copy(alpha = if (enabled && !loading) 1f else 0.5f)),
            colors = ButtonDefaults.outlinedButtonColors(
                contentColor = NexusColors.PrimaryBlue
            )
        ) {
            ButtonContent(text = text, loading = loading, textColor = NexusColors.PrimaryBlue, compact = compact)
        }
    }
}

@Composable
private fun ButtonContent(
    text: String,
    loading: Boolean,
    textColor: Color,
    compact: Boolean
) {
    Box(contentAlignment = Alignment.Center) {
        if (loading) {
            CircularProgressIndicator(
                modifier = Modifier.size(20.dp),
                color = textColor,
                strokeWidth = 2.dp
            )
        } else {
            Text(
                text = text,
                fontSize = if (compact) 13.sp else 15.sp,
                fontWeight = FontWeight.SemiBold,
                color = textColor
            )
        }
    }
}

