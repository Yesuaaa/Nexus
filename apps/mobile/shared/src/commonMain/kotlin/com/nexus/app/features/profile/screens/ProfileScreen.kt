package com.nexus.app.features.profile.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nexus.app.core.components.NexusButton
import com.nexus.app.core.components.NexusButtonVariant
import com.nexus.app.core.components.LocalNexusLayout
import com.nexus.app.core.theme.NexusColors
import com.nexus.app.features.auth.model.AuthUser

@Composable
fun ProfileScreen(
    user: AuthUser,
    onBack: () -> Unit,
    onLogout: () -> Unit,
    loggingOut: Boolean,
    modifier: Modifier = Modifier
) {
    val layout = LocalNexusLayout.current
    val displayName = user.fullName?.takeIf { it.isNotBlank() } ?: "My account"
    val initials = displayName.split(Regex("\\s+"))
        .take(2)
        .mapNotNull { it.firstOrNull()?.uppercaseChar() }
        .joinToString("")

    Box(modifier.fillMaxSize(), contentAlignment = Alignment.TopCenter) {
        Column(
            modifier = Modifier
                .widthIn(max = 640.dp).fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = layout.gutter, vertical = layout.gap),
            verticalArrangement = Arrangement.spacedBy(layout.gap)
        ) {
            TextButton(onClick = onBack, enabled = !loggingOut) {
                Icon(
                    imageVector = Icons.AutoMirrored.Outlined.ArrowBack,
                    contentDescription = null,
                    tint = NexusColors.PrimaryBlue
                )
                Text(
                    text = "Back",
                    color = NexusColors.PrimaryBlue,
                    modifier = Modifier.padding(start = 8.dp)
                )
            }
            Text(
                text = "My profile",
                fontSize = 28.sp,
                fontWeight = FontWeight.Bold,
                color = NexusColors.HeaderDarkNavy
            )
            Column(
                modifier = Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Box(
                    modifier = Modifier.size(56.dp).background(NexusColors.SurfaceHover, CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = initials,
                        fontSize = 24.sp,
                        fontWeight = FontWeight.Bold,
                        color = NexusColors.PrimaryBlue
                    )
                }
                Text(
                    text = displayName,
                    fontSize = 22.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = NexusColors.TextPrimary
                )
            }
            HorizontalDivider(color = NexusColors.Border)
            ProfileDetail("Email address", user.email)
            ProfileDetail("Contact number", user.contactNumber?.takeIf { it.isNotBlank() } ?: "Not provided")
            ProfileDetail(
                "Account role",
                when (user.role) {
                    "USER" -> "Client"
                    "STAFF" -> "Staff"
                    "ADMIN" -> "Admin"
                    "SUPERADMIN" -> "Superadmin"
                    else -> "Account"
                }
            )
            HorizontalDivider(color = NexusColors.Border)
            NexusButton(
                text = "Log out",
                onClick = onLogout,
                loading = loggingOut,
                variant = NexusButtonVariant.OUTLINE
            )
        }
    }
}

@Composable
private fun ProfileDetail(label: String, value: String) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(text = label, color = NexusColors.TextSecondary, fontSize = 12.sp)
        Text(text = value, color = NexusColors.TextPrimary, fontSize = 16.sp)
    }
}
