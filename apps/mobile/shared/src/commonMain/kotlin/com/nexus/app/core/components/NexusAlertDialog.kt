package com.nexus.app.core.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ProvideTextStyle
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nexus.app.core.theme.NexusButtonShape
import com.nexus.app.core.theme.NexusColors

@Composable
fun NexusAlertDialog(
    onDismissRequest: () -> Unit,
    title: @Composable () -> Unit,
    text: @Composable () -> Unit,
    confirmButton: @Composable () -> Unit,
    dismissButton: (@Composable () -> Unit)? = null
) {
    AlertDialog(
        onDismissRequest = onDismissRequest,
        title = title,
        text = text,
        shape = RoundedCornerShape(12.dp),
        containerColor = Color.White,
        tonalElevation = 0.dp,
        titleContentColor = NexusColors.TextPrimary,
        textContentColor = NexusColors.TextSecondary,
        confirmButton = {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                dismissButton?.let { dismiss -> Box(Modifier.weight(1f)) { dismiss() } }
                Box(Modifier.weight(1f)) { confirmButton() }
            }
        }
    )
}

@Composable
fun NexusDialogButton(
    onClick: () -> Unit,
    enabled: Boolean = true,
    destructive: Boolean = false,
    content: @Composable RowScope.() -> Unit
) {
    val fill = if (destructive) NexusColors.ErrorRed else NexusColors.PrimaryBlue
    Button(
        onClick = onClick,
        enabled = enabled,
        modifier = Modifier.fillMaxWidth().height(40.dp),
        shape = NexusButtonShape,
        contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = fill, contentColor = Color.White,
            disabledContainerColor = fill.copy(alpha = .5f),
            disabledContentColor = Color.White.copy(alpha = .7f)
        )
    ) {
        ProvideTextStyle(TextStyle(fontSize = 12.sp, lineHeight = 16.sp,
            fontWeight = FontWeight.SemiBold, textAlign = TextAlign.Center)) { content() }
    }
}
