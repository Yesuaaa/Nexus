package com.nexus.app.core.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.progressBarRangeInfo
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.nexus.app.core.theme.NexusColors

@Composable
fun NexusProgressBar(progress: Float, modifier: Modifier = Modifier) {
    val fraction = progress.coerceIn(0f, 1f)
    Box(modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(3.dp))
        .background(Color(0xFF94A9CF))
        .semantics { progressBarRangeInfo = ProgressBarRangeInfo(fraction, 0f..1f) }) {
        Box(Modifier.fillMaxWidth(fraction).fillMaxHeight().background(NexusColors.PrimaryBlue))
    }
}
