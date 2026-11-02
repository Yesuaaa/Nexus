package com.nexus.app.core.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nexus.app.core.theme.NexusColors

@Composable
fun StatusBadge(
    status: String,
    modifier: Modifier = Modifier
) {
    val (bg, text, label) = when (status.uppercase()) {
        "SUBMITTED", "PENDING", "PENDING_REVIEW" -> Triple(
            NexusColors.StatusPendingBg,
            NexusColors.StatusPendingText,
            "Pending review"
        )
        "UNDER_REVIEW", "IN_REVIEW", "AWAITING_CLIENT_INFO", "READY_FOR_QUOTATION" -> Triple(
            NexusColors.StatusReviewBg,
            NexusColors.StatusReviewText,
            "Under review"
        )
        "CLOSED", "COMPLETED" -> Triple(
            NexusColors.StatusClosedBg,
            NexusColors.StatusClosedText,
            "Closed"
        )
        "CANCELLED" -> Triple(
            NexusColors.StatusCancelledBg,
            NexusColors.StatusCancelledText,
            "Cancelled"
        )
        else -> Triple(
            NexusColors.SurfaceLight,
            NexusColors.TextSecondary,
            status
        )
    }

    Box(
        modifier = modifier
            .clip(RoundedCornerShape(6.dp))
            .background(bg)
            .padding(horizontal = 10.dp, vertical = 4.dp)
    ) {
        Text(
            text = label,
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            color = text
        )
    }
}

