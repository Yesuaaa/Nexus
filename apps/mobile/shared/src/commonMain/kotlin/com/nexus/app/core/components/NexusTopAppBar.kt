package com.nexus.app.core.components

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.graphics.graphicsLayer
import org.jetbrains.compose.resources.painterResource
import nexusmobile.shared.generated.resources.Res
import nexusmobile.shared.generated.resources.exp_logo
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.AccountCircle
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nexus.app.core.theme.NexusColors

@Composable
fun NexusTopAppBar(
    modifier: Modifier = Modifier,
    onNotificationClick: () -> Unit = {},
    onProfileClick: () -> Unit = {},
    accountActionsEnabled: Boolean = true
) {
    val layout = LocalNexusLayout.current
    Row(
        modifier = modifier
            .fillMaxWidth()
            .statusBarsPadding()
            .padding(horizontal = layout.gutter, vertical = if (layout.short) 4.dp else 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Row(
            modifier = Modifier.weight(1f).padding(end = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Box(Modifier.width(80.dp).height(42.dp).clipToBounds()) {
                Image(
                    painterResource(Res.drawable.exp_logo),
                    contentDescription = "EXP Digital Solutions",
                    modifier = Modifier.fillMaxSize().graphicsLayer(scaleX = 2f, scaleY = 2f)
                )
            }
            Column(Modifier.weight(1f)) {
                Text(
                    text = "Digital Solutions",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = NexusColors.TextPrimary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    text = "CLIENT ACCESS",
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 1.sp,
                    color = NexusColors.PrimaryBlue,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }

        Row(
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(
                onClick = onNotificationClick,
                modifier = Modifier.size(48.dp)
            ) {
                Icon(
                    imageVector = Icons.Outlined.Notifications,
                    contentDescription = "Notifications",
                    tint = NexusColors.PrimaryBlue
                )
            }
            IconButton(
                onClick = onProfileClick,
                enabled = accountActionsEnabled,
                modifier = Modifier.size(48.dp)
            ) {
                Icon(
                    imageVector = Icons.Outlined.AccountCircle,
                    contentDescription = "Open profile",
                    tint = NexusColors.PrimaryBlue
                )
            }
        }
    }
}

