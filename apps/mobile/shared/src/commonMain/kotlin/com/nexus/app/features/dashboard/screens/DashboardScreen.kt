package com.nexus.app.features.dashboard.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nexus.app.core.components.LocalNexusBottomPadding
import com.nexus.app.core.components.LocalNexusLayout
import com.nexus.app.core.components.NexusButton
import com.nexus.app.core.components.NexusButtonVariant
import com.nexus.app.core.theme.NexusColors

@Composable
fun DashboardScreen(
    modifier: Modifier = Modifier,
    onServices: () -> Unit = {},
    onRequests: () -> Unit = {},
    onProjects: () -> Unit = {},
    onCalendar: () -> Unit = {},
) {
    val layout = LocalNexusLayout.current
    Column(
        modifier = modifier
            .fillMaxSize()
            .background(NexusColors.SurfaceLight)
            .verticalScroll(rememberScrollState())
            .padding(horizontal = layout.gutter, vertical = layout.gap)
            .padding(bottom = LocalNexusBottomPadding.current),
        verticalArrangement = Arrangement.spacedBy(layout.gap)
    ) {
        Text("Access your services, requests, projects, and calendar from the navigation menu.",
            fontSize = 14.sp, lineHeight = 21.sp, color = NexusColors.TextSecondary)
        DashboardShortcut("Services", "Explore services and book a consultation with the EXP team.", "Browse services", onServices)
        DashboardShortcut("Booked requests", "Track your requests and review updates from your department.", "View requests", onRequests)
        DashboardShortcut("My projects", "Follow project progress and review shared deliverables.", "View projects", onProjects)
        DashboardShortcut("Calendar", "See upcoming consultations, meetings, and project milestones.", "Open calendar", onCalendar)
    }
}

@Composable
private fun DashboardShortcut(title: String, description: String, action: String, onClick: () -> Unit) {
    Card(Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = NexusColors.Background),
        border = BorderStroke(1.dp, NexusColors.Border)) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(title, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = NexusColors.HeaderDarkNavy)
            Text(description, fontSize = 13.sp, lineHeight = 20.sp, color = NexusColors.TextSecondary)
            NexusButton(action, onClick, variant = NexusButtonVariant.OUTLINE, compact = true)
        }
    }
}
