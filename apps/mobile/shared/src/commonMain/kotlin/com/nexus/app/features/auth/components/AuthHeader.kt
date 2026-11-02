package com.nexus.app.features.auth.components

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nexus.app.core.theme.NexusColors

@Composable
fun AuthHeader() {
    Box(
        modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp),
        contentAlignment = Alignment.CenterStart
    ) {
        Text("English", fontSize = 12.sp, color = NexusColors.TextSecondary)
    }
}
