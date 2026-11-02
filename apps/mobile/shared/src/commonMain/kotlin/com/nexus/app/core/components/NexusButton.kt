package com.nexus.app.core.components

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
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
    loading: Boolean = false
) {
    val buttonModifier = modifier
        .fillMaxWidth()
        .heightIn(min = 48.dp)

    val shape = RoundedCornerShape(10.dp)

    if (variant == NexusButtonVariant.PRIMARY) {
        Button(
            onClick = onClick,
            modifier = buttonModifier,
            enabled = enabled && !loading,
            shape = shape,
            colors = ButtonDefaults.buttonColors(
                containerColor = NexusColors.PrimaryBlue,
                contentColor = Color.White,
                disabledContainerColor = NexusColors.PrimaryBlue.copy(alpha = 0.5f),
                disabledContentColor = Color.White.copy(alpha = 0.7f)
            )
        ) {
            ButtonContent(text = text, loading = loading, textColor = Color.White)
        }
    } else {
        OutlinedButton(
            onClick = onClick,
            modifier = buttonModifier,
            enabled = enabled && !loading,
            shape = shape,
            colors = ButtonDefaults.outlinedButtonColors(
                contentColor = NexusColors.PrimaryBlue
            )
        ) {
            ButtonContent(text = text, loading = loading, textColor = NexusColors.PrimaryBlue)
        }
    }
}

@Composable
private fun ButtonContent(
    text: String,
    loading: Boolean,
    textColor: Color
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
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                color = textColor
            )
        }
    }
}

