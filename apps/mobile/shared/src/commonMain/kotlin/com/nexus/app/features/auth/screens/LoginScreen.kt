package com.nexus.app.features.auth.screens

import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.sp
import com.nexus.app.core.components.LocalNexusLayout
import com.nexus.app.core.components.LocalNexusToast
import com.nexus.app.core.components.NexusButton
import com.nexus.app.core.components.NexusTextField
import com.nexus.app.core.components.ToastKind
import com.nexus.app.core.theme.NexusColors
import com.nexus.app.features.auth.api.AuthRequestException
import com.nexus.app.features.auth.components.AuthHeader
import com.nexus.app.features.auth.components.AuthScreenLayout
import com.nexus.app.features.auth.components.AuthSwitchLink
import com.nexus.app.features.auth.model.validateLogin
import kotlinx.coroutines.launch

@Composable
fun LoginScreen(
    onLogin: suspend (String, String) -> Result<Unit>,
    onNavigateToRegister: () -> Unit = {},
    sessionNotice: String? = null,
    modifier: Modifier = Modifier
) {
    var email by rememberSaveable { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var submitting by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val toast = LocalNexusToast.current
    val layout = LocalNexusLayout.current

    AuthScreenLayout(
        modifier = modifier,
        action = {
            NexusButton(
                text = "Sign In",
                loading = submitting,
                onClick = {
                    val validation = validateLogin(email, password)
                    if (validation != null) {
                        errorMessage = validation
                    } else if (!submitting) {
                        submitting = true
                        scope.launch {
                            try {
                                onLogin(email, password).onFailure { error ->
                                    toast.show(
                                        "Sign-in failed",
                                        (error as? AuthRequestException)?.message
                                            ?: "Check your connection and try again.",
                                        ToastKind.ERROR
                                    )
                                }
                            } finally {
                                submitting = false
                            }
                        }
                    }
                }
            )
        },
        header = {
            AuthHeader()
        },
        footer = {
            AuthSwitchLink("Don't have an account?", "Register", !submitting, onNavigateToRegister)
        }
    ) {
        Text(
            "Welcome Back",
            fontSize = if (layout.short || layout.narrow) 26.sp else 30.sp,
            fontWeight = FontWeight.Bold,
            color = NexusColors.HeaderDarkNavy
        )
        Text("Sign in to your EXP account", fontSize = 14.sp, color = NexusColors.TextSecondary)
        NexusTextField(
            value = email,
            onValueChange = { email = it; errorMessage = null },
            label = "Email address",
            placeholder = "user@email.com",
            keyboardType = KeyboardType.Email,
            enabled = !submitting
        )
        NexusTextField(
            value = password,
            onValueChange = { password = it; errorMessage = null },
            label = "Password",
            isPassword = true,
            enabled = !submitting
        )
        errorMessage?.let { Text(it, color = NexusColors.ErrorRed, fontSize = 13.sp) }
        sessionNotice?.let { Text(it, color = NexusColors.TextSecondary, fontSize = 13.sp) }
    }
}

