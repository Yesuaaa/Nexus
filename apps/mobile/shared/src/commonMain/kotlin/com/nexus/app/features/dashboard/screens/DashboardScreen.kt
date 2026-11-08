package com.nexus.app.features.dashboard.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nexus.app.core.theme.NexusColors
import com.nexus.app.core.components.LocalNexusLayout

@Composable
fun DashboardScreen(
    modifier: Modifier = Modifier
) {
    val layout = LocalNexusLayout.current
    Column(
        modifier = modifier
            .fillMaxSize()
            .background(androidx.compose.ui.graphics.Color(0xFFF7F8FA))
            .verticalScroll(rememberScrollState())
            .padding(horizontal = layout.gutter, vertical = layout.gap),
        verticalArrangement = Arrangement.spacedBy(layout.gap)
    ) {
        Text(
            text = "Dashboard",
            fontSize = 22.sp,
            fontWeight = FontWeight.SemiBold,
            color = NexusColors.HeaderDarkNavy
        )

    }
}
