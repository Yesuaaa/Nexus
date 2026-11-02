package com.nexus.app.features.booked_requests.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nexus.app.core.components.KpiCard
import com.nexus.app.core.components.NexusButton
import com.nexus.app.core.components.StatusBadge
import com.nexus.app.core.theme.NexusColors

@Composable
fun BookedRequestsScreen(
    onNewRequestClick: () -> Unit = {},
    onRequestClick: (String) -> Unit = {},
    modifier: Modifier = Modifier
) {
    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .background(NexusColors.Background)
            .padding(horizontal = 20.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(
                    text = "Booked Requests",
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Bold,
                    color = NexusColors.HeaderDarkNavy
                )
                Text(
                    text = "Track your requests, review project details, and follow their progress.",
                    fontSize = 13.sp,
                    color = NexusColors.TextSecondary
                )
            }
        }

        item {
            NexusButton(
                text = "+ New Service Request",
                onClick = onNewRequestClick
            )
        }

        // 4 KPI Counters Row
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                KpiCard(count = 7, label = "Total Requests", modifier = Modifier.weight(1f))
                KpiCard(count = 1, label = "Pending Review", modifier = Modifier.weight(1f))
                KpiCard(count = 5, label = "In Review", modifier = Modifier.weight(1f))
                KpiCard(count = 0, label = "Closed", modifier = Modifier.weight(1f))
            }
        }

        // Sample Request Cards matching Figma
        item {
            RequestCard(
                title = "Lil Max request",
                subtitle = "Lil Max · Premium",
                status = "PENDING",
                date = "Nov 1, 2026",
                onClick = { onRequestClick("1") }
            )
        }

        item {
            RequestCard(
                title = "Lil Max request",
                subtitle = "Lil Max · Standard service",
                status = "UNDER_REVIEW",
                date = "Nov 1, 2026",
                onClick = { onRequestClick("2") }
            )
        }
    }
}

@Composable
private fun RequestCard(
    title: String,
    subtitle: String,
    status: String,
    date: String,
    onClick: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(NexusColors.Background)
            .border(width = 1.dp, color = NexusColors.Border, shape = RoundedCornerShape(12.dp))
            .clickable(onClick = onClick)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(
                    text = title,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                    color = NexusColors.TextPrimary
                )
                Text(
                    text = subtitle,
                    fontSize = 12.sp,
                    color = NexusColors.TextSecondary
                )
            }

            Text(
                text = "View",
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = NexusColors.PrimaryBlue
            )
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            StatusBadge(status = status)
            Text(
                text = date,
                fontSize = 12.sp,
                color = NexusColors.TextMuted
            )
        }
    }
}

