package com.nexus.app.features.auth.screens

import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nexus.app.core.components.LocalNexusToast
import com.nexus.app.core.theme.NexusColors
import com.nexus.app.features.auth.components.*
import com.nexus.app.features.auth.model.AuthUser
import com.nexus.app.features.auth.model.registrationFieldErrors
import com.nexus.app.features.auth.viewmodel.RegisterViewModel
import org.koin.compose.viewmodel.koinViewModel

@Composable
fun RegisterScreen(onRegistered: (AuthUser) -> Unit, onNavigateToLogin: () -> Unit, modifier: Modifier = Modifier,
    viewModel: RegisterViewModel = koinViewModel()) {
    val state by viewModel.state.collectAsState()
    val toast = LocalNexusToast.current
    var submitted by rememberSaveable { mutableStateOf(false) }
    val errors = if (submitted && !state.success) registrationFieldErrors(state.fullName, state.contactNumber, state.email, state.password, state.confirmation) else emptyMap()
    LaunchedEffect(viewModel) { viewModel.toasts.collect { toast.show(it.title, it.message, it.kind) } }
    AuthScreenLayout(modifier = modifier, registering = true, header = { AuthHeader() },
        action = { AuthButton(if (state.offline) "Retry" else "Create Account", state.submitting) { submitted = true; viewModel.submit { user -> submitted = false; onRegistered(user) } } },
        switchLink = { AuthSwitchLink("Already have an account?", "Sign In", !state.submitting, onNavigateToLogin) }
    ) {
        AuthHeading("Create Account", "Begin your digital journey with EXP today.")
        Spacer(Modifier.height(22.dp))
        Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
            AuthTextField(state.fullName, viewModel::onFullNameChange, "Full Name", "John Doe", errorMessage = errors["fullName"], enabled = !state.submitting, fieldHeight = 48.dp)
            AuthTextField(state.contactNumber.removePrefix("0"), { input ->
                val digits = input.filter(Char::isDigit)
                val national = when { digits.startsWith("63") && digits.length > 10 -> digits.drop(2); digits.startsWith("0") -> digits.drop(1); else -> digits }
                viewModel.onContactNumberChange(if (national.isBlank()) "" else "0" + national.take(10))
            }, "Contact No.", "917 123 4567", keyboardType = KeyboardType.Phone, errorMessage = errors["contactNumber"], enabled = !state.submitting, prefix = "+63", fieldHeight = 48.dp)
            AuthTextField(state.email, viewModel::onEmailChange, "Email Address", "you@example.com", keyboardType = KeyboardType.Email,
                errorMessage = errors["email"], enabled = !state.submitting, fieldHeight = 48.dp)
            AuthTextField(state.password, viewModel::onPasswordChange, "Password", "Create your password", isPassword = true,
                errorMessage = errors["password"], enabled = !state.submitting, fieldHeight = 48.dp)
            AuthTextField(state.confirmation, viewModel::onConfirmationChange, "Confirm Password", "Re-enter your password", isPassword = true,
                errorMessage = errors["confirmation"], enabled = !state.submitting, fieldHeight = 48.dp)
        }
        if (!state.success && !state.offline && errors.isEmpty()) state.error?.let { Text(it, Modifier.padding(top = 8.dp), color = NexusColors.ErrorRed, fontSize = 13.sp) }
    }
}
