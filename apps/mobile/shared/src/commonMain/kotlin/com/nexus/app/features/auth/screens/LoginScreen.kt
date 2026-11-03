package com.nexus.app.features.auth.screens

import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.sp
import com.nexus.app.core.components.LocalNexusToast
import com.nexus.app.features.auth.components.AuthButton
import com.nexus.app.features.auth.components.AuthTextField
import com.nexus.app.core.theme.NexusColors
import com.nexus.app.features.auth.components.AuthHeader
import com.nexus.app.features.auth.components.AuthScreenLayout
import com.nexus.app.features.auth.components.AuthHeading
import com.nexus.app.features.auth.model.AuthUser
import com.nexus.app.features.auth.viewmodel.AuthViewModel
import org.koin.compose.viewmodel.koinViewModel

@Composable
fun LoginScreen(
    onLoggedIn: (AuthUser) -> Unit,
    onNavigateToRegister: () -> Unit = {},
    sessionNotice: String? = null,
    modifier: Modifier = Modifier,
    viewModel: AuthViewModel = koinViewModel()
) {
    val state by viewModel.state.collectAsState()
    val toast = LocalNexusToast.current
    var submitted by rememberSaveable { mutableStateOf(false) }

    LaunchedEffect(viewModel) {
        viewModel.toasts.collect { toast.show(it.title, it.message, it.kind) }
    }

    AuthScreenLayout(
        modifier = modifier,
        registering = false,
        action = {
            AuthButton(
                text = if (state.offline) "Retry" else "Sign In",
                loading = state.submitting,
                onClick = { submitted = true; viewModel.submit(onLoggedIn) }
            )
        },
        header = {
            AuthHeader(registering = false, enabled = !state.submitting,
                onSwitch = onNavigateToRegister)
        }
    ) {
        AuthHeading("Welcome Back",
            "Sign in to your EXP account")
        AuthTextField(
            value = state.email,
            errorMessage = if (submitted && state.email.isBlank()) "Email address is required." else null,
            onValueChange = viewModel::onEmailChange,
            label = "Email address",
            placeholder = "user@email.com",
            keyboardType = KeyboardType.Email,
            enabled = !state.submitting
        )
        AuthTextField(
            value = state.password,
            errorMessage = if (submitted && state.password.isBlank()) "Password is required." else null,
            onValueChange = viewModel::onPasswordChange,
            label = "Password",
            isPassword = true,
            enabled = !state.submitting
        )
        if (!state.offline) {
            state.error?.let { Text(it, color = NexusColors.ErrorRed, fontSize = 13.sp) }
        }
        sessionNotice?.let { Text(it, color = NexusColors.TextSecondary, fontSize = 13.sp) }
    }
}