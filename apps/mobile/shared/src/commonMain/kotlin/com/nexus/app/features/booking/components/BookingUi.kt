package com.nexus.app.features.booking.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.WorkOutline
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.SubcomposeAsyncImage
import com.nexus.app.core.components.NexusDropdown
import com.nexus.app.core.network.ApiEndpoints
import com.nexus.app.core.theme.NexusColors

@Composable
fun PageHeading(title: String, description: String = "") {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(title, fontSize = 22.sp, lineHeight = 28.sp, fontWeight = FontWeight.SemiBold,
            color = NexusColors.HeaderDarkNavy)
        if (description.isNotEmpty()) Text(description, fontSize = 13.sp, lineHeight = 20.sp,
            color = NexusColors.TextSecondary)
    }
}

@Composable
fun BookingPanel(title: String, content: @Composable ColumnScope.() -> Unit) {
    Card(Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        border = androidx.compose.foundation.BorderStroke(1.dp, NexusColors.Border)) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(title, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = NexusColors.HeaderDarkNavy)
            content()
        }
    }
}

@Composable
fun InfoLine(label: String, value: String) {
    Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
        Text(label, fontSize = 11.sp, color = NexusColors.TextSecondary)
        Text(value.ifBlank { "Not provided" }, fontSize = 14.sp, color = NexusColors.TextPrimary)
    }
}

@Composable
fun BookingProgress(step: Int) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("STEP $step OF 4", fontSize = 11.sp, fontWeight = FontWeight.SemiBold,
            color = NexusColors.PrimaryBlue)
        LinearProgressIndicator(progress = { step / 4f }, modifier = Modifier.fillMaxWidth().height(4.dp),
            color = NexusColors.PrimaryBlue, trackColor = NexusColors.Border)
    }
}

@Composable
fun RetryNotice(message: String, onRetry: () -> Unit) {
    Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(message, fontSize = 13.sp, color = NexusColors.ErrorRed)
        OutlinedButton(onClick = onRetry) { Text("Retry") }
    }
}

@Composable
fun ServiceImage(url: String?, description: String?, modifier: Modifier = Modifier) {
    Box(modifier.background(NexusColors.SurfaceHover), contentAlignment = Alignment.Center) {
        if (url.isNullOrBlank()) {
            Icon(Icons.Outlined.WorkOutline, description, tint = NexusColors.PrimaryBlue,
                modifier = Modifier.size(32.dp))
        } else {
            SubcomposeAsyncImage(
                model = if (url.startsWith("/")) ApiEndpoints.DEFAULT_BASE_URL + url else url,
                contentDescription = description, contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize(),
                loading = { Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
                } },
                error = { Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Icon(Icons.Outlined.WorkOutline, "Image unavailable", tint = NexusColors.PrimaryBlue)
                } }
            )
        }
    }
}

@Composable
fun FilterMenu(label: String, options: List<Pair<String, String>>, enabled: Boolean = true, modifier: Modifier = Modifier,
    onSelect: (String) -> Unit) {
    NexusDropdown(label, options, options.firstOrNull { it.second == label }?.first, onSelect, modifier.widthIn(max = 240.dp), enabled)
}

@Composable
fun BookingContinueButton(
    onClick: () -> Unit,
    enabled: Boolean = true,
    modifier: Modifier = Modifier
) {
    Button(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier.heightIn(min = 44.dp),
        shape = RoundedCornerShape(6.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = NexusColors.PrimaryBlue,
            contentColor = Color.White,
            disabledContainerColor = NexusColors.PrimaryBlue.copy(alpha = 0.5f),
            disabledContentColor = Color.White
        )
    ) {
        Text("Continue  \u2192", color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Bold)
    }
}
