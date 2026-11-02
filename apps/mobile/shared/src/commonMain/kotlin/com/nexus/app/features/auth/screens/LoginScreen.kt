package com.nexus.app.features.auth.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nexus.app.core.components.NexusButton
import com.nexus.app.core.components.NexusTextField
import com.nexus.app.core.theme.NexusColors

@Composable
fun LoginScreen(
    onLoginSuccess: () -> Unit,
    onNavigateToRegister: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(NexusColors.Background)
            .padding(horizontal = 24.dp, vertical = 20.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.SpaceBetween
    ) {
        // Top Bar: English, Sign In, Register
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "English ▾",
                fontSize = 13.sp,
                color = NexusColors.TextSecondary
            )

            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(20.dp))
                        .border(1.dp, NexusColors.Border, RoundedCornerShape(20.dp))
                        .padding(horizontal = 16.dp, vertical = 6.dp)
                ) {
                    Text(
                        text = "Sign In",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = NexusColors.HeaderDarkNavy
                    )
                }

                Text(
                    text = "Register",
                    fontSize = 13.sp,
                    color = NexusColors.TextSecondary,
                    modifier = Modifier.clickable(onClick = onNavigateToRegister)
                )
            }
        }

        // Center Content
        Column(
            modifier = Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Spacer(modifier = Modifier.height(20.dp))

            // Welcome Back Title
            Text(
                text = buildAnnotatedString {
                    withStyle(SpanStyle(color = NexusColors.HeaderDarkNavy)) {
                        append("Welcome ")
                    }
                    withStyle(SpanStyle(color = NexusColors.AccentCyan)) {
                        append("Back")
                    }
                },
                fontSize = 32.sp,
                fontWeight = FontWeight.Bold
            )

            Text(
                text = "Sign in to your EXP account",
                fontSize = 15.sp,
                color = NexusColors.TextSecondary,
                modifier = Modifier.padding(bottom = 16.dp)
            )

            NexusTextField(
                value = email,
                onValueChange = { email = it },
                label = "EMAIL ADDRESS",
                placeholder = "username@gmail.com",
                keyboardType = KeyboardType.Email
            )

            NexusTextField(
                value = password,
                onValueChange = { password = it },
                label = "PASSWORD",
                placeholder = "••••••••••••",
                isPassword = true
            )

            Spacer(modifier = Modifier.height(8.dp))

            NexusButton(
                text = "Sign In",
                onClick = onLoginSuccess
            )
        }

        // Footer Links
        Row(
            modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp),
            horizontalArrangement = Arrangement.SpaceEvenly
        ) {
            Text(
                text = "About EXP",
                fontSize = 12.sp,
                color = NexusColors.TextMuted
            )
            Text(
                text = "Terms of Use",
                fontSize = 12.sp,
                color = NexusColors.TextMuted
            )
            Text(
                text = "Privacy Policy",
                fontSize = 12.sp,
                color = NexusColors.TextMuted
            )
        }
    }
}

