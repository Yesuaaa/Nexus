package com.nexus.app.core.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
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
import androidx.compose.material.icons.outlined.ChatBubbleOutline
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.PersonOutline
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.material3.*
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material.icons.automirrored.outlined.ReceiptLong
import androidx.compose.material.icons.automirrored.outlined.Logout
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nexus.app.core.theme.NexusColors

@Composable
fun NexusTopAppBar(
    title: String,
    modifier: Modifier = Modifier,
    onNotificationClick: () -> Unit = {},
    onChatClick: () -> Unit = {},
    onProfileClick: () -> Unit = {},
    notificationUnread: Int = 0,
    accountActionsEnabled: Boolean = true,
    onSettingsClick: () -> Unit = {},
    onBillingLogsClick: () -> Unit = {},
    onLogoutClick: () -> Unit = {},
    accountName: String = "Your account",
    accountEmail: String = "",
    accountPageOpen: Boolean = false,
    onCloseAccountPage: () -> Unit = {},
    onAccountMenuChange: (Boolean) -> Unit = {}
) {
    var accountMenu by remember { mutableStateOf(false) }
    LaunchedEffect(accountMenu) { onAccountMenuChange(accountMenu) }
    DisposableEffect(Unit) { onDispose { onAccountMenuChange(false) } }
    Column(modifier.fillMaxWidth().background(Color.White).statusBarsPadding()) {
        Row(
            modifier = Modifier.fillMaxWidth().height(63.dp).padding(start = 20.dp, end = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                text = title,
                modifier = Modifier.weight(1f).padding(end = 8.dp),
                fontSize = 22.sp,
                lineHeight = 28.sp,
                fontWeight = FontWeight.SemiBold,
                color = NexusColors.HeaderDarkNavy,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )

            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(
                    onClick = onNotificationClick,
                    enabled = accountActionsEnabled,
                    modifier = Modifier.size(44.dp)
                ) {
                    BadgedBox(badge = {
                        if (notificationUnread > 0) Badge(containerColor = Color(0xFF203F8C), contentColor = Color.White) {
                            Text(if (notificationUnread > 99) "99+" else notificationUnread.toString(), color = Color.White, fontSize = 11.sp)
                        }
                    }) {
                        Icon(Icons.Outlined.Notifications, contentDescription = "Notifications", modifier = Modifier.size(24.dp), tint = NexusColors.PrimaryBlue)
                    }
                }
                IconButton(onClick = onChatClick, enabled = accountActionsEnabled, modifier = Modifier.size(44.dp)) {
                    Icon(Icons.Outlined.ChatBubbleOutline, contentDescription = "Messages", modifier = Modifier.size(24.dp), tint = NexusColors.PrimaryBlue)
                }
                Box {
                    IconButton(
                        onClick = {
                            if (accountPageOpen) {
                                accountMenu = false
                                onCloseAccountPage()
                            } else {
                                accountMenu = !accountMenu
                            }
                        },
                        enabled = accountActionsEnabled,
                        modifier = Modifier.size(44.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Outlined.PersonOutline,
                            contentDescription = "Open account menu",
                            modifier = Modifier.size(24.dp),
                            tint = NexusColors.PrimaryBlue
                        )
                    }
                    DropdownMenu(expanded = accountMenu && accountActionsEnabled, onDismissRequest = { accountMenu = false }, modifier = Modifier.width(236.dp), shape = RoundedCornerShape(8.dp), containerColor = Color.White, tonalElevation = 0.dp, shadowElevation = 6.dp, border = androidx.compose.foundation.BorderStroke(1.dp, NexusColors.Border)) {
                        Column(Modifier.padding(horizontal = 16.dp, vertical = 8.dp)) {
                            Text(accountName, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = NexusColors.TextPrimary)
                            Text(accountEmail, fontSize = 12.sp, color = NexusColors.TextSecondary)
                        }
                        HorizontalDivider(color = NexusColors.Border)
                        DropdownMenuItem(text = { Text("Profile", fontSize = 14.sp) }, leadingIcon = { Icon(Icons.Outlined.PersonOutline, null, Modifier.size(18.dp), tint = NexusColors.PrimaryBlue) }, onClick = { accountMenu = false; onProfileClick() })
                        DropdownMenuItem(text = { Text("Billing Logs", fontSize = 14.sp) }, leadingIcon = { Icon(Icons.AutoMirrored.Outlined.ReceiptLong, null, Modifier.size(18.dp), tint = NexusColors.PrimaryBlue) }, onClick = { accountMenu = false; onBillingLogsClick() })
                        DropdownMenuItem(text = { Text("Settings", fontSize = 14.sp) }, leadingIcon = { Icon(Icons.Outlined.Settings, null, Modifier.size(18.dp), tint = NexusColors.PrimaryBlue) }, onClick = { accountMenu = false; onSettingsClick() })
                        HorizontalDivider(color = NexusColors.Border)
                        DropdownMenuItem(text = { Text("Log out", fontSize = 14.sp, color = NexusColors.ErrorRed) }, leadingIcon = { Icon(Icons.AutoMirrored.Outlined.Logout, null, Modifier.size(18.dp), tint = NexusColors.ErrorRed) }, onClick = { accountMenu = false; onLogoutClick() })
                    }
                }
            }
        }
        HorizontalDivider(thickness = 1.dp, color = Color(0xFFECEEF1))
    }
}
