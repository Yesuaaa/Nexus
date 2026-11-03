package com.nexus.app.features.auth.screens

import androidx.compose.foundation.layout.*
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.sp
import androidx.compose.ui.unit.dp
import com.nexus.app.core.components.LocalNexusToast
import com.nexus.app.features.auth.components.AuthButton
import com.nexus.app.features.auth.components.AuthTextField
import com.nexus.app.core.theme.NexusColors
import com.nexus.app.features.auth.components.AuthHeader
import com.nexus.app.features.auth.components.AuthScreenLayout
import com.nexus.app.features.auth.components.AuthHeading
import com.nexus.app.features.auth.model.AuthUser
import com.nexus.app.features.auth.model.registrationFieldErrors
import com.nexus.app.features.auth.viewmodel.RegisterViewModel
import org.koin.compose.viewmodel.koinViewModel

@Composable
fun RegisterScreen(
    onRegistered: (AuthUser) -> Unit,
    onNavigateToLogin: () -> Unit,
    modifier: Modifier = Modifier,
    viewModel: RegisterViewModel = koinViewModel()
) {
    val state by viewModel.state.collectAsState()
    val toast = LocalNexusToast.current
    var submitted by rememberSaveable { mutableStateOf(false) }

    val fieldErrors = if (submitted) registrationFieldErrors(
        state.fullName, state.contactNumber, state.email, state.password, state.confirmation
    ) else emptyMap()

    LaunchedEffect(viewModel) {
        viewModel.toasts.collect { toast.show(it.title, it.message, it.kind) }
    }

    AuthScreenLayout(
        modifier = modifier,
        registering = true,
        action = {
            AuthButton(
                text = if (state.offline) "Retry" else "Sign Up",
                loading = state.submitting,
                onClick = { submitted = true; viewModel.submit(onRegistered) }
            )
        },
        header = {
            AuthHeader(registering = true, enabled = !state.submitting,
                onSwitch = onNavigateToLogin)
        }
    ) {
        AuthHeading("Create Account",
            "Register for your EXP client account")
        AuthTextField(
            value = state.fullName,
            errorMessage = fieldErrors["fullName"],
            onValueChange = viewModel::onFullNameChange,
            label = "Full name",
            placeholder = "Juan Dela Cruz",
            enabled = !state.submitting
        )
        AuthTextField(
            value = state.contactNumber,
            errorMessage = fieldErrors["contactNumber"],
            onValueChange = viewModel::onContactNumberChange,
            label = "Contact number",
            placeholder = "09123456789",
            keyboardType = KeyboardType.Phone,
            enabled = !state.submitting
        )
        AuthTextField(
            value = state.email,
            errorMessage = fieldErrors["email"],
            onValueChange = viewModel::onEmailChange,
            label = "Email address",
            placeholder = "user@email.com",
            keyboardType = KeyboardType.Email,
            enabled = !state.submitting
        )
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            AuthTextField(
                value = state.password,
                errorMessage = fieldErrors["password"],
                onValueChange = viewModel::onPasswordChange,
                label = "Password",
                isPassword = true,
                modifier = Modifier.weight(1f),
                enabled = !state.submitting
            )
            AuthTextField(
                value = state.confirmation,
                errorMessage = fieldErrors["confirmation"],
                onValueChange = viewModel::onConfirmationChange,
                label = "Confirm password",
                isPassword = true,
                modifier = Modifier.weight(1f),
                enabled = !state.submitting
            )
        }
        Text(
            "Use at least 12 characters.",
            color = NexusColors.TextSecondary,
            fontSize = 12.sp,
            textAlign = TextAlign.Start,
            modifier = Modifier.fillMaxWidth()
        )
        if (!state.offline && fieldErrors.isEmpty()) {
            state.error?.let { Text(it, color = NexusColors.ErrorRed, fontSize = 13.sp) }
        }
    }
}