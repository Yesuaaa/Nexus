package com.nexus.app.features.dashboard.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
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
    ) {}
}
